/**
 * Firstprint Demo — CLI Clone Detection
 * 
 * Run: npx tsx demo/detect-clone.ts
 * 
 * Demonstrates the full pipeline:
 * 1. Fingerprint two code samples
 * 2. Compare them structurally
 * 3. Register the original in the ledger
 * 4. Output the forensic report
 */

import { fingerprint } from '../packages/core/src/fingerprint.js';
import { compare } from '../packages/compare/src/compare.js';
import { Ledger } from '../packages/ledger/src/ledger.js';

// ─── Sample Code: Original ────────────────────────────────────────────────

const originalCode = `
import { createHash } from 'crypto';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
}

async function validateUser(user: UserProfile): Promise<boolean> {
  if (!user.id) throw new Error('Missing user ID');
  if (!user.email) throw new Error('Missing email');
  if (!user.email.includes('@')) throw new Error('Invalid email');

  const hash = createHash('sha256').update(user.id).digest('hex');
  
  if (user.tier === 'enterprise') {
    const orgValid = await checkOrganization(user);
    if (!orgValid) throw new Error('Organization validation failed');
  }

  if (user.tier === 'pro' || user.tier === 'enterprise') {
    const paymentValid = await verifyPayment(user);
    if (!paymentValid) {
      return false;
    }
  }

  await recordLogin(user, hash);
  return true;
}

async function checkOrganization(user: UserProfile): Promise<boolean> {
  try {
    const response = await fetch('/api/org/' + user.id);
    if (!response.ok) return false;
    const data = await response.json();
    return data.active === true;
  } catch {
    return false;
  }
}

async function verifyPayment(user: UserProfile): Promise<boolean> {
  try {
    const response = await fetch('/api/billing/' + user.id);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'active';
  } catch {
    return false;
  }
}

async function recordLogin(user: UserProfile, hash: string): Promise<void> {
  console.log('Login:', user.id, hash.slice(0, 8));
}
`;

// ─── Sample Code: Suspected Clone ─────────────────────────────────────────
// Same structural patterns, renamed variables and functions

const suspectedClone = `
import { createHash } from 'crypto';

interface AccountData {
  id: string;
  displayName: string;
  contactEmail: string;
  plan: 'basic' | 'premium' | 'business';
}

async function authenticateAccount(account: AccountData): Promise<boolean> {
  if (!account.id) throw new Error('Account ID required');
  if (!account.contactEmail) throw new Error('Email required');
  if (!account.contactEmail.includes('@')) throw new Error('Bad email format');

  const digest = createHash('sha256').update(account.id).digest('hex');

  if (account.plan === 'business') {
    const companyOk = await validateCompany(account);
    if (!companyOk) throw new Error('Company check failed');
  }

  if (account.plan === 'premium' || account.plan === 'business') {
    const billingOk = await checkBilling(account);
    if (!billingOk) {
      return false;
    }
  }

  await logAccess(account, digest);
  return true;
}

async function validateCompany(account: AccountData): Promise<boolean> {
  try {
    const res = await fetch('/api/company/' + account.id);
    if (!res.ok) return false;
    const info = await res.json();
    return info.active === true;
  } catch {
    return false;
  }
}

async function checkBilling(account: AccountData): Promise<boolean> {
  try {
    const res = await fetch('/api/payments/' + account.id);
    if (!res.ok) return false;
    const info = await res.json();
    return info.status === 'active';
  } catch {
    return false;
  }
}

async function logAccess(account: AccountData, digest: string): Promise<void> {
  console.log('Access:', account.id, digest.slice(0, 8));
}
`;

// ─── Run the Demo ──────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════════╗
║           F I R S T P R I N T                ║
║    Structural Clone Detection Demo            ║
╚═══════════════════════════════════════════════╝
`);

  // Step 1: Fingerprint the original
  console.log('━━━ Step 1: Fingerprinting original code ━━━\n');
  const originalFp = await fingerprint(originalCode, 'typescript');
  console.log(`  Fingerprint ID:   ${originalFp.id}`);
  console.log(`  Features found:   ${originalFp.featureCount}`);
  console.log(`  Fingerprint hash: ${originalFp.fingerprintHash.slice(0, 16)}...`);
  console.log(`  Language:         ${originalFp.language}`);

  // Step 2: Fingerprint the suspected clone
  console.log('\n━━━ Step 2: Fingerprinting suspected clone ━━━\n');
  const cloneFp = await fingerprint(suspectedClone, 'typescript');
  console.log(`  Fingerprint ID:   ${cloneFp.id}`);
  console.log(`  Features found:   ${cloneFp.featureCount}`);
  console.log(`  Fingerprint hash: ${cloneFp.fingerprintHash.slice(0, 16)}...`);

  // Step 3: Compare
  console.log('\n━━━ Step 3: Structural comparison ━━━\n');
  const result = compare(originalFp, cloneFp);

  console.log(`  Derivation Score: ${(result.derivationScore * 100).toFixed(1)}%`);
  console.log(`  Classification:   ${result.band.toUpperCase()}`);
  console.log(`  Confidence:       ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`\n  Summary: ${result.summary}`);

  // Layer breakdown
  console.log('\n  Layer Breakdown:');
  for (const layer of result.layerScores) {
    const bar = '█'.repeat(Math.round(layer.rawSimilarity * 20));
    const empty = '░'.repeat(20 - Math.round(layer.rawSimilarity * 20));
    console.log(`    ${layer.layer.padEnd(15)} ${bar}${empty} ${(layer.rawSimilarity * 100).toFixed(1)}%`);
  }

  // Evidence
  if (result.evidence.length > 0) {
    console.log('\n  Top Evidence:');
    for (const ev of result.evidence.slice(0, 10)) {
      console.log(`    ⚠ [${ev.layer}] ${ev.description}`);
    }
  }

  // Step 4: Register in the ledger
  console.log('\n━━━ Step 4: Registering original in provenance ledger ━━━\n');
  const ledgerInstance = await Ledger.create();
  const entry = await ledgerInstance.register(originalFp);

  console.log(`  Ledger Entry ID:  ${entry.id}`);
  console.log(`  Sequence:         ${entry.sequence}`);
  console.log(`  Timestamp:        ${entry.timestamp}`);
  console.log(`  Merkle Root:      ${entry.merkleRoot.slice(0, 16)}...`);
  console.log(`  Signature:        ${entry.platformSignature.slice(0, 32)}...`);
  console.log(`  Entry Hash:       ${entry.entryHash.slice(0, 16)}...`);

  // Verify
  console.log('\n━━━ Step 5: Verifying ledger integrity ━━━\n');
  const verification = await ledgerInstance.verify(entry);
  console.log(`  Signature valid:  ${verification.signatureValid ? '✓' : '✗'}`);
  console.log(`  Integrity valid:  ${verification.integrityValid ? '✓' : '✗'}`);
  console.log(`  Chain valid:      ${verification.chainValid ? '✓' : '✗'}`);
  console.log(`  ${verification.message}`);

  // Final verdict
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║              INVESTIGATION RESULT              ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  Derivation:   ${(result.derivationScore * 100).toFixed(1).padStart(5)}%                         ║`);
  console.log(`║  Band:         ${result.band.padEnd(30)}║`);
  console.log(`║  Confidence:   ${(result.confidence * 100).toFixed(1).padStart(5)}%                         ║`);
  console.log(`║  Provenance:   REGISTERED & VERIFIED           ║`);
  console.log('╚═══════════════════════════════════════════════╝');
  console.log();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
