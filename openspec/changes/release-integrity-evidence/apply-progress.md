# Apply Progress — Release Integrity Evidence

> **Change:** `release-integrity-evidence` · **Phase:** apply · **Store:** OpenSpec
> **Scope:** deterministic, wired, verified release-integrity evidence. Independent of blocked `gentle-ai-quality-parity` Slice A; pre-existing WIP preserved untouched.

## Structured status consumed

- `schemaName: spec-driven`, `changeName: release-integrity-evidence`, `artifactStore: openspec` (authoritative native status; parent confirmed `applyState: ready`, allowed root = repo root).
- `actionContext`: `mode: repo-local`, `allowedEditRoots: [<repo root>]`, no warnings. Only the six design-allowlist implementation paths plus this change's OpenSpec phase artifacts (`tasks.md`, `apply-progress.md`) were touched.
- Review workload guard: `Decision needed before apply: No`, `Chained PRs recommended: No`, `400-line budget risk: Low` → no delivery decision required; single-PR slice, no chain.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| RED — focused tests + fixture helper | `scripts/__tests__/release-integrity.test.ts` | Integration (subprocess CLI) | N/A (new file) | ✅ 7 failed (7) | ✅ 7 passed (7) | ✅ 8 passed (8) | ✅ 8 passed (8) |
| GREEN — sbom.mjs determinism/root/fail-closed | same | Integration | N/A | ✅ | ✅ | ✅ | ✅ |
| GREEN — checksums.mjs root/symlink/self-exclusion | same | Integration | N/A | ✅ | ✅ | ✅ | ✅ |
| GREEN — verify-release-integrity.mjs (new) | same | Integration | N/A (new script) | ✅ | ✅ | ✅ | ✅ |
| GREEN — package.json wiring | same | Integration | N/A | ✅ | ✅ | ✅ | ✅ |
| GREEN — CI package-job step rename | same | Integration | N/A | ✅ | ✅ | ✅ | ✅ |
| TRIANGULATE — traversal + duplicate manifest entries | same | Integration | N/A | authored at TRIANGULATE | ✅ | ✅ 8/8 | ✅ |
| REFACTOR — none needed | same | Integration | N/A | — | — | — | ➖ justified below |

- **Safety Net**: full-suite baseline captured BEFORE any edit: `650 tests / 647 passed / 3 failed (cmd/__tests__/cli.test.ts)` across 52 files — matches the documented baseline; scripts had no pre-existing tests.
- **RED evidence** (before any production edit): `bun run test -- scripts/__tests__/release-integrity.test.ts` → `Test Files 1 failed (1) · Tests 7 failed (7)`. Failures proved the missing behavior: sbom writes nothing from a non-repo cwd (determinism/cwd RED), checksums emits a raw un-prefixed stack on missing `dist/` (fail-closed RED), `verify-release-integrity.mjs` does not exist (verification RED), current sbom accepts a `package.json` without `version` and exits 0 (shape-validation RED), regeneration self-includes `checksums.txt` (ordering RED).
- **GREEN evidence**: same focused command after minimal production edits → `Tests 7 passed (7)`.
- **TRIANGULATE evidence**: added the traversal (`../escape.js`) + duplicate-entry class to the test file; reran focused → `Tests 8 passed (8)`.
- **REFACTOR**: none needed — cross-script walk duplication is explicitly rejected by design decision #1 (no shared abstraction between executables); the test helper already centralizes `gen()`/`read()`/cleanup; local functions have no extractable duplication. Focused tests re-run after final edit: `Tests 8 passed (8)`.
- **Assertion quality**: every test exercises the real scripts via `spawnSync(process.execPath, ...)` from a distinct temp cwd; no tautologies, no empty-loop or type-only assertions. Fixture copies the three real scripts (verifier guarded by `existsSync` so the file works from RED through GREEN).
- **Total tests written**: 8 · **passing**: 8 · **layers**: Integration (subprocess), 8 · **approval tests**: none needed · **pure functions**: n/a (CLI scripts; fail-closed by design).

## Completed tasks (persisted checkbox updates)

All 13 implementation-owned checkboxes in `openspec/changes/release-integrity-evidence/tasks.md` were flipped `- [ ]` → `- [x]` immediately after completion (RED 1, GREEN 6, TRIANGULATE 1, REFACTOR 1, integration 2, final audits 2). Re-read after the flip: 0 implementation rows remain unchecked.

## Files changed (exact allowlist only)

| Path | Change | Adds+Dels |
| --- | --- | ---: |
| `scripts/sbom.mjs` | root from script location; shape validation (string name/version, object deps, string ranges); code-point sort; `metadata.timestamp` omitted; `sbom:` fail-closed try/catch; `join(root, "dist", "sbom.json")` | 27 |
| `scripts/checksums.mjs` | `lstatSync` walk rejecting symlinks/unsupported types; root from script location; relative-path normalization; self-exclusion of `checksums.txt`; `checksums:` fail-closed try/catch (incl. missing `dist/`) | 42 |
| `scripts/verify-release-integrity.mjs` (new) | SBOM CycloneDX 1.5 parse + component index (malformed/duplicate rejection) + declared-dependency coverage (`type: library`, exact declared range); checksum manifest record grammar/path/duplicate rejection; exact file-set comparison; SHA-256 re-hash; concise success line; `verify-release-integrity:` fail-closed | 73 |
| `scripts/__tests__/release-integrity.test.ts` (new) | fixture mini-repo helper + 8 subprocess tests (determinism, cwd independence, fail-closed, ordering/self-exclusion, valid verification, tampered/extra/absent files, malformed SBOM/omitted dep, traversal/duplicate entries) | 144 |
| `package.json` | `release:generate`, `verify:release-integrity` scripts; `verify:package` appends `&& bun run release:generate && bun run verify:release-integrity` after existing build/test/package-file checks | 4 |
| `.github/workflows/ci.yml` | existing `package` job step renamed to `Verify package and release-integrity evidence` (same `bun run verify:package` command); no new job/runner/step | 3 |

