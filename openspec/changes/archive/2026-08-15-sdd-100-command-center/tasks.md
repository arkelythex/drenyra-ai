# Tasks — sdd-100-command-center (Option A: Mission Projection)

> Phase: tasks · Store: openspec · Scope: new `projection/` library module, first slice.
> Protected (do NOT touch): `missions/`, `routing/`, `agents/`, `cmd/`, `contracts/`, `flow/`,
> `drenyra-command-center`, or any sibling-repository file. `missions/` is a strict non-goal
> (no changes to canonical transition behavior, comments, or data).
> Test runner: `bun run test` (Vitest) · Typecheck: `bun run typecheck` · Build: `bun run build`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 216–257 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

Notes:

- **Single PR.** Estimated implementation + tests = 216–257 changed lines, well inside the
  300-line review budget (`review_budget_lines: 300`). No chained PRs required.
- **Size exception (accepted 2026-08-15).** Actual 425 changed lines (422 insertions / 3 deletions)
  vs the 300 cap. Coverage mandated by REQ-PROJ-001..013 under strict TDD (15-state conformance,
  denial matrix, malformed matrix, determinism, mutation isolation); single cohesive module, no
  scope creep. Accepted per the documented maintainer-reset precedent (SDD-020 slices at 768–788
  lines). Delivered as PR #58.
- **`Chain strategy: pending`** only because no stack applies to a single independent PR.
- **`Decision needed before apply: No`** — under 400 lines, risk Low; auto-apply may proceed.
- Follows the established slice pattern of this repo: implementation + tests + exports in one
  focused PR, orchestrator commits.

## Task ownership

`implementation` = authoring code/tests/docs + running verification. `parent` = post-apply
bounded review and lifecycle gates (grouped separately at the end). Every checkbox carries
exactly one terminal owner marker.

---

## Phase 0 — Preflight evidence capture (no commit)

- [x] Capture `git status --porcelain` and `git diff --name-only` BEFORE any edit, to serve as
  the integrity baseline. Confirm the protected paths (`missions/`, `routing/`, `agents/`,
  `cmd/`, `contracts/`, `flow/`) are clean at baseline. <!-- sdd-owner: implementation -->
- [x] Run `bun run test` to record the suite baseline (expect 967 passing; note the 3 documented
  pre-existing failures in `cmd/__tests__/cli.test.ts` if still present — report them separately,
  never as new projection regressions). <!-- sdd-owner: implementation -->
- [x] Run `bun run typecheck` and `bun run build` to confirm a green baseline before any edit. <!-- sdd-owner: implementation -->

---

## Phase 1 — RED/GREEN units (Strict TDD)

Each unit: write the focused RED test first, confirm it fails, then implement to GREEN, then
TRIANGULATE/REFACTOR, recording evidence for each stage. All 6 units live under the new
`projection/` module and satisfy the REQ/SC identifiers shown.

### T-PRJ-001 — Shape + all-15 next-action table (RED/GREEN 1)

**Files:** `projection/types.ts`, `projection/project-mission.ts`, `projection/index.ts`,
`projection/__tests__/project-mission.test.ts`
**Satisfies:** SC-PROJ-001/004/005/006/007, REQ-PROJ-001/004

- [x] RED: In `projection/__tests__/project-mission.test.ts`, create the shape test. Drive over
  all 15 canonical enum values (`AccountingMissionStatus` from `missions/status.js`): assert
  `status` passthrough is exactly the input, `nextAction` matches the exact SC-PROJ-005 table
  (`DRAFT→"queue"`, `QUEUED→"run"`, `RUNNING→"monitor"`, `BLOCKED→"resume"`,
  `AWAITING_APPROVAL→"review"`, `APPROVED→"finalize"`, `REJECTED→"request-revision"`,
  `REVISION_REQUESTED→"requeue"`, `COMPLETED→"none"`, `FAILED→"none"`, `UNKNOWN→"reconcile"`,
  `RECOVERING→"monitor"`, `WAITING_FOR_EVIDENCE→"provide-evidence"`,
  `BLOCKED_BY_GATE→"resolve-gate"`, `RETRYING→"monitor"`), and no `deny` is emitted without a
  request. Assert terminal states (`COMPLETED`, `FAILED`) project `"none"`. Confirm the test
  fails (no implementation yet). <!-- sdd-owner: implementation -->
- [x] GREEN: Create `projection/types.ts` with the closed public types and result union from
  design D8 (snapshot, request, denial, projection, unsupported-result, `MissionNextAction`
  closed vocabulary). Create `projection/project-mission.ts` implementing `projectMission` with
  runtime status validation and an exhaustive `satisfies Record<AccountingMissionStatus, MissionNextAction>`
  private action map (design D11). Barrel both in `projection/index.ts`. Run
  `bun run test -- projection/__tests__` until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm every one of the 15 states maps to exactly one closed action
  code; confirm non-terminal states never yield `"none"` or a missing action. Record evidence. <!-- sdd-owner: implementation -->

### T-PRJ-002 — Canonical eligibility + UNKNOWN recovery separation (RED/GREEN 2)

