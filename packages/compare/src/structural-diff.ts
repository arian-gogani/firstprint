/**
 * @firstprint/compare — Structural Diff
 * 
 * Shows what structurally changed between two versions
 * of the same codebase. Not line diffs — structural diffs.
 * 
 * "You added 2 new control flow branches, removed a guard
 *  clause, and changed the error handling pattern."
 */

import type { StructuralFingerprint, StructuralFeature } from '../../core/src/types.js';

/** A single structural change */
export interface StructuralChange {
  type: 'added' | 'removed' | 'modified';
  layer: string;
  description: string;
  feature: string;
}

/** Result of a structural diff */
export interface StructuralDiffResult {
  /** Changes from version A to version B */
  changes: StructuralChange[];
  /** Summary stats */
  added: number;
  removed: number;
  unchanged: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Compute the structural diff between two fingerprints.
 * Shows what structurally changed — not line by line,
 * but at the architectural level.
 */
export function structuralDiff(
  before: StructuralFingerprint,
  after: StructuralFingerprint
): StructuralDiffResult {
  const beforeHashes = new Map<string, StructuralFeature>();
  const afterHashes = new Map<string, StructuralFeature>();

  for (const f of before.features) beforeHashes.set(f.hash, f);
  for (const f of after.features) afterHashes.set(f.hash, f);

  const changes: StructuralChange[] = [];
  let added = 0, removed = 0, unchanged = 0;

  // Find removed features (in before, not in after)
  for (const [hash, feature] of beforeHashes) {
    if (!afterHashes.has(hash)) {
      removed++;
      changes.push({
        type: 'removed',
        layer: feature.type,
        description: describeChange('removed', feature),
        feature: feature.canonical,
      });
    } else {
      unchanged++;
    }
  }

  // Find added features (in after, not in before)
  for (const [hash, feature] of afterHashes) {
    if (!beforeHashes.has(hash)) {
      added++;
      changes.push({
        type: 'added',
        layer: feature.type,
        description: describeChange('added', feature),
        feature: feature.canonical,
      });
    }
  }

  // Sort: removed first, then added, by layer
  changes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'removed' ? -1 : 1;
    return a.layer.localeCompare(b.layer);
  });

  const summary = generateDiffSummary(added, removed, unchanged, changes);

  return { changes, added, removed, unchanged, summary };
}

function describeChange(
  type: 'added' | 'removed',
  feature: StructuralFeature
): string {
  const verb = type === 'added' ? 'Added' : 'Removed';
  
  switch (feature.type) {
    case 'ast_subtree':
      return `${verb} structural pattern: ${feature.nodeType}`;
    case 'control_flow':
      return `${verb} control flow path: ${feature.canonical.replace('CF[', '').replace(']', '')}`;
    case 'dependency':
      return `${verb} dependency: ${feature.canonical.replace('IMPORT[', '').replace('EXPORT[', '').replace(']', '')}`;
    case 'logic_pattern':
      return `${verb} logic pattern: ${feature.canonical}`;
    default:
      return `${verb} ${feature.type}: ${feature.canonical}`;
  }
}

function generateDiffSummary(
  added: number,
  removed: number,
  unchanged: number,
  changes: StructuralChange[]
): string {
  const total = added + removed + unchanged;
  if (added === 0 && removed === 0) {
    return 'No structural changes detected.';
  }

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} patterns added`);
  if (removed > 0) parts.push(`${removed} patterns removed`);
  parts.push(`${unchanged} unchanged`);

  // Count changes by layer
  const byLayer: Record<string, { added: number; removed: number }> = {};
  for (const c of changes) {
    if (!byLayer[c.layer]) byLayer[c.layer] = { added: 0, removed: 0 };
    byLayer[c.layer][c.type === 'added' ? 'added' : 'removed']++;
  }

  const layerParts: string[] = [];
  for (const [layer, counts] of Object.entries(byLayer)) {
    const lp: string[] = [];
    if (counts.added > 0) lp.push(`+${counts.added}`);
    if (counts.removed > 0) lp.push(`-${counts.removed}`);
    layerParts.push(`${layer}: ${lp.join(', ')}`);
  }

  return `Structural diff: ${parts.join(', ')}. By layer: ${layerParts.join('; ')}.`;
}
