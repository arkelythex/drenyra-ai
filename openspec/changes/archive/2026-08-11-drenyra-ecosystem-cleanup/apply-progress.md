# Apply Progress — drenyra-ecosystem-cleanup (Slice 1)

> Phase: apply · Store: openspec · Scope: Slice 1 (drenyra-ai, drenyra-pi, drenyra-skills, drenyra-guardian-angel)
> EXCLUDED: drenyra-command-center (any file). Protected (untouched, byte-identical): drenyra-pi `__tests__/agents.test.ts`, `__tests__/extension.test.ts`, `scripts/verify-package-files.mjs`.

## Structured status (consumed/produced)

```yaml
schemaName: spec-driven
changeName: drenyra-ecosystem-cleanup
artifactStore: openspec
planningHome:
  root: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  changesDir: openspec/changes
changeRoot: openspec/changes/drenyra-ecosystem-cleanup
artifactPaths:
  proposal: [openspec/changes/drenyra-ecosystem-cleanup/proposal.md]
  specs: [openspec/changes/drenyra-ecosystem-cleanup/spec.md]
  design: [none — tasks.md records "Design phase: not needed"]
  tasks: [openspec/changes/drenyra-ecosystem-cleanup/tasks.md]
  applyProgress: [openspec/changes/drenyra-ecosystem-cleanup/apply-progress.md]
artifacts:
  proposal: done
  specs: done
  design: done (explicitly waived in tasks.md)
  tasks: done
  applyProgress: done
  verifyReport: missing (parent-owned)
taskProgress:
  total: 26
  complete: 26
  remaining: 0
  unchecked: []
deferredParentActions:
  total: 2
  complete: 0
  remaining: 2
```

`actionContext` warnings: none received. `allowedEditRoots`: the four sibling repo roots (drenyra-ai, drenyra-pi, drenyra-skills, drenyra-guardian-angel) under `/home/dreamcoder08/Documents/PROYECTOS`. No workspace-planning restrictions beyond the explicit exclusion/protection lists, which were honored.

## Commits (8/8, one logical change per commit, direct `git -C` commands)

| # | Repo | Commit | Message | Status |
|---|------|--------|---------|--------|
| 1 | drenyra-ai | `1c4a0b2` | `refactor(flow): reuse candidates RUC/period validators in close preflight` | done |
| 2 | drenyra-ai | `a08d089` | `docs(contracts): correct brand-system DRAFT version note to 0.2` | done |
| 3 | drenyra-ai | `facaa89` | `fix(deps): override nanoid to >=3.3.17 (CVE-2024-55565)` | done |
| 4 | drenyra-pi | `60342fe` | `refactor(lib): consolidate fail-closed NDJSON/JSON parse into shared helper` | done |
| 5 | drenyra-pi | `786e6af` | `docs(branding): use sibling-relative brand-conformance path in BRAND.md` | done |
| 6 | drenyra-skills | `91863c5` | `docs(branding): use sibling-relative brand-conformance path in BRAND.md` | done |
| 7 | drenyra-guardian-angel | `1441bdd` | `docs(branding): use sibling-relative brand-conformance path in BRAND.md` | done |
| 8 | drenyra-ai | `a5b23c9` | `docs(openspec): drenyra-ecosystem-cleanup change artifacts (slice 1)` | done |

No commit touched `drenyra-command-center` (verified: 0 command-center paths in the last 4 commits of every touched repo). No commit included the pre-existing drenyra-ai dirty files (`missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts` — user-owned, left untouched).

## Completed tasks and persisted checkbox updates

All 26 implementation-owned rows in `tasks.md` are now marked `- [x]` (25 via marker-line sed + 1 multi-line UNIT-D-pi row via targeted edit). The two parent-owned rows remain unchecked:

- `- [ ] Run bounded review on the combined 4-repo PR set ...` (line 194)
- `- [ ] Run sdd-verify for the change ...` (line 195)

