# Archive Report — sdd-100-command-center (Option A: Mission Projection, slice A)

> Change: `sdd-100-command-center` · Phase: archive · Store: openspec (artifacts) + engram (archive
> report) · Branch: `feat/sdd-100-projection-slice-a` · HEAD: `79d4cec` (implementation) ·
> Merged: `54ab5be` via PR #58 · Archive date: 2026-08-15
>
> **Archive status: PASS.** Verification PASS 13/13 with zero code findings; both CRITICAL artifact-state
> findings remediated by the parent; all implementation task checkboxes confirmed complete; no
> destructive merge (no canonical specs tree exists — full domain spec preserved as-is).

## Executive summary

This change delivered the **first drenyra-ai-side slice for SDD-100 (Professional Command Center)**:
a new read-only, deterministic `projection/` library module that the sibling `drenyra-command-center`
UI can consume without reconstructing Core lifecycle rules. It answers four questions — current
canonical status, eligible transitions now, what the operator should do next, and a typed denial when a
requested continuation is unavailable — while keeping the canonical mission state machine the single
authority.

The projection reads canonical data (`missions/status.ts` `VALID_TRANSITIONS`, `TERMINAL_STATES`,
`AccountingMissionStatus`) **as data only**, never invokes a transition guard, never mutates, never
executes a gate, and never emits a receipt. It is guidance and observation, never authorization.

The full Command Center UI **product is NOT delivered by this change**. Only the drenyra-ai projection
surface slice A shipped. The SDD-100 program record stays `lifecycle:in-progress` (not complete); the
full product experience lives in the sibling `drenyra-command-center` repository and is tracked there.

