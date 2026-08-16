# SDD-090 Verification Report — Refutation Dual-Review and Findings Resolution

> Change: `sdd-090-refutation` · Phase: verify · Strict TDD active (`bun run test`)
> Branch: `feat/sdd-090-refutation` · Commit under review: `899857c3bef8ee2f6fada34ae278908cf794f4ef`
> Parent (baseline): `bc8c662ff5fee698e9b5eebc455d60d37daa3005` · Verifier: sdd-verify executor (read-only; report only)

## Verdict

**PASS — implementation verified against spec REQ-GU-001..014 / SC-GU-001..032.**

All 14 requirements and all 32 scenarios map to concrete assertions or code paths that were
independently re-run green. Non-goals honored (exactly 6 files, zero changes outside them).
One process finding (task checkboxes left unchecked in `tasks.md` — parent-owned
reconciliation, see Task Checkbox State below) and one environmental finding (pre-existing
flaky SBOM timeout test) are documented; neither is an implementation defect.

---

## 1. Runtime gates (executed by verifier)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `bun run typecheck` (tsc --noEmit, authoritative) | ✅ PASS, 0 errors |
| Build | `bun run build` | ✅ PASS (dist/guardian/refutation.js/.d.ts, resolution.js/.d.ts emitted) |
| Full suite | `bun run test` (vitest run, 83 files) | ⚠️ 1210/1211 — see flake note |
| Guardian suite | `bunx vitest run guardian/__tests__` | ✅ 62/62 (4 files) |
| Lint (changed files) | `bunx biome check` on the 6 changed files | ✅ Clean |

### Flake note (pre-existing, NOT a regression)

- The single full-suite failure is `scripts/__tests__/release-integrity.test.ts > resolved SBOM
  fidelity > fails verification on every SBOM fidelity drift class` — vitest 5000ms timeout.
- `git diff bc8c662 899857c -- scripts/__tests__/release-integrity.test.ts` is **empty**: the
  test file is byte-identical to the baseline commit, so this change cannot have caused it.
- Isolated re-runs: first run failed under machine load (5868ms > 5000ms timeout); two
  subsequent clean isolated runs passed **13/13** each. Load-dependent flake, matching the
  apply-progress claim and the flake confirmed at baseline before this change.

---

## 2. Requirement coverage (REQ-GU-001..014 — 14/14 PASS)

| REQ | Requirement | Evidence (test file / code path) | Result |
|-----|-------------|-----------------------------------|--------|
| REQ-GU-001 | Finding binding (whole finding, same-array membership) | `refutation.test.ts` T-GU-001: same-review accept + foreign `unknown-finding`; `validateChallenge` uses `report.findings.includes(challenge.finding)` | PASS |
| REQ-GU-002 | Challenge coverage (every severity/category) | T-GU-002: 3 severities × 5 categories matrix (15 combos) all accepted; refute-every-severity | PASS |
| REQ-GU-003 | Closed verdict set + strictly-lower downgrade | T-GU-002: closed set const-object guard; invalid verdict → `invalid-verdict`; downgrade w/o target / equal / higher / info-never-lower → `downgrade-without-target`; `SEVERITY_RANK` single source of truth | PASS |
| REQ-GU-004 | Dual-review independence | T-GU-003: exactly-two guard (`isRecord`), distinct reviewerIds, reviewer≠challenger; 1/3-review and list-as-review → `invalid-independence` | PASS |
| REQ-GU-005 | Consistency = pure verdict equality | T-GU-004: uphold/uphold, refute/refute, downgrade/downgrade (with `loweredSeverity`) | PASS |
| REQ-GU-006 | Escalation (advisory, no verdict, no third reviewer) | T-GU-004: mixed pair → `{state:"inconsistent", escalation:"required"}`; `Object.keys` = exactly `["escalation","state"]`; no accept/reject/quorum/reviewer in JSON | PASS |
| REQ-GU-007 | Resolution lifecycle (one-way, no reopen/revocation) | `resolution.test.ts` T-GU-005: open→resolved/dismissed, double-transition → `already-resolved`/`already-dismissed` (incl. cross-disposition), terminal never produces a record | PASS |
| REQ-GU-008 | Advisory-only boundary | `exports.test.ts` T-GU-007: verdict stays `"none"`, candidate bytes unchanged; JSON scans for accept/reject/quorum/`CandidateReviewVerdict` in all outcomes | PASS |
| REQ-GU-009 | Fresh review (candidate-changed) | Refutation + resolution `candidate-changed` tests; library stateless → no carry-over structurally possible (SC-GU-024) | PASS |
| REQ-GU-010 | Immutable deterministic records | T-GU-007: frozen outcomes, source-finding mutation after record creation does not change record; deep-equal for identical inputs; determinism tests in both suites | PASS |
| REQ-GU-011 | Typed denials (never throws) | Refutation 6 codes + resolution 8-code table all asserted; explicit never-throws loop (13 invalid inputs) in resolution; refutation denial paths implicitly prove no-throw (any throw fails the test) | PASS |
| REQ-GU-012 | No clock | Static source scan for `Date.now`/`new Date` (test) + verifier grep: no `Date` usage; `referenceTime` caller-supplied, pure ISO-8601 regex (no `Date.parse`) | PASS |
| REQ-GU-013 | Barrel exports (ESM `.js`, no new subpath) | `guardian/index.ts` +2 lines (`export * from "./refutation.js"` / `"./resolution.js"`); all symbols resolve from `../index.js`; `package.json` untouched | PASS |
| REQ-GU-014 | Unit evidence + existing green | 53 new unit tests (31+15+7); guardian suite 62/62 incl. pre-existing `guardian.test.ts` (9, byte-identical to baseline); CLI tests green in full suite | PASS |

