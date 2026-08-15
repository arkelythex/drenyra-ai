# RDA v2 (SDD-040) Closure Specification

## Purpose

This specification governs the documentation-only closure of the SDD-040 (Receipt-Driven Accounting v2) program record. The RDA v2 capability is already implemented, exported, and tested; the closure reconciles the SDD-040 lifecycle record (`openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2/README.md`, currently `lifecycle:planned`) with the implemented surface by mapping surface to declared scope, recording five known vocabulary/cardinality differences as explicit non-goals, and closing the record truthfully under the Dominion five-axis status vocabulary. This change adds no code, changes no frozen contract, and closes no downstream SDD.

Scope mapping target: every SDD-040 declared scope area and RDA v2 invariant (authority-model §5, §5.8). Evidence sources: the archived fiscal-authority-kernel closure (PR #32) and the later routed-candidate slices, which together establish the implemented and verified surface.

## Requirements

### Requirement: Implemented-Surface Mapping

The SDD-040 closure MUST map every declared scope area and RDA v2 invariant of the SDD-040 record to the implemented surface, and MUST cite revision-bound evidence for that surface. Each mapping MUST name the concrete module or symbol that satisfies the scope item, or MUST identify the item as a recorded gap under the Gap Recording requirement; no scope item MAY be left unmapped.

The mapping MUST cover at least:

- candidate lifecycle and R0–R3 materiality — `CandidateLifecycle` (`propose/inspect/submitForReview/accept/reject/correct`), `candidateIdentity`, `deriveMateriality`, `Materiality = R0|R1|R2|R3`, `CorrectionRecord` (bounded, at-most-once correction) in `candidates/`;
- Ed25519 signed receipts — `SignedReceipt`, `buildSignedReceipt`, `verifySignedReceipt`, `generateReceiptKeyPair` in `receipts/`, with receipts never over-claiming;
- append-only audit validation — `validateLedger`, `GENESIS_EMPTY_HASH`, `LedgerManifest` in `ledger/`, treated as history and not the accounting journal;
- fail-closed gate recalculation and distinct approval — `GateRunner.run` (first non-`allowed` stops), `ApprovalGate`, `distinctApprovers`, `ReceiptGate`, `MissionStateGate` in `gates/`, with approval distinct from execution and Guardian excluded from any quorum;
- UNKNOWN reconciliation — mission `UNKNOWN` status, `reconcileMission`, `recoveryAction`, `decideUnknownRecovery`, `replayMission` in `missions/` and `recovery/`, with zero blind retries after `UNKNOWN`;
- proportional review — `ReviewLens`, `ALL_4R_LENSES`, `selectReviewLenses`, `forecastReviewWorkload` in `review/`, plus judgment-day review;
- journal, evidence, fiscal ordering, PE policy, CDR successor composition, tenant-core/isolation, and monthly close — `journal/` (`record`, `post`, `supersede`, `revoke`; BigInt cents, balanced, signed, never in-place), `evidence/` (`acceptEvidence`, `registerEvidence`, `assertEvidenceInScope`), `fiscal/FiscalCandidateOrderingAdapter`, `policy/evaluatePePolicy` and `govern`, `cdr/CdrSuccessorComposer`, `tenant-core/ValidatedTenantScope`, and `flow/runMonthlyClose` as the end-to-end deterministic authority composition.

The closure MUST cite the archived fiscal-authority-kernel evidence (`openspec/changes/archive/2026-08-15-fiscal-authority-kernel/`, PR #32): 41/41 requirements, 61/61 scenarios, 774/774 tests, clean typecheck, and empty `contracts/` delta, bound to revision `4975f4f`, and MUST cite the later suite baseline 843/843 bound to `57ea56a` (sdd-030-routing) as the current unchanged baseline.

#### Scenario: Every scope item maps to an implemented symbol with evidence

- GIVEN the SDD-040 record declaring its scope areas and RDA v2 invariants
- AND the fiscal-authority-kernel archive and later slices providing revision-bound verification evidence
- WHEN the closure spec is reviewed item by item
- THEN every declared scope area and invariant names at least one implemented module or symbol as evidence
- AND any item without a direct symbol is explicitly listed as a gap under the Gap Recording requirement

#### Scenario: Mapping claims are traceable to a bound revision

- GIVEN a closure mapping claim naming a module or symbol
- WHEN the claim's evidence is inspected
- THEN the claim resolves to the archived kernel verify envelope (requirements 41/41, scenarios 61/61, tests 774/774 at `4975f4f`) or to the 843/843 baseline at `57ea56a`
- AND no claim references a revision or suite total that does not exist in the evidence

### Requirement: Gap Recording

The closure MUST record the five known vocabulary and cardinality differences between the SDD-040 declaration and the implemented surface as explicit documented non-goals, each with a reason and the compositional mechanism that satisfies the underlying semantics. The closure MUST NOT silently ignore any gap, and MUST NOT claim any gap is implemented as a one-to-one symbol when it is not.

The five gaps MUST each be recorded:

1. receipt claim types — the implemented `ReceiptType` union has 4 claim types (`APPROVAL`, `EXECUTION`, `COMPLETION`, `EXTERNAL_SUBMISSION`) rather than the 7 declared names (Analysis, Review, Approval, Authorization, Execution, Reconciliation, Close package); the shared signed envelope is implemented and the declared claims are satisfied compositionally via missions, recovery, and flow;
2. review lenses — the implemented lens vocabulary is the 4R code-review set plus judgment-day rather than the 8 declared fiscal-domain lens symbols (scope, evidence, accounting, tax, materiality, execution, fraud/adversarial, explainability);
3. candidate identity cardinality — the implemented canonical identity is a compact 3-element key (`subjectHash:scope.ruc:scope.period`) rather than one 13-field identity structure; the broader envelope exists across tenant-core, evidence, policy, and skills modules but is not collapsed into a single 13-field structure;
4. capacity ceilings — ceilings are enforced compositionally (propose entry R2, record material entry R3, file with SUNAT R3, delete evidence/receipts forbidden) but are not exposed as one dedicated versioned ceiling matrix;
5. execution/reconciliation receipt symbols — execution and reconciliation semantics exist across receipts, missions, and recovery, but there is no distinct `EXECUTION` versus `RECONCILIATION` receipt claim symbol pair matching the declared vocabulary.

Each recorded gap MUST state that it is a deferred vocabulary/model non-goal of this closure, not a commitment to implement within this change.

#### Scenario: A gap is recorded as an explicit non-goal

- GIVEN a declared SDD-040 concept that the implemented surface does not expose as a matching symbol
- WHEN the closure documents that concept
- THEN the closure lists it in the five gap records with a reason and the compositional mechanism that satisfies its semantics
- AND the closure states it is a deferred non-goal
- AND no closure document claims the gap is implemented as a one-to-one symbol

#### Scenario: The five gaps are all present and none is silently ignored

- GIVEN the closure documentation
- WHEN a reviewer enumerates the known differences between declaration and implementation
- THEN all five gaps (receipt claim types, review lenses, identity cardinality, capacity ceilings, execution/reconciliation symbols) appear in the non-goal records
- AND no declared difference is absent without explanation

### Requirement: Record Closure

The SDD-040 record MUST transition from its current `lifecycle:planned` status to a closure state in the five-axis lifecycle vocabulary (`complete` or `active`) that truthfully reflects the closure evidence. The record MUST be recorded `lifecycle:complete` only when every closure criterion verifies: the surface maps 1:1 to the declared scope with revision-bound evidence, all five gaps are recorded as non-goals, the suite remains 843/843, and protected paths are unchanged. If any closure criterion cannot be verified, the record MUST be recorded `lifecycle:active` and MUST NOT be recorded `complete`; lifecycle MUST NOT be derived from implementation maturity alone, and documentary presence alone MUST NOT mark the record complete (status-and-evidence rules R3/R4).

The progress checklist in the SDD-040 record MUST be updated truthfully: each item MAY be checked only when its artifact exists and its evidence verifies, and no item MAY be checked merely because documentation exists. The closure MUST record its evidence against the five-axis axes: lifecycle (the new status), evidence (revision-bound), and temporal class (current-claim), consistent with `openspec/programs/drenyra-dominion/status-and-evidence.md`. The record MUST retain its declared dependencies: SDD-030 as the direct routed-candidate dependency and the SDD-010 prerequisite-authority context, and MUST retain SDD-050 and SDD-090 as consumers.

#### Scenario: Record closes truthfully as lifecycle:complete

- GIVEN the closure documentation with the surface mapping, the five gap records, and verification evidence
- WHEN the verification confirms the suite remains 843/843 and protected paths are unchanged
- THEN the SDD-040 record is recorded `lifecycle:complete` with the closure evidence cited
- AND each progress checklist item that has a verifiable artifact is checked
- AND the record still declares SDD-030 as its dependency and SDD-050/SDD-090 as consumers

#### Scenario: Record stays lifecycle:active when evidence is missing

- GIVEN closure documentation that cannot verify a closure criterion (for example, the suite total cannot be confirmed)
- WHEN the record status is determined
- THEN the record is recorded `lifecycle:active`, not `complete`
- AND the checklist reflects only items with verifiable evidence
- AND no checkbox is checked based on documentary presence alone

### Requirement: No Scope Expansion

The SDD-040 closure MUST NOT change any file under `contracts/`; frozen contract surfaces and conformance vectors MUST remain byte-identical. The closure MUST NOT add, remove, or modify production code, exports, or runtime behavior, and MUST NOT alter receipts, gates, ledger, candidates, recovery, review, journal, evidence, or any other library module. The closure MUST NOT close SDD-050 or SDD-090; both MUST remain `lifecycle:planned`. The closure MUST NOT change the test suite in any way: no test additions, removals, or expectation changes, and the suite total MUST remain exactly 843/843 with no delta attributable to this change.

#### Scenario: Suite total and contracts remain unchanged

- GIVEN the closure change applied
- WHEN the test suite is run and the `contracts/` tree is diffed against the pre-closure revision
- THEN the suite reports exactly 843/843 tests passing
- AND `git diff` for `contracts/` shows no changes
- AND no test file, expectation, or conformance vector changed

#### Scenario: Downstream SDDs are not closed

- GIVEN the closure change applied
- WHEN the SDD-050 and SDD-090 records are inspected
- THEN both remain recorded `lifecycle:planned`
- AND the closure documentation states that closing SDD-040 does not close its consumers

### Requirement: Protected Isolation

The SDD-040 closure MUST NOT modify protected paths: frozen contracts, program root documentation outside the explicit allowlist, and archived change records. The closure MUST confine its documentation to the change artifacts under `openspec/changes/sdd-040-rda-v2/` and, during the closure workflow, the SDD-040 program record and any derived program status documentation required to preserve the 12-SDD invariant. No archived change record (including `openspec/changes/archive/2026-08-15-fiscal-authority-kernel/`) MAY be altered; archived implementation evidence remains untouched and is cited read-only.

#### Scenario: Protected paths remain unchanged

- GIVEN the closure change applied
- WHEN protected paths are diffed against the pre-closure revision
- THEN `openspec/changes/archive/` shows no modification
- AND program root documents outside the allowlist show no modification
- AND the only non-change-directory edits are the SDD-040 record status and any allowlisted derived program status documentation

### Requirement: Testability of Closure Evidence

The closure MUST be verifiable through deterministic checks, and the closure documentation MUST include evidence for each of: the 1:1 surface-to-scope mapping, the five recorded gaps, the truthful record status, the unchanged 843/843 suite, and the unchanged protected paths. Each check MUST be reproducible from repository state; assertions in the closure MUST NOT depend on unrecorded or unrevisioned facts.

#### Scenario: Surface maps 1:1 to scope with evidence

- GIVEN the closure mapping table
- WHEN each row is checked against the codebase and the archived evidence
- THEN each row pairs one declared scope item or invariant with at least one implemented module or symbol
- AND each row cites the fiscal kernel archive (41/41 requirements, 61/61 scenarios, 774/774 tests at `4975f4f`) or the 843/843 baseline at `57ea56a`

#### Scenario: A gap is recorded as a non-goal

- GIVEN a declared concept absent as a matching symbol in the implementation
- WHEN the closure documentation is searched for that concept
- THEN the concept appears in one of the five gap records as an explicit deferred non-goal with a reason
- AND it is not claimed as implemented one-to-one

#### Scenario: Record closes truthfully

- GIVEN the closure status decision
- WHEN the decision is checked against the verification evidence
- THEN `lifecycle:complete` appears only when all closure criteria verify (mapping, gaps, 843/843 suite, protected-path invariance)
- AND otherwise the record is `lifecycle:active` with an honest checklist

#### Scenario: Suite unchanged

- GIVEN the closure change applied
- WHEN `bun run test` is executed
- THEN exactly 843/843 tests pass
- AND no test file or expectation was added, removed, or changed by this change

#### Scenario: Protected paths unchanged

- GIVEN the closure change applied
- WHEN `git diff` is run over protected paths against the pre-closure revision
- THEN `contracts/`, `openspec/changes/archive/`, and non-allowlisted program root documents show no changes
- AND any detected delta in those paths blocks acceptance of the closure
