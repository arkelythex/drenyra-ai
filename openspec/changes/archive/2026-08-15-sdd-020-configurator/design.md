# SDD-020 — Universal Agent Configurator First-Slice Design

## Summary

This slice adds a package-level managed composition transition core beneath thin CLI adapters, then uses the same managed-state reader for read-only doctor diagnostics. The authoritative file remains `~/.drenyra/managed.json` (or `<--home>/.drenyra/managed.json`). New manifests contain a versioned composition record; legacy manifests remain readable and are migrated only by install or a real upgrade transition.

The implementation is local and offline. An upgrade target must be the version of the package currently executing the command. The command does not download packages, invoke a host, or resolve `program-lock`.

## Decisions

| Decision | Resolution | Rationale |
| --- | --- | --- |
| Library placement | Add `configurator/managed-config.ts` as a root library module. It owns manifest validation, legacy hydration, transition planning/commit, exact managed-asset bytes and hashes, and read-only diagnostics. | Root library modules are below `agents/` and `cmd/` in the repository model. This keeps deterministic rules out of `cmd/commands/*` and prevents reverse imports. One cohesive module is proportionate for the first slice; split storage/transitions/diagnostics only when later host-specific or `program-lock` behavior makes those concerns independently large. |
| Existing command ownership | Keep `cmd/commands/install.ts` and `sync.ts` as adapters over the new library exports; add thin `upgrade.ts` and `rollback.ts`; let `doctor.ts` compose package-health checks with library-produced configuration checks. | Existing command files already resolve arguments, print JSON, and map exit codes. Moving managed-state rules below them fixes the current Design-03 layering without moving unrelated CLI concerns. |
| Composition location | Extend the existing `<home>/.drenyra/managed.json`; do not create a second state file. | `install` and `sync` already share this authority. A second file would create cross-file authority and atomicity ambiguity. |
| Composition payload | Store `composition.schemaVersion`, `composition.current`, and `composition.previous`. Each snapshot stores the package version, integer sequence, activation time, and exact expected UTF-8 bytes plus SHA-256 for the marker and skills asset. | Rollback must be possible without a network or an older installed package. Persisting prior expected bytes makes the immediately previous composition self-contained. Hashes allow exact drift checks through `node:crypto`; content permits restoration. |
| Legacy top-level fields | Retain `manager`, `version`, `installedAt`, `hosts`, and `assets`. `version` is a compatibility mirror of `composition.current.packageVersion`. | Existing `InstallManifest`, install/sync behavior, and tests read these fields. Additive schema evolution avoids breaking pre-slice readers and fixtures. |
| Upgrade target | Syntax is `upgrade run <package-version> [--home <dir>]`. The requested semantic version must equal `getPackageMetadata().version`; otherwise fail with `COMPOSITION_NOT_PACKAGED`. | This slice transitions to an already packaged composition and explicitly excludes downloads, `program-lock`, and host installation. Accepting an unavailable version would create a false pin. Package metadata already has a source/dist-safe owner in `cmd/adapters/package-metadata.ts`; the adapter injects its version into the library call. |
| Rollback token | Syntax is `rollback run [--home <dir>]`. | `install run`, `sync run`, and `doctor run` establish the dispatcher convention. Using `run` keeps command lookup and help consistent; bare top-level commands would require a special dispatcher path. |
| Rollback retention | On rollback, assign the persisted previous snapshot to current and leave previous unchanged. Mirror the restored version at top level. | After the first rollback, current and previous are equal. A repeated rollback is therefore an exact no-op while the previous composition remains persisted, satisfying rollback idempotency. The slice intentionally provides one-step restore, not toggling or history. |
| Upgrade idempotency | If requested version equals hydrated current version, return `status: "unchanged"` and perform no writes. Do not rewrite `previous`, timestamps, sequence, marker, skills, or manifest. | This follows the specification's stronger no-mutation rule. A legacy manifest is hydrated in memory for comparison; a same-version no-op does not rewrite it merely to migrate schema. |
| Real upgrade transition | For a different packaged target, set `previous` to the validated hydrated current snapshot and create current with `sequence = previous.sequence + 1`. All sequence/schema fields are JSON integers; versions remain strings. | This preserves exactly one verified predecessor and provides deterministic ordering without floating-point version fields. |
| Managed asset ownership | A file is safely replaceable only when its bytes exactly equal the current snapshot's expected bytes. Differing bytes are classified `preserved`; missing managed assets may be created for a host recorded as present. No unlisted path is considered. | This generalizes the existing `syncManaged` marker comparison and its foreign-change preservation rule to both `.drenyra-managed` and `.drenyra-skills.json`. |
| Atomic fail-closed commit | Validate the complete candidate manifest and all candidate asset bytes first. Stage same-directory temporary files, then commit only the allowlisted managed paths. Keep original bytes/existence in memory; on a synchronous commit failure, restore already-replaced assets and leave/restore the prior manifest. Commit the manifest last through temp-file + fsync + rename. | Candidate validation prevents malformed state from reaching disk. Same-directory rename follows the proven atomic-write pattern in `cmd/adapters/file-mission-store.ts`, but is implemented below `cmd/` rather than imported upward. Manifest-last makes the composition authority advance only after its derived assets succeed; compensating restoration prevents a handled failure from leaving mixed managed state. |
| Cryptography | Use only `createHash("sha256")` and, if needed for temp uniqueness, `randomUUID()` from `node:crypto`. | This satisfies the library cryptography restriction and avoids new dependencies. |
| Doctor report integration | Change `doctorCommand` to `doctorCommand(args: string[] = [])`, resolve `--home` with the existing rule, and append library checks to the existing `checks` array. Keep `{ status, checks, readonly: true }` unchanged. | Existing direct calls such as `capture(doctorCommand)` remain valid. Existing clean-checkout tests continue to pass because an absent manifest is `not-applicable`, not unhealthy; an existing malformed manifest is unhealthy. |
| Doctor check names | Append `managed-state`, `managed-drift`, `package-pin`, and `host-prerequisites`. Details are deterministic strings naming host and asset; pin mismatch states recorded and packaged versions. | Stable names preserve machine readability without changing each check's current `{name, ok, detail}` shape. Aggregate details keep the public schema additive and compact. |
| Prerequisite scope | Check only manifest hosts recorded with `present: true`. A now-absent config directory or missing marker/skills file is a failed prerequisite; a present file with different bytes is drift. | Existing install manifests list all known hosts, including undetected hosts with `present: false`. Treating every listed-but-never-installed host as required would degrade every normal installation. |
| Error mapping | Add `ManagedConfigError` recognition to `businessErrorOutput`. Known state failures emit JSON and exit 1; missing/invalid CLI arguments use `usageError` and exit 2; successful/unchanged transitions exit 0. Unexpected filesystem/IO failures exit 2 after the library restores prior state. | This follows `cmd/output/errors.ts`: 0 success, 1 business error, 2 usage/IO. It gives corrupt/missing state and missing rollback history stable machine codes instead of reducing them to an unclassified internal failure. |

