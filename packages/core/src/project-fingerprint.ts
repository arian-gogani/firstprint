/**
 * @firstprint/core — Project-Level Fingerprinting
 * 
 * Fingerprints an entire project directory, combining
 * file-level and function-level fingerprints into a
 * single project fingerprint.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { randomUUID } from 'crypto';
import { fingerprint } from './fingerprint.js';
import { fingerprintFunctions } from './function-fingerprint.js';
import { computeMinHash, computeSimHash, sha256, merkleRoot } from './hash.js';
import { detectLanguage } from './parser.js';
import type { Language, StructuralFingerprint, StructuralFeature } from './types.js';
import type { FunctionFingerprint, FileFunctionFingerprints } from './function-fingerprint.js';

const FINGERPRINT_VERSION = '0.1.0';

/** Fingerprint of a single file within a project */
export interface FileFingerprint {
  relativePath: string;
  language: Language;
  fingerprint: StructuralFingerprint;
  functions: FunctionFingerprint[];
  sizeBytes: number;
}

/** Fingerprint of an entire project */
export interface ProjectFingerprint {
  id: string;
  name: string;
  rootPath: string;
  createdAt: number;
  files: FileFingerprint[];
  aggregate: StructuralFingerprint;
  fileCount: number;
  functionCount: number;
  featureCount: number;
  projectHash: string;
}

export interface ProjectOptions {
  extensions?: string[];
  excludeDirs?: string[];
  maxFileSize?: number;
  maxFiles?: number;
}

const DEFAULT_OPTIONS: Required<ProjectOptions> = {
  extensions: ['.ts', '.tsx', '.py'],
  excludeDirs: [
    'node_modules', 'dist', 'build', '.git',
    '__pycache__', 'coverage', '.next', '.cache',
    'vendor', 'venv', '.env',
  ],
  maxFileSize: 100_000,
  maxFiles: 500,
};

/** Recursively collect source files from a directory */
function collectFiles(
  dir: string,
  opts: Required<ProjectOptions>,
  results: string[] = []
): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!opts.excludeDirs.includes(entry)) {
          collectFiles(fullPath, opts, results);
        }
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (opts.extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible files
    }
  }
  return results;
}

/**
 * Fingerprint an entire project directory.
 */
export async function fingerprintProject(
  rootPath: string,
  name?: string,
  options?: ProjectOptions
): Promise<ProjectFingerprint> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const projectName = name || rootPath.split('/').pop() || 'unknown';
  const filePaths = collectFiles(rootPath, opts);

  const files: FileFingerprint[] = [];
  let totalFunctions = 0;
  let totalFeatures = 0;
  const allFeatures: StructuralFeature[] = [];

  for (const filePath of filePaths.slice(0, opts.maxFiles)) {
    const relPath = relative(rootPath, filePath);
    const lang = detectLanguage(filePath);
    if (!lang) continue;

    try {
      const source = readFileSync(filePath, 'utf-8');
      if (source.length > opts.maxFileSize) continue;
      if (source.trim().length === 0) continue;

      const result = await fingerprintFunctions(source, lang);
      const stat = statSync(filePath);

      files.push({
        relativePath: relPath,
        language: lang,
        fingerprint: result.fileFingerprint,
        functions: result.functions,
        sizeBytes: stat.size,
      });

      totalFunctions += result.functionCount;
      totalFeatures += result.fileFingerprint.featureCount;
      allFeatures.push(...result.fileFingerprint.features);
    } catch {
      // Skip files that fail to parse
    }
  }

  // Build aggregate project fingerprint
  const astFeats = allFeatures
    .filter(f => f.type === 'ast_subtree')
    .map(f => f.canonical);
  const cfgFeats = allFeatures
    .filter(f => f.type === 'control_flow')
    .map(f => f.canonical);
  const depFeats = allFeatures
    .filter(f => f.type === 'dependency')
    .map(f => f.canonical).sort();

  const aggregate: StructuralFingerprint = {
    id: randomUUID(),
    version: FINGERPRINT_VERSION,
    language: 'typescript', // primary language
    createdAt: Date.now(),
    astMinHash: computeMinHash(astFeats),
    controlFlowSimHash: computeSimHash(cfgFeats),
    dependencyHash: sha256(depFeats.join('|')),
    features: allFeatures,
    featureCount: totalFeatures,
    fingerprintHash: '',
  };

  // Compute project-level Merkle root
  const fileHashes = files.map(f => f.fingerprint.fingerprintHash);
  const projectHash = merkleRoot(fileHashes.length > 0 ? fileHashes : [sha256('')]);
  aggregate.fingerprintHash = projectHash;

  return {
    id: randomUUID(),
    name: projectName,
    rootPath,
    createdAt: Date.now(),
    files,
    aggregate,
    fileCount: files.length,
    functionCount: totalFunctions,
    featureCount: totalFeatures,
    projectHash,
  };
}
