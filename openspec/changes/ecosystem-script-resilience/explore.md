# Exploration — ecosystem-script-resilience

> **Change:** `ecosystem-script-resilience` · **Phase:** explore · **Scope:** read-only investigation; no implementation, config, CI, package files, generated artifacts, active change paths, or WIP were modified.
>
> **Goal:** improve the developer experience and reliability of the two scripts that depend on sibling repositories (`brand-ecosystem-status`, `skills-conformance`) **without** weakening their integrity checks or hiding missing dependencies. Identify precise failure modes, ownership/configuration options, CI/local differences, safe diagnostic behavior, tests, migration, non-goals, and a first slice under 300 authored changed lines.
>
> **Store:** OpenSpec. This change is the next independent quality-program slice after the published `reproducible-lint-gate` (G5). It deliberately shares no delivery/review work with, and changes none of, the previously completed slices (`reproducible-lint-gate`, or the blocked/separate `gentle-ai-quality-parity` Slice A and `release-integrity-evidence`).

## Lead

**The decisive fact: both sibling-dependent scripts already exit non-zero on a missing dependency, so the integrity gate is not broken — but their diagnostics actively mislead the developer about *why*.** The `brand-ecosystem-status` script reports a missing sibling repo as `MISSING / "no banner asset yet"` (a content lie) when the real cause is that the repo directory does not exist at `../<name>`. The `skills-conformance` script names the missing manifest path but gives no runnable continuation (no "clone it or pass --manifest" guidance), and its brittle default path is the **only** path a local run ever exercises — CI always overrides it. The fix is therefore a **message/diagnostic** fix, not new machinery: distinguish *repo absent* from *banner/asset absent*, honor a configurable sibling root, and print a runnable continuation — while keeping exit 1 on any missing/fail. This matches the systemic-triage rule "distinguish 'the provider lacks this fact' from 'lacks it AT THIS LINE'."

Everything below is mapped to file evidence. Baseline and pre-existing state are distinguished from attributable gaps.

## Baseline and pre-existing state (distinguished — NOT attributable gaps)

| Item | Evidence | Disposition |
| --- | --- | --- |
| Strict type/lint gates already ship | `tsc` strict flags + `biome lint` (pinned `@biomejs/biome 2.3.15`) wired in CI `typecheck` and `lint` jobs (published `reproducible-lint-gate` slice). | **Existing strength, untouched.** This change adds no lint/format work. |
| `brand:ecosystem` and `skills:conformance` are runnable npm scripts | `package.json` `scripts.brand:ecosystem = "node scripts/brand-ecosystem-status.mjs"`; `scripts.skills:conformance = "bun run scripts/skills-conformance.mjs"`. | **Baseline surface.** The npm script entry points stay stable. |
| `skills-conformance` already supports a `--manifest <path>` override | `scripts/skills-conformance.mjs:31-35` (`--manifest` flag) and CI passes it. | **Existing escape hatch** for the manifest; the sibling *root* is still hardcoded. |
| Sibling-checkout layout is a documented convention, not a runtime import | `contracts/brand-system.md` freeze gate `bun run brand:ecosystem`; archived `drenyra-ecosystem-cleanup` noted `../<repo>` as the assumed layout. | **Existing convention.** We keep the layout but make it configurable and its diagnostics truthful. |
| `skills-conformance` `bun run skills:conformance -- --json` machine output exists | `scripts/skills-conformance.mjs:37,81-89`. | **Baseline.** JSON contract stays stable; we only enrich the missing-path branch. |
| No CI job runs `brand:ecosystem` | `.github/workflows/ci.yml` jobs: `typecheck`, `lint`, `test`, `brand-conformance`, `skills-conformance`, `package`. No `brand-ecosystem` job. | **Baseline gap.** Locally the freeze gate needs 5 siblings; CI cannot run it today. |
| No env-var or `--root` override in any script | Repo-wide grep for `process.env` / `--root` in `scripts/*.mjs` returns none. | **Baseline.** No sibling-root configurability today. |
| No tests cover these `.mjs` scripts | `vitest.config.ts` `include: ["**/__tests__/**/*.test.ts"]`; no `scripts/**/__tests__` and no `.mjs` tests exist. | **Baseline gap.** The missing-dependency diagnostic path is untested. |
| Pre-existing WIP / blocked changes | `fiscal-authority-kernel`, `bounded-agent-roles`, `gentle-ai-quality-parity` (blocked Slice A), `release-integrity-evidence`, `missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts`. | **Out of scope.** This change touches only `scripts/` and its tests; none of these paths are modified. |

