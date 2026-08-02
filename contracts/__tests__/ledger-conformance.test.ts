/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 *
 * ledger contract conformance (v0.1 FROZEN).
 *
 * Pins the normative surface of contracts/ledger.md against the public library
 * API (ledger/index.js — validate.js + types.js only, no internals). Every
 * assertion here is a contract statement: all 9 validation rules with a
 * positive and a negative case, the LedgerValidationResult shape (`valid` /
 * `firstDivergence` at the lowest failing index / `reasons` collecting every
 * violation in chain order), the manifest shape, and the append-only guarantee
 * that the validator walks the chain once without repairing or rewriting. If
 * the implementation drifts, this suite fails in CI and the change requires a
 * major version bump (see the contract's "Freeze record").
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GENESIS_EMPTY_HASH,
  HASH_ONLY_SIGNER,
  validateLedger,
  type HashOnlyEntry,
  type LedgerEntry,
  type LedgerManifest,
  type SignedEntry,
} from "../../ledger/index.js";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const HEX64 = /^[0-9a-f]{64}$/;

/** The canonical SHA-256 of the empty string — the frozen GENESIS link target. */
const EMPTY_STRING_HASH = sha256Hex("");

function makeManifest(): LedgerManifest {
  return {
    ledgerId: "ledger_conformance_001",
    protocolVersion: "1.0",
    hashAlgorithm: "SHA-256",
    trustRoot: { keyIds: ["key_audit_001"] },
    jurisdiction: "PE",
    createdAt: "2026-01-01T00:00:00.000Z",
    signingPolicy: {
      required: true,
      algorithm: "Ed25519",
      keyIds: ["key_audit_001"],
    },
  };
}

/**
 * A valid 4-entry chain: GENESIS (hash-only), RECEIPT_RECORDED (signed),
 * ATTESTATION_ADDED (signed), CHECKPOINT_CREATED (hash-only). Every link and
 * hash is correct, so the chain passes all 9 rules unchanged.
 */
function makeChain(): { manifest: LedgerManifest; entries: LedgerEntry[] } {
  const manifest = makeManifest();
  const genesisPayload = sha256Hex("genesis-payload-v1");
  const receiptPayload = sha256Hex("receipt-recorded-payload-v1");
  const attestationPayload = sha256Hex("attestation-added-payload-v1");
  const checkpointPayload = sha256Hex("checkpoint-created-payload-v1");

  const genesis: HashOnlyEntry = {
    entryId: "11111111-1111-4111-8111-111111111111",
    ledgerId: manifest.ledgerId,
    sequence: 1,
    entryType: "GENESIS",
    previousEntryHash: GENESIS_EMPTY_HASH,
    payloadHash: genesisPayload,
    receiptHash: GENESIS_EMPTY_HASH,
    occurredAt: "2026-01-01T00:00:00.000Z",
    recordedAt: "2026-01-01T00:00:00.000Z",
    actor: "system",
    schemaVersion: "1.0",
    signerKeyId: HASH_ONLY_SIGNER,
  };

  const recorded: SignedEntry = {
    entryId: "22222222-2222-4222-8222-222222222222",
    ledgerId: manifest.ledgerId,
    sequence: 2,
    entryType: "RECEIPT_RECORDED",
    previousEntryHash: genesisPayload,
    payloadHash: receiptPayload,
    receiptHash: sha256Hex("receipt-bundle-v1"),
    occurredAt: "2026-01-02T00:00:00.000Z",
    recordedAt: "2026-01-02T00:00:00.000Z",
    actor: "user_456",
    schemaVersion: "1.0",
    signerKeyId: "key_audit_001",
    signature: "c2lnbmF0dXJlLWxlZGdlci1jb25mb3JtYW5jZQ==",
    signerPublicKey: "MCowBQYDK2VwAyEApchx2rhjdQOzCK7+pSUpFamiAp1/7rWz2uuk3KI8B2o=",
  };

  const attested: SignedEntry = {
    entryId: "33333333-3333-4333-8333-333333333333",
    ledgerId: manifest.ledgerId,
    sequence: 3,
    entryType: "ATTESTATION_ADDED",
    previousEntryHash: receiptPayload,
    payloadHash: attestationPayload,
    receiptHash: sha256Hex("attestation-bundle-v1"),
    occurredAt: "2026-01-03T00:00:00.000Z",
    recordedAt: "2026-01-03T00:00:00.000Z",
    actor: "auditor_789",
    schemaVersion: "1.0",
    signerKeyId: "key_audit_001",
    signature: "c2lnbmF0dXJlLWxlZGdlci1jb25mb3JtYW5jZS1hdHRlc3Q=",
    signerPublicKey: "MCowBQYDK2VwAyEApchx2rhjdQOzCK7+pSUpFamiAp1/7rWz2uuk3KI8B2o=",
  };

  const checkpoint: HashOnlyEntry = {
    entryId: "44444444-4444-4444-8444-444444444444",
    ledgerId: manifest.ledgerId,
    sequence: 4,
    entryType: "CHECKPOINT_CREATED",
    previousEntryHash: attestationPayload,
    payloadHash: checkpointPayload,
    receiptHash: sha256Hex("checkpoint-bundle-v1"),
    occurredAt: "2026-01-04T00:00:00.000Z",
    recordedAt: "2026-01-04T00:00:00.000Z",
    actor: "system",
    schemaVersion: "1.0",
    signerKeyId: HASH_ONLY_SIGNER,
  };

  return { manifest, entries: [genesis, recorded, attested, checkpoint] };
}

