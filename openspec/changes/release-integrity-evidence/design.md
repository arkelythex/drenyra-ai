# Technical Design — Release Integrity Evidence

## Scope and constraints

This design implements only the independent `release-integrity-evidence` slice in the repository release/package layer. It does not share code, tests, paths, or delivery state with blocked `gentle-ai-quality-parity` Slice A. Signing, provenance, key management, lockfile resolution, new release commands, new CI jobs/runners, broad refactors, generated `dist/` files, unrelated baseline fixes, and unrelated WIP are rejected.

The implementation is one rollback-safe work unit and has a hard authored implementation ceiling of 300 additions plus deletions. Crossing that ceiling stops apply for re-scoping; there is no exception.

## Decisions

### 1. Keep three executable scripts; add no framework or shared abstraction

- `scripts/sbom.mjs` remains the SBOM generator.
- `scripts/checksums.mjs` remains the checksum generator.
- New `scripts/verify-release-integrity.mjs` verifies both artifacts.

The scripts remain plain Node ESM executables. Tests exercise their CLI boundary through subprocesses and copied temporary fixtures, so production code needs no test-only root flag, environment override, dependency injection layer, or public API. `scripts/verify-package-files.mjs` is not modified: its package-layout responsibility stays separate from evidence consistency.

### 2. Resolve the root from each script, never from cwd

Every executable derives the same repository root as:

```js
const root = dirname(dirname(fileURLToPath(import.meta.url)));
```

All accesses use `join(root, "package.json")` and `join(root, "dist", ...)`. `process.cwd()` is not used for evidence paths. A subprocess may therefore start in any cwd without changing inputs or outputs.

### 3. Define canonical, byte-stable output

SBOM generation:

1. Read and parse the script-relative `package.json`.
2. Require string `name` and `version`; require `dependencies`, when present, to be an object of string declared ranges.
3. Sort dependency names with default Unicode/code-point ordering, not locale-sensitive comparison.
4. Construct CycloneDX 1.5 fields in fixed insertion order.
5. Omit `metadata.timestamp`; CycloneDX permits omission and no wall clock enters the bytes.
6. Serialize with `JSON.stringify(value, null, 2) + "\n"` as UTF-8.

The component `version` is the declared `package.json` range. This design makes no resolved-version claim.

Checksum generation:

1. Recursively enumerate regular files beneath script-relative `dist/`.
2. Reject unreadable entries, unsupported entry types, and symbolic links rather than following them outside `dist/`.
3. Normalize relative names to `/`, sort them by code point, and exclude exactly `checksums.txt`.
4. Include `sbom.json` and every other regular packaged file.
5. Emit lowercase SHA-256 lines as `<64 hex><two spaces><relative path>\n`, including one final LF.

No temporary or generated evidence is committed.

### 4. Pin generation order and self-exclusion

The only generation order is:

```text
build dist -> run existing tests -> verify package files -> generate sbom.json -> generate checksums.txt -> verify release integrity
```

`sbom.json` is generated before enumeration, so it is covered. `checksums.txt` is always excluded from its own manifest, including during regeneration. No other file is excluded. Regeneration over identical inputs therefore yields the same path set and bytes.

### 5. Fail closed with stable script-owned errors

Each CLI has one top-level `try/catch`. Any filesystem, parse, schema-shape, coverage, or digest error writes one clear prefixed message to stderr (`sbom:`, `checksums:`, or `verify-release-integrity:`) and sets a non-zero exit code. Error text names the relevant input or relative file. Raw stack traces are not the contract.

Generators perform all required reads and validation before their final evidence write. The npm chain uses `&&`, so a failed stage prevents every later packaging stage and cannot report success. Existing stale evidence is never accepted because successful packaging always regenerates and then verifies it.

## Verifier contract and algorithm

`verify-release-integrity.mjs` uses only Node built-ins and script-relative paths:

1. Read and parse `package.json`; validate the same minimal manifest shape used by SBOM generation.
2. Read and parse `dist/sbom.json`; require an object with `bomFormat: "CycloneDX"`, `specVersion: "1.5"`, and a `components` array.
3. Index SBOM components by name. Reject malformed or duplicate component names. For every declared runtime dependency, require one `type: "library"` component with the exact declared range as `version`. Extra valid components are tolerated; lockfile fidelity is neither read nor asserted.
4. Read `dist/checksums.txt`. Require non-empty, LF-delimited records matching `^[0-9a-f]{64}  <path>$`; reject blank interior records, duplicates, absolute paths, backslashes, `.`/`..` traversal, and `checksums.txt` self-reference.
5. Enumerate the actual regular-file set under `dist/` with the same traversal rules as generation, excluding only `checksums.txt`. Compare sorted sets exactly. This detects both missing coverage and manifest entries for absent files and requires `sbom.json` coverage.
6. For each sorted manifest entry, read the file, compute SHA-256, and compare it with the recorded digest.
7. Print a concise success line only after every check passes; otherwise exit non-zero at the first deterministic validation failure.

