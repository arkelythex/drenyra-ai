# Tasks — Reproducible Lint Gate, Slice A

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 68–88 authored (config-only) + 10–35 generated lockfile churn |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

**Scope boundary (enforced):** the final authored diff MUST contain only
`package.json`, `bun.lock`, `biome.json`, and `.github/workflows/ci.yml`. No
source, test, script, documentation, or WIP file content may change. If a green,
meaningful lint baseline cannot be produced on the unchanged allowlist within the
300-line authored budget without per-file suppressions, source cleanup, or format
changes, **STOP for scope revision** — do not work around the budget.

---

## Strict-TDD notes

Strict TDD is active (`config.yaml`). This change is configuration-only, so the
"failing test / passing test" evidence is the differential lint proof, not a Vitest
unit. Sequence: initial meaningful policy check → RED (temporary in-scope violation
fails `bun run lint`) → restore → GREEN. The mandatory stop condition below applies
at RED and at the initial policy check.

> **Mandatory stop:** if `bun run lint` does not exit 0 on the unchanged source
> tree with the exact ruleset below, OR Biome 2.3.15 rejects any rule name/schema
> field, STOP for design/scope revision. Never add per-file ignores, reformat, fix
> source, or disable the meaningful RED rule to force green.

---

## RED — baseline discovery and preflight

- [x] Preflight / overlap guard: run `git status --porcelain` and `git diff --stat`, and record the changed-path set. Verify `package.json`, `bun.lock`, `biome.json` (absent), and `.github/workflows/ci.yml` have no unrelated uncommitted edits, and that no active/WIP change under the lint allowlist exists that would make baseline evidence measure WIP. Abort if overlap is detected. <!-- sdd-owner: implementation -->
- [x] Confirm baseline test/typecheck state for later comparison: run `bun run typecheck` and `bun run test`, and record the exact result (expected baseline: typecheck passes; test shows the known three failures in `cmd/__tests__/cli.test.ts`). <!-- sdd-owner: implementation -->
- [x] Record initial lint baseline findings (once available) verbatim in apply/verify evidence, before any rule tuning. Baseline informs config only; it never triggers source edits. <!-- sdd-owner: implementation -->

## GREEN — implement the gate

- [x] Pin the linter: add `"@biomejs/biome": "2.3.15"` (exact, range-free) to `devDependencies` in `package.json`, leaving all other dependencies, overrides, metadata, and scripts byte-for-byte unchanged. <!-- sdd-owner: implementation -->
- [x] Regenerate the lockfile with Bun 1.3.11 (`bun install`), accepting only: the root `devDependencies` entry for `@biomejs/biome@2.3.15`, the Biome package entry and its required platform-specific optional packages, and their integrity/resolution metadata. Reject any unrelated re-resolution, upgrade/downgrade, override change, or lockfile-version change. Do not hand-edit lock records. <!-- sdd-owner: implementation -->
- [x] Create root `biome.json` as the single lint policy: `$schema` `https://biomejs.dev/schemas/2.3.15/schema.json`; `files.includes` = the exact positive allowlist (`receipts/**/*.ts`, `ledger/**/*.ts`, `missions/**/*.ts`, `candidates/**/*.ts`, `review/**/*.ts`, `gates/**/*.ts`, `recovery/**/*.ts`, `tenant-core/**/*.ts`, `tenant-isolation/**/*.ts`, `agents/**/*.ts`, `cmd/**/*.ts`, `contracts/__tests__/**/*.ts`, `evidence/**/*.ts`, `skills/**/*.ts`, `security/**/*.ts`, `guardian/**/*.ts`, `adapters/**/*.ts`, `flow/**/*.ts`, `vitest.config.ts`, `scripts/*.mjs`); `formatter.enabled: false`; `linter.enabled: true` with `rules.recommended: false`, `correctness.noUnusedImports: "error"`, and `suspicious` = `noDebugger`, `noDoubleEquals`, `noDuplicateObjectKeys` all `"error"`. No `lint:fix`, `--write`, `--fix`, or `--unsafe` variants, no console rule in Slice A, and no finding-derived per-file ignores. <!-- sdd-owner: implementation -->
- [x] Add package scripts in `package.json` beside `typecheck`/`test`: `"lint": "biome --version && biome lint"`. Do not add `lint:fix`, `format`, `check`, or write-capable variants. Leave existing scripts untouched. <!-- sdd-owner: implementation -->
- [x] Add an isolated `lint` job to `.github/workflows/ci.yml` immediately after `typecheck` and before `test`, mirroring the existing job convention exactly: `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4` with `persist-credentials: false`, `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2` with `bun-version: "1.3.11"`, then `bun install --frozen-lockfile`, then `bun run lint`. Do not modify existing jobs, triggers, permissions, action pins, or release steps. <!-- sdd-owner: implementation -->
- [x] Run `bun run lint` on the unchanged tree. Require it to print version `2.3.15` and exit 0. A non-zero result is a design STOP (see mandatory stop), not a cue to cleanup or ignores. <!-- sdd-owner: implementation -->
- [x] Run `bun install --frozen-lockfile`; require exit 0 with `package.json` and `bun.lock` unchanged. Re-run `bun run lint` after frozen install and confirm exit 0 (reproducibility proof). <!-- sdd-owner: implementation -->