**Requirement coverage: 14/14 PASS (32/32 scenarios PASS)** — see scenario mapping below.

## 3. Scenario coverage (SC-GU-001..032)

All 32 scenarios PASS. Compact mapping:

- **SC-GU-001/002** (binding/unknown) → T-GU-001 accept + foreign-denial tests.
- **SC-GU-003/004** (all severities/categories) → 3×5 matrix + refute-every-severity.
- **SC-GU-005/006** (closed set) → consistent uphold/refute/downgrade accepted; out-of-set → `invalid-verdict`.
- **SC-GU-007/008/009/010** (independence) → distinct reviewers accepted; reviewer==challenger, duplicate, wrong count (missing slot and list-as-review) all `invalid-independence`.
- **SC-GU-011/012/013/014** (consistency) → uphold/uphold, refute/refute, downgrade with `loweredSeverity: "concern"`; no-target/equal/higher/info → `downgrade-without-target`.
- **SC-GU-015/016** (inconsistent advisory) → mixed pairs `inconsistent`; shape check proves no verdict/approval/third-reviewer.
- **SC-GU-017/018/019/020** (lifecycle) → open→resolved, open→dismissed, double-resolution denials, no reopen/revocation (no record on terminal).
- **SC-GU-021/022** (advisory-only) → verdict stays `"none"` + candidate bytes unchanged; no approval signal derivable from any outcome.
- **SC-GU-023/024** (fresh review) → `candidate-changed` in both modules; stateless library + membership/identity gates make carry-over impossible.
- **SC-GU-025/026** (frozen/deterministic) → source-mutation independence; deep-equal identical inputs.
- **SC-GU-027/028** (denials/no-throw) → every code asserted; explicit never-throws loop (13 inputs) + implicit no-throw across ~20 denial-path tests.
- **SC-GU-029/030** (no clock) → static scan clean; missing/malformed `referenceTime` → `missing-timestamp`.
- **SC-GU-031** (barrel smoke) → all symbols resolve from `guardian/index.ts` ESM `.js`, no subpath.
- **SC-GU-032** (unit evidence + existing green) → 62/62 guardian incl. unchanged legacy tests; full suite otherwise green.

---

## 4. Non-goal compliance

`git show --stat 899857c` = **exactly 6 files, 1676 insertions**:

```
guardian/__tests__/exports.test.ts    | 247  A
guardian/__tests__/refutation.test.ts | 527  A
guardian/__tests__/resolution.test.ts | 386  A
guardian/index.ts                     |   2  M
guardian/refutation.ts                | 284  A
guardian/resolution.ts                | 230  A
```

