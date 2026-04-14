/**
 * @firstprint/core — Normalizer
 * 
 * Strips surface-level details from a parsed AST,
 * leaving only structural decisions.
 * 
 * - Variable names → positional tokens ($VAR_0, $VAR_1, ...)
 * - String literals → $STRING
 * - Number literals → $NUMBER
 * - Comments → removed
 * - Whitespace → irrelevant (AST is already whitespace-agnostic)
 * 
 * The result is a canonical structural skeleton that
 * represents WHAT the code does, not HOW it's written.
 */

import type { ParsedNode } from './parser.js';

/** Tracks variable name mappings during normalization */
interface NormalizationContext {
  variableMap: Map<string, string>;
  variableCounter: number;
  functionMap: Map<string, string>;
  functionCounter: number;
  parameterMap: Map<string, string>;
  parameterCounter: number;
}

function createContext(): NormalizationContext {
  return {
    variableMap: new Map(),
    variableCounter: 0,
    functionMap: new Map(),
    functionCounter: 0,
    parameterMap: new Map(),
    parameterCounter: 0,
  };
}

/** Node types that represent comments */
const COMMENT_TYPES = new Set([
  'comment', 'line_comment', 'block_comment',
  'jsdoc', 'html_comment',
]);

/** Node types that represent string/number literals */
const LITERAL_TYPES = new Set([
  'string', 'template_string', 'string_fragment',
  'number', 'integer', 'float',
  'true', 'false', 'null', 'undefined', 'none',
]);

/** Node types that represent identifiers to normalize */
const IDENTIFIER_TYPES = new Set([
  'identifier', 'property_identifier', 'shorthand_property_identifier',
  'shorthand_property_identifier_pattern',
]);

/** Well-known identifiers that should NOT be normalized (APIs, builtins) */
const PRESERVED_IDENTIFIERS = new Set([
  // JS/TS builtins
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Promise', 'Map', 'Set', 'Date', 'Error', 'RegExp',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'require', 'module', 'exports', 'import', 'export', 'default',
  'async', 'await', 'yield',
  'undefined', 'null', 'NaN', 'Infinity',
  'Buffer', 'process', 'global', 'window', 'document',
  // Python builtins
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter',
  'int', 'str', 'float', 'list', 'dict', 'tuple', 'set', 'bool',
  'True', 'False', 'None', 'self', 'cls', '__init__', '__name__',
  'super', 'isinstance', 'type', 'input', 'open',
  // Common framework identifiers
  'React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
  'Component', 'render', 'setState',
  'express', 'app', 'router', 'req', 'res', 'next',
  'fetch', 'Response', 'Request', 'Headers',
]);

/**
 * Normalize a parsed AST by replacing surface details with canonical tokens.
 * Returns a new tree with normalized identifiers and stripped literals.
 */
export function normalizeAST(node: ParsedNode): ParsedNode {
  const ctx = createContext();
  return normalizeNode(node, ctx);
}

function normalizeNode(node: ParsedNode, ctx: NormalizationContext): ParsedNode {
  // Skip comments entirely
  if (COMMENT_TYPES.has(node.type)) {
    return { ...node, text: '', children: [], fields: {} };
  }

  // Normalize literals
  if (LITERAL_TYPES.has(node.type)) {
    const token = getLiteralToken(node.type);
    return { ...node, text: token, children: [] };
  }

  // Normalize identifiers
  if (IDENTIFIER_TYPES.has(node.type)) {
    const normalizedName = normalizeIdentifier(node.text, node, ctx);
    return { ...node, text: normalizedName, children: [] };
  }

  // Recursively normalize children
  const normalizedChildren = node.children
    .filter(c => !COMMENT_TYPES.has(c.type))
    .map(c => normalizeNode(c, ctx));

  const normalizedFields: Record<string, ParsedNode | null> = {};
  for (const [key, value] of Object.entries(node.fields)) {
    if (value && !COMMENT_TYPES.has(value.type)) {
      normalizedFields[key] = normalizeNode(value, ctx);
    }
  }

  return {
    ...node,
    children: normalizedChildren,
    fields: normalizedFields,
  };
}

function getLiteralToken(nodeType: string): string {
  if (nodeType === 'number' || nodeType === 'integer' || nodeType === 'float') {
    return '$NUMBER';
  }
  if (nodeType === 'true' || nodeType === 'false') {
    return '$BOOLEAN';
  }
  if (nodeType === 'null' || nodeType === 'undefined' || nodeType === 'none') {
    return '$NULL';
  }
  return '$STRING';
}

function normalizeIdentifier(
  name: string,
  node: ParsedNode,
  ctx: NormalizationContext
): string {
  // Preserve well-known identifiers
  if (PRESERVED_IDENTIFIERS.has(name)) return name;

  // Check if we've seen this name before
  if (ctx.variableMap.has(name)) return ctx.variableMap.get(name)!;
  if (ctx.functionMap.has(name)) return ctx.functionMap.get(name)!;
  if (ctx.parameterMap.has(name)) return ctx.parameterMap.get(name)!;

  // Assign a new canonical name based on context
  // We use the parent node type to determine the category
  const token = `$VAR_${ctx.variableCounter++}`;
  ctx.variableMap.set(name, token);
  return token;
}

/**
 * Serialize a normalized AST to a canonical string.
 * This is what gets hashed for the fingerprint.
 */
export function serializeAST(node: ParsedNode): string {
  if (node.children.length === 0) {
    return `(${node.type} "${node.text}")`;
  }
  const childStr = node.children.map(c => serializeAST(c)).join(' ');
  return `(${node.type} ${childStr})`;
}
