# SDD-110 (Production) — Connector-Adapter Conformance First Slice

> Status: Proposal
> Contract target: `connector-adapter` v0.1, DRAFT
> Roadmap: Peru v1, 16-program roadmap, Wave 4
> Scope: Drenyra AI Core contract, type surface, and mock conformance only

## Intent

Establish the transport-agnostic mutation boundary that future restricted ERP,
SUNAT/SIRE, bank, e-invoicing, and document connectors must satisfy before any
vendor integration is shipped or represented as available.

This slice pins Core semantics for idempotent execution, UNKNOWN reconciliation,
tenant scope isolation, restricted authority, and evidence-bound success. It
proves them with a mock adapter, not a real connector.

The proposal selects exploration Option A: a DRAFT contract, a node:crypto-only
type-level surface, and a CI-running conformance suite. This is the smallest
durable slice that reduces integration risk without making capability claims.

## Current state and gap

Drenyra AI has a fetch-only adapter abstraction:

- `EvidenceAdapter` declares evidence-fetch capabilities.
- It fetches evidence for a mission, RUC, and fiscal period.
- It reports obtained and missing evidence without treating absence as zero.
- `LocalFileAdapter` is a test-only local implementation.
- `flow/close.ts` consumes this read port for deterministic monthly close.

That surface does not model external mutations. It has no execute operation,
idempotency binding, UNKNOWN result, stable external identifier, or
reconciliation obligation. Expanding it directly would mix materially different
responsibilities and destabilize the working SDD-050 flow.

Core already provides the required safety primitives:

- `missions/idempotency.ts`: key validation, canonical payload hashing, replay,
  and fail-closed `IDEMPOTENCY_CONFLICT` behavior.
- `missions/reconciliation.ts`: `record`, `retry`, or `human-intervention`, with
  verifiable evidence required for executed outcomes.
- `missions/transitions.ts`: constrained recovery from UNKNOWN.
- `tenant-core`: validated company, RUC, and period scope.
- Receipts: the existing `EXTERNAL_SUBMISSION` type.
- Ledger: append-only audit evidence, never an external write path.

The gap is a dedicated mutation-adapter contract that composes these primitives
into mandatory invariants, plus an executable conformance suite that detects
drift. Without it, future connectors could interpret replay, UNKNOWN, scope,
evidence, and authority limits inconsistently.

## Proposed change

### Option A — selected first slice

Add:

1. `contracts/connector-adapter.md`
   - Version 0.1, status DRAFT.
   - Transport-agnostic mutation-adapter contract.
   - Idempotency, UNKNOWN reconciliation, tenant scope, restricted authority,
     and verifiable-response invariants.
   - Explicit distinction from fetch-only `EvidenceAdapter`.

2. `adapters/connector.ts`
   - `ConnectorAdapter`, execution input, and discriminated result types.
   - UNKNOWN result with a stable reconciliation identifier.
   - Reconciliation-facing types or helpers composed from existing primitives.
   - Fail-closed idempotency, scope, and evidence validators.
   - `node:crypto` as the only permitted Node built-in; no I/O.

3. `adapters/__tests__/connector-conformance.test.ts`
   - In-memory, test-only `MockConnectorAdapter` driver.
   - Replay, conflict, UNKNOWN reconciliation, scope, authority, and
     evidence-bound-success vectors.
   - Execution by the existing Vitest CI job.

4. Index updates
   - Export from `adapters/index.ts`.
   - Add the DRAFT contract to `contracts/README.md`.

Option A creates the seam before vendor work, reuses RDA safety primitives, and
fits one review unit. The contract remains DRAFT despite CI coverage, following
the `brand-system` precedent: conformance controls drift now; ecosystem adoption
and explicit approval are required before freezing.

### Option B — follow-up

Option B adds registration in `DECLARED_ADAPTERS` and integration with
`flow/close.ts`. It is deferred because no real connector exists to declare,
registration could imply availability, and the live monthly-close path would
increase blast radius beyond conformance pinning.

### Option C — rejected for this slice

Option C unifies or replaces `EvidenceAdapter` with a fetch-and-mutate port. It
is rejected because retrieval and mutation have different authority, risk, and
failure semantics. It would churn SDD-050 without improving this slice.

## Architecture mapping

### Peru v1 roadmap and coordination

This is a Wave 4 Core contribution to SDD-110 in the approved 16-program Peru v1
roadmap. It prepares the seam for planned SUNAT/SIRE, ERP, bank, e-invoicing, and
document integrations, but completes none of them.

