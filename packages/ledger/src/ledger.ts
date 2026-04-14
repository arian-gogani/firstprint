/**
 * @firstprint/ledger — Provenance Ledger
 * 
 * Append-only cryptographic ledger for structural fingerprints.
 * Each entry is signed, timestamped, and chained to the previous.
 * 
 * This is the "birth certificate" — the immutable proof
 * that a structural configuration existed at a specific time.
 */

import { randomUUID } from 'crypto';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { sha256 as sha256Hash } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256, merkleRoot } from '../../core/src/hash.js';
import type { StructuralFingerprint } from '../../core/src/types.js';
import type { LedgerEntry, VerificationResult } from './types.js';

// Configure ed25519 to use sha512
ed.etc.sha512Sync = (...m) => sha512(
  ed.etc.concatBytes(...m)
);

const LEDGER_VERSION = '0.1.0';


/**
 * Platform key pair for signing ledger entries.
 * In production, this would be stored in a secure HSM.
 * For now, generate deterministically for development.
 */
export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/** Generate a new Ed25519 key pair */
export async function generateKeyPair(): Promise<KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { privateKey, publicKey };
}

/**
 * The Ledger — an append-only chain of fingerprint records.
 */
export class Ledger {
  private entries: LedgerEntry[] = [];
  private platformKeyPair: KeyPair;

  constructor(keyPair: KeyPair) {
    this.platformKeyPair = keyPair;
  }

  /** Create a new Ledger with a fresh key pair */
  static async create(): Promise<Ledger> {
    const keyPair = await generateKeyPair();
    return new Ledger(keyPair);
  }

  /**
   * Register a fingerprint in the ledger.
   * Creates a signed, timestamped, chained entry.
   * This is the "birth certificate" operation.
   */
  async register(
    fingerprint: StructuralFingerprint
  ): Promise<LedgerEntry> {
    const sequence = this.entries.length;
    const previousEntryHash = sequence > 0
      ? this.entries[sequence - 1].entryHash
      : sha256('GENESIS');

    // Build layer hashes
    const layerHashes = {
      ast: sha256(JSON.stringify(fingerprint.astMinHash)),
      controlFlow: sha256(fingerprint.controlFlowSimHash.toString()),
      dependency: fingerprint.dependencyHash,
    };

    const root = merkleRoot([
      layerHashes.ast,
      layerHashes.controlFlow,
      layerHashes.dependency,
    ]);

    // Build the entry (without signatures and final hash)
    const entryData = {
      id: randomUUID(),
      sequence,
      timestamp: new Date().toISOString(),
      version: LEDGER_VERSION,
      fingerprintHash: fingerprint.fingerprintHash,
      language: fingerprint.language,
      featureCount: fingerprint.featureCount,
      layerHashes,
      merkleRoot: root,
      previousEntryHash,
    };

    // Sign the entry
    const dataToSign = sha256(JSON.stringify(entryData));
    const signature = await ed.signAsync(
      hexToBytes(dataToSign),
      this.platformKeyPair.privateKey
    );
    const platformSignature = bytesToHex(signature);

    // Compute final entry hash (includes signature)
    const entryHash = sha256(
      JSON.stringify(entryData) + platformSignature
    );

    const entry: LedgerEntry = {
      ...entryData,
      platformSignature,
      entryHash,
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Verify a ledger entry's integrity and signature.
   */
  async verify(entry: LedgerEntry): Promise<VerificationResult> {
    // 1. Verify entry hash integrity
    const { entryHash, platformSignature, registrantSignature, registrantPublicKey, ...entryData } = entry;
    const expectedHash = sha256(
      JSON.stringify(entryData) + platformSignature
    );
    const integrityValid = expectedHash === entryHash;

    // 2. Verify platform signature
    const dataToVerify = sha256(JSON.stringify(entryData));
    let signatureValid = false;
    try {
      signatureValid = await ed.verifyAsync(
        hexToBytes(platformSignature),
        hexToBytes(dataToVerify),
        this.platformKeyPair.publicKey
      );
    } catch {
      signatureValid = false;
    }

    // 3. Verify chain integrity
    let chainValid = true;
    if (entry.sequence === 0) {
      chainValid = entry.previousEntryHash === sha256('GENESIS');
    } else if (entry.sequence <= this.entries.length) {
      const prevEntry = this.entries[entry.sequence - 1];
      if (prevEntry) {
        chainValid = entry.previousEntryHash === prevEntry.entryHash;
      }
    }

    const valid = integrityValid && signatureValid && chainValid;

    return {
      signatureValid,
      integrityValid,
      chainValid,
      valid,
      message: valid
        ? `Entry ${entry.id} is valid. Fingerprint registered at ${entry.timestamp}.`
        : `Entry ${entry.id} FAILED verification: ${
            !integrityValid ? 'integrity compromised' :
            !signatureValid ? 'invalid signature' :
            'broken chain link'
          }.`,
    };
  }

  /**
   * Verify the entire chain integrity.
   */
  async verifyChain(): Promise<VerificationResult> {
    for (let i = 0; i < this.entries.length; i++) {
      const result = await this.verify(this.entries[i]);
      if (!result.valid) {
        return {
          ...result,
          message: `Chain broken at entry ${i}: ${result.message}`,
        };
      }
    }

    return {
      signatureValid: true,
      integrityValid: true,
      chainValid: true,
      valid: true,
      message: `Ledger chain valid. ${this.entries.length} entries verified.`,
    };
  }

  /** Get an entry by ID */
  getEntry(id: string): LedgerEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  /** Get an entry by sequence number */
  getEntryBySequence(seq: number): LedgerEntry | undefined {
    return this.entries[seq];
  }

  /** Get the latest entry */
  getLatest(): LedgerEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  /** Get the full chain */
  getChain(): LedgerEntry[] {
    return [...this.entries];
  }

  /** Get the chain length */
  get length(): number {
    return this.entries.length;
  }

  /** Get the platform public key (for external verification) */
  getPublicKey(): Uint8Array {
    return this.platformKeyPair.publicKey;
  }

  /** Export the public key as hex string */
  getPublicKeyHex(): string {
    return bytesToHex(this.platformKeyPair.publicKey);
  }
}
