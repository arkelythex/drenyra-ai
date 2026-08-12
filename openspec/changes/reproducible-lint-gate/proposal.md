# Proposal — Reproducible Lint Gate, Slice A

## Intent

Add the smallest reproducible quality gate that closes the repository's current lint gap without reformatting or otherwise normalizing the existing tree.

Slice A introduces an exact-version-pinned Biome development dependency, a lint-only configuration, a `bun run lint` command, and a lint job in the existing CI workflow. The gate must pass against the current baseline as-is. It must not require source edits, formatter output, indentation normalization, or changes to existing TypeScript strictness.

This slice addresses the gap between Design 05's stated "Typecheck and lint" pipeline and the current repository, which has strict typechecking but no runnable, version-pinned lint command or CI lint step.

## Goals

1. Provide one deterministic local lint command backed by an exact pinned Biome version and the committed Bun lockfile.
2. Run the same lint command in the existing push/PR CI workflow using frozen dependency installation.
3. Keep Biome strictly lint-only: formatter execution and format enforcement are disabled.
4. Make the gate green on the current tree without modifying or reformatting source files.
5. Cover a narrow, explicit JavaScript/TypeScript source, test, configuration, and script surface while excluding generated, artifact, OpenSpec, and unrelated content.
6. Prove that the baseline passes and that a representative lint violation fails the gate.
7. Keep the complete Slice A implementation at or below 300 authored changed lines.

## Scope

### In scope for Slice A implementation

- Add `@biomejs/biome` as an exact-version-pinned `devDependency`.
- Update and commit `bun.lock` only as required by that dependency.
- Add a root `biome.json` as the single lint policy declaration.
- Add a `lint` package script that invokes `biome lint` without write/fix behavior.
- Add one lint job or equivalent isolated lint step to `.github/workflows/ci.yml`, following the workflow's existing Bun setup and `bun install --frozen-lockfile` conventions.
- Record strict baseline and differential validation evidence in the later apply/verify artifacts.

### Narrow lint source scope

The configuration must use an allowlisted source surface rather than scanning the whole repository:

- TypeScript under the current `tsconfig.json` source/test include directories: `receipts/`, `ledger/`, `missions/`, `candidates/`, `review/`, `gates/`, `recovery/`, `tenant-core/`, `tenant-isolation/`, `agents/`, `cmd/`, `contracts/__tests__/`, `evidence/`, `skills/`, `security/`, `guardian/`, `adapters/`, and `flow/`.
- Root `vitest.config.ts`.
- JavaScript modules under `scripts/*.mjs`.

Markdown, YAML, JSON outside the Biome policy file, generated output, dependencies, OpenSpec artifacts, and other repository content are not part of this gate.

### Biome configuration and ignore policy

`biome.json` must:

- disable the formatter so indentation and other formatting are neither checked nor rewritten;
- enable only a deliberate, baseline-green lint ruleset, beginning with applicable correctness and suspicious rules plus narrowly selected rules such as unused imports;
- avoid broad style presets that would turn this slice into repository normalization;
- scope rules that conflict with legitimate adapter behavior, especially console output, to appropriate shipped library modules rather than `cmd/` or `scripts/`;
- use explicit includes for the source surface above;
- exclude `node_modules/`, `dist/`, coverage/build/generated output, `openspec/`, repository metadata, and any unrelated or active WIP path;
- contain no automatic ignore generated from current findings. Any exclusion must identify a stable category or legitimate architectural boundary, not hide an individual violation.

If the selected baseline-safe rules cannot cover the full allowlist within the 300-line budget, the implementation must stop for scope revision rather than add per-file suppressions, reformat files, or silently weaken strict TypeScript checks.

## Non-goals

- No formatter command, format check, format-on-save policy, or repository reformatting.
- No indentation normalization; the existing mix of tabs, two-space, and four-space indentation remains unchanged.
- No source, test, documentation, or active WIP edits to make lint pass.
- No ESLint, Prettier, markdownlint, YAML lint, or link-check adoption.
- No weakening or replacement of `tsc`, `strict`, or any existing TypeScript compiler check.
- No repair of the three pre-existing failures in `cmd/__tests__/cli.test.ts`.
- No changes to the blocked `gentle-ai-quality-parity` Slice A, `release-integrity-evidence`, or unrelated OpenSpec/program work.
- No generated baseline file, parallel lint policy, new runtime state, or user-facing configuration flag.
- No `lint:fix` command in Slice A; write-capable lint behavior is intentionally excluded from the gate.

## Affected Areas

| Area | Planned effect |
| --- | --- |
| `package.json` | Exact Biome devDependency and one lint-only script. |
| `bun.lock` | Reproducible lock entry for the pinned development tool. |
| `biome.json` | New single-source lint configuration with formatter disabled and explicit scope. |
| `.github/workflows/ci.yml` | Existing CI gains the same frozen-install lint command used locally. |
| Source/test/script files | Read by lint only; their bytes must remain unchanged in Slice A. |
| Typecheck/test gates | Remain present and semantically unchanged. |

## Business and Product Rules

- A new required gate may not ship red on the branch where it is introduced.
- Local and CI lint must resolve the same pinned tool and execute the same command.
- The gate must detect meaningful violations; a green baseline created by disabling all substantive rules is not acceptable.
- Legitimate CLI/script console output must not be classified as a library violation merely to claim broad rule coverage.
- Existing baseline test failures are reported accurately but do not block this independent lint-only slice.
- The current tree is the baseline. This slice adapts the lint policy to that tree within the stated narrow scope; it does not normalize the tree to satisfy a preferred formatter or style preset.
- Authored additions plus deletions for the complete implementation must not exceed 300 lines. Lockfile churn is recorded separately as generated dependency resolution evidence and must contain only the pinned-tool update.