- SDD-100 provides the product surface entering production.
- SDD-040 coordinates RDA idempotent execution and UNKNOWN reconciliation; this
  slice consumes those semantics instead of creating a parallel protocol.
- SDD-050 remains unchanged; its evidence-fetch close flow is not wired here.

Restricted adapters, KMS, production storage, observability, pilots, and the
open-core gate remain planned. No capability-matrix row is promoted under R17.

### Approved layer model

The change respects:

`contracts -> library modules -> agents -> cmd`

The normative document belongs in `contracts/`; executable types belong in the
`adapters/` library. No agent or command change is needed. The library remains
transport-agnostic and node:crypto-only, with no HTTP, network, database,
filesystem, cloud, UI, credential, or commercial connector dependency.

### AI advisory versus deterministic authority

AI may orchestrate intent and stage work, but deterministic Core rules retain
authority over execution eligibility, idempotency, reconciliation, scope, gates,
and receipts. A connector performs only an already restricted external action.
It never decides materiality, reinterprets policy, or skips a gate.

### Audit ledger versus accounting journal

The ledger records attributable audit evidence and hash-chain history. It is not
the accounting journal and does not authorize connector mutations. Connector
evidence and an `EXTERNAL_SUBMISSION` receipt cannot directly create or rewrite
journal truth; deterministic journal and policy rules retain that authority.

### Evidence versus memory

External success requires durable, attributable, hash-addressed evidence.
Narrative memory, model recollection, unsupported logs, or adapter assertion do
not prove execution. UNKNOWN remains UNKNOWN until reconciliation obtains
verifiable evidence, proves safe idempotent retry, or requires a professional.

### Constitutional rule 10

Core contracts and verifiers never depend on cloud, UI, or commercial
connectors. This proposal defines the Core seam while keeping vendor
implementations outside the Core dependency direction.

## Requirements preview

The specification should refine these with RFC 2119 language and
Given/When/Then scenarios.

- **REQ-CONN-001 — Idempotent execute.** Execution carries a valid key bound to a
  canonical command hash. Same-key/same-payload replay returns the same result
  without another mutation. Different-payload reuse fails with
  `IDEMPOTENCY_CONFLICT`.

- **REQ-CONN-002 — UNKNOWN outcome.** An indeterminate call may return UNKNOWN
  with a stable identifier suitable for external correlation. The adapter does
  not fabricate executed or not-executed outcomes.

- **REQ-CONN-003 — Reconciliation mapping.** Executed maps to `record` only with
  evidence; not-executed maps to `retry` only when idempotent; indeterminate maps
  to `human-intervention`.

- **REQ-CONN-004 — Scope isolation.** Execution binds to validated company, RUC,
  and period scope. Mismatch or cross-tenant access fails before mutation or
  evidence acceptance.

- **REQ-CONN-005 — Evidence-bound success.** Success includes stable identifier,
  external state, provenance, moment, and response hash. The receipt type is
  `EXTERNAL_SUBMISSION`.

- **REQ-CONN-006 — Restricted authority.** An adapter acts only for its declared
  system, jurisdiction, and operation. It never decides materiality, changes
  policy, bypasses gates, or expands its own authority.

- **REQ-CONN-007 — No credentials or network.** Core and conformance code contain
  no credentials and perform no live network, filesystem, database, or vendor
  calls. The library remains node:crypto-only.

- **REQ-CONN-008 — DRAFT; no capability claims.** v0.1 remains DRAFT. Connector
  capability rows stay `planned`; a contract or mock is not an implementation.

- **REQ-CONN-009 — CI drift gate.** CI runs connector conformance and fails when
  typed behavior or normative vectors drift from the DRAFT contract.

## First-slice scope

In scope:

- One DRAFT v0.1 normative contract.
- One transport-agnostic mutation-adapter type surface.
- Reuse of idempotency, reconciliation, tenant, and receipt primitives.
- Small fail-closed validators required by the conformance surface.
- One mock-driven conformance suite.
- Adapter barrel and contract index updates.

## Non-goals

- No real ERP, SUNAT, SIRE, bank, e-invoicing, or document connector.
- No credentials, KMS, vault, rotation, or key lifecycle implementation.
- No network, HTTP, filesystem, PostgreSQL, cloud SDK, or vendor dependency.
- No production storage, observability, incident workflow, or runbook.
- No pilot or open-core transition decision.
- No `DECLARED_ADAPTERS` population or `flow/close.ts` wiring.
- No change to `EvidenceAdapter` or `LocalFileAdapter`.
- No materiality decision, policy authority, or gate bypass.
- No capability promotion; relevant rows remain `planned`.
- No freeze of `connector-adapter` v0.1.

