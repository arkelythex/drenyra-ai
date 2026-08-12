# Lint Gate Specification

## Purpose

Define the reproducible, lint-only quality gate for Slice A of `reproducible-lint-gate`: an exact-version-pinned Biome lint command that is deterministic locally and in CI, explicitly scoped to the repository's JavaScript/TypeScript source, test, configuration, and script surface, green against the current tree without modifying any source bytes, and free of formatter, write, or normalization behavior. Strict TypeScript typechecking remains the authoritative compiler gate and is untouched.

## Requirements

### Requirement: Exact Pinned Lint Tool

The system MUST declare `@biomejs/biome` in `package.json` `devDependencies` at an exact, range-free version, and the `bun run lint` command MUST resolve and execute exactly that pinned version. Local execution and CI execution MUST resolve the same pinned tool.

#### Scenario: Local execution resolves the pinned version

- GIVEN `@biomejs/biome` is pinned to an exact version in `devDependencies`
- WHEN `bun run lint` is executed locally
- THEN it runs Biome at exactly the pinned version and reports that version deterministically

#### Scenario: Local and CI share the pinned version

- GIVEN the committed lockfile records the pinned Biome entry
- WHEN CI installs with a frozen lockfile and runs `bun run lint`
- THEN the executed Biome version is identical to the locally pinned version

### Requirement: Lint-Only Execution

The `bun run lint` command MUST invoke Biome lint analysis without any write, fix, or format behavior, and MUST NOT modify any file. The Biome formatter MUST be disabled in configuration so that formatting is neither checked nor rewritten. The system MUST NOT expose a write-capable lint or fix script.

#### Scenario: Lint is read-only

- GIVEN an unchanged repository with the lint gate installed
- WHEN `bun run lint` is executed
- THEN it exits with the lint result and no file in the repository changes content, mode, or timestamps as a result of the command

#### Scenario: No write-capable script exists

- GIVEN the `package.json` scripts
- WHEN the script surface is inspected
- THEN no `lint:fix` or other write-capable lint script exists

### Requirement: Single Lint Policy Declaration

The root `biome.json` MUST be the single source of lint policy for the gate. Any exclusion MUST identify a stable category or architectural boundary and MUST NOT be a per-file suppression generated from current findings.

#### Scenario: Policy is single-sourced and category-based

- GIVEN the repository contains exactly one lint policy file at `biome.json`
- WHEN the policy's excludes are inspected
- THEN each exclusion names a stable category (for example, generated output, dependencies, or the OpenSpec artifact tree) rather than an individual file hiding a specific violation

### Requirement: Explicit Source Scope

The gate MUST lint only the allowlisted source surface: TypeScript under the `tsconfig.json` source/test include directories (`receipts/`, `ledger/`, `missions/`, `candidates/`, `review/`, `gates/`, `recovery/`, `tenant-core/`, `tenant-isolation/`, `agents/`, `cmd/`, `contracts/__tests__/`, `evidence/`, `skills/`, `security/`, `guardian/`, `adapters/`, `flow/`), the root `vitest.config.ts`, and JavaScript modules under `scripts/*.mjs`. The gate MUST NOT lint Markdown, YAML, JSON outside the policy file, generated output, dependency artifacts, OpenSpec content, repository metadata, `node_modules/`, `dist/`, coverage or build output, or any unrelated or active WIP path.

#### Scenario: Out-of-scope content does not fail the gate

- GIVEN a file outside the allowlist (for example, an OpenSpec document, a Markdown file, or generated output) contains a construct the enabled rules would flag
- WHEN `bun run lint` is executed
- THEN the gate remains green for that file and reports no finding from it

#### Scenario: In-scope content is covered

- GIVEN a file inside the allowlist contains a construct the enabled rules flag
- WHEN `bun run lint` is executed
- THEN the gate reports the finding for that file

### Requirement: Meaningful Baseline-Green Gate

The `bun run lint` command MUST exit `0` against the current, unchanged source tree, and the gate MUST ship green on the branch where it is introduced. The enabled ruleset MUST include substantive rules — applicable correctness and suspicious rules plus narrowly selected rules such as unused-import detection — and a green baseline achieved by disabling all substantive rules is not acceptable.

#### Scenario: Baseline is green without source edits

- GIVEN the current repository tree with no source, test, script, or documentation modifications
- WHEN `bun run lint` is executed
- THEN it exits `0` and the enabled ruleset still includes meaningful lint rules

#### Scenario: No red gate on introduction

- GIVEN the Slice A candidate branch containing the lint gate
- WHEN the gate is executed against that branch's tree
- THEN it exits `0`; the gate is never introduced in a red state

### Requirement: Meaningful Violation Detection

The gate MUST fail (exit non-zero) on a representative violation covered by the enabled rules, such as an unused import, when that violation is introduced inside an in-scope shipped library module, and it MUST identify the violating file and rule. Reverting the temporary violation MUST restore exit `0` with no residual diff.