## Managed-State Model

### File location

```text
home = value after --home, otherwise $HOME, otherwise process.cwd()
manifest = <home>/.drenyra/managed.json
```

Only the following managed host paths may be read or written:

```text
<recorded-present-host-config-dir>/.drenyra-managed
<recorded-present-host-config-dir>/.drenyra-skills.json
```

### Additive JSON shape

```json
{
  "manager": "drenyra-ai",
  "version": "1.4.0",
  "installedAt": "2026-03-01T00:00:00.000Z",
  "hosts": [
    { "name": "claude-code", "configDir": "/home/u/.claude", "present": true }
  ],
  "assets": ["skills"],
  "composition": {
    "schemaVersion": 1,
    "current": {
      "packageVersion": "1.4.0",
      "sequence": 1,
      "activatedAt": "2026-03-02T00:00:00.000Z",
      "managedAssets": {
        "marker": {
          "sha256": "<64 lowercase hex characters>",
          "content": "<exact UTF-8 file content>"
        },
        "skills": {
          "sha256": "<64 lowercase hex characters>",
          "content": "<exact UTF-8 file content>"
        }
      }
    },
    "previous": {
      "packageVersion": "1.2.3",
      "sequence": 0,
      "activatedAt": "2026-03-01T00:00:00.000Z",
      "managedAssets": {
        "marker": {
          "sha256": "<64 lowercase hex characters>",
          "content": "<exact UTF-8 file content>"
        },
        "skills": {
          "sha256": "<64 lowercase hex characters>",
          "content": "<exact UTF-8 file content>"
        }
      }
    }
  }
}
```