- `git diff bc8c662 899857c -- guardian/guardian.ts` → 0 lines (live review core untouched).
- `git diff bc8c662 899857c -- package.json` → 0 lines (no new subpath; `./guardian` export unchanged).
- `git diff bc8c662 899857c -- guardian/__tests__/guardian.test.ts` → 0 lines (existing tests unchanged).
- No changes anywhere under `cmd/`, `candidates/`, `review/`, `contracts/`, `flow/`, `gates/`.
- Untracked: only `openspec/changes/sdd-090-refutation/` (SDD artifacts — spec/tasks/this report), not implementation scope.

**Non-goal compliance: PASS — zero scope creep.**

## 5. Advisory-only spot-check (code review)

- **No clock:** verifier grep for `Date|clock|now()` over both modules finds comment mentions
  only; no `Date.now()`, `new Date()`, or `Date.parse`. `ISO_8601` is a pure regex.
- **No authority state:** both modules import from `./guardian.js` **type-only** (`import type`)
  — no runtime coupling to the live reviewer. Neither module assigns to `report.verdict`,
  `findings`, candidate, `CandidateReviewVerdict`, or any quorum/approval state; they only
  *read* `report.findings` and `report.candidateHash`. Outcomes are fresh frozen objects.
- **Immutability:** every outcome/denial `Object.freeze`d; `freezeRecord` deep-copies the
  finding, so post-creation source mutation cannot alter a record (proven by test).
- **Determinism:** pure functions; validation order fixed first-failure-wins; no ambient state.

**Advisory-only: PASS.**

## 6. Strict TDD compliance

TDD Cycle Evidence table found in apply-progress (7 rows, T-GU-001..007). Cross-referenced
against the codebase and re-executed by the verifier:

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | `TDD Cycle Evidence` table present in apply-progress |
| All tasks have tests | ✅ | 7/7 tasks → 3 test files exist (A in commit) |
| RED confirmed (test files exist) | ✅ | refutation.test.ts, resolution.test.ts, exports.test.ts all present |
| GREEN confirmed (tests pass now) | ✅ | Guardian 62/62; full suite 1210/1211 (only pre-existing flake) |
| Triangulation adequate | ✅ | Every unit has ≥2 boundary cases (severity matrix, 8-code table, 13-input no-throw loop, cross-disposition, empty/whitespace, wrong-count variants) |
| Safety net for modified files | ✅ | T-GU-001 net `guardian 9/9`; T-GU-005 `N/A (new)` — resolution.test.ts genuinely new (git A) |

**TDD Compliance: 6/6 checks passed.**

### Test layer distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 53 | 3 | vitest (bun) |
| Integration | 0 | 0 | n/a |
| E2E | 0 | 0 | n/a |

All 53 new tests are pure unit tests of isolated pure functions — appropriate for this slice.

### Assertion quality audit (mandatory 5f)

Scanned all 3 test files. No tautologies, no ghost loops (all loops iterate fixed
hard-coded non-empty arrays — 15-combo severity×category, 8-code table, 13 invalid inputs,
3 boundary pairs), no type-only-alone assertions (barrel `typeof` checks in exports.test.ts
are the spec-mandated SC-GU-031 smoke and are paired with behavioral assertions in the same
file), no smoke-only tests, no implementation-detail/CSS assertions, 0 mocks used.

**Assertion quality: ✅ All assertions verify real behavior — 0 CRITICAL, 0 WARNING.**

### Quality metrics

- **Linter (biome, 6 changed files):** ✅ No errors/warnings (pre-existing lint debt in
  `guardian/guardian.ts` + `guardian.test.ts` remains untouched per non-goals).
- **Type checker (tsc --noEmit):** ✅ 0 errors (authoritative; pi-lens LSP phantoms are the
  documented stale-cache repo defect and were ignored).
- **Coverage:** Coverage analysis skipped — no coverage tool invoked for this verification run
  (informational only, not a failure).

---

## 7. Review workload / PR boundary / size exception

- **Chained PRs:** forecast said `Chained PRs recommended: No` → single PR confirmed; only the
  assigned slice (the 6 files) was implemented; no adjacent work shipped.
