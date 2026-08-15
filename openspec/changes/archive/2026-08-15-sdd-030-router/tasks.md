# Tasks — Preflight Router (SDD-030, slice C)

> Change: `sdd-030-router` · Slice: C (deterministic preflight router). Proposal, spec (5 requirements R1–R5, **13** `#### Scenario` headings — R1×2, R2×4, R3×2, R4×2, R5×3; every scenario is covered by an explicit Phase 2 test task), and design (D1–D11) complete.
>
> Requirement key: **R1** RouteRequest input, **R2** fail-closed route decision, **R3** route discriminant + authority ceiling, **R4** boundary compliance, **R5** testability. Design decision key: **D1** implementation in `routing/router.ts` with public types in `routing/types.ts`, re-exported via `routing/index.ts` (no top-level `router/`); **D2** the eight §5 axes as required closed fields reusing canonical `Materiality`/`Reversibility` and `WorkScope`; **D3** `systemsInvolved` non-empty readonly tuple with defensive runtime validation; **D4** `route(request): ValidationResult<Route>` with validation before decision; **D5** `kind` discriminant + inseparable `authorityCeiling` literal + validated request snapshot; **D6** `AMBIGUOUS_INPUT` added to `ValidationIssue["code"]` (reuses existing `WorkStopReason` vocabulary, no new issue type); **D7** `router.ts` added to the boundary-test production allowlist with narrow type-only local-import exception, no forbidden imports; **D8** no injected/`CanonicalTransitionValidator` and no transition table; **D9** no WorkUnit/mission materialization; **D10** partial-reversibility is a specialized signal and read-only×approval/irreversible are contradictions; **D11** duplicate system IDs rejected as ambiguous, no normalization.
>
> Spec scenario count note: the delegated brief says "11 scenarios", but the actual `spec.md` contains **13** `#### Scenario` headings (the final three R5 headings restate conformance, authority, and determinism at the testability boundary, per design). This task list covers all **13** to keep every scenario individually reviewable. All 5 requirements and all 13 scenarios are mapped to Phase 2 tasks below.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~255–354 authored lines (design estimate: source 142–204, tests 113–150; proposal estimate 230–370) as one unit; per-file 1–140 (see Phase 1) |
| 400-line budget risk | Low (upper estimate 354 < 400 hard cap; the 300-line repo review budget is approached/exceeded only at the upper estimate, which compact table-driven tests keep in check) |
| Chained PRs recommended | No |
| Suggested split | Single PR (no chaining; ~354 stays under the 400-line cap). If implementation exceeds 400 authored lines, promote `routing/types.ts` + `routing/helpers.ts` (AMBIGUOUS_INPUT) + `routing/router.ts` + `routing/__tests__/router.test.ts` to PR 1 and the boundary-test extension + `routing/index.ts` export + remaining tests to PR 2. |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (~354 vs 300-line repo review budget; no 400-line exception required) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

This slice ships as ONE apply unit on one branch. Strict TDD is active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). Follow RED → GREEN → TRIANGULATE → REFACTOR per unit; finish with `bun run typecheck` and `bun run build`. No change may touch `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**`, or any Core/frozen layer. The router is additive, deterministic, offline, and propose-only; money is `BigInt` cents upstream (the router consumes the policy-derived materiality tier and adds no monetary threshold); no clock, randomness, environment, transport, or mutable process state influences a decision.

## Phase 0 — setup and evidence

