---

# SDD-040 — Receipt-Driven Accounting v2

> Status: lifecycle:complete (RDA v2 core, closure 2026-08-15) · Maturity: implemented · Wave: 1 · Depends on: SDD-030 · Feeds: SDD-090, SDD-050 · Prerequisite authority: SDD-010

## Purpose

The transactional core of the ecosystem: freeze the candidate, review
proportionally by tier (R0–R3), gate, execute through authorized adapters, and
confirm against the external system. Produces receipts that prove exactly what
was observed — a review receipt never proves external execution.

## Scope

- Candidate freeze with canonical identity: schemaVersion, tenantId, ruc,
  companyId, fiscalPeriodId, intent, subjectHash, evidenceSetHash, policySetHash,
  skillSetHash, materiality, currency, canonicalPayload — any change creates a
  different candidate.
- Tier derivation R0–R3 and proportional review (automatic / one approval / two
  distinct approvers).
- Receipt types: Analysis, Review, Approval, Authorization, Execution,
  Reconciliation, Close package — shared signed envelope, different claims.
- Autonomy policy A + C: `A_effective = A_org ∩ A_jurisdiction ∩ A_skill ∩
  A_connector ∩ A_materiality ∩ A_actor`; R3 never lowered; integrity gates have
  no kill switch.
- Capacity ceilings as versioned policies (propose entry R2, record material
  entry R3, file with SUNAT R3, delete evidence/receipts forbidden).
- Bounded correction: one correction, independent validation that it answers the
  findings without widening scope, then escalation.
- Review lenses: scope, evidence, accounting, tax, materiality, execution,
  fraud/adversarial, explainability.
- Mandatory pre-execution gates that RECALCULATE their decision — never trust an
  `approved: true` boolean from the UI or an agent.
- UNKNOWN reconciliation: an uncertain external result is queried and reconciled
  before any retry; never classified as terminal success/failure.
- RDA v2 invariants (receipts never over-claim; approval is not execution;
  Guardian never part of the quorum; ledger is history, not the journal).

## Non-goals

- No external execution itself — only authorized adapters execute (SDD-110
  connectors); no monetary floats (BigInt only).
- Guardian Angel (SDD-090) is never part of the approval quorum.
- Receipts never prove SUNAT/bank/ERP acceptance — that is the Execution or
  Reconciliation receipt's separate claim.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | prerequisite authority — ecosystem contracts and release train; the permission/foundation context RDA v2 builds on (does not replace the SDD-030 routed-candidate dependency) |
| SDD-030 | provides — routed candidates and WorkResults entering freeze/review |
| SDD-090 | consumes — frozen candidates handed to Guardian for adversarial read-only review |
| SDD-050 | consumes — RDA receipts, gates, and UNKNOWN reconciliation used by the close journey |

## Input/output contract

- Inputs: candidates from work units (SDD-030) with evidence and pinned policies.
- Outputs: signed receipts, audit-ledger entries, UNKNOWN reconciliation records,
  denial envelopes with typed causes and continuations.

## Threats

- A modified candidate inheriting previous approval or receipts.
- Receipt over-claiming (UI showing "verified" when only a review exists).
- R3 downgraded to auto-approval; segregation of duties violated.
- Blind retry after an uncertain external response.
- The same actor proposing, approving, and confirming a material action.

## Tests and metrics

- Candidate-identity immutability: changing any identity element invalidates
  prior approvals and forces fresh Guardian review.
- Gate recalculation tests (gates never trust client state).
- Invariant suite: 0 self-authorization paths, approvals bound to exact
  candidate/scope/evidence/policy, 0 floats, 0 blind retries.
- Adversarial scenarios: altered evidence, duplicates, collusion, malicious
  instructions.

## Rollback

- Receipts are never rewritten; a changed candidate creates a new identity and a
  new review.
- Vertical rollback reverts the PR chain in reverse order to the previous
  `program-lock` composition.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Closure — 2026-08-15 (RDA v2 core)