describe("ledger §Manifest (frozen 0.1)", () => {
  it("pins the manifest shape per the contract doc", () => {
    const { manifest } = makeChain();
    expect(manifest.ledgerId).toBe("ledger_conformance_001");
    expect(manifest.protocolVersion).toBe("1.0");
    expect(manifest.hashAlgorithm).toBe("SHA-256");
    expect(manifest.trustRoot).toEqual({ keyIds: ["key_audit_001"] });
    expect(manifest.jurisdiction).toBe("PE");
    expect(manifest.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(manifest.signingPolicy).toEqual({
      required: true,
      algorithm: "Ed25519",
      keyIds: ["key_audit_001"],
    });
  });
});

describe("ledger §Validation result shape (frozen 0.1)", () => {
  it("returns { valid, firstDivergence, reasons } and is deterministic", () => {
    const { manifest, entries } = makeChain();
    const first = validateLedger(manifest, entries);
    const second = validateLedger(manifest, entries);
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
    expect(first.firstDivergence).toBeUndefined();
    expect(first.reasons).toEqual([]);
  });

  it("points firstDivergence at the LOWEST failing index and collects every violation in chain order", () => {
    const { manifest, entries } = makeChain();
    // Break continuity at index 1 and schemaVersion at index 3: two violations.
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...entries[1], previousEntryHash: "a".repeat(64) };
    tampered[3] = { ...entries[3], schemaVersion: "1.1" };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence).toEqual({
      index: 1,
      reason: expect.stringContaining("previousEntryHash"),
    });
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain("entry[1]:");
    expect(result.reasons[0]).toContain("previousEntryHash");
    expect(result.reasons[1]).toContain("entry[3]:");
    expect(result.reasons[1]).toContain("schemaVersion");
  });

  it("pins the GENESIS link constant to the canonical sha256(\"\") hash", () => {
    expect(GENESIS_EMPTY_HASH).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(GENESIS_EMPTY_HASH).toBe(EMPTY_STRING_HASH);
  });
});

describe("ledger §Rule 1 — non-empty chain (frozen 0.1)", () => {
  it("accepts a non-empty chain (positive)", () => {
    const { manifest, entries } = makeChain();
    expect(validateLedger(manifest, entries).valid).toBe(true);
    // A single GENESIS entry is still a valid non-empty chain.
    expect(validateLedger(manifest, [entries[0]]).valid).toBe(true);
  });

  it("rejects an empty chain with firstDivergence at index -1 (negative)", () => {
    const { manifest } = makeChain();
    const result = validateLedger(manifest, []);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence).toEqual({ index: -1, reason: "chain is empty" });
    expect(result.reasons).toEqual(["chain is empty"]);
  });
});

