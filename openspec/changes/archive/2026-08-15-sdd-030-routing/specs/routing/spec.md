# Routing Specification

## Purpose

The routing domain defines the typed request and result boundary for organic accounting work in Drenyra AI: a `WorkUnit` request envelope and a `WorkResult` structured result. The surface is transport-agnostic, additive, and proposes only: it captures exact scope, evidence provenance, pinned skills and policies, bounded attempts, candidate identity, and deterministic transition compatibility without executing work, writing ledgers, changing authorization, or altering the frozen 15-state mission lifecycle. Runtime budget enforcement and the preflight route-selection router are explicitly deferred to later slices; this specification covers only the `WorkUnit` and `WorkResult` type surfaces and their conformance tests.

## Requirements

### Requirement: WorkUnit Surface

The system MUST provide a typed `WorkUnit` record that represents one unit of accounting work and MUST carry: a stable identity; the exact objective; linkage to its originating mission by mission id; the full scope (tenant, RUC, company, and fiscal period); evidence permitted by hash reference; skills and policies pinned by version; authorized tools and destinations; a mandatory output schema; time, token, cost, research-attempt, and correction budgets; a verifiable success condition; and typed stop reasons.

The `WorkUnit` MUST link to a mission by the mission id and MUST be constructible from a mission snapshot plus the routing-specific inputs so that its mission linkage and scope agree with the snapshot's identity and scope. Its initial stage MUST be `DRAFT`, the canonical mission entry state. The RUC MUST be exactly 11 digits and the fiscal period MUST be `YYYYMM`, matching the canonical candidate scope shape.

The `WorkUnit` stage vocabulary MUST be exactly the canonical 15-state `AccountingMissionStatus`: `DRAFT`, `QUEUED`, `RUNNING`, `BLOCKED`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `COMPLETED`, `FAILED`, `UNKNOWN`, `RECOVERING`, `WAITING_FOR_EVIDENCE`, `BLOCKED_BY_GATE`, `RETRYING`. The surface MUST NOT introduce, rename, or reference any state outside these 15, and MUST NOT create a parallel lifecycle model. Every stage change MUST be a valid transition per the canonical transition matrix used by the mission Core (`VALID_TRANSITIONS`, with recovery paths only from `UNKNOWN`); a stage change that is absent from the canonical matrix MUST NOT be representable.

Budget fields MUST be typed with the fiscal convention: cost budgets MUST be `BigInt` in minimum monetary units (cents); research/technical attempt limits and frozen-candidate correction limits MUST be JSON integers; no monetary amount MAY be a JavaScript `Number` and no budget counter MAY be a floating-point value. The two budgets MUST remain distinct: research/technical execution attempts with a configurable maximum (initially up to 3) and frozen-candidate correction with a maximum of one (1). This slice defines the budget types and bounds; runtime enforcement of budgets is a non-goal of this slice.

Stop reasons MUST be a closed union of typed reasons. A free-text explanation MAY accompany a stop but MUST NOT establish, override, or replace the typed reason; when no typed reason applies, the surface MUST fail closed rather than accept free text as authority for stopping.

#### Scenario: WorkUnit constructed from a mission

- GIVEN a mission snapshot with a known mission id, `companyId`, `fiscalPeriod`, and `intent`
- WHEN a `WorkUnit` is constructed for that mission with an objective, full scope, evidence-by-hash, pinned skills and policies, budgets, a success condition, and typed stop reasons
- THEN the `WorkUnit` MUST reference the same mission id and MUST agree with the snapshot's company, fiscal period, and intent scope, and its initial stage MUST be `DRAFT`

#### Scenario: Stage alignment across the 15 canonical states