## TRIANGULATE — differential proof

- [x] RED proof: temporarily add one syntactically valid unused import to an unchanged, in-scope shipped library `.ts` module (e.g. `review/lenses.ts` or `missions/versioning.ts`). Run `bun run lint`; require exit non-zero, the file location, and `lint/correctness/noUnusedImports` in the diagnostic. <!-- sdd-owner: implementation -->
- [x] Restore the temporary RED edit exactly and prove no residual source diff remains (`git status --porcelain` / `git diff` clean for source files). Re-run `bun run lint`; require version `2.3.15` and exit 0 (revert restores green). <!-- sdd-owner: implementation -->
- [x] Scope probe (out-of-scope isolation): temporarily place a construct the enabled rules would flag in an out-of-scope path (e.g. a scratch Markdown or `openspec/` file); run `bun run lint` and require it reports nothing from that path. Delete the scratch file and confirm it is not retained. Do not add an ignore for it. <!-- sdd-owner: implementation -->

## REFACTOR / preservation — no churn, budget, rollback

- [x] No-format / no-source-churn proof: compare source, test, script, and doc path content/mode before and after the lint run (Git diff or hashes). Require no content or mode change and no residual temporary RED edit. Confirm no formatter or write-capable Biome command was executed at any stage. <!-- sdd-owner: implementation -->
- [x] Preservation proof: run `bun run typecheck` and `bun run test` again and compare to the recorded baseline — typecheck result unchanged and the same three known `cmd/__tests__/cli.test.ts` failures, with no added, hidden, or removed outcome. <!-- sdd-owner: implementation -->
- [x] Budget count: count authored additions plus deletions for `package.json`, `biome.json`, and `.github/workflows/ci.yml`, excluding `bun.lock` churn. Record the number and the final changed-path list. Require `<=300` (forecast 68–88). If exceeded, STOP for scope revision — never use source cleanup or ignores to recover budget. <!-- sdd-owner: implementation -->
- [x] Rollback boundary: record that the gate is one bounded work unit — delete `biome.json`, remove the `lint` script and the `@biomejs/biome` devDependency from `package.json`, revert only the corresponding `bun.lock` entries, and remove the CI `lint` job. No application bytes require restoration. <!-- sdd-owner: implementation -->

---

## Parent-owned actions (post-apply)

- [ ] After apply completes and evidence is recorded, run one bounded review of the four-file config diff (`package.json`, `bun.lock`, `biome.json`, `.github/workflows/ci.yml`) — verify scope boundary, exact 2.3.15 pin, formatter disabled, positive allowlist, no per-file ignores, no `lint:fix`, and the preserved typecheck/test baseline. <!-- sdd-owner: parent -->
- [ ] Verify the final authored changed-line count is at or below 300 (excluding `bun.lock` churn) and no source/test/script/doc/WIP file content changed; confirm CI equivalence of the `lint` job. <!-- sdd-owner: parent -->
- [ ] Lifecycle gate: confirm `bun run lint` exits 0 on the candidate, the three known CLI test failures remain the only test failures, and the single rollback boundary is documented before merging the single PR. <!-- sdd-owner: parent -->