describe("ledger §Rule 2 — GENESIS anchoring (frozen 0.1)", () => {
  it("anchors the first entry as GENESIS at sha256(\"\") with sequence 1 (positive)", () => {
    const { manifest, entries } = makeChain();
    const genesis = entries[0];
    expect(genesis.entryType).toBe("GENESIS");
    expect(genesis.previousEntryHash).toBe(GENESIS_EMPTY_HASH);
    expect(genesis.sequence).toBe(1);
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("rejects a non-GENESIS first entry (negative)", () => {
    const { manifest, entries } = makeChain();
    // A signed RECEIPT_RECORDED anchored at sha256("") with a real hash: only
    // the GENESIS-type requirement is violated.
    const first: LedgerEntry = {
      ...entries[1],
      sequence: 1,
      previousEntryHash: GENESIS_EMPTY_HASH,
    };
    const result = validateLedger(manifest, [first]);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(0);
    expect(result.firstDivergence?.reason).toContain("expected GENESIS");
  });

  it("rejects a GENESIS that does not link the canonical sha256(\"\") hash (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [
      { ...entries[0], previousEntryHash: "b".repeat(64) },
    ];
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(0);
    expect(result.firstDivergence?.reason).toContain("sha256");
  });

  it("rejects a GENESIS whose sequence is not 1 (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [{ ...entries[0], sequence: 0 }];
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence).toEqual({
      index: 0,
      reason: "GENESIS sequence must be 1, got 0",
    });
  });
});

describe("ledger §Rule 3 — continuity (frozen 0.1)", () => {
  it("links every entry to the previous payloadHash (positive)", () => {
    const { manifest, entries } = makeChain();
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].previousEntryHash).toBe(entries[i - 1].payloadHash);
    }
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("fails a broken continuity link at the exact index (negative — tampering)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[2] = { ...entries[2], previousEntryHash: "a".repeat(64) };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(2);
    expect(result.firstDivergence?.reason).toContain("previousEntryHash");
  });
});

describe("ledger §Rule 4 — strict sequence (frozen 0.1)", () => {
  it("requires sequences to strictly increment by 1 (positive)", () => {
    const { manifest, entries } = makeChain();
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].sequence).toBe(entries[i - 1].sequence + 1);
    }
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("fails a sequence gap at the gap index (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[2] = { ...entries[2], sequence: 5 };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence).toEqual({
      index: 2,
      reason: "sequence must strictly increment: expected 3, got 5",
    });
  });
});

describe("ledger §Rule 5 — hash formats (frozen 0.1)", () => {
  it("requires 64-lowercase-hex on all three hash fields (positive)", () => {
    const { manifest, entries } = makeChain();
    for (const entry of entries) {
      expect(entry.previousEntryHash).toMatch(HEX64);
      expect(entry.payloadHash).toMatch(HEX64);
      expect(entry.receiptHash).toMatch(HEX64);
    }
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("rejects an uppercase payloadHash (negative)", () => {
    const { manifest, entries } = makeChain();
    const last = entries.length - 1;
    const tampered: LedgerEntry[] = [...entries];
    // Mutating the LAST entry's payloadHash isolates rule 5: continuity and the
    // following links are unaffected.
    tampered[last] = {
      ...entries[last],
      payloadHash: entries[last].payloadHash.toUpperCase(),
    };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(last);
    expect(result.firstDivergence?.reason).toContain("payloadHash");
  });

  it("rejects a malformed receiptHash (negative — tampered receiptHash)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...entries[1], receiptHash: "deadbeef" };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("receiptHash");
  });
});

describe("ledger §Rule 6 — hash-only vs signed (frozen 0.1)", () => {
  it("carries no signer material on hash-only entries and both on signed entries (positive)", () => {
    const { manifest, entries } = makeChain();
    const [genesis, , , checkpoint] = entries;
    const recorded = entries[1] as SignedEntry;
    expect(HASH_ONLY_SIGNER).toBe("hash-only");
    expect(genesis.signerKeyId).toBe(HASH_ONLY_SIGNER);
    expect("signature" in genesis).toBe(false);
    expect("signerPublicKey" in genesis).toBe(false);
    expect(checkpoint.signerKeyId).toBe(HASH_ONLY_SIGNER);
    expect("signature" in checkpoint).toBe(false);
    expect("signerPublicKey" in checkpoint).toBe(false);
    expect(recorded.signerKeyId).toBe("key_audit_001");
    expect(recorded.signature.length).toBeGreaterThan(0);
    expect(recorded.signerPublicKey.length).toBeGreaterThan(0);
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("rejects a hash-only entry carrying a signature or public key (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered = [
      {
        ...entries[0],
        signature: "c2lnbmF0dXJl",
        signerPublicKey: "cHVibGlj",
      },
    ] as unknown as LedgerEntry[];
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(0);
    expect(result.firstDivergence?.reason).toContain("hash-only");
  });

  it("rejects a signed entry with an empty signature (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...(entries[1] as SignedEntry), signature: "" };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("non-empty signature");
  });

  it("rejects a signed entry with an empty signerPublicKey (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...(entries[1] as SignedEntry), signerPublicKey: "" };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("non-empty signerPublicKey");
  });
      it("fails closed on missing signer material (undefined) instead of throwing", () => {
        const { manifest, entries } = makeChain();
        // Deliberately violates the TS types at runtime: a malformed signed
        // entry without signer material must produce a violation, never a
        // TypeError (fail closed, not crash).
        const tampered = [
          { ...entries[0] },
          { ...(entries[1] as SignedEntry), signature: undefined, signerPublicKey: undefined },
        ] as unknown as LedgerEntry[];
        let result;
        expect(() => {
          result = validateLedger(manifest, tampered);
        }).not.toThrow();
        expect(result!.valid).toBe(false);
        expect(result!.firstDivergence?.index).toBe(1);
        expect(result!.firstDivergence?.reason).toContain("non-empty signature");
      });

});

