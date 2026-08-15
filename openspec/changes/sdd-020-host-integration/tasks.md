# Tasks — Host Integration (SDD-020, slice 2 — Slice A: per-host pinned AI runtime)

> Scope: Slice A only (per-host `pinned-ai-runtime` record + doctor surfacing + deterministic install/sync rendering + pre-pin/foreign compatibility + boundary compliance). Slice B (Drenyra Pi host, capability wording per design, four-host lifecycle) is a separate follow-on review unit and is NOT implemented here; its boundary is defined in the Forecast below.
>
> Requirement key: **R1** per-host pin record, **R2** deterministic rendering through install/sync/upgrade/rollback, **R3** doctor `pinned-ai-runtime` surfacing, **R4** boundary and invariant compliance, **R5** testability. Design decision key: **D1** pin record types in `configurator/managed-config.ts`, **D2** package-local `PINNED_AI_COMPOSITION` constants + rendering, **D3** `pinnedComposition` snapshot extension + schema v2, **D4** install rendering, **D5** sync rendering, **D6** doctor `pinned-ai-runtime` diagnostic, **D7** pre-pin compatibility + foreign preservation + boundary compliance.
>
> Spec has 5 requirements and **16 scenarios** (R1×3, R2×4, R3×5, R4×2, R5×2); every scenario is covered by an explicit Phase 2 test task.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice A ~170–225 authored lines (design estimate 169–223 + ~1 line capability wording); combined A+B ~289–423 (upper bound exceeds the 400-line cap) |
| 400-line budget risk | Medium — Slice A alone is Low (≈170–225 < 400); the combined A+B product upper bound ≈423 may exceed 400, which is exactly why A and B ship as two units |
| Chained PRs recommended | Yes — A then B as sequential review units per proposal and design |
| Suggested split | PR 1 = Slice A (this task list, one apply unit on one branch); PR 2 = Slice B (separate task list: `drenyra-pi` host union/map/`PINNED_AI_COMPOSITION` exhaustiveness, capability wording, four-host `install→doctor→sync→upgrade→rollback` flow) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (A merges to main first; B is a second PR to main, not a feature-branch chain) |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

Slice A ships as ONE apply unit on one branch. Strict TDD is active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). Follow RED → GREEN → TRIANGULATE → REFACTOR per unit; finish with `bun run typecheck` and `bun run build`. No change may touch `contracts/**`, program-root documents, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`, or any `drenyra-pi` code. Money is never involved; `schemaVersion`/`sequence` and every pin version are JSON integers or semantic-version strings, never floats. No host binary or package manager is ever invoked.

The split boundary A→B is explicit: Slice A touches only `configurator/managed-config.ts`, `cmd/commands/install.ts`, `cmd/commands/sync.ts`, `cmd/__tests__/{install-sync,configurator-transitions,capabilities-doctor}.test.ts`, and (one doc-only wording line) `cmd/commands/capabilities.ts`. Slice B adds `drenyra-pi` to `HostName`/`HOST_DIR_MAP`/`isHostName`/`PINNED_AI_COMPOSITION` and the four-host lifecycle flow. The pin constant is made exhaustive in A so B cannot compile without an explicit Pi pin entry.

## Phase 0 — setup and evidence

- [x] Freeze the inspected revision: `git rev-parse HEAD` (record exact SHA and branch). Confirm working-tree state relative to baseline; no source file is mutated before the baseline capture. Record that `configurator/managed-config.ts` currently exports `COMPOSITION_SCHEMA_VERSION = 1`, `ASSET_FILENAMES = { marker, skills }`, `ManagedCompositionSnapshot` with only `managedAssets.marker|skills`, and `runConfigDiagnostics` returning four basic checks — the exact extension points for this slice. <!-- sdd-owner: implementation -->
- [x] Capture the green baseline: `bun run test` → record actual file/test counts (orchestrator expectation **843 passed / 843 green**, exit 0). NOTE: the `openspec/config.yaml` citation of "647 tests, 3 known pre-existing failures in `cmd/__tests__/cli.test.ts`" is stale — capture and record the actual current pass/fail counts; no failure is attributable to this change. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`; confirm no task below lists any protected path as an edit target (Phase 1/2 touch only `configurator/managed-config.ts`, `cmd/commands/{install,sync,capabilities}.ts`, `cmd/__tests__/{install-sync,configurator-transitions,capabilities-doctor}.test.ts`, and `openspec/changes/sdd-020-host-integration/*`). <!-- sdd-owner: implementation -->

