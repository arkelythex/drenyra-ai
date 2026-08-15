# Apply Progress — Universal Agent Configurator (SDD-020, first slice)

## Status consumed (openspec store, authoritative)

```yaml
schemaName: spec-driven
changeName: sdd-020-configurator
artifactStore: openspec
applyState: ready (planning chain complete: proposal -> spec -> design -> tasks)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
dependencies.apply: ready
nextRecommended: parent-lifecycle (after batch freeze; no commit/push/PR/review performed by this phase)
```

**Delivery decision (resolved by parent at delegation):** single apply unit on one branch; tasks.md Review Workload Forecast `single-pr` / `size-exception` (318 vs 300-line repo review budget, "no 400-line exception required"), `Decision needed before apply: No`, `Chained PRs recommended: No`, `400-line budget risk: Low`. The forecast's own contingency (actual > 400 authored lines → split boundary) is triggered — see the Workload / PR boundary section; the parent owns the branch/PR decision.

**Strict TDD:** active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). RED → GREEN → TRIANGULATE → REFACTOR per unit; RED was the missing `configurator/managed-config.ts` + `cmd/commands/upgrade.ts` + `cmd/commands/rollback.ts` modules (all three focused files failed to load).

**Attempt token (parent-acquired, slice 1):** `sha256:f7b42e0a1a543fcaa98248cc6b51377b68915353fa7e0db6e5e3ae48030f421e`. No acquire/settle performed by this phase (per delegation instructions).

