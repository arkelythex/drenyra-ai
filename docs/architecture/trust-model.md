# Trust Model — Drenyra AI (Verifiable Accounting Agent Ecosystem)

> [!IMPORTANT]
> **Authority lives in gates and human approval.** Drenyra AI is the enforcement point of the ecosystem: nothing material happens without a receipt, and no lifecycle transition bypasses a gate.

<!-- -->

> **Last updated:** 2026-08-01. — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## In this document

- [Trust boundaries](#trust-boundaries)
- [Fail-closed default](#fail-closed-default)
- [Interaction with consumers](#interaction-with-consumers)
- [Operational consequences](#operational-consequences)

## Trust boundaries

### 1. Gates, not faith

- Lifecycle gates validate **authority, scope, and receipts** before commit/push/PR/release.
- A transition that cannot prove its authority does not happen. There is no "trust the agent" path.

### 2. Human approval is explicit and recorded

- Approval is an explicit, recorded event — never implied by a pass, a silence, or a memory.
- Approval records are part of the receipt trail and can be audited independently.

### 3. Agents propose; they never self-authorize

- Agents produce candidates with identity, scope, and materiality.
- Review depth derives from materiality (R0 high autonomy → R3 explicit dual approval), never chosen ad hoc.

### 4. Receipts are the unit of proof

- Every material action produces an immutable, Ed25519-signed receipt.
- Receipts verify offline and from canonical conformance vectors — never from ambient state.

### 5. Memory informs; it never authorizes

- Drenyra AI may integrate `drenyra-engram` for context.
- No observation is ever treated as approval, permission, or authorization.

## Fail-closed default

When authority, scope, or receipts cannot be validated, Drenyra AI **fails closed**: the transition is rejected, the mission pauses, and recovery is crash-safe. Ambiguity is surfaced, never guessed through.

## Interaction with consumers

Drenyra and Drenyra Pi rely on Drenyra AI's gates as their enforcement point. Drenyra AI never delegates authority decisions back to consumers, and consumers never override a gate outcome.

## Operational consequences

- A gate failure pauses the mission and preserves state; recovery is crash-safe and resumable.
- Audit questions are answered from receipts and canonical vectors, never from ambient state.
- A transition without a receipt is not a transition; it is a defect.

---

## Read next

- [Authority Model](authority-model.md) — how authority is chained and where human approval sits
- [Architecture](../architecture.md) — back to the index
