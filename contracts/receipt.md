# Contract: receipt

> Version: 0.1 · Status: FROZEN · Transport-agnostic.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
> (no float is ever used for money); proposalVersion and sequence/version values
> serialize as JSON integers, never floats.

<!-- -->

> [!IMPORTANT]
> **Status: FROZEN at v0.1** — the normative surface of this contract is pinned by a conformance suite that runs in CI and fails on drift. See the [Contracts index](README.md) and the [freeze record](#freeze-record) below.

The **receipt** is the RDA (Receipt-Driven Accounting) primitive: an immutable, verifiable record of a material accounting action. **Nothing material happens without a receipt.**

## Purpose

- Prove that an action occurred, by whom, in which scope, with which before/after state.
- Enable offline verification by auditors, ERPs, and governments without trusting the issuer.
- Anchor the audit trail and the ledger.

## Receipt

| Field | Description |
| --- | --- |
| `id` | Canonical receipt identifier |
| `action` | Machine-readable action code |
| `actor` | Who performed it (agent/user/system) |
| `scope` | RUC/company/period — mandatory fiscal context |
| `resource` | Affected resource (table, file, account, candidate) |
| `before_state` | Hash or summary of state before |
| `after_state` | Hash or summary of state after |
| `timestamp` | When it happened (UTC) |
| `signature` | Ed25519 signature over the canonical receipt bytes |
| `version` | Receipt schema version |

## Verification

Receipts verify from **canonical vectors**, not from ambient state:

1. Serialize the receipt fields in canonical order.
2. Hash the canonical bytes.
3. Verify the Ed25519 signature against the signer's public key.
4. Confirm the `before_state` chain links to the previous receipt (ledger continuity).

Canonical vectors ship with the reference implementation and must reproduce byte-for-byte on every supported runtime.

## Schema contract

The normative shape of a receipt lives in [`contracts/receipt-schema/`](./receipt-schema/) (source: arkelythex/Drenyra `contracts/receipt-schema/v1`):

- `schemas/` — draft-07 JSON schemas for `ReceiptContent`, `SignedReceipt`, and `SigningKeyInfo`.
- `fixtures/conformance-vectors.v1.json` — the **frozen conformance vectors** (8). They are the source of truth for correctness: every runtime MUST reproduce them byte-for-byte, and tests MUST pass against them.
- `fixtures/dev-keys.test-only.json` — fixed dev key pairs used only to generate the vectors. TEST-ONLY, never operational.

The reference implementation in `receipts/` is the TS port of the canonical `mission-receipt.ts`; any drift from the frozen vectors fails CI (drift-guard).

## Ledger

Receipts chain into an **append-only audit ledger**:

```text
genesis ──► receipt₁ ──► receipt₂ ──► … ──► receiptₙ
```

Each receipt's `before_state` commits the ledger head it was written against, so tampering breaks the chain detectably. Ledger validation walks the chain and reports the first divergence.

## Rules

- Receipts are immutable once signed. There is no edit — only a correcting receipt that supersedes.
- Unknown receipt schema versions fail closed.
- Scope is checked at write time and at read time (tenant isolation).
- Verification never depends on the issuer being online.

## Conformance

Vectors cover: canonical serialization, signature verification, chain continuity, tamper detection, scope checks, and schema-version rejection.

## Freeze record

- **Freeze date:** 2026-08-02
- **Frozen by release:** **0.1.0** — the first release that freezes this contract.
- **Normative surface pinned by:**
  - [`contracts/receipt-schema/fixtures/conformance-vectors.v1.json`](./receipt-schema/fixtures/conformance-vectors.v1.json) — the frozen byte vectors, verified byte-for-byte by `receipts/__tests__/conformance-vectors.test.ts` (drift-guard);
  - [`contracts/__tests__/receipt-conformance.test.ts`](./__tests__/receipt-conformance.test.ts) — runs in CI (`bun run test`) and fails on drift: the verification status chain (`PAYLOAD_TAMPERED → CONTENT_VALID → UNKNOWN_SIGNER → KEY_EXPIRED → KEY_REVOKED → SIGNER_TRUSTED`), the `verifySignedReceipt` result shape, the canonical key-sorted-shallow serialization rule, and mutated-content-byte tamper detection.
- **Migration note:** any change to the normative surface (schema shape, canonical serialization, verification status chain, hash/signature algorithms, version semantics) requires a **major** version bump of the receipt contract — and a new frozen vector set under `contracts/receipt-schema/` that all runtimes must reproduce byte-for-byte. Unknown receipt schema versions fail closed; the migration path for a future major is documented in the release notes of that major.

---

**Read next:** [Contracts index](README.md) · [Drenyra AI README](../README.md)