## Phase 1 — implementation

### 1.1 Per-host pin record types and version domain (R1; D1)

- [x] In `configurator/managed-config.ts`, define `PinVersion = number |`${number}.${number}.${number}${string}`` (authoring aid only), `ComponentPin { id: string; version: PinVersion }`, `PinnedAiRuntimeRecord { kind: "pinned-ai-runtime"; schemaVersion: 1; host: HostName; runtime; model; tool }`, `PinnedAiCompositionValues = Omit<PinnedAiRuntimeRecord, "kind" | "schemaVersion" | "host">`, `ManagedHostPin { record; managedAsset: ManagedAssetBytes }`, and `PinnedComposition = Partial<Readonly<Record<HostName, ManagedHostPin>>>`. Every version field is a JSON integer or semantic-version string; no float field exists. <!-- sdd-owner: implementation -->
- [x] In `configurator/managed-config.ts`, implement `isPinVersion(unknown): value is PinVersion` enforcing `Number.isInteger(value) && value >= 0` for numbers and `SEMVER_RE` for strings (empty identifiers invalid); implement runtime record validation that rejects negative integers, floats, non-semver strings, and non-finite numbers. TypeScript narrows authoring; manifest parsing remains the runtime authority. <!-- sdd-owner: implementation -->

### 1.2 Deterministic package-owned pin constants and rendering (R1, R2; D2)

- [x] In `configurator/managed-config.ts`, export `PINNED_AI_COMPOSITION` as `as const satisfies Readonly<Record<HostName, PinnedAiCompositionValues>>`, exhaustive over the existing three hosts (`codex`, `claude-code`, `opencode`), with package-owned compatibility generations for `runtime`/`model`/`tool` ids and integer versions. These are release data in the library constant — NOT derived from `program-lock`, network, host introspection, user input, or `main`. The exhaustive `Record<HostName, ...>` makes Slice B fail at compile time until a reviewed `drenyra-pi` entry exists. <!-- sdd-owner: implementation -->
- [x] In `configurator/managed-config.ts`, implement `pinnedAiRuntimeRecord(host)`, `renderPinnedAiRuntime(host)` (exact `JSON.stringify(record, null, 2)` with NO trailing newline, matching the marker/skills byte convention), and `managedHostPin(host)`. Canonical property order: `kind`, `schemaVersion`, `host`, `runtime`, `model`, `tool`. Commands receive no override seam. <!-- sdd-owner: implementation -->

### 1.3 Snapshot extension, schema v2, and strict validation (R1, R2; D3)

- [x] In `configurator/managed-config.ts`, add `pin: ".drenyra-pinned-ai-runtime.json"` to `ASSET_FILENAMES` (typed via `ManagedAssetName`), extend `ManagedCompositionSnapshot` with optional `pinnedComposition?: PinnedComposition` (undefined = pre-pin snapshot; no second top-level manifest mirror), and bump `COMPOSITION_SCHEMA_VERSION` to `2`. Keep reading schema-1 snapshots (no pins) valid. <!-- sdd-owner: implementation -->
- [x] Extend manifest/snapshot validation in `configurator/managed-config.ts` so a schema-2 snapshot validates every present pin entry strictly: map key equals `record.host`, `record` renders exactly to `managedAsset.content` via `renderPinnedAiRuntime(host)`, stored SHA-256 equals a recompute, and every version passes `isPinVersion`. Invalid pin version/hash/render-host mismatch → manifest `invalid`. Never synthesize pin bytes for a pre-pin snapshot. <!-- sdd-owner: implementation -->

### 1.4 Install rendering of managed pin assets (R2; D4)

- [x] In `cmd/commands/install.ts` (thin adapter), for each present host obtain `managedHostPin(host)` from the library; create `<re-derived-config-dir>/.drenyra-pinned-ai-runtime.json` ONLY when absent, writing exact rendered bytes and recording the managed host entry in the new schema-2 snapshot (`pinnedComposition`). If any bytes already exist without manifest ownership, preserve them byte-for-byte and record NO managed host entry for that host (reinstall keeps an existing pin-capable composition unchanged). The manifest is written last as today. No host directory is created and no host binary is invoked. <!-- sdd-owner: implementation -->

