/**
 * Receipt verification — SHA-256 integrity, Ed25519 authenticity, and the
 * trusted signer lifecycle surface.
 *
 * Ported verbatim from arkelythex/Drenyra `packages/mission-domain/src/mission-receipt.ts`.
 * The frozen conformance vectors (contracts/receipt-schema/fixtures) are the
 * source of truth for correctness. Fiscal convention: money is BigInt cents;
 * no float is used for money anywhere in drenyra-ai.
 */

import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify,
} from "node:crypto";
import { sortedStringify } from "./canonical.js";
import type {
  EvidenceItem,
  KeyTrustResolver,
  ReceiptContent,
  ReceiptVerificationStatus,
  ReceiptVerificationSteps,
  SignedReceipt,
} from "./types.js";

/**
 * Generate a SHA-256 receipt hash with canonical field ordering.
 */
export function generateReceiptHash(content: ReceiptContent): string {
  return createHash("sha256")
    .update(sortedStringify(content as unknown as Record<string, unknown>))
    .digest("hex");
}

/**
 * Verify that a receipt content matches its asserted hash.
 * Uses timing-safe comparison.
 */
export function verifyReceiptIntegrity(
  content: ReceiptContent,
  assertedHash: string,
): boolean {
  const computed = generateReceiptHash(content);
  const computedBuf = Buffer.from(computed, "hex");
  const assertedBuf = Buffer.from(assertedHash, "hex");

  if (computedBuf.length !== assertedBuf.length) {
    return false;
  }

  return timingSafeEqual(computedBuf, assertedBuf);
}

/**
 * Compute SHA-256 hash of evidence array, sorted by id.
 */
export function computeEvidenceHash(evidence: EvidenceItem[]): string {
  const sorted = [...evidence].sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

/**
 * Verify an Ed25519 signature over a receipt's canonical payload.
 * Returns false for any invalid input — this is intended behavior, not a
 * silent error.
 */
export function verifyReceiptSignature(
  content: ReceiptContent,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const canonicalPayload = sortedStringify(
      content as unknown as Record<string, unknown>,
    );
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    const signature = Buffer.from(signatureBase64, "base64");

    return verify(
      null,
      Buffer.from(canonicalPayload, "utf-8"),
      publicKey,
      signature,
    );
  } catch {
    return false;
  }
}

/**
 * Full verification of a signed receipt bundle:
 * 1. Content hash integrity
 * 2. Ed25519 signature authenticity
 */
export function verifySignedReceipt(receipt: SignedReceipt): {
  valid: boolean;
  hashValid: boolean;
  signatureValid: boolean;
  keyId: string;
  protocolVersion: string;
} {
  const hashValid = verifyReceiptIntegrity(
    receipt.content,
    receipt.receiptHash,
  );
  const signatureValid = verifyReceiptSignature(
    receipt.content,
    receipt.signature,
    receipt.signerPublicKey,
  );

  return {
    valid: hashValid && signatureValid,
    hashValid,
    signatureValid,
    keyId: receipt.signerKeyId,
    protocolVersion: receipt.protocolVersion,
  };
}

/**
 * Verifies receipt integrity, signature, and trusted signer lifecycle.
 * The embedded public key establishes portable signature validity; the
 * resolved key must match it before the signer can be trusted.
 */
export async function verifySignedReceiptTrusted(
  receipt: SignedReceipt,
  resolveKey: KeyTrustResolver,
): Promise<{
  status: ReceiptVerificationStatus;
  steps: ReceiptVerificationSteps;
}> {
  const hashValid = verifyReceiptIntegrity(receipt.content, receipt.receiptHash);
  if (!hashValid) {
    return trustResult("PAYLOAD_TAMPERED", false, false, false, false, false);
  }

  const signatureValid = verifyReceiptSignature(
    receipt.content,
    receipt.signature,
    receipt.signerPublicKey,
  );
  if (!signatureValid) {
    return trustResult("CONTENT_VALID", true, false, false, false, false);
  }

  const key = await resolveKey(receipt.signerKeyId);
  const signerRecognized =
    key !== undefined && key.publicKey === receipt.signerPublicKey;
  if (!signerRecognized || key === undefined) {
    return trustResult("UNKNOWN_SIGNER", true, true, false, false, false);
  }

  const now = Date.now();
  const keyCurrent =
    Date.parse(key.issuedAt) <= now &&
    (key.expiresAt === undefined || Date.parse(key.expiresAt) > now);
  if (!keyCurrent) {
    return trustResult("KEY_EXPIRED", true, true, true, false, false);
  }

  const keyRevoked =
    key.revokedAt !== undefined && Date.parse(key.revokedAt) <= now;
  if (keyRevoked) {
    return trustResult("KEY_REVOKED", true, true, true, true, true);
  }

  return trustResult("SIGNER_TRUSTED", true, true, true, true, false);
}

function trustResult(
  status: ReceiptVerificationStatus,
  hashValid: boolean,
  signatureValid: boolean,
  signerRecognized: boolean,
  keyCurrent: boolean,
  keyRevoked: boolean,
): { status: ReceiptVerificationStatus; steps: ReceiptVerificationSteps } {
  return {
    status,
    steps: { hashValid, signatureValid, signerRecognized, keyCurrent, keyRevoked },
  };
}
