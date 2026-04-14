/**
 * @firstprint/core — Project-Level Fingerprinting
 * 
 * Fingerprints an entire project directory, combining
 * file-level and function-level fingerprints into a
 * single project fingerprint.
 * 
 * This is the real-world use case: comparing two
 * codebases, not two files.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { randomUUID } from 'crypto';
import { fingerprint } from './fingerprint.js';
import { fingerprintFunctions } from './function-fingerprint.js';
import { computeMinHash, sha256, merkleRoot } from './hash.js';
import { detectLanguage } from './parser.js';
import type { Language, StructuralFingerprint, StructuralFeature } from './types.js';
import type { FunctionFingerprint, FileFunctionFingerprints } from './function-fingerprint.js';

/** Fingerprint of a single file within a project */
export interface FileFingerprint {
  /** Relative path within the project */
  relativePath: string;
  /** Language */
  language: Language;
  /** File-level fingerprint */
  fingerprint: StructuralFingerprint;
  /** Function-level fingerprints */
  functions: FunctionFingerprint[];
  /** File size in bytes */
  sizeBytes: number;
}

/** Fingerprint of an entire project */
export interface ProjectFingerprint {
  /** Unique ID */
  id: string;
  /** Project name */
  name: string;
  /** Root directory */
  rootPath: string;
  /** Timestamp */
  createdAt: number;
  /** All file fingerprints */
  files: FileFingerprint[];
  /** Aggregate project fingerprint */
  aggregate: StructuralFingerprint;
  /** Total files */
  fileCount: number;
  /** Total functions */
  functionCount: number;
  /** Total features */
  featureCount: number;
  /** Merkle root of all file hashes */
  projectHash: string;
}

/** Options for project fingerprinting */
export interface ProjectOptions {
  /** File extensions to include (default: .ts, .tsx, .py) */
  extensions?: string[];
  /** Directories to exclude */
  excludeDirs?: string[];
  /** Max file size in bytes (default: 100KB) */
  maxFileSize?: number;
  /** Max files to process (default: 500) */
  maxFiles?: number;
}

const DEFAULT_OPTIONS: Required<ProjectOptions> = {
  extensions: ['.ts', '.tsx', '.py'],
  excludeDirs: [
    'node_modules', 'dist', 'build', '.git', '__pycache__',
    'coverage', '.next', '.cache', 'vendor', 'venv', '.env',
  ],
  maxFileSize: 100_000,
  maxFiles: 500,
};

/**
 * Fingerprint an entire project directory.
 */
export async function fingerprintProject(
  rootPath: string,
  name?: string,
  options?: ProjectOptions
): Promise<ProjectFingerprint> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const projectName = name || rootPath.split('/').pop() || 'unknown';

  // Collect all source files
  const filePaths = collectFiles(rootPath, opts);

  const files: FileFingerprint[] = [];
  let totalFunctions = 0;
  let totalFeatures = 0;
  const allFeatures: StructuralFeature[] = [];

  for (const filePath of filePaths.slice(0, opts.maxFiles)) {
    const relPath = relative(rootPath, filePath);
    const lang = detectLanguage(filePath);
    if (!lang) continue;

    try {
      const source = readFileSync(filePath, 'utf-8');
      if (source.length > opts.maxFileSize) continue;
      if (source.trim().length === 0) continue;

      const result = await fingerprintFunctions(source, lang);