- GIVEN a `WorkUnit` at stage `QUEUED`
- WHEN its stage is advanced to `RUNNING`
- THEN the change MUST be accepted because `RUNNING` is a valid target of `QUEUED` in the canonical transition matrix
- AND WHEN its stage is instead advanced directly from `QUEUED` to `COMPLETED`
- THEN the change MUST NOT be representable because `COMPLETED` is not a valid target of `QUEUED`, and no parallel state model MAY be introduced to carry it

#### Scenario: Budget types and bounds

- GIVEN a `WorkUnit` carrying a cost budget and the two attempt budgets
- WHEN the budget values are represented
- THEN the cost MUST be `BigInt` in cents, the research/technical attempt maximum MUST be a JSON integer with a default of up to 3, the frozen-candidate correction maximum MUST be a JSON integer equal to 1, and no budget field MAY be a floating-point value

#### Scenario: Typed stop reason fails closed

- GIVEN a `WorkUnit` that must stop and no typed stop reason applies
- WHEN a stop is recorded
- THEN the stop MUST NOT be accepted from free text alone; only a member of the closed union of typed stop reasons MAY record the stop

### Requirement: WorkResult Surface

The system MUST provide a typed `WorkResult` record whose authoritative values are structured fields: `outcome`, `evidenceRefs`, `proposedCandidates`, `unresolvedExceptions`, `policyVersions`, `toolProvenance`, `costAndAttempts`, and `nextTransition`. Free text MAY accompany the result as explanation but MUST NOT be the source of authoritative amounts, states, permissions, approvals, or transitions.

Each `evidenceRefs` entry MUST be a content hash over the exact evidence bytes. A memory reference, identifier, or free text MUST NOT satisfy an evidence reference.

Each `proposedCandidates` entry MUST identify a candidate by its `subjectHash` — the content hash over the exact reviewed candidate bytes. Materiality MUST be derived from the candidate's `BigInt` cents value, reversibility, and jurisdiction, never from agent claims or free text; free text MUST NOT stand in for candidate identity.

`costAndAttempts` MUST follow the fiscal convention: costs MUST be `BigInt` in minimum monetary units (cents) and attempt counts MUST be JSON integers; no cost MAY be a JavaScript `Number` and no counter MAY be a floating-point value.

`nextTransition` MUST be the value produced or validated by the same deterministic transition function that feeds mission status and apply over the canonical 15-state matrix, so that surfaces cannot contradict authority. A `nextTransition` pair MUST be accepted only when the canonical transition function accepts it — a valid target of the current state per the matrix, or a valid recovery target from `UNKNOWN` (`RUNNING`, `FAILED`, or `COMPLETED`). A transition absent from the canonical matrix MUST NOT be expressible as a valid `nextTransition`. The surface MUST NOT implement a new negotiated-status view; it only records a transition value compatible with the existing deterministic model.

#### Scenario: WorkResult construction with BigInt cents

- GIVEN a monetary amount produced by the work
- WHEN the `WorkResult.costAndAttempts` is constructed
- THEN the amount MUST be a `BigInt` in cents, the attempt counters MUST be JSON integers, and no monetary value MAY be a JavaScript `Number` or float

#### Scenario: Evidence refs by hash

- GIVEN evidence produced for the work
- WHEN the `WorkResult` records the evidence in `evidenceRefs`
- THEN each reference MUST equal the content hash of the exact evidence bytes, and no memory reference or free text MAY substitute for a hash

#### Scenario: Proposed candidates by subjectHash

- GIVEN a candidate produced by the work
- WHEN it is recorded in `proposedCandidates`
- THEN it MUST be identified by the candidate's `subjectHash` and its materiality MUST derive from `BigInt` cents value, reversibility, and jurisdiction — never from free text or agent claims

#### Scenario: nextTransition consistent with status and apply

- GIVEN a mission in state `RUNNING` and a `WorkResult` proposing `AWAITING_APPROVAL` as its next transition
- WHEN the pair is validated against the canonical deterministic transition function used by status and apply
- THEN the transition MUST be accepted because `AWAITING_APPROVAL` is a valid target of `RUNNING` in the canonical matrix, and the same function MUST accept it in both status and apply paths
- AND WHEN the pair proposes a state that is not a valid target of `RUNNING` in the canonical matrix
- THEN the pair MUST NOT be expressible as a valid `nextTransition`

