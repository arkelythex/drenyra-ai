# SDD-020 Slice 2 — Host Integration Design

> Scope: Slice A — per-host pinned runtime/model/tool composition  
> Forward reference: Slice B — Drenyra Pi host and four-host lifecycle  
> Status: designed

## Design summary

Slice A adds one managed file, `.drenyra-pinned-ai-runtime.json`, to each recorded-present host. Its bytes are rendered only from package-local constants in `configurator/managed-config.ts`. The exact record and its SHA-256 are stored per host in `ManagedCompositionSnapshot`, which already lives under `InstallManifest.composition.current` and `previous`.

The design extends the existing managed-asset transition engine instead of introducing a host adapter or command-layer policy. Install creates the asset only when absent; sync recreates it only when the manifest records expected managed bytes; upgrade and rollback compare disk bytes with the recorded current snapshot before writing target bytes. Any existing unowned or unverifiable bytes are preserved. Doctor appends one structured `pinned-ai-runtime` check without changing the outer `{ status, checks, readonly }` report or exit-code convention.

## Decisions

| Decision | Resolution | Rationale and real-code fit |
| --- | --- | --- |
| Pin asset | Add `pin: ".drenyra-pinned-ai-runtime.json"` to `ASSET_FILENAMES`. | `planAssetTransitions` already derives paths from `homeDir` plus `HOST_DIR_MAP` and applies exact-byte ownership. Adding a named managed asset keeps pin writes on the existing allowlisted path model. |
| Record location | Add optional `pinnedComposition` to `ManagedCompositionSnapshot`; do not add a second top-level manifest mirror. | `InstallManifest` already persists `composition.current` and `previous`. Keeping pin records in each snapshot makes upgrade/rollback reproducible and avoids two authorities. Optionality distinguishes pre-pin snapshots without placeholder bytes. |
| Per-host storage | `pinnedComposition` is a partial host-keyed map whose values contain both the semantic record and exact rendered asset bytes/hash. | Pin content is host-specific, unlike the shared `marker` and `skills` entries in `managedAssets`. A host-keyed map avoids pretending one byte string applies to all hosts. Missing entries represent hosts for which Drenyra has no managed pin ownership (for example, a pre-existing foreign file). |
| Pin value source | Export one package-local `PINNED_AI_COMPOSITION` constant from `configurator/managed-config.ts`, exhaustive over `HostName`. | The library is already the deterministic composition owner. An exhaustive `Record<HostName, ...>` makes Slice B fail at compile time until Pi receives an explicit package-owned composition; no value comes from `program-lock`, network, host introspection, user input, or branch state. Literal product values are release data in this constant, not command arguments. |
| Version domain | A pin version is a non-negative JSON integer or a semver string; runtime validation rejects negative integers, floats, non-semver strings, and non-finite numbers. | Matches `openspec/config.yaml` and the spec. TypeScript narrows authoring, while manifest parsing remains the runtime authority. |
| Deterministic bytes | `renderPinnedAiRuntime(host)` serializes the complete record with `JSON.stringify(record, null, 2)` and no trailing newline. | This matches the current marker/skills rendering convention and gives install, sync, transitions, tests, and doctor one byte source. The snapshot additionally validates that `managedAsset.content === renderPinnedAiRuntime(record.host)` and that the stored hash matches content. |
| Foreign ownership | A disk pin with no corresponding host entry in `snapshot.pinnedComposition` is `foreign`, even when its bytes happen to equal the current package render. It is never adopted by byte coincidence. | Ownership is established only by the manifest, not by content guessing. This preserves user-authored bytes and creates the distinct unmanaged/unverifiable state required by the spec. |
| Pre-pin compatibility | Absence of `pinnedComposition` means pre-pin. `hydrateCurrentSnapshot` returns `pinsAvailable: false` and never synthesizes pin bytes. Same-version upgrade remains an unchanged no-op; any real upgrade/rollback requiring unavailable prior pin bytes fails with `MANAGED_STATE_UNKNOWN`. Doctor reports not applicable when no managed pin map and no foreign pin files exist. | Extends the existing `skillsAvailable` compatibility seam without sentinel hashes or empty pin content. It preserves the current early idempotency check in `planUpgrade`. |
| Partial ownership | `pinsAvailable` is true only when every recorded-present host has a valid managed pin entry. A partial map remains readable for doctor/foreign preservation but cannot be used as transition source state. | A fresh install may encounter a foreign pin for one host while safely managing another. Doctor can describe both, but upgrade/rollback cannot claim a reproducible complete prior composition and therefore fail closed. |
| Install behavior | A new install creates missing pin assets and records them. Existing pin bytes without manifest ownership are preserved and omitted from the host map. Reinstall uses an existing pin-capable composition unchanged; it does not silently adopt or rewrite pre-pin/foreign state. | Preserves the current install rule that existing composition is authoritative and prevents reinstall from manufacturing historical bytes. |
| Sync behavior | Sync uses recorded current pin bytes. It recreates a missing managed pin, reports an exact match as synced, preserves drift, and treats pre-pin manifests as pin-not-applicable rather than bootstrapping history. | `syncManaged` currently compares marker bytes against manifest state. Extending its result with an `asset` field lets marker and pin actions remain explicit without making sync an implicit schema migration. |
| Doctor diagnostic | Make `ConfigDiagnostic` a discriminated union and append a structured `PinnedAiRuntimeDiagnostic`. | `doctor.ts` already appends `runConfigDiagnostics(...)` to `checks` and derives status/exit code from `ok`; no command policy or new exit path is needed. Structured per-host state avoids encoding machine state only in `detail`. |
| Schema evolution | Increment `COMPOSITION_SCHEMA_VERSION` to `2`; continue accepting valid schema 1 snapshots without pins. Schema 2 snapshots validate any present pin entries strictly. | Existing validation accepts non-negative integer schema versions rather than equality. An explicit new write version documents the additive capability while keeping old manifests readable. |
| Boundary | All types, constants, rendering, validation, pin classification, and transition policy stay in `configurator/managed-config.ts`; `cmd` files only perform existing filesystem adaptation/reporting. | Preserves `contracts -> library modules -> agents -> cmd`, uses only `node:crypto` for hashing, and introduces no Drenyra Pi, host executable, package-manager, fiscal, or authorization dependency. |