## Current-state gap — attributable evidence

### G6 (from the `gentle-ai-quality-parity` audit): sibling-dependent scripts fail locally with misleading diagnostics

| Evidence | File |
| --- | --- |
| `brand-ecosystem-status` `statusFor(repo)` calls `existsSync(join(repo.dir, repo.banner))`; when `repo.dir` itself does not exist (sibling not cloned), it falls through to `existsSync(join(repo.dir,"assets","branding"))` → false → returns `{ state: "MISSING", detail: "no banner asset yet" }`. The real cause (missing repo at `../<name>`) is hidden behind a content message. | `scripts/brand-ecosystem-status.mjs:88-106` |
| `brand-ecosystem-status` reads 5 sibling dirs hardcoded via `join(ROOT, "..", "<repo>")`; there is no `--root`/env override, so a partial or relocated checkout cannot run it. | `scripts/brand-ecosystem-status.mjs:26-61` |
| `skills-conformance` reads `join(ROOT,"..","drenyra-skills","skills","registry.json")` by default; on `ENOENT` it prints `skills-conformance: cannot read <path>: ...` and `process.exit(1)` — it names the path but gives **no runnable continuation** (no clone command, no `--manifest` hint). | `scripts/skills-conformance.mjs:55-61, 27-29` |
| CI **never** exercises the default sibling path for `skills-conformance` — it checks out `arkelythex/drenyra-skills` into the workspace and passes `--manifest drenyra-skills/skills/registry.json`, so the brittle default path is a *local-only* failure that CI cannot catch. | `.github/workflows/ci.yml` `skills-conformance` job |
| `brand-ecosystem-status` has no CI job at all; the freeze gate (the exact command `contracts/brand-system.md` designates) only runs locally and requires all 5 siblings. | `.github/workflows/ci.yml`; `contracts/brand-system.md` |
| Neither script's missing-dependency branch is covered by any test. | `vitest.config.ts`; repo-wide grep |

**Why it matters (Gentle AI standard):** both scripts are legitimate cross-repo integrity gates and both already fail closed (exit 1) on a missing dependency — that part is correct and must not be weakened. The defect is that the *diagnostic* is wrong: `brand-ecosystem-status` tells the developer their banner is missing when it is actually the sibling repo that is absent, and `skills-conformance` stops at a bare `cannot read` with no exit path. A developer hitting either today must reverse-engineer the sibling layout themselves. The fix is a **message fix plus one small configurability knob** — exactly the class systemic-triage says to solve by *naming the runnable continuation*, not by building machinery.

## Ownership / configuration options (with tradeoffs)

