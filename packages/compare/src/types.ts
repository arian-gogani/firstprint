/**
 * @firstprint/compare — Comparison Types
 * 
 * Types for structural comparison results,
 * derivation scores, and evidence reports.
 */

/** Derivation band classification */
export enum DerivationBand {
  /** Normal industry patterns — similarity explained by convention */
  CONVENTION = 'convention',
  /** Some distinctive overlap, not enough to imply derivation */
  INFLUENCE = 'influence',
  /** Rare combinations align across multiple layers */
  SUSPICIOUS = 'suspicious',
  /** Strong overlap in rare structure + temporal precedence */
  HIGH_CONFIDENCE_CLONE = 'high_confidence_clone',
}

/** Score for a single comparison layer */
export interface LayerScore {
  /** Name of the layer */
  layer: 'ast' | 'control_flow' | 'dependency' | 'logic';
  /** Raw similarity score (0-1) */
  rawSimilarity: number;
  /** Rarity-weighted similarity score (0-1) */
  weightedSimilarity: number;
  /** Number of matching features */
  matchCount: number;
  /** Number of rare matches (above rarity threshold) */
  rareMatchCount: number;
}

/** A single piece of evidence in the comparison */
export interface MatchEvidence {
  /** The matched feature canonical string */
  feature: string;
  /** Which layer this match belongs to */
  layer: string;
  /** How rare this pattern is (higher = rarer) */
  rarityScore: number;
  /** Human-readable description of the match */
  description: string;
}

/** Complete comparison result between two fingerprints */
export interface ComparisonResult {
  /** Unique ID for this comparison */
  id: string;
  /** Timestamp of the comparison */
  timestamp: number;

  /** Fingerprint IDs being compared */
  sourceId: string;
  targetId: string;

  /** Per-layer scores */
  layerScores: LayerScore[];

  /** Overall derivation likelihood (0-1) */
  derivationScore: number;
  /** Derivation band classification */
  band: DerivationBand;
  /** Confidence in the classification (0-1) */
  confidence: number;

  /** Evidence of the most significant matches */
  evidence: MatchEvidence[];

  /** Summary explanation */
  summary: string;
}

/** Configuration for comparison weights */
export interface ComparisonWeights {
  ast: number;
  controlFlow: number;
  dependency: number;
  logic: number;
  rarityOverlap: number;
}

/** Default comparison weights */
export const DEFAULT_WEIGHTS: ComparisonWeights = {
  ast: 0.25,
  controlFlow: 0.25,
  dependency: 0.15,
  logic: 0.15,
  rarityOverlap: 0.20,
};
