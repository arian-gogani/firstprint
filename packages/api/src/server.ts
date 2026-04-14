/**
 * @firstprint/api — REST API Server
 * 
 * Exposes the Firstprint engine over HTTP.
 * Zero external dependencies — built on Node's native http module.
 * 
 * Endpoints:
 *   POST /fingerprint     — Submit code, get structural fingerprint
 *   POST /compare         — Compare two code samples
 *   POST /register        — Fingerprint + sign + ledger entry
 *   GET  /verify/:id      — Verify a ledger entry
 *   POST /investigate     — Full forensic: your code vs suspected clone
 *   POST /scan            — Fingerprint an entire project directory
 *   GET  /health          — Health check
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { fingerprint, serializeFingerprint } from '@firstprint/core';
import type { Language } from '@firstprint/core';
import { compare } from '@firstprint/compare';
import { Ledger } from '@firstprint/ledger';

const PORT = parseInt(process.env.PORT || '3100', 10);
let ledger: Ledger;

// ─── Helpers ───────────────────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v, 2));
}

function err(res: ServerResponse, msg: string, status = 400) {
  json(res, { error: msg }, status);
}

function getPath(req: IncomingMessage): string {
  return new URL(req.url || '/', 'http://localhost').pathname;
}

// ─── Route Handlers ────────────────────────────────────────────

async function handleFingerprint(req: IncomingMessage, res: ServerResponse) {
  const { source, language } = JSON.parse(await readBody(req));
  if (!source || !language) return err(res, 'Missing: source, language');
  const fp = await fingerprint(source, language);
  json(res, { fingerprint: fp, serialized: serializeFingerprint(fp) });
}

async function handleCompare(req: IncomingMessage, res: ServerResponse) {
  const { sourceCode, targetCode, language } = JSON.parse(await readBody(req));
  if (!sourceCode || !targetCode || !language)
    return err(res, 'Missing: sourceCode, targetCode, language');
  const sourceFp = await fingerprint(sourceCode, language);
  const targetFp = await fingerprint(targetCode, language);
  const result = compare(sourceFp, targetFp);
  json(res, {
    comparison: result,
    sourceFingerprint: sourceFp.id,
    targetFingerprint: targetFp.id,
  });
}

async function handleRegister(req: IncomingMessage, res: ServerResponse) {
  const { source, language } = JSON.parse(await readBody(req));
  if (!source || !language) return err(res, 'Missing: source, language');
  const fp = await fingerprint(source, language);
  const entry = await ledger.register(fp);
  json(res, {
    fingerprint: fp,
    ledgerEntry: entry,
    message: `Birth certificate issued: ${entry.id}`,
  });
}

async function handleInvestigate(req: IncomingMessage, res: ServerResponse) {
  const { originalCode, suspectedClone, language } = JSON.parse(await readBody(req));
  if (!originalCode || !suspectedClone || !language)
    return err(res, 'Missing: originalCode, suspectedClone, language');

  const originalFp = await fingerprint(originalCode, language);
  const cloneFp = await fingerprint(suspectedClone, language);
  const entry = await ledger.register(originalFp);
  const result = compare(originalFp, cloneFp);

  json(res, {
    investigation: {
      original: {
        fingerprintId: originalFp.id,
        ledgerEntryId: entry.id,
        registeredAt: entry.timestamp,
        featureCount: originalFp.featureCount,
      },
      suspect: {
        fingerprintId: cloneFp.id,
        featureCount: cloneFp.featureCount,
      },
      result: {
        derivationScore: result.derivationScore,
        band: result.band,
        confidence: result.confidence,
        summary: result.summary,
        evidence: result.evidence,
        layerScores: result.layerScores,
      },
    },
  });
}

async function handleVerify(req: IncomingMessage, res: ServerResponse) {
  const id = getPath(req).split('/').pop();
  if (!id) return err(res, 'Missing entry ID');
  const entry = ledger.getEntry(id);
  if (!entry) return err(res, 'Entry not found', 404);
  const verification = await ledger.verify(entry);
  json(res, { entry, verification });
}

// ─── Router ────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const path = getPath(req);
  const method = req.method?.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    if (path === '/health' && method === 'GET')
      return json(res, { status: 'ok', name: 'Firstprint API', version: '0.1.0', ledgerEntries: ledger.length });
    if (path === '/fingerprint' && method === 'POST')
      return await handleFingerprint(req, res);
    if (path === '/compare' && method === 'POST')
      return await handleCompare(req, res);
    if (path === '/register' && method === 'POST')
      return await handleRegister(req, res);
    if (path === '/investigate' && method === 'POST')
      return await handleInvestigate(req, res);
    if (path.startsWith('/verify/') && method === 'GET')
      return await handleVerify(req, res);
    err(res, 'Not found', 404);
  } catch (e: any) {
    console.error('Request error:', e);
    err(res, e.message || 'Internal server error', 500);
  }
}

// ─── Boot ──────────────────────────────────────────────────────

async function main() {
  ledger = await Ledger.create();
  console.log('Ledger initialized:', ledger.getPublicKeyHex().slice(0, 16) + '...');

  createServer(handleRequest).listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         F I R S T P R I N T          ║
  ║   Search by logic, not by words.      ║
  ╠═══════════════════════════════════════╣
  ║  API: http://localhost:${PORT}            ║
  ╚═══════════════════════════════════════╝
    `);
  });
}

main().catch(console.error);