## Strict Validation and Baseline Evidence

The implementation is successful only when all of the following evidence is recorded with exact commands, exit codes, and relevant output summaries:

1. **Initial lint baseline:** run the pinned lint command against the explicit allowlist before final rule tuning and record all findings. This evidence informs configuration only; it must not trigger source edits.
2. **Green baseline:** `bun run lint` exits `0` against the current unchanged source tree.
3. **Meaningful RED proof:** in a temporary, fully reverted change within an in-scope shipped library module, add a representative violation covered by the selected rules (for example, an unused import). `bun run lint` must exit non-zero and identify that violation. After reverting the temporary change, the command must return to exit `0`, with no residual source diff.
4. **Reproducible install:** `bun install --frozen-lockfile` succeeds with the committed package and lock state.
5. **Strict TypeScript preservation:** `bun run typecheck` retains its existing behavior and passes if it passes on the same baseline; no compiler setting or typecheck script may change.
6. **Regression visibility:** run `bun run test` and compare its result with the known baseline of three failures in `cmd/__tests__/cli.test.ts`. Those failures may remain, but Slice A must not add or conceal failures.
7. **CI equivalence:** the CI lint job uses the frozen install and exact `bun run lint` command, and is green on push/PR for the Slice A candidate.
8. **No-format proof:** inspect the final diff and confirm that no source, test, script, documentation, WIP, or unrelated file content changed and that no formatter/write command was executed.
9. **Scope and budget proof:** record the final path list and authored changed-line count; the implementation must remain at or below 300 authored changed lines.

If Biome cannot produce a meaningful green gate on the current tree under these constraints, Slice A must be revised rather than landing a red gate, mass suppressions, source cleanup, or formatting churn.

## Success Criteria

- `bun run lint` deterministically invokes the exact pinned Biome dependency and exits `0` on the current tree.
- A temporary representative in-scope violation makes that same command fail, and reverting it restores green without residual changes.
- CI runs `bun install --frozen-lockfile` and `bun run lint` on the existing push/PR path.
- Biome's formatter is disabled and no source or repository-wide formatting change appears in the final diff.
- The lint allowlist and exclusions match this proposal; no WIP, OpenSpec, generated, Markdown, or YAML surface is linted.
- Strict TypeScript configuration and existing typecheck behavior remain unchanged.
- Known baseline test failures remain explicitly distinguished from regressions.
- The complete implementation stays within 300 authored changed lines.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The initial Biome rules produce a large baseline. | The slice could expand into source cleanup or broad suppressions. | Keep a minimal meaningful ruleset and explicit allowlist; stop for scope revision if green cannot be achieved without source changes or per-file ignores. |
| Formatter behavior is enabled accidentally. | High-churn, unrelated diffs and mixed-indentation normalization. | Disable the formatter in configuration, expose no write-capable script, and require final no-source-diff evidence. |
| Lint duplicates or conflicts with strict TypeScript. | Confusing ownership or weakened checks. | Keep `tsc` unchanged and select only complementary Biome rules; TypeScript remains authoritative for compiler diagnostics. |
| `noConsole` rejects legitimate CLI/script output. | False positives encourage unsafe ignores. | Apply it only where console usage is architecturally unintended; exempt `cmd/` and `scripts/` by rule scope rather than individual suppression. |
| Ignore policy hides real defects. | A nominally green but ineffective gate. | Permit only category- or boundary-based exclusions and require a differential RED proof. |
| Dependency or lockfile drift breaks reproducibility. | Local and CI behavior diverge. | Pin an exact version, commit the matching lock entry, and validate with frozen installation. |
| Existing test failures are mistaken for lint regressions. | Incorrect blocking or unrelated scope expansion. | Record the before/after test baseline and keep the known three CLI failures explicitly out of scope. |
| CI duplication increases maintenance. | Workflow drift or redundant setup. | Mirror the existing CI job conventions and invoke the same package script used locally. |

## Rollback

Rollback is one bounded work unit:

1. Remove `biome.json`.
2. Remove the `lint` script and exact Biome devDependency from `package.json`.
3. Revert only the corresponding Biome entries in `bun.lock`.
4. Remove the lint job/step from `.github/workflows/ci.yml`.

Because Slice A performs no source formatting, compiler relaxation, migration, or WIP modification, rollback does not require restoring application bytes or coordinating with another active change. After rollback, the repository returns to its previous typecheck/test/CI behavior, with the pre-existing absence of a lint gate restored.

## Scope Boundary for Later Slices

Format enforcement is deferred until indentation normalization is designed and delivered as a separate bounded change. Markdown/YAML linting and documentation link checking are also separate changes with their own baseline and tool decisions. None may be folded into Slice A even if implementation reveals nearby opportunities.

## Proposal Assumptions

Automatic mode provides these reviewed assumptions from exploration:

- the business outcome is a reproducible, meaningful lint gate rather than general style normalization;
- current mixed indentation is intentional baseline evidence for deferring formatting, not an invitation to clean up files;
- source bytes and active WIP must remain untouched;
- the existing CI workflow is the only delivery surface for this slice;
- exact rule selection may be tuned from measured baseline findings, but the scope, formatter prohibition, reproducibility requirement, and meaningful RED proof are fixed.
