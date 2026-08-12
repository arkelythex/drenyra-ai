# Proposal — ecosystem-script-resilience (Slice A)

## Intent

Make the local failure modes of `brand-ecosystem-status` and `skills-conformance` truthful and actionable when required sibling repositories are absent or relocated, without weakening either integrity gate.

Both scripts already fail closed. The defect is diagnostic and operational: `brand-ecosystem-status` reports an absent sibling repository as missing banner content, while `skills-conformance` reports an unreadable manifest without a runnable continuation. Both also assume the sibling root is `..`, although local checkout layouts can differ.

Slice A will preserve current default resolution and non-zero failure behavior, add one configurable sibling-root convention, distinguish an absent sibling from absent content, and cover these paths with focused tests.

## Product and architecture fit

This is an independent developer-quality slice. It improves the reliability and explainability of existing cross-repository conformance tooling; it does not add or alter product capabilities in the 16-program Peru v1 roadmap.

The change does not cross the approved runtime architecture boundary (`contracts` → library modules → agents → `cmd`) and does not affect AI advisory behavior, deterministic accounting authority, the audit ledger, accounting journals, evidence, memory, SUNAT-facing flows, or any domain invariant. It is limited to two existing scripts and their tests.

## Current-state gap

- `brand-ecosystem-status` treats a missing sibling directory as if the repository existed but lacked banner assets, producing a false diagnosis.
- `skills-conformance` fails on an unreadable default sibling manifest but does not tell the developer how to continue with a sibling checkout or the existing `--manifest` override.
- Both scripts hardcode `..` as the sibling root for their default lookup.
- CI always supplies `--manifest` to `skills-conformance`, and no CI job runs `brand:ecosystem`; therefore these local default-path failures are not currently covered.
- Neither missing-dependency branch has focused automated tests.

## Slice A scope

### 1. Configurable sibling-root resolution

Both scripts will resolve their sibling root through the same local convention:

1. `DRENYRA_ECOSYSTEM_ROOT` when configured;
2. `--root <dir>` when supplied and no environment override is active;
3. the current `..` sibling layout otherwise.

The resolved root changes only where sibling repositories are looked up. With neither override present, path resolution and gate behavior remain unchanged.

The existing `skills-conformance --manifest <path>` override remains supported and continues to select the manifest directly.

### 2. Truthful `brand-ecosystem-status` diagnostics

Before checking banner or branding content, the script will check whether each expected sibling repository directory exists.

- An absent repository will be reported as `SIBLING_MISSING`, including its expected path and an actionable continuation using the configured root or sibling checkout.
- A present repository with absent banner or branding content will continue to use the existing content-level `MISSING` result.
- Existing `PASS`, `FAIL`, and present-repository evaluation behavior will remain unchanged.
- Any missing or failed result, including `SIBLING_MISSING`, will continue to produce a non-zero exit.

### 3. Actionable `skills-conformance` diagnostics

When the selected/default manifest cannot be read because the sibling dependency is unavailable, the script will:

- identify the attempted manifest path;
- retain the failure result and exit code 1;
- name a runnable continuation using a sibling checkout and/or the existing `--manifest <path>` override;
- preserve successful behavior for an explicit readable `--manifest` path.

If JSON output is requested, the failure remains machine-readable and fail-closed while gaining an actionable hint; existing success semantics remain unchanged.

### 4. Focused tests

Add script-level tests using temporary fixture roots rather than real sibling checkouts. Tests will cover:

- sibling-root override resolution for both scripts;
- current default `..` resolution when no override is configured;
- absent brand sibling reported distinctly as `SIBLING_MISSING` with exit 1;
- present brand sibling continuing through existing content/pass/fail evaluation;
- missing skills manifest producing an actionable continuation with exit 1;
- explicit `--manifest` continuing to work, preserving the CI-used path;
- JSON diagnostics remaining machine-readable and fail-closed.

Tests and script behavior belong to the same implementation work units.

## Acceptance criteria

1. Running `brand-ecosystem-status` against an empty configured sibling root reports each absent repository as `SIBLING_MISSING`, names the expected path and continuation, and exits non-zero.
2. A present sibling repository without required branding is still reported as content-level `MISSING`, not `SIBLING_MISSING`.
3. Existing brand `PASS`/`FAIL` evaluation is unchanged for present repositories, and exit 0 remains possible only when all required checks pass.
4. `skills-conformance` with an unavailable default manifest names the attempted path and a runnable continuation, and exits 1.
5. `skills-conformance --manifest <readable-path>` retains its current behavior, including the CI invocation shape.
6. `DRENYRA_ECOSYSTEM_ROOT` and `--root <dir>` resolve sibling lookups according to the documented precedence, while no override preserves the current `..` default.
7. Human-readable and JSON modes remain truthful and fail closed; no missing dependency is skipped, downgraded, or converted into success.
8. Focused tests pass under `bun run test`; `bun run typecheck` and `bun run lint` remain clean for the touched surface.
9. Authored additions plus deletions for Slice A remain at or below 300 lines.
10. No implementation outside the two scripts and their focused test file is required.

