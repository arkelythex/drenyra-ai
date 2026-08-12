# Apply Progress — Reproducible Lint Gate, Slice A

## Status: BLOCKED — preflight/overlap guard failed (design-mandated stop)

The first implementation task (preflight/overlap guard) is a hard abort gate in the
approved artifacts: tasks.md task 1 ("Abort if overlap is detected") and design.md
preflight step 1 ("Abort if any of the four owned files has unrelated edits, or if
uncommitted/active-change work exists under the lint allowlist such that baseline
evidence would measure WIP. Do not ignore active paths in Biome to work around
overlap. ... current Git state is decisive").

The current Git state fails that guard on both conditions. **No file was edited, no
command was run that mutates anything, and no task checkbox was changed.** This
record is written only to persist the blocked preflight evidence.

## Evidence (captured verbatim)

`git status --porcelain` (truncated to relevant rows; full set recorded below):

```text
 M .github/workflows/ci.yml
 M cmd/__tests__/capabilities-doctor.test.ts
 M cmd/adapters/schema-loader.ts
 M cmd/commands/capabilities.ts
 M cmd/commands/doctor.ts
 M cmd/commands/mcp-serve.ts
 M mcp/__tests__/server.test.ts
 M mcp/__tests__/stdio.test.ts
 M mcp/tools.ts
 M missions/__tests__/postgres.integration.test.ts
 M openspec/changes/fiscal-authority-kernel/apply-progress.md
 M openspec/config.yaml
 M openspec/programs/drenyra-dominion/capability-matrix.yaml
 M package.json
 M scripts/checksums.mjs
 M scripts/sbom.mjs
 M skills/__tests__/pe-skills.test.ts
 ?? cmd/adapters/package-metadata.ts
 ?? cmd/declared-surface.ts
 ?? openspec/changes/gentle-ai-quality-parity/
 ?? openspec/changes/release-integrity-evidence/
 ?? openspec/changes/reproducible-lint-gate/
 ?? scripts/__tests__/
 ?? scripts/verify-release-integrity.mjs
```

`git diff --stat` summary: 17 files changed, 297 insertions(+), 166 deletions(-)
(scope: release-integrity-evidence and gentle-ai-quality-parity WIP, plus
pre-existing WIP docs/tests).

### Failure condition 1 — owned files carry unrelated uncommitted edits

- `package.json` — modified: adds `release:generate`, `verify:release-integrity`
  scripts and extends `verify:package` (release-integrity-evidence WIP, unrelated to
  this slice).
- `.github/workflows/ci.yml` — modified: renames the package-job step to
  "Verify package and release-integrity evidence" (release-integrity-evidence WIP,
  unrelated to this slice).
- `bun.lock` — clean (no edits). `biome.json` — absent (as expected).

Editing these owned files on top of unrelated uncommitted edits would entangle this
slice's diff with another change's diff, violating the scope boundary ("final
authored diff MUST contain only package.json, bun.lock, biome.json, and
.github/workflows/ci.yml" for THIS slice's changes) and the "no WIP file content
may change" rule.

### Failure condition 2 — WIP under the lint allowlist would be measured by baseline evidence

The lint allowlist includes `cmd/**/*.ts`, `missions/**/*.ts`, `skills/**/*.ts`,
`scripts/*.mjs`, `evidence/**/*.ts`, etc. Uncommitted WIP under those paths today:

- `cmd/__tests__/capabilities-doctor.test.ts`, `cmd/adapters/schema-loader.ts`,
  `cmd/commands/capabilities.ts`, `cmd/commands/doctor.ts`, `cmd/commands/mcp-serve.ts`
  (modified), `cmd/adapters/package-metadata.ts`, `cmd/declared-surface.ts` (untracked)
  — gentle-ai-quality-parity Slice A WIP.
- `missions/__tests__/postgres.integration.test.ts` (modified) — pre-existing WIP.
- `scripts/checksums.mjs`, `scripts/sbom.mjs` (modified),
  `scripts/__tests__/`, `scripts/verify-release-integrity.mjs` (untracked) —
  release-integrity-evidence WIP.
- `skills/__tests__/pe-skills.test.ts` (modified) — pre-existing WIP.

A `bun run lint` baseline against this tree would measure WIP content, so the
"green on the unchanged tree" proof and the RED/GREEN differential would not
represent the committed baseline. Ignoring those paths in `biome.json` to work
around the overlap is explicitly prohibited.

## Decision

**STOP before editing** (status `blocked`, `next_recommended: parent-lifecycle`).
No implementation work was started; no tasks were completed; no persisted task
checkbox changed (all 17 implementation-owned rows remain `- [ ]`; the 3
parent-owned rows are untouched).

## Required resolution options for the parent

1. Commit or stash the unrelated uncommitted work (release-integrity-evidence and
   gentle-ai-quality-parity WIP, including the `package.json` and `ci.yml` edits) so
   the owned files and allowlisted paths are clean, then re-launch apply; or
2. Explicitly authorize apply against the dirty tree with a documented scope
   amendment to the preflight guard (requires amending the approved tasks/design).

## Commands run (all read-only)

- `git status --porcelain`, `git diff --stat`, `git diff package.json`,
  `git diff .github/workflows/ci.yml`, `git branch --show-current`,
  `git log --oneline -5`
- `gentle-ai sdd-status reproducible-lint-gate --cwd . --json --instructions`
  (authoritative native status: `applyState: ready`; task-level preflight guard
  overrides to blocked per approved artifacts)

## Files changed

None (apply-progress.md itself is this change's own artifact record, which is
expected under `openspec/changes/reproducible-lint-gate/`).

## Remaining tasks

All 17 implementation-owned tasks remain unchecked, starting with:
`- [ ] Preflight / overlap guard: ... Abort if overlap is detected. <!-- sdd-owner: implementation -->`