| Option | Churn | Effect on integrity | Fit |
| --- | --- | --- | --- |
| **A. Configurable sibling root + truthful diagnostics.** Add a sibling-root resolution honoring env `DRENYRA_ECOSYSTEM_ROOT` and a `--root <dir>` flag (defaulting to `..`), and split the `brand-ecosystem-status` MISSING state into `SIBLING_MISSING` (repo.dir absent) vs `MISSING` (banner absent); print a runnable continuation (clone command / `--manifest` hint) in the `skills-conformance` missing branch. Exit 1 stays on any missing/fail. | Small (~80–120 lines across both scripts + tests) | **Unchanged.** Missing/fail still exit non-zero; a missing sibling is still a failure, just reported truthfully. | **Best fit** for "improve reliability + DX without weakening checks." |
| B. Only fix the error *message* text (no `--root`/env knob). | Minimal (~20 lines) | Unchanged | Weaker than A — does not fix the hardcoded-root limitation or the missing-sibling lie in `brand-ecosystem-status`'s logic, only its wording. |
| C. Add a CI `brand-ecosystem` job that checks out all 5 siblings and runs the gate. | Larger (new CI job + checkout matrix + 5 sibling refs) | Unchanged | **Valuable but a separate, later slice.** It does not fix the local DX at all, and CI checkout of 5 external repos is a wider review surface that exceeds the first-slice budget. |
| D. Refactor both scripts into a shared sibling-resolution library module. | Medium (~60 lines + tests) | Unchanged | Could be folded into A if DRY wins, but two independent scripts that differ (node vs bun shebang, one spawns a checker, one imports a TS module) argue for **two small self-contained edits** rather than a shared module in the first slice. |

**Selection: Option A, as two self-contained edits** (one per script) — a shared `siblingRoot()` convention (env override, then `--root`, then `..`) and truthful, continuation-bearing diagnostics, with a small test proving the missing-sibling branch is reported distinctly and still exits 1. No shared library module, no CI job, no integrity weakening.

## Precise failure modes (root-cause table)

| # | Script | Failure mode | Real cause | Current behavior (misleading) | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | `brand-ecosystem-status` | Sibling repo not cloned at `../<name>` | Missing repo directory | Reports `MISSING "no banner asset yet"` (content lie) | Report `SIBLING_MISSING` naming the expected path + a runnable clone/`--root` continuation |
| 2 | `brand-ecosystem-status` | Sibling root not `..` (monorepo/relocated checkout) | Hardcoded root | Cannot run / fails on every repo | Honor `DRENYRA_ECOSYSTEM_ROOT` and `--root` |
| 3 | `skills-conformance` | `drenyra-skills` sibling not cloned | Missing manifest | `cannot read <path>` with no continuation | Keep the failure, add a runnable continuation (clone + `--manifest`) and honor the same `--root`/env knob |
| 4 | `skills-conformance` | CI never tests the default sibling path | CI always overrides `--manifest` | Default path is local-only and untested | Add a test that exercises the default-missing branch; keep CI override working |

## Safe diagnostic behavior (principle)

- **Never hide a missing dependency behind a content message.** `SIBLING_MISSING` must be distinct from banner/asset `MISSING`.
- **Keep exit 1 on any missing/fail.** The integrity check is *stronger*, not weaker — a missing sibling is still a failed gate; the developer just now gets the correct reason.
- **Every refusal names a runnable continuation.** The printed message must include the exact expected path and a working command (e.g. the clone command for that sibling, or `--manifest <path>`), verified runnable in the test.
- **JSON stays stable and gains the distinct state.** `brand-ecosystem-status --json` gains `state: "SIBLING_MISSING"`; `skills-conformance --json` keeps `pass:false` and adds a `hint` field in the missing branch.
- **Configurability is a knob, not a state/verb/gate/flag rabbit hole.** One env var + one `--root` flag per script, defaulting to current behavior. This is the single "flag" systemic-triage permits because it relaxes a hardcoded assumption rather than adding a new gate.

## CI/local differences

| Script | CI | Local | Gap |
| --- | --- | --- | --- |
| `skills-conformance` | Checks out `arkelythex/drenyra-skills` into workspace; passes `--manifest drenyra-skills/skills/registry.json` | Default `../drenyra-skills/skills/registry.json`; fails with bare `cannot read` if sibling absent | CI never exercises the default path; the brittle path is local-only |
| `brand-ecosystem-status` | **No job** | Needs 5 siblings at `../`; misreports absent repos as "no banner asset yet" | Freeze gate runs only locally, with a lying diagnostic |

The first slice improves both local paths truthfully and adds tests; **adding a `brand-ecosystem` CI job is explicitly deferred** (Option C, non-goal for the first slice).

