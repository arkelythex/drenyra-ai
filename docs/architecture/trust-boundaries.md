# Trust Boundaries

> [!IMPORTANT]
> **Trust fails closed.** Unknown states, unknown signers, unknown schemas, and unverifiable artifacts are rejected — never assumed valid.

<!-- -->

> **Last updated:** 2026-08-02. Status: pre-alpha. — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Where trust lives

| Boundary | Trust source | Fail-closed behavior |
| --- | --- | --- |
| Receipt authenticity | Ed25519 signature over canonical payload | Invalid signature ⇒ `CONTENT_VALID`/`PAYLOAD_TAMPERED`, never trusted |
| Receipt trust lifecycle | `verifySignedReceiptTrusted` (recognized, current, not revoked) | `UNKNOWN_SIGNER` / `KEY_EXPIRED` / `KEY_REVOKED` ⇒ CLI exit 1 (never exit 0) |
| Ledger integrity | Chain continuity over `previousEntryHash`/`payloadHash` | First divergence reported with index; nothing is repaired |
| Mission state | `VALID_TRANSITIONS` state machine | Illegal transitions throw `INVALID_TRANSITION`; terminal states are guarded |
| Candidate identity | SHA-256 over the exact subject bytes | Mutated subject ⇒ `SUBJECT_MUTATED`; one correction only |
| Intent execution | Registered intent handlers | No handler ⇒ `INTENT_HANDLER_NOT_CONFIGURED` (CLI fails; it never fakes accounting work) |
| Memory (Engram) | Memory guides, never authorizes | No authorization surface exists in the memory engine |

## Principles

1. **Fail closed.** Unknown states, unknown signers, unknown schemas, and unverifiable artifacts are rejected — never assumed valid.
2. **Bytes are the source of truth.** Candidate identity and receipt integrity anchor to exact bytes, not to agent intent or transcripts.
3. **Authority is derived, not asserted.** The runtime validates; gates + human approval authorize. Drenyra Engram never authorizes operations.
4. **Local development adapters are never trusted storage.** The JSON mission store is a development adapter; canonical persistence is a later concern (see [storage-model.md](storage-model.md)).

---

## Read next

- [Receipt vs. Ledger Entry](receipt-ledger-model.md) — receipts as atomic proof vs. the ledger as chained order
- [Architecture](../architecture.md) — back to the index
