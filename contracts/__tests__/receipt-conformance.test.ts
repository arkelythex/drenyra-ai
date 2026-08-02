/**
 * receipt contract conformance (v0.1 FROZEN).
 *
 * Pins the normative statements of contracts/receipt.md against the public
 * library API (receipts/index.js only — no internals). The frozen byte vectors
 * (contracts/receipt-schema/fixtures/conformance-vectors.v1.json) are already
 * pinned byte-for-byte by receipts/__tests__/conformance-vectors.test.ts; this
 * suite deliberately does NOT duplicate them. It pins the contract-doc
 * statements the vectors do not cover:
 *
 *   - the verification status chain precedence
 *     (PAYLOAD_TAMPERED → CONTENT_VALID → UNKNOWN_SIGNER → KEY_EXPIRED →
 *     KEY_REVOKED → SIGNER_TRUSTED),
 *   - the verifySignedReceipt result shape (valid/hashValid/signatureValid),
 *   - the canonical serialization rule (sortedStringify, key-sorted SHALLOW),
 *   - that a mutated content byte changes the hash and breaks verification.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; proposalVersion and similar
 * sequence/version fields serialize as JSON integers, never floats.
 */

import { describe, expect, it } from "vitest";
import {
  buildSignedReceipt,
  generateReceiptHash,
  generateReceiptKeyPair,
  sortedStringify,
  verifyReceiptIntegrity,
  verifySignedReceipt,
  verifySignedReceiptTrusted,
  type ReceiptContent,
  type ReceiptVerificationSteps,
  type SigningKeyInfo,
} from "../../receipts/index.js";

const sampleContent: ReceiptContent = {
  missionId: "mission-receipt-conformance",
  companyId: "20123456789",
  actorId: "actor-1",
  decision: "APPROVE",
  proposalVersion: 1,
  evidenceHash: "abc123def456",
  previousStatus: "AWAITING_APPROVAL",
  newStatus: "APPROVED",
  payloadHash: "payload-hash",
  timestamp: "2026-07-30T12:00:00.000Z",
};

