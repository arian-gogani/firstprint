/**
 * @firstprint/core — Function-Level Fingerprinting
 * 
 * Instead of fingerprinting an entire file as one unit,
 * this extracts and fingerprints individual functions.
 * 
 * This enables granular partial-clone detection:
 * "3 of your 8 functions appear in the suspect's codebase"
 */

import { parseCode } from './parser.js';
import type { ParsedNode } from './parser.js';
import { normalizeAST, serializeAST } from './normalizer.js';
import { extractAllFeatures } from './extractor.js';
import { computeMinHash, computeSimHash, sha256, merkleRoot } from './hash.js';
import type { Language, StructuralFingerprint, StructuralFeature } from './types.js';
import { randomUUID } from 'crypto';

const FINGERPRINT_VERSION = '0.1.0';

/** Function-level metadata */
export interface FunctionInfo {
  /** Normalized function name (or anonymous) */
  name: string;
  /** Number of parameters */
  paramCount: number;
  /** Whether it's async */
  isAsync: boolean;
  /** Whether it's a generator */
  isGenerator: boolean;
  /** Whether it's exported */
  isExported: boolean;
  /** Whether it's a class method */
  isMethod: boolean;
  /** The class name if it's a method */
  className?: string;
  /** Line range in original source */
  lineRange: [number, number];
}

/** A fingerprint scoped to a single function */
export interface FunctionFingerprint {
  /** Unique ID */
  id: string;
  /** Function metadata */
  info: FunctionInfo;
  /** The structural fingerprint of this function */
  fingerprint: StructuralFingerprint;
}

/** File-level result containing all function fingerprints */
export interface FileFunctionFingerprints {
  /** The file-level fingerprint */
  fileFingerprint: StructuralFingerprint;
  /** Per-function fingerprints */
  functions: FunctionFingerprint[];
  /** Total function count */
  functionCount: number;
}

const FUNCTION_TYPES = new Set([
  'function_declaration',
  'method_definition', 
  'arrow_function',
  'function_definition', // Python
  'function', // Python
]);

/**
 * Extract and fingerprint all functions in a source file.
 * Returns both file-level and function-level fingerprints.
 */
export async function fingerprintFunctions(
  source: string,
  language: Language
): Promise<FileFunctionFingerprints> {
  const ast = await parseCode(source, language);
  const normalized = normalizeAST(ast);

  // File-level fingerprint
  const allFeatures = normalized.children.length === 0
    ? []
    : extractAllFeatures(normalized);
  const astFeatures = allFeatures.filter(f => f.type === 'ast_subtree').map(f => f.canonical);
  const cfgFeatures = allFeatures.filter(f => f.type === 'control_flow').map(f => f.canonical);
  const depFeatures = allFeatures.filter(f => f.type === 'dependency').map(f => f.canonical).sort();

  const fileFingerprint: StructuralFingerprint = {
    id: randomUUID(),
    version: FINGERPRINT_VERSION,
    language,
    createdAt: Date.now(),
    astMinHash: computeMinHash(astFeatures),
    controlFlowSimHash: computeSimHash(cfgFeatures),
    dependencyHash: sha256(depFeatures.join('|')),
    features: allFeatures,
    featureCount: allFeatures.length,
    fingerprintHash: merkleRoot([
      sha256(JSON.stringify(computeMinHash(astFeatures))),
      sha256(computeSimHash(cfgFeatures).toString()),
      sha256(depFeatures.join('|')),
    ]),
  };

  // Extract function nodes from original AST (before normalization, for metadata)
  const functionNodes = findFunctionNodes(ast);
  const normalizedFunctions = findFunctionNodes(normalized);

  const functions: FunctionFingerprint[] = [];

  for (let i = 0; i < normalizedFunctions.length; i++) {
    const normFunc = normalizedFunctions[i];
    const origFunc = functionNodes[i]; // parallel structure

    const funcFeatures = extractAllFeatures(normFunc.node);
    if (funcFeatures.length === 0) continue;

    const funcAst = funcFeatures.filter(f => f.type === 'ast_subtree').map(f => f.canonical);
    const funcCfg = funcFeatures.filter(f => f.type === 'control_flow').map(f => f.canonical);
    const funcDep = funcFeatures.filter(f => f.type === 'dependency').map(f => f.canonical).sort();

    const fp: StructuralFingerprint = {
      id: randomUUID(),
      version: FINGERPRINT_VERSION,
      language,
      createdAt: Date.now(),
      astMinHash: computeMinHash(funcAst),
      controlFlowSimHash: computeSimHash(funcCfg),
      dependencyHash: sha256(funcDep.join('|')),
      features: funcFeatures,
      featureCount: funcFeatures.length,
      fingerprintHash: merkleRoot([
        sha256(JSON.stringify(computeMinHash(funcAst))),
        sha256(computeSimHash(funcCfg).toString()),
        sha256(funcDep.join('|')),
      ]),
    };

    const info = extractFunctionInfo(origFunc);

    functions.push({ id: randomUUID(), info, fingerprint: fp });
  }

  return { fileFingerprint, functions, functionCount: functions.length };
}

/** Found function node with context */
interface FoundFunction {
  node: ParsedNode;
  parent?: ParsedNode;
}

/** Walk AST to find all function nodes */
function findFunctionNodes(root: ParsedNode): FoundFunction[] {
  const results: FoundFunction[] = [];
  walkForFunctions(root, undefined, results);
  return results;
}

function walkForFunctions(
  node: ParsedNode,
  parent: ParsedNode | undefined,
  results: FoundFunction[]
): void {
  if (FUNCTION_TYPES.has(node.type)) {
    results.push({ node, parent });
  }
  for (const child of node.children) {
    walkForFunctions(child, node, results);
  }
}

/** Extract metadata about a function from the original (non-normalized) AST */
function extractFunctionInfo(found: FoundFunction): FunctionInfo {
  const node = found.node;
  const nameNode = node.fields.name;
  const name = nameNode?.text || '$ANONYMOUS';

  // Count parameters
  const params = node.fields.parameters;
  const paramCount = params ? params.children.filter(c => c.isNamed).length : 0;

  // Check modifiers
  const text = node.text || '';
  const isAsync = text.trimStart().startsWith('async');
  const isGenerator = node.type === 'generator_function_declaration' 
    || text.includes('function*');

  // Check if exported
  const isExported = found.parent?.type === 'export_statement'
    || found.parent?.type === 'export_declaration';

  // Check if class method
  const isMethod = node.type === 'method_definition';
  const className = isMethod && found.parent?.type === 'class_body'
    ? found.parent?.fields?.name?.text
    : undefined;

  return {
    name,
    paramCount,
    isAsync,
    isGenerator,
    isExported,
    isMethod,
    className,
    lineRange: [node.startPosition[0], node.endPosition[0]],
  };
}
