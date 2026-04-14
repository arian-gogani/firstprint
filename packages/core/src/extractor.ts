/**
 * @firstprint/core — Feature Extractor
 * 
 * Walks a normalized AST and extracts structural features:
 * - AST subtree patterns (structural n-grams)
 * - Control flow patterns (branching, loops, error handling)
 * - Dependency patterns (imports, exports, call relationships)
 * - Type signature patterns (function signatures, parameter shapes)
 * - Logic patterns (guard clauses, state machines, conditional chains)
 * 
 * Each feature is a canonical string that can be hashed and compared.
 */

import type { ParsedNode } from './parser.js';
import type { StructuralFeature } from './types.js';
import { sha256 } from './hash.js';

// ─── AST Subtree Features ──────────────────────────────────────────────────

/**
 * Extract AST subtree features of configurable depth.
 * These are "structural n-grams" — patterns of node types
 * that capture architectural decisions.
 */
export function extractASTSubtrees(
  node: ParsedNode,
  maxDepth: number = 4
): StructuralFeature[] {
  const features: StructuralFeature[] = [];
  walkAndExtractSubtrees(node, 0, maxDepth, features);
  return features;
}

function walkAndExtractSubtrees(
  node: ParsedNode,
  currentDepth: number,
  maxDepth: number,
  features: StructuralFeature[]
): void {
  // Only extract from named nodes (skip punctuation, operators)
  if (!node.isNamed) return;

  // Skip trivial/structural nodes that appear in every file
  const TRIVIAL_TYPES = new Set([
    'program', 'expression_statement', 'parenthesized_expression',
    'statement_block', 'formal_parameters', 'required_parameter',
    'type_annotation', 'object', 'pair', 'array', 'arguments',
    'binary_expression', 'template_string', 'template_substitution',
    'lexical_declaration', 'variable_declarator', 'member_expression',
    'call_expression', 'await_expression', 'return_statement',
    'new_expression', 'assignment_expression', 'property_signature',
    'object_type', 'literal_type', 'union_type', 'type_alias_declaration',
    'string', 'number', 'identifier', 'property_identifier',
    'shorthand_property_identifier_pattern', 'shorthand_property_identifier',
    'accessibility_modifier', 'export_statement',
  ]);
  
  if (!TRIVIAL_TYPES.has(node.type)) {
    // Extract subtree pattern at this node
    const canonical = serializeSubtree(node, maxDepth);
    features.push({
      type: 'ast_subtree',
      canonical,
      hash: sha256(canonical),
      depth: currentDepth,
      nodeType: node.type,
    });
  }

  // Recurse into children
  for (const child of node.children) {
    walkAndExtractSubtrees(child, currentDepth + 1, maxDepth, features);
  }
}

/** Serialize a subtree up to maxDepth as a canonical string */
function serializeSubtree(node: ParsedNode, maxDepth: number, depth: number = 0): string {
  if (depth >= maxDepth || node.children.length === 0) {
    return `(${node.type})`;
  }
  const childStrs = node.children
    .filter(c => c.isNamed)
    .map(c => serializeSubtree(c, maxDepth, depth + 1))
    .join(' ');
  return `(${node.type} ${childStrs})`;
}

// ─── Control Flow Features ─────────────────────────────────────────────────

/** Node types that represent control flow */
const CONTROL_FLOW_TYPES = new Set([
  'if_statement', 'else_clause', 'else_if_clause',
  'for_statement', 'for_in_statement', 'for_of_statement',
  'while_statement', 'do_statement',
  'switch_statement', 'switch_case', 'switch_default',
  'try_statement', 'catch_clause', 'finally_clause',
  'return_statement', 'break_statement', 'continue_statement',
  'throw_statement', 'yield_expression', 'await_expression',
  // Python
  'if_statement', 'elif_clause', 'else_clause',
  'for_statement', 'while_statement',
  'try_statement', 'except_clause', 'finally_clause',
  'raise_statement', 'with_statement',
]);

/**
 * Extract control flow features — sequences of control flow
 * decisions that capture the branching structure of code.
 */
export function extractControlFlow(node: ParsedNode): StructuralFeature[] {
  const features: StructuralFeature[] = [];
  const flowPaths: string[][] = [];

  collectControlFlowPaths(node, [], flowPaths);

  for (const path of flowPaths) {
    if (path.length < 2) continue; // Single nodes aren't interesting
    const canonical = `CF[${path.join(' -> ')}]`;
    features.push({
      type: 'control_flow',
      canonical,
      hash: sha256(canonical),
      depth: 0,
      nodeType: path[0],
    });
  }

  return features;
}

function collectControlFlowPaths(
  node: ParsedNode,
  currentPath: string[],
  allPaths: string[][]
): void {
  if (CONTROL_FLOW_TYPES.has(node.type)) {
    currentPath = [...currentPath, node.type];
  }

  // At function boundaries, save the accumulated path
  const FUNCTION_TYPES = new Set([
    'function_declaration', 'method_definition', 'arrow_function',
    'function_definition', // Python
  ]);

  if (FUNCTION_TYPES.has(node.type) && currentPath.length > 0) {
    allPaths.push([...currentPath]);
    currentPath = [];
  }

  for (const child of node.children) {
    collectControlFlowPaths(child, currentPath, allPaths);
  }

  // Save path at end of traversal if we have one
  if (currentPath.length >= 2 && node.children.length === 0) {
    allPaths.push([...currentPath]);
  }
}

