/**
 * @firstprint/core — Parser
 * 
 * Wraps tree-sitter to parse source code into ASTs.
 * Supports TypeScript and Python as launch languages.
 */

import type { Language } from './types.js';

/** A parsed syntax tree node (tree-sitter agnostic representation) */
export interface ParsedNode {
  /** The node type (e.g., 'function_declaration', 'if_statement') */
  type: string;
  /** Whether this is a named node (vs anonymous like punctuation) */
  isNamed: boolean;
  /** Start position [row, col] */
  startPosition: [number, number];
  /** End position [row, col] */
  endPosition: [number, number];
  /** The raw text of this node */
  text: string;
  /** Child nodes */
  children: ParsedNode[];
  /** Named fields (e.g., 'name', 'body', 'condition') */
  fields: Record<string, ParsedNode | null>;
}

/** Detect language from file extension */
export function detectLanguage(filename: string): Language | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    default:
      return null;
  }
}

/**
 * Parse source code into a tree-sitter AST, then convert
 * to our internal ParsedNode representation.
 * 
 * This abstraction allows us to swap parsers later without
 * changing downstream code.
 */
export async function parseCode(
  source: string,
  language: Language
): Promise<ParsedNode> {
  // Dynamic import to handle tree-sitter's native bindings
  const Parser = (await import('tree-sitter')).default;

  let grammar: any;
  switch (language) {
    case 'typescript':
      grammar = (await import('tree-sitter-typescript')).default.typescript;
      break;
    case 'python':
      grammar = (await import('tree-sitter-python')).default;
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  const parser = new Parser();
  parser.setLanguage(grammar);

  const tree = parser.parse(source);
  const root = tree.rootNode;

  return convertNode(root);
}

/** Convert a tree-sitter SyntaxNode to our ParsedNode */
function convertNode(node: any): ParsedNode {
  const children: ParsedNode[] = [];
  const fields: Record<string, ParsedNode | null> = {};

  // Convert all named children
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child) {
      children.push(convertNode(child));
    }
  }

  // Extract named fields
  const fieldNames = [
    'name', 'body', 'condition', 'consequence', 'alternative',
    'left', 'right', 'operator', 'value', 'parameters',
    'return_type', 'type', 'initializer', 'arguments',
    'object', 'property', 'source', 'decorator',
  ];

  for (const fieldName of fieldNames) {
    try {
      const fieldNode = node.childForFieldName(fieldName);
      if (fieldNode) {
        fields[fieldName] = convertNode(fieldNode);
      }
    } catch {
      // Field doesn't exist for this node type — skip
    }
  }

  return {
    type: node.type,
    isNamed: node.isNamed,
    startPosition: [node.startPosition.row, node.startPosition.column],
    endPosition: [node.endPosition.row, node.endPosition.column],
    text: node.text,
    children,
    fields,
  };
}
