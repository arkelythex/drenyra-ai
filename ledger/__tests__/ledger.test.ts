/**
 * Ledger validation unit tests — valid chains pass; every frozen violation
 * fails with the correct divergence index. Rules per contracts/ledger.md.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GENESIS_EMPTY_HASH,
  validateLedger,
  type HashOnlyEntry,
  type LedgerEntry,
  type LedgerManifest,
  type SignedEntry,
} from "../index.js";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const EMPTY_STRING_HASH = sha256Hex("");

function makeManifest(): LedgerManifest {
  return {
    ledgerId: "ledger_demo_001",
    protocolVersion: "1.0",
    hashAlgorithm: "SHA-256",
    trustRoot: { keyIds: ["key_prod_001"] },
    jurisdiction: "PE",
    createdAt: "2026-01-01T00:00:00Z",
    signingPolicy: {
      required: true,
      algorithm: "Ed25519",
      keyIds: ["key_prod_001"],
    },
  };
}

function makeChain(): { manifest: LedgerManifest; entries: LedgerEntry[] } {
  const genesisPayload = sha256Hex("genesis");
  const recordedPayload = sha256Hex("receipt-recorded");
  const receiptHash = sha256Hex("receipt-bundle");

  const genesis: HashOnlyEntry = {
    entryId: "11111111-1111-4111-8111-111111111111",
    ledgerId: "ledger_demo_001",
    sequence: 1,
    entryType: "GENESIS",
    previousEntryHash: GENESIS_EMPTY_HASH,
    payloadHash: genesisPayload,
    receiptHash: GENESIS_EMPTY_HASH,
    occurredAt: "2026-01-01T00:00:00Z",
    recordedAt: "2026-01-01T00:00:00Z",
    actor: "system",
    schemaVersion: "1.0",
    signerKeyId: "hash-only",
  };

  const recorded: SignedEntry = {
    entryId: "22222222-2222-4222-8222-222222222222",
    ledgerId: "ledger_demo_001",
    sequence: 2,
    entryType: "RECEIPT_RECORDED",
    previousEntryHash: genesisPayload,
    payloadHash: recordedPayload,
    receiptHash,
    occurredAt: "2026-01-02T00:00:00Z",
    recordedAt: "2026-01-02T00:00:00Z",
    actor: "user_456",
    schemaVersion: "1.0",
    signerKeyId: "key_prod_001",
    signature: "c2lnbmF0dXJl",
    signerPublicKey: "MCowBQYDK2VwAyEApchx2rhjdQOzCK7+pSUpFamiAp1/7rWz2uuk3KI8B2o=",
  };

  const attested: SignedEntry = {
    entryId: "33333333-3333-4333-8333-333333333333",
    ledgerId: "ledger_demo_001",
    sequence: 3,
    entryType: "ATTESTATION_ADDED",
    previousEntryHash: recordedPayload,
    payloadHash: sha256Hex("attestation"),
    receiptHash: GENESIS_EMPTY_HASH,
    occurredAt: "2026-01-03T00:00:00Z",
    recordedAt: "2026-01-03T00:00:00Z",
    actor: "auditor_789",
    schemaVersion: "1.0",
    signerKeyId: "key_prod_001",
    signature: "c2lnbmF0dXJl",
    signerPublicKey: "MCowBQYDK2VwAyEApchx2rhjdQOzCK7+pSUpFamiAp1/7rWz2uuk3KI8B2o=",
  };

  return { manifest: makeManifest(), entries: [genesis, recorded, attested] };
}

describe("validateLedger()", () => {
  it("freezes the canonical sha256(\"\") link target", () => {
    expect(EMPTY_STRING_HASH).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(GENESIS_EMPTY_HASH).toBe(EMPTY_STRING_HASH);
  });

  it("accepts a well-formed hash-only genesis followed by signed entries", () => {
    const { manifest, entries } = makeChain();
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(true);
    expect(result.firstDivergence).toBeUndefined();
    expect(result.reasons).toEqual([]);
  });

  it("rejects a broken continuity link with the diverging index", () => {
    const { manifest, entries } = makeChain();
    (entries[2] as SignedEntry).previousEntryHash = sha256Hex("wrong-link");
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(2);
    expect(result.firstDivergence?.reason).toContain("previousEntryHash");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("rejects a non-GENESIS first entry", () => {
    const { manifest, entries } = makeChain();
    const brokenFirst = {
      ...(entries[0] as HashOnlyEntry),
      entryType: "RECEIPT_RECORDED" as const,
    };
    const result = validateLedger(manifest, [brokenFirst, ...entries.slice(1)]);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(0);
    expect(result.firstDivergence?.reason).toContain("GENESIS");
  });

  it("rejects a genesis with a wrong previousEntryHash", () => {
    const { manifest, entries } = makeChain();
    (entries[0] as HashOnlyEntry).previousEntryHash = "f".repeat(64);
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(0);
    expect(result.firstDivergence?.reason).toContain("sha256");
  });

  it("rejects a sequence gap at the diverging index", () => {
    const { manifest, entries } = makeChain();
    (entries[2] as SignedEntry).sequence = 7;
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(2);
    expect(result.firstDivergence?.reason).toContain("sequence");
  });

  it("rejects a tampered receiptHash (non-hex) at its index", () => {
    const { manifest, entries } = makeChain();
    (entries[1] as SignedEntry).receiptHash = "zz-not-hex";
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("receiptHash");
  });

  it("rejects a RECEIPT_RECORDED entry without a backing receiptHash", () => {
    const { manifest, entries } = makeChain();
    (entries[1] as SignedEntry).receiptHash = GENESIS_EMPTY_HASH;
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("RECEIPT_RECORDED");
  });

  it("rejects a hash-only entry that carries a signature", () => {
    const { manifest, entries } = makeChain();
    const signedGenesis = {
      ...(entries[0] as HashOnlyEntry),
      signature: "c2ln",
      signerPublicKey: "MCow",
    } as unknown as LedgerEntry;
    const result = validateLedger(manifest, [signedGenesis, ...entries.slice(1)]);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(0);
    expect(result.firstDivergence?.reason).toContain("hash-only");
  });

  it("rejects a signed entry missing its signature", () => {
    const { manifest, entries } = makeChain();
    const unsignedEntry = {
      ...(entries[1] as SignedEntry),
      signature: "",
    } as unknown as LedgerEntry;
    const result = validateLedger(
      manifest,
      [entries[0], unsignedEntry, entries[2]],
    );
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("signature");
  });

  it("rejects mixed ledgerIds", () => {
    const { manifest, entries } = makeChain();
    (entries[1] as SignedEntry).ledgerId = "ledger_other_001";
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(1);
    expect(result.firstDivergence?.reason).toContain("ledgerId");
  });

  it("rejects an inconsistent schemaVersion", () => {
    const { manifest, entries } = makeChain();
    (entries[2] as SignedEntry).schemaVersion = "2.0";
    const result = validateLedger(manifest, entries);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(2);
    expect(result.firstDivergence?.reason).toContain("schemaVersion");
  });

  it("rejects an empty chain", () => {
    const result = validateLedger(makeManifest(), []);
    expect(result.valid).toBe(false);
    expect(result.firstDivergence?.index).toBe(-1);
    expect(result.reasons.length).toBe(1);
  });
});