describe("ledger §Rule 7 — single-chain scope (frozen 0.1)", () => {
  it("keeps every entry in the manifest's chain (positive)", () => {
    const { manifest, entries } = makeChain();
    for (const entry of entries) {
      expect(entry.ledgerId).toBe(manifest.ledgerId);
    }
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("rejects a mixed ledgerId — no cross-chain mixing (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...entries[1], ledgerId: "ledger_other_002" };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain('ledgerId "ledger_other_002"');
  });
});

describe("ledger §Rule 8 — receipt-backed records (frozen 0.1)", () => {
  it("backs RECEIPT_RECORDED entries with a real receiptHash (positive)", () => {
    const { manifest, entries } = makeChain();
    const recorded = entries[1] as SignedEntry;
    expect(recorded.entryType).toBe("RECEIPT_RECORDED");
    expect(recorded.receiptHash).not.toBe(GENESIS_EMPTY_HASH);
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("rejects a RECEIPT_RECORDED entry with the empty-string placeholder (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...entries[1], receiptHash: GENESIS_EMPTY_HASH };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("not the empty-string placeholder");
  });
});

describe("ledger §Rule 9 — consistent schemaVersion (frozen 0.1)", () => {
  it("keeps schemaVersion consistent across the chain (positive)", () => {
    const { manifest, entries } = makeChain();
    const versions = new Set(entries.map((entry) => entry.schemaVersion));
    expect(versions.size).toBe(1);
    expect(validateLedger(manifest, entries).valid).toBe(true);
  });

  it("rejects a divergent schemaVersion at the divergent entry (negative)", () => {
    const { manifest, entries } = makeChain();
    const tampered: LedgerEntry[] = [...entries];
    tampered[2] = { ...entries[2], schemaVersion: "1.1" };
    const result = validateLedger(manifest, tampered);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence).toEqual({
      index: 2,
      reason: 'schemaVersion "1.1" differs from entry[0] "1.0"',
    });
  });
});

describe("ledger §Append-only (frozen 0.1)", () => {
  it("walks the chain read-only and never repairs or rewrites", () => {
    const { manifest, entries } = makeChain();
    // Frozen inputs: any write by the validator would throw in strict mode.
    const frozenChain = Object.freeze(
      entries.map((entry) => Object.freeze(entry)),
    ) as LedgerEntry[];
    const frozenManifest = Object.freeze(manifest) as LedgerManifest;
    const result = validateLedger(frozenManifest, frozenChain);
    expect(result.valid).toBe(true);
    // Deterministic: the same inputs always yield the same verdict.
    expect(validateLedger(frozenManifest, frozenChain)).toEqual(result);
  });
});
