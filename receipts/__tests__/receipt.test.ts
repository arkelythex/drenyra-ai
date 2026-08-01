/**
 * Receipt unit tests — canonical hash determinism, integrity tamper detection,
 * signature validity, and the trusted key lifecycle.
 *
 * Ported from arkelythex/Drenyra `packages/mission-domain/src/__tests__/mission-receipt*.test.ts`
 * against the local, dependency-free port. Fiscal convention: money is BigInt
 * cents; no float is used for money anywhere in drenyra-ai.
 */

import { describe, expect, it } from "vitest";
import {
  ReceiptType,
  buildSignedReceipt,
  computeEvidenceHash,
  generateReceiptHash,
  generateReceiptKeyPair,
  signReceipt,
  verifyReceiptIntegrity,
  verifyReceiptSignature,
  verifySignedReceipt,
  verifySignedReceiptTrusted,
  type ReceiptContent,
  type SigningKeyInfo,
} from "../index.js";

const sampleReceipt: ReceiptContent = {
  missionId: "550e8400-e29b-41d4-a716-446655440000",
  companyId: "660e8400-e29b-41d4-a716-446655440001",
  actorId: "user-1",
  decision: "APPROVE",
  proposalVersion: 2,
  evidenceHash: "abc123def456",
  previousStatus: "AWAITING_APPROVAL",
  newStatus: "APPROVED",
  payloadHash: "payload-hash-xyz",
  timestamp: "2026-07-30T12:00:00.000Z",
};