`previous` is `null` for a newly installed composition with no predecessor. `schemaVersion` and `sequence` are non-negative JSON integers. Version fields are validated semantic-version strings and are never parsed into JSON numbers. Asset hashes must equal the SHA-256 of their exact stored `content`; a mismatch invalidates the manifest before mutation.

Host `configDir` values from the manifest are not accepted as arbitrary write targets. The library re-derives each path from the injected home and the fixed host-name mapping, then requires it to match the normalized recorded path. This prevents a malformed manifest from redirecting writes outside the three known host directories.

### Legacy hydration

A pre-slice manifest is valid when its existing required fields have the expected types, `manager` is `drenyra-ai`, and `version` is a semantic-version string. Its in-memory current snapshot is derived as follows:

- `packageVersion = manifest.version`
- `sequence = 0`
- `activatedAt = manifest.installedAt`
- marker content is the legacy deterministic marker `{ manager, installedAt }`
- skills content is read only from a present, byte-consistent managed skills asset; if no recorded-present host can provide a valid prior managed copy, a real transition fails closed rather than inventing rollback bytes
- hashes are recomputed with SHA-256
- `previous = null`

`install`, `sync`, and doctor continue to read this shape. A real upgrade persists the derived snapshot as `previous` and the packaged target as `current`. A same-version upgrade remains a no-write idempotent result.

### Transition semantics

1. Read and fully validate the manifest; distinguish `absent`, `invalid`, `legacy`, and `current-schema`.
2. Hydrate a validated current snapshot. No mutation occurs during hydration.
3. For upgrade, validate target semantic version and require it to equal the injected packaged version. For rollback, require a validated previous snapshot.
4. Detect idempotency before generating timestamps or temporary files.
5. Build exact target marker/skills bytes and a candidate manifest in memory. Preserve any existing managed asset whose bytes differ from the expected current bytes, and report it.
6. Validate candidate schema, integer fields, hashes, path allowlist, and top-level version mirror.
7. Stage and commit allowlisted changes. On a handled failure, restore originals and return an IO failure; never publish the candidate manifest alone.
8. Emit deterministic JSON. Volatile timestamps are persisted only for real transitions and are not added to unchanged reports.

Upgrade reports use `{ status: "upgraded" | "unchanged", from, to, results }`; rollback reports use `{ status: "rolled-back" | "unchanged", from, to, results }`. Each result names the host, asset, and `updated | created | preserved | missing` action. The ordering is fixed by the existing host order and then marker before skills.

### Rollback idempotency example

```text
before upgrade: current=A, previous=null
upgrade to B:   current=B, previous=A
rollback:       current=A, previous=A
rollback again: current=A, previous=A  (zero writes)
```

A later real upgrade from restored A to C records A as previous and C as current. This is one-level recovery, not an unbounded history.

## Doctor Diagnostics

The existing package checks remain in their current order. Configuration checks are appended and are read-only:

