/**
 * Receipt domain types — the canonical payload, the signed bundle, and the
 * trusted-key vocabulary.
 *
 * Ported verbatim from arkelythex/drenyra-command-center `packages/mission-domain/src/mission-receipt.ts`
 * (types) and `packages/mission-domain/src/mission-contracts.ts` (EvidenceItem).
 * The `ReceiptType` union replaces the `@drenyra/mission-protocol` enum with the
 * exact same literal values so this package has ZERO workspace dependencies.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai, and `proposalVersion` always
 * serializes as a JSON integer (never a float).
 */

/** Receipt kind metadata — never enters the canonical content hash. */
export const ReceiptType = {
  APPROVAL: "APPROVAL",
  EXECUTION: "EXECUTION",
  COMPLETION: "COMPLETION",
  EXTERNAL_SUBMISSION: "EXTERNAL_SUBMISSION",
} as const;

export type ReceiptType = (typeof ReceiptType)[keyof typeof ReceiptType];

/**
 * Content that goes into a receipt hash.
 */
export interface ReceiptContent {
  missionId: string;
  companyId: string;
  actorId: string;
  decision: "APPROVE" | "REJECT";
  proposalVersion: number;
  evidenceHash: string;
  previousStatus: string;
  newStatus: string;
  payloadHash: string;
  timestamp: string;
}

/**
 * Evidence item used in computeEvidenceHash.
 */
export interface EvidenceItem {
  id: string;
  label: string;
  type: string;
}

/**
 * Ed25519 key pair for receipt signing.
 */
export interface ReceiptKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
}

/**
 * Complete signed receipt bundle — the portable, self-verifying artifact.
 */
export interface SignedReceipt {
  protocolVersion: string;
  receiptType: ReceiptType;
  algorithm: "Ed25519";
  content: ReceiptContent;
  receiptHash: string;
  signerKeyId: string;
  signerPublicKey: string;
  signature: string;
  issuedAt: string;
}

/** The furthest verification stage reached for a signed receipt. */
export type ReceiptVerificationStatus =
  | "CONTENT_VALID"
  | "SIGNATURE_VALID"
  | "SIGNER_TRUSTED"
  | "KEY_EXPIRED"
  | "KEY_REVOKED"
  | "UNKNOWN_SIGNER"
  | "PAYLOAD_TAMPERED";

/** A trusted signing key and its lifecycle metadata. */
export interface SigningKeyInfo {
  keyId: string;
  publicKey: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

/** Resolves trusted signer metadata by stable key ID. */
export type KeyTrustResolver = (
  keyId: string,
) => Promise<SigningKeyInfo | undefined> | SigningKeyInfo | undefined;

/** Individual results for every receipt verification stage. */
export interface ReceiptVerificationSteps {
  hashValid: boolean;
  signatureValid: boolean;
  signerRecognized: boolean;
  keyCurrent: boolean;
  keyRevoked: boolean;
}
