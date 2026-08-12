# Implementation Tasks — ecosystem-script-resilience (Slice A)

Change: `ecosystem-script-resilience` · Slice A: truthful sibling diagnostics + configurable sibling root for `brand-ecosystem-status` and `skills-conformance`.

Store: OpenSpec.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 215–270 (design forecast: 30–45 brand + 35–50 skills + 150–175 test) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR (one reviewable work unit) |
| Delivery strategy | single-pr |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

Slice A is a single reviewable work unit: the shared precedence contract, two CLI implementations, and the subprocess regression test must remain coherent and ship together. Forecast (215–270) is below the 300-line cap and well below the 400-line chained-PR threshold, so chaining is not recommended.

## Mandatory stop conditions (apply MUST halt and re-scope, never proceed)

- Authored additions + deletions for Slice A exceed **300** lines. Re-scope, do not exceed the cap.
- Any edit touches a path outside the exact three-file allowlist: `scripts/brand-ecosystem-status.mjs`, `scripts/skills-conformance.mjs`, `scripts/__tests__/ecosystem-script-resilience.test.ts` (new). Denied: `package.json`, lockfiles, `.github/workflows/ci.yml`, TS/Biome config, contracts, shared/runtime modules, active blocked changes, sibling repositories, generated files, and the OpenSpec planning records.
- Any scope drift toward CI (`brand:ecosystem` job, checkout matrix), a shared sibling-root module, a new dependency, a new package script, or a new command verb.
- Any weakening, skipping, warning-only, or fallback-success conversion of a missing dependency or failed check. Every missing/failing condition MUST still exit non-zero.
- Tests depend on real sibling checkouts or the network, or an ambient `DRENYRA_ECOSYSTEM_ROOT` leaks into a default-resolution scenario.
- Any change to success JSON field sets, exit-code semantics, or present-repository `PASS`/`FAIL`/`MISSING` evaluation.

## Fixed behavioral contract (from spec + design)

Root precedence, evaluated in order, no other source consulted:

1. non-empty `DRENYRA_ECOSYSTEM_ROOT` (empty/whitespace-only treated as unset);
2. `--root <dir>` only when the environment value is unset or whitespace-only;
3. the existing `..` sibling layout.

`skills-conformance --manifest <path>` remains a separate selection step, resolves exactly as today, and is independent of the resolved root. Relative roots resolve from the process working directory via `resolve(...)`. In `brand-ecosystem-status`, the local `drenyra-ai` repo continues to resolve to its own repository root; only the five sibling entries join the resolved root. Every missing/failing condition exits non-zero; exit 0 only when every required check passes.

Focused command:

```bash
bun run test -- scripts/__tests__/ecosystem-script-resilience.test.ts
```

Verification commands:

```bash
bun run test -- scripts/__tests__/ecosystem-script-resilience.test.ts
bun run test
bun run typecheck
bun run lint
```

---

## RED — write the failing subprocess test first

- [x] Create `scripts/__tests__/ecosystem-script-resilience.test.ts` covering, with isolated fixture roots and explicit child-process environments (each invocation sets or deletes `DRENYRA_ECOSYSTEM_ROOT`):
  1. **Brand root precedence:** a different environment root and a different `--root` prove the environment wins; a whitespace-only environment proves the flag wins.
  2. **Brand absent siblings:** an empty explicit root yields `SIBLING_MISSING` for all five expected sibling entries, includes each expected absolute path, remains valid JSON, and exits 1.
  3. **Brand present content paths:** a created sibling dir without branding yields `MISSING`; a palette-conformant PNG at a canonical banner path yields `PASS`; an off-palette PNG yields `FAIL`; aggregate exit is non-zero unless every required repo passes.
  4. **Skills root precedence:** missing-manifest JSON exposes the attempted absolute path, proving environment > flag and whitespace-only-environment fallback.
  5. **Skills diagnostics:** missing default/selected manifest yields exit 1, parseable JSON with `pass: false` and `hint`, and human mode names the attempted path and the `--manifest` continuation.
  6. **Manifest independence:** a temporary manifest serialized from `BASE_PE_SKILLS` passes through explicit `--manifest` even when environment and `--root` point elsewhere; successful JSON has no added `hint`.
  7. **Default `..` without ambient dependencies:** copy each target script into a temporary miniature repository layout; for brand leave banner paths absent so its checker is never invoked; for skills provide a minimal local `skills/pe.ts` stub exporting `BASE_PE_SKILLS = []`; run with neither root source and assert attempted sibling paths resolve beside the temporary repository.
  Use `spawnSync` without shell interpolation, `process.execPath` for brand and `bun run` for skills, `mkdtempSync` roots, and recursive forced cleanup in `afterEach`/`afterAll`. Keep the PNG helper private to the file and generate only temporary fixture bytes. Run the focused command and record the RED failure (tests must fail for the missing behavior). <!-- sdd-owner: implementation -->

