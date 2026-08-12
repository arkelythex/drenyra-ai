# Tasks — Release Integrity Evidence

> **Change:** `release-integrity-evidence` · **Phase:** tasks · **Scope:** this file is an OpenSpec phase artifact; it is not an implementation path. Apply may modify ONLY the six allowlist paths in the design. No source, test, CI, or package file changes occur during this phase.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~286 (hard ceiling 300, 14-line reserve) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | exception-ok (design ceiling is absolute; no exception consumed) |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

**Apply-stop guard (MANDATORY).** The design hard ceiling is **300 additions plus deletions, no exception**. The conservative forecast is **286** (14-line reserve). If, at any point in apply, the running authored `additions + deletions` count reaches or would exceed **300**, apply MUST stop for re-scoping before editing further. Do NOT consume an exception, do NOT relax the ceiling, and do NOT touch any non-allowlist path. Do NOT proceed to apply until this forecast is confirmed safe at <=300. It is safe today (286), so apply may proceed — but only with the per-file caps below preserved.

## Exact implementation allowlist (apply may modify ONLY these)

1. `scripts/sbom.mjs`
2. `scripts/checksums.mjs`
3. `scripts/verify-release-integrity.mjs` (new)
4. `scripts/__tests__/release-integrity.test.ts` (new)
5. `package.json`
6. `.github/workflows/ci.yml` (existing `package` job step only — rename the current `verify:package` step to `Verify package and release-integrity evidence`; no new workflow, runner, job, parallel branch, or duplicate verifier invocation)

**Forbidden:** `dist/**` (generated, gitignored, never committed), any lockfile, `scripts/verify-package-files.mjs`, blocked `gentle-ai-quality-parity` Slice A paths, `cmd/__tests__/cli.test.ts`, listed WIP paths (`missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts`, `openspec/changes/fiscal-authority-kernel/apply-progress.md`, `openspec/programs/drenyra-dominion/capability-matrix.yaml`), and any other source/test/CI file. If implementation needs another path, stop and re-scope before editing.

## Per-file authored-line caps (from design; preserve, do not exceed)

| File/area | Cap |
| --- | ---: |
| `scripts/sbom.mjs` | 28 |
| `scripts/checksums.mjs` | 38 |
| `scripts/verify-release-integrity.mjs` | 72 |
| `scripts/__tests__/release-integrity.test.ts` (+ fixture helper) | 132 |
| `package.json` | 12 |
| `.github/workflows/ci.yml` (package step) | 4 |
| **Ceiling** | **286** |

Additions and deletions both count; generated `dist/**` artifacts do not count and are never committed.

## Required evidence commands

- Focused: `bun run test -- scripts/__tests__/release-integrity.test.ts`
- Integration: `bun run verify:package`
- Types: `bun run typecheck`
- Full suite: `bun run test`
- Line audit: count authored `additions + deletions` via `git diff --stat` (or equivalent) and record the total.
- Untracked audit: `git status --porcelain` proves `dist/sbom.json` and `dist/checksums.txt` are not tracked/committed.

## Execution order and evidence requirements

### RED — author failing focused tests first (no production edits yet)

- [x] Create `scripts/__tests__/release-integrity.test.ts` with a fixture helper that: creates a temporary mini-repository, copies the three actual scripts (incl. the not-yet-existing `verify-release-integrity.mjs`) beneath its `scripts/`, writes a minimal `package.json` (with declared runtime dependencies) and a `dist/` tree, invokes each script from a *different* temporary cwd, and performs unconditional cleanup. Author RED tests that MUST fail on the current code: (a) two byte-identical generations of `sbom.json` (wall-clock timestamp currently breaks it); (b) generation from a non-repository cwd still reads/writes the repository `dist/` (cwd-relative resolution currently breaks it); (c) fail-closed on missing `dist/` and unreadable/malformed `package.json` (non-zero exit + clear prefixed message, no raw stack); (d) ordering/self-exclusion (checksums manifest includes `sbom.json`, excludes `checksums.txt`); (e) missing verifier makes `verify-release-integrity` tests fail. Run the focused command and record the failing output as RED evidence. <!-- sdd-owner: implementation -->

### GREEN — minimum production changes to make focused tests pass

