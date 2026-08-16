# Tasks — SDD-050 Reconciliation (Engine + Wiring Surface)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~80 (SDD-050 record + change record) |
| 400-line budget risk | Low |
| Chained PRs recommended | No (docs-only, single PR) |
| Delivery strategy | single-pr |
| Chain strategy | n/a |

```text
Decision needed before apply: No
Chained PRs recommended: No (docs-only)
Chain strategy: n/a
400-line budget risk: Low
```

**Notes:** docs-only reconciliation following the `vertical-closures` precedent.
NO code, NO contracts, NO lifecycle promotion. Suite must stay green (1362 +
pre-existing release-integrity flake which passes 13/13 isolated); protected
paths unchanged except the SDD-050 record itself.

---

## Phase 1 — SDD-050 record reconciliation

- [ ] `[W1]` Freeze inspected revision + baseline: `bun run test` (1362 green / 1 pre-existing flake), `bun run typecheck` EXIT 0, `bun run build` EXIT 0. Confirm protected paths: `contracts/**`, `openspec/changes/archive/**`, non-allowlisted program root docs. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Extend the SDD-050 implemented-surface mapping table (`openspec/programs/drenyra-dominion/sdds/sdd-050-monthly-close/README.md`) with three rows: bank-reconciliation engine (`bank-reconciliation/` + `pe.conciliacion-bancaria`), close-calculations engine (`close-calculations/` + 4 skills), and vertical wiring (`flow/close-wiring.ts` + `MonthlyCloseInput` optional engine inputs). Update the "Candidate generation through RDA v2" row to note engine-generated candidates. Evidence: suite 1363/1363 at PR #64 tip; test files cited per row. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Update the closure evidence revision in the SDD-050 lifecycle/evidence section: add the PR #64 tip revision + suite 1363/1363 as an additional `verified-revision-bound` re-confirmation; keep `lifecycle:complete` (core remains complete; this records additional implemented surface, not a new lifecycle claim). <!-- sdd-owner: implementation -->
- [ ] `[W1]` Confirm the gaps section stays accurate: connectors → SDD-110, professional UI → SDD-100, multi-operator → SDD-060 remain follow-up slices; add nothing that is not implemented. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Write `openspec/changes/sdd-050-reconciliation/apply-progress.md` (this batch). <!-- sdd-owner: implementation -->

## Phase 2 — Verification

- [ ] `[W1]` `bun run test` (green minus the known flake), `bun run typecheck` EXIT 0, `bun run build` EXIT 0; protected paths unchanged; no capability claimed beyond evidence; `lifecycle:complete` kept (not promoted). <!-- sdd-owner: implementation -->
- [ ] `[W1]` Write `openspec/changes/sdd-050-reconciliation/verify-report.md`. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [ ] Ship as a single docs-only commit within PR #64 (or its own commit on the feature branch); post-apply bounded review per native contract; validate + merge. <!-- sdd-owner: parent -->