This is consistency evidence, not authenticity evidence: checksums detect mismatch but are not signatures.

## Package and CI placement

`package.json` adds:

- `release:generate`: `node scripts/sbom.mjs && node scripts/checksums.mjs`
- `verify:release-integrity`: `node scripts/verify-release-integrity.mjs`

`verify:package` keeps its existing build, full test, and package-file checks, then invokes `release:generate` followed by `verify:release-integrity`. Generation therefore occurs only after build output exists, and package verification cannot succeed without valid evidence. `prepack` and `prepublishOnly` inherit the gate through their existing `verify:package` dependency.

In `.github/workflows/ci.yml`, only the existing `package` job's current `verify:package` step is given an attributable name such as `Verify package and release-integrity evidence`; it continues to run `bun run verify:package`. No workflow, runner, job, parallel branch, or duplicate verifier invocation is added. The script's success/failure line is the job evidence.

## Data flow

```text
script location
  -> repository root
  -> package.json declared metadata/dependencies
  + built dist regular files
  -> sbom.json (fixed JSON, no clock)
  -> checksums.txt (sorted files, includes SBOM, excludes self)
  -> verifier
       package.json <-> SBOM declared-dependency coverage
       dist file set <-> checksum path set
       file bytes <-> SHA-256 values
  -> exit 0 only when all relationships hold
  -> existing verify:package -> existing CI package job / prepack / prepublishOnly
```

## Strict TDD plan

Tests live in one new `scripts/__tests__/release-integrity.test.ts`. A fixture helper creates a temporary mini repository, copies the three actual scripts beneath its `scripts/`, writes a minimal `package.json` and `dist/`, and invokes each script from a different temporary cwd. Cleanup is unconditional.

1. **RED:** before production edits, run `bun run test -- scripts/__tests__/release-integrity.test.ts`. Tests must fail for wall-clock SBOM bytes, cwd-relative resolution, self-inclusion/regeneration, absent verifier, and fail-open/opaque errors.
2. **GREEN:** make only the script and wiring changes below; rerun the same focused command.
3. **TRIANGULATE:** cover a second partial-data class beyond the initial mismatch (duplicate/path-traversal manifest entry or malformed component), then rerun focused tests.
4. **REFACTOR:** remove duplication only within the test helper or local script functions; do not introduce a shared framework or broaden paths.
5. **Integration evidence:** run `bun run verify:package`, `bun run typecheck`, and the applicable full test command. Record exact outputs. The known `cmd/__tests__/cli.test.ts` baseline failures, if still present, remain unchanged and are reported separately; they are not fixed, skipped, or presented as release-integrity success.
6. **Final audits:** count authored additions plus deletions; require `<=300`. Audit changed paths against the allowlist and confirm generated `dist/sbom.json` and `dist/checksums.txt` remain untracked.

Focused cases pin: two byte-identical generations; non-repository cwd; missing `dist`; missing/unreadable or malformed `package.json`; SBOM-before-checksums order; checksum self-exclusion and SBOM inclusion; valid verification; malformed SBOM; omitted dependency; digest mismatch; missing checksum entry; absent listed file; and one traversal/duplicate triangulation case.

## Exact implementation allowlist

Apply may modify only:

1. `scripts/sbom.mjs`
2. `scripts/checksums.mjs`
3. `scripts/verify-release-integrity.mjs` (new)
4. `scripts/__tests__/release-integrity.test.ts` (new)
5. `package.json`
6. `.github/workflows/ci.yml` (existing `package` job step only)

OpenSpec phase artifacts may be updated only by their owning SDD phases. No `dist/**`, lockfile, `scripts/verify-package-files.mjs`, Slice A path, `cmd/__tests__/cli.test.ts`, listed WIP path, or other source/test/CI file is allowed. If implementation needs another path, stop and re-scope before editing.

## Conservative authored-line forecast

| File/area | Maximum changed lines |
| --- | ---: |
| `scripts/sbom.mjs` | 28 |
| `scripts/checksums.mjs` | 38 |
| new verifier | 72 |
| focused test + fixture helper | 132 |
| `package.json` | 12 |
| existing CI package step | 4 |
| **Forecast ceiling** | **286** |

The 286-line forecast leaves 14 lines of hard reserve. Additions and deletions both count; generated artifacts do not. Tasks must preserve these per-file caps and stop before 300 rather than consume an exception.

## Rollout and rollback

No migration or compatibility flag is needed. The gate becomes active wherever existing `verify:package` already runs. CI remains the first shared proof, followed by the unchanged package publication hooks. Rollback removes the two package scripts and package-step naming/wiring, deletes the verifier and focused test, and reverts only the two generator edits. Gitignored evidence needs no cleanup or migration.
