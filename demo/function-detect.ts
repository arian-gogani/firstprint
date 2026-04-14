/**
 * Firstprint Demo — Function-Level Clone Detection
 * 
 * Shows granular detection: which specific functions were copied.
 * 
 * Run: npx tsx demo/function-detect.ts
 */

import { fingerprintFunctions } from '../packages/core/src/function-fingerprint.js';
import { compareFunctions } from '../packages/compare/src/function-compare.js';
import { ORIGINAL, PARTIAL_CLONE } from '../tests/fixtures/samples.js';

async function main() {
  console.log(`
╔═══════════════════════════════════════════════╗
║      FUNCTION-LEVEL CLONE DETECTION           ║
╚═══════════════════════════════════════════════╝
`);

  console.log('Fingerprinting functions in original...');
  const srcResult = await fingerprintFunctions(ORIGINAL, 'typescript');
  console.log(`  Found ${srcResult.functionCount} functions\n`);
  for (const fn of srcResult.functions) {
    console.log(`    ${fn.info.isAsync ? 'async ' : ''}${fn.info.name}(${fn.info.paramCount} params) — ${fn.fingerprint.featureCount} features`);
  }

  console.log('\nFingerprinting functions in partial clone...');
  const tgtResult = await fingerprintFunctions(PARTIAL_CLONE, 'typescript');
  console.log(`  Found ${tgtResult.functionCount} functions\n`);
  for (const fn of tgtResult.functions) {
    console.log(`    ${fn.info.isAsync ? 'async ' : ''}${fn.info.name}(${fn.info.paramCount} params) — ${fn.fingerprint.featureCount} features`);
  }

  console.log('\n━━━ Function-Level Comparison ━━━\n');
  const result = compareFunctions(srcResult, tgtResult);
  
  console.log(`  ${result.summary}\n`);

  for (const match of result.matches) {
    const score = (match.comparison.derivationScore * 100).toFixed(1);
    const icon = match.isMatch ? '🔴' : '🟢';
    const bar = '█'.repeat(Math.round(match.comparison.derivationScore * 20));
    const empty = '░'.repeat(20 - Math.round(match.comparison.derivationScore * 20));
    console.log(`  ${icon} ${match.sourceFunction.padEnd(25)} → ${match.targetFunction.padEnd(25)} ${bar}${empty} ${score}%`);
  }
  console.log();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