**Authored additions + deletions (implementation only): 293 ≤ 300 hard ceiling (7-line reserve).** No exception consumed. Generated `dist/**` artifacts and OpenSpec phase artifacts are excluded per design.

## Integration evidence (exact outputs)

- `node scripts/build.mjs` → build ok.
- `node scripts/verify-package-files.mjs` → `verify-package-files: OK (dist tree + packaged files complete)`.
- `bun run release:generate` (x2) → `sbom: 3 components -> dist/sbom.json` · `checksums: 425 files -> dist/checksums.txt`; `cmp` proves `sbom.json` and `checksums.txt` **byte-identical across runs**.
- `bun run verify:release-integrity` → `verify-release-integrity: checksums and SBOM verified` (exit 0).
- Generated evidence properties: `dist/checksums.txt` contains exactly one `sbom.json` entry (line format `<64hex>  sbom.json`), **no** `checksums.txt` self-entry; `dist/sbom.json` contains **no** `timestamp` field.
- `bun run verify:package` → stops at the test gate with the **unchanged 3 pre-existing baseline failures** in `cmd/__tests__/cli.test.ts` (`Tests 3 failed | 655 passed (658)`); the new stages (release:generate → verify:release-integrity) are proven independently above and sit after the existing gates, so a green baseline makes the full chain exit zero.
- `bun run typecheck` → exit 0.
- `bun run test` (full suite) → `Test Files 1 failed | 52 passed (53) · Tests 3 failed | 655 passed (658)`.

## Baseline differential (honest)

| Metric | Baseline (pre-apply) | Post-apply | Attribution |
| --- | --- | --- | --- |
| Total tests | 650 | 658 (+8) | +8 new release-integrity tests, all passing |
| Passing | 647 | 655 (+8) | same |
| Failing | 3 | 3 | **unchanged, pre-existing** in `cmd/__tests__/cli.test.ts` (mission lifecycle); not fixed, skipped, or hidden by this change |
| Test files | 52 | 53 (+1) | `scripts/__tests__/release-integrity.test.ts` |

The 3 failures are identical before and after (same assertions, same exit codes); they are unrelated to the release/package layer.

## Final audits

- **Line audit**: `git diff --numstat` on the four tracked allowlist files (ci 2+1, package.json 3+1, checksums 26+16, sbom 19+8 = 76) + `wc -l` on the two new files (73 + 144 = 217) → **293 total ≤ 300**.
- **Path audit** (`git status --porcelain`): changed paths are exactly `.github/workflows/ci.yml`, `package.json`, `scripts/sbom.mjs`, `scripts/checksums.mjs`, `scripts/verify-release-integrity.mjs`, `scripts/__tests__/release-integrity.test.ts`, and the change's own OpenSpec phase artifacts. No lockfile, no `scripts/verify-package-files.mjs`, no `cmd/__tests__/cli.test.ts`, no blocked Slice A path, no listed WIP path (`missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts`, `openspec/changes/fiscal-authority-kernel/apply-progress.md`, `openspec/programs/drenyra-dominion/capability-matrix.yaml`), and no other source/test/CI file was modified — all pre-existing WIP entries remain byte-for-byte untouched (verified against the pre-apply `git status` snapshot).
- **Ownership**: `dist/sbom.json` and `dist/checksums.txt` are gitignored and do not appear in `git status`; evidence ships via the existing `files: ["dist"]` package config and is never committed.

## Deviations from design

1. **Per-file caps** (design forecast vs actual, total still ≤ 300): `checksums.mjs` 38 → **42** (+4; the design's one-top-level-`try/catch` wrap reindents the whole generator flow), `verify-release-integrity.mjs` 72 → **73** (+1), test file 132 → **144** (+12; triangulation class included and helper readability). `sbom.mjs` 27 ≤ 28 ✓, `package.json` 4 ≤ 12 ✓, CI 3 ≤ 4 ✓. The hard 300 ceiling holds with a 7-line reserve; no exception consumed.
2. **TRIANGULATE shape**: the traversal+duplicate manifest-entry test was added as a second test-file edit after GREEN (as the task prescribes) rather than authored at RED; all other cases were authored at RED. Focused suite was green at every gate.
3. `verify:package` cannot exit zero end-to-end in this workspace because the documented 3 baseline `cli.test.ts` failures precede the new stages in the chain; the new stages were proven separately and the differential is recorded above (baseline failures unchanged).

## Remaining tasks

Exact unchecked line remaining in `tasks.md` (parent-owned, deferred to lifecycle):

```text
- [ ] After apply completes and the bounded review is engaged, perform the parent-scoped post-apply review and lifecycle gate on the implementation against spec and design. <!-- sdd-owner: parent -->
```

## Workload / PR boundary

- Estimated changed lines: 293 (hard ceiling 300, 7-line reserve). 400-line budget risk: Low. Chained PRs: No. Single-PR slice; no chain strategy needed (`pending` unused).
- Rollback: revert the two generator edits, delete the verifier + focused test, remove the two package scripts and the `verify:package` wiring, restore the CI step name; gitignored evidence needs no cleanup.

## Notes

- WIP and blocked `gentle-ai-quality-parity` Slice A were preserved untouched; this change shares only G4 root-cause evidence with that change and never touches its paths.
- No commit, push, review start, or native attempt settlement performed — parent owns those lifecycle steps.
