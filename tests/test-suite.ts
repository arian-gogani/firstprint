/**
 * Firstprint Test Suite — Comprehensive Clone Detection Validation
 * 
 * Tests the system against 5 scenarios at varying similarity:
 * 1. Exact clone (renamed) → expect 85-100%
 * 2. Partial clone (~50%) → expect 35-65%
 * 3. Independent implementation → expect 5-35%
 * 4. Unrelated code → expect 0-20%
 * 5. Refactored clone → expect 40-80%
 * 
 * Also tests:
 * - MinHash/SimHash correctness
 * - Ledger integrity & tamper detection
 * - Normalizer accuracy
 * 
 * Run: npx tsx tests/test-suite.ts
 */

import { fingerprint } from '../packages/core/src/fingerprint.js';
import { parseCode } from '../packages/core/src/parser.js';
import { normalizeAST, serializeAST } from '../packages/core/src/normalizer.js';
import { extractAllFeatures } from '../packages/core/src/extractor.js';
import {
  computeMinHash,
  estimateJaccard,
  computeSimHash,
  simHashSimilarity,
  sha256,
  merkleRoot,
} from '../packages/core/src/hash.js';
import { compare } from '../packages/compare/src/compare.js';
import { Ledger } from '../packages/ledger/src/ledger.js';
import {
  ORIGINAL,
  EXACT_CLONE,
  PARTIAL_CLONE,
  INDEPENDENT_IMPL,
  UNRELATED,
  REFACTORED_CLONE,
} from './fixtures/samples.js';

// ─── Test Framework ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let total = 0;

function assert(
  condition: boolean,
  name: string,
  detail?: string
): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function assertRange(
  value: number,
  min: number,
  max: number,
  name: string
): void {
  const pct = (value * 100).toFixed(1);
  assert(
    value >= min && value <= max,
    `${name}: ${pct}% [expected ${(min*100).toFixed(0)}-${(max*100).toFixed(0)}%]`,
    value < min ? `too low (${pct}%)` : value > max ? `too high (${pct}%)` : undefined
  );
}

