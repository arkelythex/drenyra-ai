# Apply Progress — Organic Accounting Work Routing (SDD-030, slice A+B: WorkUnit + WorkResult)

## Status consumed (openspec store, authoritative)

```yaml
schemaName: spec-driven
changeName: sdd-030-routing
artifactStore: openspec
applyState: ready (planning chain complete: proposal -> spec -> design -> tasks)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
dependencies.apply: ready
nextRecommended: parent-lifecycle (after batch freeze; no commit/push/PR/review performed by this phase)
```

**Delivery decision (resolved by parent at delegation):** single apply unit on one branch; tasks.md Review Workload Forecast `single-pr` / `size-exception` ("~390 stays under the 400-line cap", "no 400-line exception required"), `Decision needed before apply: No`, `Chained PRs recommended: No`, `400-line budget risk: Low`. **The forecast's own contingency is triggered: actual authored lines exceed 400 — see "Workload / PR boundary" below; the parent owns the branch/PR decision.**

**Strict TDD:** active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). RED → GREEN → TRIANGULATE → REFACTOR per unit; RED was the missing `routing/` module (all three focused test files failed to load).

**Attempt token (parent-acquired, slice-ab):** `sha256:5679711101a1ffc9d80e7a11d3d4b21fb3776ca174305628a0aa410e096abd11`. No acquire/settle performed by this phase (per delegation instructions).

**Scope honored:** only `routing/**` (new library + tests), the package-root `index.ts` (+1 export line), and `openspec/changes/sdd-030-routing/{tasks,apply-progress}.md`. No `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**`, `tsconfig*.json`, or `package.json` touched.

## Phase 0 evidence