Implementation, tests, and export wiring were delivered as one cohesive PR and merged on `main` at
`54ab5be` (PR #58). All gates are green: suite **981/981**, typecheck **0 errors**, build **OK**,
CI **6/6**.

## Final state

- **What shipped:** new `projection/` library module — `types.ts` (closed public types and result
  union), `project-mission.ts` (`projectMission(snapshot, request?)`), `index.ts` (projection-only
  barrel), plus focused tests. Narrow wiring edits: root `index.ts` re-export, `package.json`
  `./projection` subpath, and both tsconfig include lists.
- **Commit / PR:** implementation committed at `79d4cec`; merged on `main` at `54ab5be` via PR #58
  (`feat(projection): deterministic read-only mission lifecycle projection (SDD-100 slice A)`).
- **Package surface:** runtime import of the built `./projection` subpath exposes exactly
  `["projectMission"]`; no guard, gate, mutation, receipt, store, or private map is exported.
- **Consumer boundary:** the dedicated `drenyra-ai/projection` subpath is the narrow authority
  boundary; the convention-required root barrel re-export adds no unrelated API.
- **Rollback:** additive and low risk — remove the `./projection` export and module; no canonical
  mission state, receipts, ledger, or accounting data were touched.

## Requirements verification summary

**PASS — 13/13 requirements (REQ-PROJ-001..013) verified with concrete test evidence; all 18
scenarios (SC-PROJ-001..018) covered; zero code findings; zero WARNINGs.**

| Verdict | Detail |
| --- | --- |
| PASS | REQ-PROJ-001..013 all PASS with direct test evidence (see verify-report requirement mapping) |
| Gates | `bun run test` 981 passed / 0 failures (70 files, +14 from baseline 967) · `bun run typecheck` 0 errors · `bun run build` OK, `dist/projection/` produced · built-subpath runtime surface exactly `["projectMission"]` |
| TDD compliance | 5/6 checks passed; CRIT-2 (evidence-table format) remediated by parent — apply-progress.md now contains the canonical TDD Cycle Evidence table |
| Test layer | Unit-only (14 tests, 2 files) — correct layer for a pure projection function |

Requirement families verified: canonical status passthrough, canonical eligibility with separated
UNKNOWN recovery, determinism, closed next-action mapping, guidance ceiling, typed denial, fail
closed, read-only, deterministic ordering, immutability, receipt fidelity, consumer neutrality, and
package export.

## Deliverables inventory

| Artifact | File / topic | Status |
| --- | --- | --- |
| Exploration | `explore.md` | read |
| Proposal | `proposal.md` (Option A rationale, non-goals, tradeoffs) | read |
| Specification | `spec.md` (REQ-PROJ-001..013, SC-PROJ-001..018, full domain spec) | read |
| Design | `design.md` (decisions D1–D11, module layout, test plan) | read |
| Tasks | `tasks.md` (6 TDD units, gates, acceptance mapping) | read |
| Apply progress | `apply-progress.md` (canonical TDD Cycle Evidence table, deviations) | read |
| Verify report | `verify-report.md` (PASS 13/13; CRIT-1/CRIT-2 closed) | read |
| Archive report | `archive-report.md` (+ engram `sdd/sdd-100-command-center/archive-report`) | written |
| SDD program record | `openspec/programs/drenyra-dominion/sdds/sdd-100-command-center/README.md` | read; stays `lifecycle:in-progress` |

## Deviations & decisions

1. **Size exception (accepted).** 425 changed lines (422 insertions / 3 deletions) vs the 300
   changed-line review budget. Accepted by the orchestrator per the documented maintainer-reset
   precedent (SDD-020 slices at 768–788 lines); recorded in `tasks.md` and the commit body. Root
   cause: design test estimate vs mandated strict-TDD coverage (15-state conformance, denial matrix,
   malformed matrix, determinism, mutation isolation). Delivered as a single cohesive PR — the
   Review Workload Forecast (no chained PRs, Low 400-line risk) was honored in PR shape.
2. **tsconfig includes.** `projection` added to both `tsconfig.json` and `tsconfig.build.json` include
   lists (repo convention lists every module dir in both); without them `bun run typecheck` would be
   vacuous for the new module.
3. **Test consolidation.** 64 → 14 test cases via table-driven loops to fit the size budget; all
   assertions preserved and non-vacuity guarded (`expect(targets).toHaveLength(8)`,
   `expect(ALL).toHaveLength(15)`).
4. **Stale-checkbox reconciliation (CRIT-1) and TDD table (CRIT-2).** Parent flipped the 25
   implementation checkboxes (proven complete by apply-progress + verify-report) and rewrote
   apply-progress with the canonical TDD Cycle Evidence table. Both archive blockers cleared.

## Findings resolution

- **CRIT-1 — Unchecked implementation task checkboxes.** Remediated by the parent: all 25
  implementation-owned `- [ ]` markers are now `[x]` in `tasks.md`. The 3 parent-owned open lifecycle
  gates were in-flight by design and are now complete (commit/PR #58, bounded review, `sdd-verify`).
  **No `- [ ]` implementation task boxes remain.**
- **CRIT-2 — Canonical TDD Cycle Evidence table absent from apply-progress.** Remediated: the parent
  rewrote apply-progress.md to include the canonical RED/GREEN/TRIANGULATE/REFACTOR table. This was a
  template-format non-compliance only; TDD substance was always present and independently verified.
- **SUG-1 (biome lint scope)** and **SUG-2 (commit openspec artifacts at archive)** recorded as
  follow-ups — not blockers; no regressions introduced by this slice.

## Non-goals respected

Verified via `git diff --name-only main...HEAD` (exactly 9 files, all under `projection/`, root barrel,
`package.json`, tsconfigs):

- ✅ No changes to `missions/`, `routing/`, `agents/`, `cmd/`, `contracts/`, or `flow/` (protected
  paths clean at baseline and at HEAD). `missions/` canonical data untouched — projection reads
  `VALID_TRANSITIONS`/`TERMINAL_STATES` as data.
- ✅ No second state machine, no new states/transitions/gates, no receipts, no mutation endpoints, no
  generic `verified` claim, no UI/Spanish copy, no CLI/MCP tool, no DRAFT/frozen public contract.
- ✅ No client-trusted `approved: true` behavior; all mutations return through Core.

## Lessons learned

- **Strict TDD coverage inflates changed-line forecasts.** The 216–257 estimate missed by ~170 lines
  because mandated RED/GREEN/TRIANGULATE coverage for 13 requirements under the strict-TDD contract
  exceeds a naive implementation estimate. Future slices should forecast TDD-driven test volume
  explicitly (table-driven consolidation helps but does not fully offset conformance coverage).
- **Artifact state discipline matters.** Both archive blockers were artifact-state (unchecked boxes +
  missing canonical TDD table), not code defects. Applying the fix to keep artifacts in canonical
  state from the start would avoid archive-time reconciliation.
- **The authority-boundary problem was the real win.** A read-only Core projection removes duplicated
  lifecycle derivation from the UI without a second machine. The value only materializes when the
  sibling Command Center actually consumes it — tracked below.

## Follow-ups

1. **Option B (DRAFT contract + CLI dump):** after `drenyra-command-center` adoption coordination. Adds
   `contracts/projection.md` and a `drenyra-ai project` JSON dump. 350–500 changed lines → separate
   slice or chained PR.
2. **Option C (freeze + MCP):** only after the shape is proven across consumers. Adds a frozen
   contract, conformance vectors + CI drift protection, the CLI dump, and a read-only MCP tool.
   600+ changed lines → multiple PRs + public-contract freeze ceremony.
3. **Command Center adoption coordination:** agree the consumer boundary in the sibling repository
   before Option B; track UI replacement of duplicated lifecycle derivation there.
4. **SUG-1:** add `"projection/**/*.ts"` to `biome.json` `files.includes` when lint scope is next
   touched.
5. **SUG-2:** commit the openspec change artifacts (`openspec/changes/sdd-100-command-center/`) at
   archive time so the change record is tracked in git.
6. **Future cleanup:** correct the stale comment in `missions/transitions.ts` about `UNKNOWN`
   participation (out of scope for this slice; data agrees today).
7. **Program record:** SDD-100 stays `lifecycle:in-progress`; **SDD-110 planning is next** on the
   roadmap, building on this projection surface.

## Sync / move note

This repo has no canonical `openspec/specs/{domain}/spec.md` tree — change specs are flat files under
`openspec/changes/{change}/`. Per repo convention the full domain spec is preserved as-is at archive;
no destructive canonical merge was required, so no archive-time sync fallback was needed and no
ADDED/MODIFIED/REMOVED canonical requirement changes apply.

---
*Archive performed by sdd-archive executor. All artifacts read; all implementation checkboxes confirmed
complete; verification PASS 13/13. Archive report persisted to engram topic
`sdd/sdd-100-command-center/archive-report`. No active artifacts deleted or modified.*
