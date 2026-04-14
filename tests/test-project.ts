/**
 * Firstprint — Project & CLI Integration Tests
 * 
 * Tests project-level fingerprinting, comparison, and CLI.
 * 
 * Run: npx tsx tests/test-project.ts
 */

import { fingerprintProject } from '../packages/core/src/project-fingerprint.js';
import { compare } from '../packages/compare/src/compare.js';
import { compareProjects } from '../packages/compare/src/project-compare.js';
import { Ledger } from '../packages/ledger/src/ledger.js';
import { resolve } from 'path';

let passed = 0, failed = 0, total = 0;

function assert(cond: boolean, name: string, detail?: string) {
  total++;
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━\n`);
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════╗
║   FIRSTPRINT — PROJECT & INTEGRATION TESTS    ║
╚═══════════════════════════════════════════════╝`);

  // ─── 1. Project Fingerprinting ─────────────────────────────

  section('1. Project Fingerprinting');

  const corePath = resolve('./packages/core/src');
  const proj = await fingerprintProject(corePath, 'core');

  assert(proj.fileCount > 0, `Found ${proj.fileCount} files`);
  assert(proj.functionCount > 0, `Found ${proj.functionCount} functions`);
  assert(proj.featureCount > 0, `Found ${proj.featureCount} features`);
  assert(proj.projectHash.length === 64, 'Project hash is 64 chars (SHA-256)');
  assert(proj.aggregate.astMinHash.length === 128, 'Aggregate MinHash is 128-dim');
  assert(proj.files.every(f => f.fingerprint.id), 'Every file has a fingerprint ID');
  assert(proj.id.length > 0, 'Project has ID');

  // ─── 2. Self-Comparison ────────────────────────────────────

  section('2. Project Self-Comparison');

  const proj2 = await fingerprintProject(corePath, 'core-copy');
  const selfResult = compare(proj.aggregate, proj2.aggregate);

  assert(
    selfResult.derivationScore === 1.0,
    'Self-comparison: 100% match'
  );
  assert(
    selfResult.band === 'high_confidence_clone',
    `Self-comparison band: ${selfResult.band}`
  );

  // ─── 3. Cross-Package Comparison ───────────────────────────

  section('3. Cross-Package Comparison');

  const comparePath = resolve('./packages/compare/src');
  const compProj = await fingerprintProject(comparePath, 'compare');

  const crossResult = compareProjects(proj, compProj);

  assert(crossResult.aggregate.derivationScore < 1.0,
    `Cross-package score: ${(crossResult.aggregate.derivationScore * 100).toFixed(1)}% (< 100%)`);
  assert(crossResult.matchedFileCount >= 0,
    `Matched files: ${crossResult.matchedFileCount}`);
  assert(crossResult.summary.length > 0, 'Summary generated');
  console.log(`\n  ${crossResult.summary}`);

  // ─── 4. Ledger Registration of Project ─────────────────────

  section('4. Project Ledger Registration');

  const ledger = await Ledger.create();
  const entry = await ledger.register(proj.aggregate);

  assert(entry.sequence === 0, 'Entry sequence: 0');
  assert(entry.platformSignature.length > 0, 'Entry is signed');

  const v = await ledger.verify(entry);
  assert(v.valid, 'Entry verified successfully');
  assert(v.signatureValid, 'Signature valid');
  assert(v.chainValid, 'Chain valid');

  // ─── 5. Determinism ────────────────────────────────────────

  section('5. Project Fingerprint Determinism');

  assert(
    proj.projectHash === proj2.projectHash,
    'Same project → same hash'
  );
  assert(
    proj.fileCount === proj2.fileCount,
    'Same project → same file count'
  );

  // ─── Results ───────────────────────────────────────────────

  console.log(`
╔═══════════════════════════════════════════════╗
║         PROJECT TEST RESULTS                   ║
╠═══════════════════════════════════════════════╣
║  Total:  ${String(total).padStart(3)}                                  ║
║  Passed: ${String(passed).padStart(3)} ✅                                ║
║  Failed: ${String(failed).padStart(3)} ${failed > 0 ? '❌' : '✅'}                                ║
╚═══════════════════════════════════════════════╝
  `);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
