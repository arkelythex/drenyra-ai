# Apply Progress — Preflight Router (SDD-030, slice C)

> Change: `sdd-030-router` · Slice: C (deterministic preflight router) · Phase: apply
> Runtime attempt token (router): `sha256:91726cf35622b379a16dee2010928a06538ddbfd2e6b25e4b750e24456205d2d`

## Structured status (consumed/produced)

```yaml
schemaName: spec-driven
changeName: sdd-030-router
artifactStore: openspec
changeRoot: openspec/changes/sdd-030-router
applyState: ready (all implementation tasks complete after this apply)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo root]
  warnings: []
nextRecommended: parent-lifecycle
```

- Delivery decision consumed from parent: `single-pr`, chain strategy `size-exception`, `Decision needed before apply: No` — **however**, the authored-line budget gate below did NOT hold, so the delivery decision must be re-validated by the parent (single 400-line exception vs the two-PR split defined in the tasks Forecast). See "Workload / PR boundary" section.

## Baseline (Phase 0 evidence)

- Revision frozen: `dcaa605049ad64e80a4c4753b6c779bbfa60df20` on branch `main`.
- Working tree before apply: clean except the untracked `openspec/changes/sdd-030-router/` dir. `routing/router.ts` did not exist.
- Baseline suite: **864 passed / 864 green, 64 test files** (`bun run test`, exit 0). The `openspec/config.yaml` citation ("647 tests, 3 known pre-existing failures in cmd/**tests**/cli.test.ts") is confirmed stale — actual baseline was fully green with no failures.

## Task completion and persisted checkboxes

The `tasks.md` artifact was provided with every implementation-owned checkbox already marked `- [x]` (planning-time marks). After this apply every one of those units is genuinely complete and verified; the persisted artifact is therefore accurate as-is — no checkbox changed during apply. Parent-owned governance rows remain unchecked (`- [ ]`) and are listed under "Remaining tasks".

Completed implementation units (all green, see TDD evidence):

- 1.1 `routing/types.ts` — closed router type surface (R1/R3; D1/D2/D3/D5): candidate `Materiality`/`Reversibility` type-only imports, six axis unions, `RouteRequest`, `AuthorityCeiling`, closed 3-member `Route` discriminant with inseparable literal ceilings.
- 1.2 `routing/helpers.ts` — additive `AMBIGUOUS_INPUT` literal on `ValidationIssue["code"]` (R2; D6). No new issue type; `ValidationResult` shape unchanged.
- 1.3 `routing/router.ts` — closed-shape validation + escalation-only `route()` (R1/R2; D4/D5/D7/D8/D9/D11): type-only local imports only, zero runtime imports, no transition table/validator, deterministic issue collection with lexically sorted unknown keys, duplicate-system rejection, contradiction checks before decision, fresh validated snapshot, no WorkUnit/mission/ledger writes.
- 1.4 `routing/index.ts` — `export * from "./router.js"`.
- 2.1–2.6 — all mandated test units (50 router tests + boundary extension) RED→GREEN.
- Phase 3 — focused suites, full suite, typecheck, build, protected-path and budget checks (budget gate breached, see below).

## TDD Cycle Evidence

Strict TDD active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). RED was verified by running the focused suite before the implementation existed (`route is not a function`, 47 failing) and by `bun run typecheck` failing on the missing exports.

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 types + 2.1 shape | `routing/__tests__/router.test.ts` | Unit | ✅ 864/864 baseline | ✅ 22 tests failing pre-impl | ✅ 50/50 focused | ✅ 10 missing-field + 8 unsupported-literal + compile-time fixtures | ✅ Clean (no duplicates) |
| 1.2 helpers + ambiguity | `routing/__tests__/router.test.ts` | Unit | ✅ baseline | ✅ (module missing) | ✅ 50/50 | ✅ 3 systems + 2 contradiction cases | ➖ None needed |
| 1.3 router + 2.2/2.3 decision | `routing/__tests__/router.test.ts` | Unit | ✅ baseline | ✅ (module missing) | ✅ 50/50 | ✅ 2 direct + 4 specialized + 10 durable + 5 precedence | ✅ Clean |
| 1.4 index + 2.4/3.1 ceilings | `routing/__tests__/router.test.ts` | Unit | ✅ baseline | ✅ (module missing) | ✅ 50/50 | ✅ runtime pairs + `satisfies Route` + 3 `@ts-expect-error` | ✅ Clean |
| 2.5 boundary allowlist + frozen machine | `routing/__tests__/boundary.test.ts` | Unit | ✅ 6/6 existing | ✅ (router.ts absent from allowlist) | ✅ 56/56 focused | ✅ narrow local type-import exception + source-scan tokens | ✅ Clean |
| 2.4/2.5 purity + determinism | `router.test.ts` + `boundary.test.ts` | Unit | ✅ baseline | ✅ (module missing) | ✅ 56/56 focused | ✅ 3-route filesystem observation + 5 fixture repeats | ✅ Clean |
| 2.6 conformance matrix | full suite + typecheck | Unit | ✅ 864/864 | ✅ RED per unit | ✅ 915/915 | ✅ precedence: durable beats specialized | ✅ Clean |