## Exact TypeScript contracts

The implementation should use the following public shapes (names are normative; comments may be shortened in code):

```ts
export type PinVersion = number | `${number}.${number}.${number}${string}`;

export interface ComponentPin {
  id: string;
  version: PinVersion;
}

export interface PinnedAiRuntimeRecord {
  kind: "pinned-ai-runtime";
  /** JSON integer, never a float. */
  schemaVersion: 1;
  host: HostName;
  runtime: ComponentPin;
  model: ComponentPin;
  tool: ComponentPin;
}

export type PinnedAiCompositionValues = Omit<
  PinnedAiRuntimeRecord,
  "kind" | "schemaVersion" | "host"
>;

export interface ManagedHostPin {
  record: PinnedAiRuntimeRecord;
  managedAsset: ManagedAssetBytes;
}

export type PinnedComposition = Partial<
  Readonly<Record<HostName, ManagedHostPin>>
>;

export interface ManagedCompositionSnapshot {
  packageVersion: string;
  sequence: number;
  activatedAt: string;
  managedAssets: {
    marker: ManagedAssetBytes;
    skills: ManagedAssetBytes;
  };
  /** Undefined means this snapshot predates per-host pin ownership. */
  pinnedComposition?: PinnedComposition;
}
```

`PinVersion` is only an authoring aid. `isPinVersion(unknown)` MUST enforce `Number.isInteger(value) && value >= 0` for numbers and `SEMVER_RE` for strings. Empty identifiers are invalid. A host entry is valid only when its map key equals `record.host`, the record renders exactly to `managedAsset.content`, and the SHA-256 validates.

