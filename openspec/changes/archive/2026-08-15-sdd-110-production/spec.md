# Connector-Adapter Contract Specification — SDD-110 (Option A)

> Change: `sdd-110-production` · Domain: connector-adapter conformance (new mutation-adapter contract + `adapters/connector.ts` library surface, first slice)
>
> Contract target: `connector-adapter` v0.1, status **DRAFT** — NOT frozen. Freezing is a later, explicit decision requiring ecosystem adoption and approval (the `brand-system` precedent).
>
> Repository convention: this repo keeps change specs as flat files under
> `openspec/changes/{change}/spec.md`; no canonical `openspec/specs/{domain}/spec.md`
> tree exists yet, so this is a full domain spec for the change, preserved as-is at archive.
>
> This specification defines behavior only (WHAT must be true). API shape, exact function
> signatures, and the discriminated result field list are design decisions (HOW) and are
> intentionally not fixed here except where an existing Core primitive already pins them.

## Purpose

Establish the transport-agnostic mutation boundary that future restricted ERP, SUNAT/SIRE,
bank, e-invoicing, and document connectors MUST satisfy before any vendor integration is
shipped or represented as available. This slice pins Core semantics for idempotent
execution, UNKNOWN reconciliation, tenant scope isolation, restricted authority, and
evidence-bound success, and proves them with an in-memory mock adapter, not a real
connector.

The contract is authored as DRAFT v0.1. It is NOT frozen: passing the conformance suite
proves the surface is freezable, it does not prove any connector exists. The suite runs in
CI and fails on drift, mirroring the `brand-system` precedent. This slice makes zero
capability claims (R17): no capability-matrix row is promoted, no adapter is declared, and
no vendor integration is shipped.

The contract MUST be read alongside — and MUST compose with, never replace — the existing
fetch-only `EvidenceAdapter` port. Retrieval and mutation have different authority, risk,
and failure semantics; the SDD-050 evidence-fetch close flow (`flow/close.ts`) and the
`EvidenceAdapter`/`LocalFileAdapter` surfaces remain unchanged.

## Normative sources

The connector contract MUST reuse these existing Core primitives rather than defining
parallel mechanisms:

| Source | Role in this contract |
| --- | --- |
| `missions/idempotency.ts` | Idempotency key validation (`isValidIdempotencyKey`) and the `IdempotencyConflict` failure detail. |
| `missions/runtime.ts` | `canonicalHash` — the canonical command payload hash (SHA-256 over key-sorted JSON); the single hash primitive for payload binding. |
| `missions/store.ts` | `IdempotencyStore` port (and `InMemoryIdempotencyStore` for the mock suite); recorded outcomes for replay. |
| `missions/reconciliation.ts` | `reconcileExternalCall`, `ExternalEvidence`, `ExternalOutcome`, `ReconciliationDecision`, `isVerifiableEvidence`, `ReconciliationError`. |
| `tenant-core` | `validateTenantScope`, `sameTenantScope`, `ValidatedTenantScope`, `TenantScopeError`. |
| `receipts/types.ts` | `ReceiptType.EXTERNAL_SUBMISSION` — the sole receipt kind for external submissions. |
| `adapters/registry.ts` | `EvidenceAdapter` — fetch-only read port; NOT modified by this slice. |

## Surface (illustrative, transport-neutral, NOT a frozen contract)

The mutation-adapter surface is described neutrally; this slice does not freeze a public
transport contract. The following is illustrative only:

```ts
interface ConnectorCapability {
  system: string;          // declared external system (e.g. sunat-sire, erp, bank)
  jurisdiction: string;    // declared jurisdiction (e.g. PE)
  operations: readonly string[]; // declared mutation operations, no vendor detail (v0.1)
}

interface ConnectorExecuteInput {
  idempotencyKey: string;  // validated per existing idempotency key rules
  command: unknown;        // payload bound to the canonical command hash
  tenantScope: TenantScope | ValidatedTenantScope; // bound and validated before mutation
}

type ConnectorExecuteResult =
  | { kind: "SUCCESS"; evidence: ExternalEvidence; stableIdentifier: string }
  | { kind: "UNKNOWN"; stableIdentifier: string }
  | { kind: "FAILED"; /* definitive local failure; never claims external outcome */ };

interface ConnectorReconcile {
  resolve(call: ExternalCall): Promise<{ outcome: ExternalOutcome; evidence?: ExternalEvidence }>;
}
```