## Affected areas

Expected implementation surface:

- `scripts/brand-ecosystem-status.mjs`
- `scripts/skills-conformance.mjs`
- `scripts/__tests__/ecosystem-resilience.test.ts` (new)

No package, lockfile, workflow, contract, shared runtime module, or sibling repository changes are included.

## Non-goals

- No new CI job, including no `brand:ecosystem` job or five-repository checkout matrix.
- No shared sibling-resolution module or root-level module.
- No new dependency, package script, command verb, integrity state machine, or parallel source of truth.
- No weakening, skipping, warning-only conversion, or fallback-success behavior for missing dependencies or failed checks.
- No changes to `package.json`, lockfiles, `.github/workflows/ci.yml`, TypeScript/Biome configuration, contracts, product runtime modules, active blocked changes, or sibling repositories.
- No redesign of brand or skills conformance semantics beyond truthful missing-dependency classification, root resolution, and actionable diagnostics.
- No unrelated linting, formatting, cleanup, or normalization.

## Product tradeoffs

- The proposal introduces one configuration convention rather than inferring or scanning for sibling repositories. This keeps resolution deterministic and diagnostics explainable, at the cost of requiring an explicit override for nonstandard layouts.
- The two scripts will implement the small convention independently instead of adding a shared module. This accepts minor duplication to keep Slice A isolated, runtime-compatible, reversible, and within budget.
- Adding `SIBLING_MISSING` makes the brand JSON diagnosis more precise. Consumers that enumerate states must tolerate the additive state, while the existing `MISSING` meaning remains available for present repositories with absent content.
- CI parity is deferred. Slice A protects the local failure paths with fixture-based tests without creating a cross-repository CI dependency.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Root-precedence ambiguity causes surprising path selection | Medium | Specify and test one precedence order; preserve `..` when unset. |
| Missing-sibling classification accidentally changes checks for present repositories | Medium | Make directory absence an early, narrow branch and regression-test existing present-repository outcomes. |
| New JSON state or hint affects strict consumers | Low | Keep existing states and success/failure semantics; add only the truthful missing-sibling state/hint and test JSON shape. |
| Diagnostic continuation is printed but not usable | Medium | Assert the exact actionable form in focused tests and keep it based on existing commands/flags rather than adding a new workflow. |
| Scope expands into CI or shared infrastructure | Medium | Enforce the three-file implementation boundary and 300-line authored-change budget. |
| Tests accidentally depend on real sibling repositories | Low | Use isolated temporary fixture roots and explicit process environments. |

## Rollback

Rollback is a single independent quality-slice revert:

- revert the edits to `scripts/brand-ecosystem-status.mjs` and `scripts/skills-conformance.mjs`;
- remove `scripts/__tests__/ecosystem-resilience.test.ts`.

No migration, stored data, CI configuration, dependency, package interface, contract, or sibling repository must be rolled back. The scripts return to their current `..` default and previous diagnostics; their existing fail-closed exits remain intact throughout.

## Success criteria

Slice A succeeds when developers can immediately distinguish an absent sibling checkout from missing repository content, can point both scripts at a deliberate sibling root, and receive a runnable continuation from missing-dependency failures, while all missing/failing conditions still exit non-zero and all no-override behavior continues to use the current sibling layout.

Success also requires focused regression evidence, no external sibling checkout dependency in tests, no shared root module or CI job, and an authored diff no larger than 300 changed lines.

## Proposal question round

The delegated scope is sufficiently bounded to draft without delaying the autonomous slice, but these assumptions should be reviewed before specification:

1. Is the intended precedence specifically `DRENYRA_ECOSYSTEM_ROOT` over `--root`, with `..` as the fallback, or should an explicit CLI flag override the environment?
2. Must the runnable continuation include an exact repository-specific clone command, or is a tested `--root`/`--manifest` command sufficient and less likely to become stale?
3. For `skills-conformance --json`, may the missing-manifest result add a `hint` field, or must the existing JSON schema remain byte-for-byte stable with guidance sent only to stderr?
4. Is `SIBLING_MISSING` an approved additive public JSON state, or should truthful differentiation be confined to detail/reason fields to protect strict consumers?

Current assumptions follow the exploration: environment override precedes `--root`; diagnostics include a concrete sibling-checkout or override continuation; JSON gains an actionable hint; and brand JSON gains additive `SIBLING_MISSING`. These are product-contract decisions to confirm or correct during the spec phase.

## Next recommended phase

Proceed to `spec` for Slice A, resolving the four proposal assumptions before freezing observable CLI and JSON behavior.
