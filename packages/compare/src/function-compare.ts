/**
 * @firstprint/compare — Function-Level Comparison
 * 
 * Compares two files at the function level, identifying
 * which specific functions were likely copied.
 * 
 * "3 of your 8 functions appear in the suspect's codebase,
 *  with derivation scores of 95%, 87%, and 72%."
 */

import { estimateJaccard, simHashSimilarity } from '../../core/src/hash.js';
import type { FunctionFingerprint, FileFunctionFingerprints } from '../../core/src/function-fingerprint.js';
import { compare } from './compare.js';
import type { ComparisonResult } from './types.js';

/** Result of comparing a single function pair */
export interface FunctionMatchResult {
  /** Source function info */
  sourceFunction: string;
  /** Target function info */
  targetFunction: string;
  /** Comparison result */
  comparison: ComparisonResult;
  /** Whether this is considered a match */
  isMatch: boolean;
}

/** Result of comparing all functions between two files */
export interface FunctionComparisonResult {
  /** Total functions in source */
  sourceFunctionCount: number;
  /** Total functions in target */
  targetFunctionCount: number;
  /** Number of matched functions */
  matchedCount: number;
  /** Match ratio (matched / source total) */
  matchRatio: number;
  /** Individual function matches */
  matches: FunctionMatchResult[];
  /** Summary */
  summary: string;
}

const MATCH_THRESHOLD = 0.5;

/**
 * Compare two files at the function level.
 * Finds the best match for each source function in the target.
 */
export function compareFunctions(
  source: FileFunctionFingerprints,
  target: FileFunctionFingerprints
): FunctionComparisonResult {
  const matches: FunctionMatchResult[] = [];

  for (const srcFunc of source.functions) {
    let bestMatch: FunctionMatchResult | null = null;
    let bestScore = 0;

    for (const tgtFunc of target.functions) {
      const result = compare(srcFunc.fingerprint, tgtFunc.fingerprint);
      
      if (result.derivationScore > bestScore) {
        bestScore = result.derivationScore;
        bestMatch = {
          sourceFunction: srcFunc.info.name,
          targetFunction: tgtFunc.info.name,
          comparison: result,
          isMatch: result.derivationScore >= MATCH_THRESHOLD,
        };
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
    }
  }

  const matchedCount = matches.filter(m => m.isMatch).length;
  const matchRatio = source.functions.length > 0
    ? matchedCount / source.functions.length
    : 0;

  // Sort by score descending
  matches.sort((a, b) => 
    b.comparison.derivationScore - a.comparison.derivationScore
  );

  const summary = matchedCount === 0
    ? `No function-level matches found between the two files.`
    : `${matchedCount} of ${source.functions.length} functions in the source have structural matches in the target (${(matchRatio * 100).toFixed(0)}% match ratio).`;

  return {
    sourceFunctionCount: source.functions.length,
    targetFunctionCount: target.functions.length,
    matchedCount,
    matchRatio,
    matches,
    summary,
  };
}