**Files:** `projection/project-mission.ts`, `projection/__tests__/project-mission.test.ts`
**Satisfies:** REQ-PROJ-002, SC-PROJ-002/003

- [x] RED: For every state, assert `eligibleTransitions` deeply equals a fresh spread of
  `VALID_TRANSITIONS.get(status)`. For `UNKNOWN`, assert ordinary `eligibleTransitions` is an
  empty frozen array and `recoveryTransitions` is exactly `[RUNNING, FAILED, COMPLETED]`. For
  all other states assert `recoveryTransitions` is absent (design D4). Include terminal and
  wait-state assertions. Confirm RED. <!-- sdd-owner: implementation -->
- [x] GREEN: Read `VALID_TRANSITIONS.get(status)` as data only (design D5 — never import a new
  recovery constant, never modify `missions/`). Convert the canonical `Set` with
  `[...canonicalTransitions]` per call (design D6); separate UNKNOWN recovery into its own field.
  Run the suite until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Pin recovery to `{RUNNING, FAILED, COMPLETED}` via a conformance
  assertion (divergence fails visibly); confirm recovery targets are never presented as ordinary
  progression. Record evidence. <!-- sdd-owner: implementation -->

### T-PRJ-003 — Denial matrix (RED/GREEN 3)

**Files:** `projection/project-mission.ts`, `projection/__tests__/project-mission.test.ts`
**Satisfies:** REQ-PROJ-006, SC-PROJ-009/010/011

- [x] RED: Table-drive denial cases (design D9/D10): absent request → no denial; eligible request
  → no denial; ineligible request → `INVALID_TRANSITION`; terminal-state request →
  `INVALID_TRANSITION` with cause `terminal-state` and continuation `no-continuation-available`;
  each eligible target with `APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, or `POLICY_BLOCKED` blocker
  → the exact supplied code/cause/continuation; eligible UNKNOWN recovery target → no denial;
  blocked UNKNOWN recovery target → the supplied blocker. Assert exact closed code/cause/continuation
  and that no throw occurs for a semantically-answerable denial. Confirm RED. <!-- sdd-owner: implementation -->
- [x] GREEN: Implement fixed deterministic precedence (design D9): malformed → `UNSUPPORTED_STATUS`;
  unavailable target → `INVALID_TRANSITION`; available target + blocker → the blocker code;
  otherwise no denial. Freeze denial objects. Never invoke guards. Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm denial codes stay within the closed set
  (`INVALID_TRANSITION`, `APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, `POLICY_BLOCKED`,
  `UNSUPPORTED_STATUS`) and causes/continuations are closed unions (no free-form prose). Record
  evidence. <!-- sdd-owner: implementation -->

### T-PRJ-004 — Malformed input / fail-closed (RED/GREEN 4)

**Files:** `projection/project-mission.ts`, `projection/__tests__/project-mission.test.ts`
**Satisfies:** REQ-PROJ-007/008, SC-PROJ-012/013

- [x] RED: Pass nullish/non-object snapshots, empty/misspelled statuses, malformed request
  objects, non-canonical targets, unknown blockers, and unexpected keys through an `unknown`/cast
  boundary. Assert only an `UNSUPPORTED_STATUS` denial is returned with no projection fields
  (`status`, `eligibleTransitions`, `nextAction` absent) and no throw. Also assert every enum
  value has a matrix entry (proving the missing-entry invariant without mutating shared canonical
  data). Confirm RED. <!-- sdd-owner: implementation -->
- [x] GREEN: Add runtime validators (design D8): validate snapshot object, enum membership,
  request exact shape/keys, target, and blocker before reading matrix or action map; implement
  the total fail-closed branch returning `UnsupportedMissionProjection`. Use
  `unsupported-status-value` / `provide-supported-status` for bad status and
  `malformed-projection-request` / `correct-projection-request` for malformed request. Run until
  GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm the read-only guarantee (SC-PROJ-013) — no guard
  (`transition`, `validateTransition`, `reconcileTransition`, `guardTerminal`), no gate, no
  receipt, no mutation is reachable from this module. Record evidence. <!-- sdd-owner: implementation -->

### T-PRJ-005 — Determinism + mutation isolation (RED/GREEN 5)

**Files:** `projection/project-mission.ts`, `projection/__tests__/project-mission.test.ts`
**Satisfies:** REQ-PROJ-003/009/010, SC-PROJ-004/014/015

- [x] RED: Assert equal calls are deeply equal, preserve `RUNNING` canonical declaration order,
  return distinct references per call, and are frozen. Add a mutation test that widens a returned
  readonly array, attempts mutation, asserts the frozen array throws, confirms
  `VALID_TRANSITIONS` is unchanged, and confirms a later call returns a distinct frozen array
  with canonical contents. Confirm RED. <!-- sdd-owner: implementation -->
- [x] GREEN: Runtime-freeze (`Object.freeze`) arrays, denial objects, projections, and
  fail-closed results on every call (design D7); use `readonly` in public declarations; fresh
  allocation per call (design D6/D10). Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm no mutable cache, clock, randomness, environment, filesystem,
  network, or store is used; equal inputs are deeply equal but not reference-equal. Record
  evidence. <!-- sdd-owner: implementation -->