Triangulation skipped: none — every behavior has multiple cases (tables above). Pure functions created: `route` (pure, deterministic, offline); internal helpers (`checkScope`, `checkLiteral`, `checkSystems`, `snapshot`, `hasUnknownKeys`) are pure.

## Files changed and line counts (authored)

| File | Change | Lines |
| --- | --- | ---: |
| `routing/types.ts` | Added imports, 6 axis unions, `RouteRequest`, `AuthorityCeiling`, `Route` | +89 / −5 |
| `routing/helpers.ts` | `AMBIGUOUS_INPUT` literal on `ValidationIssue["code"]` | +2 / −1 |
| `routing/router.ts` | **New** — validator + `route()` | +323 |
| `routing/index.ts` | `export * from "./router.js"` | +1 |
| `index.ts` (root barrel) | Explicit `export type { ExternalEvidence }` re-export to resolve star-export name clash | +4 |
| `routing/__tests__/router.test.ts` | **New** — conformance suite | +408 |
| `routing/__tests__/boundary.test.ts` | Allowlist + narrow local type-import exception + frozen-machine scan + propose-only `route()` observation + offline scan additions | +58 / −7 |

**Authored additions+deletions total ≈ 898** (154 added + 13 deleted in tracked files; 731 in the two new files).

## Deviations from design (all documented)

1. **Root barrel explicit re-export (`index.ts`)** — `missions/reconciliation.ts` already exports an interface named `ExternalEvidence`; the root `index.ts` star-exports both `missions` and `routing`, so the new routing axis union (name mandated by design D2) triggered `TS2308` at build. Fix: one explicit `export type { ExternalEvidence } from "./routing/index.js"` line at the root barrel so the routing axis union resolves at the package boundary (routing has no package subpath; missions consumers keep the `./missions` subpath). Task 1.4's "no other module's imports are changed" is respected: no import of any module was modified — the root barrel gained one re-export line. Protected-path rule unaffected (root `index.ts` is not a protected path).
2. **Durable-trigger test bases** — design D10 makes `read-only` + `irreversible` and `read-only` + `approval: required` contradictions (rejected as `AMBIGUOUS_INPUT`), so the task-2.3 durable table and the precedence case for those two triggers start from a `proposes-change` base with every other axis low-risk (the "every other axis low-risk" intent of spec scenario 2.3 is preserved). Contradiction behavior itself is covered by dedicated tests (scenario 2.4).
3. **Changed-line budget** — implementation totals ~898 authored lines vs the 255–354 forecast. See "Workload / PR boundary".

## Verification commands and results

```sh
bun run test -- routing/__tests__/router.test.ts   # 50 passed (RED: 47 failed pre-impl)
bun run test -- routing/__tests__/boundary.test.ts # 6 passed
bun run test -- routing/__tests__/router.test.ts routing/__tests__/boundary.test.ts # 56 passed
bun run typecheck                                  # exit 0 (strict; @ts-expect-error fixtures validated)
bun run build                                      # exit 0 (dist compiled)
bun run test                                       # 915 passed / 915 green, 65 files
```

