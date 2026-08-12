# Technical Design — Reproducible Lint Gate, Slice A

## Design objective

Introduce one read-only, exact-versioned Biome lint gate without changing source, tests, scripts, documentation, TypeScript settings, or existing test behavior. The implementation is one rollback-safe work unit limited to `package.json`, `bun.lock`, `biome.json`, and `.github/workflows/ci.yml`.

CodeGraph intelligence was unavailable to this executor, so this design uses targeted reads of the proposal, lint-gate specification, package manifest, TypeScript scope, Bun lockfile, CI workflow, and targeted OpenSpec overlap search rather than broad repository mapping.

## Decisions

### Tool version and loading

Pin exactly:

```json
"@biomejs/biome": "2.3.15"
```

No caret, tilde, tag, catalog, global install, `bunx`, or CI-only install is permitted. Bun package scripts resolve `biome` from the project dependency, and the committed `bun.lock` binds its platform packages. The local and CI entry point is the same package script:

```json
"lint": "biome --version && biome lint"
```

The version prelude makes the resolved version visible in local and CI evidence; the second command is read-only lint analysis. Do not add `lint:fix`, `format`, `check`, `--write`, `--fix`, or `--unsafe` variants.

### Exact minimal `biome.json`

Use this policy as written initially:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.15/schema.json",
  "files": {
    "includes": [
      "receipts/**/*.ts",
      "ledger/**/*.ts",
      "missions/**/*.ts",
      "candidates/**/*.ts",
      "review/**/*.ts",
      "gates/**/*.ts",
      "recovery/**/*.ts",
      "tenant-core/**/*.ts",
      "tenant-isolation/**/*.ts",
      "agents/**/*.ts",
      "cmd/**/*.ts",
      "contracts/__tests__/**/*.ts",
      "evidence/**/*.ts",
      "skills/**/*.ts",
      "security/**/*.ts",
      "guardian/**/*.ts",
      "adapters/**/*.ts",
      "flow/**/*.ts",
      "vitest.config.ts",
      "scripts/*.mjs"
    ]
  },
  "formatter": {
    "enabled": false
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": false,
      "correctness": {
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noDebugger": "error",
        "noDoubleEquals": "error",
        "noDuplicateObjectKeys": "error"
      }
    }
  }
}
```

This is deliberately smaller than Biome's recommended preset: one correctness rule with a differential RED target and three low-noise suspicious defect rules. It does not adopt style, complexity, nursery, accessibility, security, or formatting presets. TypeScript remains authoritative for compiler diagnostics.

No console rule is enabled in Slice A. That avoids false positives in `cmd/` and `scripts/` without adding override machinery or pretending console ownership has been fully classified. If a later slice adopts `noConsole`, it must positively scope shipped library modules and leave `cmd/**` and `scripts/*.mjs` outside that rule; per-file suppressions remain forbidden.

The positive `files.includes` list is the allowlist and therefore the ignore boundary. Everything not listed is excluded, including Markdown, YAML, non-policy JSON, `node_modules/`, `dist/`, coverage/build/generated output, fixtures, repository metadata, OpenSpec, and unrelated directories. Do not add broad `**/*` inputs followed by ignores. Do not add finding-derived file exclusions. `biome.json` is consumed as configuration but is not a lint target.

If Biome 2.3.15 rejects any stated rule name/schema field, or any selected rule is red on the unchanged allowlist, implementation stops for design/scope revision. It must not make source fixes, add suppressions, exclude violating files, or silently disable the meaningful RED rule. This fail-closed point preserves the requirement that the first landed gate is both meaningful and green.

## Package and lockfile contract

Add `lint` beside the existing `typecheck`/`test` quality scripts and add the exact dependency in `devDependencies`; leave all existing scripts, dependency ranges, overrides, package metadata, and TypeScript files byte-for-byte unchanged.

Generate the lock change with Bun 1.3.11 using the exact package request. Accept only:

- the root workspace `devDependencies` entry for `@biomejs/biome` at `2.3.15`;
- the Biome package entry and platform-specific optional packages required by that exact release;
- integrity/resolution metadata generated for those entries.

Reject unrelated re-resolution, package upgrades/downgrades, override changes, lockfile-version changes, or hand-edited lock records. Prove `bun install --frozen-lockfile` exits 0 and leaves `package.json` and `bun.lock` unchanged.

## CI placement

Add an isolated `lint` job immediately after `typecheck` and before `test` in `.github/workflows/ci.yml`. It mirrors the existing job convention exactly:

```yaml
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
        with:
          bun-version: "1.3.11"
      - run: bun install --frozen-lockfile
      - run: bun run lint
