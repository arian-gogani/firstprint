/**
 * @firstprint/compare
 * 
 * Structural comparison and clone scoring engine.
 * Takes two fingerprints, outputs a derivation score with evidence.
 */

export { compare } from './compare.js';
export type { RarityMap } from './compare.js';
export { compareFunctions } from './function-compare.js';
export type { FunctionMatchResult, FunctionComparisonResult } from './function-compare.js';
export { compareProjects } from './project-compare.js';
export type { FileMatchResult, ProjectComparisonResult } from './project-compare.js';
export { structuralDiff } from './structural-diff.js';
export type { StructuralChange, StructuralDiffResult } from './structural-diff.js';
export {
  DerivationBand,
  DEFAULT_WEIGHTS,
} from './types.js';
export type {
  ComparisonResult,
  ComparisonWeights,
  LayerScore,
  MatchEvidence,
} from './types.js';