Field names, collection types, and the exact result vocabulary are design decisions, with
one mandatory constraint: only a SUCCESS-shaped result MAY claim external execution, and it
MUST carry verifiable evidence.

## Requirements

### Requirement: REQ-CONN-001 — Idempotent execute

Every `execute` call MUST carry a valid idempotency key, validated with the existing
idempotency key rules, bound to the canonical command hash of its payload computed with the
existing `canonicalHash` primitive. The adapter MUST NOT define its own hashing or replay
mechanism. On first use, the adapter MUST execute at most once and MUST record the outcome
under the key in an `IdempotencyStore`-shaped record. A later call with the same key and a
payload that hashes identically MUST return the recorded result (replay) and MUST NOT
re-execute or mutate the external system again. A later call with the same key and a
different payload hash MUST fail closed with `IDEMPOTENCY_CONFLICT` and MUST NOT mutate.
Concurrent execution attempts sharing a key MUST fail closed so at most one mutation
proceeds per key. Replay MUST return the recorded result regardless of whether the recorded
outcome was success or failure; a recorded terminal outcome is never re-attempted.

#### Scenario: SC-CONN-001 — Same-key/same-payload replay returns the recorded result without re-execution

- GIVEN an adapter that has executed a command once under idempotency key `K` and recorded a successful outcome
- WHEN the same command payload is executed again under key `K`
- THEN the adapter returns the same recorded result
- AND the adapter performs no second mutation of the external system (the mock records exactly one execution)

#### Scenario: SC-CONN-002 — Same-key/different-payload fails closed with IDEMPOTENCY_CONFLICT

- GIVEN an adapter that has recorded key `K` bound to command payload hash `H1`
- WHEN a command whose payload hashes to `H2` (H2 ≠ H1) is executed under key `K`
- THEN the call fails closed with `IDEMPOTENCY_CONFLICT` carrying the key and the original and new payload details
- AND no mutation of the external system occurs

#### Scenario: SC-CONN-003 — Concurrent same-key attempts fail closed

- GIVEN an in-flight execution under key `K` that has not yet recorded a terminal outcome
- WHEN a second execution attempt arrives under the same key `K`
- THEN the second attempt fails closed without executing
- AND exactly zero or one mutation reaches the external system for key `K`

### Requirement: REQ-CONN-002 — UNKNOWN outcome

When an external call is sent and the outcome cannot be determined — for example after a
partial or interrupted call — `execute` MAY return an UNKNOWN result instead of asserting
success or failure. An UNKNOWN result MUST carry a `stableIdentifier` suitable for
correlating with the external system and for building the `ExternalCall` consumed by the
existing reconciliation primitive. The adapter MUST NOT fabricate an executed or
not-executed verdict, MUST NOT claim external execution without verifiable evidence, and
MUST NOT assert non-execution it cannot verify. UNKNOWN remains UNKNOWN until
reconciliation obtains verifiable evidence, proves safe idempotent retry, or requires a
professional.

#### Scenario: SC-CONN-004 — Interrupted call returns UNKNOWN with a stable identifier

- GIVEN an adapter whose external call was interrupted after transmission with an indeterminate outcome
- WHEN the execution result is examined
- THEN the result is UNKNOWN
- AND it carries a `stableIdentifier` that the external system can be queried by and that can populate an `ExternalCall`

#### Scenario: SC-CONN-005 — UNKNOWN never fabricates a verdict

- GIVEN an execution with an indeterminate outcome and no verifiable evidence
- WHEN the adapter produces its result
- THEN the adapter does not claim the action executed
- AND the adapter does not claim the action did not execute
- AND any claim of external execution requires verifiable `ExternalEvidence` per REQ-CONN-005

### Requirement: REQ-CONN-003 — Reconciliation mapping

