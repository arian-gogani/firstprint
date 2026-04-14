/**
 * @firstprint/api — REST API Server
 * 
 * Exposes the Firstprint engine over HTTP.
 * Built on Node's native http module — zero dependencies.
 * 
 * Endpoints:
 *   POST /fingerprint     — Submit code, get structural fingerprint
 *   POST /compare         — Compare two fingerprints
 *   POST /register        — Fingerprint + sign + ledger entry
 *   GET  /verify/:id      — Verify a ledger entry
 *   POST /investigate     — Full forensic: your code vs suspected clone
 *   GET  /health          — Health check
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { fingerprint, serializeFingerprint } from '@firstprint/core';
import type { Language } from '@firstprint/core';
import { compare } from '@firstprint/compare';
import { Ledger } from '@firstprint/ledger';

const PORT = parseInt(process.env.PORT || '3100', 10);

// ─── State ─────────────────────────────────────────────────────────────────

let ledger: Ledger;

// ─── Helpers ───────────────────────────────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  , 2));
}

function error(res: ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status);
}

function getPath(req: IncomingMessage): string {
  return new URL(req.url || '/', `http://localhost`).pathname;
}

// ─── Route Handlers ────────────────────────────────────────────────────────

/** POST /fingerprint — Generate a structural fingerprint */
async function handleFingerprint(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = JSON.parse(await readBody(req));
  const { source, language } = body as {
    source: string;
    language: Language;
  };

  if (!source || !language) {
    return error(res, 'Missing required fields: source, language');
  }

  const sourceFp = await fingerprint(sourceCode, language);
  const targetFp = await fingerprint(targetCode, language);
  const result = compare(sourceFp, targetFp);

  json(res, {
    comparison: result,
    sourceFingerprint: sourceFp.id,
    targetFingerprint: targetFp.id,
  });
}

/** POST /register — Fingerprint + register in ledger */
async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = JSON.parse(await readBody(req));
  const { source, language } = body as {
    source: string;
    language: Language;
  };

  if (!source || !language) {
    return error(res, 'Missing required fields: source, language');
  }

  const fp = await fingerprint(source, language);
  const entry = await ledger.register(fp);

  json(res, {
    fingerprint: fp,
    ledgerEntry: entry,
    message: `Registered. Birth certificate ID: ${entry.id}`,
  });
}

/** POST /investigate — Full forensic comparison */
async function handleInvestigate(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = JSON.parse(await readBody(req));
  const { originalCode, suspectedClone, language } = body as {
    originalCode: string;
    suspectedClone: string;
    language: Language;
  };

  if (!originalCode || !suspectedClone || !language) {
    return error(res, 'Missing: originalCode, suspectedClone, language');
  }

  // Fingerprint both
  const originalFp = await fingerprint(originalCode, language);
  const cloneFp = await fingerprint(suspectedClone, language);

  // Register the original (proves temporal precedence)
  const entry = await ledger.register(originalFp);

  // Compare
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

/** GET /verify/:id — Verify a ledger entry */
async function handleVerify(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const path = getPath(req);
  const id = path.split('/').pop();

  if (!id) return error(res, 'Missing entry ID');

  const entry = ledger.getEntry(id);
  if (!entry) return error(res, 'Entry not found', 404);

  const verification = await ledger.verify(entry);
  json(res, { entry, verification });
}

// ─── Router ────────────────────────────────────────────────────────────────

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const path = getPath(req);
  const method = req.method?.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    if (path === '/health' && method === 'GET') {
      return json(res, {
        status: 'ok',
        name: 'Firstprint API',
        version: '0.1.0',
        ledgerEntries: ledger.length,
      });
    }

    if (path === '/fingerprint' && method === 'POST') {
      return await handleFingerprint(req, res);
    }
    if (path === '/compare' && method === 'POST') {
      return await handleCompare(req, res);
    }
    if (path === '/register' && method === 'POST') {
      return await handleRegister(req, res);
    }
    if (path === '/investigate' && method === 'POST') {
      return await handleInvestigate(req, res);
    }
    if (path.startsWith('/verify/') && method === 'GET') {
      return await handleVerify(req, res);
    }

    error(res, 'Not found', 404);
  } catch (err: any) {
    console.error('Request error:', err);
    error(res, err.message || 'Internal server error', 500);
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Initializing Firstprint...');
  ledger = await Ledger.create();
  console.log('Ledger initialized. Platform key:', ledger.getPublicKeyHex().slice(0, 16) + '...');

  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         F I R S T P R I N T          ║
  ║  The birth certificate for everything ║
  ║           AI creates.                 ║
  ╠═══════════════════════════════════════╣
  ║  API running on http://localhost:${PORT} ║
  ╚═══════════════════════════════════════╝
    `);
  });
}

main().catch(console.error);
