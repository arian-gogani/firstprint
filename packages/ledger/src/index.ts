/**
 * @firstprint/ledger
 * 
 * Cryptographic provenance ledger.
 * Tamper-proof birth certificates for structural fingerprints.
 */

export { Ledger, generateKeyPair } from './ledger.js';
export type { KeyPair } from './ledger.js';
export type {
  LedgerEntry,
  VerificationResult,
  ProvenanceCertificate,
} from './types.js';
