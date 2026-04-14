/**
 * @firstprint/core — Hashing utilities
 * 
 * MinHash: Locality-sensitive hashing for Jaccard similarity estimation.
 * SimHash: Locality-sensitive hashing for cosine/hamming similarity.
 * 
 * These are the engines that make structural comparison possible.
 */

import { createHash } from 'crypto';

// ─── MinHash ────────────────────────────────────────────────────────────────

const MINHASH_NUM_HASHES = 128;
const MINHASH_PRIME = 2147483647; // Mersenne prime 2^31 - 1
const MAX_HASH = 2 ** 32 - 1;

/** Pre-generated hash function coefficients for MinHash */
interface MinHashCoefficients {
  a: number[];
  b: number[];
}

let _coefficients: MinHashCoefficients | null = null;

function getCoefficients(): MinHashCoefficients {
  if (_coefficients) return _coefficients;
  const a: number[] = [];
  const b: number[] = [];
  // Deterministic seed so fingerprints are reproducible
  const seed = createHash('sha256').update('firstprint-minhash-v1').digest();
  for (let i = 0; i < MINHASH_NUM_HASHES; i++) {
    const offset = (i * 8) % seed.length;
    a.push((seed.readUInt32BE(offset % (seed.length - 4)) % (MINHASH_PRIME - 1)) + 1);
    b.push(seed.readUInt32BE((offset + 4) % (seed.length - 4)) % MINHASH_PRIME);
  }
  _coefficients = { a, b };
  return _coefficients;
}

/** Convert a string to a 32-bit hash value */
function stringToHash32(s: string): number {
  const hash = createHash('md5').update(s).digest();
  return hash.readUInt32BE(0);
}

/**
 * Compute a MinHash signature for a set of features.
 * Returns a 128-dimensional signature where each dimension is
 * the minimum hash value across all features for that hash function.
 * 
 * Two signatures can be compared by counting matching slots:
 * estimatedJaccard = matchingSlots / totalSlots
 */
export function computeMinHash(features: string[]): number[] {
  const { a, b } = getCoefficients();
  const signature = new Array<number>(MINHASH_NUM_HASHES).fill(MAX_HASH);

  if (features.length === 0) return signature;

  for (const feature of features) {
    const hashVal = stringToHash32(feature);
    for (let i = 0; i < MINHASH_NUM_HASHES; i++) {
      const permuted = ((a[i] * hashVal + b[i]) % MINHASH_PRIME) >>> 0;
      if (permuted < signature[i]) {
        signature[i] = permuted;
      }
    }
  }

  return signature;
}

/**
 * Estimate Jaccard similarity from two MinHash signatures.
 * Returns a value between 0 and 1.
 */
export function estimateJaccard(sigA: number[], sigB: number[]): number {
  if (sigA.length !== sigB.length) {
    throw new Error('MinHash signatures must have the same length');
  }
  let matches = 0;
  for (let i = 0; i < sigA.length; i++) {
    if (sigA[i] === sigB[i]) matches++;
  }
  return matches / sigA.length;
}

// ─── SimHash ────────────────────────────────────────────────────────────────

/**
 * Compute a 64-bit SimHash for a set of weighted features.
 * SimHash preserves similarity: similar inputs produce similar hashes.
 * Compare via Hamming distance (XOR + popcount).
 * 
 * Uses bigint for full 64-bit precision.
 */
export function computeSimHash(features: string[], weights?: number[]): bigint {
  const dimensions = 64;
  const vector = new Array<number>(dimensions).fill(0);

  for (let i = 0; i < features.length; i++) {
    const weight = weights ? weights[i] : 1;
    const hash = createHash('sha256').update(features[i]).digest();

    for (let bit = 0; bit < dimensions; bit++) {
      const byteIndex = Math.floor(bit / 8);
      const bitIndex = bit % 8;
      const bitValue = (hash[byteIndex] >> bitIndex) & 1;
      vector[bit] += bitValue ? weight : -weight;
    }
  }

  let simhash = 0n;
  for (let bit = 0; bit < dimensions; bit++) {
    if (vector[bit] > 0) {
      simhash |= 1n << BigInt(bit);
    }
  }

  return simhash;
}

/**
 * Compute Hamming distance between two SimHash values.
 * Lower distance = more similar.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * Convert Hamming distance to a similarity score (0-1).
 * 64-bit SimHash: 0 distance = 1.0 similarity, 32 distance = 0.5, 64 = 0.0
 */
export function simHashSimilarity(a: bigint, b: bigint): number {
  return 1 - hammingDistance(a, b) / 64;
}

// ─── General Hashing ────────────────────────────────────────────────────────

/**
 * SHA-256 hash of a string. Used for fingerprint integrity and ledger entries.
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute Merkle root from an array of hashes.
 * Used in the provenance ledger.
 */
export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return sha256('');
  if (hashes.length === 1) return hashes[0];

  const nextLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = i + 1 < hashes.length ? hashes[i + 1] : left;
    nextLevel.push(sha256(left + right));
  }

  return merkleRoot(nextLevel);
}
