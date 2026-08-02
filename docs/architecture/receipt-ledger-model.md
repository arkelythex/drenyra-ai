# Receipt vs Ledger Entry

> **Last updated:** 2026-08-02. Status: pre-alpha.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence numbers are JSON integers, never floats.

## The two artifacts are not the same thing

| | **Receipt** (`receipts/`) | **Ledger entry** (`ledger/`) |
| --- | --- | --- |
| What it proves | An action happened, by whom, in which scope, with which before/after state | The ORDER and INTEGRITY of a chain of receipted events |
| Identity | Content + signature (Ed25519 over canonical payload) | `entryId` + chain position (`sequence`, `previousEntryHash`) |
| Granularity | One material action = one receipt | One entry = one link in the chain (GENESIS … RECEIPT_RECORDED …) |
| Verification | Hash integrity + signature + signer trust lifecycle | Chain continuity + hash formats + single-chain scope + schema consistency |
| Mutation | Immutable; a correction is a new receipt that supersedes | Append-only; corrections are new entries (ENTRY_SUPERSEDED / ENTRY_REVOKED) |
| Anchoring | Canonical payload bytes | `sha256("")` for GENESIS, then `entry[i].previousEntryHash === entry[i-1].payloadHash` |

## Relationship

A `RECEIPT_RECORDED` ledger entry **carries the receipt hash** of the action it records — the ledger chains receipts, it does not replace them. The receipt is the atomic proof; the ledger is the tamper-evident order of proofs.

```text
receipt₁ ──recorded──▶ ledger entry₁ (receiptHash = hash(receipt₁))
receipt₂ ──recorded──▶ ledger entry₂ (previousEntryHash = entry₁.payloadHash)
```

Tampering with any receipt breaks its signature AND breaks the chain link; `ledger validate` reports the first divergence.
