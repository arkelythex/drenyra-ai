# Ecosystem Conformance Specification

## Purpose

Define the observable behavior of the two cross-repository conformance scripts — `brand-ecosystem-status` and `skills-conformance` — when their required sibling repositories are absent, relocated, or overridden. The goal is truthful and actionable local diagnostics without weakening either integrity gate: every missing dependency or failed check remains a non-zero failure, and a missing sibling repository is never misreported as missing repository content.

This domain covers the configurable sibling-root convention, the truthful missing-sibling vs. missing-content classification, runnable failure continuations, fail-closed exit semantics, machine-readable JSON compatibility, and the deterministic isolated test fixtures that protect these paths.

## Requirements

### Requirement: Sibling-Root Resolution Precedence

The system MUST resolve the sibling repository root by the following precedence, evaluated in order, and MUST NOT consult any other source:

1. the `DRENYRA_ECOSYSTEM_ROOT` environment variable, when set to a non-empty value;
2. the `--root <dir>` flag, when supplied and no non-empty environment override is active;
3. the current `..` sibling layout otherwise.

An empty or whitespace-only `DRENYRA_ECOSYSTEM_ROOT` value MUST be treated as unset. The resolved root MUST affect only the base directory in which sibling repositories are looked up; it MUST NOT alter manifest override selection, output format, exit codes, or any other behavior. The `skills-conformance --manifest <path>` override MUST continue to select the manifest directly and MUST remain independent of the resolved root.

#### Scenario: Environment override wins over the flag

- GIVEN `DRENYRA_ECOSYSTEM_ROOT=/env/root` is set and `--root /flag/root` is supplied
- WHEN either script resolves its sibling root
- THEN the sibling root is `/env/root`

#### Scenario: Flag applies only when the environment is unset

- GIVEN `DRENYRA_ECOSYSTEM_ROOT` is not set
- AND `--root /flag/root` is supplied
- WHEN either script resolves its sibling root
- THEN the sibling root is `/flag/root`

#### Scenario: No override preserves the current default

- GIVEN neither `DRENYRA_ECOSYSTEM_ROOT` nor `--root` is supplied
- WHEN either script resolves its sibling root
- THEN the sibling root is the current `..` sibling layout and path resolution is unchanged from today

#### Scenario: Empty environment value falls through

- GIVEN `DRENYRA_ECOSYSTEM_ROOT` is set to an empty string
- AND `--root /flag/root` is supplied
- WHEN either script resolves its sibling root
- THEN the empty value is treated as unset and the sibling root is `/flag/root`

### Requirement: Truthful Missing-Sibling Classification

`brand-ecosystem-status` MUST check whether each expected sibling repository directory exists before evaluating banner or branding content. An absent repository directory MUST be reported as `SIBLING_MISSING`, naming the expected path and an actionable continuation that uses the configured root or a sibling checkout. A present repository with absent banner or branding content MUST continue to be reported with the existing content-level `MISSING` result. Existing `PASS` and `FAIL` evaluation for present repositories MUST remain unchanged.

#### Scenario: Absent sibling is reported as SIBLING_MISSING

- GIVEN a configured sibling root that does not contain an expected sibling repository directory
- WHEN `brand-ecosystem-status` runs with that root
- THEN that repository is reported as `SIBLING_MISSING`
- AND the report names the expected absolute path and a runnable continuation
- AND the script exits non-zero

#### Scenario: Present sibling without required content stays MISSING

- GIVEN a configured sibling root containing an expected sibling repository directory
- AND that directory lacks the required banner or branding assets
- WHEN `brand-ecosystem-status` runs with that root
- THEN that repository is reported with the existing content-level `MISSING` result, not `SIBLING_MISSING`

#### Scenario: Present passing sibling reports PASS

- GIVEN a configured sibling root containing an expected sibling repository directory with all required banner and branding assets
- WHEN `brand-ecosystem-status` runs with that root
- THEN that repository is reported as `PASS`

#### Scenario: Mixed present and absent siblings still fail the gate

- GIVEN a configured sibling root where one expected sibling is present and passing
- AND another expected sibling directory is absent
- WHEN `brand-ecosystem-status` runs with that root
- THEN the present sibling is reported as `PASS` and the absent sibling as `SIBLING_MISSING`
- AND the script exits non-zero

### Requirement: Actionable Missing-Manifest Continuation

When `skills-conformance` cannot read the selected or default manifest because the sibling dependency is unavailable, it MUST identify the attempted manifest path, retain the failure result and exit code 1, and name a runnable continuation that uses a sibling checkout and/or the existing `--manifest <path>` override. Successful behavior for an explicit readable `--manifest` path MUST remain unchanged.

#### Scenario: Missing default manifest names a runnable continuation

- GIVEN no `DRENYRA_ECOSYSTEM_ROOT`, `--root`, or `--manifest` override
- AND the default sibling manifest path cannot be read
- WHEN `skills-conformance` runs
- THEN the output identifies the attempted manifest path
- AND the output names a runnable continuation using a sibling checkout and/or `--manifest <path>`
- AND the script exits 1