### Package-local constants

```ts
export const PINNED_AI_COMPOSITION = {
  codex: {
    runtime: { id: "codex", version: 1 },
    model: { id: "codex-package-default", version: 1 },
    tool: { id: "drenyra-ai-host-tools", version: 1 },
  },
  "claude-code": {
    runtime: { id: "claude-code", version: 1 },
    model: { id: "claude-code-package-default", version: 1 },
    tool: { id: "drenyra-ai-host-tools", version: 1 },
  },
  opencode: {
    runtime: { id: "opencode", version: 1 },
    model: { id: "opencode-package-default", version: 1 },
    tool: { id: "drenyra-ai-host-tools", version: 1 },
  },
} as const satisfies Readonly<Record<HostName, PinnedAiCompositionValues>>;

export function pinnedAiRuntimeRecord(host: HostName): PinnedAiRuntimeRecord;
export function renderPinnedAiRuntime(host: HostName): string;
export function managedHostPin(host: HostName): ManagedHostPin;
```

These integers are package-owned compatibility generations, not discovered vendor binary versions. Changing an identifier or generation is an explicit package release change. Commands receive no override seam. The constant is exhaustive and compiled into the package; Slice B extends `HostName` and `HOST_DIR_MAP`, so TypeScript requires a reviewed `drenyra-pi` entry before build can pass.

Canonical rendered JSON has this property order:

```json
{
  "kind": "pinned-ai-runtime",
  "schemaVersion": 1,
  "host": "claude-code",
  "runtime": { "id": "...", "version": 1 },
  "model": { "id": "...", "version": "1.2.3" },
  "tool": { "id": "...", "version": 1 }
}
```

## Doctor contract

```ts
export type HostPinState = "managed" | "drift" | "foreign" | "absent";

export interface HostPinDiagnostic {
  host: HostName;
  state: HostPinState;
  detail: string;
}

export interface BasicConfigDiagnostic {
  name: "managed-state" | "managed-drift" | "package-pin" | "host-prerequisites";
  ok: boolean;
  detail: string;
}

export interface PinnedAiRuntimeDiagnostic {
  name: "pinned-ai-runtime";
  ok: boolean;
  detail: string;
  applicability: "applicable" | "not-applicable" | "unverifiable";
  hosts: readonly HostPinDiagnostic[];
}

export type ConfigDiagnostic = BasicConfigDiagnostic | PinnedAiRuntimeDiagnostic;
```

Classification order for each recorded-present host is:

1. Managed snapshot entry + missing file -> `absent`.
2. Managed snapshot entry + unreadable or unequal bytes -> `drift` (unverifiable disk content is preserved).
3. Managed snapshot entry + exact bytes -> `managed`.
4. No managed snapshot entry + pin file exists -> `foreign`, with detail stating `user-authored; unmanaged; preserved; not adopted`.

If the entire snapshot predates `pinnedComposition` and no recorded-present host has a pin file, return `{ ok: true, applicability: "not-applicable", hosts: [] }`. No manifest is also healthy/not-applicable. An invalid manifest returns `{ ok: false, applicability: "unverifiable", hosts: [] }`. An applicable diagnostic is healthy only when every emitted host is `managed`; `drift`, `foreign`, or `absent` makes it fail.

`cmd/commands/doctor.ts` remains behaviorally unchanged: it appends the diagnostic, preserves `readonly: true`, prints the full JSON report, returns `0` when every check is `ok`, and returns `1` otherwise.

## Data flow

### Fresh install

1. `installIntegrations` calls `detectHosts(homeDir)`; no host executable is invoked.
2. For each present host, the library obtains `managedHostPin(host)` from package constants.
3. If the pin path is absent, install writes exact rendered bytes and records the host entry. If any bytes already exist without manifest ownership, install preserves them and records no managed host entry.
4. The new schema-2 snapshot stores marker, skills, and the per-host managed pin entries; the manifest is written last as today.

