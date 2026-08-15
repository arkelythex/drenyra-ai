# Contract: connector-adapter

> Version: 0.1 · Status: DRAFT · Transport-agnostic.
>
> The **mutation boundary** for restricted ERP, SUNAT/SIRE, bank, e-invoicing, and
> document connectors: an adapter declares exactly what it may do, executes an
> idempotent mutation once, and returns either verifiable evidence or uncertainty —
> never a guess.

<!-- -->

> [!IMPORTANT]
> **Status: DRAFT at v0.1** — the normative surface is pinned by a conformance
> suite (`adapters/__tests__/connector-conformance.test.ts`) that runs in CI (the
> existing Vitest `test` job) and fails on drift. Freezing requires ecosystem
> adoption plus explicit contract approval (the `brand-system` precedent). A
> passing suite proves the surface is freezable; it does NOT prove a connector
> exists.

The **connector-adapter** contract defines how future connectors MAY submit
external submissions to ERP, SUNAT/SIRE, bank, e-invoicing, or document systems
without minting receipts, deciding materiality, or claiming capabilities the
ecosystem has not approved. It sits **beside** — never replaces — the fetch-only
`EvidenceAdapter` port: retrieval and mutation have different authority, risk,
and failure semantics, so their contracts stay separate.

## Purpose

- Give every mutation connector the **same idempotent execution, scope
  isolation, restricted authority, and evidence-bound success semantics**.
- Define what an adapter MAY claim: a declared system + jurisdiction +
  operations, executed at most once per idempotency key.
- Make "no drift" an enforced property: the conformance suite fails CI on any
  typed or behavioral drift from this document.
- Keep determinism with deterministic Core: Core owns receipts; an adapter
  returns evidence, never a signed artifact.

## Normative surface

- **Capability.** `ConnectorCapability` declares `system`, `jurisdiction`, and
  mutation `operations` (v0.1 declares operations without vendor detail).
- **Branded input.** `ConnectorExecuteInput` carries a `ValidatedTenantScope`
  (companyId + 11-digit RUC + YYYYMM period). Raw tenant scopes are validated by
  `validateTenantScope` before the port; the adapter never sees an unchecked scope.
- **Result.** `SUCCESS` carries verifiable `ExternalEvidence`; `UNKNOWN` carries a
  `stableIdentifier` and no verdict. There is no `FAILED`/`REFUSED` result
  branch: definitive failures are errors, recorded and replayed, never external
  outcomes.
- **Store injection.** A `ConnectorAdapterFactory` receives the existing
  `IdempotencyStore` once at composition; execution binds the idempotency key to
  the canonical command hash of the immutable envelope (mission ID, target,
  validated scope, command).
- **Reconciliation.** `UNKNOWN` is resolved by the existing `reconcileExternalCall`
  over `ExternalCall`; no parallel resolver or decision vocabulary exists.

## Invariants

1. **Replay.** Same key + same envelope replays the recorded result, success or
   failure, without re-execution. Same key + different envelope fails closed with
   `IDEMPOTENCY_CONFLICT`. Concurrent same-key attempts fail closed
   (`ALREADY_EXECUTING`); at most one mutation proceeds per key.
2. **UNKNOWN honesty.** An interrupted call returns `UNKNOWN` with a stable
   identifier; the adapter never fabricates an executed or not-executed verdict
   and never claims external execution without verifiable evidence.
3. **Scope isolation.** Every execution binds to a validated tenant scope; any
   cross-tenant response or evidence is rejected before mutation and before
   evidence acceptance.
4. **Restricted authority.** An adapter performs only its declared system,
   jurisdiction, and operations; an undeclared request fails closed before
   mutation, and an empty operations list grants no authority.
5. **Evidence-bound success.** Only a SUCCESS-shaped result may claim external
   execution, and only with evidence satisfying `isVerifiableEvidence`
   (hash-addressed, provenance-tagged, lowercase 64-hex response hash).
6. **Core-owned receipts.** Deterministic Core constructs the
   `EXTERNAL_SUBMISSION` receipt from adapter evidence; the adapter never mints,
   signs, or issues receipts.
7. **No I/O, no credentials.** The contract module performs no network,
   filesystem, database, cloud, or vendor call and holds no credentials; payload
   hashing is `node:crypto` through the missions barrel.

## Fail-closed behavior and inherited error identities

Validation, authority, and replay precede mutation; scope and evidence checks
precede evidence acceptance. The connector boundary reuses existing error
identities verbatim: `IdempotencyConflict` (different payload), `TenantScopeError`
(invalid scope), `ReconciliationError` (`NO_RESOLVER`,
`EXECUTED_WITHOUT_EVIDENCE`, `RESOLVER_FAILED`). Connector-only failures use the
small `ConnectorValidationError` vocabulary (`INVALID_IDEMPOTENCY_KEY`,
`ALREADY_EXECUTING`, `SCOPE_MISMATCH`, `UNDECLARED_SYSTEM`,
`UNDECLARED_JURISDICTION`, `UNDECLARED_OPERATION`, `UNVERIFIABLE_EVIDENCE`,
`INVALID_STABLE_IDENTIFIER`).

## Conformance

- **Vectors.** The in-memory `MockConnectorAdapter` must pass every normative
  vector: idempotent replay, `IDEMPOTENCY_CONFLICT`, UNKNOWN reconciliation
  (record/retry/human-intervention), scope-mismatch rejection, restricted-authority
  rejection, and evidence-bound success.
- **Drift gate.** Any vector that drifts from this document (for example, replay
  re-executing or success without evidence) fails the suite and the CI `test` job.
- **CI:** the suite runs automatically in the existing `test` job; no workflow
  change is required.

## Compatibility

DRAFT changes are expected; each change bumps the version and updates the
conformance vectors in lockstep. Nothing in v0.1 is frozen or implied stable.

## Freeze criteria

v0.1 freezes only after (1) documented ecosystem adoption of the surface and
(2) explicit contract approval by the maintainers, following the `brand-system`
precedent. CI pinning now controls drift; it does not freeze.

## Non-claims

This DRAFT does not ship or claim: a live ERP, SUNAT/SIRE, bank, e-invoicing, or
document connector; adapter registration or `DECLARED_ADAPTERS` population;
`flow/close.ts` wiring; capability-matrix promotion; a production idempotency
store; KMS, vault, or key lifecycle; network or vendor integration; receipt
issuance; or policy/materiality authority.