#### Scenario: Explicit readable manifest still passes

- GIVEN an explicit `--manifest <readable-path>` pointing to a readable registry file
- WHEN `skills-conformance` runs with that override
- THEN the script evaluates the explicit manifest and exits 0 when conformance passes
- AND the override selects the manifest directly, independent of the resolved sibling root

### Requirement: Fail-Closed Integrity Semantics

The system MUST NOT skip, downgrade, warn-only, or convert into success any missing dependency or failed check. Any missing or failed result — including `SIBLING_MISSING` and an unreadable manifest — MUST produce a non-zero exit. Exit 0 MUST be possible only when every required check passes.

#### Scenario: Missing dependency is never converted into success

- GIVEN a missing sibling repository or unreadable manifest
- WHEN either script completes its run
- THEN the script exits non-zero regardless of output mode

#### Scenario: Exit zero only on a full pass

- GIVEN all required sibling repositories are present and all content and conformance checks pass
- WHEN either script completes its run
- THEN the script exits 0

### Requirement: Machine-Readable JSON Compatibility

When JSON output is requested, existing success semantics MUST remain unchanged, and every failure MUST remain valid machine-readable JSON that fails closed. `brand-ecosystem-status --json` MUST report an absent sibling with the additive state `SIBLING_MISSING` and MUST keep the existing `MISSING` state for present repositories with absent content. `skills-conformance --json` MUST retain its failure result in the missing-manifest branch and MUST include an additive actionable `hint` field; no existing JSON field or state MAY be removed or redefined.

#### Scenario: Brand JSON distinguishes missing sibling from missing content

- GIVEN `brand-ecosystem-status --json` runs against a root where one sibling is absent and another is present without required content
- THEN the JSON output reports the absent sibling with state `SIBLING_MISSING`
- AND reports the present sibling with the existing `MISSING` state
- AND the JSON remains valid and the exit is non-zero

#### Scenario: Skills JSON failure keeps pass:false and gains a hint

- GIVEN `skills-conformance --json` runs with an unavailable default manifest
- THEN the JSON output remains valid and machine-readable
- AND the failure result is retained (`pass: false`, exit 1)
- AND the output includes an additive `hint` field carrying the actionable continuation

#### Scenario: Success JSON is unchanged

- GIVEN `skills-conformance --json` or `brand-ecosystem-status --json` runs and every required check passes
- THEN the JSON output and its field set are unchanged from current success behavior
- AND the exit is 0

### Requirement: Deterministic Isolated Test Fixtures

The focused tests for these scripts MUST use temporary fixture roots and explicit process environments rather than real sibling checkouts. The tests MUST cover: sibling-root override resolution for both scripts; the current default `..` resolution when no override is configured; an absent brand sibling reported distinctly as `SIBLING_MISSING` with exit 1; a present brand sibling continuing through existing content/pass/fail evaluation; a missing skills manifest producing an actionable continuation with exit 1; the explicit `--manifest` override continuing to work; and JSON diagnostics remaining machine-readable and fail-closed. Test fixtures MUST NOT depend on external sibling repositories, and the environment MUST be controlled so no ambient `DRENYRA_ECOSYSTEM_ROOT` leaks into a scenario that intends the default.

#### Scenario: Fixture root drives the missing-sibling path

- GIVEN a temporary empty fixture root and an explicit `--root` pointing at it
- AND an explicit process environment without `DRENYRA_ECOSYSTEM_ROOT`
- WHEN `brand-ecosystem-status` runs
- THEN each absent sibling is reported as `SIBLING_MISSING` and the exit is 1

#### Scenario: Fixture root drives the present-sibling path

- GIVEN a temporary fixture root containing an expected sibling directory with required banner assets
- AND an explicit `--root` pointing at it
- WHEN `brand-ecosystem-status` runs
- THEN the sibling is reported as `PASS`

#### Scenario: Default resolution is exercised without ambient overrides

- GIVEN an explicit process environment without `DRENYRA_ECOSYSTEM_ROOT` and no `--root` argument
- WHEN either script runs
- THEN the script resolves the sibling root to the current `..` default
- AND the test asserts behavior consistent with that default resolution

## Non-Goals

- No new CI job, including no `brand:ecosystem` job and no five-repository checkout matrix.
- No shared sibling-resolution module, root-level module, or parallel source of truth.
- No new dependency, package script, command verb, or integrity state machine.
- No weakening, skipping, warning-only conversion, or fallback-success behavior for missing dependencies or failed checks.
- No changes to `package.json`, lockfiles, `.github/workflows/ci.yml`, TypeScript/Biome configuration, contracts, product runtime modules, active blocked changes, or sibling repositories.
- No redesign of brand or skills conformance semantics beyond truthful missing-dependency classification, sibling-root resolution, and actionable diagnostics.
- No unrelated linting, formatting, cleanup, or normalization.
