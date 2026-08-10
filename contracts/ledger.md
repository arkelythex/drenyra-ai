# Contract: ledger

> Version: 0.1 · Status: FROZEN · Transport-agnostic.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
> (no float is ever used for money); ledger sequence numbers and divergence
> indexes are JSON integers, never floats.

<!-- -->

> [!IMPORTANT]
> **Status: FROZEN at v0.1** — the normative surface of this contract is pinned by a conformance suite that runs in CI and fails on drift. See the [Contracts index](README.md) and the [freeze record](#freeze-record) below.

The **audit ledger** is the append-only, verifiable record of accounting actions. It chains receipted events into a tamper-evident sequence: commits = atomic accounting changes, diffs = explained differences, PRs = accounting review packages (Ledger-as-Git).

## Purpose

- Prove the order and integrity of receipted accounting actions.
- Detect any tampering — at any point in the chain — and report the **first divergence**.
- Give auditors, ERPs, and governments an offline-verifiable artifact (no issuer online required).

## Ledger entry

| Field | Description |
| --- | --- |
| `entryId` | Canonical entry identifier (UUID v7 recommended) |
| `ledgerId` | Chain identity — all entries in one chain share it (single-chain scope) |
| `sequence` | Strictly increasing integer, starts at 1 |
| `entryType` | `GENESIS` · `RECEIPT_RECORDED` · `ATTESTATION_ADDED` · `ENTRY_SUPERSEDED` · `ENTRY_REVOKED` · `CHECKPOINT_CREATED` |
| `previousEntryHash` | Link to the previous entry (see continuity) |
| `payloadHash` | SHA-256 of this entry's payload (64 lowercase hex) |
| `receiptHash` | Backing receipt hash; the empty-string SHA-256 placeholder only for entries without a receipt |
| `occurredAt` | When the action occurred (UTC ISO 8601) |
| `recordedAt` | When the entry was recorded (UTC ISO 8601) |
| `actor` | Who performed the action |
| `schemaVersion` | Schema version, consistent across the chain |
| `signerKeyId` | Signing key id — literal `hash-only` for unsigned entries |
| `signature` | Required for signed entries, forbidden for hash-only entries |
| `signerPublicKey` | Required for signed entries, forbidden for hash-only entries |

## Validation rules

1. **Non-empty chain.** A ledger with no entries is invalid.
2. **GENESIS anchoring.** The first entry must be `GENESIS`, with `previousEntryHash` equal to the canonical SHA-256 of the empty string and `sequence === 1`:
   `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
3. **Continuity.** For every entry after the first: `entry[i].previousEntryHash === entry[i-1].payloadHash`. A broken link means tampering or a missing entry.
4. **Strict sequence.** `entry[i].sequence === entry[i-1].sequence + 1`.
5. **Hash formats.** `previousEntryHash`, `payloadHash`, and `receiptHash` are 64-character lowercase hex.
6. **Hash-only vs signed.** `signerKeyId === "hash-only"` entries carry no `signature`/`signerPublicKey`; signed entries carry both (non-empty).
7. **Single-chain scope.** Every entry's `ledgerId` matches the manifest `ledgerId`. No cross-chain mixing.
8. **Receipt-backed records.** A `RECEIPT_RECORDED` entry must carry a real backing `receiptHash` — never the empty-string placeholder.
9. **Consistent schema version.** All entries share the same `schemaVersion`.

## Ledger manifest

| Field | Description |
| --- | --- |
| `ledgerId` | Chain identity (extension over the source Drenyra schema) |
| `protocolVersion` | Ledger protocol version |
| `hashAlgorithm` | `SHA-256` |
| `trustRoot` | `{ keyIds: string[] }` — trusted signing keys |
| `jurisdiction` | Fiscal jurisdiction (e.g. `PE`) |
| `createdAt` | Creation timestamp (UTC ISO 8601) |
| `signingPolicy` | `{ required, algorithm: "Ed25519", keyIds }` |

## Validation result

`validateLedger(manifest, entries)` returns:

```typescript
interface LedgerValidationResult {
  valid: boolean;
  firstDivergence?: { index: number; reason: string };
  reasons: string[];
}
```

- `firstDivergence` points at the **lowest failing index** with its reason; `reasons` collects every violation in chain order.
- The validator walks the chain once; it never repairs or rewrites (append-only).

## Rules that never break

- **Append-only.** Entries are never modified or deleted. Corrections are new entries (`ENTRY_SUPERSEDED`, `ENTRY_REVOKED`), never in-place edits.
- **Immutability.** A signed entry is immutable once recorded; verification never depends on the issuer being online.
- **Scope.** Each chain belongs to exactly one `ledgerId`; fiscal scope (RUC/period) is carried by the receipted actions, and tenant isolation applies to every read.

## Conformance

Vectors cover: valid chain passes; broken continuity fails at the exact index; non-GENESIS first entry fails; wrong GENESIS hash fails; sequence gaps fail; tampered `receiptHash` fails; hash-only entry with signature fails; mixed `ledgerId` fails. These vectors ship with the reference implementation in `ledger/__tests__`.

## Freeze record

- **Freeze date:** 2026-08-02
- **Frozen by release:** **0.2.0** — the release that freezes this contract.
- **Normative surface pinned by:** [`contracts/__tests__/ledger-conformance.test.ts`](./__tests__/ledger-conformance.test.ts) — runs in CI (`bun run test`) and fails on drift: all 9 validation rules with positive and negative cases (non-empty chain, GENESIS anchoring at the canonical `sha256("")` hash with sequence 1, continuity, strict sequence, 64-lowercase-hex hash formats, hash-only vs signed entries, single-chain scope, receipt-backed `RECEIPT_RECORDED`, consistent `schemaVersion`), the `LedgerValidationResult` shape (`valid` / `firstDivergence` at the lowest failing index / `reasons` in chain order), the manifest shape, and the append-only no-repair guarantee.
- **Migration note:** any change to the normative surface (entry shape, manifest shape, validation rules, result shape, hash algorithm) requires a **major** version bump of the ledger contract. Auditors and ERPs must declare the ledger protocol version they speak and reject unknown majors; the migration path for a future major is documented in the release notes of that major.

---

**Read next:** [Contracts index](README.md) · [Drenyra AI README](../README.md)
