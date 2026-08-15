# Tasks — Universal Agent Configurator (SDD-020, first slice)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~318 authored lines (design estimate) as one unit; per-file 6–120 (see Phase 1) |
| 400-line budget risk | Low (318 < 400 hard cap; ~6% over the 300-line repo review target via small contingency) |
| Chained PRs recommended | No |
| Suggested split | Single PR (no chaining; 318 stays under the 400-line cap). If implementation exceeds 400 authored lines, promote `configurator/managed-config.ts` + `upgrade.ts`/`rollback.ts`/`errors.ts`/`cli.ts` to PR 1 and the doctor + install/sync integration + tests to PR 2. |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (318 vs 300-line repo review budget; no 400-line exception required) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

This slice ships as ONE apply unit on one branch. Strict TDD is active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). Follow RED → GREEN → TRIANGULATE → REFACTOR per unit; finish with `bun run typecheck` and `bun run build`. No change may touch `contracts/**`, program-root documents, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, or `evidence/**`. Money is never involved; versions are semantic-version strings, and `schemaVersion`/`sequence` are JSON integers.

Requirement key: **R1** upgrade surface, **R2** rollback surface, **R3** doctor depth, **R4** composition record, **R5** layer/boundary, **R6** testability. Decision key: **D1** root `configurator/managed-config.ts` library, **D2** additive `composition` record in `~/.drenyra/managed.json`, **D3** legacy hydration/backward-compat, **D4** atomic fail-closed commit (manifest-last, restore on failure), **D5** upgrade/rollback semantics (idempotency, one-step restore, package-version constraint), **D6** read-only doctor integration.

## Phase 0 — setup and evidence