- **Revision frozen:** `git rev-parse HEAD` = `eda00e37ea42463cb8fa7db98b25b24dcd51929a` (branch `docs/program-readme-index`; its PR #38 merged — implementation builds on current main content). Working tree before the slice: only untracked `openspec/changes/sdd-030-routing/` (this change's own planning artifacts) — nothing pre-existing mutated.
- **Green baseline:** `bun run test` → **61 files, 798 passed, all green**. NOTE: the tasks.md/config.yaml citation of "647 tests, 52 files, 3 known pre-existing failures in `cmd/__tests__/cli.test.ts`" is **stale** — the current tree at eda00e3 has zero known failures (798/798 green). No failure is attributable to this change.
- **Protected paths:** `missions/**`, `candidates/**`, `agents/**`, `contracts/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**` — confirmed no task lists any as an edit target; final `git status`/`git diff` (below) confirms none was touched.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

Phase 0 — 3/3 rows `[x]`; Phase 1 (implementation) — 11/11 rows `[x]`; Phase 2 (tests) — 17/17 rows `[x]`; Phase 3 (verification) — 5/5 rows `[x]`. The two parent-owned lifecycle rows remain `[ ]` (bounded review + single-PR delivery decision).

| Task | Summary |
| --- | --- |
| 1.1 `routing/types.ts` | Full immutable type surface per design §3: type-only imports from `../missions/index.js` (`AccountingException`, `AccountingMissionStatus`, `MissionIntent`, `MissionSnapshot`, `validateTransition`) and `../candidates/index.js` (`Candidate`, `CandidateScope`, `MaterialityInput`); `CanonicalTransitionValidator = typeof validateTransition`; branded `JsonInteger`/`Sha256Hash`; literals `ResearchAttemptLimit = 1\|2\|3` and `CorrectionAttemptLimit = 1`; flat `WorkScope` (tenantId, 11-digit ruc, companyId, optional companyName, YYYYMM period, intent). No runtime import, no `agents/`, no adapters, no store/ledger/receipt/journal/network reference. |
| 1.1 WorkUnit types | `EvidenceRef { algorithm: "sha256"; hash }`, `VersionPin`, `AuthorizedTool`, `AuthorizedDestination`, `OutputSchemaRef`, closed `SuccessCondition` union, `WorkBudgets` (`costLimitCents: bigint`, `timeLimitMs`/`tokenLimit` as `JsonInteger`, literal attempt limits), the closed 9-kind `WorkStopReason` discriminated union + `WorkStopReasonKind`, and the `WorkUnit` record (id, missionId, objective, `stage: AccountingMissionStatus`, scope, evidenceAllowed, skills, policies, authorizedTools, authorizedDestinations, outputSchema, budgets, successConditions, stopConditions). No free-text field is authoritative. |
| 1.1 WorkResult types | `ProposedCandidateRef` (`Pick<Candidate, "id"\|"subjectHash"\|"scope"\|"materiality">` + structured `materialityBasis: MaterialityInput`), `WorkOutcome` union (`SUCCEEDED` \| `STOPPED`/`FAILED` each carrying a `WorkStopReason`), `ToolProvenance`, `CostAndAttempts` (`costIncurredCents: bigint`, branded integer attempts), `NextTransition { from; to }`, and the `WorkResult` record (workUnitId, missionId, outcome, evidenceRefs, proposedCandidates, unresolvedExceptions, policyVersions, toolProvenance, costAndAttempts, nextTransition, optional non-authoritative `explanation`). |
| 1.2 `routing/helpers.ts` | Runtime `createHash` from `node:crypto` only; `ValidationIssue`, `ValidationResult<T>`, `WorkUnitInput` (scope = `Pick<WorkScope, "tenantId"\|"ruc"\|"companyName">`), `WorkResultInput` (`workUnitId`/`missionId` `never`); `toJsonInteger` (brands only after `Number.isSafeInteger` + non-negative), `parseSha256Hash` (only 64 lowercase hex chars), `createEvidenceRef(bytes)` (SHA-256 over exact bytes). Local shape regexes `/^\d{11}$/` and `/^\d{6}$/` replicate the documented CandidateScope contract (validators themselves are not importable under the type-only boundary). |
| 1.3 `createWorkUnit` | Derives `missionId`, `companyId`, `period`, `intent` from the `MissionSnapshot` (never trusts caller duplicates) via `assembleScope`; sets `stage` to canonical `DRAFT` (private `INITIAL_STAGE` literal locally asserted to the imported enum type — no exported second status set; tests prove it equals `AccountingMissionStatus.DRAFT`). Rejects invalid RUC/YYYYMM, empty identities/objective/schema/conditions, malformed hashes, negative costs, floating/unsafe counters, research outside 1..3, correction != 1. Returns `ValidationResult` with typed issues and no partial envelope (validates the assembled shape via shared `checkUnitShape`). |
| 1.3 `validateWorkUnit` | Re-checks mission agreement (companyId/period/intent), the canonical `DRAFT` entry stage, budget typing/bounds, hash validity, and non-empty conditions through the same `checkUnitShape`; any issue → `{ ok: false }` with no partial value. |
| 1.4 `advanceWorkUnit` | Rejects `to === unit.stage` first, then invokes the INJECTED `CanonicalTransitionValidator` in try/catch; acceptance → immutable copy with the new stage; rejection → `INVALID_TRANSITION` issue, original unit unchanged. No routing-local transition table exists (the 15×15 test proves acceptance equals the real `VALID_TRANSITIONS` matrix). |
| 1.5 `createProposedCandidateRef` | Copies id/`subjectHash`/scope/materiality from a real `Candidate`; requires `MaterialityInput.value` as non-negative `bigint`; validates reversibility against the 3-literals and non-empty jurisdiction; rejects malformed subject hashes. Candidate-vs-unit scope mismatch is enforced in `checkResultFields` against `unit.scope`. |
| 1.6 `createWorkResult` | Derives `workUnitId`/`missionId` from the `WorkUnit`; requires `nextTransition.from === unit.stage`; calls the injected canonical validator for the pair (UNKNOWN recovery targets RUNNING/FAILED/COMPLETED are accepted by the real Core validator — `VALID_TRANSITIONS` already contains the UNKNOWN row); rejects non-bigint/negative costs, floating/unsafe attempt counts, malformed evidence/tool hashes, candidate scope mismatch vs unit scope, unpinned policy versions (empty id/version), malformed exceptions, and stopped/failed outcomes without a typed reason; `SUCCEEDED` carrying a `reason` is rejected (fail closed). |
| 1.6 `validateWorkResult` | Re-runs the same structured checks + canonical transition validation via shared `checkResultFields`; `explanation` is never read — changing or removing it cannot change validation (proven by test). |
| 1.7 Public exports | `routing/index.ts` re-exports `./types.js` + `./helpers.js`; package `index.ts` adds `export * from "./routing/index.js"` (single line, appended after flow). No lower-level module imports changed. |
| 2.1 work-unit tests | 22 tests: mission-derived construction + scope triangulation (bad RUC, bad YYYYMM, empty tenant/company, mission mismatch); 15-state enum count/value check; full 15×15 matrix vs real `VALID_TRANSITIONS` via real `validateTransition` (QUEUED→RUNNING accepted, QUEUED→COMPLETED rejected, no parallel lifecycle); UNKNOWN recovery + reject-other; self-transition rejection with immutable unit; budget bounds (research 1\|2\|3, correction 1, positive/zero bigint cents; rejects negative, float, unsafe, 0/4 research, correction 2) + `@ts-expect-error` compile fixtures; `toJsonInteger` boundary; all 9 stop-reason discriminants + unknown-kind `@ts-expect-error` + empty/free-text stop rejection; SHA-256 vectors (empty + "abc"), malformed/non-hash evidence rejection, `parseSha256Hash` cases; fail-closed no-partial-envelope. |
| 2.2 work-result tests | 18 tests: bigint costs + safe integer attempts; rejection table (number cost, negative cost, float research, unsafe correction) + `@ts-expect-error` Number-cost fixture; evidence vector + memory-key/prose/malformed rejection; candidate identity preservation + malformed-hash/invalid-materiality rejection + scope-mismatch-vs-unit rejection; transition consistency (RUNNING→AWAITING_APPROVAL, DRAFT→COMPLETED absent rejected, from≠stage rejected, UNKNOWN recovery); id derivation + tampered-id re-validation; typed outcomes (STOPPED/FAILED without reason rejected, valid reasons accepted, SUCCEEDED-with-reason rejected); explanation non-authoritative (change/remove → validation unchanged); exceptions/policy pins/tool provenance preserved without coercion; unpinned policies rejected. |
| 2.3 boundary tests | 5 tests: production-source import allowlist (only `node:crypto` runtime; only `import type` from `../missions|../candidates/index.js`; no agents/cmd/adapters/ledger/receipt/journal/store/network/http specifiers); frozen Core no reverse imports (`missions/*.ts` scanned; 15 enum values, `VALID_TRANSITIONS.size === 15`, QUEUED→RUNNING accepted, QUEUED→COMPLETED throws); surface proposes only (ledger/receipts/journal/evidence dir listings unchanged after createWorkUnit+createWorkResult; mission snapshot untouched); deterministic/offline (no clock/random/network/transport tokens in the three test files — token literals split so the scan is self-safe); identical results on repeated runs. |
| 2.4 Conformance + regression | Focused 3-file run 45/45 (twice, identical); full suite 64 files/843 passed (798 baseline + 45 new), all green; targeted strict typecheck clean (see deviations 2); official `bun run typecheck` exit 0; `bun run build` exit 0 with `dist/routing/` emitted; existing mission/candidate/agent suites unchanged (identical baseline counts). |
| 3.x verification | Focused run → full suite → typecheck → build → protected-path scan (below) → spec pass/fail (below) → budget check (see deviation 1). |

## TDD Cycle Evidence

| Unit | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| A — WorkUnit surface (1.1–1.4, 2.1) | 3 focused files fail to load (missing `routing/` module), 0 tests ran | `routing/types.ts` + `routing/helpers.ts` (WorkUnit side) + `routing/index.ts` written → focused run passes | Invalid RUC/YYYYMM/tenant/company, mission mismatch, budget bounds table, stop-reason discriminants, evidence vectors | Branded `Sha256Hash` constants in tests; `res.issues` narrowing; `as never` runtime-invalid fixtures; `as const` research loop |
| B — WorkResult surface (1.5–1.6, 2.2) | Same RED run (module absent) | `createProposedCandidateRef`/`createWorkResult`/`validateWorkResult` written → focused passes | Number/float/negative costs, candidate scope mismatch, from≠stage, UNKNOWN recovery, SUCCEEDED-with-reason, unpinned policies | Removed unused `WorkStopReason` import caught by build's `noUnusedLocals` |
| C — Boundary (1.7, 2.3) | Same RED run (module absent) | Package `index.ts` export + boundary tests green | URL-resolution fixes in scan fixtures (`../` vs `./`); import allowlist regex; forbidden-token self-reference fixed by splitting literals | Focused suite re-run twice → identical 45/45 |

## Files changed (with authored-line accounting)

| Path | Status | Lines (net authored) |
| --- | --- | ---: |
| `routing/types.ts` | new | 222 |
| `routing/helpers.ts` | new | 532 |
| `routing/index.ts` | new | 9 |
| `index.ts` | modified | +1 |
| `routing/__tests__/work-unit.test.ts` | new | 363 |
| `routing/__tests__/work-result.test.ts` | new | 422 |
| `routing/__tests__/boundary.test.ts` | new | 261 |
| `openspec/changes/sdd-030-routing/tasks.md` | modified | 36 checkbox updates |
| `openspec/changes/sdd-030-routing/apply-progress.md` | new | this file |
| **Net authored total (routing/ + index.ts)** | | **1,810** |

No `tsconfig*.json`, `package.json`, `contracts/**`, docs, `agents/`, `ledger/`, `receipts/`, `missions/`, `candidates/`, `evidence/`, `journal/`, or `flow/` changes.

## Test commands and exact results

- `bun run test -- routing/__tests__/work-unit.test.ts routing/__tests__/work-result.test.ts routing/__tests__/boundary.test.ts` — RED: **3 files failed, 0 tests ran** (module load: `routing/index.js` absent) → GREEN: **3 files, 45 tests passed** (re-run twice, identical 45/45).
- `bun run test` — **64 files, 843 passed (798 baseline + 45 new), all green**.
- `bun run typecheck` — exit 0 (green; unchanged scope).
- Targeted strict typecheck of `routing/` + root `index.ts` + the three test files: `bunx tsc --ignoreConfig --noEmit --strict --noUnusedLocals --noUnusedParameters --noImplicitReturns --noFallthroughCasesInSwitch --target ES2022 --lib ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop --forceConsistentCasingInFileNames --skipLibCheck --types node routing/index.ts index.ts routing/__tests__/*.test.ts` — exit 0 (verifies the `@ts-expect-error` fixtures and full strict surface; see deviation 2).
- `bun run build` — exit 0; emits `dist/routing/{types,helpers,index}.{js,d.ts}` (+ maps); `node -e import('./dist/index.js')` confirms `createWorkUnit` is exported from the built package root.

## Deviations from design/tasks

1. **Changed-line budget (Phase 3 gate):** actual authored additions+deletions = **1,810** vs the Forecast's 296–390 and the 400-line hard cap. The design's per-file estimates (types 115–135, helpers 75–95, tests 40–50 each) were materially below the coverage the tasks demand (full 15×15 matrix, 9 stop-reason discriminants with payload validation, budget rejection tables, import-allowlist and reverse-import scans, deterministic/offline scan, propose-only and no-write checks). Per the tasks' instruction I did NOT omit scenarios to hit the cap. **This triggers the Forecast's contingency: promote the two-PR split boundary (WorkUnit surface/helpers/tests/index → PR 1; WorkResult surface/helpers/tests/boundary + package export → PR 2) and do NOT merge as one unit. I cannot merge — the parent owns the PR topology decision.** Suggested split with exact counts: PR 1 = `routing/types.ts` (222) + `routing/helpers.ts` (532) + `routing/__tests__/work-unit.test.ts` (363) + `routing/index.ts` (9) ≈ 1,126; PR 2 = `routing/__tests__/work-result.test.ts` (422) + `routing/__tests__/boundary.test.ts` (261) + `index.ts` (+1) ≈ 684. NOTE: `helpers.ts` and `index.ts` physically contain the WorkResult surface too, so the cleanest file-level split is the three test files + root export; a true semantic split would require re-arranging `helpers.ts`/`index.ts`, which is a parent/maintainer call.
2. **Typecheck scope:** `tsconfig.json` (official `bun run typecheck`) does not include `routing/` or root `index.ts` in its `include` list, so the official command does not typecheck this slice. I ran an explicit targeted strict `tsc` over `routing/**` + `index.ts` + the test files (exit 0) and the build pulls `routing/` transitively through `index.ts` under `tsconfig.build.json` strictness (exit 0). Adding `routing` to the tsconfig include lists was NOT done (outside the allowed file list); it is a recommended follow-up for the parent.
3. **`WorkUnitInput.scope` type:** implemented exactly as designed (`Pick<WorkScope, "tenantId" | "ruc" | "companyName">`); `createWorkUnit` merges mission-derived `companyId`/`period`/`intent`. `validateWorkUnit` additionally checks `unit.stage === DRAFT` (entry-stage re-check per design helper invariant 2/3).
4. **Stop-reason runtime validation depth:** `WorkUnit.stopConditions` validates each entry is one of the 9 `WorkStopReasonKind` discriminants; `WorkResult` outcomes validate the full discriminated-union payload (per-kind required fields) — slightly deeper than the design's "reject empty free-text-only stops and malformed reason payloads" wording, to keep fail-closed behavior explicit.
5. **Boundary test self-safety:** the offline/clock token scan splits its own forbidden literals (`"Math." + "random"`, `"fet" + "ch("`, etc.) so the scanner cannot flag itself; the scan covers the three routing test files only.

## Remaining tasks (parent-owned, unchecked in tasks.md)

- `- [ ] Start or reuse bounded review for the single SDD-030 candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-020 configurator slice: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->`
- `- [ ] Deliver the first slice via a single PR following repository policy; update the SDD-030 change record (proposal.md lifecycle toward apply evidence; record tasks/verify/archive state) and confirm the deferred-slice list (preflight router Slice C, runtime budget enforcement, negotiated-status, adapters/executors) remains documented for later SDD-030 slices. <!-- sdd-owner: parent -->`

## Workload / PR boundary

- Forecast guard lines honored: `Decision needed before apply: No`, `Chained PRs recommended: No`, `Chain strategy: size-exception`, `400-line budget risk: Low` (as forecast). The **actual** budget exceeded 400 → contingency (split into two chained PRs at the WorkUnit/WorkResult boundary) is promoted to the parent for the delivery decision. This phase made no commit, PR, or review.
- Attempt token recorded above (parent-acquired); no acquire/settle invoked by this phase.

## Spec pass/fail check (R1–R4, S1–S15)

| Requirement / scenario | Result |
| --- | --- |
| R1 WorkUnit Surface | PASS |
| R2 WorkResult Surface | PASS |
| R3 Boundary Compliance | PASS |
| R4 Testability | PASS |
| S1.1 WorkUnit constructed from a mission | PASS |
| S1.2 Stage alignment across the 15 canonical states | PASS |
| S1.3 Budget types and bounds | PASS |
| S1.4 Typed stop reason fails closed | PASS |
| S2.1 WorkResult construction with BigInt cents | PASS |
| S2.2 Evidence refs by hash | PASS |
| S2.3 Proposed candidates by subjectHash | PASS |
| S2.4 nextTransition consistent with status and apply | PASS |
| S2.5 No free-text authority | PASS |
| S3.1 Import boundary holds | PASS |
| S3.2 Frozen Core has no reverse imports | PASS |
| S3.3 Surface proposes only | PASS |
| S4.1 Conformance matrix passes | PASS |
| S4.2 Deterministic and offline | PASS |
| S4.3 Existing behavior unchanged | PASS |

Explicitly out of scope / deferred to later slices (unchanged from proposal): deterministic preflight router (Slice C) and §5 route-selection table, runtime budget enforcement, negotiated-status implementation, adapters/executors, CLI/MCP/SDK/Command Center wiring, ledger/receipt/journal writes, authorization/materiality/approval changes.

## Final verification

- Protected-path check: `git status` shows only `M index.ts`, `?? routing/`, `?? openspec/changes/sdd-030-routing/` — no protected path touched; `git diff --stat` against baseline covers only `routing/**` + `index.ts` (+1).
- Focused suite twice identical (45/45), full suite 843/843, targeted strict typecheck exit 0, official typecheck exit 0, build exit 0.
- Working tree left with the implementation applied; **nothing committed** (per delegation instructions).
