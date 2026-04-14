/**
 * @firstprint/ledger — Types
 * 
 * Provenance ledger entries — the immutable chain
 * of structural fingerprint records.
 */

/** A single entry in the provenance ledger */
export interface LedgerEntry {
  /** Unique entry ID */
  id: string;
  /** Entry sequence number (monotonically increasing) */
  sequence: number;
  /** ISO timestamp of entry creation */
  timestamp: string;
  /** Version of the ledger format */
  version: string;

  /** The fingerprint hash being registered */
  fingerprintHash: string;
  /** Language of the fingerprinted artifact */
  language: string;
  /** Number of features in the fingerprint */
  featureCount: number;

  /** Per-layer hashes */
  layerHashes: {
    ast: string;
    controlFlow: string;
    dependency: string;
  };

  /** Merkle root of all layer hashes */
  merkleRoot: string;
  /** Hash of the previous ledger entry (chain link) */
  previousEntryHash: string;

  /** Ed25519 signature of this entry by the platform */
  platformSignature: string;
  /** Optional: Ed25519 signature by the registrant */
  registrantSignature?: string;
  /** Public key of the registrant (if signed) */
  registrantPublicKey?: string;

  /** Hash of this entire entry (for chain integrity) */
  entryHash: string;
}

/** Verification result for a ledger entry */
export interface VerificationResult {
  /** Is the entry's signature valid? */
  signatureValid: boolean;
  /** Does the entry hash match its contents? */
  integrityValid: boolean;
  /** Does the chain link match the previous entry? */
  chainValid: boolean;
  /** Overall validity */
  valid: boolean;
  /** Human-readable verification message */
  message: string;
}

/** Provenance certificate — the public-facing proof */
export interface ProvenanceCertificate {
  /** The ledger entry */
  entry: LedgerEntry;
  /** Chain of previous entries (for full provenance) */
  chain: LedgerEntry[];
  /** Verification status */
  verification: VerificationResult;
  /** Human-readable certificate text */
  certificateText: string;
}