#### Scenario: No free-text authority

- GIVEN a `WorkResult` carrying both structured fields and a free-text explanation
- WHEN an authority consumer inspects the result
- THEN only the structured fields MAY determine amounts, states, permissions, approvals, or transitions, and the explanation MUST NOT override any structured field

### Requirement: Boundary Compliance

The routing surface MUST be additive and MUST import only mission and candidate types; it MUST NOT import `agents/`, commands, adapters, or any other consumer surface, and its imports from the mission and candidate modules MUST be type-only. The mission Core MUST remain frozen: it MUST NOT import routing, agents, commands, or adapters, and no reverse import MAY be introduced by this slice.

The first slice MUST NOT write to any ledger, receipt, journal, or audit store, and MUST NOT change authorization, materiality, approval, or segregation-of-duties behavior. It MUST NOT add, rename, or remove any of the 15 canonical mission states.

The surface MUST propose only: it MAY express a proposed transition, route, or candidate, but it MUST NOT grant execution authority, pre-authorize an operation, or perform work itself. Only the Core determines allowed transitions, and only an authorized adapter executes an approved operation.

#### Scenario: Import boundary holds

- GIVEN the routing surface's dependency graph
- WHEN its imports are inspected
- THEN it MUST import only mission and candidate types, all such imports MUST be type-only, and it MUST NOT import `agents/`, commands, or adapters

#### Scenario: Frozen Core has no reverse imports

- GIVEN the mission Core module graph
- WHEN its imports are inspected after this slice lands
- THEN it MUST NOT import routing, agents, commands, or adapters, and the import graph MUST be identical in direction to the pre-change graph

#### Scenario: Surface proposes only

- GIVEN a `WorkUnit` or `WorkResult` produced by the routing surface
- WHEN the surface is invoked
- THEN it MUST perform no work execution, MUST write no ledger, receipt, journal, or audit entry, MUST change no authorization or approval behavior, and MAY only express a proposal that the Core must validate

### Requirement: Testability

The first slice MUST ship with focused conformance tests and strict TypeScript typechecking over the pure-type boundary, and MUST cover at least: `WorkUnit` construction from a mission; stage alignment across all 15 canonical states; budget typing and default bounds; typed stop reasons; `WorkResult` construction with `BigInt` cents; evidence refs by hash; proposed candidates by `subjectHash`; `nextTransition` consistency with the canonical transition function; and import-boundary compliance with no reverse imports. All conformance tests MUST be deterministic and MUST NOT depend on a transport, network, external system, or runtime service. The tests MUST pass without requiring changes to existing mission, handler, or candidate behavior, and existing behavior MUST remain unchanged.

#### Scenario: Conformance matrix passes

- GIVEN the first-slice conformance test suite and the strict typechecker
- WHEN the suite runs against the `WorkUnit` and `WorkResult` surfaces
- THEN every conformance scenario in the matrix MUST pass — construction, 15-state stage alignment, budget typing and bounds, typed stop reasons, `BigInt` cents, evidence refs by hash, `proposedCandidates` by `subjectHash`, `nextTransition` consistency, and import-boundary compliance — and typechecking MUST pass

#### Scenario: Deterministic and offline

- GIVEN the conformance test suite
- WHEN it runs twice in sequence without network or external services
- THEN both runs MUST produce identical pass/fail results and MUST require no transport, network, or external runtime

#### Scenario: Existing behavior unchanged

- GIVEN the pre-change mission and handler test suites
- WHEN they run after the first slice lands
- THEN they MUST produce the same results as before the change, and the first-slice tests MUST NOT require or introduce modifications to mission, handler, or candidate behavior
