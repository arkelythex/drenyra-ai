# Tasks — Constitutional Closure (SDD-000 / SDD-010 freshness)

## Review Workload Forecast

- Estimated changed lines: ~25 (3 files + change record)
- 400-line risk: **Low** — no chaining recommended
- Delivery: single PR (docs-only)

## Phase 0 — Setup/evidence

- [x] Freeze inspected revision and capture baseline: `bun run test` → 843/843, typecheck clean. Protected paths: `contracts/**`, archived change records, non-allowlisted program root docs. <!-- sdd-owner: implementation -->

## Phase 1 — Freshness edits

- [x] `openspec/programs/drenyra-dominion/status-and-evidence.md` §5: update the "SDD-000 / SDD-010 lifecycle" row — Gate 0 rows 3–4 satisfied 2026-08-15 (E-009..E-012); records stay `lifecycle:active` (content-contract phases / release-train remain). <!-- sdd-owner: implementation -->
- [x] `openspec/programs/drenyra-dominion/status-and-evidence.md` §5: update the "Gate 0 rows 3–4" row — `satisfied` 2026-08-15; SDD-020 permitted (gate-0.md §4). <!-- sdd-owner: implementation -->
- [x] `openspec/programs/drenyra-dominion/sdds/sdd-000-dominion/README.md`: correct the reconciliation note — Gate 0 rows 3–4 satisfied 2026-08-15 (E-009..E-012); the SDD stays NOT complete because its content-contract phases remain (R3/R4). <!-- sdd-owner: implementation -->
- [x] Write `apply-progress.md` (this batch). <!-- sdd-owner: implementation -->

## Phase 2 — Verification

- [x] Suite stays 843/843; typecheck green; protected paths unchanged; 12-SDD invariant; changed-line budget OK. <!-- sdd-owner: implementation -->
- [x] No stale Gate 0 claims remain in the touched files (grep rows 3–4 / blocked). <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [x] Post-apply bounded review per native review contract (RDD-off precedent). <!-- sdd-owner: parent -->
- [x] Single-PR delivery + archive of the change. <!-- sdd-owner: parent -->