### 1.5 Sync rendering of managed pin assets (R2; D5)

- [x] In `cmd/commands/sync.ts` (thin adapter), extend `syncManaged` to reconcile recorded pin assets using only `composition.current.pinnedComposition` as authority: exact disk bytes → `synced`, missing managed pin → recreate with expected bytes + report `synced`, unequal/unreadable bytes → preserve + report `preserved`. Extend `SyncResult` (or add an `asset` field, design D5) so pin actions are identified as `asset: "pin"` distinct from marker actions, avoiding ambiguity. Hosts without a managed entry are never written; pre-pin manifests are pin-not-applicable (no historical bootstrapping); existing foreign pin bytes are reported as foreign/preserved. <!-- sdd-owner: implementation -->

### 1.6 Upgrade and rollback transition participation (R2; D3, D5)

- [x] In `configurator/managed-config.ts`, extend `hydrateCurrentSnapshot` to also return `pinsAvailable` (true only when every recorded-present host has a valid managed pin entry) while NEVER building pin content from current package constants for an old snapshot. Keep the existing same-version early-return idempotency in `planUpgrade` unchanged. <!-- sdd-owner: implementation -->
- [x] In `configurator/managed-config.ts`, extend `planUpgrade`/`planRollback` and `planAssetTransitions` so target snapshots use the executing package's constants and process the per-host `pin` asset alongside `marker`/`skills`: before a real transition, require complete prior pins (both skills and pins available); when unavailable, fail `MANAGED_STATE_UNKNOWN` with zero writes. `planRollback` requires complete pin bytes in both current and previous snapshots; missing prior bytes fail `MANAGED_STATE_UNKNOWN`. Compare disk only against recorded current bytes; mismatch/read failure preserves the bytes. A partial `pinnedComposition` remains readable for doctor/foreign preservation but is never used as a transition source. <!-- sdd-owner: implementation -->
- [x] In `configurator/managed-config.ts`, extend `commitTransition` atomic restore so the pin file participates in stage-and-restore exactly like marker/skills: on an injected failure after a pin replacement, the prior pin bytes and the prior manifest are restored; no mixed managed state survives. The only new writable host path remains `<re-derived-config-dir>/.drenyra-pinned-ai-runtime.json`. <!-- sdd-owner: implementation -->

### 1.7 Doctor `pinned-ai-runtime` diagnostic (R3; D6)

- [x] In `configurator/managed-config.ts`, make `ConfigDiagnostic` a discriminated union (keep `BasicConfigDiagnostic` for the existing four checks) and add `PinnedAiRuntimeDiagnostic { name: "pinned-ai-runtime"; ok: boolean; detail: string; applicability: "applicable" | "not-applicable" | "unverifiable"; hosts: readonly HostPinDiagnostic[] }` with `HostPinState = "managed" | "drift" | "foreign" | "absent"` and `HostPinDiagnostic { host; state; detail }`. <!-- sdd-owner: implementation -->
- [x] In `configurator/managed-config.ts`, implement the pin classification for each recorded-present host in this order: managed entry + missing file → `absent`; managed entry + unreadable/unequal bytes → `drift` (disk preserved); managed entry + exact bytes → `managed`; no managed entry + pin file exists → `foreign` with detail stating `user-authored; unmanaged; preserved; not adopted`. Healthy only when every emitted host is `managed`. Pre-pin snapshot with no present-host pin files → `{ ok: true, applicability: "not-applicable", hosts: [] }`. No manifest → same not-applicable healthy convention. Invalid manifest → `{ ok: false, applicability: "unverifiable", hosts: [] }`. Read-only: never create/modify/delete any pin asset. <!-- sdd-owner: implementation -->
- [x] In `cmd/commands/doctor.ts` (thin adapter, behaviorally unchanged), append the `pinned-ai-runtime` diagnostic to the existing `checks` array; keep `readonly: true` and the `{ status, checks, readonly }` report shape; any failing pin state flips `status` to `degraded` and the command exits 1, matching the existing doctor convention. <!-- sdd-owner: implementation -->

### 1.8 Pre-pin compatibility (fail-closed) (R1, R2; D7)

