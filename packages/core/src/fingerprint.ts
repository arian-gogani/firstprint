/**
 * @firstprint/core — Fingerprint Generator
 * 
 * The main orchestrator. Takes source code and produces
 * a complete structural fingerprint:
 * 
 *   parse → normalize → extract features → hash → fingerprint
 * 
 * This is the atomic operation of Firstprint.
 */

import { randomUUID } from 'crypto';
import { parseCode } from './parser.js';
import { normalizeAST } from './normalizer.js';
import { extractAllFeatures } from './extractor.js';
import { computeMinHash, computeSimHash, sha256, merkleRoot } from './hash.js';
import type { Language, StructuralFingerprint } from './types.js';

const FINGERPRINT_VERSION = '0.1.0';

/**
 * Generate a structural fingerprint from source code.
 * 
 * This is the core function of Firstprint.
 * Everything else in the system is built on top of this.
 */
export async function fingerprint(
  source: string,
  language: Language
): Promise<StructuralFingerprint> {
  // Step 1: Parse source code into AST
  const ast = await parseCode(source, language);

  // Step 2: Normalize — strip variable names, literals, comments
  const normalized = normalizeAST(ast);

  // Step 3: Extract structural features (skip empty/trivial ASTs)
  const features = (normalized.children.length === 0)
    ? []
    : extractAllFeatures(normalized);

  // Step 4: Compute layer-specific hashes

  // AST features → MinHash (128-dimensional Jaccard estimator)
  const astFeatures = features
    .filter(f => f.type === 'ast_subtree')
    .map(f => f.canonical);
  const astMinHash = computeMinHash(astFeatures);

  // Control flow features → SimHash (64-bit similarity-preserving hash)
  const cfgFeatures = features
    .filter(f => f.type === 'control_flow')
    .map(f => f.canonical);
  const controlFlowSimHash = computeSimHash(cfgFeatures);

  // Dependency features → deterministic hash of sorted graph
  const depFeatures = features
    .filter(f => f.type === 'dependency')
    .map(f => f.canonical)
    .sort();
  const dependencyHash = sha256(depFeatures.join('|'));

  // Step 5: Compute integrity hash of the entire fingerprint
  const layerHashes = [
    sha256(JSON.stringify(astMinHash)),
    sha256(controlFlowSimHash.toString()),
    dependencyHash,
  ];
  const root = merkleRoot(layerHashes);

  const fp: StructuralFingerprint = {
    id: randomUUID(),
    version: FINGERPRINT_VERSION,
    language,
    createdAt: Date.now(),
    astMinHash,
    controlFlowSimHash,
    dependencyHash,
    features,
    featureCount: features.length,
    fingerprintHash: root,
  };

  return fp;
}

/**
 * Generate a fingerprint from a file path.
 * Auto-detects language from extension.
 */
export async function fingerprintFile(
  source: string,
  filename: string
): Promise<StructuralFingerprint> {
  const { detectLanguage } = await import('./parser.js');
  const language = detectLanguage(filename);
  if (!language) {
    throw new Error(`Unsupported file type: ${filename}`);
  }
  return fingerprint(source, language);
}

/**
 * Serialize a fingerprint to a canonical JSON string.
 * Used for hashing, signing, and storage.
 * 
 * BigInt values are converted to strings for JSON compatibility.
 */
export function serializeFingerprint(fp: StructuralFingerprint): string {
  return JSON.stringify(fp, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}