```

Do not modify existing jobs, triggers, permissions, action pins, or package/release steps. A separate job gives lint its own required-check identity and prevents known test failures from obscuring lint status.

## Data flow and contracts

```text
package.json exact pin + bun.lock
  -> Bun 1.3.11 frozen install
  -> local project biome binary (version printed)
  -> root biome.json
  -> positive JS/TS allowlist
  -> diagnostics + process exit code
  -> identical bun run lint in local and CI contexts
```

Exit `0` means every enabled rule passed for every allowlisted file. Any error diagnostic produces non-zero and fails the CI job. Lint has no write path and no runtime/application data flow.

## Strict TDD and evidence plan

Record exact commands, exit codes, relevant diagnostics, and pre/post Git state in apply/verify artifacts.

1. **Preflight / overlap guard:** before changing anything, capture status and changed paths. Abort if any of the four owned files has unrelated edits, or if uncommitted/active-change work exists under the lint allowlist such that baseline evidence would measure WIP. Do not ignore active paths in Biome to work around overlap. The targeted OpenSpec scan found historical/other references to `package.json` and CI, but no authority to modify another change; current Git state is decisive.
2. **Initial meaningful policy check:** install the exact dependency and create the exact policy/script in the implementation transaction, then run `bun run lint`. It must print `2.3.15` and exit 0 on unchanged source bytes. A non-zero baseline is a design stop, not an invitation to cleanup or ignores.
3. **RED:** temporarily add one syntactically valid unused import to an unchanged, in-scope shipped library `.ts` module. Run `bun run lint`; require non-zero, the file location, and `lint/correctness/noUnusedImports`.
4. **Restore:** revert that temporary source edit exactly. Prove no source diff remains.
5. **GREEN:** run `bun run lint` again; require version `2.3.15` and exit 0.
6. **Reproducibility:** run `bun install --frozen-lockfile`; require exit 0 and no lock/manifest mutation. Run lint once more after frozen install.
7. **Preservation:** run `bun run typecheck` and record its unchanged result. Run `bun run test`; require the same known three failures in `cmd/__tests__/cli.test.ts`, with no added, hidden, or removed outcome. Those known failures are evidence, not a reason to weaken lint or tests.
8. **No-write proof:** compare source/test/script/doc path hashes or Git diff before and after lint; require no content or mode change and no residual temporary RED edit. Timestamp preservation should be checked where the harness can observe it.
9. **Scope probes:** temporarily place or use a violation in an out-of-scope scratch/OpenSpec or Markdown path and show it is not reported; do not retain that file. Confirm an in-scope violation is reported by the RED proof.
10. **CI equivalence:** inspect the workflow and, when the candidate runs remotely, record the green `lint` job using frozen install and `bun run lint`.
11. **Budget:** count authored additions plus deletions for `package.json`, `biome.json`, and CI separately from generated `bun.lock` churn. Require `<=300`.

No formatter or write-capable Biome command is run at any stage.

## File changes and rollback

| File | Change | Conservative authored forecast |
| --- | --- | ---: |
| `package.json` | one script and one exact devDependency | 2–4 lines |
| `biome.json` | new allowlist and four-rule lint-only policy | 55–70 lines |
| `.github/workflows/ci.yml` | isolated lint job | 11–14 lines |
| `bun.lock` | generated exact Biome resolution only | generated; estimate 10–35 lines |
| **Authored total excluding lockfile** |  | **68–88 lines** |

Even counting forecast lock churn, the slice should remain well below 150 changed lines and has substantial margin under the 300 authored-line ceiling. Unexpected lock churn or policy growth above the forecast triggers inspection; source cleanup is never used to recover budget.

Rollback deletes `biome.json`, removes only the lint script and Biome devDependency, reverts only Biome lock entries, and removes only the lint job. It does not restore or coordinate application bytes because none may change.

## Rejected scope

Reject formatting or format checks; lint fixes/write mode; broad code cleanup; source/test/script/doc edits other than the fully reverted RED mutation; Markdown/YAML/non-policy JSON linting; ESLint/Prettier/markdownlint; TypeScript relaxation; repair of known CLI test failures; changes to other OpenSpec artifacts or active-change work; transient/per-file ignores; generated baselines; and any second lint policy or fix script.