### T-PRJ-006 — Exports smoke tests (RED/GREEN 6)

**Files:** `projection/__tests__/exports.test.ts`, `index.ts` (root barrel), `package.json`
**Satisfies:** REQ-PROJ-013, SC-PROJ-018

- [x] RED: Create `projection/__tests__/exports.test.ts` smoke-testing the `projection` barrel:
  assert it exposes only intended projection operations/types (`projectMission`, public types)
  and NO guard, gate, mutation, receipt, store, or private map. Confirm the missing-module import
  fails RED. <!-- sdd-owner: implementation -->
- [x] GREEN: In `projection/index.ts` re-export public types from `types.ts` and `projectMission`
  from `project-mission.ts` (no mutation/guard surface). Add the exact subpath entry to
  `package.json` exports: `"./projection": "./dist/projection/index.js"` (design D1). Add the
  convention-required root re-export in `index.ts`:
  `export * from "./projection/index.js";`. Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm the dedicated `./projection` subpath is the narrow authority
  boundary; confirm no unrelated package API widened. Record evidence (build output / packed
  artifact if the harness supports it; avoid package-name self-import if unpublished
  self-references are unsupported). <!-- sdd-owner: implementation -->

---

## Phase 2 — Gates (full verification, no commit)

- [x] Run `bun run typecheck` (strict, `tsc --noEmit`) — expect zero errors. <!-- sdd-owner: implementation -->
- [x] Run `bun run build` — expect success and that `dist/projection/index.js` is produced. <!-- sdd-owner: implementation -->
- [x] Run full `bun run test` — expect 0 new failures. Report the 3 pre-existing
  `cmd/__tests__/cli.test.ts` failures separately; they never convert a new projection regression
  into a pass. <!-- sdd-owner: implementation -->

---

## Phase 3 — Close (orchestrator)

- [x] Update the change record (spec/design/tasks) with the final changed-line count and any
  verification evidence; confirm no `missions/` or other protected path changed vs the Phase 0
  baseline. <!-- sdd-owner: implementation -->
- [x] Orchestrator commits the single PR (implementation + tests + exports in one focused PR) and
  opens/delivers it per repository policy. <!-- sdd-owner: parent -->

---

## Acceptance mapping (REQ → proving tasks)

| Requirement | Proving task(s) |
| --- | --- |
| REQ-PROJ-001 — Canonical status passthrough | T-PRJ-001 (SC-PROJ-001) |
| REQ-PROJ-002 — Canonical eligibility + separated UNKNOWN recovery | T-PRJ-002 (SC-PROJ-002/003) |
| REQ-PROJ-003 — Determinism | T-PRJ-005 (SC-PROJ-004) |
| REQ-PROJ-004 — Closed next-action mapping | T-PRJ-001 (SC-PROJ-005/006/007) |
| REQ-PROJ-005 — Guidance ceiling | T-PRJ-001 (SC-PROJ-008) |
| REQ-PROJ-006 — Typed denial | T-PRJ-003 (SC-PROJ-009/010/011) |
| REQ-PROJ-007 — Fail closed | T-PRJ-004 (SC-PROJ-012) |
| REQ-PROJ-008 — Read-only | T-PRJ-004 (SC-PROJ-013) |
| REQ-PROJ-009 — Deterministic ordering | T-PRJ-005 (SC-PROJ-014) |
| REQ-PROJ-010 — Immutability | T-PRJ-005 (SC-PROJ-015) |
| REQ-PROJ-011 — Receipt fidelity | T-PRJ-001 (SC-PROJ-016) |
| REQ-PROJ-012 — Consumer neutrality | T-PRJ-003 + T-PRJ-001 (SC-PROJ-017) |
| REQ-PROJ-013 — Package export | T-PRJ-006 (SC-PROJ-018) |

---

## Parent-owned lifecycle gates (post-apply)

- [x] Run bounded review on the single PR against the spec acceptance criteria (REQ-PROJ-001..013),
  the protected/excluded file integrity (`missions/` and other non-goal paths), and closed
  vocabulary conformance, then gate apply/verify per the lifecycle. <!-- sdd-owner: parent -->
- [x] Run `sdd-verify` for the change and confirm CRITICAL/WARNING state before archive. <!-- sdd-owner: parent -->

## Risks

- **Recovery-source visibility (design risk 1):** spec names private recovery constants, but
  Option A reads the exported identical UNKNOWN matrix entry and pins `{RUNNING, FAILED, COMPLETED}`
  via conformance test (T-PRJ-002). Do not modify `missions/` to expose private data.
- **Strict request shape (design risk 4):** rejecting unknown keys is fail-closed but makes future
  additions breaking; Option A is not frozen — a future contract must version evolution.
- **Root API growth (design risk 5):** convention requires a root re-export; the dedicated
  `./projection` subpath remains the preferred narrow surface.
- **Blocking-condition trust (design risk 2):** projection does not verify a caller-supplied
  blocker; Core must evaluate authority for mutation. No behavior change here.