### Sync

1. `syncManaged` reads the classified manifest and uses only `composition.current.pinnedComposition` as pin authority.
2. For each recorded-present host with a managed entry: exact disk bytes are `synced`, missing bytes are recreated, and unequal/unreadable bytes are `preserved`.
3. Hosts without managed entries are never written. Existing pin bytes are reported as foreign/preserved; pre-pin absence is not applicable.
4. Results identify both `host` and `asset`, avoiding ambiguity between marker and pin actions.

### Upgrade and rollback

1. `hydrateCurrentSnapshot` returns `{ snapshot, skillsAvailable, pinsAvailable }`; it never builds pin content from current package constants for an old snapshot.
2. `planUpgrade` keeps its same-version early return. Before a real version transition, it requires both prior skills and complete prior pins for every recorded-present host.
3. The target snapshot uses the executing package's constants. `planAssetTransitions` processes `marker`, `skills`, and host-specific `pin` bytes. It compares disk only with current recorded bytes; a mismatch or read failure is preserved.
4. `planRollback` requires complete pin bytes in both current and previous snapshots before planning. Missing prior pin bytes fail with `MANAGED_STATE_UNKNOWN`; no bytes or manifest are changed.
5. `commitTransition` continues to stage assets, replace the manifest last, and restore prior bytes after an injected failure.

## Fail-closed and preservation rules

- Recorded `configDir` must still normalize to `reDeriveHostConfigDir(homeDir, host)` before any pin write.
- The only new writable host path is `<re-derived-config-dir>/.drenyra-pinned-ai-runtime.json`.
- Existence does not prove ownership. A pin is managed only when the current snapshot records its exact bytes/hash.
- Unreadable content is never overwritten; it is drift/preserved when ownership exists and foreign/preserved when it does not.
- No placeholder hash, empty content, current package render, or disk bytes may be inserted into an old snapshot as historical pin state.
- No code invokes a host binary or package manager, accesses the network, imports from `cmd/` or `agents/` into the library, or touches contracts/program roots.

## File-by-file change plan and line forecast

### Slice A — target 150–250 authored lines

| File | Planned change | Estimated changed lines |
| --- | --- | ---: |
| `configurator/managed-config.ts` | Add pin filename/types/constants/rendering/validation; optional snapshot map; hydration availability; transition participation; structured doctor classification. | 75–90 |
| `cmd/commands/install.ts` | Render/create missing owned pin assets and include managed host entries in a new snapshot; preserve unowned existing bytes. | 12–18 |
| `cmd/commands/sync.ts` | Reconcile recorded pin assets, add asset identity to results, preserve pre-pin/foreign state. | 15–22 |
| `cmd/__tests__/install-sync.test.ts` | Pin creation/type/render determinism for three present hosts; sync recreate; foreign preservation. | 20–28 |
| `cmd/__tests__/configurator-transitions.test.ts` | Pin fixtures; upgrade/rollback exact restore; pre-pin fail-closed; foreign preservation and allowlist extension. | 22–30 |
| `cmd/__tests__/capabilities-doctor.test.ts` | Managed/drift/foreign/absent/pre-pin/invalid matrix, JSON shape, readonly and exit codes. | 25–35 |
| **Slice A total** |  | **169–223 authored lines** |

The implementation must keep Slice A at or below the repository's 300-line review budget. If concrete literals and complete scenario coverage push authored lines above 250, reduce duplicated test fixtures—not behavior—or deliver a separately reviewed test-only follow-up. Do not pull Slice B into A.

### Slice B — explicit boundary, not implemented by Slice A