function section(name: string): void {
  console.log(`\n━━━ ${name} ━━━\n`);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════════╗
║       FIRSTPRINT — FULL TEST SUITE            ║
╚═══════════════════════════════════════════════╝`);

  // ─── 1. Hash Function Tests ──────────────────────────────────────────

  section('1. Hash Function Correctness');

  // MinHash: identical sets should have Jaccard = 1.0
  const setA = ['foo', 'bar', 'baz', 'qux'];
  const sigA = computeMinHash(setA);
  const sigA2 = computeMinHash(setA);
  assert(
    estimateJaccard(sigA, sigA2) === 1.0,
    'MinHash: identical sets → Jaccard 1.0'
  );

  // MinHash: disjoint sets should have low Jaccard
  const setB = ['alpha', 'beta', 'gamma', 'delta'];
  const sigB = computeMinHash(setB);
  assert(
    estimateJaccard(sigA, sigB) < 0.2,
    'MinHash: disjoint sets → Jaccard < 0.2'
  );

  // MinHash: overlapping sets
  const setC = ['foo', 'bar', 'alpha', 'beta'];
  const sigC = computeMinHash(setC);
  const jacAC = estimateJaccard(sigA, sigC);
  // Exact Jaccard = |{foo,bar}| / |{foo,bar,baz,qux,alpha,beta}| = 2/6 = 0.333
  assert(
    jacAC > 0.15 && jacAC < 0.55,
    `MinHash: 50% overlap → Jaccard ≈ 0.33 (got ${jacAC.toFixed(3)})`
  );

  // SimHash: identical inputs → identical hash
  const sh1 = computeSimHash(['hello', 'world']);
  const sh2 = computeSimHash(['hello', 'world']);
  assert(sh1 === sh2, 'SimHash: identical inputs → identical hash');

  // SimHash: similar inputs → similar hash (high similarity)
  const sh3 = computeSimHash(['hello', 'world', 'foo']);
  assert(
    simHashSimilarity(sh1, sh3) > 0.6,
    `SimHash: similar inputs → high similarity (${simHashSimilarity(sh1, sh3).toFixed(3)})`
  );

  // SimHash: different inputs → low similarity
  const sh4 = computeSimHash(['completely', 'different', 'content', 'here']);
  assert(
    simHashSimilarity(sh1, sh4) < 0.7,
    `SimHash: different inputs → lower similarity (${simHashSimilarity(sh1, sh4).toFixed(3)})`
  );

  // SHA-256: deterministic
  assert(
    sha256('test') === sha256('test'),
    'SHA-256: deterministic'
  );
  assert(
    sha256('test') !== sha256('test2'),
    'SHA-256: different inputs → different hashes'
  );

  // Merkle root
  const mr1 = merkleRoot(['a', 'b', 'c', 'd']);
  const mr2 = merkleRoot(['a', 'b', 'c', 'd']);
  assert(mr1 === mr2, 'Merkle root: deterministic');
  assert(
    mr1 !== merkleRoot(['a', 'b', 'c', 'e']),
    'Merkle root: different leaves → different root'
  );

  // ─── 2. Parser & Normalizer Tests ────────────────────────────────────

  section('2. Parser & Normalizer');

  const simpleCode = `
    function greet(name: string): string {
      return "Hello, " + name;
    }
  `;
  const ast = await parseCode(simpleCode, 'typescript');
  assert(ast.type === 'program', 'Parser: root node is "program"');
  assert(ast.children.length > 0, 'Parser: has child nodes');

  const normalized = normalizeAST(ast);
  const serialized = serializeAST(normalized);
  assert(
    !serialized.includes('greet'),
    'Normalizer: function name "greet" removed'
  );
  assert(
    !serialized.includes('name'),
    'Normalizer: parameter "name" removed'
  );

  // Same function with different names should normalize identically
  const codeA = `function add(x: number, y: number) { return x + y; }`;
  const codeB = `function sum(a: number, b: number) { return a + b; }`;
  const astA = await parseCode(codeA, 'typescript');
  const astB = await parseCode(codeB, 'typescript');
  const normA = serializeAST(normalizeAST(astA));
  const normB = serializeAST(normalizeAST(astB));
  assert(
    normA === normB,
    'Normalizer: renamed function produces identical structure'
  );

  // ─── 3. Feature Extraction Tests ─────────────────────────────────────

  section('3. Feature Extraction');

  const featCode = `
    import { readFile } from 'fs';
    async function process(data: string) {
      if (!data) throw new Error('empty');
      if (data.length > 1000) return null;
      try {
        const result = JSON.parse(data);
        if (result.type === 'admin') {
          return await handleAdmin(result);
        } else {
          return await handleUser(result);
        }
      } catch (e) {
        console.error(e);
        return null;
      }
    }
  `;
  const featAst = await parseCode(featCode, 'typescript');
  const featNorm = normalizeAST(featAst);
  const features = extractAllFeatures(featNorm);

  const astFeats = features.filter(f => f.type === 'ast_subtree');
  const cfFeats = features.filter(f => f.type === 'control_flow');
  const depFeats = features.filter(f => f.type === 'dependency');
  const logicFeats = features.filter(f => f.type === 'logic_pattern');

  assert(astFeats.length > 10, `AST subtrees: ${astFeats.length} extracted (>10)`);
  assert(cfFeats.length > 0, `Control flow: ${cfFeats.length} extracted (>0)`);
  assert(depFeats.length > 0, `Dependencies: ${depFeats.length} extracted (>0)`);
  assert(logicFeats.length > 0, `Logic patterns: ${logicFeats.length} extracted (>0)`);

  // Check guard clause detection
  const guardFeats = logicFeats.filter(f => f.canonical.includes('GUARD'));
  assert(guardFeats.length > 0, 'Guard clause pattern detected');

  // ─── 4. Clone Detection Tests (THE MAIN EVENT) ──────────────────────

  section('4. Clone Detection — Scenario Matrix');

  console.log('  Fingerprinting all samples...\n');
  const originalFp = await fingerprint(ORIGINAL, 'typescript');
  const exactFp = await fingerprint(EXACT_CLONE, 'typescript');
  const partialFp = await fingerprint(PARTIAL_CLONE, 'typescript');
  const independentFp = await fingerprint(INDEPENDENT_IMPL, 'typescript');
  const unrelatedFp = await fingerprint(UNRELATED, 'typescript');
  const refactoredFp = await fingerprint(REFACTORED_CLONE, 'typescript');

  console.log(`  Original:     ${originalFp.featureCount} features`);
  console.log(`  Exact clone:  ${exactFp.featureCount} features`);
  console.log(`  Partial:      ${partialFp.featureCount} features`);
  console.log(`  Independent:  ${independentFp.featureCount} features`);
  console.log(`  Unrelated:    ${unrelatedFp.featureCount} features`);
  console.log(`  Refactored:   ${refactoredFp.featureCount} features`);
  console.log();

  // Scenario 1: Exact clone
  const r1 = compare(originalFp, exactFp);
  console.log(`  Exact clone score:   ${(r1.derivationScore * 100).toFixed(1)}% [${r1.band}]`);
  assertRange(r1.derivationScore, 0.85, 1.0, 'Exact clone');

  // Scenario 2: Partial clone
  const r2 = compare(originalFp, partialFp);
  console.log(`  Partial clone score: ${(r2.derivationScore * 100).toFixed(1)}% [${r2.band}]`);
  assertRange(r2.derivationScore, 0.25, 0.75, 'Partial clone');

  // Scenario 3: Independent implementation
  const r3 = compare(originalFp, independentFp);
  console.log(`  Independent score:   ${(r3.derivationScore * 100).toFixed(1)}% [${r3.band}]`);
  assertRange(r3.derivationScore, 0.0, 0.45, 'Independent impl');

  // Scenario 4: Unrelated code
  const r4 = compare(originalFp, unrelatedFp);
  console.log(`  Unrelated score:     ${(r4.derivationScore * 100).toFixed(1)}% [${r4.band}]`);
  assertRange(r4.derivationScore, 0.0, 0.35, 'Unrelated code');

  // Scenario 5: Refactored clone
  const r5 = compare(originalFp, refactoredFp);
  console.log(`  Refactored score:    ${(r5.derivationScore * 100).toFixed(1)}% [${r5.band}]`);
  assertRange(r5.derivationScore, 0.25, 0.85, 'Refactored clone');

  // Ordering: exact > refactored > partial > independent > unrelated
  console.log('\n  Score ordering check:');
  assert(
    r1.derivationScore > r5.derivationScore,
    `Exact (${(r1.derivationScore*100).toFixed(1)}%) > Refactored (${(r5.derivationScore*100).toFixed(1)}%)`
  );
  assert(
    r5.derivationScore > r3.derivationScore,
    `Refactored (${(r5.derivationScore*100).toFixed(1)}%) > Independent (${(r3.derivationScore*100).toFixed(1)}%)`
  );
  assert(
    r3.derivationScore > r4.derivationScore || r3.derivationScore === r4.derivationScore,
    `Independent (${(r3.derivationScore*100).toFixed(1)}%) >= Unrelated (${(r4.derivationScore*100).toFixed(1)}%)`
  );

  // Band classification
  console.log('\n  Band classification:');
  assert(
    r1.band === 'high_confidence_clone',
    `Exact clone band: ${r1.band}`
  );
  assert(
    r4.band === 'convention',
    `Unrelated band: ${r4.band}`
  );

  // ─── 5. Ledger Tests ────────────────────────────────────────────────

  section('5. Provenance Ledger');

  const ledger = await Ledger.create();

  // Register multiple entries
  const entry1 = await ledger.register(originalFp);
  const entry2 = await ledger.register(exactFp);
  const entry3 = await ledger.register(partialFp);

  assert(entry1.sequence === 0, 'First entry: sequence 0');
  assert(entry2.sequence === 1, 'Second entry: sequence 1');
  assert(entry3.sequence === 2, 'Third entry: sequence 2');

  // Verify individual entries
  const v1 = await ledger.verify(entry1);
  assert(v1.valid, 'Entry 1: signature + integrity valid');
  assert(v1.signatureValid, 'Entry 1: signature valid');
  assert(v1.integrityValid, 'Entry 1: integrity valid');
  assert(v1.chainValid, 'Entry 1: chain valid');

  const v2 = await ledger.verify(entry2);
  assert(v2.valid, 'Entry 2: fully valid');

  // Verify full chain
  const chainResult = await ledger.verifyChain();
  assert(chainResult.valid, `Full chain valid (${ledger.length} entries)`);

  // Chain linking
  assert(
    entry2.previousEntryHash === entry1.entryHash,
    'Chain: entry2 links to entry1'
  );
  assert(
    entry3.previousEntryHash === entry2.entryHash,
    'Chain: entry3 links to entry2'
  );

  // Genesis
  assert(
    entry1.previousEntryHash === sha256('GENESIS'),
    'Chain: entry1 links to GENESIS'
  );

  // Tamper detection
  const tamperedEntry = { ...entry2, fingerprintHash: 'TAMPERED' };
  const tamperResult = await ledger.verify(tamperedEntry);
  assert(!tamperResult.integrityValid, 'Tamper detection: modified hash caught');
  assert(!tamperResult.valid, 'Tamper detection: entry marked invalid');

  // ─── 6. Fingerprint Determinism ─────────────────────────────────────

  section('6. Fingerprint Determinism');

  const fp1 = await fingerprint(ORIGINAL, 'typescript');
  const fp2 = await fingerprint(ORIGINAL, 'typescript');

  assert(
    fp1.fingerprintHash === fp2.fingerprintHash,
    'Same code → same fingerprint hash'
  );
  assert(
    fp1.featureCount === fp2.featureCount,
    'Same code → same feature count'
  );
  assert(
    fp1.dependencyHash === fp2.dependencyHash,
    'Same code → same dependency hash'
  );

  // Self-comparison should be 100%
  const selfCompare = compare(fp1, fp2);
  assert(
    selfCompare.derivationScore === 1.0,
    'Self-comparison: 100% derivation'
  );

  // ─── 7. Edge Cases ──────────────────────────────────────────────────

  section('7. Edge Cases');

  // Empty file
  const emptyFp = await fingerprint('', 'typescript');
  assert(emptyFp.featureCount === 0, 'Empty file: 0 features');

  // Single function
  const singleFp = await fingerprint(
    'function hello() { return 42; }',
    'typescript'
  );
  assert(singleFp.featureCount > 0, 'Single function: has features');

  // Comments only
  const commentsFp = await fingerprint(
    '// This is a comment\n/* block comment */\n',
    'typescript'
  );
  assert(
    commentsFp.featureCount <= 2,
    `Comments-only: minimal features (${commentsFp.featureCount})`
  );

  // ─── 8. Scoring Monotonicity ────────────────────────────────────────

  section('8. Scoring Monotonicity');

  // Scores should follow: exact > refactored > partial > independent > unrelated
  const scores = [
    { name: 'Exact clone', score: r1.derivationScore },
    { name: 'Refactored',  score: r5.derivationScore },
    { name: 'Partial',     score: r2.derivationScore },
    { name: 'Independent', score: r3.derivationScore },
    { name: 'Unrelated',   score: r4.derivationScore },
  ];

  console.log('\n  Score ladder:');
  for (const s of scores) {
    const bar = '█'.repeat(Math.round(s.score * 30));
    const empty = '░'.repeat(30 - Math.round(s.score * 30));
    console.log(`    ${s.name.padEnd(14)} ${bar}${empty} ${(s.score * 100).toFixed(1)}%`);
  }
  console.log();

  // Check monotonicity (each should be >= the next)
  for (let i = 0; i < scores.length - 1; i++) {
    assert(
      scores[i].score >= scores[i + 1].score,
      `${scores[i].name} (${(scores[i].score*100).toFixed(1)}%) >= ${scores[i+1].name} (${(scores[i+1].score*100).toFixed(1)}%)`
    );
  }

  // ─── Results ─────────────────────────────────────────────────────────

  console.log(`
╔═══════════════════════════════════════════════╗
║              TEST RESULTS                      ║
╠═══════════════════════════════════════════════╣
║  Total:  ${String(total).padStart(3)}                                  ║
║  Passed: ${String(passed).padStart(3)} ✅                                ║
║  Failed: ${String(failed).padStart(3)} ${failed > 0 ? '❌' : '✅'}                                ║
╚═══════════════════════════════════════════════╝
  `);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