## GREEN — make the scripts satisfy the tests

- [x] `scripts/brand-ecosystem-status.mjs`: add a private local root resolver applying environment > flag > existing `..`; build the five sibling directory paths from the resolved root while keeping `drenyra-ai` at the script's own repo root; add an early directory-existence branch in `statusFor(repo)` returning `{ state: "SIBLING_MISSING", detail: "<expected-abs-path>; place <repo-name> there or rerun with --root <ecosystem-root>" }` for absent sibling dirs, leaving the existing content/MISSING/PASS/FAIL logic untouched for present dirs; document `DRENYRA_ECOSYSTEM_ROOT` and `--root`. Keep aggregate `{ gate, pass, repos }` and `PENDING`/exit-1 fail-closed behavior. Run the focused suite; record the GREEN result. <!-- sdd-owner: implementation -->
- [x] `scripts/skills-conformance.mjs`: add the same private local root resolver; derive the default manifest from the resolved root (`<root>/drenyra-skills/skills/registry.json`) while `--manifest <path>` still resolves and selects directly independent of root; on read/parse failure retain the fail result and exit 1 while naming the attempted path, a sibling-checkout continuation, and the `--manifest` continuation; JSON mode emits exactly one parseable document with `{ contract, manifest, pass: false, problems, hint }` (additive `hint`); human mode writes the existing diagnostic plus the hint to stderr; document root override usage. Run the focused suite; record the GREEN result. <!-- sdd-owner: implementation -->

## TRIANGULATE — broaden and pin the matrix

- [x] Extend the focused test to triangulate the environment, flag, default, human, and JSON paths (e.g. table-driven cases across both scripts for precedence, whitespace-only env, absent-sibling detail strings, and success-JSON no-`hint` shape). Run the focused suite; record the result. <!-- sdd-owner: implementation -->

## REFACTOR — small local cleanup, no behavior change

- [x] Perform any small local refactoring of the two scripts (naming, helper locality) that does not change observable behavior, then re-run the focused suite to confirm unchanged GREEN. <!-- sdd-owner: implementation -->

## Verification evidence

- [x] Run `bun run test` (full suite), `bun run typecheck`, and `bun run lint`, and record exact results for each against the touched surface. Confirm no baseline test was edited and no failure is attributable to Slice A. Confirm the Slice A authored additions + deletions remain at or below 300 (and record the measured count). <!-- sdd-owner: implementation -->

---

## Parent-owned (post-apply lifecycle)

- [ ] After apply completes and the focused suite + typecheck + lint pass, run a bounded review of the Slice A diff before opening the PR. <!-- sdd-owner: parent -->
- [ ] Open a single PR for Slice A; do not chain. Validate the approved receipt before commit/push/PR per repository policy. <!-- sdd-owner: parent -->

## Rollback

Single independent quality-slice revert: revert `scripts/brand-ecosystem-status.mjs` and `scripts/skills-conformance.mjs`, and delete `scripts/__tests__/ecosystem-script-resilience.test.ts`. No migration, stored data, CI configuration, dependency, package interface, contract, or sibling repository is rolled back; the scripts return to their previous `..` default and diagnostics with fail-closed exits intact.
