# Contract: receipt

> Version: 0.1-draft · Status: draft · Transport-agnostic.

The **receipt** is the RED (Receipt-Driven Accounting) primitive: an immutable, verifiable record of a material accounting action. **Nothing material happens without a receipt.**

## Purpose

- Prove that an action occurred, by whom, in which scope, with which before/after state.
- Enable offline verification by auditors, ERPs, and governments without trusting the issuer.
- Anchor the audit trail and the ledger.

## Receipt

| Field          | Description                                             |
| -------------- | ------------------------------------------------------- |
| `id`           | Canonical receipt identifier                            |
| `action`       | Machine-readable action code                            |
| `actor`        | Who performed it (agent/user/system)                    |
| `scope`        | RUC/company/period — mandatory fiscal context           |
| `resource`     | Affected resource (table, file, account, candidate)     |
| `before_state` | Hash or summary of state before                         |
| `after_state`  | Hash or summary of state after                          |
| `timestamp`    | When it happened (UTC)                                  |
| `signature`    | Ed25519 signature over the canonical receipt bytes      |
| `version`      | Receipt schema version                                  |

## Verification

Receipts verify from **canonical vectors**, not from ambient state:

1. Serialize the receipt fields in canonical order.
2. Hash the canonical bytes.
3. Verify the Ed25519 signature against the signer's public key.
4. Confirm the `before_state` chain links to the previous receipt (ledger continuity).

Canonical vectors ship with the reference implementation and must reproduce byte-for-byte on every supported runtime.

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
