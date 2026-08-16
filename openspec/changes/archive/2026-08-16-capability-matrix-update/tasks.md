# Tasks — Capability Matrix Update (PR #64 Surface)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~25 (capability-matrix.yaml + change record) |
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

**Notes:** docs-only program reconciliation following the `sdd-050-reconciliation`
precedent. NO code, NO lifecycle promotion, NO sibling-repo row changes (R13 —
awaiting evidence). YAML must parse; evidence revision-bound per R6/R13.

---

## Phase 1 — Capability matrix update

- [ ] `[W1]` Confirm start state: drenyra-ai capabilities block in
  `openspec/programs/drenyra-dominion/capability-matrix.yaml` ends at the SDD-010
  checkpoint (`d440203`, `tests.current: 915`); no bank-reconciliation /
  close-calculations / close-vertical-wiring / authorization-enforcement rows. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Add the five capability rows to the drenyra-ai block: `bank-reconciliation:
  implemented` (65 tests), `close-calculations: implemented` (63 tests),
  `close-vertical-wiring: implemented` (30 tests), `authorization-enforcement:
  implemented` (27 gate tests + 60 authorization engine tests),
  `pe-skills-registry: implemented` (11 BASE_PE_SKILLS, conformance PASS). <!-- sdd-owner: implementation -->
- [ ] `[W1]` Update `tests.current` to `1390` with revision-bound evidence:
  fresh run at PR #64 tip, 99 files, exit 0 (1 pre-existing release-integrity
  flake passes 13/13 isolated — note it). Update the block's evidence metadata to
  cite the PR #64 tip revision. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Confirm sibling-repo rows untouched (command-center/pi/engram remain
  historical-snapshot/awaiting-evidence per R13); YAML parses
  (`python3 -c "import yaml"` or the repo's YAML check). <!-- sdd-owner: implementation -->
- [ ] `[W1]` Write `openspec/changes/capability-matrix-update/apply-progress.md`. <!-- sdd-owner: implementation -->

## Phase 2 — Verification

- [ ] `[W1]` Read back the edited block: every new row maps to a real exported
  symbol/test file at the PR #64 tip; `tests.current` matches the fresh run;
  temporal class stated per R6/R13; no capability claimed beyond evidence. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Write `openspec/changes/capability-matrix-update/verify-report.md`. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [ ] Ship as a single docs-only commit within PR #64; post-apply bounded review per native contract; validate + merge. <!-- sdd-owner: parent -->