- `managed-state`: healthy when no manifest exists (`not applicable`) or when the existing manifest validates; failed when an existing manifest is unreadable or malformed.
- `managed-drift`: for each recorded-present host and each present managed asset, hash and byte-compare against `composition.current.managedAssets`; legacy manifests compare against their hydrated legacy expectations. Detail lists `host:asset` pairs.
- `package-pin`: compare `composition.current.packageVersion` (or hydrated legacy `version`) with `getPackageMetadata().version`; detail includes both values on mismatch.
- `host-prerequisites`: require the config directory and both expected managed assets only for hosts recorded `present: true`; detail lists each `host:item` missing pair.

When no managed manifest exists, all configuration checks are represented as passing/not-applicable checks so the existing clean-checkout assertion that every check is `ok` remains true. Any failed configuration check changes only `status` to `degraded`, preserves `readonly: true`, and returns 1; it performs no repair.

## Exit and Failure Matrix

| Condition | Exit | Output/mutation |
| --- | ---: | --- |
| Real upgrade or rollback | 0 | Deterministic JSON report; allowlisted managed state only |
| Idempotent upgrade/rollback | 0 | Deterministic JSON report; zero writes |
| Missing/malformed/unreadable manifest | 1 | `ManagedConfigError` JSON (`MANAGED_STATE_UNKNOWN`); zero writes |
| Rollback has no previous snapshot | 1 | JSON (`ROLLBACK_UNAVAILABLE`); zero writes |
| Requested version is not locally packaged | 1 | JSON (`COMPOSITION_NOT_PACKAGED`); zero writes |
| Missing or syntactically invalid required argument | 2 | Usage error; zero writes |
| Staging/rename/restore-safe IO failure | 2 | One-line IO error; prior valid state retained/restored |
| Doctor has any failed check | 1 | Full doctor JSON report; zero writes |
| Doctor all checks pass/not applicable | 0 | Full doctor JSON report; zero writes |

## File-by-File Change Plan

Estimates are authored changed lines and intentionally stay within the 300-line review target with a small contingency.

| File | Change | Estimate |
| --- | --- | ---: |
| `configurator/managed-config.ts` (new) | Types, strict parsing/legacy hydration, asset rendering/hash, safe path derivation, upgrade/rollback transition engine, atomic commit/restore, and read-only diagnostic checks | 120 |
| `cmd/commands/upgrade.ts` (new) | Resolve `<version>`/`--home`, inject package metadata, call library, render JSON, map known/IO failures | 18 |
| `cmd/commands/rollback.ts` (new) | Resolve `--home`, call library, render JSON, map known/IO failures | 16 |
| `cmd/commands/install.ts` | Delegate host/state helpers to library and create the new composition on new installs while preserving exports used by tests | 18 |
| `cmd/commands/sync.ts` | Use shared managed-state/expected-asset helpers without changing preservation behavior | 6 |
| `cmd/commands/doctor.ts` | Accept optional args, append injected-home configuration checks, preserve report shape/order and readonly behavior | 18 |
| `cmd/output/errors.ts` | Recognize and serialize `ManagedConfigError` codes/details as business errors | 8 |
| `cmd/cli.ts` | Register `upgrade run` and `rollback run`, update help and unknown-command hint | 14 |
| `cmd/__tests__/configurator-transitions.test.ts` (new) | Isolated-home transition, rollback, idempotency, legacy, fail-closed, atomicity, and foreign-preservation cases | 66 |
| `cmd/__tests__/capabilities-doctor.test.ts` | Add injected-home drift, pin mismatch, missing prerequisite, and read-only assertions; keep clean-checkout assertions | 28 |
| `cmd/__tests__/install-sync.test.ts` | Assert additive composition creation and legacy sync readability | 6 |
| **Estimated total** |  | **318** |

No contract, program-root, agent, mission, accounting, ledger, journal, evidence, or memory file changes are required.

## Boundary Compliance

