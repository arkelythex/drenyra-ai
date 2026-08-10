# Authority Model

> [!IMPORTANT]
> **Authority is chained: memory guides, policy restricts, evidence demonstrates, receipts certify, and a professional authorizes.** Agents propose; they never self-authorize.

<!-- -->

> **Last updated:** 2026-08-02. Status: pre-alpha. — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; risk-tier values and version numbers are JSON integers, never floats.

## The chain of authority

```text
Memoria orienta.      Memory guides.          (Drenyra Engram — never authorizes)
Política restringe.   Policy restricts.       (materiality policy, jurisdiction rules)
Evidencia demuestra.  Evidence demonstrates.  (receipts, evidence hashes, conformance vectors)
Receipt certifica.    Receipt certifies.      (Ed25519-signed receipts, ledger chain)
Profesional autoriza. A professional authorizes.  (human approval, R2/R3 gates)
```

## Risk tiers (materiality)

Materiality is derived deterministically from value (BigInt cents), reversibility, and jurisdiction — never from agent claims. See [`contracts/candidate.md`](../../contracts/candidate.md#materiality-policy-draft) → "Materiality policy (draft)":

| Tier | Review required |
| --- | --- |
| R0 | Read-only / non-material — high autonomy |
| R1 | Standard, reversible, within limits — focused review |
| R2 | Partially reversible or larger value — explicit review + approval |
| R3 | Irreversible (declarations, payments, deletion) — explicit dual approval |

Unknown jurisdictions escalate one tier (fail-closed) until a country-pack exists.

## Gates

Lifecycle gates validate authority, scope, and receipts before commit/push/PR/release. A gate that fails blocks the action; `needs_input` returns the complete decision envelope and the human answers — the gate never guesses.

## Approvals

- Approval is an explicit, receipted event (approver, scope, timestamp).
- R2: explicit approval by an authorized professional.
- R3: explicit **dual** approval.
- Memory never authorizes; only a professional does.

---

## Read next

- [Trust Boundaries](trust-boundaries.md) — where each trust decision fails closed
- [Architecture](../architecture.md) — back to the index
