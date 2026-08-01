/**
 * Ledger validation — walks the append-only chain once and reports the first
 * divergence plus every reason. Frozen rules live in contracts/ledger.md; the
 * GENESIS link target is the canonical SHA-256 of the empty string.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money, and sequence/index fields are always JSON
 * integers (never floats).
 */

import type {
  HashOnlyEntry,
  LedgerEntry,
  LedgerManifest,
  LedgerValidationResult,
} from "./types.js";

/**
 * sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 * The frozen link target of the GENESIS entry. Kept as a literal so the
 * contract value cannot drift; see contracts/ledger.md.
 */
export const GENESIS_EMPTY_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const HEX64 = /^[0-9a-f]{64}$/;

function isHashOnly(entry: LedgerEntry): entry is HashOnlyEntry {
  return entry.signerKeyId === "hash-only";
}

/**
 * Validate a ledger chain against the manifest.
 *
 * Checks (contracts/ledger.md):
 * 1. Non-empty chain.
 * 2. First entry is GENESIS with previousEntryHash === sha256("") and sequence 1.
 * 3. Continuity: entry[i].previousEntryHash === entry[i-1].payloadHash.
 * 4. Sequence strictly increments by 1.
 * 5. Hash fields are 64-char lowercase hex.
 * 6. Hash-only entries carry no signature/signerPublicKey; signed entries carry both.
 * 7. Every entry shares the manifest ledgerId.
 * 8. RECEIPT_RECORDED entries carry the backing receiptHash.
 * 9. schemaVersion is consistent across the chain.
 */
export function validateLedger(
  manifest: LedgerManifest,
  entries: LedgerEntry[],
): LedgerValidationResult {
  const reasons: string[] = [];
  let firstDivergence: { index: number; reason: string } | undefined;

  const fail = (index: number, reason: string): void => {
    reasons.push(`entry[${index}]: ${reason}`);
    if (firstDivergence === undefined) {
      firstDivergence = { index, reason };
    }
  };

  if (entries.length === 0) {
    const reason = "chain is empty";
    reasons.push(reason);
    return { valid: false, firstDivergence: { index: -1, reason }, reasons };
  }

  const firstSchemaVersion = entries[0].schemaVersion;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const previous = i > 0 ? entries[i - 1] : undefined;

    // (7) single-chain scope
    if (entry.ledgerId !== manifest.ledgerId) {
      fail(
        i,
        `ledgerId "${entry.ledgerId}" does not match manifest ledgerId "${manifest.ledgerId}"`,
      );
    }

    if (i === 0) {
      // (2) GENESIS anchoring
      if (entry.entryType !== "GENESIS") {
        fail(0, `first entry type "${entry.entryType}", expected GENESIS`);
      }
      if (entry.previousEntryHash !== GENESIS_EMPTY_HASH) {
        fail(0, 'GENESIS previousEntryHash must be the canonical sha256("") hash');
      }
      if (entry.sequence !== 1) {
        fail(0, `GENESIS sequence must be 1, got ${entry.sequence}`);
      }
    } else if (previous !== undefined) {
      // (3) continuity link
      if (entry.previousEntryHash !== previous.payloadHash) {
        fail(
          i,
          `previousEntryHash does not match entry[${i - 1}].payloadHash`,
        );
      }
      // (4) strict sequence increment
      if (entry.sequence !== previous.sequence + 1) {
        fail(
          i,
          `sequence must strictly increment: expected ${previous.sequence + 1}, got ${entry.sequence}`,
        );
      }
    }

    // (5) hash field formats
    if (!HEX64.test(entry.payloadHash)) {
      fail(i, `payloadHash must be 64 lowercase hex, got "${entry.payloadHash}"`);
    }
    if (!HEX64.test(entry.receiptHash)) {
      fail(i, `receiptHash must be 64 lowercase hex, got "${entry.receiptHash}"`);
    }
    if (!HEX64.test(entry.previousEntryHash)) {
      fail(
        i,
        `previousEntryHash must be 64 lowercase hex, got "${entry.previousEntryHash}"`,
      );
    }

    // (6) hash-only vs signed
    if (isHashOnly(entry)) {
      if (entry.signature !== undefined || entry.signerPublicKey !== undefined) {
        fail(i, "hash-only entry must not carry signature or signerPublicKey");
      }
    } else {
      if (entry.signature.length === 0) {
        fail(i, "signed entry must carry a non-empty signature");
      }
      if (entry.signerPublicKey.length === 0) {
        fail(i, "signed entry must carry a non-empty signerPublicKey");
      }
    }

    // (8) RECEIPT_RECORDED entries must be backed by a real receipt hash
    if (entry.entryType === "RECEIPT_RECORDED" && entry.receiptHash === GENESIS_EMPTY_HASH) {
      fail(
        i,
        "RECEIPT_RECORDED entry must carry the backing receiptHash (not the empty-string placeholder)",
      );
    }

    // (9) consistent schemaVersion
    if (i > 0 && entry.schemaVersion !== firstSchemaVersion) {
      fail(
        i,
        `schemaVersion "${entry.schemaVersion}" differs from entry[0] "${firstSchemaVersion}"`,
      );
    }
  }

  return { valid: firstDivergence === undefined, firstDivergence, reasons };
}