- New tests added: **51** (50 in `router.test.ts` + 1 in `boundary.test.ts`). Suite total: **915 passed / 915 green** (baseline 864 + 51). No pre-existing failures.
- Protected-path check: `git status`/`git diff` show no edit under `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, or `flow/**` — only `routing/*`, `routing/__tests__/*`, root `index.ts`, and the openspec change dir.

## Spec pass/fail (R1–R5, all 13 scenarios)

| Req / Scenario | Result |
| --- | --- |
| R1 RouteRequest input — complete typed request (1.1) | PASS — typed fixture, identity-independence test, `@ts-expect-error` proofs |
| R1 — missing or unsupported axis rejected (1.2) | PASS — 10 missing-field + 8 unsupported-literal + unknown-key cases |
| R2 Route decision — direct analysis (2.1) | PASS — R0 and R1 variants |
| R2 — specialized agent (2.2) | PASS — proposes-change, bounded evidence, bounded-interruptible, partially-reversible |
| R2 — durable mission (2.3) | PASS — all 10 escalation signals (contradiction-safe bases per D10) |
| R2 — ambiguous fails closed (2.4) | PASS — empty/malformed/duplicate systems, both contradictions; no `value` |
| R3 discriminant + ceiling (3.1) | PASS — exact runtime pairs, `satisfies Route`, unrepresentable wrong pairs |
| R3 — router call proposes only (3.2) | PASS — before/after dir listing + mission snapshot unchanged, no WorkUnit fields |
| R4 boundary — import boundary (4.1) | PASS — allowlist incl. `router.ts`, narrow type-only local exception, forbidden specifiers retained |
| R4 — frozen machine (4.2) | PASS — 15 states / 15 transitions unchanged, router source scan clean |
| R5 testability — conformance suite (5.1) | PASS — precedence cases, durable always wins |
| R5 — authority ceilings enforced (5.2) | PASS — runtime + compile-time |
| R5 — deterministic and offline (5.3) | PASS — repeated-run deep equality; offline token scans incl. `router.ts`/`router.test.ts` |

Out of scope / deferred (unchanged): WorkUnit/mission materialization, adapters/Command Center/external-host/SDD-040 integration, runtime budget enforcement, negotiated status — documented for later SDD-030 slices.

## Workload / PR boundary

- Forecast (tasks.md): ~255–354 authored lines, `400-line budget risk: Low`, single PR. **Actual: ~898 authored lines** — exceeds the 400-line hard cap by ~2.2× and the 300-line repo review budget by ~3×.
- Tasks.md Phase 3 gate: "if it exceeds 400, do NOT merge as one unit — stop and promote the split boundary defined in the Forecast to two chained PRs." The Forecast's split boundary is: PR 1 = `routing/types.ts` + `routing/helpers.ts` (AMBIGUOUS_INPUT) + `routing/router.ts` + `routing/__tests__/router.test.ts`; PR 2 = boundary-test extension + `routing/index.ts` export + remaining tests. Note: with actual sizes, PR 1 alone ≈ 828 lines (types 94 + helpers 3 + router 323 + router tests 408) and still exceeds 400; a finer split (e.g., moving decision/ambiguity tests off PR 1) or a parent-granted 400-line exception is required. **Delivery decision required from parent:** (a) grant a single-PR 400-line exception (matches the parent's original `single-pr` intent), or (b) execute the two-PR (or finer) chained split. Apply executor did not merge or commit.

## Remaining tasks (parent-owned, unchecked in persisted artifact)

```text
- [ ] Start or reuse bounded review for the single SDD-030 slice C candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-030 routing first slice and the SDD-020 configurator slice: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Deliver the slice via a single PR following repository policy; update the SDD-030 change record (proposal.md lifecycle toward apply evidence; record tasks/verify/archive state) and confirm the deferred-slice list (WorkUnit/mission materialization, adapters/executors, runtime budget enforcement, negotiated-status) remains documented for later SDD-030 slices. <!-- sdd-owner: parent -->
```

## Discoveries saved to Engram

- `ExternalEvidence` name clash between `missions/reconciliation.ts` and the new routing axis union; root-barrel explicit re-export resolution.
- Actual authored-line budget (~898) vs forecast (~354); split boundary promoted.
- D10 contradiction interplay with durable-trigger test data (bases must be non-read-only for `irreversible` and `approval: required`).