Reconciliation of an UNKNOWN outcome MUST map through the existing `reconcileExternalCall`
semantics and MUST NOT define a parallel protocol. An `executed` outcome MUST map to
`record` only when verifiable `ExternalEvidence` is present; `executed` without verifiable
evidence MUST fail closed (`EXECUTED_WITHOUT_EVIDENCE`). A `not-executed` outcome MUST map
to `retry` and the retry MUST be idempotent (reusing the same idempotency key) — never a
blind retry. An `indeterminate` outcome MUST map to `human-intervention`. A missing
resolver MUST fail closed (`NO_RESOLVER`): the outcome is never guessed.

#### Scenario: SC-CONN-006 — Executed maps to record with verifiable evidence

- GIVEN an UNKNOWN outcome whose stable identifier resolves to `executed` with an evidence payload satisfying `isVerifiableEvidence`
- WHEN reconciliation runs
- THEN the decision is `record`
- AND the evidence is retained as the reconciliation evidence

#### Scenario: SC-CONN-007 — Executed without verifiable evidence fails closed

- GIVEN an UNKNOWN outcome whose stable identifier resolves to `executed` but with no evidence, or evidence that fails `isVerifiableEvidence`
- WHEN reconciliation runs
- THEN reconciliation fails closed with `EXECUTED_WITHOUT_EVIDENCE`
- AND no external execution is recorded

#### Scenario: SC-CONN-008 — Not-executed maps to idempotent retry only

- GIVEN an UNKNOWN outcome whose stable identifier resolves to `not-executed`
- WHEN reconciliation runs
- THEN the decision is `retry`
- AND the retry reuses the same idempotency key so replay or conflict semantics still hold

#### Scenario: SC-CONN-009 — Indeterminate maps to human-intervention

- GIVEN an UNKNOWN outcome whose stable identifier resolves to `indeterminate`
- WHEN reconciliation runs
- THEN the decision is `human-intervention`
- AND no automated retry and no record of execution occurs

### Requirement: REQ-CONN-004 — Scope isolation

Every execution MUST bind to a validated tenant scope of company identifier, RUC, and fiscal
period, validated with the existing `validateTenantScope` primitive (or accepted only as an
already-branded `ValidatedTenantScope`). The adapter MUST NOT read or write across tenants,
MUST reject any scope mismatch before mutation, and MUST reject mismatch before accepting
evidence. Any cross-boundary access MUST be guarded with `sameTenantScope`. An invalid scope
MUST fail closed with `TenantScopeError` and MUST NOT yield a partial execution.

#### Scenario: SC-CONN-010 — Cross-tenant execution is rejected before mutation

- GIVEN an execution bound to tenant scope A (companyId/ruc/period)
- WHEN the same execution is attempted with evidence or a response belonging to tenant scope B (differing in company, RUC, or period)
- THEN the attempt fails closed before any mutation and before any evidence acceptance
- AND `sameTenantScope(A, B)` is false and the mismatch is surfaced as a rejection

#### Scenario: SC-CONN-011 — Invalid scope fails closed

- GIVEN an execution input whose tenant scope has a malformed RUC or period (or a missing company identifier)
- WHEN the execution is validated
- THEN it fails closed with `TenantScopeError` and its specific error code
- AND no mutation and no evidence acceptance occurs

### Requirement: REQ-CONN-005 — Evidence-bound success / verifiable response

A successful submission MUST return verifiable evidence carrying at least a stable external
identifier, the external state, provenance (the system that reported it), the moment the
external system reported it, and a response hash — that is, satisfying
`isVerifiableEvidence`. Success evidence MUST be hash-addressed and provenance-tagged;
narrative memory, model recollection, unsupported logs, or adapter assertion MUST NOT
substitute for it. A conforming success MUST bind to the existing `EXTERNAL_SUBMISSION`
receipt kind: deterministic Core owns receipt construction, so the adapter MUST return
evidence from which Core constructs the `EXTERNAL_SUBMISSION` receipt and MUST NOT mint,
sign, or issue receipts itself.

#### Scenario: SC-CONN-012 — Success returns verifiable, hash-addressed evidence

