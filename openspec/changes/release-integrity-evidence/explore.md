# Exploration — release-integrity-evidence

> **Change:** `release-integrity-evidence` · **Phase:** explore · **Scope:** read-only investigation. No source, test, CI, artifact, or WIP file was modified.
>
> **Store:** OpenSpec. **Goal:** close the G4 release-integrity gap — the existing checksum and SBOM scripts exist but are not wired into package/release evidence or CI. This is an **independent** change; it does not touch or reinterpret the blocked `gentle-ai-quality-parity` Slice A (declared-surface integrity). It reuses that change's evidence (G4) as the shared root-cause, then proposes a *separate*, bounded first slice here.

## Lead

`scripts/checksums.mjs` (SHA-256 manifest) and `scripts/sbom.mjs` (CycloneDX 1.5) are written and documented by [Design 05](docs/design/design-05-testing-releases-v1.md) as release-pipeline items, but **neither is invoked by `package.json`, `prepack`/`prepublishOnly`, or CI**. The gap-analysis row marks the capability done with the remaining dependency "**Signing wired into the release pipeline**". So the checksum/SBOM claim is aspirational today — nothing generates or verifies release integrity evidence automatically. This is an attributable, release-gate completeness gap, and the fix is **plumbing + verification + a small determinism correction**, not new machinery.

## Evidence (root cause — G4)

| Evidence | File |
| --- | --- |
| SHA-256 manifest writer walks `dist/` and writes `dist/checksums.txt`. | `scripts/checksums.mjs` |
| CycloneDX SBOM writer derives name/version + declared runtime deps, writes `dist/sbom.json`. | `scripts/sbom.mjs` |
| Design 05 release pipeline mandates "SBOM generation" and "Artifact signing and checksums". | `docs/design/design-05-testing-releases-v1.md` |
| `package.json` has no `checksums`/`sbom` npm script and they are not in `verify:package`/`prepack`/`prepublishOnly`. | `package.json` (`scripts`) |
| CI package job runs `verify:package` + `verify-packed-install` — **no checksums/SBOM step**. | `.github/workflows/ci.yml` (`package` job) |
| Gap analysis: Release integrity marked done, completion criterion "Signing wired into the release pipeline". | `docs/roadmaps/2026-08-10-v1-gap-analysis.md` |

## Concrete findings that shape the smallest slice

### Ownership of generated artifacts

- `dist/` is gitignored; `package.json` `files` includes `"dist"`. So `dist/checksums.txt` and `dist/sbom.json` are **generated at build, never committed, but shipped inside the published artifact** automatically. This is the intended ownership model — the slice must run the generators *after* `build` so the artifact carries them, and must not require committing them.

### Reproducibility (defect in the current scripts)

- `sbom.mjs` writes `metadata.timestamp: new Date().toISOString()` — **non-deterministic**. Two builds of the same source produce different `sbom.json`. For a "deterministic build" claim (the CHANGELOG already touts `dist/cmd/cli.js` checksum unchanged across builds), this must become deterministic or be dropped from the evidence hash.
- `checksums.mjs` computes the root as `join(process.cwd(), "dist")` — **cwd-dependent** (other scripts correctly use `dirname(fileURLToPath(import.meta.url))`). Running from a subdirectory breaks it silently.

### Verification (missing today)

- There is a generator but **no verifier**: nothing asserts `dist/checksums.txt` self-consistency (each listed file re-hashes to the recorded digest) and nothing asserts `sbom.json` is well-formed and covers the declared runtime dependencies. Design 05's "artifact signing and checksums" implies verification, not just generation.

### CI applicability

- The existing `package` job already builds `dist` and runs `verify:package`. The smallest integration is to (a) run `checksums` + `sbom` in the build/verify path so the artifact carries them, and (b) add a check step (or extend `verify:package`) that verifies the generated evidence — with **no new runner, no new workflow**, reusing the existing `package` job.

### Failure behavior

- `sbom.mjs` already exits 1 on an unreadable `package.json` (good, fail-closed). `checksums.mjs` would crash with an opaque Node stack on a missing `dist/` (uncaught `ENOENT`). The slice should make both fail **closed with a clear message** (exit 1) on missing/unreadable inputs, consistent with the repo's fail-closed convention.

### Test strategy (strict TDD)

- Repo uses Vitest (`bun run test`), `strict_tdd: true`. The slice must author RED tests first that pin: determinism of `sbom.json` (same inputs → identical output, or timestamp handled), self-consistency of `checksums.txt`, SBOM coverage of declared runtime deps, and fail-closed behavior on missing `dist`/unreadable manifest. Since scripts are `.mjs` outside the vitest source tree, the tests should either import the script's pure logic (if it is refactored to export a function) or execute it against a fixture `dist` tree and assert on output. Keep the script output logic testable without spawning the CLI where practical.

### Security / supply-chain implications

- The SBOM currently uses **declared dependency ranges** from `package.json` (e.g. `"ajv": "^8.17.1"`), not the **resolved** versions in the lockfile. A supply-chain-accurate SBOM should reflect what actually ships. This is a fidelity gap, but **re-resolving lockfile versions is heavier and is a non-goal for the first slice** (stays within 300 lines); the first slice wires generation+verification of the declared-deps SBOM and records lockfile-resolution as a follow-up.

### Line budget & non-goals

