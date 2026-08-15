# Tasks — Organic Accounting Work Routing (SDD-030, first slice: WorkUnit + WorkResult)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~296–390 authored lines (design estimate 296–367, target 300–390) as one unit; per-file 1–135 (see Phase 1) |
| 400-line budget risk | Low (upper estimate 390 < 400 hard cap; ~30% over the 300-line repo review target via small contingency) |
| Chained PRs recommended | No |
| Suggested split | Single PR (no chaining; ~390 stays under the 400-line cap). If implementation exceeds 400 authored lines, promote `routing/types.ts` + `routing/helpers.ts` (WorkUnit surface) + `routing/__tests__/work-unit.test.ts` + `routing/index.ts` to PR 1 and the WorkResult surface/helpers + `work-result.test.ts` + `boundary.test.ts` + package `index.ts` export to PR 2. |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (~390 vs 300-line repo review budget; no 400-line exception required) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

This slice ships as ONE apply unit on one branch. Strict TDD is active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). Follow RED → GREEN → TRIANGULATE → REFACTOR per unit; finish with `bun run typecheck` and `bun run build`. No change may touch `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, or `flow/**`. The routing module is additive and type-only toward `missions/` and `candidates/`; money is `BigInt` cents, counters are branded JSON integers, and no float exists.

Requirement key: **R1** WorkUnit surface, **R2** WorkResult surface, **R3** boundary compliance, **R4** testability. Design decision key: **D1** sibling `routing/` library re-exported from package `index.ts`; **D2** frozen Core, type-only boundary, no reverse imports; **D3** mission-derived construction with canonical `AccountingMissionStatus` (entry `DRAFT`, no parallel lifecycle); **D4** injected `CanonicalTransitionValidator = typeof validateTransition` with fail-closed rejection; **D5** fiscal convention (`bigint` cents, branded `JsonInteger`, literal attempt limits); **D6** evidence/candidate hash identity plus typed stop reasons and `ValidationResult` fail-closed API.

## Phase 0 — setup and evidence

- [x] Freeze the inspected revision: `git rev-parse HEAD` (record exact SHA and branch). Confirm working-tree state relative to baseline; no source file is mutated before the baseline capture. `routing/` does not exist and the package `index.ts` does not yet export a routing module (verified at planning time). <!-- sdd-owner: implementation -->
- [x] Capture the green baseline: `bun run test` → record actual file/test counts (orchestrator expectation: **798 passed / 798**). NOTE: the `openspec/config.yaml` citation of “647 tests, 3 known pre-existing failures in `cmd/__tests__/cli.test.ts`” is stale — capture and record the actual current pass/fail counts; no failure is attributable to this change. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**`; confirm no task below lists any protected path as an edit target (Phase 1/2 touch only `routing/**`, the package-root `index.ts`, and `openspec/changes/sdd-030-routing/*`). <!-- sdd-owner: implementation -->

## Phase 1 — implementation

### 1.1 `routing/types.ts` — full immutable type surface (R1, R2, R3; D1, D2, D4, D5, D6)

- [x] Create `routing/types.ts` with type-only imports from `../missions/index.js` (`AccountingException`, `AccountingMissionStatus`, `MissionIntent`, `MissionSnapshot`, `validateTransition`) and `../candidates/index.js` (`Candidate`, `CandidateScope`, `MaterialityInput`); define `CanonicalTransitionValidator = typeof validateTransition`, branded `JsonInteger`/`Sha256Hash`, literal `ResearchAttemptLimit = 1|2|3` and `CorrectionAttemptLimit = 1`, and the flat immutable `WorkScope` (tenantId, 11-digit `ruc`, `companyId`, optional `companyName`, `YYYYMM` `period`, `intent`). No runtime import, no `agents/`, no adapters, no store/ledger/receipt/journal/network reference. <!-- sdd-owner: implementation -->
- [x] Define the remaining `WorkUnit` types in `routing/types.ts`: `EvidenceRef { algorithm: "sha256"; hash }`, `VersionPin`, `AuthorizedTool`, `AuthorizedDestination`, `OutputSchemaRef`, `SuccessCondition` union, `WorkBudgets` (with `costLimitCents: bigint`, `timeLimitMs`/`tokenLimit` as `JsonInteger`, `researchAttemptLimit: ResearchAttemptLimit`, `correctionAttemptLimit: CorrectionAttemptLimit`), the closed `WorkStopReason` discriminated union (all 9 kinds) plus `WorkStopReasonKind`, and the `WorkUnit` record (id, `missionId`, objective, `stage: AccountingMissionStatus`, scope, evidenceAllowed, skills, policies, authorizedTools, authorizedDestinations, outputSchema, budgets, successConditions, stopConditions). No free-text field is authoritative for scope, budget, or stop. <!-- sdd-owner: implementation -->
- [x] Define the `WorkResult` types in `routing/types.ts`: `ProposedCandidateRef` (Pick of `Candidate` id/subjectHash/scope/materiality plus structured `materialityBasis: MaterialityInput`), `WorkOutcome` union (`SUCCEEDED` | `STOPPED`/`FAILED` each carrying a `WorkStopReason`), `ToolProvenance`, `CostAndAttempts` (`costIncurredCents: bigint`, integer attempts), `NextTransition { from; to: AccountingMissionStatus }`, and the `WorkResult` record (workUnitId, missionId, outcome, evidenceRefs, proposedCandidates, unresolvedExceptions, policyVersions, toolProvenance, costAndAttempts, nextTransition, optional non-authoritative `explanation`). <!-- sdd-owner: implementation -->

### 1.2 `routing/helpers.ts` — shared deterministic helpers (R1, R2; D5, D6)

- [x] Create `routing/helpers.ts` with runtime import `createHash` from `node:crypto` only; define `ValidationIssue`, `ValidationResult<T>`, `WorkUnitInput`, and `WorkResultInput`; implement `toJsonInteger` (brand only after `Number.isSafeInteger`), `parseSha256Hash` (accept only 64 lowercase hex chars), and `createEvidenceRef(bytes)` (SHA-256 over the exact bytes; never accepts memory keys, URLs, or prose). <!-- sdd-owner: implementation -->

### 1.3 `createWorkUnit` / `validateWorkUnit` (R1; D2, D3, D5, D6)

- [x] In `routing/helpers.ts`, implement `createWorkUnit(mission, input)`: derive `missionId`, `companyId`, `period`, and `intent` from the `MissionSnapshot` (never trust caller duplicates), set initial `stage` to canonical `DRAFT` (locally asserted against the imported enum), and validate RUC/`YYYYMM` shapes, non-empty identities/objective/schema/conditions, malformed hashes, negative costs, floating/unsafe counters, research limits outside `1..3`, and correction limits other than `1`; return `ValidationResult` with typed issues and no partial envelope. <!-- sdd-owner: implementation -->
- [x] Implement `validateWorkUnit(unit, mission)` in `routing/helpers.ts`: re-check scope agreement with the mission snapshot (companyId/period/intent), the canonical `DRAFT` entry stage, budget typing/bounds, hash validity, and non-empty conditions; any issue returns `{ ok: false }` and no partial value. <!-- sdd-owner: implementation -->

### 1.4 `advanceWorkUnit` — injected canonical transition validation (R1; D2, D4)

- [x] In `routing/helpers.ts`, implement `advanceWorkUnit(unit, to, validateTransition)`: reject when `to` equals the current stage or is absent from the canonical matrix; invoke the supplied `CanonicalTransitionValidator` and, only on acceptance, return an immutable copy with the new stage; validator rejection maps to an `INVALID_TRANSITION` issue and the original unit is unchanged. No routing-local transition table is created. <!-- sdd-owner: implementation -->

### 1.5 `createProposedCandidateRef` (R2; D6)

- [x] In `routing/helpers.ts`, implement `createProposedCandidateRef(candidate, materialityBasis)`: copy id/`subjectHash`/scope/materiality from a real `Candidate`, require a non-negative `bigint` `MaterialityInput.value`, and preserve structured reversibility and jurisdiction; reject malformed subject hashes and scope mismatches with typed issues. <!-- sdd-owner: implementation -->

### 1.6 `createWorkResult` / `validateWorkResult` (R2; D4, D5, D6)

- [x] In `routing/helpers.ts`, implement `createWorkResult(unit, input, validateTransition)`: derive `workUnitId` and `missionId` from the `WorkUnit`, require `nextTransition.from === unit.stage`, and call the injected canonical validator for the pair (recovery targets from `UNKNOWN` are `RUNNING`/`FAILED`/`COMPLETED`); reject non-`bigint` costs, floating/unsafe attempt counts, malformed evidence/tool hashes, candidate scope mismatch, unpinned policy versions, and stopped/failed outcomes without a typed reason. <!-- sdd-owner: implementation -->
- [x] Implement `validateWorkResult(result, unit, validateTransition)` in `routing/helpers.ts`: re-run the same structured checks and the canonical transition validation; prove that `explanation` can be changed or removed without changing validation (authority lives only in structured fields). <!-- sdd-owner: implementation -->

### 1.7 Public exports (R3; D1)

- [x] Create `routing/index.ts` re-exporting all public routing types and helpers; add `export * from "./routing/index.js"` to the package `index.ts`. No lower-level module imports are changed. <!-- sdd-owner: implementation -->

## Phase 2 — tests (strict TDD: RED → GREEN → TRIANGULATE → REFACTOR per unit)

### 2.1 `routing/__tests__/work-unit.test.ts` (R1, R4; D2, D3, D4, D5, D6) — scenarios 1.1–1.4

- [x] RED — write failing tests for mission construction: build from a real `MissionSnapshot`; assert `missionId`, `companyId`, `period`, and `intent` are derived and initial `stage === AccountingMissionStatus.DRAFT`. GREEN via 1.3. TRIANGULATE invalid 11-digit RUC, invalid `YYYYMM`, empty tenant/company identity, and mission/scope mismatches all return `{ ok: false }`. <!-- sdd-owner: implementation -->
- [x] RED — write failing table-driven tests for the full 15-state alignment: assert the canonical enum has exactly the 15 specified values; for every source/target pair, pass the real `missions.validateTransition` to `advanceWorkUnit` and assert acceptance equals the real `VALID_TRANSITIONS` matrix, including `QUEUED → RUNNING` accepted and `QUEUED → COMPLETED` rejected with no parallel lifecycle introduced. GREEN via 1.4. TRIANGULATE `UNKNOWN → RUNNING|FAILED|COMPLETED` accepted and every other `UNKNOWN` target rejected. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for budget types and bounds: accept positive `bigint` cents, research limits `1|2|3`, and correction limit `1`; reject negative cents, floating/unsafe counters, research `0`/`4`, and any correction value other than `1` at the runtime validation boundary; `@ts-expect-error` fixtures prove `Number`/float cost types fail typechecking. GREEN via 1.3. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for typed stop reasons: cover each discriminant at least once; `@ts-expect-error` proves an unknown kind fails typechecking; runtime validation rejects empty free-text-only stops and malformed reason payloads (fail closed). GREEN via 1.1/1.3. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for the evidence allowlist and fail-closed construction: hash known bytes and compare with the known SHA-256 vector; reject malformed and non-hash references; any issue yields `{ ok: false }` with no partial `WorkUnit`. GREEN via 1.2/1.3. <!-- sdd-owner: implementation -->

### 2.2 `routing/__tests__/work-result.test.ts` (R2, R4; D4, D5, D6) — scenarios 2.1–2.5

- [x] RED — write failing tests for BigInt costs and integer attempts: accept `bigint` cents and safe integer counts; `@ts-expect-error` proves number/float cost types fail; runtime validation rejects floating/unsafe counters. GREEN via 1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for evidence provenance: known bytes produce the exact expected SHA-256; memory keys, prose, and malformed strings cannot become an `EvidenceRef`. GREEN via 1.2/1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for candidate identity: construct from a real `Candidate`, preserve `subjectHash`, scope, and materiality, and require `MaterialityInput.value` as `bigint` with structured reversibility and jurisdiction; reject a candidate whose RUC/period differs from the `WorkUnit` scope or whose subject hash is malformed. GREEN via 1.5/1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for `nextTransition` consistency: with the real `validateTransition`, accept `RUNNING → AWAITING_APPROVAL`, all other canonical pairs, and `UNKNOWN` recovery pairs; reject absent pairs and a `from` value that differs from the WorkUnit stage. GREEN via 1.4/1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for typed outcomes and no free-text authority: `STOPPED`/`FAILED` require a valid `WorkStopReason`; `SUCCEEDED` carries no free-text authority; changing `explanation` does not alter validation, amounts, candidate identity, policy pins, outcome, or transition. GREEN via 1.1/1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for structured exceptions/provenance: preserve canonical `AccountingException`, policy versions, tool operation/version, and output hashes without coercion. GREEN via 1.6. <!-- sdd-owner: implementation -->

### 2.3 `routing/__tests__/boundary.test.ts` (R3, R4; D2) — scenarios 3.1–3.3, 4.2

- [x] RED — write failing tests for the import allowlist: parse production routing sources and assert they import only `missions/` and `candidates/` types, all via `import type`, and never import `agents/`, `cmd/`, `adapters/`, ledger, receipt, journal, store, network, or a third-party package. GREEN via 1.1/1.2/1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests proving the frozen Core has no reverse imports: scan `missions/**/*.ts` and assert no import from `routing/`, and confirm the canonical status count and transition behavior are unchanged from baseline. GREEN via Phase 1 scope. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests proving the surface proposes only: invoking `createWorkUnit`/`createWorkResult` performs no execution, writes no ledger/receipt/journal/audit entry, and changes no authorization or approval behavior. GREEN via 1.3/1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing deterministic/offline tests: run the focused suite twice with fixed fixtures; assert identical pass/fail with no clock, randomness, network, transport, or external service dependence. GREEN via fixed fixtures. <!-- sdd-owner: implementation -->

### 2.4 Conformance matrix and regression (R4) — scenarios 4.1, 4.3

- [x] RED — run the full conformance matrix (`work-unit`, `work-result`, `boundary`) plus `bun run typecheck`; confirm every scenario passes and typechecking is strict-clean. GREEN via 2.1–2.3. <!-- sdd-owner: implementation -->
- [x] Run the existing mission, candidate, and agent handler suites unchanged; confirm identical results to baseline (scenario 4.3 — existing behavior unchanged) and that no first-slice test modifies mission/handler/candidate behavior. <!-- sdd-owner: implementation -->

## Phase 3 — verification

- [x] Run the focused Vitest files first: `bun run test -- routing/__tests__/work-unit.test.ts routing/__tests__/work-result.test.ts routing/__tests__/boundary.test.ts`; all green. <!-- sdd-owner: implementation -->
- [x] Run the full suite `bun run test`, then `bun run typecheck` and `bun run build`; all green with only the recorded pre-existing baseline failures (if any) remaining. <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, or `flow/**` (git status/diff against baseline). <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement R1–R4 and each of the 15 scenarios as pass/fail against the implementation and tests; note the preflight router, runtime budget enforcement, negotiated-status implementation, and adapters/executors as explicitly out-of-scope/deferred to later slices. <!-- sdd-owner: implementation -->
- [x] Changed-line budget check: confirm authored additions+deletions total ≈296–390 and stays under the 400-line hard cap; if it exceeds 400, do NOT merge as one unit — stop and promote the split boundary defined in the Forecast to two chained PRs. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the single SDD-030 candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-020 configurator slice: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Deliver the first slice via a single PR following repository policy; update the SDD-030 change record (`proposal.md` lifecycle toward apply evidence; record tasks/verify/archive state) and confirm the deferred-slice list (preflight router Slice C, runtime budget enforcement, negotiated-status, adapters/executors) remains documented for later SDD-030 slices. <!-- sdd-owner: parent -->
