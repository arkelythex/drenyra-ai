# Apply Progress — sdd-100-command-center (Option A: Mission Projection)

> Phase: apply · Branch: `feat/sdd-100-projection-slice-a` · Commit: `79d4cec` · PR: #58
> Status: implementation complete and green; verification PASS (13/13 requirements).

## Scope delivered

New `projection/` library module implementing the design decisions D1–D11:

| File | Purpose |
| --- | --- |
| `projection/types.ts` | Closed public types: snapshot, request, 12-code `MissionNextAction`, 5-code denial set, cause/continuation unions, result union |
| `projection/project-mission.ts` | `projectMission(snapshot, request?)` — validation, canonical read, action/denial logic, freeze |
| `projection/index.ts` | Projection-only barrel (`projectMission` + public types) |
| `projection/__tests__/project-mission.test.ts` | Conformance/denial/malformed/determinism/mutation/isolation tests |
| `projection/__tests__/exports.test.ts` | Barrel + root-barrel + export-map smoke tests |

Narrow edits: root `index.ts` (+1 re-export), `package.json` (`./projection` subpath), both tsconfigs (see deviations).

## TDD Cycle Evidence (strict TDD, RED → GREEN → TRIANGULATE → REFACTOR)

| Task | Test File | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| T-PRJ-001 | `projection/__tests__/project-mission.test.ts` | N/A (new) | ✅ module-not-found (0 tests) | ✅ 7/7 | ✅ 15-state action table | ✅ conditional spread |
| T-PRJ-002 | same | N/A | ✅ 2 failed | ✅ 25/25 | ✅ all-15 loop + recovery pin | ✅ kept green |
| T-PRJ-003 | same | N/A | ✅ 9 failed | ✅ 36/36 | ✅ 8-target × 3-blocker sweep | ➖ none |
| T-PRJ-004 | same | N/A | ✅ 7 failed | ✅ 54/54 | ✅ 13-case malformed matrix | ➖ none |
| T-PRJ-005 | same | N/A | ✅ 3 failed | ✅ 59/59 | ✅ 25-call determinism + mutation | ➖ none |
| T-PRJ-006 | `projection/__tests__/exports.test.ts` | N/A | ✅ 3 failed | ✅ 64/64 | ✅ barrel + root + export map | ➖ none |
| Consolidation | both files | ✅ 967/967 baseline | — | ✅ 14/14 (loops preserve all assertions) | — | ✅ merge kept green |

Evidence notes: every RED was captured as a real failing test before implementation (module-not-found
for the new module; targeted failures per unit after). The 64-case suite was consolidated into 14
table-driven tests to fit the size budget; all assertions are preserved and non-vacuity is guarded
(e.g. `expect(targets).toHaveLength(8)` before the blocker sweep, `expect(ALL).toHaveLength(15)`).

## Deviations (documented)

1. **tsconfig include additions** — `projection` added to both `tsconfig.json` and
   `tsconfig.build.json` include lists. Repo convention lists every module dir in both; without
   them `bun run typecheck` would be vacuous for the new module.
2. **Size exception** — 425 changed lines (422 insertions / 3 deletions) vs the 300 budget cap.
   Coverage mandated by REQ-PROJ-001..013 under strict TDD; single cohesive module; accepted by
   the orchestrator per the documented maintainer-reset precedent. Recorded in tasks.md and the
   commit body.
3. **Test consolidation** — 64 → 14 test cases via table-driven loops (see TDD table).

## Gates (run at apply close)

- `bun run test` → **981 passed / 0 failures** (70 files; baseline 967)
- `bun run typecheck` → 0 errors
- `bun run build` → OK; `dist/projection/` produced (js + d.ts + maps)
- `git diff main...HEAD` → 9 files only (`projection/` ×5, `index.ts`, `package.json`, 2 tsconfigs);
  protected paths (`missions/`, `routing/`, `agents/`, `cmd/`, `contracts/`, `flow/`) clean.

## Baseline note

The 3 pre-existing `cmd/__tests__/cli.test.ts` failures documented at init are NOT present at
HEAD `c54bcde`; baseline was 967/967 clean.