- Est. first slice ~150–220 changed lines (script edits for determinism/root/fail-closed, a small verify script, two `package.json` script entries + wiring into `verify:package`, one CI step or extend `verify:package`, focused RED→GREEN→TRIANGULATE tests). Comfortably under 300. No new runner, no new workflow job, no lint/format gate (G5), no G6 sibling-repo rework.

## First slice recommendation (bounded, ≤300 changed lines)

**Slice — "Wire release-integrity evidence into package + CI, deterministic and verified."**

Generate `dist/checksums.txt` and `dist/sbom.json` as part of the package build path, make both deterministic and root-independent, add a verify step that asserts manifest self-consistency + SBOM coverage, and wire a CI check into the existing `package` job — all behind strict TDD.

### Work units (proposed shape for the tasks phase)

| Unit | Change | Est. lines | Test evidence |
| --- | --- | --- | --- |
| **R1 — determinism + root fix** | `sbom.mjs`: drop/parameterize `new Date().toISOString()` (deterministic timestamp or omit from hashed output); `checksums.mjs`: resolve `dist` root via `dirname(fileURLToPath(import.meta.url))`, fail closed (exit 1) on missing `dist`. | ~30 | RED tests: build twice → identical `sbom.json`/`checksums.txt`; run from non-root cwd still works; missing `dist` → exit 1 with clear message. |
| **R2 — wiring into package path** | Add `"checksums"` and `"sbom"` npm scripts; invoke after `build` inside `verify:package` so `dist/` carries both before the artifact ships. | ~12 | `bun run verify:package` emits `dist/checksums.txt` + `dist/sbom.json`; both present in `dist`. |
| **R3 — verifier** | Add a small `scripts/verify-release-integrity.mjs` (or extend `verify-package-files.mjs`) that (a) re-hashes each `checksums.txt` entry against `dist/` and (b) validates `sbom.json` is parseable and covers every declared runtime dependency; exit 1 on any mismatch. | ~60 | RED: corrupt/omit an entry → verify fails; remove a declared dep from SBOM → verify fails. |
| **R4 — CI check** | Extend the existing `package` job (single added `- run` after `verify:package`) to run the integrity verifier. No new job/runner. | ~8 | CI `package` job green; verifier runs in CI. |
| **R5 — TRIANGULATE + evidence** | Run `bun run test` (focused + full), `bun run typecheck`, `bun run verify:package`; record exact results; confirm authored diff <300 lines and no WIP/non-goal path touched. | ~20 | All green (or the three documented baseline CLI failures unchanged and none attributable to this slice). |

**Est. authored changed lines: ~150–220** (well under 300).

### Why this slice first

- Closes the attributable G4 gate-completeness gap with **plumbing + a determinism correction + verification**, not new machinery — matching the "shrink, don't grow" triage rule (the only new file is a small verifier).
- Has **no external/sibling-repo dependency** (unlike G6), no high-churn lint gate (G5).
- Is **deterministically testable** and stays in the package/CI layer; no domain logic, no frozen contracts, no WIP paths.

## Non-goals (explicit for this change / first slice)

- **No `gentle-ai-quality-parity` Slice A work** (declared-surface, MCP/CLI version, cwd-independent `doctor`). This change is independent; it does not unblock, rewrite, or reinterpret the blocked review. It shares only G4's root-cause evidence.
- **No lockfile-resolved SBOM** (resolved versions vs declared ranges). Fidelity follow-up.
- **No artifact signing / cryptographic signatures** (only checksums + SBOM). Signing remains a later slice per the gap-analysis criterion.
- **No lint/format gate (G5), no sibling-repo rework (G6).**
- **No changes to pre-existing WIP paths** (`missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts`, `openspec/changes/fiscal-authority-kernel/apply-progress.md`, `openspec/programs/drenyra-dominion/capability-matrix.yaml`).
- **No fixing the 3 pre-existing baseline failures** in `cmd/__tests__/cli.test.ts`; they stay out of this change's acceptance evidence.
- **No new runner, no new workflow job, no frozen-contract or domain-logic change.**

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Making `sbom.json` deterministic could diverge from a future CycloneDX requirement for a timestamp | Low | Parameterize via env with a stable default, or omit from hashed output and record timestamp only in an unhashed field; keep SBOM parseable. |
| Verify step adds a few CI seconds / tightens `verify:package` | Low | Runs only in the existing `package` job; failure is fail-closed and fast. |
| `checksums.txt` includes `sbom.json` and vice-versa ordering | Low | Generate SBOM before checksums, or exclude each other's self-entry; make order explicit in the script and pin by test. |
| Scope creep into lockfile resolution or signing | Medium | Explicit non-goals above; tasks slice keeps the boundary to generation + wiring + verification. |

## Rollback strategy

Fully reversible: revert the two script edits, delete the small verifier, remove the two `package.json` script entries and the wiring inside `verify:package`, and drop the single CI `- run` step. `dist/` is gitignored so no committed artifact is affected; the change is independent of any other active change.

## Next recommended phase

`proposal` → `spec` → `design` → `tasks` for **this first slice** (deterministic, wired, verified release-integrity evidence), keeping lockfile-resolution and signing as explicit later slices. Do **not** route this into `gentle-ai-quality-parity` — that change remains blocked; this is an independent change.