describe("generateReceiptHash()", () => {
  it("produces a deterministic SHA-256 hex string (64 chars)", () => {
    const hash = generateReceiptHash(sampleReceipt);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hash for identical content", () => {
    const hash1 = generateReceiptHash(sampleReceipt);
    const hash2 = generateReceiptHash({ ...sampleReceipt });
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", () => {
    const hash1 = generateReceiptHash(sampleReceipt);
    const hash2 = generateReceiptHash({
      ...sampleReceipt,
      decision: "REJECT",
    });
    expect(hash1).not.toBe(hash2);
  });

  it("is field-order independent (canonical sort)", () => {
    // Create two objects with different key order but same content.
    const content1: Record<string, unknown> = {
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
    const content2: Record<string, unknown> = {
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
    const hash1 = generateReceiptHash(content1 as unknown as ReceiptContent);
    const hash2 = generateReceiptHash(content2 as unknown as ReceiptContent);
    expect(hash1).toBe(hash2);
  });

  it("changes the hash when any field changes", () => {
    const hash1 = generateReceiptHash(sampleReceipt);
    const modified = {
      ...sampleReceipt,
      proposalVersion: sampleReceipt.proposalVersion + 1,
    };
    const hash2 = generateReceiptHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("changes the hash when timestamp changes", () => {
    const hash1 = generateReceiptHash(sampleReceipt);
    const modified = {
      ...sampleReceipt,
      timestamp: "2026-07-30T12:00:01.000Z",
    };
    const hash2 = generateReceiptHash(modified);
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyReceiptIntegrity()", () => {
  it("returns true for a matching hash", () => {
    const hash = generateReceiptHash(sampleReceipt);
    expect(verifyReceiptIntegrity(sampleReceipt, hash)).toBe(true);
  });

  it("returns false for a mismatched hash (tampered content)", () => {
    const hash = generateReceiptHash(sampleReceipt);
    const tampered: ReceiptContent = {
      ...sampleReceipt,
      newStatus: "REJECTED",
    };
    expect(verifyReceiptIntegrity(tampered, hash)).toBe(false);
  });

  it("returns false for a completely different hash", () => {
    expect(
      verifyReceiptIntegrity(
        sampleReceipt,
        "0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).toBe(false);
  });

  it("uses timing-safe comparison (same length, different bytes)", () => {
    const hash = generateReceiptHash(sampleReceipt);
    expect(verifyReceiptIntegrity(sampleReceipt, hash)).toBe(true);
    const wrongHash =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(verifyReceiptIntegrity(sampleReceipt, wrongHash)).toBe(false);
  });
});

describe("computeEvidenceHash()", () => {
  it("produces a deterministic SHA-256 hex hash of an evidence array", () => {
    const evidence = [
      { id: "ev-1", label: "Bank reconciliation", type: "report" },
      { id: "ev-2", label: "Depreciation schedule", type: "document" },
    ];
    const hash = computeEvidenceHash(evidence);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hash for identical evidence", () => {
    const evidence1 = [
      { id: "ev-1", label: "Bank reconciliation", type: "report" },
    ];
    const evidence2 = [
      { id: "ev-1", label: "Bank reconciliation", type: "report" },
    ];
    expect(computeEvidenceHash(evidence1)).toBe(computeEvidenceHash(evidence2));
  });

  it("is order-independent (sorted by id)", () => {
    const evidence1 = [
      { id: "ev-2", label: "B", type: "x" },
      { id: "ev-1", label: "A", type: "y" },
    ];
    const evidence2 = [
      { id: "ev-1", label: "A", type: "y" },
      { id: "ev-2", label: "B", type: "x" },
    ];
    expect(computeEvidenceHash(evidence1)).toBe(computeEvidenceHash(evidence2));
  });

  it("produces different hashes for different evidence items", () => {
    const evidence1 = [{ id: "ev-1", label: "A", type: "x" }];
    const evidence2 = [{ id: "ev-1", label: "B", type: "x" }];
    expect(computeEvidenceHash(evidence1)).not.toBe(
      computeEvidenceHash(evidence2),
    );
  });

  it("handles an empty evidence array", () => {
    const hash = computeEvidenceHash([]);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Ed25519 receipt signing", () => {
  it("generates a key pair with a key ID", () => {
    const keyPair = generateReceiptKeyPair("key_test_001");
    expect(keyPair.publicKey).toBeTruthy();
    expect(keyPair.privateKey).toBeTruthy();
    expect(keyPair.keyId).toBe("key_test_001");
  });

  it("generates unique key IDs when not provided", () => {
    const kp1 = generateReceiptKeyPair();
    const kp2 = generateReceiptKeyPair();
    expect(kp1.keyId).not.toBe(kp2.keyId);
  });

  it("signs and verifies a receipt signature", () => {
    const keyPair = generateReceiptKeyPair();
    const { signature } = signReceipt(
      sampleReceipt,
      keyPair.privateKey,
      keyPair.keyId,
    );
    expect(signature).toBeTruthy();

    const valid = verifyReceiptSignature(
      sampleReceipt,
      signature,
      keyPair.publicKey,
    );
    expect(valid).toBe(true);
  });

  it("rejects a signature with the wrong key", () => {
    const keyPairA = generateReceiptKeyPair();
    const keyPairB = generateReceiptKeyPair();
    const { signature } = signReceipt(
      sampleReceipt,
      keyPairA.privateKey,
      keyPairA.keyId,
    );

    const valid = verifyReceiptSignature(
      sampleReceipt,
      signature,
      keyPairB.publicKey,
    );
    expect(valid).toBe(false);
  });

  it("rejects a signature over tampered content", () => {
    const keyPair = generateReceiptKeyPair();
    const { signature } = signReceipt(
      sampleReceipt,
      keyPair.privateKey,
      keyPair.keyId,
    );

    const tampered: ReceiptContent = {
      ...sampleReceipt,
      evidenceHash: "TAMPERED",
    };
    const valid = verifyReceiptSignature(
      tampered,
      signature,
      keyPair.publicKey,
    );
    expect(valid).toBe(false);
  });

  it("builds a complete signed receipt bundle", () => {
    const keyPair = generateReceiptKeyPair("key_prod_001");
    const receipt = buildSignedReceipt(sampleReceipt, keyPair);

    expect(receipt.protocolVersion).toBe("1.0");
    expect(receipt.receiptType).toBe(ReceiptType.APPROVAL);
    expect(receipt.algorithm).toBe("Ed25519");
    expect(receipt.receiptHash).toHaveLength(64);
    expect(receipt.signerKeyId).toBe("key_prod_001");
    expect(receipt.signerPublicKey).toBe(keyPair.publicKey);
    expect(receipt.signature).toBeTruthy();
    expect(receipt.issuedAt).toBeTruthy();
  });

  it("builds typed bundles without hashing receiptType metadata", () => {
    const keyPair = generateReceiptKeyPair();
    const receipt = buildSignedReceipt(
      sampleReceipt,
      keyPair,
      "1.0",
      ReceiptType.COMPLETION,
    );

    expect(receipt.receiptType).toBe(ReceiptType.COMPLETION);
    expect(receipt.algorithm).toBe("Ed25519");
    expect(receipt.receiptHash).toBe(generateReceiptHash(sampleReceipt));
  });

  it("returns a deterministic signature for the same content and key", () => {
    const keyPair = generateReceiptKeyPair();
    const sig1 = signReceipt(
      sampleReceipt,
      keyPair.privateKey,
      keyPair.keyId,
    );
    const sig2 = signReceipt(
      sampleReceipt,
      keyPair.privateKey,
      keyPair.keyId,
    );
    expect(sig1.signature).toBe(sig2.signature);
  });
});

describe("verifySignedReceipt()", () => {
  it("returns valid for an authentic receipt", () => {
    const keyPair = generateReceiptKeyPair();
    const receipt = buildSignedReceipt(sampleReceipt, keyPair);

    const result = verifySignedReceipt(receipt);
    expect(result.valid).toBe(true);
    expect(result.hashValid).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.keyId).toBe(keyPair.keyId);
  });

  it("detects a tampered hash", () => {
    const keyPair = generateReceiptKeyPair();
    const receipt = buildSignedReceipt(sampleReceipt, keyPair);
    // Tamper with content but keep signature.
    receipt.content = { ...sampleReceipt, actorId: "attacker" };

    const result = verifySignedReceipt(receipt);
    expect(result.hashValid).toBe(false);
    expect(result.signatureValid).toBe(false);
    expect(result.valid).toBe(false);
  });

  it("detects a wrong signer", () => {
    const keyPairA = generateReceiptKeyPair();
    const keyPairB = generateReceiptKeyPair();
    const receipt = buildSignedReceipt(sampleReceipt, keyPairA);
    // Replace the public key with a different signer's key.
    receipt.signerPublicKey = keyPairB.publicKey;

    const result = verifySignedReceipt(receipt);
    expect(result.hashValid).toBe(true);
    expect(result.signatureValid).toBe(false);
    expect(result.valid).toBe(false);
  });
});

describe("verifySignedReceiptTrusted() — key lifecycle", () => {
  const keyPair = generateReceiptKeyPair("key_trusted");
  const receipt = buildSignedReceipt(sampleReceipt, keyPair);
  const validKey: SigningKeyInfo = {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    issuedAt: "2020-01-01T00:00:00.000Z",
  };

  it("reports UNKNOWN_SIGNER when the resolver does not recognize the key", async () => {
    await expect(
      verifySignedReceiptTrusted(receipt, () => undefined),
    ).resolves.toMatchObject({
      status: "UNKNOWN_SIGNER",
      steps: {
        hashValid: true,
        signatureValid: true,
        signerRecognized: false,
      },
    });
  });

  it("reports PAYLOAD_TAMPERED when the content hash does not match", async () => {
    await expect(
      verifySignedReceiptTrusted(
        { ...receipt, content: { ...sampleReceipt, actorId: "tampered" } },
        () => validKey,
      ),
    ).resolves.toMatchObject({
      status: "PAYLOAD_TAMPERED",
      steps: { hashValid: false },
    });
  });

  it("reports CONTENT_VALID when the signature is invalid", async () => {
    await expect(
      verifySignedReceiptTrusted(
        { ...receipt, signature: "invalid" },
        () => validKey,
      ),
    ).resolves.toMatchObject({
      status: "CONTENT_VALID",
      steps: { hashValid: true, signatureValid: false },
    });
  });

  it("reports KEY_EXPIRED when the key has expired", async () => {
    await expect(
      verifySignedReceiptTrusted(receipt, () => ({
        ...validKey,
        expiresAt: "2021-01-01T00:00:00.000Z",
      })),
    ).resolves.toMatchObject({
      status: "KEY_EXPIRED",
      steps: { keyCurrent: false },
    });
  });

  it("reports KEY_REVOKED when the key is revoked", async () => {
    await expect(
      verifySignedReceiptTrusted(receipt, async () => ({
        ...validKey,
        revokedAt: "2021-01-01T00:00:00.000Z",
      })),
    ).resolves.toMatchObject({
      status: "KEY_REVOKED",
      steps: { keyCurrent: true, keyRevoked: true },
    });
  });

  it("reports SIGNER_TRUSTED on a full trusted pass", async () => {
    await expect(
      verifySignedReceiptTrusted(receipt, () => validKey),
    ).resolves.toMatchObject({
      status: "SIGNER_TRUSTED",
      steps: {
        hashValid: true,
        signatureValid: true,
        signerRecognized: true,
        keyCurrent: true,
        keyRevoked: false,
      },
    });
  });
});