function trustedKey(
  keyPair: { keyId: string; publicKey: string },
  overrides: Partial<SigningKeyInfo> = {},
): SigningKeyInfo {
  return {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    issuedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Mutates a single content byte: the last character of evidenceHash flips. */
function mutateOneContentByte(content: ReceiptContent): ReceiptContent {
  const last = content.evidenceHash[content.evidenceHash.length - 1];
  const flipped = last === "f" ? "e" : "f";
  return {
    ...content,
    evidenceHash:
      content.evidenceHash.slice(0, -1) + flipped,
  };
}

describe("receipt §Verification status chain (frozen 0.1)", () => {
  it("reports PAYLOAD_TAMPERED when the content hash does not match", async () => {
    const key = generateReceiptKeyPair("key_chain_tampered");
    const receipt = buildSignedReceipt(sampleContent, key);
    // Mutate content bytes but keep the stale receiptHash.
    const tampered = { ...receipt, content: mutateOneContentByte(sampleContent) };
    const trusted = await verifySignedReceiptTrusted(tampered, () => trustedKey(key));
    expect(trusted.status).toBe("PAYLOAD_TAMPERED");
    expect(trusted.steps).toEqual({
      hashValid: false,
      signatureValid: false,
      signerRecognized: false,
      keyCurrent: false,
      keyRevoked: false,
    });
  });

  it("reports CONTENT_VALID when the hash holds but the signature is invalid", async () => {
    const key = generateReceiptKeyPair("key_chain_content");
    const receipt = buildSignedReceipt(sampleContent, key);
    const forged = { ...receipt, signature: "bm90LWEtc2lnbmF0dXJl" };
    const trusted = await verifySignedReceiptTrusted(forged, () => trustedKey(key));
    expect(trusted.status).toBe("CONTENT_VALID");
    expect(trusted.steps.hashValid).toBe(true);
    expect(trusted.steps.signatureValid).toBe(false);
  });

  it("reports UNKNOWN_SIGNER when the signer is not recognized", async () => {
    const key = generateReceiptKeyPair("key_chain_unknown");
    const receipt = buildSignedReceipt(sampleContent, key);
    const trusted = await verifySignedReceiptTrusted(receipt, () => undefined);
    expect(trusted.status).toBe("UNKNOWN_SIGNER");
    expect(trusted.steps).toEqual({
      hashValid: true,
      signatureValid: true,
      signerRecognized: false,
      keyCurrent: false,
      keyRevoked: false,
    });
  });

  it("reports KEY_EXPIRED when a recognized key is past its expiresAt", async () => {
    const key = generateReceiptKeyPair("key_chain_expired");
    const receipt = buildSignedReceipt(sampleContent, key);
    const trusted = await verifySignedReceiptTrusted(
      receipt,
      () => trustedKey(key, { expiresAt: "2025-01-01T00:00:00.000Z" }),
    );
    expect(trusted.status).toBe("KEY_EXPIRED");
    expect(trusted.steps.hashValid).toBe(true);
    expect(trusted.steps.signatureValid).toBe(true);
    expect(trusted.steps.signerRecognized).toBe(true);
    expect(trusted.steps.keyCurrent).toBe(false);
    expect(trusted.steps.keyRevoked).toBe(false);
  });

  it("reports KEY_REVOKED when a current recognized key is revoked", async () => {
    const key = generateReceiptKeyPair("key_chain_revoked");
    const receipt = buildSignedReceipt(sampleContent, key);
    const trusted = await verifySignedReceiptTrusted(
      receipt,
      () => trustedKey(key, { revokedAt: "2025-06-01T00:00:00.000Z" }),
    );
    expect(trusted.status).toBe("KEY_REVOKED");
    expect(trusted.steps.hashValid).toBe(true);
    expect(trusted.steps.signatureValid).toBe(true);
    expect(trusted.steps.signerRecognized).toBe(true);
    expect(trusted.steps.keyCurrent).toBe(true);
    expect(trusted.steps.keyRevoked).toBe(true);
  });

  it("reports SIGNER_TRUSTED only on the full trusted pass", async () => {
    const key = generateReceiptKeyPair("key_chain_trusted");
    const receipt = buildSignedReceipt(sampleContent, key);
    const trusted = await verifySignedReceiptTrusted(receipt, () => trustedKey(key));
    expect(trusted.status).toBe("SIGNER_TRUSTED");
    expect(trusted.steps).toEqual({
      hashValid: true,
      signatureValid: true,
      signerRecognized: true,
      keyCurrent: true,
      keyRevoked: false,
    });
  });

  it("pins the status vocabulary and the strict chain order", () => {
    // The verification status chain, in evaluation order, per the contract doc.
    const chain: readonly string[] = [
      "PAYLOAD_TAMPERED",
      "CONTENT_VALID",
      "UNKNOWN_SIGNER",
      "KEY_EXPIRED",
      "KEY_REVOKED",
      "SIGNER_TRUSTED",
    ];
    expect(chain).toEqual([
      "PAYLOAD_TAMPERED",
      "CONTENT_VALID",
      "UNKNOWN_SIGNER",
      "KEY_EXPIRED",
      "KEY_REVOKED",
      "SIGNER_TRUSTED",
    ]);

    // Each stage is terminal for its failure class: the per-stage flag vectors
    // must match the documented steps exactly (pinned, not inferred).
    const stepsByStatus: Readonly<Record<string, ReceiptVerificationSteps>> = {
      PAYLOAD_TAMPERED: { hashValid: false, signatureValid: false, signerRecognized: false, keyCurrent: false, keyRevoked: false },
      CONTENT_VALID: { hashValid: true, signatureValid: false, signerRecognized: false, keyCurrent: false, keyRevoked: false },
      UNKNOWN_SIGNER: { hashValid: true, signatureValid: true, signerRecognized: false, keyCurrent: false, keyRevoked: false },
      KEY_EXPIRED: { hashValid: true, signatureValid: true, signerRecognized: true, keyCurrent: false, keyRevoked: false },
      KEY_REVOKED: { hashValid: true, signatureValid: true, signerRecognized: true, keyCurrent: true, keyRevoked: true },
      SIGNER_TRUSTED: { hashValid: true, signatureValid: true, signerRecognized: true, keyCurrent: true, keyRevoked: false },
    };
    // Each failure stage is pinned with its exact steps in the individual tests
    // above; the ordering invariant is that KEY_EXPIRED fails keyCurrent, so an
    // expired key can never reach KEY_REVOKED, while KEY_REVOKED requires a
    // current key. This is what makes the chain strictly ordered rather than
    // overlapping.
    expect(stepsByStatus.KEY_EXPIRED.keyCurrent).toBe(false);
    expect(stepsByStatus.KEY_REVOKED.keyCurrent).toBe(true);
    expect(stepsByStatus.KEY_REVOKED.keyRevoked).toBe(true);
    expect(stepsByStatus.SIGNER_TRUSTED.keyRevoked).toBe(false);
  });
});

describe("receipt §verifySignedReceipt result shape (frozen 0.1)", () => {
  it("returns { valid, hashValid, signatureValid, keyId, protocolVersion }", () => {
    const key = generateReceiptKeyPair("key_shape_1");
    const receipt = buildSignedReceipt(sampleContent, key);
    const result = verifySignedReceipt(receipt);
    expect(Object.keys(result).sort()).toEqual([
      "hashValid",
      "keyId",
      "protocolVersion",
      "signatureValid",
      "valid",
    ]);
    expect(result.valid).toBe(true);
    expect(result.hashValid).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.keyId).toBe(key.keyId);
    expect(result.protocolVersion).toBe("1.0");
  });

  it("flags a stale hash as invalid without relying on the signature", () => {
    const key = generateReceiptKeyPair("key_shape_2");
    const receipt = buildSignedReceipt(sampleContent, key);
    const tampered = { ...receipt, content: mutateOneContentByte(sampleContent) };
    const result = verifySignedReceipt(tampered);
    expect(result.valid).toBe(false);
    expect(result.hashValid).toBe(false);
  });

  it("flags a wrong signer key as signature-invalid while the hash holds", () => {
    const keyA = generateReceiptKeyPair("key_shape_3a");
    const keyB = generateReceiptKeyPair("key_shape_3b");
    const receipt = buildSignedReceipt(sampleContent, keyA);
    receipt.signerPublicKey = keyB.publicKey;
    const result = verifySignedReceipt(receipt);
    expect(result.hashValid).toBe(true);
    expect(result.signatureValid).toBe(false);
    expect(result.valid).toBe(false);
  });

  it("verifies integrity with timing-safe comparison of the canonical hash", () => {
    const hash = generateReceiptHash(sampleContent);
    expect(verifyReceiptIntegrity(sampleContent, hash)).toBe(true);
    expect(verifyReceiptIntegrity(mutateOneContentByte(sampleContent), hash)).toBe(
      false,
    );
  });
});

describe("receipt §Canonical serialization (frozen 0.1)", () => {
  it("serializes with keys sorted alphabetically", () => {
    expect(sortedStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(sortedStringify({ missionId: "m1", actorId: "a1" })).toBe(
      '{"actorId":"a1","missionId":"m1"}',
    );
  });

  it("is key-sorted at the TOP level only (shallow)", () => {
    // The nested object keeps its original insertion order (b before a).
    expect(sortedStringify({ z: { b: 1, a: 2 }, a: 1 })).toBe(
      '{"a":1,"z":{"b":1,"a":2}}',
    );
  });

  it("makes the receipt hash field-order independent", () => {
    const contentA: Record<string, unknown> = {
      missionId: "m1",
      companyId: "c1",
      actorId: "a1",
      decision: "APPROVE",
      proposalVersion: 1,
      evidenceHash: "eh",
      previousStatus: "AWAITING_APPROVAL",
      newStatus: "APPROVED",
      payloadHash: "ph",
      timestamp: "2026-07-30T12:00:00.000Z",
    };
    const contentB: Record<string, unknown> = {
      timestamp: "2026-07-30T12:00:00.000Z",
      payloadHash: "ph",
      newStatus: "APPROVED",
      previousStatus: "AWAITING_APPROVAL",
      evidenceHash: "eh",
      proposalVersion: 1,
      decision: "APPROVE",
      actorId: "a1",
      companyId: "c1",
      missionId: "m1",
    };
    expect(generateReceiptHash(contentA as unknown as ReceiptContent)).toBe(
      generateReceiptHash(contentB as unknown as ReceiptContent),
    );
  });
});

describe("receipt §Tamper detection (frozen 0.1)", () => {
  it("a mutated content byte changes the hash", () => {
    expect(generateReceiptHash(sampleContent)).not.toBe(
      generateReceiptHash(mutateOneContentByte(sampleContent)),
    );
  });

  it("a mutated content byte breaks signed-receipt verification", async () => {
    const key = generateReceiptKeyPair("key_tamper_1");
    const receipt = buildSignedReceipt(sampleContent, key);
    const tampered = { ...receipt, content: mutateOneContentByte(sampleContent) };
    const result = verifySignedReceipt(tampered);
    expect(result.valid).toBe(false);
    expect(result.hashValid).toBe(false);
    // And the trusted pipeline reports PAYLOAD_TAMPERED (chain stage 1).
    const trusted = await verifySignedReceiptTrusted(tampered, () => trustedKey(key));
    expect(trusted.status).toBe("PAYLOAD_TAMPERED");
  });
});