## Product tradeoffs

Option A favors a testable boundary over immediate user-visible integration.
Users gain no live connector yet, but later integrations gain uniform safety
rules and lower duplicate-execution and reconciliation risk.

Deferring Option B avoids implied readiness and protects the close flow, while
postponing end-to-end feedback until a concrete connector is scoped.

Rejecting Option C preserves explicit read-port and mutation-port duties at the
cost of two adapter concepts. That cost is preferable to hiding distinct
authority and failure semantics behind one broad interface.

DRAFT status permits learning but withholds frozen stability. CI conformance
limits accidental drift without overstating maturity.

## Impact and affected areas

Expected files:

- `contracts/connector-adapter.md`
- `contracts/README.md`
- `adapters/connector.ts`
- `adapters/index.ts`
- `adapters/__tests__/connector-conformance.test.ts`

Mission, tenant, receipt, flow, command, and capability surfaces should be reused
or unchanged. No migration is expected because the new surface is additive and
DRAFT. Connector teams gain a driver target; Core maintainers gain CI evidence.
Operations gain no deployable connector from this slice.

## Risks and mitigations

- **Scope creep into integration.** Network, credentials, command wiring, or
  vendor behavior violates the boundary. Mitigate with node:crypto-only code,
  an in-memory mock, and unchanged runtime declarations.
- **Premature maturity claims.** Passing tests may be mistaken for production.
  Mitigate with DRAFT labels, `planned` matrix rows, and explicit mock language.
- **Collision with `EvidenceAdapter`.** Two ports may confuse consumers.
  Mitigate by documenting fetch versus mutation and leaving SDD-050 untouched.
- **Primitive divergence.** Reimplemented idempotency or reconciliation could
  drift. Mitigate by importing existing definitions and testing composition.
- **False success after ambiguity.** A timeout may cause duplication or false
  evidence. Mitigate with UNKNOWN, stable identifiers, fail-closed
  reconciliation, and verifiable evidence before success.

Top risk is semantic drift between the DRAFT adapter contract and existing RDA
primitives, especially around UNKNOWN and replay. Reuse plus CI conformance is
the primary control.

## Rollback

Rollback removes the DRAFT document, type surface, mock suite, and exports as one
additive unit. This slice creates no connector mutation, credential, production
state, journal entry, or historical receipt, so no data rewrite is needed.

After a future connector adopts the surface, rollback would require a versioned
migration that preserves historical receipts; that obligation is outside this
slice.

## Success criteria and test hints

The slice succeeds when:

- The DRAFT contract states all execution, reconciliation, scope, authority,
  evidence, and maturity invariants.
- Strict TypeScript compiles the transport-agnostic, node:crypto-only surface.
- Same-key/same-payload replay causes no second mock mutation.
- Same-key/different-payload fails with `IDEMPOTENCY_CONFLICT`.
- UNKNOWN exposes a stable identifier.
- Executed plus evidence maps to `record`.
- Proven non-execution maps to idempotent `retry`.
- Indeterminate outcome maps to `human-intervention`.
- Missing executed evidence and tenant mismatch fail closed.
- Conforming success binds to `EXTERNAL_SUBMISSION`.
- CI detects conformance drift.
- Capability rows remain `planned`; no connector is declared.

Later apply verification should run `bun run typecheck` and `bun run test`.
Run `bun run lint` only if the command exists then. This slice measures the
SDD-110 connector metrics: idempotency, UNKNOWN reconciliation, and scope
isolation. KMS, recovery drills, pilots, and production composition remain later.

## Delivery shape

Deliver one PR at approximately 320–380 changed lines, under SDD-110's 400-line
review limit, with no size exception. If safety invariants do not fit, split
index/documentation mechanics from the typed surface rather than weakening
conformance.

## Proposal question round

The supplied exploration bounds the slice. These product assumptions need review
before specification:

1. Is `stableIdentifier` mandatory for every result, or only UNKNOWN and success?
2. Does the adapter return a receipt-ready descriptor, or does deterministic Core
   construct `EXTERNAL_SUBMISSION` from verified adapter evidence?
3. Must v0.1 enumerate allowed mutation operations in addition to system and
   jurisdiction to make restricted authority mechanically testable?
4. Is the existing Vitest CI job sufficient for DRAFT v0.1, or is a dedicated
   connector-conformance job required before ecosystem adoption?

Working assumptions: stable identifiers are mandatory for UNKNOWN and success;
Core owns receipt construction; v0.1 declares operations without vendor detail;
and the existing test job is sufficient while DRAFT. These questions refine
authority and compatibility without changing the no-network, no-claim slice.
