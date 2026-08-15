# Tasks — SDD-040 (RDA v2) Documentation-Only Closure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~80–140 additions across `openspec/changes/sdd-040-rda-v2/*` plus the SDD-040 record status/checklist edits (well under the 400-line hard cap and the 300-line repo review target) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (docs-only closure; no chaining) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (~140 lines; no 400-line exception required) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

This change is a **documentation-only closure** (reconciliation/formalization), not a code change. It adds no production code, touches no frozen contract, and changes no test. Strict TDD does not apply to edits; the suite must instead remain exactly **843/843** as evidence that no behavior changed. No task below edits any file outside `openspec/changes/sdd-040-rda-v2/` plus the single allowlisted SDD-040 program record (`openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2/README.md`). Protected paths — `contracts/**`, `openspec/changes/archive/**` (including `2026-08-15-fiscal-authority-kernel/`), and non-allowlisted program root documents — stay byte-identical.

Evidence anchors: fiscal-authority-kernel archive (PR #32) verify envelope — 41/41 requirements, 61/61 scenarios, 774/774 tests, clean typecheck, empty `contracts/` delta at revision `4975f4f`; later routed-candidate baseline 843/843 at `57ea56a` (sdd-030-routing).

Requirement key: **R1** Implemented-Surface Mapping, **R2** Gap Recording, **R3** Record Closure, **R4** No Scope Expansion, **R5** Protected Isolation, **R6** Testability of Closure Evidence. Closure decision: record `lifecycle:complete` only if every closure criterion verifies (mapping, five gaps, 843/843 suite, protected-path invariance); otherwise record `lifecycle:active` and never `complete` (status-and-evidence rules R3/R4).

## Phase 0 — evidence and baseline

- [x] Freeze the inspected revision: `git rev-parse HEAD` (record exact SHA and branch). Confirm working-tree state relative to baseline; no source file is mutated before baseline capture. <!-- sdd-owner: implementation -->
- [x] Capture the green baseline: `bun run test` → record actual file/test counts. Orchestrator expectation: **843 passed / 843**; confirm no delta from `57ea56a`. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `contracts/**`, `openspec/changes/archive/**`, and non-allowlisted program root documents; confirm no task below lists any protected path as an edit target (Phase 1 touches only `openspec/changes/sdd-040-rda-v2/*` and the allowlisted SDD-040 program record). <!-- sdd-owner: implementation -->

## Phase 1 — closure document edits

### 1.1 Surface-to-scope mapping (R1; scenario "every scope item maps to an implemented symbol", "mapping claims are traceable to a bound revision")

- [x] In the SDD-040 program record (`openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2/README.md`), add a closure section that maps every declared scope area and RDA v2 invariant (authority-model §5, §5.8) to the implemented surface. Each mapping MUST name the concrete module/symbol and cite revision-bound evidence: candidates (`candidates/`: `CandidateLifecycle` propose/inspect/submitForReview/accept/reject/correct, `candidateIdentity`, `deriveMateriality`, `Materiality=R0|R1|R2|R3`, `CorrectionRecord`) — receipts (`receipts/`: `SignedReceipt`, `buildSignedReceipt`, `verifySignedReceipt`, `generateReceiptKeyPair`) — ledger (`ledger/`: `validateLedger`, `GENESIS_EMPTY_HASH`, `LedgerManifest`) — gates (`gates/`: `GateRunner.run`, `ApprovalGate`, `distinctApprovers`, `ReceiptGate`, `MissionStateGate`) — UNKNOWN reconciliation (`missions/` UNKNOWN + `reconcileMission`, `recovery/`: `recoveryAction`, `decideUnknownRecovery`, `replayMission`) — proportional review (`review/`: `ReviewLens`, `ALL_4R_LENSES`, `selectReviewLenses`, `forecastReviewWorkload`, judgment-day) — journal/evidence/fiscal/policy/CDR/tenant/close (`journal/`, `evidence/`, `fiscal/FiscalCandidateOrderingAdapter`, `policy/evaluatePePolicy`+`govern`, `cdr/CdrSuccessorComposer`, `tenant-core/ValidatedTenantScope`, `flow/runMonthlyClose`). Cite the fiscal kernel archive (41/41, 61/61, 774/774 at `4975f4f`) and the 843/843 baseline at `57ea56a`. No scope item MAY be left unmapped; any item without a direct symbol MUST be listed as a gap under 1.2. <!-- sdd-owner: implementation -->

### 1.2 Five gaps recorded as documented non-goals (R2; scenarios "a gap is recorded as an explicit non-goal", "the five gaps are all present")

- [x] In the SDD-040 record closure section, record all five known vocabulary/cardinality differences as explicit deferred non-goals, each with a reason and the compositional mechanism that satisfies the underlying semantics; do NOT claim any is implemented as a one-to-one symbol: (1) `ReceiptType` has 4 claim types (`APPROVAL`/`EXECUTION`/`COMPLETION`/`EXTERNAL_SUBMISSION`) not the 7 declared names, satisfied compositionally via missions/recovery/flow; (2) lens vocabulary is the 4R code-review set plus judgment-day, not the 8 fiscal-domain lens symbols; (3) canonical identity is the compact 3-element key (`subjectHash:scope.ruc:scope.period`), not one 13-field structure; (4) capacity ceilings enforced compositionally, not exposed as one dedicated versioned ceiling matrix; (5) no distinct `EXECUTION` vs `RECONCILIATION` receipt claim pair matching the declared vocabulary. Each gap MUST state it is a deferred vocabulary/model non-goal of this closure, not a commitment to implement in this change. <!-- sdd-owner: implementation -->

### 1.3 Record lifecycle + progress checklist update (R3; scenarios "record closes truthfully as lifecycle:complete", "record stays lifecycle:active when evidence is missing")

- [x] Update the SDD-040 record lifecycle from `lifecycle:planned` to the five-axis vocabulary value (`complete` or `active`) truthfully reflecting closure evidence. Record `lifecycle:complete` ONLY when every closure criterion verifies (1:1 surface mapping with revision-bound evidence, all five gaps recorded, suite stays 843/843, protected paths unchanged); otherwise record `lifecycle:active` and NEVER `complete`. Do NOT derive lifecycle from implementation maturity alone (R3) and do NOT mark complete on documentary presence alone (R4). <!-- sdd-owner: implementation -->
- [x] Update the SDD-040 progress checklist truthfully: check each item ONLY when its artifact exists and its evidence verifies (Exploration/Proposal/Specification/Design/Tasks/Apply/Verification/Archive); no item MAY be checked merely because documentation exists. Record the closure evidence against the five-axis axes — lifecycle (new status), evidence (revision-bound), temporal class (current-claim) — consistent with `openspec/programs/drenyra-dominion/status-and-evidence.md`. Retain SDD-030 as the direct routed-candidate dependency, SDD-010 as prerequisite-authority context, and SDD-050/SDD-090 as consumers. <!-- sdd-owner: implementation -->

### 1.4 Dependency correction (R3)

- [x] In the SDD-040 record, reconcile the dependency block truthfully: keep `Depends on: SDD-030` as the direct routed-candidate dependency and `Feeds: SDD-090, SDD-050` as consumers, and add explicit SDD-010 prerequisite-authority context (per proposal). State that closing SDD-040 does NOT close SDD-050 or SDD-090, which remain `lifecycle:planned`. <!-- sdd-owner: implementation -->

### 1.5 apply-progress.md record (closure batch)

- [x] Create `openspec/changes/sdd-040-rda-v2/apply-progress.md` recording the closure batch: docs-only scope, files edited, the surface mapping and five-gap documentation applied to the record, and the baseline evidence captured (843/843 at the frozen revision). No code or contract was touched. <!-- sdd-owner: implementation -->

## Phase 2 — verification

- [x] Run the full suite `bun run test`, then `bun run typecheck` (and `bun run build` if configured); confirm exactly **843/843** with no delta from baseline and typecheck green. No test file or expectation changed. <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched `contracts/**`, `openspec/changes/archive/**` (including `2026-08-15-fiscal-authority-kernel/`), or non-allowlisted program root documents; the only non-change-directory edit is the SDD-040 record status/checklist (git status/diff against the frozen revision). Any delta in a protected path blocks acceptance. <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement R1–R6 and every spec scenario as pass/fail against the closure documents and evidence; confirm the suite total is exactly 843/843 and that no declared difference (the five gaps) is absent without explanation. <!-- sdd-owner: implementation -->
- [x] 12-SDD invariant: confirm the program still satisfies the canonical 12-SDD catalog (directory enumeration per `status-and-evidence.md` E-008) after the SDD-040 lifecycle reconciliation; SDD-050 and SDD-090 remain `lifecycle:planned`. <!-- sdd-owner: implementation -->
- [x] Changed-line budget check: confirm authored additions+deletions total ≈80–140 and stay under the 400-line hard cap; if it exceeds 400, STOP and do NOT merge as one unit — escalate for a split. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the single SDD-040 closure candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as prior docs-only closures: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Deliver the single-PR docs-only closure following repository policy; update the SDD-040 change record lifecycle toward apply/archive evidence (proposal → tasks/verify/archive state) and archive the completed closure change. SDD-050 and SDD-090 remain `PLANNED`. <!-- sdd-owner: parent -->
