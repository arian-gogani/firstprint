/**
 * @firstprint/compare — Project-Level Comparison
 * 
 * Compares two entire projects, producing:
 * - Aggregate structural similarity
 * - File-by-file match map
 * - Function-by-function match details
 * - Evidence report
 */

import { compare } from './compare.js';
import { compareFunctions } from './function-compare.js';
import type { ComparisonResult } from './types.js';
import type {
  ProjectFingerprint,
  FileFingerprint,
} from '../../core/src/project-fingerprint.js';
import type { FunctionComparisonResult } from './function-compare.js';

/** Match between two files across projects */
export interface FileMatchResult {
  sourceFile: string;
  targetFile: string;
  comparison: ComparisonResult;
  functionComparison?: FunctionComparisonResult;
  isMatch: boolean;
}

/** Complete project comparison result */
export interface ProjectComparisonResult {
  /** Aggregate project-level score */
  aggregate: ComparisonResult;
  /** File-by-file matches */
  fileMatches: FileMatchResult[];
  /** Number of matched files */
  matchedFileCount: number;
  /** Match ratio */
  fileMatchRatio: number;
  /** Total functions matched */
  totalFunctionMatches: number;
  /** Summary */
  summary: string;
}

const FILE_MATCH_THRESHOLD = 0.4;

/**
 * Compare two projects structurally.
 */
export function compareProjects(
  source: ProjectFingerprint,
  target: ProjectFingerprint
): ProjectComparisonResult {
  // Aggregate comparison
  const aggregate = compare(source.aggregate, target.aggregate);

  // File-by-file matching
  const fileMatches: FileMatchResult[] = [];
  let totalFuncMatches = 0;

  for (const srcFile of source.files) {
    let bestMatch: FileMatchResult | null = null;
    let bestScore = 0;

    for (const tgtFile of target.files) {
      const result = compare(srcFile.fingerprint, tgtFile.fingerprint);
      if (result.derivationScore > bestScore) {
        bestScore = result.derivationScore;

        let funcComp: FunctionComparisonResult | undefined;
        if (result.derivationScore >= FILE_MATCH_THRESHOLD &&
            srcFile.functions.length > 0 &&
            tgtFile.functions.length > 0) {
          funcComp = compareFunctions(
            {
              fileFingerprint: srcFile.fingerprint,
              functions: srcFile.functions,
              functionCount: srcFile.functions.length,
            },
            {
              fileFingerprint: tgtFile.fingerprint,
              functions: tgtFile.functions,
              functionCount: tgtFile.functions.length,
            }
          );
        }

        bestMatch = {
          sourceFile: srcFile.relativePath,
          targetFile: tgtFile.relativePath,
          comparison: result,
          functionComparison: funcComp,
          isMatch: result.derivationScore >= FILE_MATCH_THRESHOLD,
        };
      }
    }

    if (bestMatch) {
      fileMatches.push(bestMatch);
      if (bestMatch.functionComparison) {
        totalFuncMatches += bestMatch.functionComparison.matchedCount;
      }
    }
  }

  fileMatches.sort((a, b) =>
    b.comparison.derivationScore - a.comparison.derivationScore
  );

  const matchedFileCount = fileMatches.filter(m => m.isMatch).length;
  const fileMatchRatio = source.files.length > 0
    ? matchedFileCount / source.files.length : 0;

  const summary = matchedFileCount === 0
    ? `No significant structural overlap found between ${source.name} and ${target.name}.`
    : `${matchedFileCount} of ${source.files.length} files in ${source.name} have structural matches in ${target.name} (${(fileMatchRatio * 100).toFixed(0)}% file match ratio). ${totalFuncMatches} function-level matches found.`;

  return {
    aggregate,
    fileMatches,
    matchedFileCount,
    fileMatchRatio,
    totalFunctionMatches: totalFuncMatches,
    summary,
  };
}