## First slice recommendation (bounded, < 300 authored changed lines)

**Slice A — Truthful sibling diagnostics + configurable sibling root.**

### Work units

| Unit | Change | Approx. lines | Test/validation evidence |
| --- | --- | --- | --- |
| **A1 — shared sibling-root resolution** | Add to each script a `resolveSiblingRoot()` honoring `process.env.DRENYRA_ECOSYSTEM_ROOT`, then `--root <dir>`, then default `..`; use it in place of the hardcoded `join(ROOT,"..",…)` in `brand-ecosystem-status` and in `skills-conformance`'s default manifest path. | ~15 per script | A test invoking each script with `--root` pointing at a fixture dir resolves that root; default behavior unchanged when no knob given. |
| **A2 — `brand-ecosystem-status` truthful MISSING split** | In `statusFor`, first check `existsSync(repo.dir)`; if the sibling repo directory is absent, return `{ state:"SIBLING_MISSING", detail: "sibling repo not found at <abs>; run <clone cmd> or set DRENYRA_ECOSYSTEM_ROOT/--root" }`; only fall through to banner/branding checks when the repo dir exists. Keep `MISSING`/`FAIL`/`PASS` for present repos. | ~15 | Test: with `--root <empty-dir>`, `--json` reports `SIBLING_MISSING` and exit 1 for each absent sibling; present-with-banner still `PASS`. |
| **A3 — `skills-conformance` runnable continuation** | In the `cannot read` branch, print the expected default path, a clone command for `drenyra-skills`, and the `--manifest <path>` escape hatch; keep exit 1. Add a `hint` field to the JSON missing branch. | ~10 | Test: with no sibling and no override, exit 1 and stderr/stdout names a runnable continuation; `--manifest <existing-file>` still passes (CI path unchanged). |
| **A4 — tests** | Add `scripts/__tests__/ecosystem-resilience.test.ts` (matches existing `**/__tests__/**/*.test.ts` include) that spawns each script against a temp fixture dir with `--root`: asserts (1) absent sibling → distinct `SIBLING_MISSING` + exit 1, (2) `skills-conformance` missing manifest → continuation hint + exit 1, (3) default behavior unchanged without the knob, (4) `--manifest` override still works. | ~70 | `bun run test` green for the new suite; `bun run typecheck` clean. |

**Estimated authored changed lines: ~110–130** (two script edits + one new test file), comfortably under 300. No CI change, no package.json change, no new dependency, no shared library module, no integrity relaxation. The npm script entry points (`brand:ecosystem`, `skills:conformance`) and the CI `--manifest` invocation are untouched.

### Why this slice first

- **Fixes the actual DX defect at the root:** it makes the *reason* for each failure truthful and gives a runnable continuation — not a cosmetic message change.
- **Strengthens, never weakens, integrity:** missing siblings still fail (exit 1), now correctly reported; the default `--manifest`/root behavior is preserved.
- **Small, reversible, no external/sibling-repo dependency at test time** (tests use a temp fixture dir, not a real sibling checkout).
- **Keeps the boundary to `scripts/` + one test file**, sharing none of the completed `reproducible-lint-gate` or blocked `gentle-ai-quality-parity` Slice A surfaces.

## Non-goals (explicit, for this change / first slice)

- **No weakening of any integrity check.** Missing/fail must always exit 1; a missing sibling is still a gate failure.
- **No hiding of missing dependencies.** The fix *surfaces* them (`SIBLING_MISSING`, continuation hints), never skips or defaults them away.
- **No `brand-ecosystem` CI job in the first slice.** Checking out 5 external sibling repos in CI is a wider review surface; it is Option C, a separate later slice.
- **No shared sibling-resolution library module.** Two self-contained edits to two scripts of different runtimes (node vs bun) are smaller and lower-risk than a shared module in this slice.
- **No changes to `package.json`, `.github/workflows/ci.yml`, `biome.json`, `tsconfig*`, or any frozen contract/WIP/blocked path.**
- **No lint/format work, no new dependency, no indentation normalization.** `scripts/*.mjs` are already in `biome.json` `files.includes` (lint-only); we add no new lint rules.
- **No changes to the sibling repos themselves** (`drenyra-skills`, `drenyra-command-center`, etc.).

