/**
 * @firstprint/core — Type definitions
 * 
 * The structural fingerprint of a code artifact.
 * This is the atomic unit of Firstprint.
 */

/** Supported languages for parsing */
export type Language = 'typescript' | 'python';

/** A single structural feature extracted from code */
export interface StructuralFeature {
  /** Category of the feature */
  type: 'ast_subtree' | 'control_flow' | 'dependency' | 'type_signature' | 'logic_pattern';
  /** Canonical string representation of the feature */
  canonical: string;
  /** Hash of the canonical representation */
  hash: string;
  /** Depth in the AST where this feature was found */
  depth: number;
  /** The AST node type that produced this feature */
  nodeType: string;
}
/** AST subtree feature — a normalized subtree of depth N */
export interface ASTSubtreeFeature extends StructuralFeature {
  type: 'ast_subtree';
  /** Number of child nodes in this subtree */
  childCount: number;
  /** Ordered list of child node types */
  childTypes: string[];
  /** Subtree depth */
  subtreeDepth: number;
}

/** Control flow feature — a path through the control flow graph */
export interface ControlFlowFeature extends StructuralFeature {
  type: 'control_flow';
  /** Sequence of control flow node types (if, else, for, while, try, etc.) */
  flowSequence: string[];
  /** Number of branches */
  branchCount: number;
}

/** Dependency feature — import/export and call relationships */
export interface DependencyFeature extends StructuralFeature {
  type: 'dependency';
  /** Source module or identifier */
  source: string;
  /** Type of dependency relationship */
  relationship: 'import' | 'export' | 'call' | 'extends' | 'implements';
}

/** The complete structural fingerprint of a code artifact */
export interface StructuralFingerprint {
  /** Unique ID for this fingerprint */
  id: string;
  /** Version of the fingerprinting algorithm */
  version: string;
  /** Language of the source code */
  language: Language;
  /** Timestamp of fingerprint creation */
  createdAt: number;

  /** MinHash signature for AST features (128-dimensional) */
  astMinHash: number[];
  /** SimHash for control flow features (64-bit) */
  controlFlowSimHash: bigint;
  /** SHA-256 hash of normalized dependency graph */
  dependencyHash: string;

  /** All extracted structural features */
  features: StructuralFeature[];
  /** Total number of features extracted */
  featureCount: number;

  /** SHA-256 hash of the entire fingerprint (for integrity) */
  fingerprintHash: string;
}