- [x] In `configurator/managed-config.ts`, confirm a pre-pin (schema-1, no `pinnedComposition`) manifest remains readable by `install`, `sync`, `doctor`, `upgrade`, and `rollback`; `install`/`sync`/`doctor` report pin-not-applicable without inventing bytes; a real `upgrade`/`rollback` that requires unavailable prior pin bytes fails `MANAGED_STATE_UNKNOWN` with zero writes. No placeholder hash, empty content, current package render, or disk bytes may be inserted into an old snapshot as historical pin state. <!-- sdd-owner: implementation -->

### 1.9 Foreign-pin preservation and boundary compliance (R1, R4; D7)

- [x] In `configurator/managed-config.ts` and adapters, enforce that a disk pin with no corresponding `snapshot.pinnedComposition` entry is treated as `foreign` even when its bytes happen to equal the current package render — ownership is established only by the manifest, never by byte coincidence; it is preserved byte-for-byte and never adopted, overwritten, moved, or deleted by `install`, `sync`, `upgrade`, `rollback`, or `doctor`. <!-- sdd-owner: implementation -->
- [x] Confirm boundary invariants hold: all pin types/constants/rendering/validation/classification/transition policy live in `configurator/managed-config.ts` (library); library imports only `node:crypto`; no import from `cmd/` or `agents/` into the library; `cmd/` adapters stay thin; no host binary or package manager is invoked; no authorization/fiscal decision is made or reported; no frozen contract, program-root document, or monetary value is mutated; no coupling to `drenyra-pi`. Every pin write target is re-derived from the injected home + fixed host map; a recorded path redirecting a write outside the re-derived managed host directory fails closed (machine-readable error, no write) rather than being used as write authority. <!-- sdd-owner: implementation -->

### 1.10 Capability wording correction (small doc-only)

- [x] In `cmd/commands/capabilities.ts`, update the stale host-integration wording so already-configured integrations are no longer described as merely `"(planned)"` — reflect that the configurator renders managed host markers/skills/pins, WITHOUT claiming Drenyra Pi host-serving or program-lock-aware install are complete. Keep this a wording-only change (no capability surface, no new flags). <!-- sdd-owner: implementation -->

## Phase 2 — tests (strict TDD: RED → GREEN per unit)

### 2.1 `cmd/__tests__/install-sync.test.ts` — pin creation, versions, render determinism, sync, foreign preservation (R1, R2, R5; D1, D2, D3, D4, D5) — scenarios 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 5.1

Use `mkdtempSync` isolated homes and injected package versions; no network, no real host binaries. RED first, then GREEN each behavior.

- [x] RED — write failing tests: a fresh install with Codex, Claude Code, and OpenCode directories creates exactly one `.drenyra-pinned-ai-runtime.json` per present host; absent hosts receive no file. Each parsed record has `kind`, integer `schemaVersion`, matching `host`, `runtime`/`model`/`tool`, and each version passes integer-or-semver validation; include a rejection fixture for a float version (scenario 1.1, 1.2). GREEN via 1.1/1.2/1.4. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: rendered bytes equal `renderPinnedAiRuntime(host)`, snapshot `managedAsset.content` matches, and each stored SHA-256 equals a recompute; repeat rendering and install/sync rendering are byte-identical for the same packaged version (scenario 2.1, 2.3). GREEN via 1.2/1.3/1.4. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: delete one managed pin, run `sync`, and assert recreation plus a result identifying `asset: "pin"` with a `synced` action; a present-host pin that is foreign is preserved byte-for-byte with a preserved result and no managed entry for that host (scenario 2.2, 4.1). GREEN via 1.5/1.9. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: no missing host config directory is created and no host binary seam exists or is called during install/sync (scenario 5.1). GREEN via 1.4/1.5/1.9. <!-- sdd-owner: implementation -->

### 2.2 `cmd/__tests__/configurator-transitions.test.ts` — upgrade/rollback pin restore, pre-pin fail-closed, foreign preservation, redirected paths (R1, R2, R4; D3, D5, D7) — scenarios 1.3, 2.4, 4.1, 4.2

Extend the existing snapshot and host-asset fixtures with host-specific pin records/bytes. RED first, then GREEN.