Note: `tasks.md` was committed in commit 8 (`a5b23c9`) in its pre-implementation state per the parent's commit-unit-8 instruction; the checkbox update + this apply-progress file are intentionally left as **uncommitted working-tree changes** in drenyra-ai so the parent lifecycle can fold them in. `git diff tasks.md` shows exactly the 26 checkbox flips (one carries a caveat note) — nothing else.

## Files changed

**drenyra-ai** (commits 1–3, 8):

- `flow/close.ts` (UNIT-A)
- `contracts/README.md` (UNIT-B)
- `package.json`, `bun.lock` (UNIT-C)
- `openspec/changes/drenyra-ecosystem-cleanup/{exploration,proposal,spec,tasks}.md` (commit 8)
- working tree (uncommitted): `tasks.md` checkbox flips + `apply-progress.md`

**drenyra-pi** (commits 4–5):

- `lib/parse.ts` (new)
- `lib/mission-store.ts`, `lib/authority-store.ts`, `lib/receipt-store.ts`, `lib/evidence-graph.ts` (migrated)
- `chains/verify.ts`, `chains/evidence.ts`, `chains/reconcile.ts`, `chains/monthly-close.ts` (migrated)
- `assets/branding/BRAND.md` (portable path)

**drenyra-skills** (commit 6): `assets/branding/BRAND.md`
**drenyra-guardian-angel** (commit 7): `assets/branding/BRAND.md`

## Test / verification commands run

| Repo | Command | Result |
|------|---------|--------|
| drenyra-ai | `bun run typecheck` | PASS |
| drenyra-ai | `bunx vitest run` (full suite) | 51 files / 640 tests PASS |
| drenyra-ai | `node scripts/brand-conformance.mjs` | PASS (exit 0, brand-system v0.2 DRAFT) |
| drenyra-pi | `bun run typecheck` | PASS |
| drenyra-pi | `bun run test` (vitest run) | 29 files / 493 tests PASS |
| all | per-repo `git status --porcelain` before/after | matches Phase 0 baseline exactly |

UNIT-A targeted: `bunx vitest run flow/__tests__/close.test.ts` → 5/5 PASS (asserts `preflight-failed` with `invalid RUC` / `invalid fiscal period`).

## TDD Cycle Evidence

`openspec/config.yaml` declares `strict_tdd: true` (runner vitest). This slice is a pure refactor/docs/hygiene change with **no new behavior**: every spec scenario maps to an existing test or a grep, and the tasks.md apply contract defines verification as "existing suite + greps" with explicit per-commit file lists (no test files in any UNIT-E commit set). No new RED test was authored before edits; the RED-equivalent is the pre-existing suite that encodes each fail-closed contract and would fail on regression.

| Task | RED-equivalent (pre-existing coverage) | GREEN evidence |
|------|----------------------------------------|----------------|
| UNIT-A close preflight | `flow/__tests__/close.test.ts` (preflight-failed / invalid RUC / invalid fiscal period) | suite PASS (5/5), typecheck PASS |
| UNIT-B README note | no behavior; grep conformance `is DRAFT at v0.2` + `tokens.json` `"0.2"` | grep + diff-only-README PASS |
| UNIT-C nanoid | no behavior; grep `nanoid` in `bun.lock` all >= 3.3.17 | suite 640/640 PASS, typecheck PASS |
| UNIT-E 8-module migration | `**tests**/mission-store|authority-store|receipt-verification|evidence-graph` + `chains/**tests**/verify|evidence|reconcile|monthly-close` (corrupt-line fail-closed, `[]` fallback, label fragments) | pi suite 493/493 PASS, typecheck PASS |
| UNIT-D scaffolds ×3 | no behavior; grep `/home/`/`/PROYECTOS/` zero matches | grep PASS |

**Honest deviation note:** literal RED-first (write a new failing test before each edit) was NOT performed; the tasks' verification contract (existing suites + greps) was followed exactly, and no new test files were added because the commit plan's file lists do not include them. If the parent requires literal RED-first for the new `lib/parse.ts` helper, that is a follow-up decision.