- **No authorization:** reports describe configuration state only. They never approve or refuse accounting, fiscal, payment, or other business actions.
- **No host installation:** no subprocess or host binary is invoked. Missing prerequisites are findings only.
- **No network/package acquisition:** upgrade accepts only the executing package's version and bytes.
- **No program-root mutation:** writes are restricted to the managed manifest and the two allowlisted managed files under re-derived known host configuration directories.
- **Frozen contracts untouched:** contracts are read only by the pre-existing doctor package-health check.
- **No reverse imports:** `configurator/` imports no `cmd/` or `agents/` module. Command adapters may import the library.
- **Cryptography:** SHA-256/temp identity uses `node:crypto` only.
- **No money:** the state contains no monetary field or computation. Versions are strings; schema/sequence values are JSON integers.
- **Foreign preservation:** a managed-path file not byte-equal to the validated current expectation is never overwritten, moved, or deleted.
- **Read-only doctor:** configuration diagnostics use only stat/read/hash operations and never call transition, sync, install, mkdir, or write helpers.

## Test Plan

### `cmd/__tests__/configurator-transitions.test.ts`

Use `mkdtempSync` homes and injected package versions; do not depend on real host binaries or network access.

- Upgrade A to locally packaged B: current becomes B, previous is exact A, sequence increments as an integer, top-level version mirrors B, clean managed assets reflect B, exit 0/report shape is stable.
- Upgrade B to B: snapshot the manifest and all host bytes before invocation; assert byte-for-byte equality afterward and `status: "unchanged"`.
- Rollback B to A: assert current and top-level mirror become A while previous remains A; second rollback is byte-for-byte unchanged and exits 0.
- Rollback with `previous: null`: assert JSON code `ROLLBACK_UNAVAILABLE`, exit 1, and unchanged bytes.
- Missing, malformed, wrong-manager, invalid-hash, and redirected-host-path manifests: assert exit 1 and no created/modified managed files.
- Pre-slice manifest A upgraded by package B: derive A from legacy fields/assets, persist A as previous, and retain legacy top-level compatibility fields.
- Legacy same-version upgrade: report unchanged without silently rewriting the manifest.
- Foreign marker and skills bytes: assert both remain byte-for-byte unchanged and are reported `preserved`; unrelated sentinel files remain unchanged.
- Injected commit failure after staging/one replacement: assert prior manifest/assets are restored and no stale temporary file remains.
- Requested version differs from packaged version: assert `COMPOSITION_NOT_PACKAGED`, exit 1, and zero writes.

### `cmd/__tests__/capabilities-doctor.test.ts`

- Preserve the existing clean-checkout and non-root-cwd cases: status remains `healthy`, every check remains `ok`, and `readonly` remains true when no managed manifest exists.
- Modify a managed marker without changing its presence: `managed-drift` names the host and marker, returns 1, and leaves bytes unchanged.
- Modify the skills asset: drift names the host and skills asset and remains read-only.
- Record package A while injecting packaged B: `package-pin` includes both versions and returns 1.
- Remove a recorded-present host directory, marker, or skills asset: `host-prerequisites` names the exact missing item and creates nothing.
- Keep manifest entries with `present: false`: assert they do not become missing-prerequisite failures.
- Existing malformed manifest: `managed-state` fails closed while doctor still emits the complete JSON report.

### `cmd/__tests__/install-sync.test.ts`

- New install writes `composition.current`, integer sequence/schema values, exact asset hashes/content, `previous: null`, and the compatibility `version` mirror.
- Legacy manifest remains readable by sync and preserves the existing foreign-marker behavior.

### Verification commands

Run focused Vitest files first, then the repository gates required by `openspec/config.yaml`:

```text
bun run test -- cmd/__tests__/configurator-transitions.test.ts cmd/__tests__/install-sync.test.ts cmd/__tests__/capabilities-doctor.test.ts
bun run typecheck
bun run build
bun run test
```