- [x] Freeze the inspected revision: `git rev-parse HEAD` = `8148fc37e8c55cfd9796075f820224083c2b1e23` (branch `docs/gate0-unblock`). Working tree was NOT fully clean: pre-existing `M openspec/programs/drenyra-dominion/README.md` (Gate-0 doc line, not a target of this slice) plus untracked planning artifacts (`.pi/`, `openspec/changes/ecosystem-coherence/`, `openspec/programs/drenyra-dominion/ecosystem-coherence.md`, and this change's own `openspec/changes/sdd-020-configurator/`). No source file was mutated before the baseline capture. <!-- sdd-owner: implementation -->
- [x] Capture the green baseline: `bun run test` → **60 files, 774 passed, all green** (exit 0). NOTE: the config.yaml/tasks.md citation of “647 tests, 3 known pre-existing failures in `cmd/__tests__/cli.test.ts`” is stale — the current tree at 8148fc3 has ZERO known failures (774/774 green). No failure is attributable to this change. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`; confirmed no task below lists any protected path as an edit target (Phase 1/2 touch only `configurator/`, `cmd/commands/*`, `cmd/output/errors.ts`, `cmd/cli.ts`, `cmd/__tests__/*`, `openspec/changes/sdd-020-configurator/*`). <!-- sdd-owner: implementation -->

## Phase 1 — implementation

### 1.1 Composition record: types and strict parsing (R4, R5; D1, D2)

- [x] In `configurator/managed-config.ts`, define strict TypeScript types (`ManagedCompositionSnapshot` with `packageVersion`, integer `sequence`, `activatedAt`, `managedAssets.marker|skills` carrying exact UTF-8 `content` + lowercase-hex `sha256`; `ManagedComposition` with integer `schemaVersion`, `current`, `previous: ManagedCompositionSnapshot | null`; `InstallManifest` with legacy `manager`/`version`/`installedAt`/`hosts`/`assets` plus the additive `composition`). Version fields are strings; `schemaVersion`/`sequence` are non-negative JSON integers; no float field exists. <!-- sdd-owner: implementation -->
- [x] Implement strict manifest validation that distinguishes `absent` | `invalid` | `legacy` | `current-schema`: validate required-field types, `manager === "drenyra-ai"`, semantic-version strings, integer `schemaVersion`/`sequence`, and recompute each asset hash with SHA-256 equal to the stored `content` (else `invalid`). No mutation occurs during parsing/hydration. <!-- sdd-owner: implementation -->

### 1.2 Managed asset rendering, hashing, and safe path derivation (R4, R5; D1, D2, D4)

- [x] In `configurator/managed-config.ts`, add deterministic marker/skills byte rendering and SHA-256 hashing using only `createHash("sha256")` from `node:crypto`; expose the expected asset bytes for a snapshot so the previous composition can be restored without network or an older package. <!-- sdd-owner: implementation -->
- [x] Implement safe host-path derivation: re-derive each host `configDir` from the injected home + a fixed host-name mapping (Codex, Claude Code, OpenCode), require it to match the normalized recorded path, and fail closed (redirected-host-path → `invalid`/`MANAGED_STATE_UNKNOWN`) before any write. The only allowlisted writable managed paths are `<re-derived-host-config-dir>/.drenyra-managed` and `.drenyra-skills.json`; no unlisted path is read or written. <!-- sdd-owner: implementation -->

### 1.3 Upgrade transition engine (R1, R4, R5; D1, D2, D5)

- [x] Implement `planUpgrade`/`commitUpgrade` in `configurator/managed-config.ts`: a requested semantic version must equal `getPackageMetadata().version` (injected by the adapter) or fail `COMPOSITION_NOT_PACKAGED`; detect idempotency BEFORE generating timestamps/temp files — when requested equals the hydrated current version, return `{ status: "unchanged" }` with zero writes (no `previous` rewrite, no timestamps, no manifest rewrite, no asset change). <!-- sdd-owner: implementation -->
- [x] For a different packaged target, build the exact target marker/skills bytes and a candidate manifest in memory: set `previous` to the validated hydrated current snapshot and create `current` with `sequence = previous.sequence + 1` (integer). Preserve (do not overwrite) any existing managed asset whose bytes differ from the expected current bytes, classifying it `preserved` in the report. Foreign (non-Drenyra) files are never created, modified, moved, or deleted. <!-- sdd-owner: implementation -->
- [x] Implement fail-closed upgrade paths in `configurator/managed-config.ts`: missing/unreadable/malformed manifest → `MANAGED_STATE_UNKNOWN` with zero writes and no mixed managed state; unrequested/no write. <!-- sdd-owner: implementation -->

### 1.4 Rollback transition engine (R2, R4, R5; D1, D2, D5)

- [x] Implement `planRollback`/`commitRollback` in `configurator/managed-config.ts`: require a validated previous snapshot; restore it as `current`, mirror the restored `packageVersion` to the top-level `version`, and leave `previous` unchanged (current === previous afterwards so a repeated rollback is an exact zero-write idempotent no-op). Preserve foreign-modified markers byte-for-byte and report `preserved`. <!-- sdd-owner: implementation -->
- [x] Implement fail-closed rollback in `configurator/managed-config.ts`: when `previous` is `null`, fail `ROLLBACK_UNAVAILABLE` with zero writes and current unchanged; when the manifest is missing/malformed, fail `MANAGED_STATE_UNKNOWN` with zero writes. <!-- sdd-owner: implementation -->

### 1.5 Atomic fail-closed commit (R4, R5; D1, D4)

- [x] Implement `commitTransition` in `configurator/managed-config.ts`: validate the complete candidate manifest and all candidate asset bytes FIRST, stage same-directory temp files, keep original bytes/existence in memory, then commit only the allowlisted managed paths; commit the manifest last via temp-file + fsync + rename (the same-directory atomic pattern from `cmd/adapters/file-mission-store.ts`, implemented below `cmd/`). On any synchronous failure after a replacement, restore the already-replaced assets and leave/restore the prior manifest so no mixed managed state survives; never publish the candidate manifest alone. <!-- sdd-owner: implementation -->

### 1.6 Doctor read-only diagnostics (R3, R5; D1, D6)

- [x] Implement `runConfigDiagnostics(home, packagedVersion)` in `configurator/managed-config.ts` using only stat/read/hash (never transition/sync/install/mkdir/write helpers), returning findings for: `managed-state` (healthy/not-applicable when absent; failed when existing manifest is malformed), `managed-drift` (byte/hash mismatch vs `composition.current.managedAssets`, naming `host:asset`; legacy manifests compare against hydrated legacy expectations), `package-pin` (compare recorded `packageVersion`/legacy `version` vs injected packaged version, stating both on mismatch), and `host-prerequisites` (config dir + both assets required ONLY for hosts recorded `present: true`; never installs). When no manifest exists all config checks pass as not-applicable so the clean-checkout invariant (`every check ok`) holds. <!-- sdd-owner: implementation -->

### 1.7 Legacy hydration and backward-compat (R4, R5; D1, D3)

- [x] Implement `hydrateLegacyManifest` in `configurator/managed-config.ts`: for a pre-slice manifest, derive `current` as `packageVersion = version`, `sequence = 0`, `activatedAt = installedAt`, marker content from the legacy deterministic `{ manager, installedAt }`, skills content read only from a present byte-consistent managed skills asset (fail closed on a real transition if no valid prior copy exists), hashes recomputed via SHA-256, and `previous = null`. Keep `install`/`sync`/doctor reading the legacy top-level fields; a same-version upgrade on a legacy manifest returns `unchanged` without silently rewriting the manifest to migrate schema. <!-- sdd-owner: implementation -->

### 1.8 `upgrade` command adapter (R1, R5; D1, D2)

- [x] In new `cmd/commands/upgrade.ts`, implement `upgradeCommand(args: string[] = [])`: parse `<version>` (missing/syntactically invalid → `usageError`, exit 2) and `--home` via the shared `--home`-else-`$HOME` rule used by install/sync; inject `getPackageMetadata().version` from `cmd/adapters/package-metadata.ts`; call the library; render the deterministic JSON report (`{ status: "upgraded"|"unchanged", from, to, results }`); map known `ManagedConfigError` codes to exit 1 and unexpected/IO failures to exit 2 after the library restores prior state. Keep this adapter thin (no business rules). <!-- sdd-owner: implementation -->

### 1.9 `rollback` command adapter (R2, R5; D1, D2)

- [x] In new `cmd/commands/rollback.ts`, implement `rollbackCommand(args: string[] = [])`: parse `--home` via the shared rule; call the library; render the deterministic JSON report (`{ status: "rolled-back"|"unchanged", from, to, results }`); map `ROLLBACK_UNAVAILABLE`/`MANAGED_STATE_UNKNOWN` to exit 1 and IO failures to exit 2. Keep the adapter thin. <!-- sdd-owner: implementation -->

### 1.10 `install` delegation and composition creation (R4, R5; D1, D2)

- [x] In `cmd/commands/install.ts`, delegate host/state helpers to the new library exports while preserving existing test-referenced exports; on a NEW install write the additive `composition` record (`current` with integer `sequence`/`schemaVersion`, exact asset hashes/content, `previous: null`) plus the compatibility top-level `version` mirror. Preserve existing foreign-change and never-install-host behavior. <!-- sdd-owner: implementation -->

### 1.11 `sync` shared helpers (R4, R5; D1)

- [x] In `cmd/commands/sync.ts`, use the library shared managed-state/expected-asset helpers without changing existing preservation behavior or the foreign-marker rule; legacy manifests remain readable. <!-- sdd-owner: implementation -->

### 1.12 `doctor` integration (R3, R6; D1, D6)

- [x] Change `doctorCommand` to `doctorCommand(args: string[] = [])` in `cmd/commands/doctor.ts`; resolve `--home` with the shared rule; append the library config checks to the existing `checks` array; preserve `{ status, checks, readonly: true }`, the existing package checks order, and `readonly: true`; any failed config check changes only `status` to `degraded` and returns 1; existing direct calls such as `capture(doctorCommand)` remain valid. <!-- sdd-owner: implementation -->

### 1.13 Error mapping for managed-state failures (R1, R2, R5; D1)

- [x] In `cmd/output/errors.ts`, define `ManagedConfigError` with stable codes (`MANAGED_STATE_UNKNOWN`, `ROLLBACK_UNAVAILABLE`, `COMPOSITION_NOT_PACKAGED`) and recognize/serialize it in `businessErrorOutput` as a business error (exit 1, machine-readable JSON); missing/invalid CLI arguments stay `usageError` exit 2; unexpected filesystem/IO failures exit 2 after the library restores prior state. <!-- sdd-owner: implementation -->

### 1.14 CLI registration and help (R1, R2; D1)

- [x] In `cmd/cli.ts`, register `upgrade: { run: upgradeCommand }` and `rollback: { run: rollbackCommand }` in the same `COMMANDS` dispatcher that registers `install`, `sync`, and `doctor`; add `upgrade run <version> [--home <dir>]` and `rollback run [--home <dir>]` help lines; update the unknown-command hint. <!-- sdd-owner: implementation -->

## Phase 2 — tests (strict TDD: RED → GREEN per unit)

### 2.1 Transition and rollback tests (R6; D1–D5) — `cmd/__tests__/configurator-transitions.test.ts`

Use `mkdtempSync` isolated homes and injected package versions; no network, no real host binaries. RED first, then GREEN each behavior.

- [x] RED — write failing tests for a clean upgrade: upgrade A→locally-packaged B sets current=B, previous=exact A, integer sequence increment, top-level version mirrors B, managed assets reflect B, exit 0 with stable report shape. GREEN via 1.3/1.5/1.8. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for upgrade idempotency: upgrade B→B snapshots manifest and host bytes before invocation and asserts byte-for-byte equality afterward plus `status: "unchanged"`. GREEN via 1.3. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for rollback: B→A sets current and top-level mirror to A while previous stays A; a second rollback is byte-for-byte unchanged and exits 0. GREEN via 1.4. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for rollback fail-closed: `previous: null` yields JSON code `ROLLBACK_UNAVAILABLE`, exit 1, current bytes unchanged. GREEN via 1.4/1.13. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for fail-closed state paths: missing, malformed, wrong-manager, invalid-hash, and redirected-host-path manifests each exit 1 with zero created/modified managed files. GREEN via 1.1/1.2/1.3/1.13. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for legacy compatibility: pre-slice manifest A upgraded by packaged B derives A from legacy fields/assets, persists A as previous, and retains legacy top-level compatibility fields; legacy same-version upgrade reports unchanged without rewriting the manifest. GREEN via 1.7/1.3. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for foreign preservation: foreign marker and skills bytes remain byte-for-byte unchanged and are reported `preserved`; unrelated sentinel files remain unchanged. GREEN via 1.3/1.4. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for atomicity: an injected commit failure after staging/one replacement leaves the prior manifest and assets restored and no stale temp file remains. GREEN via 1.5. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for the not-packaged path: requested version differs from injected packaged version → `COMPOSITION_NOT_PACKAGED`, exit 1, zero writes. GREEN via 1.3/1.13. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests proving boundary compliance: upgrade then rollback invoke no host binary, make no authorization/fiscal decision, and change only allowlisted managed paths; frozen contracts under `contracts/**` and program-root docs remain byte-identical. GREEN via 1.3/1.4/1.5. <!-- sdd-owner: implementation -->

### 2.2 Doctor diagnostics tests (R3, R6; D6) — `cmd/__tests__/capabilities-doctor.test.ts`

- [x] RED — write failing tests asserting config checks integrate with injected `--home`: managed-marker drift names `host:marker`, returns 1, leaves bytes unchanged, `readonly` stays true; skills-asset drift names `host:skills`; `package-pin` states both versions and returns 1; a recorded-present host with missing config dir/marker/skills yields `host-prerequisites` naming the exact missing item and creates nothing; entries with `present: false` do not become missing-prerequisite failures; a malformed existing manifest fails `managed-state` closed while doctor still emits the full report. GREEN via 1.6/1.12. <!-- sdd-owner: implementation -->
- [x] Preserve the existing clean-checkout and non-root-cwd cases: status stays `healthy`, every check stays `ok`, and `readonly` stays true when no managed manifest exists. Run `bun run test`. <!-- sdd-owner: implementation -->

### 2.3 Install/sync composition tests (R4, R6; D2, D3) — `cmd/__tests__/install-sync.test.ts`

- [x] RED — write failing tests asserting a new install writes `composition.current` with integer `sequence`/`schemaVersion`, exact asset hashes/content, `previous: null`, and the compatibility `version` mirror. GREEN via 1.10. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests asserting a legacy manifest remains readable by `sync` and preserves the existing foreign-marker behavior. GREEN via 1.11/1.7. <!-- sdd-owner: implementation -->

## Phase 3 — verification

- [x] Run the focused Vitest files first: `bun run test -- cmd/__tests__/configurator-transitions.test.ts cmd/__tests__/install-sync.test.ts cmd/__tests__/capabilities-doctor.test.ts`; all green. <!-- sdd-owner: implementation -->
- [x] Run the full suite `bun run test`, then `bun run typecheck` and `bun run build`; all green (the three known pre-existing `cmd/__tests__/cli.test.ts` failures from baseline must remain the only failures). <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, or `evidence/**` (git status/diff against baseline). <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement R1–R6 and each of the 14 scenarios as pass/fail against the implementation and tests; note `pinned-ai-runtime`, program-lock-aware install, and per-host pins as explicitly out-of-scope/deferred. <!-- sdd-owner: implementation -->
- [x] Changed-line budget check: confirm authored additions+deletions total ≈318 and stays under the 400-line hard cap; if it exceeds 400, do NOT merge as one unit — stop and promote the split boundary defined in the Forecast to two chained PRs. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the single SDD-020 candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. <!-- sdd-owner: parent --> (RDD-off clone-local precedent: prior fiscal-authority slices merged via ordinary policy with no review; follow the same precedent here unless review is enabled.)
- [ ] Deliver the first slice via a single PR following repository policy; update the SDD-020 change record (`proposal.md` lifecycle from `planned` toward apply evidence; record tasks/verify/archive state) and confirm the deferred-slice list (per-host pins, program-lock install, four-host E2E) remains documented for later SDD-020 slices. <!-- sdd-owner: parent -->
