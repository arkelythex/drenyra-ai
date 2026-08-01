/**
 * Ledger domain types — the append-only audit chain and its manifest.
 *
 * Design basis: arkelythex/Drenyra `docs/audits/schemas/ledger-entry.schema.json`
 * and `ledger-manifest.schema.json`. The `LedgerManifest` extends the source
 * manifest with the `ledgerId` field required by the single-chain scope rule
 * (see contracts/ledger.md).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money, and `sequence` is always a JSON integer
 * (never a float and never a timestamp).
 */

export type EntryType =
  | "GENESIS"
  | "RECEIPT_RECORDED"
  | "ATTESTATION_ADDED"
  | "ENTRY_SUPERSEDED"
  | "ENTRY_REVOKED"
  | "CHECKPOINT_CREATED";

/** Sentinel `signerKeyId` marking an entry that carries no signer material. */
export const HASH_ONLY_SIGNER = "hash-only" as const;
export type HashOnlySignerId = typeof HASH_ONLY_SIGNER;

interface LedgerEntryFields {
  entryId: string;
  ledgerId: string;
  sequence: number;
  entryType: EntryType;
  previousEntryHash: string;
  payloadHash: string;
  receiptHash: string;
  occurredAt: string;
  recordedAt: string;
  actor: string;
  schemaVersion: string;
  signerKeyId: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
}

/**
 * Hash-only entry: no signature and no signer public key.
 * Per the schema conditional: when `signerKeyId === "hash-only"`,
 * `signature` and `signerPublicKey` are forbidden.
 */
export interface HashOnlyEntry extends LedgerEntryFields {
  signerKeyId: HashOnlySignerId;
  signature?: never;
  signerPublicKey?: never;
}

/**
 * Signed entry: carries both a signature and the signer public key.
 */
export interface SignedEntry extends LedgerEntryFields {
  signerKeyId: string;
  signature: string;
  signerPublicKey: string;
}

export type LedgerEntry = HashOnlyEntry | SignedEntry;

/**
 * Ledger manifest anchored by the GENESIS entry. `ledgerId` scopes the chain:
 * every entry MUST share it.
 */
export interface LedgerManifest {
  ledgerId: string;
  protocolVersion: string;
  hashAlgorithm: "SHA-256";
  trustRoot: { keyIds: string[] };
  jurisdiction: string;
  createdAt: string;
  signingPolicy: { required: boolean; algorithm: "Ed25519"; keyIds: string[] };
  manifest?: Record<string, unknown>;
}

/**
 * Result of walking a ledger chain. `reasons` collects every violation;
 * `firstDivergence` reports only the first (index + reason).
 */
export interface LedgerValidationResult {
  valid: boolean;
  firstDivergence?: { index: number; reason: string };
  reasons: string[];
}