- [x] Freeze the inspected revision: `git rev-parse HEAD` (record exact SHA and branch). Confirm working-tree state relative to baseline; no source file is mutated before the baseline capture. `routing/router.ts` does not exist and `routing/index.ts` does not yet export a router surface (verified at planning time). <!-- sdd-owner: implementation -->
- [x] Capture the green baseline: `bun run test` → record actual file/test counts (orchestrator expectation **864 passed / 864 green**, exit 0). NOTE: the `openspec/config.yaml` citation of "647 tests, 3 known pre-existing failures in `cmd/__tests__/cli.test.ts`" is stale — capture and record the actual current pass/fail counts; no failure is attributable to this change. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**`; confirm no task below lists any protected path as an edit target (Phase 1/2 touch only `routing/{types,helpers,router,index}.ts`, `routing/__tests__/{router,boundary}.test.ts`, and `openspec/changes/sdd-030-router/*`). <!-- sdd-owner: implementation -->

## Phase 1 — implementation

### 1.1 `routing/types.ts` — closed router type surface (R1, R3; D1, D2, D3, D5)

- [x] Extend the existing type-only candidate import in `routing/types.ts` with `Materiality` and `Reversibility` from `../candidates/index.js` (type-only only; `MissionIntent` remains reached through `WorkScope`). <!-- sdd-owner: implementation -->
- [x] Define the closed axis unions in `routing/types.ts`: `RequestedEffect` (`read-only | proposes-change | core-governed-change`), `ExternalEvidence` (`none | bounded | material`), `DurationAndInterruptibility` (`immediate | bounded-interruptible | recoverable`), `SegregationOfDuties` (`not-required | required`), `RegulatoryObligations` (`none | applicable`), `ApprovalRequirement` (`not-required | required`). <!-- sdd-owner: implementation -->
- [x] Define `RouteRequest` in `routing/types.ts`: readonly `scope: WorkScope`; readonly `requestedEffect: RequestedEffect`; and the eight required axis fields `materiality`, `reversibility`, `externalEvidence`, `durationAndInterruptibility`, `systemsInvolved` (`readonly [string, ...string[]]` — non-empty tuple), `segregationOfDuties`, `regulatoryObligations`, `approval`. All fields typed and required; no free-text prose carries authority. <!-- sdd-owner: implementation -->
- [x] Define `AuthorityCeiling` (`no-mutation | proposes-only | through-core`) and the closed `Route` discriminated union in `routing/types.ts`: exactly three members (`direct-analysis`/`no-mutation`, `specialized-agent`/`proposes-only`, `durable-mission`/`through-core`), each with an inseparable literal `authorityCeiling` and a readonly `request: RouteRequest`. No route can express greater authority than its ceiling at compile time. <!-- sdd-owner: implementation -->

### 1.2 `routing/helpers.ts` — additive `AMBIGUOUS_INPUT` literal (R2; D6)

- [x] Extend `ValidationIssue["code"]` in `routing/helpers.ts` with the exact literal `"AMBIGUOUS_INPUT"` alongside the existing codes. No new router-specific issue type and no overload of another code; `ValidationResult` shape is unchanged. <!-- sdd-owner: implementation -->

### 1.3 `routing/router.ts` — closed-shape validation and escalation-only `route()` (R1, R2; D4, D5, D7, D8)

- [x] Create `routing/router.ts` with only type-only imports from `./types.js` (`Route`, `RouteRequest`) and `./helpers.js` (`ValidationIssue`, `ValidationResult`). Zero runtime imports. No `agents/`, commands, adapters, stores, ledgers, receipts, journals, transports, network clients, clock, randomness, or process-state dependency. No local transition table and no `CanonicalTransitionValidator` usage (D8). <!-- sdd-owner: implementation -->
- [x] Implement deterministic closed-shape validation in declaration order: (1) require a non-null object with exactly `scope`, `requestedEffect`, and the eight axis fields; (2) validate `scope` `WorkScope` fields (non-empty IDs and intent, 11-digit RUC, six-digit `YYYYMM` period, non-empty optional company name) and reject unknown scope keys; (3) validate every closed literal against local readonly literal sets typed to the imported unions — no monetary threshold or materiality derivation; (4) require `systemsInvolved` to be a non-empty array of non-empty strings and reject duplicates without normalizing/trimming/deduplicating (D11); (5) reject unknown top-level keys (lexically sorted before issue append for byte-stable ordering). Issue paths are stable dotted names (`scope.ruc`, `materiality`, `systemsInvolved`). <!-- sdd-owner: implementation -->
- [x] Implement contradiction checks before route selection: reject `requestedEffect === "read-only"` combined with `approval === "required"` (issues at `requestedEffect` and `approval`) and combined with `reversibility === "irreversible"` (issues at `requestedEffect` and `reversibility`). If any issue exists, return `{ ok: false, issues }` and never evaluate route predicates or include a `value`. <!-- sdd-owner: implementation -->
- [x] Implement the escalation-only `route(request): ValidationResult<Route>` precedence after validation, first matching row wins: (row 2) `durable-mission`/`through-core` on ANY of `core-governed-change`, materiality `R2`/`R3`, `irreversible`, `externalEvidence === "material"`, `recoverable`, `systemsInvolved.length > 1`, `segregationOfDuties === "required"`, `regulatoryObligations === "applicable"`, or `approval === "required"`; (row 3) `specialized-agent`/`proposes-only` with no durable trigger on `proposes-change`, `partially-reversible`, `externalEvidence === "bounded"`, or `bounded-interruptible`; (row 4) `direct-analysis`/`no-mutation` only when read-only AND `R0`/`R1` AND `reversible` AND `externalEvidence === "none"` AND `immediate` AND exactly one system AND `not-required` AND `none` AND `not-required`. File/document/agent counts never influence the decision. <!-- sdd-owner: implementation -->
- [x] On success, create a fresh validated `RouteRequest` snapshot (fresh `scope` object and `systemsInvolved` array; never freeze or mutate caller objects) and embed it in the returned `Route`. No WorkUnit/mission/tool/destination/transition is created, and no persistence or network state is written (D9). <!-- sdd-owner: implementation -->

### 1.4 `routing/index.ts` — public export (R3; D1)

- [x] Add `export * from "./router.js";` to `routing/index.ts` so the router surface is exposed through the existing routing public boundary. No other module's imports are changed. <!-- sdd-owner: implementation -->

## Phase 2 — tests (strict TDD: RED → GREEN → TRIANGULATE → REFACTOR per unit)

### 2.1 `routing/__tests__/router.test.ts` — RouteRequest shape and validation (R1; D2, D3, D6) — scenarios 1.1, 1.2

- [x] RED — write a compile-time complete-typed-request fixture using all required fields and imported canonical `Materiality`/`Reversibility` values; assert changing a non-authoritative object identity does not alter the decision; `@ts-expect-error` proves an omitted axis or an empty `systemsInvolved` tuple fails typechecking (scenario 1.1). GREEN via 1.1/1.3. <!-- sdd-owner: implementation -->
- [x] RED — write table-driven tests omitting each required top-level field (scope, `requestedEffect`, each of the eight axes) and carrying unsupported literals for `requestedEffect` and each closed axis; plus unknown top-level key and unknown scope key; each asserts `ok: false`, exact `AMBIGUOUS_INPUT` paths, and absence of `value` (scenario 1.2). GREEN via 1.2/1.3. <!-- sdd-owner: implementation -->

### 2.2 `routing/__tests__/router.test.ts` — route decision per route (R2; D4, D10) — scenarios 2.1, 2.2, 2.3

- [x] RED — write failing tests: `R0` and `R1` variants that are read-only, reversible, immediate, no external evidence, one system, no duties/regulation/approval both return `direct-analysis`/`no-mutation` and never escalate (scenario 2.1). GREEN via 1.3. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: separate cases for `proposes-change`, `externalEvidence === "bounded"`, `bounded-interruptible` duration, and `partially-reversible` work each return `specialized-agent`/`proposes-only` with no durable trigger present (scenario 2.2; D10). GREEN via 1.3. <!-- sdd-owner: implementation -->
- [x] RED — write a table starting from the direct fixture and changing exactly one field per durable trigger (core-governed effect, R2, R3, irreversible, material evidence, recoverable duration, second system, segregation, regulation, approval); each returns `durable-mission`/`through-core` even when every other axis is low-risk (scenario 2.3). GREEN via 1.3. <!-- sdd-owner: implementation -->

### 2.3 `routing/__tests__/router.test.ts` — fail-closed ambiguity and authority ceilings (R2, R3; D6, D11) — scenarios 2.4, 3.1

- [x] RED — write failing tests: empty `systemsInvolved`, malformed system ID, duplicate system ID, `read-only`+`approval: required`, and `read-only`+`reversibility: irreversible` each return typed `AMBIGUOUS_INPUT` with deterministic issue order and no route value (scenario 2.4; D11). GREEN via 1.2/1.3. <!-- sdd-owner: implementation -->
- [x] RED — write failing authority-ceiling tests asserting the exact runtime pair for all three route members (`direct-analysis`/`no-mutation`, `specialized-agent`/`proposes-only`, `durable-mission`/`through-core`) and add type-level `satisfies Route` fixtures proving a wrong pair is not representable; no member exposes authority beyond its ceiling (scenario 3.1). GREEN via 1.1/1.3. <!-- sdd-owner: implementation -->

### 2.4 `routing/__tests__/router.test.ts` — propose-only purity and determinism (R3, R5; D9) — scenarios 3.2, 5.3

- [x] RED — write failing propose-only tests: snapshot watched persistence directories and a mission fixture before/after `route()` calls for all three routes; assert no file listing or mission data changes and no WorkUnit is returned (scenario 3.2). GREEN via 1.3/1.4. <!-- sdd-owner: implementation -->
- [x] RED — write failing deterministic/offline tests: invoke each fixture twice and assert deep equality, with no clock, randomness, child process, network, transport, or external service dependence (scenario 5.3). GREEN via fixed fixtures + 1.3. <!-- sdd-owner: implementation -->

### 2.5 `routing/__tests__/boundary.test.ts` — boundary allowlist and frozen machine (R4, R5; D7, D8) — scenarios 4.1, 4.2, 5.1, 5.2

- [x] RED — extend the production-import allowlist: append `"../router.ts"` to `PRODUCTION_FILES`; assert `router.ts` imports only type-only `./types.js` and `./helpers.js` routing-local imports (narrow exception) and never imports `agents/`, `cmd/`, `adapters/`, ledger, receipt, journal, store, network, HTTP, or a third-party package; retain every existing forbidden specifier (scenario 4.1). GREEN via 1.3/1.4. <!-- sdd-owner: implementation -->
- [x] RED — write failing frozen-machine tests: existing assertions remain at 15 states and 15 transition-map entries; source scan confirms `router.ts` contains no transition matrix or mission-state vocabulary; no `CanonicalTransitionValidator` is called because the router is not transition-aware; no reverse import into the mission Core (scenario 4.2; D8). GREEN via 1.3 scope. <!-- sdd-owner: implementation -->
- [x] RED — include `router.ts` and `router.test.ts` in the deterministic/offline source scan (forbidding clock/randomness/child-process/network/transport tokens) and invoke `route()` inside the existing before/after filesystem observation to prove no persistence or mission mutation (scenario 5.1, 5.2). GREEN via 2.4/2.5. <!-- sdd-owner: implementation -->

### 2.6 Conformance matrix and regression (R5) — scenarios 5.1, 5.2, 5.3

- [x] RED — run the full conformance matrix (`router.test.ts` + `boundary.test.ts`) plus `bun run typecheck`; confirm every scenario passes and typechecking is strict-clean, including precedence cases where axes differ and durable always wins over specialized/direct (scenarios 5.1, 5.2, 5.3). GREEN via 2.1–2.5. <!-- sdd-owner: implementation -->
- [x] Run the existing routing, mission, candidate, and agent suites unchanged; confirm identical results to baseline and that no router test modifies mission/handler/candidate behavior. <!-- sdd-owner: implementation -->

## Phase 3 — verification

- [x] Run the focused Vitest files first: `bun run test -- routing/__tests__/router.test.ts routing/__tests__/boundary.test.ts`; all green. <!-- sdd-owner: implementation -->
- [x] Run the full suite `bun run test`, then `bun run typecheck` and `bun run build`; all green with only the recorded pre-existing baseline failures (if any) remaining. <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, or `flow/**` (git status/diff against baseline). <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement R1–R5 and each of the 13 scenarios as pass/fail against the implementation and tests; note WorkUnit/mission materialization, adapters/Command Center/external-host/SDD-040 integration, and runtime budget enforcement as explicitly out-of-scope/deferred to later slices. <!-- sdd-owner: implementation -->
- [x] Changed-line budget check: confirm authored additions+deletions total ≈255–354 and stays under the 400-line hard cap; if it exceeds 400, do NOT merge as one unit — stop and promote the split boundary defined in the Forecast to two chained PRs. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the single SDD-030 slice C candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-030 routing first slice and the SDD-020 configurator slice: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Deliver the slice via a single PR following repository policy; update the SDD-030 change record (`proposal.md` lifecycle toward apply evidence; record tasks/verify/archive state) and confirm the deferred-slice list (WorkUnit/mission materialization, adapters/executors, runtime budget enforcement, negotiated-status) remains documented for later SDD-030 slices. <!-- sdd-owner: parent -->