## Migration / rollout strategy

1. Land A1 + A2 (sibling-root + truthful `SIBLING_MISSING` split) for `brand-ecosystem-status` and A1 + A3 for `skills-conformance` **with their tests in the same commits** (work-unit-commits: behavior + tests together), so the repo is never in a "script exists but reports a lie" state.
2. Default behavior is byte-compatible: with no `DRENYRA_ECOSYSTEM_ROOT`/`--root`, both scripts behave exactly as today except the diagnostics are truthful.
3. Document the new `DRENYRA_ECOSYSTEM_ROOT` / `--root` knob in the script header comments (already user-facing doc for both). No README/contract doc change required for the first slice (the sibling layout stays the documented convention).
4. A later, separate slice can add the `brand-ecosystem` CI job (Option C) once the local diagnostics are truthful, since that slice will need the 5-repo checkout matrix.

## Test / validation evidence

1. `scripts/__tests__/ecosystem-resilience.test.ts`: `bun run test` runs it (matches the existing `**/__tests__/**/*.test.ts` include) and it passes.
2. `brand-ecosystem-status` with `--root <empty-fixture-dir>` → `--json` reports `state: "SIBLING_MISSING"` for each absent sibling and exits 1.
3. `brand-ecosystem-status` with a fixture dir containing a passing sibling → that repo reports `PASS`; exit 0 only when all present and passing (unchanged integrity).
4. `skills-conformance` with no sibling and no override → exit 1 and output names a runnable continuation (expected path + clone + `--manifest`); JSON adds a `hint` field.
5. `skills-conformance` with `--manifest <existing-registry>` → exit 0 (the CI path still works, unchanged).
6. `bun run typecheck` clean; `bun run lint` clean (scripts already included; we add no findings).
7. Full `bun run test` result recorded; the pre-existing 3 baseline CLI failures (if any persist) are unchanged and explicitly not part of this slice's success.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Adding `--root`/env knob is read as a new "flag" by systemic-triage | Low | It *relaxes* a hardcoded assumption and defaults to current behavior; it adds no new gate, state, or integrity decision — the single knob a message fix is allowed. |
| Changing `brand-ecosystem-status` MISSING logic accidentally flips a present-but-failing repo | Medium | The split only adds an early `existsSync(repo.dir)` check; when the dir exists the existing banner/branding logic runs unchanged. Tests A2 assert the PASS/FAIL paths. |
| Tests spawn scripts that need `brand-conformance.mjs` (exists) and `skills/pe.ts` (exists) | Low | Both dependencies are already present in-repo; the temp-fixture approach exercises the missing-sibling path without a real sibling checkout. |
| JSON consumers depend on the `MISSING` string | Low | `SIBLING_MISSING` is additive; the existing `MISSING` state is unchanged for present-but-no-banner repos. No consumer contracts reference `MISSING` today. |
| Scope creep into CI job or shared module | Medium | Explicit non-goals above; the tasks slice keeps the boundary to the two script edits + one test file. |

## Rollback strategy

Slice A is fully reversible with two bounded work units: revert the `scripts/brand-ecosystem-status.mjs` and `scripts/skills-conformance.mjs` edits and remove `scripts/__tests__/ecosystem-resilience.test.ts`. No CI, package, lockfile, contract, WIP, or blocked path is touched, so rollback is independent of any other active change.

## Next recommended phase

`proposal` → `spec` → `design` → `tasks` for **Slice A (truthful sibling diagnostics + configurable sibling root)**. A separate later slice should add the **`brand-ecosystem` CI job** (Option C) and, if DRY value later proves it, a **shared sibling-root module** — each under its own budget, after this slice establishes the truthful, configurable local baseline.