#### Scenario: Temporary in-scope violation fails the gate

- GIVEN an in-scope shipped library module temporarily contains an unused import covered by the enabled rules
- WHEN `bun run lint` is executed
- THEN it exits non-zero and identifies that violation and its location

#### Scenario: Revert restores green

- GIVEN the temporary violation from the previous scenario is fully reverted
- WHEN `bun run lint` is executed and the diff is inspected
- THEN the command exits `0` and no residual source change remains

### Requirement: Console-Output Rule Scoping

Any console-output rule MUST apply only to shipped library modules where console usage is architecturally unintended and MUST NOT flag legitimate console output in the CLI adapter (`cmd/`) or repository scripts (`scripts/`). Such scoping MUST be expressed by rule scope in the policy, not by individual suppressions.

#### Scenario: Adapter console output is not a violation

- GIVEN a `cmd/` adapter or `scripts/*.mjs` script legitimately writes to the console
- WHEN `bun run lint` is executed
- THEN the gate reports no console-output violation for that file

#### Scenario: Library console output is a violation

- GIVEN a shipped library module writes to the console where the policy scopes console output as unintended
- WHEN `bun run lint` is executed
- THEN the gate reports the violation

### Requirement: CI Integration

The existing CI workflow MUST gain one lint job or isolated lint step on the push/PR path that installs with `bun install --frozen-lockfile` and executes the exact `bun run lint` command used locally. The CI lint step MUST be green for the Slice A candidate and MUST fail the workflow when lint findings are present.

#### Scenario: Clean candidate passes CI lint

- GIVEN a push or PR with the Slice A candidate whose tree passes `bun run lint` locally
- WHEN the CI workflow runs its frozen install and lint step
- THEN the lint step passes and the workflow proceeds

#### Scenario: Violating candidate fails CI lint

- GIVEN a push or PR whose tree contains an in-scope lint violation
- WHEN the CI workflow runs its lint step
- THEN the lint step fails and the workflow does not pass

### Requirement: Lockfile Integrity

The committed `bun.lock` MUST be consistent with `package.json`, `bun install --frozen-lockfile` MUST succeed against it, and its changes in this slice MUST be limited to the entries required by the pinned Biome tool.

#### Scenario: Frozen install succeeds on a fresh clone

- GIVEN a fresh clone at the Slice A candidate with the committed `bun.lock`
- WHEN `bun install --frozen-lockfile` is executed
- THEN it succeeds without modifying the lockfile

#### Scenario: Lockfile churn is bounded

- GIVEN the Slice A lockfile diff
- WHEN the diff is inspected
- THEN it contains only entries required by the exact pinned Biome dependency

### Requirement: No Formatting Churn or Source Modification

Slice A MUST NOT change the content of any source, test, script, documentation, WIP, or unrelated file, MUST NOT execute any formatter or write-capable lint command, and MUST preserve the existing mixed indentation exactly as-is.

#### Scenario: Final diff is configuration-only

- GIVEN the complete Slice A diff
- WHEN the changed path list is inspected
- THEN it contains only `package.json`, `bun.lock`, `biome.json`, and the CI workflow file, and no source, test, script, documentation, or WIP file content changed

### Requirement: Test-Baseline Preservation

The change MUST NOT alter the repository's test behavior: the known baseline of three failing tests in `cmd/__tests__/cli.test.ts` remains unchanged, and the gate MUST NOT add, hide, or remove any test failure or pass.

#### Scenario: Baseline test result is preserved

- GIVEN the known baseline test result of three failures in `cmd/__tests__/cli.test.ts`
- WHEN the full test suite is executed after the gate change
- THEN the result matches the baseline: the same three failures and no added or concealed failures

### Requirement: Changed-Line Budget

The complete Slice A implementation MUST stay at or below 300 authored changed lines; lockfile churn is recorded separately as generated dependency-resolution evidence. If a green, meaningful baseline cannot be achieved within the budget without source edits, per-file suppressions, or formatting changes, the implementation MUST stop for scope revision rather than work around the budget.

#### Scenario: Budget is measured and enforced

- GIVEN the final Slice A candidate
- WHEN authored additions plus deletions are counted, excluding lockfile churn
- THEN the count is at or below 300 lines

### Requirement: Rollback

The gate MUST be removable as one bounded work unit: delete `biome.json`, remove the `lint` script and the exact Biome `devDependency` from `package.json`, revert only the corresponding `bun.lock` entries, and remove the CI lint step. After rollback the repository MUST return to its prior behavior without restoring any application bytes and without coordinating with another active change.

#### Scenario: Rollback restores prior behavior

- GIVEN the rollback unit is applied to a Slice A repository
- WHEN the repository state is inspected
- THEN `bun run lint` no longer exists, no lint step runs in CI, the lockfile contains no Biome entries, and typecheck and test behavior are unchanged from before the gate