- [x] Edit `scripts/sbom.mjs` (<=28 changed lines): resolve root as `dirname(dirname(fileURLToPath(import.meta.url)))`; read/validate `join(root, "package.json")` requiring string `name`/`version` and string-range `dependencies`; sort dependency names by code point (no locale sort); build CycloneDX 1.5 fields in fixed insertion order; **omit `metadata.timestamp`**; serialize `JSON.stringify(value, null, 2) + "\n"` to `join(root, "dist", "sbom.json")`; wrap in one top-level `try/catch` that prints a `sbom:`-prefixed error to stderr and exits non-zero. <!-- sdd-owner: implementation -->
- [x] Edit `scripts/checksums.mjs` (<=38 changed lines): resolve root as `dirname(dirname(fileURLToPath(import.meta.url)))` (no `process.cwd()`); recursively enumerate regular files under `join(root, "dist")`; reject unreadable entries, unsupported entry types, and symlinks (do not follow them outside `dist/`); normalize relative names to `/`, sort by code point, exclude exactly `checksums.txt`; include `sbom.json` and every other regular packaged file; emit lowercase `<64 hex><two spaces><relative path>\n` (one final LF) to `join(root, "dist", "checksums.txt")`; wrap in one top-level `try/catch` printing a `checksums:`-prefixed error and exiting non-zero on any failure (incl. missing `dist/`). <!-- sdd-owner: implementation -->
- [x] Add `scripts/verify-release-integrity.mjs` (new, <=72 changed lines): script-relative root; read/validate `package.json` (same minimal shape as SBOM); parse `dist/sbom.json` requiring `bomFormat: "CycloneDX"`, `specVersion: "1.5"`, `components` array; index components by name, reject malformed/duplicate names, and require a `type: "library"` component with the exact declared range as `version` for every declared runtime dependency (extra valid components tolerated; no lockfile read); parse `dist/checksums.txt` requiring non-empty LF records matching `^[0-9a-f]{64}  <path>$`, rejecting blank interior records, duplicates, absolute paths, backslashes, `.`/`..` traversal, and `checksums.txt` self-reference; enumerate the actual `dist/` regular-file set with the same traversal rules (exclude only `checksums.txt`) and compare sorted sets exactly; re-hash each entry and compare digests; print a concise success line only after all checks pass, otherwise exit non-zero at the first deterministic validation failure; one top-level `try/catch` with a `verify-release-integrity:`-prefixed error. This is consistency evidence, not authenticity evidence. <!-- sdd-owner: implementation -->
- [x] Edit `package.json` (<=12 changed lines): add `"release:generate": "node scripts/sbom.mjs && node scripts/checksums.mjs"` and `"verify:release-integrity": "node scripts/verify-release-integrity.mjs"`; append `release:generate` then `verify:release-integrity` to the end of the existing `verify:package` script (after build, test, and package-file checks). Generation runs only after build output exists; `prepack`/`prepublishOnly` inherit the gate through the existing `verify:package` dependency. <!-- sdd-owner: implementation -->
- [x] Edit `.github/workflows/ci.yml` (<=4 changed lines): in the existing `package` job only, rename the current `verify:package` step to `Verify package and release-integrity evidence`, keeping its exact `bun run verify:package` command. Add no new workflow, runner, job, parallel branch, or duplicate verifier invocation. <!-- sdd-owner: implementation -->
- [x] Run the focused command and record GREEN evidence: all focused tests pass after these minimum changes. <!-- sdd-owner: implementation -->

### TRIANGULATE — add a second partial-data class to prevent fixture-specific implementation

- [x] Extend `scripts/__tests__/release-integrity.test.ts` with at least one additional malformed/partial-data case beyond the initial mismatch (design suggests a duplicate or path-traversal manifest entry, or a malformed/duplicate component name). Rerun the focused command and record that the triangulated cases pass. <!-- sdd-owner: implementation -->

### REFACTOR — remove duplication without broadening scope

- [x] Remove duplication ONLY within the test fixture helper or local script functions (no new shared framework, no broadened paths, no new public API). Rerun the focused command and confirm all focused tests still pass. <!-- sdd-owner: implementation -->

### Integration evidence — prove the full path with exact outputs

- [x] Run `bun run verify:package` and record exact output: it must deterministically generate `dist/sbom.json` and `dist/checksums.txt`, verify both, and exit zero. Confirm `dist/checksums.txt` contains an entry for `sbom.json` and no self-entry. <!-- sdd-owner: implementation -->
- [x] Run `bun run typecheck` and the full `bun run test` suite; record exact outputs. If the three pre-existing baseline failures in `cmd/__tests__/cli.test.ts` are still present, record them as **unchanged, pre-existing, and unrelated** — do NOT fix, skip, hide, or present them as release-integrity success. <!-- sdd-owner: implementation -->

### Final audits — hard budget and allowlist enforcement

- [x] Count authored `additions + deletions`; require **<=300** (target ~286). If the count reaches or would exceed 300, stop and re-scope — do not proceed. <!-- sdd-owner: implementation -->
- [x] Run `git status --porcelain` and audit every changed path against the exact six-path allowlist. Confirm `dist/sbom.json` and `dist/checksums.txt` are untracked/generated and never committed. Confirm no blocked Slice A, WIP, lockfile, `verify-package-files.mjs`, `cmd/__tests__/cli.test.ts`, or `dist/**` path changed. If any out-of-scope path is touched, stop and re-scope before continuing. <!-- sdd-owner: implementation -->

## Post-apply lifecycle gate (parent-owned, grouped separately)

- [ ] After apply completes and the bounded review is engaged, perform the parent-scoped post-apply review and lifecycle gate on the implementation against spec and design. <!-- sdd-owner: parent -->

## Rollback

Revert the two generator script edits; delete `scripts/verify-release-integrity.mjs` and `scripts/__tests__/release-integrity.test.ts`; remove the two `package.json` scripts and the `verify:package` wiring; restore the CI `package` job step name. Gitignored evidence under `dist/` needs no migration or cleanup. This is independent of all other active changes.