// ─── Dependency Features ───────────────────────────────────────────────────

/** Import/export node types */
const IMPORT_TYPES = new Set([
  'import_statement', 'import_declaration',
]);

const EXPORT_TYPES = new Set([
  'export_statement', 'export_declaration',
]);

/**
 * Extract dependency features — imports, exports, and their relationships.
 */
export function extractDependencies(node: ParsedNode): StructuralFeature[] {
  const features: StructuralFeature[] = [];
  walkDependencies(node, features);
  return features;
}

function walkDependencies(node: ParsedNode, features: StructuralFeature[]): void {
  if (IMPORT_TYPES.has(node.type)) {
    const source = node.fields.source?.text || '';
    const canonical = `IMPORT[${source}]`;
    features.push({
      type: 'dependency',
      canonical,
      hash: sha256(canonical),
      depth: 0,
      nodeType: node.type,
    });
  }

  if (EXPORT_TYPES.has(node.type)) {
    const canonical = `EXPORT[${node.type}]`;
    features.push({
      type: 'dependency',
      canonical,
      hash: sha256(canonical),
      depth: 0,
      nodeType: node.type,
    });
  }

  for (const child of node.children) {
    walkDependencies(child, features);
  }
}

// ─── Logic Pattern Features ────────────────────────────────────────────────

/**
 * Extract higher-level logic patterns:
 * - Guard clauses (early returns)
 * - Conditional chains (if/else if/else)
 * - Error handling patterns (try/catch structures)
 * - Function composition patterns
 */
export function extractLogicPatterns(
  node: ParsedNode
): StructuralFeature[] {
  const features: StructuralFeature[] = [];
  walkLogicPatterns(node, features);
  return features;
}

function walkLogicPatterns(
  node: ParsedNode,
  features: StructuralFeature[]
): void {
  // Detect guard clause pattern: if (...) return/throw at start of function
  const FUNCTION_TYPES = new Set([
    'function_declaration', 'method_definition', 'arrow_function',
    'function_definition',
  ]);

  if (FUNCTION_TYPES.has(node.type)) {
    const body = node.fields.body;
    if (body && body.children.length > 0) {
      const guardClauses = detectGuardClauses(body);
      if (guardClauses > 0) {
        const canonical = `GUARD_PATTERN[count=${guardClauses}]`;
        features.push({
          type: 'logic_pattern',
          canonical,
          hash: sha256(canonical),
          depth: 0,
          nodeType: 'guard_clause',
        });
      }
    }
  }

  // Detect conditional chain patterns (if/else if/else depth)
  if (node.type === 'if_statement') {
    const chainDepth = measureConditionalChain(node);
    if (chainDepth >= 2) {
      const canonical = `COND_CHAIN[depth=${chainDepth}]`;
      features.push({
        type: 'logic_pattern',
        canonical,
        hash: sha256(canonical),
        depth: 0,
        nodeType: 'conditional_chain',
      });
    }
  }

  // Detect try/catch structure patterns
  if (node.type === 'try_statement') {
    const hasCatch = node.children.some(c => c.type === 'catch_clause');
    const hasFinally = node.children.some(c => c.type === 'finally_clause');
    const canonical = `TRY_PATTERN[catch=${hasCatch},finally=${hasFinally}]`;
    features.push({
      type: 'logic_pattern',
      canonical,
      hash: sha256(canonical),
      depth: 0,
      nodeType: 'error_handling',
    });
  }

  for (const child of node.children) {
    walkLogicPatterns(child, features);
  }
}

/** Count guard clauses at the start of a function body */
function detectGuardClauses(body: ParsedNode): number {
  let guards = 0;
  // body might be a statement_block — get its children
  const statements = body.type === 'statement_block' ? body.children : [body];
  for (const stmt of statements) {
    if (stmt.type === 'if_statement') {
      // Check if the if body contains only a return/throw
      const consequence = stmt.fields.consequence;
      if (consequence) {
        // consequence is usually a statement_block — check its children
        const stmts = consequence.type === 'statement_block'
          ? consequence.children
          : [consequence];
        const hasEarlyExit = stmts.some(
          c => c.type === 'return_statement' || c.type === 'throw_statement'
        );
        if (hasEarlyExit) {
          guards++;
          continue;
        }
      }
    }
    break; // Stop at first non-guard statement
  }
  return guards;
}

/** Measure the depth of an if/else if/else chain */
function measureConditionalChain(node: ParsedNode): number {
  let depth = 1;
  const alt = node.fields.alternative;
  if (alt) {
    if (alt.type === 'else_clause' || alt.type === 'elif_clause') {
      const nestedIf = alt.children.find(c => c.type === 'if_statement');
      if (nestedIf) {
        depth += measureConditionalChain(nestedIf);
      } else {
        depth++; // Final else
      }
    }
  }
  return depth;
}

// ─── Combined Extraction ───────────────────────────────────────────────────

/**
 * Extract ALL structural features from a normalized AST.
 * This is the main entry point for feature extraction.
 */
export function extractAllFeatures(node: ParsedNode): StructuralFeature[] {
  return [
    ...extractASTSubtrees(node),
    ...extractControlFlow(node),
    ...extractDependencies(node),
    ...extractLogicPatterns(node),
  ];
}