**Scope honored:** only `configurator/managed-config.ts` (new library), `cmd/commands/{upgrade,rollback}.ts` (new adapters), `cmd/commands/{install,sync,doctor}.ts`, `cmd/output/errors.ts`, `cmd/cli.ts`, `cmd/__tests__/{configurator-transitions,capabilities-doctor,install-sync}.test.ts`, plus tasks.md checkboxes and this apply-progress. No `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `tsconfig*.json`, `package.json`, or root `index.ts` touched.

## Phase 0 evidence

- **Revision frozen:** `git rev-parse HEAD` = `8148fc37e8c55cfd9796075f820224083c2b1e23` (branch `docs/gate0-unblock`). Working tree was NOT fully clean BEFORE this slice: pre-existing `M openspec/programs/drenyra-dominion/README.md` (Gate-0 doc line, not a target) plus untracked planning artifacts (`.pi/`, `openspec/changes/ecosystem-coherence/`, `openspec/programs/drenyra-dominion/ecosystem-coherence.md`, and this change's own `openspec/changes/sdd-020-configurator/`). None was mutated by this slice; the README stays byte-for-byte as found.
- **Green baseline:** `bun run test` → **60 files, 774 passed, all green**. NOTE: the tasks.md/config.yaml citation of "647 tests, 52 files, 3 known pre-existing failures in `cmd/__tests__/cli.test.ts`" is **stale** — the current tree at 8148fc3 has zero known failures (774/774 green). No failure is attributable to this change.
- **Protected paths:** `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**` — confirmed no task lists any as an edit target; final scan (below) confirms none was touched.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

Phase 1 (implementation) — 19/19 rows `[x]`; Phase 2 (tests) — 14/14 rows `[x]`; Phase 3 (verification) — 5/5 rows `[x]`. The two parent-owned lifecycle rows remain `[ ]` (bounded review + single-PR delivery).

| Task | Summary |
| --- | --- |
| 1.1 types + strict parsing | `ManagedCompositionSnapshot` (packageVersion, integer `sequence`, `activatedAt`, `managedAssets.marker\|skills` with exact UTF-8 `content` + lowercase-hex `sha256`), `ManagedComposition` (integer `schemaVersion`, `current`, `previous \| null`), `InstallManifest` (legacy `manager`/`version`/`installedAt`/`hosts`/`assets` + additive `composition`). `classifyManifest` distinguishes `absent \| invalid \| legacy \| current-schema`, validates field types, `manager === "drenyra-ai"`, semantic-version strings, integer `schemaVersion`/`sequence`, and recomputes every stored asset hash (SHA-256 over stored `content`) — mismatch → `invalid`. Pure; no mutation during parsing/hydration. |
| 1.2 rendering/hash/paths | `renderManagedMarker`/`renderManagedSkills` (byte-identical to the existing `install` render), `hashManagedAsset` (node:crypto `createHash("sha256")` only). `reDeriveHostConfigDir` re-derives each host `configDir` from the injected home + fixed host-name mapping (codex `.codex`, claude-code `.claude`, opencode `.config/opencode`) and `classifyManifest` requires the recorded path to match (normalized), else `invalid` (redirected-host-path) before any write. Allowlisted writable paths: `<re-derived-config-dir>/.drenyra-managed` and `.drenyra-skills.json` only. |
| 1.3 upgrade engine | `planUpgrade` requires requested version === injected packaged version (else `COMPOSITION_NOT_PACKAGED`); idempotency detected BEFORE timestamps/temp files (requested === hydrated current → `unchanged`, zero writes, `now` never invoked); real upgrade sets `previous` = validated hydrated current snapshot and `current` with `sequence = previous.sequence + 1` (integer); existing managed assets whose bytes differ from the current expectation are `preserved` (never overwritten). Missing/malformed manifest → `MANAGED_STATE_UNKNOWN`, zero writes. |
| 1.4 rollback engine | `planRollback` restores the validated `previous` as `current`, mirrors its `packageVersion` to the top-level `version`, leaves `previous` unchanged (current === previous afterwards → repeated rollback is an exact zero-write no-op); foreign-modified assets preserved + reported. `previous: null` → `ROLLBACK_UNAVAILABLE` (zero writes, current unchanged); missing/malformed manifest → `MANAGED_STATE_UNKNOWN`. |
| 1.5 atomic commit | `commitTransition` validates the complete candidate manifest + asset bytes FIRST (classify + top-level version mirror), stages same-directory temp files (temp + fsync + rename pattern from `file-mission-store.ts`, implemented below `cmd/`), keeps original bytes/existence in memory, commits allowlisted assets, then the manifest LAST. On any synchronous failure after a replacement, already-replaced assets are restored (delete when newly created) and the prior manifest is left/restored; no stale temp survives. The candidate manifest is committed even when all assets were preserved (writes may be empty) — guarded on `plan.status !== "unchanged"` instead of write count. |
| 1.6 doctor diagnostics | `runConfigDiagnostics(home, packagedVersion)` uses only stat/read/hash: `managed-state` (absent → not-applicable ok; invalid → failed), `managed-drift` (byte-compare disk vs `composition.current.managedAssets`, naming `host:asset`; legacy compares marker vs deterministic bytes and skills vs the hydrated disk-derived copy), `package-pin` (recorded vs injected packaged, both stated on mismatch), `host-prerequisites` (config dir + both assets required ONLY for hosts recorded `present: true`, naming each missing `host:item`). No manifest → all checks not-applicable (clean-checkout invariant holds). |
| 1.7 legacy hydration | `hydrateCurrentSnapshot`: legacy → `packageVersion = version`, `sequence = 0`, `activatedAt = installedAt`, marker from the legacy deterministic `{ manager, installedAt }`, skills read only from a present readable managed skills asset (fail-closed `MANAGED_STATE_UNKNOWN` on a REAL transition when no valid prior copy exists), hashes recomputed via SHA-256, `previous = null`. A same-version upgrade on legacy returns `unchanged` WITHOUT rewriting the manifest (no silent schema migration). |
| 1.8 upgrade adapter | `cmd/commands/upgrade.ts` `upgradeCommand(args = [], deps)` — parses `<version>` (missing/non-semver → `usageError` exit 2), `--home` via the shared rule, injects `getPackageMetadata().version` (deps seam for tests), delegates to the library, renders `{ status: "upgraded"\|"unchanged", from, to, results }`; `ManagedConfigError` → exit 1 (JSON via `businessErrorOutput`), other/IO → exit 2 after library restore. Thin; no business rules. |
| 1.9 rollback adapter | `cmd/commands/rollback.ts` `rollbackCommand(args = [], deps)` — `--home` via shared rule, delegates, renders `{ status: "rolled-back"\|"unchanged", from, to, results }`; `ROLLBACK_UNAVAILABLE`/`MANAGED_STATE_UNKNOWN` → exit 1, IO → exit 2. Thin. |
| 1.10 install delegation | `install.ts` delegates `detectHosts`/`homeFromArgs`/`readInstallManifest`/types to the library (re-exported, test-referenced exports intact); new install writes the additive `composition` record (`current` with integer `sequence` 0/`schemaVersion` 1, exact asset hashes/content, `previous: null`) plus the compatibility `version` mirror; an existing composition is preserved across re-installs; foreign-change and never-install-host behavior unchanged. |
| 1.11 sync helpers | `sync.ts` reads state via `readManagedState` and compares markers against `expectedMarkerContent` (composition.current for current-schema; legacy deterministic render otherwise); preservation behavior and the `{ host, action, reason }` shape unchanged; legacy manifests remain readable. |
| 1.12 doctor integration | `doctorCommand(args: string[] = [], deps?)` resolves `--home` via the shared rule, appends the four library config checks AFTER the existing package checks; `{ status, checks, readonly: true }`, package-check order, and `readonly: true` preserved; any failed config check → `status: "degraded"` + exit 1. `capture(doctorCommand)` direct calls remain valid. |
| 1.13 error mapping | `ManagedConfigError` defined in the LIBRARY (no reverse import; the design's "recognition" wording), `businessErrorOutput` recognizes it → `{ error: { code, message, statusCode: 1 } }` exit 1; missing/invalid args stay `usageError` exit 2; unexpected IO → exit 2 after library restore. |
| 1.14 CLI registration | `cmd/cli.ts` registers `upgrade: { run: upgradeCommand }` and `rollback: { run: rollbackCommand }` in the same dispatcher; help lines `upgrade run <version> [--home <dir>]` and `rollback run [--home <dir>]`; unknown-command hint updated to include `doctor run`/`install run`/`sync run`/`upgrade run`/`rollback run`. |
| 2.1 transitions tests | `cmd/__tests__/configurator-transitions.test.ts` — 16 tests: clean legacy A→B upgrade (current=B, previous=exact A, integer sequence increment 0→1, version mirror, assets reflect B, stable report shape, exit 0); B→B byte-for-byte idempotency with `now` that throws if invoked; B→A rollback (mirror A, previous stays A) + second rollback byte-identical exit 0; rollback `previous: null` → `ROLLBACK_UNAVAILABLE` exit 1 bytes unchanged; fail-closed table (missing/malformed/wrong-manager/invalid-hash/redirected-host-path → `MANAGED_STATE_UNKNOWN` exit 1 zero writes); legacy derivation + same-version no-rewrite; foreign marker/skills preserved across upgrade+rollback (current-schema fixture) + sentinel untouched; injected mid-commit failure → exit 2, prior manifest+assets restored, no stale `.tmp.`; not-packaged → `COMPOSITION_NOT_PACKAGED` exit 1 zero writes; boundary compliance (no child_process, library imports node:/skills only, allowlisted-path diff only, contracts + README + LICENSE byte-identical). |
| 2.2 doctor tests | `capabilities-doctor.test.ts` — 6 new tests: marker drift names `claude-code:marker`, exit 1, bytes unchanged, `readonly` true; skills drift names `claude-code:skills`; package-pin states both versions, exit 1; missing config-dir names `claude-code:config-dir` + missing marker names `claude-code:marker` with nothing created; `present: false` entries never become missing-prerequisite failures (all ok, exit 0); malformed manifest fails `managed-state` closed while the full 9-check report (5 package + 4 config) is still emitted with `status: degraded`. Existing clean-checkout + non-root-cwd cases preserved (no-manifest → all not-applicable ok). |
| 2.3 install/sync tests | `install-sync.test.ts` — 2 new tests: new install writes `composition.current` (integer `schemaVersion` 1 + `sequence` 0, exact marker/skills content + 64-hex hashes, `previous: null`, `version` mirror); a legacy (pre-composition) manifest remains readable by `syncManaged` and foreign markers stay `preserved`. |
| 3.x verification | Focused 3-file run 34/34; full suite 61 files/798 passed (774 baseline + 24 new); `bun run typecheck` clean; `bun run build` clean (dist emits `configurator/managed-config.*`, `cmd/commands/upgrade.*`, `rollback.*`); protected-path scan clean; budget check → see deviation 1. |

## Files changed (with authored-line accounting)

| Path | Status | Lines (net authored) |
| --- | --- | ---: |
| `configurator/managed-config.ts` | new | 938 |
| `cmd/commands/upgrade.ts` | new | 83 |
| `cmd/commands/rollback.ts` | new | 71 |
| `cmd/__tests__/configurator-transitions.test.ts` | new | 715 |
| `cmd/__tests__/capabilities-doctor.test.ts` | modified | +242/−1 |
| `cmd/__tests__/install-sync.test.ts` | modified | +96/−0 |
| `cmd/commands/install.ts` | modified (rewrite to delegate) | +68/−89 |
| `cmd/commands/sync.ts` | modified | +13/−14 |
| `cmd/commands/doctor.ts` | modified | +13/−1 |
| `cmd/output/errors.ts` | modified | +14/−0 |
| `cmd/cli.ts` | modified | +13/−1 |
| `openspec/changes/sdd-020-configurator/tasks.md` | modified | checkbox updates (41 rows) |
| `openspec/changes/sdd-020-configurator/apply-progress.md` | new | this file |
| **Net authored total** | | **≈2,160** (gross ≈2,370 incl. deletions) |

No `tsconfig*.json`, `package.json`, root `index.ts`, `contracts/**`, docs, `agents/`, `ledger/`, `receipts/`, `missions/`, `evidence/`, or `skills/` changes.

## Test commands and exact results

- `bun run test -- cmd/__tests__/configurator-transitions.test.ts cmd/__tests__/install-sync.test.ts cmd/__tests__/capabilities-doctor.test.ts` — RED: **3 files failed, 0 tests ran** (module load: `configurator/managed-config.js`, `cmd/commands/upgrade.js`, `cmd/commands/rollback.js` absent) → GREEN: **3 files, 34 tests passed**
- `bun run test` (full suite) — **61 files, 798 tests passed** (774 baseline + 24 new; all green)
- `bun run typecheck` — clean (exit 0); one TS6133 (`DetectedHost` unused import in `install.ts`) caught and fixed during GREEN
- `bun run build` — clean (exit 0); `dist/configurator/managed-config.{js,d.ts}`, `dist/cmd/commands/upgrade.{js,d.ts}`, `dist/cmd/commands/rollback.{js,d.ts}` emitted
- Live CLI smoke (`node dist/cmd/cli.js`): help lists `upgrade run`/`rollback run`; unknown-command hint updated; `upgrade run 0.2.1 --home <tmp>` on a legacy manifest → `{ status: "unchanged" }` exit 0; `rollback run` with `previous: null` → `ROLLBACK_UNAVAILABLE` JSON exit 1; `upgrade run 9.9.9` → `COMPOSITION_NOT_PACKAGED` JSON exit 1; `doctor run` → `healthy`, `readonly: true`, checks `[node-engine, version, contracts, cli, mission-store, managed-state, managed-drift, package-pin, host-prerequisites]`

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1–1.5 + 1.7–1.9 + 1.13 (library + adapters + errors) | `configurator-transitions.test.ts` | Unit | ✅ 774/774 baseline | ✅ 3 files failed to load (modules absent) | ✅ 16/16 after full implementation | ✅ not-packaged, usage-error, second-rollback idempotency, all-preserved commit (manifest still advances) | ✅ commit guard switched from `writes.length === 0` to `plan.status` (manifest-last invariant) |
| 1.6 + 1.12 (doctor diagnostics) | `capabilities-doctor.test.ts` | Unit | ✅ 774/774 baseline | ✅ 6 tests written before `runConfigDiagnostics`/args existed (module load RED) | ✅ 6/6 | ✅ malformed manifest still emits the full report; `present:false` never fails; nothing created | ✅ kept existing package checks + order untouched |
| 1.10 + 1.11 (install/sync) | `install-sync.test.ts` | Unit | ✅ 774/774 baseline | ✅ 2 tests written before composition existed (RED: no `composition` field) | ✅ 2/2 | ✅ legacy sync readability + foreign marker preserved | ✅ re-exported `detectHosts`/`readInstallManifest`/`homeFromArgs` so sync + existing tests keep compiling |

### Test Summary

- **Total tests written**: 24 (16 transitions + 6 doctor + 2 install/sync)
- **Total tests passing**: 798 (full suite, all green)
- **Layers used**: Unit (24); no network, no real host binaries, isolated `mkdtempSync` homes + injected package versions
- **Pure functions created**: `classifyManifest`, `readManagedState`, `readInstallManifest`, `detectHosts`, `reDeriveHostConfigDir`, `homeFromArgs`, `renderManagedMarker`, `renderManagedSkills`, `hashManagedAsset`, `expectedMarkerContent`, `hydrateCurrentSnapshot`, `planUpgrade`, `planRollback`, `commitTransition`, `runConfigDiagnostics`; classes: `ManagedConfigError`

## Deviations from design

1. **Authored-line budget far exceeds the 318-line design estimate.** Net authored ≈2,160 lines (gross ≈2,370) vs the design's 318 (library 120→938, transitions test 66→715, doctor +28→+242, install/sync +24→+96; install.ts became a delegation rewrite). The tasks.md forecast contingency (>400 authored) therefore triggers its documented split boundary: **PR 1 = `configurator/managed-config.ts` + `cmd/commands/upgrade.ts` + `cmd/commands/rollback.ts` + `cmd/output/errors.ts` + `cmd/cli.ts` (+ the transitions test); PR 2 = doctor + install/sync integration (+ their tests)**. This phase did NOT branch, stage, or split anything — parent owns the delivery decision (precedent: fiscal-authority 1A 592-line deviation and 1B-2 gross-overage disclosures). No required coverage was cut: the 14 spec scenarios and 10 task test groups genuinely require this surface; trimming would drop mandated fail-closed/foreign-preservation/atomicity/boundary coverage.
2. **`ManagedConfigError` is defined in the library, not in `cmd/output/errors.ts`.** The layer rule (library must not import `cmd/`) makes a `cmd/`-defined class unthrowable by the library; the design decision D5's wording is "recognition" — `errors.ts` imports and recognizes the library class, emitting `{ error: { code, message, statusCode: 1 } }`.
3. **Legacy skills expectations are disk-derived by design.** A legacy manifest has no recorded skills hash, so hydration trusts a present readable skills file as the prior managed copy (design 1.7 "byte-consistent managed skills asset"); a foreign-modified skills file on a legacy manifest is therefore refreshed on a real upgrade (it equals the hydrated expectation). The recorded-hash foreign-preservation invariant applies to current-schema manifests (where expectations exist) and is proven by the foreign-preservation test. A foreign-modified legacy MARKER is still preserved (deterministic expectation).
4. **`commitTransition` always commits the candidate manifest for a real transition, even with zero asset writes** (e.g. every asset preserved): the composition authority (current/previous/version mirror) must advance even when all host files stay foreign. Guarded on `plan.status`, not write count.
5. **`installIntegrations` preserves an existing composition record across re-installs** (fresh `sequence: 0`/`previous: null` only for a NEW install): a re-install must not destroy recorded transition history. The design does not pin re-install semantics; this is the additive reading of 1.10.
6. **Task 2.1 foreign-preservation fixture uses a current-schema manifest** (recorded expectations) rather than legacy, because only current-schema can prove the recorded-hash preserve invariant (see deviation 3). Legacy marker preservation is covered by the sync test.
7. `doctorCommand` gained an optional `deps.packagedVersion` test seam alongside the mandated `args` parameter (R6 testability requires injecting a packaged version that is not the real package version).
8. tasks.md/config.yaml baseline note ("647 tests, 3 known failures") is stale — actual baseline 774/774 green (Phase 0).

## Remaining tasks (unchecked, persisted in tasks.md)

- Parent-owned: "Start or reuse bounded review for the single SDD-020 candidate after verification is frozen…" — `[ ]` (parent)
- Parent-owned: "Deliver the first slice via a single PR following repository policy; update the SDD-020 change record…" — `[ ]` (parent)
- Deferred to later SDD-020 slices (unchanged from proposal): per-host runtime/model/tool pins (`pinned-ai-runtime`), program-lock-aware install + SDD-010 promoted-artifact resolution, four-host E2E, Drenyra Pi host-serving integration.

## Workload / PR boundary

- **Batch:** SDD-020 first slice, ONE apply unit (this batch), branch `docs/gate0-unblock` (parent-owned branch/PR decision).
- **Budget:** design estimate 318 authored lines; actual ≈2,160 net authored — see deviation 1. The forecast contingency boundary (PR1 = library + upgrade/rollback/errors/cli; PR2 = doctor + install/sync + tests) is the recommended split if the parent does not accept the size exception; this phase made no split.
- **Rollback boundary:** delete `configurator/managed-config.ts`, `cmd/commands/upgrade.ts`, `cmd/commands/rollback.ts`, `cmd/__tests__/configurator-transitions.test.ts`; revert `cmd/commands/{install,sync,doctor}.ts`, `cmd/output/errors.ts`, `cmd/cli.ts`, `cmd/__tests__/{capabilities-doctor,install-sync}.test.ts` to HEAD (8148fc3); revert the 41 tasks.md checkbox rows. Pre-existing dirty README + planning artifacts untouched.

## Protected-path check (Phase 3)

`git status --porcelain` against baseline: the only tracked change outside the planned file set is the PRE-EXISTING `openspec/programs/drenyra-dominion/README.md` (Gate-0 doc, present before this slice). No edit touched `contracts/**`, program-root docs (`README.md`/`LICENSE` at repo root), `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `tsconfig*.json`, `package.json`, or root `index.ts`.

## Spec pass/fail check (Phase 3)

| Req / Scenario | Result | Evidence |
| --- | --- | --- |
| R1 Upgrade Command Surface | PASS | dispatcher + help + tests 2.1 (clean/idempotent/fail-closed) |
| R1-S1 clean current state upgrade | PASS | `upgrade A→B` test |
| R1-S2 idempotent active composition | PASS | byte-for-byte idempotency test (`now` throws) |
| R1-S3 fail closed on unknown state | PASS | fail-closed table (5 manifests) |
| R2 Rollback Command Surface | PASS | dispatcher + help + tests 2.1 |
| R2-S4 restore previous composition | PASS | B→A + second-invocation unchanged |
| R2-S5 no previous → fail closed | PASS | `ROLLBACK_UNAVAILABLE` exit 1 |
| R3 Doctor Diagnostics Depth | PASS | 4 appended read-only checks |
| R3-S6 managed drift detected | PASS | marker + skills drift tests, read-only |
| R3-S7 recorded pin mismatch | PASS | package-pin states both versions, exit 1 |
| R3-S8 missing prerequisite, no install | PASS | host-prerequisites names missing item, creates nothing |
| R4 Composition Record | PASS | additive `composition`, JSON integers, semver strings |
| R4-S9 upgrade then rollback restores | PASS | rollback test (versions strings, sequence integers) |
| R4-S10 never touch contracts/program-root docs | PASS | boundary test snapshots byte-identical |
| R5 Layer and Boundary Compliance | PASS | library below cmd/, node:crypto only, no reverse imports |
| R5-S11 no host install / no authorization decision | PASS | static (no child_process) + runtime (allowlisted diff only) |
| R6 Testability | PASS | isolated homes + injected versions; no network/host binaries |
| R6-S12 full suite runs in isolation | PASS | all 24 tests on `mkdtempSync` homes |
| Out of scope (deferred) | — | `pinned-ai-runtime`, program-lock-aware install, per-host pins, four-host E2E |

## Evidence revision for settlement

SHA-256 over concatenated current contents (in order) of the 11 implementation-candidate files (`configurator/managed-config.ts`, `cmd/commands/upgrade.ts`, `cmd/commands/rollback.ts`, `cmd/commands/install.ts`, `cmd/commands/sync.ts`, `cmd/commands/doctor.ts`, `cmd/output/errors.ts`, `cmd/cli.ts`, `cmd/__tests__/configurator-transitions.test.ts`, `cmd/__tests__/capabilities-doctor.test.ts`, `cmd/__tests__/install-sync.test.ts`):

```
4604499359cc3be63b680c66c68c4f7cb96fc848ad9c034472f96e2a15e1c44d
```

Attempt token `sha256:f7b42e0a1a543fcaa98248cc6b51377b68915353fa7e0db6e5e3ae48030f421e` was parent-acquired; no acquire/settle performed by this phase (per delegation instructions). RDD precedent remains clone-local disabled; no receipt claimed.