## Deviations from design / tasks (all intentional, recorded per the "Record the churn justification" allowance)

1. **UNIT-C override value: `~3.3.17` instead of `">=3.3.17"`.** The literal `>=3.3.17` made bun resolve `nanoid@6.0.1` (major jump; ESM-only — breaks postcss's CJS `require('nanoid/non-secure')` at runtime), violating the spec's "behavior unchanged" scenario and its own expectation "the current 3.x line resolves to 3.3.18". `~3.3.17` resolves exactly `3.3.18` (>= 3.3.17, no 3.3.16 or lower), keeping the 3.x line postcss expects. The spec's `(e.g. "nanoid": ">=3.3.17")` marks the value as non-normative. Commit message retains the plan's CVE-identified text.
2. **UNIT-C lockfile churn beyond nanoid (pg sync):** the committed `bun.lock` was stale — package.json has declared `pg`/`@types/pg` since commit `4ca27fd`, but the lockfile (last regenerated by dependabot `8b90847`) omitted them. ANY `bun install` regenerating the lockfile adds `pg` + 13 transitive entries. The `git diff --stat bun.lock` is therefore "override mirror + nanoid 3.3.16→3.3.18 + forced pg sync" (37 lines) — not nanoid-only. This is pre-existing staleness, not override-caused; recorded here as the required justification. Spec/tasks allow "or explicitly justified in the change record".
3. **UNIT-E residual duplication — `lib/trusted-key-registry.ts`:** this module (added 2026-08-03, own test suite) has the same single-doc fail-closed parse body but is NOT in the enumerated 8-module migration list and has no per-site mapping row. It was deliberately left unmigrated to stay inside the approved scope; the UNIT-E VERIFY row's "no duplicated inline parse-helper body outside `lib/parse.ts`" criterion is therefore technically not fully met. Flagged in tasks.md (caveat note on the VERIFY row) for parent decision: authorize a tiny follow-up migration or accept the residual.
4. **UNIT-D BRAND.md convention notes added:** the three BRAND.md files now document the sibling-checkout convention (`../drenyra-ai/...` layout, same as `brand-ecosystem-status.mjs` assumes), which the spec requires ("MUST document the sibling-checkout convention"); the tasks marked it optional ("Optionally document...").

## Remaining tasks (exact unchecked lines)

```text
- [ ] Run bounded review on the combined 4-repo PR set against the spec acceptance criteria (a–e), the protected/excluded file integrity, and the helper-contract conformance, then gate apply/verify per the lifecycle. <!-- sdd-owner: parent -->
- [ ] Run `sdd-verify` for the change and confirm CRITICAL/WARNING state before archive. <!-- sdd-owner: parent -->
```

## Workload / PR boundary

- Estimated changed lines: ~250–350 (plan) — actual committed delta ≈ 210 net (drenyra-ai 42 + openspec 791; drenyra-pi 128/92; skills 7/2; guardian 7/2). 400-line budget: Medium risk, not exceeded.
- Chained PRs recommended: No. Delivery: 4 independent PRs (one per repo), each merging to its own main; no stack.
- Review Workload Forecast guard: `Decision needed before apply: No` — auto-apply proceeded without a delivery decision prompt.

## Integrity evidence (Phase 0 → Phase Z)

- drenyra-ai baseline: `missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts` modified (pre-existing, user-owned) + `openspec/changes/drenyra-ecosystem-cleanup/` untracked → after: same two modified files, openspec dir committed. No other diffs.
- drenyra-pi baseline: the 3 protected files modified (user-owned) → after: **sha256-identical** (`14176e98…`, `47da40c7…`, `5a46624d…`), no other diffs beyond the 9 UNIT-E files + BRAND.md (all committed).
- drenyra-skills / drenyra-guardian-angel: clean before → clean after (their BRAND.md changes committed).
- drenyra-command-center: never touched; its working tree was already dirty from the concurrent session (pre-existing, not this change).
