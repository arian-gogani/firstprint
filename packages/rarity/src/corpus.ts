/**
 * @firstprint/rarity — Rarity Corpus
 * 
 * Builds and queries frequency tables for structural patterns.
 * 
 * The rarity corpus is what makes Firstprint's scoring meaningful.
 * Without it, similarity is noise. With it, you can distinguish:
 * - common patterns (login page + dashboard = everyone has this)
 * - rare patterns (9-step onboarding with branch at step 6 = suspicious)
 * 
 * Rarity score: IDF-style inverse document frequency.
 * High score = rare pattern = significant if matched.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { StructuralFeature } from '@firstprint/core';

/** The rarity corpus — maps pattern hashes to frequency data */
export interface RarityCorpus {
  /** Total number of projects analyzed */
  totalProjects: number;
  /** Total number of files analyzed */
  totalFiles: number;
  /** Pattern hash → number of projects containing it */
  patternFrequency: Map<string, number>;
  /** Version of the corpus format */
  version: string;
  /** When the corpus was last updated */
  lastUpdated: string;
}

const CORPUS_VERSION = '0.1.0';

/** Create an empty corpus */
export function createCorpus(): RarityCorpus {
  return {
    totalProjects: 0,
    totalFiles: 0,
    patternFrequency: new Map(),
    version: CORPUS_VERSION,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Add features from a single project to the corpus.
 * Each unique pattern hash is counted once per project
 * (not once per occurrence within the project).
 */
export function addProjectToCorpus(
  corpus: RarityCorpus,
  features: StructuralFeature[],
  fileCount: number = 1
): void {
  corpus.totalProjects++;
  corpus.totalFiles += fileCount;

  // Deduplicate within project
  const uniqueHashes = new Set(features.map(f => f.hash));

  for (const hash of uniqueHashes) {
    const current = corpus.patternFrequency.get(hash) || 0;
    corpus.patternFrequency.set(hash, current + 1);
  }

  corpus.lastUpdated = new Date().toISOString();
}

/**
 * Get the rarity score for a pattern hash.
 * Returns a value between 0 (extremely common) and 1 (extremely rare).
 * 
 * Uses IDF: log(totalProjects / projectsContaining)
 * Normalized to 0-1 range.
 */
export function getRarityScore(
  corpus: RarityCorpus,
  hash: string
): number {
  const frequency = corpus.patternFrequency.get(hash);
  if (!frequency || corpus.totalProjects === 0) {
    // Unknown pattern = assume moderately rare
    return 0.5;
  }

  const idf = Math.log(corpus.totalProjects / frequency);
  const maxIdf = Math.log(corpus.totalProjects);
  
  // Normalize to 0-1
  return maxIdf > 0 ? idf / maxIdf : 0;
}

/**
 * Convert a corpus to a RarityMap for use with the compare engine.
 * Maps feature hashes to rarity scores (0-1).
 */
export function corpusToRarityMap(
  corpus: RarityCorpus
): Map<string, number> {
  const map = new Map<string, number>();
  for (const hash of corpus.patternFrequency.keys()) {
    map.set(hash, getRarityScore(corpus, hash));
  }
  return map;
}

/**
 * Save a corpus to disk as JSON.
 */
export function saveCorpus(corpus: RarityCorpus, path: string): void {
  const serializable = {
    ...corpus,
    patternFrequency: Object.fromEntries(corpus.patternFrequency),
  };
  writeFileSync(path, JSON.stringify(serializable, null, 2));
}

/**
 * Load a corpus from disk.
 */
export function loadCorpus(path: string): RarityCorpus {
  if (!existsSync(path)) {
    return createCorpus();
  }
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  return {
    ...data,
    patternFrequency: new Map(Object.entries(data.patternFrequency)),
  };
}