- [x] RED — write failing tests: upgrade A→locally-packaged B records B's pin constants/bytes as current and preserves A's exact pin records/bytes as previous; all sequences remain integers; results include `asset: "pin"`. Rollback restores the previous exact pin bytes and a second rollback remains zero-write/idempotent (scenario 2.4). GREEN via 1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: replace a managed pin with arbitrary user-authored bytes; upgrade then rollback report `preserved` and leave those bytes byte-for-byte unchanged (scenario 2.4, 4.1). GREEN via 1.6/1.9. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: a pre-pin schema-1 current snapshot yields a same-version upgrade that is an unchanged no-op; a real upgrade fails `MANAGED_STATE_UNKNOWN` with zero writes; a rollback to a previous snapshot without pins fails the same way (scenario 1.3). GREEN via 1.6/1.8. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: a redirected host path fails before any pin write with a machine-readable error and no file created or modified outside the re-derived managed host directory; atomic failure restoration includes the pin file; the allowlist assertion includes the pin path; frozen contracts/docs remain byte-identical (scenario 4.2). GREEN via 1.6/1.9. <!-- sdd-owner: implementation -->

### 2.3 `cmd/__tests__/capabilities-doctor.test.ts` — doctor classification matrix + capability wording (R3, R5; D6, D7) — scenarios 3.1–3.5, 5.2

- [x] RED — write failing tests for `managed`: exact recorded bytes → diagnostic applicable/healthy, per-host state `managed`, outer report healthy/readonly, exit 0 (scenario 3.1). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for `drift`: unequal and unreadable managed bytes → state `drift`, bytes unchanged, degraded, exit 1 (scenario 3.2). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for `foreign`: file exists with no host pin entry → state `foreign`, detail contains user-authored/unmanaged/preserved/not-adopted, bytes unchanged, exit 1 (scenario 3.3). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for `absent`: managed entry exists but file does not → state `absent`, doctor creates nothing, exit 1 (scenario 3.4). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for pre-pin and invalid manifests: a valid pre-pin manifest with no pin files is healthy/not-applicable/empty hosts, no writes, exit 0; no-manifest passes not-applicable, exit 0; an invalid pin version/hash/render-host mismatch fails `managed-state` closed, the pin diagnostic is `unverifiable`, the full report is still emitted, exit 1 (scenario 3.5, 5.2). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write a multi-host matrix test verifying every recorded-present host is named and any non-managed state fails the aggregate check; `present: false` hosts remain excluded (scenario 5.2). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — assert the `capabilities` integration wording no longer claims host integrations are merely planned while still not claiming Pi host-serving or program-lock-aware install completeness (scenario 5.2). GREEN via 1.10. <!-- sdd-owner: implementation -->

### 2.4 Isolation and boundary test (R4, R5; D7) — scenario 5.1

- [x] RED — write failing tests proving the pin suite runs in isolation against an injected home with no network, no real user home, and no real host process; every render is deterministic and byte-comparable; classification scenarios assert their exit code and JSON report shape (scenario 5.1). GREEN via the Phase 2 suites above. <!-- sdd-owner: implementation -->

## Phase 3 — verification

- [x] Run the focused Vitest files first: `bun run test -- cmd/__tests__/install-sync.test.ts cmd/__tests__/configurator-transitions.test.ts cmd/__tests__/capabilities-doctor.test.ts`; all green. <!-- sdd-owner: implementation -->
- [x] Run the full suite `bun run test`, then `bun run typecheck` and `bun run build`; all green with only the recorded pre-existing baseline failures (if any) remaining. <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, or `flow/**` (git status/diff against baseline). <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement R1–R5 and each of the 16 scenarios as pass/fail against the implementation and tests; note Drenyra Pi host union/map/detection, capability wording per design, program-lock-aware install, and the four-host lifecycle flow as explicitly out-of-scope/deferred to Slice B/C. <!-- sdd-owner: implementation -->
- [x] Changed-line budget check: confirm authored additions+deletions total ≈170–225 and stays under the 400-line hard cap; if it exceeds 400, do NOT merge Slice A as one unit — stop and promote the A→B split defined in the Forecast to two chained PRs (A alone, then B), and re-verify the A boundary before B begins. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the Slice A candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-020 configurator slice and the SDD-030 slice: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Deliver Slice A via a PR to `main` following repository policy, then open Slice B as a second PR to `main` (stacked-to-main chain A→B); update the SDD-020 change record (`proposal.md` lifecycle toward apply evidence; record tasks/verify/archive state) and confirm the deferred-slice list (Drenyra Pi host union/map/detection, four-host lifecycle flow, capability wording per design, program-lock-aware install as slice C) remains documented for later SDD-020 slices. <!-- sdd-owner: parent -->