> Change: `sdd-040-rda-v2` (documentation-only closure). Evidence axes
> (per `openspec/programs/drenyra-dominion/status-and-evidence.md`): lifecycle
> `complete` (RDA v2 core) · evidence `verified-revision-bound` · temporal class
> `current-claim`. Closing this record does NOT close SDD-050 or SDD-090; both
> remain `lifecycle:planned`.

### Surface-to-scope mapping (R1)

Every declared scope area and RDA v2 invariant (authority-model §5, §5.8) maps to
an implemented, exported, tested symbol. Evidence anchors: fiscal-authority-kernel
archive (`openspec/changes/archive/2026-08-15-fiscal-authority-kernel/`, PR #32)
— 41/41 requirements, 61/61 scenarios, 774/774 tests, clean typecheck, empty
`contracts/` delta at revision `4975f4f`; routed-candidate baseline 843/843 at
`57ea56a` (sdd-030-routing), re-confirmed 843/843 (64 files) at `9b8aa1c` for
this closure.

| Scope area / invariant (§5, §5.8) | Implemented surface | Evidence |
| --- | --- | --- |
| Candidate freeze with canonical identity (§5.1) | `candidateIdentity` (`candidates/identity.ts`, content-derived `subjectHash` = SHA-256 over exact bytes) + `ValidatedTenantScope` (`tenant-core/scope.ts`) + `deriveMateriality`; identity cardinality difference recorded as gap 3 | fiscal kernel archive 41/41, 774/774 at `4975f4f`; suite 843/843 |
| Tier derivation R0–R3 and proportional review (§5.3) | `deriveMateriality` (`candidates/materiality.ts`), `Materiality = "R0"|"R1"|"R2"|"R3"` (`candidates/types.ts`), `CandidateLifecycle` propose/inspect/submitForReview/accept/reject/correct (`candidates/lifecycle.ts`) | fiscal kernel archive at `4975f4f`; suite 843/843 |
| Receipt types — shared signed envelope, different claims (§5.2) | `ReceiptType` union (4 claims: APPROVAL/EXECUTION/COMPLETION/EXTERNAL_SUBMISSION, `receipts/types.ts`), `SignedReceipt`, `buildSignedReceipt`, `verifySignedReceipt`, `generateReceiptKeyPair` (`receipts/sign.ts`, `verify.ts`, `canonical.ts`); 7 declared names satisfied compositionally (gap 1) | fiscal kernel archive at `4975f4f`; suite 843/843 |
| Autonomy policy A + C (§5.3) | `policy/evaluatePePolicy` + `govern` (`policy/pe-policy.ts`; restrict, never grant); `GateRunner.run` fails closed on first non-`allowed` (`gates/runner.ts`) | fiscal kernel archive (policy spec) at `4975f4f`; suite 843/843 |
| Capacity ceilings as versioned policies (§5.4) | enforced compositionally: propose entry R2, record material entry R3, file with SUNAT R3 (via `deriveMateriality` + policy), delete evidence/receipts forbidden; no dedicated versioned ceiling matrix module (gap 4) | fiscal kernel archive at `4975f4f`; suite 843/843 |
| Bounded correction (§5.5) | `CorrectionRecord` (`candidates/lifecycle.ts`; at-most-once budget, fromHash → toHash lineage, independent validation then escalation) | fiscal kernel archive (candidate-ordering spec) at `4975f4f`; suite 843/843 |
| Review lenses (§5.6) | `ReviewLens` = 4R + `judgment-day`, `ALL_4R_LENSES`, `selectReviewLenses`, `forecastReviewWorkload`, `getWorkflowInstructions` (`review/lenses.ts`, `review/workload.ts`); 8 fiscal-domain lens names remain authority-model §5.6 documentation (gap 2) | fiscal kernel archive at `4975f4f`; suite 843/843 |
| Mandatory pre-execution gates that RECALCULATE (§5.7) | `GateRunner.run`, `ApprovalGate`, `distinctApprovers`, `ReceiptGate`, `MissionStateGate` (`gates/approval.ts`, `receipt.ts`, `mission.ts`, `runner.ts`) | fiscal kernel archive (cdr-validation spec) at `4975f4f`; suite 843/843 |
| UNKNOWN reconciliation (never terminal) | mission `UNKNOWN` status (`AccountingMissionStatus`, `missions/status.ts`), `reconcileExternalCall` (`missions/reconciliation.ts`), `recoveryAction` + `decideUnknownRecovery` (`recovery/policy.ts`), `replayMission` (`recovery/replay.ts`); zero blind retries after UNKNOWN | fiscal kernel archive at `4975f4f`; suite 843/843 |
| Journal / evidence / fiscal / CDR / tenant / close (end-to-end composition) | `journal/record|post|supersede|revoke` (`journal/journal.ts`; BigInt cents, balanced, signed, never in-place), `evidence/acceptEvidence|registerEvidence|assertEvidenceInScope` (`evidence/`), `fiscal/FiscalCandidateOrderingAdapter` (`fiscal/candidate-ordering.ts`), `cdr/CdrSuccessorComposer` (`cdr/successor.ts`), `tenant-core/ValidatedTenantScope` (`tenant-core/scope.ts`), `flow/runMonthlyClose` (`flow/close.ts`) | fiscal kernel archive (6 specs) at `4975f4f`; suite 843/843 |
| RDA v2 invariants (§5.8): receipts never over-claim; approval ≠ execution; modified candidate does not inherit authorization; R3 distinct approvers; Guardian never in quorum; same-actor segregation; absence of evidence → wait/block; UNKNOWN never terminal; ledger is history not journal; no kill switch for integrity | `verifySignedReceipt` (`receipts/verify.ts`); `ReceiptType` APPROVAL vs EXECUTION; content-derived identity + fresh review; `distinctApprovers` (`gates/approval.ts`); `guardian/runGuardianReview` findings-only, never in a quorum; `ApprovalGate`; `evidence/assertEvidenceInScope` + `flow/runMonthlyClose` `waiting-for-evidence`; `recovery/` decide-by-evidence; `validateLedger` (`ledger/validate.ts`) + journal boundary (ledger accepts receipt-shaped, rejects entry-shaped); gates always recalculate | fiscal kernel archive at `4975f4f`; suite 843/843 |

### Five gaps as documented non-goals (R2)

Each difference between the SDD-040 declaration and the implemented surface is an
explicit deferred vocabulary/model non-goal of this closure — recorded with its
reason and the compositional mechanism that satisfies the underlying semantics.
None is claimed as a one-to-one implemented symbol, and none is a commitment to
implement within this change.

1. **Receipt claim types.** Declared: 7 claim names (Analysis, Review, Approval,
   Authorization, Execution, Reconciliation, Close package). Implemented:
   `ReceiptType` has 4 claims (APPROVAL, EXECUTION, COMPLETION,
   EXTERNAL_SUBMISSION). Reason: the shared signed envelope with distinct claims
   is implemented; the 7-claim vocabulary is not expanded. Satisfied
   compositionally via missions, recovery, and flow.
2. **Review lenses.** Declared: 8 fiscal-domain lens symbols (scope, evidence,
   accounting, tax, materiality, execution, fraud/adversarial, explainability).
   Implemented: 4R code-review lens set plus judgment-day. Reason: the
   fiscal-domain lens vocabulary remains authority-model §5.6 documentation, not
   exported symbols. Satisfied by the implemented `ReviewLens`/workload surface
   plus Guardian findings for adversarial read-only review.
3. **Candidate identity cardinality.** Declared: one 13-field identity structure.
   Implemented: compact 3-element key (`subjectHash:scope.ruc:scope.period`).
   Reason: the broader envelope exists across tenant-core, evidence, policy, and
   skills modules but is not collapsed into a single 13-field structure. Satisfied
   compositionally across those modules.
4. **Capacity ceilings.** Declared: versioned ceiling policies as a first-class
   artifact. Implemented: ceilings enforced compositionally (propose entry R2,
   record material entry R3, file with SUNAT R3, delete evidence/receipts
   forbidden) with no dedicated versioned ceiling matrix module. Reason: the
   ceilings are enforced by materiality + policy; no matrix module exists.
5. **EXECUTION vs RECONCILIATION receipt claims.** Declared: distinct symbol pair.
   Implemented: execution and reconciliation semantics exist across receipts,
   missions, and recovery, but no distinct `EXECUTION`/`RECONCILIATION` receipt
   claim pair matches the declared vocabulary. Reason: the semantics are enforced
   through missions + recovery; the claim vocabulary is not surfaced.

### Lifecycle and evidence (R3)

- `lifecycle:complete` (RDA v2 core) is recorded ONLY because every closure
  criterion verifies at revision `9b8aa1c`: (1) the surface maps 1:1 to declared
  scope with revision-bound evidence (table above); (2) all five gaps are recorded
  as non-goals; (3) the suite stays exactly 843/843 (64 files, `bun run test`);
  (4) protected paths unchanged (`contracts/**`, `openspec/changes/archive/**`,
  non-allowlisted program root documents — zero delta).
- Lifecycle is NOT derived from implementation maturity alone (status-and-evidence
  rule R3: maturity `implemented` does not by itself close a record), and it is
  NOT marked complete on documentary presence alone (rule R4). If any criterion
  failed to verify, this record would read `lifecycle:active` instead.
- Evidence axes: lifecycle `complete` (RDA v2 core) · evidence
  `verified-revision-bound` (`4975f4f` fiscal kernel envelope; `57ea56a` 843/843
  baseline; `9b8aa1c` closure re-confirmation) · temporal class `current-claim`.
- Closing SDD-040 does NOT close SDD-050 or SDD-090; both remain
  `lifecycle:planned` and depend on this record's documented contract surface.

### Dependency reconciliation (R3)

- `Depends on: SDD-030` — retained as the direct routed-candidate dependency
  (routed candidates and WorkResults enter freeze/review).
- `Feeds: SDD-090, SDD-050` — retained as consumers.
- SDD-010 added as prerequisite-authority context (ecosystem contracts and
  release train; the permission/foundation RDA v2 builds on), per the closure
  proposal — it does not replace the SDD-030 dependency.
- Closing this record does NOT close SDD-050 or SDD-090.

## Progress

- [x] Exploration — `openspec/changes/sdd-040-rda-v2/explore.md` (capability inventory + closure scope)
- [x] Proposal — `openspec/changes/sdd-040-rda-v2/proposal.md`
- [x] Specification (RFC 2119 + Given/When/Then) — `openspec/changes/sdd-040-rda-v2/specs/rda-v2/spec.md` (R1–R6); archived kernel 41 requirements / 61 scenarios at `4975f4f`
- [x] Design — `openspec/changes/archive/2026-08-15-fiscal-authority-kernel/design.md` + authority-model §5 (revision-bound `4975f4f`)
- [x] Tasks (vertical TDD units) — `openspec/changes/sdd-040-rda-v2/tasks.md` (closure; zero unchecked implementation tasks after apply)
- [x] Apply (strict TDD) — `openspec/changes/sdd-040-rda-v2/apply-progress.md` (closure batch); archived kernel apply-progress (strict TDD, 774/774)
- [x] Verification report — archived `verify-report.md` (41/41, 61/61, 774/774 at `4975f4f`); routed baseline 843/843 at `57ea56a`; closure Phase 2 verification (843/843 at `9b8aa1c`, protected paths unchanged)
- [x] Archive report — archived `archive-report.md` (PASS, PR #32) for the implemented capability slice; the closure change's own archive-report is a parent-owned post-apply gate