- **Size exception:** actual **1676 changed lines** vs estimate **1060–1420** vs 400-line
  review unit. Explicitly recorded in three places: tasks.md (`Delivery strategy:
  exception-ok`, `Chain strategy: size-exception`, `Decision needed before apply: No`),
  apply-progress (blockers section: "no coverage dropped to trim"), and the commit message
  (6th in program, precedent 425/588/1043/1601/1773, user-approved continuation). Parent
  prompt confirms the user-approved continuation (6th occurrence). No coverage dropped to
  shrink the diff — verified against spec-mandated coverage. **Consistent with the forecast.**
- **Scope creep:** none — 6 files only, non-goal boundaries all proven untouched.

---

## 8. Task checkbox state

- Scan for `^\s*- \[ \]` (contract pattern): **0 matches** — tasks.md uses `+ [ ]` markers.
- The file still contains **31 unchecked `+ [ ]` markers** across Phase 0/1/2/3 (including
  parent-owned item 3.2). apply-progress documents an explicit parent instruction that
  `openspec/changes/*` was NOT to be modified by apply and that checkbox marking is
  parent/orchestrator-owned.
- Completion is independently proven (TDD table + 62/62 + gates above), so these are
  **stale checkboxes awaiting parent reconciliation**, not evidence of incomplete work.

**Implication:** verification of the implementation is PASS, but archive should not be marked
ready until the parent/orchestrator marks the 31 `+ [ ]` task lines in tasks.md
(stale-checkbox reconciliation, per the archive-exception rule). This is a process item, not
an implementation defect, and does not block the PR/commit path.

---

## 9. Structured status & actionContext findings

- **Status:** implementation complete and verified; `sdd/archive` may follow after parent
  checkbox reconciliation. No `blockedReasons`.
- **actionContext:** `mode: sdd-verify` (executor), read-only except this report.
  `allowedEditRoots`: repo root (report written under `openspec/changes/sdd-090-refutation/`).
  Artifact store: `engram` (apply-progress/verify-report via memory; spec/tasks also mirrored
  as flat files under `openspec/changes/sdd-090-refutation/`).
- **Delivery strategy:** exception-ok · **Chain strategy:** size-exception · **PR boundary:**
  single PR, assigned slice only.

---

## 10. Findings summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | INFO (env) | Pre-existing flaky SBOM timeout test (`release-integrity.test.ts`, 5s vitest timeout under load); byte-identical to baseline; passes 13/13 in clean isolation. Not a regression; re-run before release gates. |
| 2 | INFO (process) | 31 `+ [ ]` task markers remain unchecked in tasks.md — parent-owned reconciliation per explicit apply instruction; 0 `- [ ]` matches to the contract scan. Archive not ready until reconciled. |
| 3 | INFO | Size 1676 vs estimate 1060–1420 vs unit 400 — exception explicitly recorded in tasks.md, apply-progress, and commit message; user-approved (6th occurrence). |

**Blockers: none** for implementation verification. **Archive readiness:** deferred only on
the checkbox reconciliation in finding #2.

---

## 11. Validation commands (exact)

```bash
bun run typecheck                                   # tsc --noEmit — PASS (0 errors)
bun run build                                       # node scripts/build.mjs — PASS
bun run test                                        # vitest run — 1210/1211 (1 pre-existing flake)
bunx vitest run guardian/__tests__                  # 62/62 PASS
bunx vitest run scripts/__tests__/release-integrity.test.ts   # 13/13 PASS in clean isolation
bunx biome check guardian/refutation.ts guardian/resolution.ts guardian/index.ts \
  guardian/__tests__/refutation.test.ts guardian/__tests__/resolution.test.ts \
  guardian/__tests__/exports.test.ts                # clean
git show --stat 899857c                             # exactly 6 files, 1676 insertions
git diff bc8c662 899857c -- guardian/guardian.ts package.json guardian/__tests__/guardian.test.ts  # empty
```

**Final: PASS — 14/14 REQ, 32/32 SC, gates green, non-goals honored, strict TDD evidence
validated, assertion quality clean.**