Slice B alone extends `HostName`, `HOST_DIR_MAP`, `isHostName`, and `PINNED_AI_COMPOSITION` with `drenyra-pi`; chooses its canonical home-relative config directory; updates capability wording; and adds the four-host `install -> doctor -> sync -> upgrade -> rollback` acceptance flow. Slice A deliberately makes the pin constant exhaustive so the new host cannot compile without pin policy. Slice B does not redesign the record, diagnostic, or transition engine.

Expected Slice B files: `configurator/managed-config.ts`, `cmd/commands/capabilities.ts`, existing configurator/command tests, and one four-host lifecycle test. Estimated Slice B: 120–200 authored lines.

## Test plan

Strict TDD applies (`bun run test`; then `bun run typecheck` and `bun run build`). Tests use isolated temporary homes and no network or real host process.

### `cmd/__tests__/install-sync.test.ts`

- RED: fresh install with Codex, Claude Code, and OpenCode directories creates one pin file per host; absent hosts receive no file.
- Assert each parsed record has `kind`, schema integer, matching host, runtime/model/tool, and each version passes integer-or-semver validation; include a rejection fixture for a float.
- Assert rendered bytes equal `renderPinnedAiRuntime(host)` and snapshot `managedAsset.content`; recompute each SHA-256.
- Assert repeat rendering and install/sync rendering are byte-identical.
- Delete one managed pin, run sync, and assert recreation plus `{ host, asset: "pin", action: "synced" }`.
- Pre-create foreign bytes before install and assert byte-for-byte preservation, no managed entry for that host, and a preserved result on sync.
- Assert no missing host directory is created and no host binary seam exists or is called.

### `cmd/__tests__/configurator-transitions.test.ts`

- Extend snapshot and host-asset fixtures with host-specific pin records/bytes.
- Upgrade A -> B: current records B package constants, previous preserves exact A pin records/bytes, all sequences remain integers, and result includes `asset: "pin"`.
- Rollback restores previous exact pin bytes and a second rollback remains zero-write/idempotent.
- Replace a managed pin with arbitrary bytes; upgrade then rollback must report preserved and keep those bytes unchanged.
- Pre-pin schema-1 current snapshot: same-version upgrade is unchanged; real upgrade fails `MANAGED_STATE_UNKNOWN` with zero writes. Rollback to a previous snapshot without pins fails the same way.
- Redirected host path fails before pin write. Atomic failure restoration includes the pin file. Add the pin path to the allowlist assertion; frozen contracts/docs remain byte-identical.

### `cmd/__tests__/capabilities-doctor.test.ts`

- `managed`: exact recorded bytes, diagnostic applicable/healthy, host state managed, outer report healthy/readonly, exit 0.
- `drift`: unequal and unreadable managed bytes, state drift, bytes unchanged, degraded, exit 1.
- `foreign`: file exists with no host pin entry, state foreign, detail contains user-authored/unmanaged/preserved/not-adopted, bytes unchanged, exit 1.
- `absent`: managed entry exists but file does not, state absent, doctor creates nothing, exit 1.
- Pre-pin valid manifest with no pin files: healthy/not-applicable/empty hosts, no writes, exit 0.
- No manifest: same not-applicable convention, exit 0.
- Invalid pin version/hash/render-host mismatch: managed-state fails closed; pin diagnostic is unverifiable; complete report still emitted, exit 1.
- Multi-host matrix verifies every recorded-present host is named and any non-managed state fails the aggregate check; `present: false` remains excluded.

## Rollout and compatibility

This is an additive manifest evolution. Readers accept schema 1 without pin records and schema 2 with strict pin validation. New installs write schema 2. Existing pre-pin installations remain operable for install/sync/doctor reads, but transitions that need unavailable historical pin bytes stop with a machine-readable error and zero writes. Operators obtain reproducible pin history through a clean managed install or an explicitly designed future migration; this slice does not silently adopt files.

No program-lock behavior changes. Slice C may replace `PINNED_AI_COMPOSITION` as the source only after a genuinely promoted artifact can be verified; the persisted record and transition/doctor contracts remain reusable.