- GIVEN an external system confirms a submission with an identifier, state, provenance, moment, and a 64-hex response hash
- WHEN the success result is produced
- THEN it carries an evidence payload satisfying `isVerifiableEvidence`
- AND every evidence element is hash-addressed and provenance-tagged

#### Scenario: SC-CONN-013 — Conforming success binds to EXTERNAL_SUBMISSION

- GIVEN a verified successful external submission with complete evidence
- WHEN deterministic Core constructs the receipt from the adapter evidence
- THEN the receipt kind is `EXTERNAL_SUBMISSION`
- AND the adapter itself issued no receipt

### Requirement: REQ-CONN-006 — Restricted authority

An adapter MUST perform only its declared capability: the declared system, jurisdiction,
and declared mutation operations (v0.1 declares operations without vendor detail). An
execution whose requested operation is not declared, or whose system or jurisdiction is
outside the declaration, MUST fail closed before mutation. An adapter MUST NOT decide
materiality, change policy, bypass gates, or expand its own authority. The declared
operation list is the mechanical, conformance-testable enforcement of restricted authority;
it is a claim of permission, never a claim of implementation.

#### Scenario: SC-CONN-014 — Undeclared operation is rejected before mutation

- GIVEN an adapter whose declared operations are `["submit"]` for system `sunat-sire`, jurisdiction `PE`
- WHEN an execution requests operation `settle`
- THEN the execution fails closed before any mutation
- AND the adapter performs no external action

#### Scenario: SC-CONN-015 — Outside declared system/jurisdiction is rejected

- GIVEN an adapter declared for system `sunat-sire`, jurisdiction `PE`
- WHEN an execution targets system `bank`, jurisdiction `PE` (or `sunat-sire` for jurisdiction `CL`)
- THEN the execution fails closed before any mutation
- AND the adapter does not reinterpret or expand its declaration

### Requirement: REQ-CONN-007 — No credentials or network

The contract module and its conformance code MUST NOT contain credentials, secrets, key
material, or any embedded vendor configuration that could act as one. The library MUST NOT
perform live network, HTTP, filesystem, database, cloud, or vendor calls; `node:crypto`
MUST be the only permitted Node built-in (no `http`, `net`, `pg`, or `fs`). Conformance
MUST be driven by an in-memory, test-only mock adapter; no live integration exists.
Credential and key lifecycle follow the KMS runbooks in later SDD-110 slices and are
explicitly out of scope here.

#### Scenario: SC-CONN-016 — The module is node:crypto-only with no I/O

- GIVEN the contract module and its conformance suite
- WHEN the module is loaded and the mock conformance vectors run
- THEN the module imports no built-in other than `node:crypto`
- AND no live network, filesystem, database, or vendor call occurs; all driver behavior is in-memory

### Requirement: REQ-CONN-008 — DRAFT status; no capability claims

`connector-adapter` v0.1 MUST remain DRAFT. Freezing MUST require ecosystem adoption and
explicit approval (the `brand-system` precedent); the conformance suite controls drift now
but does not freeze. This slice MUST NOT promote any capability-matrix row:
`adapters-ERP-SUNAT-banks` and related connector rows stay `planned`. This slice MUST NOT
populate `DECLARED_ADAPTERS`, and MUST NOT present the mock adapter or a passing conformance
suite as a production connector, an implemented capability, or connector availability.

#### Scenario: SC-CONN-017 — No capability promotion occurs

- GIVEN the slice ships a DRAFT contract, a typed surface, and a passing mock conformance suite
- WHEN the capability matrix and declared surface are inspected
- THEN no connector capability row is promoted to `implemented`
- AND `DECLARED_ADAPTERS` remains empty

#### Scenario: SC-CONN-018 — A passing suite is not represented as availability

- GIVEN all mock conformance vectors pass in CI
- WHEN the change is described to consumers
- THEN the contract is labeled DRAFT v0.1
- AND no statement claims a live ERP, SUNAT/SIRE, bank, e-invoicing, or document connector exists

### Requirement: REQ-CONN-009 — CI drift gate

