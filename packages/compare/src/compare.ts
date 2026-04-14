/**
 * @firstprint/compare — Comparison Engine
 * 
 * Takes two structural fingerprints and produces a
 * derivation score with evidence.
 * 
 * The scoring uses rarity-weighted overlap:
 * common patterns get low weight, rare patterns get high weight.
 * What matters is not "do these look similar" but
 * "do these share an improbable combination of rare decisions."
 */

import { randomUUID } from 'crypto';
import {
  estimateJaccard,
  simHashSimilarity,
  sha256,
} from '../../core/src/hash.js';
import type { StructuralFingerprint, StructuralFeature } from '../../core/src/types.js';
import type {
  ComparisonResult,
  ComparisonWeights,
  LayerScore,
  MatchEvidence,
} from './types.js';
import { DerivationBand, DEFAULT_WEIGHTS } from './types.js';

/** Rarity data — maps feature hashes to frequency scores */
export type RarityMap = Map<string, number>;

/**
 * Compare two structural fingerprints and produce a
 * derivation score with evidence.
 */
export function compare(
  source: StructuralFingerprint,
  target: StructuralFingerprint,
  rarityMap?: RarityMap,
  weights: ComparisonWeights = DEFAULT_WEIGHTS,
): ComparisonResult {
  // Layer 1: AST similarity via MinHash Jaccard estimate
  const astSimilarity = estimateJaccard(
    source.astMinHash,
    target.astMinHash
  );

  // Layer 2: Control flow similarity via SimHash
  const cfgSimilarity = simHashSimilarity(
    source.controlFlowSimHash,
    target.controlFlowSimHash
  );

  // Layer 3: Dependency similarity via hash comparison
  const depSimilarity = source.dependencyHash === target.dependencyHash
    ? 1.0
    : computeSetOverlap(
        source.features.filter(f => f.type === 'dependency'),
        target.features.filter(f => f.type === 'dependency')
      );

  // Layer 4: Logic pattern similarity
  const logicSimilarity = computeSetOverlap(
    source.features.filter(f => f.type === 'logic_pattern'),
    target.features.filter(f => f.type === 'logic_pattern')
  );

  // Layer 5: Rarity-weighted overlap — the most important score
  const { rarityScore, evidence } = computeRarityOverlap(
    source.features,
    target.features,
    rarityMap
  );

  // Compute per-layer scores
  const layerScores: LayerScore[] = [
    {
      layer: 'ast',
      rawSimilarity: astSimilarity,
      weightedSimilarity: astSimilarity * weights.ast,
      matchCount: Math.round(astSimilarity * source.astMinHash.length),
      rareMatchCount: 0,
    },
    {
      layer: 'control_flow',
      rawSimilarity: cfgSimilarity,
      weightedSimilarity: cfgSimilarity * weights.controlFlow,
      matchCount: 0,
      rareMatchCount: 0,
    },
    {
      layer: 'dependency',
      rawSimilarity: depSimilarity,
      weightedSimilarity: depSimilarity * weights.dependency,
      matchCount: 0,
      rareMatchCount: 0,
    },
    {
      layer: 'logic',
      rawSimilarity: logicSimilarity,
      weightedSimilarity: logicSimilarity * weights.logic,
      matchCount: 0,
      rareMatchCount: 0,
    },
  ];

  // Compute overall derivation score
  const derivationScore = Math.min(1.0,
    astSimilarity * weights.ast +
    cfgSimilarity * weights.controlFlow +
    depSimilarity * weights.dependency +
    logicSimilarity * weights.logic +
    rarityScore * weights.rarityOverlap
  );

  // Classify into derivation band
  const band = classifyBand(derivationScore);

  // Compute confidence based on feature count and score spread
  const confidence = computeConfidence(
    derivationScore,
    source.featureCount,
    target.featureCount,
    layerScores
  );

  // Generate summary
  const summary = generateSummary(derivationScore, band, evidence);

  return {
    id: randomUUID(),
    timestamp: Date.now(),
    sourceId: source.id,
    targetId: target.id,
    layerScores,
    derivationScore,
    band,
    confidence,
    evidence,
    summary,
  };
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/** Compute Jaccard-like set overlap between two feature sets */
function computeSetOverlap(
  setA: StructuralFeature[],
  setB: StructuralFeature[]
): number {
  if (setA.length === 0 && setB.length === 0) return 0;
  if (setA.length === 0 || setB.length === 0) return 0;

  const hashesA = new Set(setA.map(f => f.hash));
  const hashesB = new Set(setB.map(f => f.hash));

  let intersection = 0;
  for (const h of hashesA) {
    if (hashesB.has(h)) intersection++;
  }

  const union = new Set([...hashesA, ...hashesB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Compute rarity-weighted overlap.
 * This is the HEART of Firstprint's scoring.
 * 
 * Common patterns (found in >50% of codebases) get near-zero weight.
 * Rare patterns (found in <1% of codebases) get high weight.
 * 
 * The insight: two products sharing "login page + dashboard" means nothing.
 * Two products sharing "9-step onboarding with branch at step 6 and
 * deferred verification" is statistically improbable without derivation.
 */
function computeRarityOverlap(
  featuresA: StructuralFeature[],
  featuresB: StructuralFeature[],
  rarityMap?: RarityMap
): { rarityScore: number; evidence: MatchEvidence[] } {
  const evidence: MatchEvidence[] = [];

  const hashesA = new Set(featuresA.map(f => f.hash));
  const hashMapB = new Map(featuresB.map(f => [f.hash, f]));

  let totalRarityWeight = 0;
  let matchedRarityWeight = 0;

  for (const featureA of featuresA) {
    // Get rarity score: default to 0.5 (medium rarity) if no corpus
    const rarity = rarityMap?.get(featureA.hash) ?? 0.5;
    // IDF-style weighting: rare = high weight, common = low weight
    const weight = rarity;

    totalRarityWeight += weight;

    if (hashMapB.has(featureA.hash)) {
      matchedRarityWeight += weight;

      // Only record evidence for rare matches
      if (rarity > 0.7) {
        evidence.push({
          feature: featureA.canonical,
          layer: featureA.type,
          rarityScore: rarity,
          description: describeMatch(featureA, rarity),
        });
      }
    }
  }

  // Sort evidence by rarity (most rare first)
  evidence.sort((a, b) => b.rarityScore - a.rarityScore);

  // Keep top 20 most significant matches
  const topEvidence = evidence.slice(0, 20);

  const rarityScore = totalRarityWeight > 0
    ? matchedRarityWeight / totalRarityWeight
    : 0;

  return { rarityScore, evidence: topEvidence };
}

/** Generate a human-readable description of a match */
function describeMatch(
  feature: StructuralFeature,
  rarity: number
): string {
  const rarityLabel = rarity > 0.9 ? 'extremely rare'
    : rarity > 0.8 ? 'very rare'
    : rarity > 0.7 ? 'rare'
    : 'uncommon';

  return `${rarityLabel} ${feature.type} pattern: ${feature.canonical}`;
}

/** Classify derivation score into bands */
function classifyBand(score: number): DerivationBand {
  if (score >= 0.7) return DerivationBand.HIGH_CONFIDENCE_CLONE;
  if (score >= 0.5) return DerivationBand.SUSPICIOUS;
  if (score >= 0.3) return DerivationBand.INFLUENCE;
  return DerivationBand.CONVENTION;
}

/** Compute confidence based on data quality */
function computeConfidence(
  score: number,
  sourceFeatureCount: number,
  targetFeatureCount: number,
  layerScores: LayerScore[]
): number {
  // More features = more confidence
  const featureConfidence = Math.min(1.0,
    Math.min(sourceFeatureCount, targetFeatureCount) / 100
  );

  // Agreement across layers = more confidence
  const rawScores = layerScores.map(l => l.rawSimilarity);
  const mean = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
  const variance = rawScores.reduce((a, b) => a + (b - mean) ** 2, 0)
    / rawScores.length;
  // Low variance = layers agree = high confidence
  const agreementConfidence = 1 - Math.min(1.0, variance * 4);

  return (featureConfidence * 0.4 + agreementConfidence * 0.6);
}

/** Generate a human-readable summary */
function generateSummary(
  score: number,
  band: DerivationBand,
  evidence: MatchEvidence[]
): string {
  const pct = (score * 100).toFixed(1);

  switch (band) {
    case DerivationBand.CONVENTION:
      return `Derivation score: ${pct}%. Structural overlap is within normal industry convention. No significant evidence of derivation.`;
    case DerivationBand.INFLUENCE:
      return `Derivation score: ${pct}%. Some distinctive structural overlap detected, but insufficient to suggest direct derivation. May indicate shared inspiration or common design patterns.`;
    case DerivationBand.SUSPICIOUS:
      return `Derivation score: ${pct}%. Suspicious structural overlap detected across ${evidence.length} rare patterns. The combination of matching patterns is unlikely to occur by independent creation alone.`;
    case DerivationBand.HIGH_CONFIDENCE_CLONE:
      return `Derivation score: ${pct}%. High-confidence structural clone detected. ${evidence.length} rare patterns match across multiple layers. Independent creation is statistically implausible.`;
  }
}
