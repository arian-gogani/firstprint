/**
 * @firstprint/core
 * 
 * The birth certificate for everything AI creates.
 * 
 * Structural fingerprinting engine that converts code
 * into canonical structural representations for
 * provenance tracking and derivative detection.
 */

// Core fingerprinting
export { fingerprint, fingerprintFile, serializeFingerprint } from './fingerprint.js';

// Function-level fingerprinting
export { fingerprintFunctions } from './function-fingerprint.js';
export type { FunctionInfo, FunctionFingerprint, FileFunctionFingerprints } from './function-fingerprint.js';

// Project-level fingerprinting
export { fingerprintProject } from './project-fingerprint.js';
export type { ProjectFingerprint, FileFingerprint, ProjectOptions } from './project-fingerprint.js';

// Parser
export { parseCode, detectLanguage } from './parser.js';
export type { ParsedNode } from './parser.js';

// Normalizer
export { normalizeAST, serializeAST } from './normalizer.js';

// Feature extraction
export {
  extractAllFeatures,
  extractASTSubtrees,
  extractControlFlow,
  extractDependencies,
  extractLogicPatterns,
} from './extractor.js';

// Hashing utilities
export {
  computeMinHash,
  estimateJaccard,
  computeSimHash,
  hammingDistance,
  simHashSimilarity,
  sha256,
  merkleRoot,
} from './hash.js';

// Types
export type {
  Language,
  StructuralFeature,
  StructuralFingerprint,
} from './types.js';