The connector conformance suite MUST run in CI (the existing `test` job, mirroring the
`brand-system` precedent) and MUST fail when typed behavior or normative vectors drift from
the DRAFT contract. The suite MUST exercise, at minimum: idempotent replay,
`IDEMPOTENCY_CONFLICT`, UNKNOWN reconciliation (record/retry/human-intervention),
scope-mismatch rejection, restricted-authority rejection, and evidence-bound success. A
conforming mock adapter MUST pass every vector; a vector that violates the DRAFT contract
MUST fail the suite and the CI job.

#### Scenario: SC-CONN-019 — Mock conformance passes all normative vectors

- GIVEN an in-memory `MockConnectorAdapter` implementing the DRAFT contract over the existing primitives
- WHEN the conformance suite runs all vectors (replay, conflict, UNKNOWN reconciliation, scope rejection, authority rejection, evidence-bound success)
- THEN every vector passes
- AND the suite runs as part of the CI `test` job

#### Scenario: SC-CONN-020 — Drift from the DRAFT contract fails CI

- GIVEN a conformance vector whose behavior drifts from the DRAFT contract (for example, replay re-executing, or success without evidence)
- WHEN the suite runs
- THEN that vector fails
- AND the CI job fails, surfacing the drift

## Non-goals

- No real ERP, SUNAT, SIRE, bank, e-invoicing, or document connector.
- No credentials, KMS, vault, rotation, or key-lifecycle implementation (KMS runbooks are later SDD-110 slices).
- No network, HTTP, filesystem, PostgreSQL, cloud SDK, or vendor dependency.
- No production storage, observability, incident workflow, or runbook.
- No pilot or open-core transition decision.
- No `DECLARED_ADAPTERS` population and no `flow/close.ts` wiring (Option B, deferred).
- No change to the fetch-only `EvidenceAdapter` or `LocalFileAdapter` surfaces (Option C, rejected).
- No materiality decision, policy authority, or gate bypass.
- No capability promotion; relevant matrix rows remain `planned`.
- No freeze of `connector-adapter` v0.1.

## Open questions for design

1. **Result vocabulary.** The proposal requires a discriminated result with a SUCCESS branch
   and an UNKNOWN branch. Whether a definitive `FAILED`/`REFUSED` branch exists alongside
   them, and its exact shape, is a design decision — the only mandate is that no branch other
   than SUCCESS may claim external execution, and only with evidence.
2. **Scope branding ownership.** REQ-CONN-004 is satisfied either by accepting raw
   `TenantScope` and validating at the connector boundary with `validateTenantScope`, or by
   accepting only an already-branded `ValidatedTenantScope`. Which boundary owns the brand is
   a design decision.
3. **Idempotency store wiring.** The contract mandates reuse of `IdempotencyStore`-shaped
   records but not where the store instance is injected (mock suite vs. connector-internal
   composition); that wiring is design.
4. **Receipt construction in conformance.** REQ-CONN-005 requires evidence-bound success
   compatible with `EXTERNAL_SUBMISSION`; whether the conformance vector constructs the
   receipt or only asserts receipt-kind compatibility is a design decision.

## Conflicts and composition notes with existing primitives

- `missions/reconciliation.ts` `ExternalCall` carries `stableIdentifier`, `system`, and
  `missionId` but NOT tenant scope or idempotency key. This is not a semantic conflict:
  REQ-CONN-003 composes with `reconcileExternalCall` unchanged, while REQ-CONN-001 and
  REQ-CONN-004 enforce key binding and scope isolation at the connector boundary before
  reconciliation. A future primitive extension is out of scope for this slice.
- `canonicalHash` is defined in `missions/runtime.ts` (not `missions/idempotency.ts`) and is
  exported through the missions barrel; the contract references it as the single canonical
  hash primitive without duplicating it.
- `isVerifiableEvidence` requires `responseHash` to match `/^[0-9a-f]{64}$/`; success
  evidence must satisfy this or reconciliation throws `EXECUTED_WITHOUT_EVIDENCE`. The
  contract inherits this constraint.
- Existing runtime idempotency records cache both success and failure outcomes for replay;
  REQ-CONN-001 inherits that behavior (a recorded failure is replayed, never re-attempted).
