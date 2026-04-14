/**
 * @firstprint/rarity — GitHub Corpus Seeder
 * 
 * Crawls public GitHub repos and builds frequency tables
 * for structural patterns. This is what makes the scoring
 * system meaningful — without rarity data, all patterns
 * are weighted equally.
 * 
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx npx tsx packages/rarity/src/seeder.ts
 * 
 * Respects GitHub API rate limits (5000 req/hr authenticated).
 */

import { fingerprint } from '../../core/src/fingerprint.js';
import { createCorpus, addProjectToCorpus, saveCorpus } from './corpus.js';
import type { StructuralFeature } from '../../core/src/types.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const GITHUB_API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN || '';
const CORPUS_DIR = './corpus';
const CORPUS_PATH = `${CORPUS_DIR}/rarity-corpus.json`;

/** GitHub API headers */
function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Firstprint-Corpus-Seeder/0.1',
  };
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
  return h;
}

/** Fetch top TypeScript repos by stars */
async function fetchTopRepos(
  language: string,
  perPage: number = 30,
  page: number = 1
): Promise<{ name: string; full_name: string; default_branch: string }[]> {
  const url = `${GITHUB_API}/search/repositories?q=language:${language}+stars:>1000&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    console.error(`GitHub API error: ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json() as any;
  return data.items.map((item: any) => ({
    name: item.name,
    full_name: item.full_name,
    default_branch: item.default_branch,
  }));
}

/** Fetch the file tree of a repo */
async function fetchRepoTree(
  fullName: string,
  branch: string
): Promise<{ path: string; type: string }[]> {
  const url = `${GITHUB_API}/repos/${fullName}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.tree || [])
    .filter((f: any) => f.type === 'blob')
    .map((f: any) => ({ path: f.path, type: f.type }));
}

/** Fetch a single file's content */
async function fetchFileContent(
  fullName: string,
  path: string,
  branch: string
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`;
  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return null;
    const text = await res.text();
    // Skip huge files
    if (text.length > 100_000) return null;
    return text;
  } catch {
    return null;
  }
}

/** Detect language from file path */
function getLanguage(path: string): 'typescript' | 'python' | null {
  if (path.endsWith('.ts') && !path.endsWith('.d.ts')) return 'typescript';
  if (path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.py')) return 'python';
  return null;
}

/** Main seeder function */
async function seed() {
  console.log(`
╔═══════════════════════════════════════════════╗
║     FIRSTPRINT — RARITY CORPUS SEEDER         ║
╚═══════════════════════════════════════════════╝
`);

  if (!TOKEN) {
    console.log('⚠ No GITHUB_TOKEN set. Using unauthenticated API (60 req/hr).');
    console.log('  Set GITHUB_TOKEN for 5000 req/hr.\n');
  }

  if (!existsSync(CORPUS_DIR)) mkdirSync(CORPUS_DIR, { recursive: true });

  const corpus = createCorpus();
  const MAX_REPOS = 20;
  const MAX_FILES_PER_REPO = 15;

  console.log(`Fetching top ${MAX_REPOS} TypeScript repos by stars...\n`);
  const repos = await fetchTopRepos('typescript', MAX_REPOS);

  if (repos.length === 0) {
    console.error('No repos found. Check your GITHUB_TOKEN.');
    process.exit(1);
  }

  let totalFiles = 0;
  let totalFeatures = 0;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    console.log(`[${i + 1}/${repos.length}] ${repo.full_name}`);

    const tree = await fetchRepoTree(repo.full_name, repo.default_branch);
    const tsFiles = tree
      .filter(f => getLanguage(f.path) !== null)
      .filter(f => !f.path.includes('node_modules'))
      .filter(f => !f.path.includes('dist/'))
      .filter(f => !f.path.includes('.test.'))
      .filter(f => !f.path.includes('.spec.'))
      .filter(f => !f.path.includes('__tests__'))
      .slice(0, MAX_FILES_PER_REPO);

    const repoFeatures: StructuralFeature[] = [];
    let filesProcessed = 0;

    for (const file of tsFiles) {
      const lang = getLanguage(file.path);
      if (!lang) continue;

      const content = await fetchFileContent(
        repo.full_name, file.path, repo.default_branch
      );
      if (!content) continue;

      try {
        const fp = await fingerprint(content, lang);
        repoFeatures.push(...fp.features);
        filesProcessed++;
      } catch (e) {
        // Skip unparseable files silently
      }
    }

    if (repoFeatures.length > 0) {
      addProjectToCorpus(corpus, repoFeatures, filesProcessed);
      totalFiles += filesProcessed;
      totalFeatures += repoFeatures.length;
      console.log(`  → ${filesProcessed} files, ${repoFeatures.length} features`);
    } else {
      console.log(`  → skipped (no parseable files)`);
    }

    // Rate limit pause
    await new Promise(r => setTimeout(r, 500));
  }

  // Save corpus
  saveCorpus(corpus, CORPUS_PATH);

  console.log(`
━━━ Corpus Complete ━━━
  Repos analyzed:   ${corpus.totalProjects}
  Files processed:  ${totalFiles}
  Total features:   ${totalFeatures}
  Unique patterns:  ${corpus.patternFrequency.size}
  Saved to:         ${CORPUS_PATH}
`);
}

seed().catch(err => {
  console.error('Seeder error:', err);
  process.exit(1);
});
