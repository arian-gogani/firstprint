#!/usr/bin/env node
/**
 * Firstprint CLI
 * 
 * Search by logic, not by words.
 * 
 * Commands:
 *   firstprint scan <path>               — Fingerprint a project
 *   firstprint compare <pathA> <pathB>   — Compare two projects
 *   firstprint check <file>              — "Has this been done before?"
 *   firstprint register <path>           — Register + get birth certificate
 *   firstprint diff <path> [--since=hash] — Structural diff
 *   firstprint verify <id>               — Verify a ledger entry
 */

const args = process.argv.slice(2);
const command = args[0];

const LOGO = `
  ╔═══════════════════════════════════════╗
  ║         F I R S T P R I N T          ║
  ║   Search by logic, not by words.      ║
  ╚═══════════════════════════════════════╝`;

function usage() {
  console.log(LOGO);
  console.log(`
  Usage: firstprint <command> [options]

  Commands:
    scan <path>                Fingerprint a project directory
    compare <pathA> <pathB>    Compare two projects structurally
    check <file>               Has this code been done before?
    register <path>            Register & get a birth certificate
    verify <id>                Verify a ledger entry

  Options:
    --json                     Output as JSON
    --verbose                  Show detailed output
    --help                     Show this help
  `);
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const isVerbose = args.includes('--verbose');

  switch (command) {
    case 'scan':
      await cmdScan(args[1], isJson, isVerbose);
      break;
    case 'compare':
      await cmdCompare(args[1], args[2], isJson, isVerbose);
      break;
    case 'check':
      await cmdCheck(args[1], isJson, isVerbose);
      break;
    case 'register':
      await cmdRegister(args[1], isJson);
      break;
    case 'diff':
      await cmdDiff(args[1], args[2], isJson);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

// ─── Commands ──────────────────────────────────────────────────

import { resolve } from 'path';
import { readFileSync } from 'fs';

async function cmdScan(
  pathArg: string | undefined,
  isJson: boolean,
  isVerbose: boolean
) {
  if (!pathArg) {
    console.error('Usage: firstprint scan <path>');
    process.exit(1);
  }
  const dir = resolve(pathArg);
  const { fingerprintProject } =
    await import('../../core/src/project-fingerprint.js');

  if (!isJson) console.log(`\nScanning ${dir}...\n`);
  const result = await fingerprintProject(dir);

  if (isJson) {
    console.log(JSON.stringify(result, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v, 2));
    return;
  }

  console.log(`  Project:     ${result.name}`);
  console.log(`  Files:       ${result.fileCount}`);
  console.log(`  Functions:   ${result.functionCount}`);
  console.log(`  Features:    ${result.featureCount}`);
  console.log(`  Hash:        ${result.projectHash.slice(0, 16)}...`);
  console.log();

  if (isVerbose) {
    for (const f of result.files) {
      const funcs = f.functions.length;
      const feats = f.fingerprint.featureCount;
      console.log(`    ${f.relativePath.padEnd(40)} ${funcs} funcs  ${feats} feats`);
    }
    console.log();
  }
}

async function cmdCompare(
  pathA: string | undefined,
  pathB: string | undefined,
  isJson: boolean,
  isVerbose: boolean
) {
  if (!pathA || !pathB) {
    console.error('Usage: firstprint compare <pathA> <pathB>');
    process.exit(1);
  }

  const { fingerprintProject } =
    await import('../../core/src/project-fingerprint.js');
  const { compare } =
    await import('../../compare/src/compare.js');
  const { compareFunctions } =
    await import('../../compare/src/function-compare.js');

  const dirA = resolve(pathA);
  const dirB = resolve(pathB);

  if (!isJson) console.log(`\nComparing:\n  A: ${dirA}\n  B: ${dirB}\n`);

  const [projA, projB] = await Promise.all([
    fingerprintProject(dirA),
    fingerprintProject(dirB),
  ]);

  // Project-level comparison
  const result = compare(projA.aggregate, projB.aggregate);

  if (isJson) {
    console.log(JSON.stringify({ projectA: projA.name, projectB: projB.name, result },
      (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    return;
  }

  const score = (result.derivationScore * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(result.derivationScore * 30));
  const empty = '░'.repeat(30 - Math.round(result.derivationScore * 30));

  console.log(`  Derivation:  ${bar}${empty} ${score}%`);
  console.log(`  Band:        ${result.band.toUpperCase()}`);
  console.log(`  Confidence:  ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`\n  ${result.summary}`);

  // Layer breakdown
  console.log('\n  Layers:');
  for (const l of result.layerScores) {
    const lb = '█'.repeat(Math.round(l.rawSimilarity * 20));
    const le = '░'.repeat(20 - Math.round(l.rawSimilarity * 20));
    console.log(`    ${l.layer.padEnd(15)} ${lb}${le} ${(l.rawSimilarity * 100).toFixed(1)}%`);
  }

  // Evidence
  if (result.evidence.length > 0) {
    console.log('\n  Evidence:');
    for (const e of result.evidence.slice(0, 10)) {
      console.log(`    ⚠ ${e.description}`);
    }
  }
  console.log();
}

async function cmdCheck(
  fileArg: string | undefined,
  isJson: boolean,
  isVerbose: boolean
) {
  if (!fileArg) {
    console.error('Usage: firstprint check <file>');
    process.exit(1);
  }

  const filePath = resolve(fileArg);
  const { fingerprint } =
    await import('../../core/src/fingerprint.js');
  const { detectLanguage } =
    await import('../../core/src/parser.js');

  const lang = detectLanguage(filePath);
  if (!lang) {
    console.error(`Unsupported file type: ${filePath}`);
    process.exit(1);
  }

  const source = readFileSync(filePath, 'utf-8');

  if (!isJson) console.log(`\nChecking: ${filePath}\n`);

  const fp = await fingerprint(source, lang);

  if (isJson) {
    console.log(JSON.stringify(fp, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v, 2));
    return;
  }

  console.log(`  Language:    ${fp.language}`);
  console.log(`  Features:    ${fp.featureCount}`);
  console.log(`  Hash:        ${fp.fingerprintHash.slice(0, 16)}...`);
  console.log(`  ID:          ${fp.id}`);

  // Feature breakdown
  const byType: Record<string, number> = {};
  for (const f of fp.features) {
    byType[f.type] = (byType[f.type] || 0) + 1;
  }
  console.log('\n  Features by type:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`    ${type.padEnd(20)} ${count}`);
  }
  console.log();
}

async function cmdRegister(
  pathArg: string | undefined,
  isJson: boolean
) {
  if (!pathArg) {
    console.error('Usage: firstprint register <path>');
    process.exit(1);
  }

  const { fingerprintProject } =
    await import('../../core/src/project-fingerprint.js');
  const { Ledger } =
    await import('../../ledger/src/ledger.js');

  const dir = resolve(pathArg);
  if (!isJson) console.log(`\nRegistering ${dir}...\n`);

  const project = await fingerprintProject(dir);
  const ledger = await Ledger.create();
  const entry = await ledger.register(project.aggregate);
  const verification = await ledger.verify(entry);

  if (isJson) {
    console.log(JSON.stringify({ project: project.name, entry, verification },
      (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    return;
  }

  console.log(`  ╔═══════════════════════════════════════╗`);
  console.log(`  ║       BIRTH CERTIFICATE ISSUED        ║`);
  console.log(`  ╠═══════════════════════════════════════╣`);
  console.log(`  ║  Project:   ${project.name.padEnd(25)}║`);
  console.log(`  ║  Files:     ${String(project.fileCount).padEnd(25)}║`);
  console.log(`  ║  Functions: ${String(project.functionCount).padEnd(25)}║`);
  console.log(`  ║  Features:  ${String(project.featureCount).padEnd(25)}║`);
  console.log(`  ║  Hash:      ${project.projectHash.slice(0, 16).padEnd(25)}║`);
  console.log(`  ║  Entry ID:  ${entry.id.slice(0, 16).padEnd(25)}║`);
  console.log(`  ║  Timestamp: ${entry.timestamp.slice(0, 19).padEnd(25)}║`);
  console.log(`  ║  Signature: ${entry.platformSignature.slice(0, 16).padEnd(25)}║`);
  console.log(`  ║  Verified:  ${(verification.valid ? '✓ YES' : '✗ NO').padEnd(25)}║`);
  console.log(`  ╚═══════════════════════════════════════╝`);
  console.log();
}

async function cmdDiff(
  fileA: string | undefined,
  fileB: string | undefined,
  isJson: boolean
) {
  if (!fileA || !fileB) {
    console.error('Usage: firstprint diff <fileA> <fileB>');
    process.exit(1);
  }

  const { fingerprint } = await import('../../core/src/fingerprint.js');
  const { detectLanguage } = await import('../../core/src/parser.js');
  const { structuralDiff } = await import('../../compare/src/structural-diff.js');

  const pathA = resolve(fileA);
  const pathB = resolve(fileB);

  const langA = detectLanguage(pathA);
  const langB = detectLanguage(pathB);
  if (!langA || !langB) {
    console.error('Unsupported file type');
    process.exit(1);
  }

  const sourceA = readFileSync(pathA, 'utf-8');
  const sourceB = readFileSync(pathB, 'utf-8');

  const fpA = await fingerprint(sourceA, langA);
  const fpB = await fingerprint(sourceB, langB);

  const diff = structuralDiff(fpA, fpB);

  if (isJson) {
    console.log(JSON.stringify(diff, null, 2));
    return;
  }

  console.log(`\n  Structural Diff: ${pathA.split('/').pop()} → ${pathB.split('/').pop()}\n`);
  console.log(`  Added:     +${diff.added}`);
  console.log(`  Removed:   -${diff.removed}`);
  console.log(`  Unchanged:  ${diff.unchanged}`);
  console.log();

  if (diff.changes.length > 0) {
    console.log('  Changes:');
    for (const c of diff.changes.slice(0, 20)) {
      const icon = c.type === 'added' ? '  + ' : '  - ';
      console.log(`  ${icon}${c.description}`);
    }
    if (diff.changes.length > 20) {
      console.log(`  ... and ${diff.changes.length - 20} more`);
    }
  }

  console.log(`\n  ${diff.summary}\n`);
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
