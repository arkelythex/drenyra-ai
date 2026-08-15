# Apply Progress — Host Integration (SDD-020, slice 2 — Slice A: per-host pinned AI runtime)

## Status consumed (openspec store, authoritative)

```yaml
schemaName: gentle-ai.sdd-status (native dispatcher, openspec-backed)
changeName: sdd-020-host-integration
artifactStore: openspec
applyState: ready
taskProgress: { total: 44, completed: 0, pending: 44 } (before this batch)
dependencies.apply: ready
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai]
nextRecommended: apply
blockedReasons: []
```

**Delivery decision (resolved by parent at delegation):** Slice A ships as ONE apply unit on one branch (tasks.md Forecast: `Decision needed before apply: No`, `Chained PRs recommended: Yes`, `Chain strategy: stacked-to-main`, `400-line budget risk: Medium`). This phase performed NO branch/PR/commit work (parent-owned per governance rows).

**Strict TDD:** active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). RED → GREEN per unit was executed and recorded below.

**Attempt token (parent-acquired, slice A):** `sha256:a9677eebf0a15ddd1fa6680519fa13cb93a9091294bd9cd2e5210242e03c236a`. The native status confirmed this token is already active for this work unit; no acquire/settle performed by this phase (per delegation instructions).

**Scope honored:** only `configurator/managed-config.ts`, `cmd/commands/{install,sync,capabilities}.ts`, and `cmd/__tests__/{install-sync,configurator-transitions,capabilities-doctor}.test.ts`, plus tasks.md checkboxes and this apply-progress. `cmd/commands/doctor.ts` required NO edit: `runConfigDiagnostics` now returns the appended `pinned-ai-runtime` check and doctor.ts pushes the whole array (task 1.7 adapter row satisfied by the library). No `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`, `tsconfig*.json`, `package.json`, or root `index.ts` touched. No `drenyra-pi` code or host-union change (Slice B boundary respected).

## Phase 0 evidence

- **Revision frozen:** `git rev-parse HEAD` = `331ca3ddbec608529fbe8d805903d952e4826875` (branch `main`, `chore(release): prepare v0.3.0`; tag v0.3.0 pushed). Working tree at baseline: only pre-existing `?? drenyra-ai-0.3.0.tgz` + `?? openspec/changes/sdd-020-host-integration/` (planning artifacts); no tracked source file mutated before baseline capture. `configurator/managed-config.ts` at baseline exported `COMPOSITION_SCHEMA_VERSION = 1`, private `ASSET_FILENAMES = { marker, skills }`, `ManagedCompositionSnapshot` with only `managedAssets.marker|skills`, and `runConfigDiagnostics` returning four basic checks — the exact extension points confirmed.
- **Green baseline:** `bun run test` → **64 files, 843 passed / 843 green, exit 0**. (tasks.md/config.yaml note about "647 tests, 3 known pre-existing failures" is stale, same as slice 1; actual baseline has zero known failures.) No failure is attributable to this change.
- **Protected paths:** `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**` — confirmed no task lists any as an edit target; final scan (Phase 3) confirmed none was touched.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

Phase 0 (3/3), Phase 1 (14/14 rows 1.1–1.10), Phase 2 (16/16 rows 2.1–2.4), Phase 3 (5/5) — **42/44 rows `[x]`**. The two parent-owned lifecycle rows remain `[ ]` (bounded review + stacked-to-main A→B PR delivery).

| Task | Summary |
| --- | --- |
| 1.1 pin types + version domain | `PinVersion = number \| \`${number}.${number}.${number}${string}\``,`ComponentPin { id; version }`,`PinnedAiRuntimeRecord { kind: "pinned-ai-runtime"; schemaVersion: 1; host; runtime; model; tool }` (canonical property order), `PinnedAiCompositionValues`,`ManagedHostPin { record; managedAsset }`,`PinnedComposition = Partial<Readonly<Record<HostName, ManagedHostPin>>>`.`isPinVersion` enforces integer ≥ 0 or `SEMVER_RE` strings (empty/non-semver/float/negative/non-finite rejected). Runtime record validation in `isPinnedComposition` rejects floats, negative integers, non-semver strings, render/host mismatches, bad hashes. |
| 1.2 constants + rendering | `PINNED_AI_COMPOSITION` exported `as const satisfies Readonly<Record<HostName, PinnedAiCompositionValues>>`, exhaustive over codex/claude-code/opencode (Slice B cannot compile without a `drenyra-pi` entry). Deep-frozen at runtime (`deepFreeze`) so no caller can mutate release data; `pinnedAiRuntimeRecord` copies every `ComponentPin` so records never share object references with the constant (discovered + fixed during TDD — see deviation 3). `renderPinnedAiRuntime` = `JSON.stringify(record, null, 2)` with no trailing newline; `managedHostPin` = record + SHA-256 asset bytes. Commands receive no override seam. |
| 1.3 snapshot + schema v2 | `ASSET_FILENAMES.pin = ".drenyra-pinned-ai-runtime.json"` (typed via `ManagedAssetName`, now exported), `ManagedCompositionSnapshot.pinnedComposition?: PinnedComposition`, `COMPOSITION_SCHEMA_VERSION = 2`. Schema-1 snapshots (no pins) remain readable; schema-2 validates every present pin entry strictly in `isSnapshot` (map key === record.host, content === `renderPinnedAiRuntime(host)`, SHA-256 recompute, versions via `isPinVersion`); invalid → manifest `invalid`. Never synthesizes pin bytes for pre-pin snapshots. |
| 1.4 install rendering | `install.ts` (thin adapter): per present host, create the pin file ONLY when absent (exact rendered bytes via `renderPinnedAiRuntime`), recording a `pinnedComposition` entry only for hosts actually created; existing bytes are preserved and recorded as unmanaged (never adopted by coincidence). Fresh installs write schema-2 with `pinnedComposition`; an existing pin-capable composition is preserved across re-installs. Manifest still written last; no host dir is created and no host binary is invoked. |
| 1.5 sync rendering | `sync.ts` `syncManaged` now reconciles recorded pin assets using only `composition.current.pinnedComposition` as authority: exact bytes → `synced`, missing managed pin → recreated + `synced`, unequal/unreadable → `preserved`. `SyncResult` gained `asset: ManagedAssetName` (`"marker"`/`"pin"`) so pin actions are unambiguous. Hosts without a managed entry are never written; unmanaged pin files are reported foreign/preserved; pre-pin manifests stay pin-not-applicable (no historical bootstrapping). |
| 1.6 transition participation | `hydrateCurrentSnapshot` returns `pinsAvailable` (true only when every recorded-present host has a valid managed pin entry); legacy hydration stays `pinsAvailable: false`. `planUpgrade` keeps the same-version early return; a real transition requires both `skillsAvailable` and `pinsAvailable` (else `MANAGED_STATE_UNKNOWN`, zero writes) and builds the target `pinnedComposition` from the executing package's constants (`packagePinnedComposition`). `planRollback` requires complete pins in BOTH current and previous snapshots (else `MANAGED_STATE_UNKNOWN`), keeping `ROLLBACK_UNAVAILABLE` for `previous: null`. `planAssetTransitions` processes per-host `pin` alongside marker/skills (missing → created, equal → updated, unequal/unreadable → preserved; absent config dir → `missing`). `sameManagedAssets` includes pin comparison for rollback idempotency. `commitTransition` stage-and-restore already covers the pin file generically (proven by the injected-failure test). |
| 1.7 doctor diagnostic | `ConfigDiagnostic` is now a discriminated union: `BasicConfigDiagnostic` (the four existing checks) + `PinnedAiRuntimeDiagnostic { name: "pinned-ai-runtime"; ok; detail; applicability: "applicable"\|"not-applicable"\|"unverifiable"; hosts: readonly HostPinDiagnostic[] }` with `HostPinState = "managed" \| "drift" \| "foreign" \| "absent"`. `classifyPinnedRuntime` classifies per recorded-present host in the mandated order (managed entry + missing file → absent; unreadable/unequal → drift, preserved; exact → managed; no entry + file exists → foreign with "user-authored; unmanaged; preserved; not adopted"). Healthy only when every emitted host is `managed`; pre-pin → not-applicable healthy (never invents bytes); no manifest → not-applicable healthy; invalid manifest → unverifiable failed. `runConfigDiagnostics` appends the check after host-prerequisites; `doctor.ts` needed no edit (read-only, `{ status, checks, readonly }`, exit 0/1 convention preserved). |
| 1.8 pre-pin fail-closed | Pre-pin (schema-1, no `pinnedComposition`) manifests remain readable by install/sync/doctor/upgrade/rollback. Install/sync/doctor report pin-not-applicable without inventing bytes. A real upgrade or rollback that requires unavailable prior pin bytes fails `MANAGED_STATE_UNKNOWN` with zero writes; same-version upgrade stays an unchanged no-op (idempotency precedes the pins check). No placeholder hash, empty content, package render, or disk bytes are inserted into an old snapshot as historical pin state. |
| 1.9 foreign preservation + boundary | A disk pin with no `snapshot.pinnedComposition` entry is `foreign` even when its bytes equal the current package render — ownership is established only by the manifest, never by byte coincidence; preserved byte-for-byte and never adopted/overwritten/moved/deleted by install, sync, upgrade, rollback, or doctor. All pin types/constants/rendering/validation/classification/transition policy live in `configurator/managed-config.ts`; library imports only `node:crypto`/`node:fs`/`node:path` + `../skills/index.js` (no reverse imports, enforced by the boundary test). No host binary or package manager invoked; no authorization/fiscal decision made or reported; no frozen contract/program-root doc/monetary value mutated; no coupling to `drenyra-pi`. Every pin write target re-derived from injected home + fixed host map; redirected recorded paths fail closed at read time (`invalid`) AND at plan time (defense-in-depth re-check) with a machine-readable error before any write. |
| 1.10 capabilities wording | `cmd/commands/capabilities.ts` integrations entry changed from `"Codex/Claude Code/OpenCode (planned)"` to `"Codex/Claude Code/OpenCode (managed marker/skills/pin configuration)"` — no longer "(planned)", reflects that the configurator renders managed host markers/skills/pins, and makes NO claim of Drenyra Pi host-serving or program-lock-aware install. Wording-only (no capability surface, no new flags). |
| 2.1 install/sync tests | 4 new tests in `install-sync.test.ts` (scenarios 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 5.1): per-present-host pin creation with kind/schemaVersion/host/runtime/model/tool + float/negative/non-semver/non-finite rejection fixtures; deterministic byte-identical rendering across disk/snapshot/repeat + SHA-256 recompute + exhaustive constant keys; sync recreation of a deleted managed pin (`asset: "pin"`, `synced`) + foreign pin preserved (`preserved`) with no managed entry; isolation (no missing host dir created, no `child_process`/`spawn`/`execSync`/`fetch` seams in install/sync/library). Existing composition-record test updated: schemaVersion 1→2 + `pinnedComposition` content assertions. |
| 2.2 transitions tests | Extended fixtures (`snapshot`/`currentSchemaManifest`/`writeHostAssets` gain pins; `pins: false` opt for pre-pin fixtures) + 2 new tests (pre-pin fail-closed: same-version unchanged no-op, real upgrade + pinless rollback `MANAGED_STATE_UNKNOWN` zero writes; fail-closed table gains a pinned-redirect case). Updated: upgrade A→B records B pin constants as current and A's exact pin records/bytes as previous with `asset: "pin"` results; rollback restores previous exact pin bytes + second-rollback idempotency; foreign marker/skills/pin preserved across upgrade+rollback (reported preserved, bytes untouched, sentinel untouched); atomic injected failure restores manifest, marker, skills, AND pin file with no stale `.tmp.`; boundary allowlist now includes the pin path; legacy real-upgrade test converted to fail-closed (`MANAGED_STATE_UNKNOWN`, zero writes, no schema migration) per spec R1/S3. |
| 2.3 doctor tests | 10 new tests in `capabilities-doctor.test.ts` (scenarios 3.1–3.5, 5.2): managed (applicable/healthy/exit 0); drift for unequal AND unreadable bytes (degraded, bytes unchanged, exit 1); foreign (distinct state, detail contains user-authored/unmanaged/preserved/not-adopted, bytes unchanged, exit 1); absent (no file created, exit 1); pre-pin (healthy/not-applicable/empty hosts, nothing written, exit 0); no-manifest not-applicable exit 0; invalid pin record (float version) → managed-state fails closed, pin unverifiable, full report emitted, exit 1; multi-host matrix (every recorded-present host named; any non-managed state fails the aggregate; present:false excluded) both failing and healthy variants; capabilities wording regression (no "(planned)" for hosts, "managed" present, no Pi host-serving/program-lock claims, MCP stays planned). |
| 2.4 isolation/boundary | Covered by the Phase 2 suites: pin tests run against injected `--home` temp dirs with no network, no real user home, no real host process; renders byte-comparable; classification tests assert exit codes and JSON report shape; boundary tests assert no host binary seam and allowlisted paths (pin path included). |
| 3.x verification | Focused 3-file run 50/50; full suite 64 files/859 passed (843 baseline + 16 new; all green); `bun run typecheck` clean; `bun run build` clean; protected-path scan clean; budget check → see deviation 1. |

## Files changed (with authored-line accounting)

| Path | Status | Lines (insertions / deletions) |
| --- | --- | ---: |
| `configurator/managed-config.ts` | modified | +484 / −76 |
| `cmd/commands/sync.ts` | modified | +133 / −65 |
| `cmd/__tests__/capabilities-doctor.test.ts` | modified | +405 / −27 |
| `cmd/__tests__/configurator-transitions.test.ts` | modified | +214 / −88 |
| `cmd/__tests__/install-sync.test.ts` | modified | +233 / −3 |
| `cmd/commands/install.ts` | modified | +17 / −0 |
| `cmd/commands/capabilities.ts` | modified | +3 / −1 |
| `openspec/changes/sdd-020-host-integration/tasks.md` | modified | checkbox updates (42 rows) |
| `openspec/changes/sdd-020-host-integration/apply-progress.md` | new | this file |
| **Net authored total (source + tests)** | | **+1,489 insertions / −260 deletions (gross ≈1,749)** |

No `tsconfig*.json`, `package.json`, root `index.ts`, `contracts/**`, docs, `agents/`, `ledger/`, `receipts/`, `missions/`, `evidence/`, `journal/`, `flow/`, or `skills/` changes.

## Test commands and exact results

- `bun run test -- cmd/__tests__/install-sync.test.ts` — RED: **4 failed / 6 passed** (missing exports + schemaVersion 1→2 + no `asset` field) → GREEN: **10/10**
- `bun run test -- cmd/__tests__/configurator-transitions.test.ts` — RED: **5 failed / 13 passed** (pins not yet in transitions) → GREEN: **18/18**
- `bun run test -- cmd/__tests__/capabilities-doctor.test.ts` — RED: **10 failed / 12 passed** (no pinned-ai-runtime check, wording still planned) → GREEN: **22/22** (after fixing the shared-constant mutation bug, see deviation 3)
- Focused 3-file run: **3 files, 50 tests passed**
- `bun run test` (full suite) — **64 files, 859 tests passed** (843 baseline + 16 new; all green)
- `bun run typecheck` — clean (exit 0)
- `bun run build` — clean (exit 0; `dist/` emits unchanged surface + new exports)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1–1.5 (types/constants/render/validation + install/sync) | `install-sync.test.ts` | Unit | ✅ 843/843 | ✅ 4 failed | ✅ 10/10 | ✅ 3 present hosts, version rejection matrix, foreign-preservation path, deterministic-render path | ✅ schema-2 assertion updated in existing test; `ASSET_FILENAMES` exported for adapters |
| 1.6 (transitions + hydration) | `configurator-transitions.test.ts` | Unit | ✅ 843/843 | ✅ 5 failed | ✅ 18/18 | ✅ pre-pin fail-closed (upgrade AND rollback), pinned-redirect case, rollback idempotency | ✅ `packagePinnedComposition`/`pinsComplete`/`samePinnedComposition` helpers extracted |
| 1.7 (doctor) + 1.10 (wording) | `capabilities-doctor.test.ts` | Unit | ✅ 843/843 | ✅ 10 failed | ✅ 22/22 | ✅ 5 classification states + invalid + matrix + wording | ✅ classification extracted to `classifyPinnedRuntime`; union kept backward-compatible with `HealthCheck` |
| 1.8/1.9 (fail-closed, foreign, boundary) | both transition + install/sync suites | Unit | ✅ 843/843 | ✅ via RED above | ✅ via GREEN above | ✅ legacy real-upgrade fail-closed; redirect-with-pins; allowlist with pin path | ✅ pre-pin fixture reused via `pins: false` opts |

### Test Summary

- **Total tests written (new)**: 16 (install-sync +4, transitions +2, capabilities-doctor +10); suite went 843 → 859
- **Total tests passing**: 859 (full suite, all green)
- **Layers used**: Unit (16); no network, no real host binaries, isolated `mkdtempSync` homes + injected package versions
- **Pure functions created**: `isPinVersion`, `deepFreeze`, `pinnedAiRuntimeRecord`, `renderPinnedAiRuntime`, `managedHostPin`, `isComponentPin`, `isPinnedComposition`, `pinsComplete`, `packagePinnedComposition`, `samePinnedComposition`, `classifyPinnedRuntime`

## Deviations from design

1. **Authored-line budget far exceeds the 223-line design estimate and the 400-line hard cap.** Net authored ≈+1,489 insertions / −260 deletions (gross ≈1,749). The design's 169–223 estimate severely under-forecast the mandated Phase-2 test surface (16 spec scenarios, 15 RED test rows) and the library's validation/classification surface. Precedent: slice 1 (318 estimate → ≈2,160 actual) was accepted with a deviation note and a parent-owned PR split. Per tasks.md Phase 3 the >400 contingency would "promote the A→B split to two chained PRs" — but Slice A is already the split (B is a separate unit, untouched), so this phase makes NO further split and takes NO delivery action: the parent owns the PR/boundary decision. No required coverage was cut; test fixtures were reused (helpers extended, not duplicated) to keep the diff as lean as possible. `cmd/commands/doctor.ts` required zero edits (library append only).
2. **Legacy real-upgrade behavior change (spec-mandated).** A real upgrade from a legacy/pre-pin manifest now fails `MANAGED_STATE_UNKNOWN` (no prior pin bytes to preserve), per spec R1 scenario 3 and design D7 — the slice-1 test "derives A from legacy fields on upgrade" was converted to a fail-closed test; legacy same-version upgrade idempotency is unchanged.
3. **Shared-constant mutation bug found by TDD (RED→GREEN fix).** `pinnedAiRuntimeRecord` originally spread `PINNED_AI_COMPOSITION[host]`, sharing `ComponentPin` object references; a test that mutated a rendered record's `runtime.version` corrupted the package constant for all later renders (cross-test pollution). Fixed by copying each ComponentPin in the record builder AND deep-freezing the constant (`deepFreeze`), so no caller can mutate release data. Added to the test suite implicitly (the invalid-pin fixture now runs after other pin tests without pollution).
4. **`ASSET_FILENAMES` is now exported** (was module-private) so the thin `install`/`sync` adapters can reference `ASSET_FILENAMES.pin` instead of hardcoding the filename; `ManagedAssetName` (already exported) now includes `"pin"`.
5. **`SyncResult` gained a required `asset: ManagedAssetName` field** (design D5 allowed "or add an asset field"): marker results are `asset: "marker"`, pin results `asset: "pin"`, `not-installed`/`missing` marker-shaped results carry `asset: "marker"`. Existing tests use field access (`.action`), so the additive field is backward compatible.
6. **`doctor.ts` untouched** — task 1.7's adapter row is satisfied because `runConfigDiagnostics` returns the appended `pinned-ai-runtime` check and doctor.ts spreads the whole array; the existing `HealthCheck` structural type accepts the extra `applicability`/`hosts` fields.
7. tasks.md/config.yaml baseline note ("647 tests, 3 known failures") is stale — actual baseline 843/843 green (Phase 0).

## Remaining tasks (unchecked, persisted in tasks.md)

- Parent-owned: "Start or reuse bounded review for the Slice A candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed…)" — `[ ]` (parent)
- Parent-owned: "Deliver Slice A via a PR to `main` following repository policy, then open Slice B as a second PR to `main` (stacked-to-main chain A→B); update the SDD-020 change record…" — `[ ]` (parent)
- Deferred (Slice B/C, unchanged): `drenyra-pi` host union/map/detection + `PINNED_AI_COMPOSITION` exhaustiveness, capability wording per design (already partially reconciled in A via 1.10), four-host `install → doctor → sync → upgrade → rollback` lifecycle flow, program-lock-aware install (slice C).

## Workload / PR boundary

- **Batch:** SDD-020 slice 2 Slice A, ONE apply unit (this batch), branch `main` (parent-owned PR decision; this phase created no branch).
- **Budget:** design estimate 169–223 authored lines; actual gross ≈1,749 (net +1,489/−260) — see deviation 1. The 400-line cap is exceeded by Slice A alone; per the tasks Phase-3 contingency and the slice-1 precedent, the parent owns whether to accept the size exception or split further; this phase made no split. The A→B boundary itself is intact (no Slice B surface touched).
- **Rollback boundary:** revert `configurator/managed-config.ts`, `cmd/commands/{install,sync,capabilities}.ts`, `cmd/__tests__/{install-sync,configurator-transitions,capabilities-doctor}.test.ts` to HEAD (331ca3d); revert the 42 tasks.md checkbox rows. Pre-existing untracked `drenyra-ai-0.3.0.tgz` + planning artifacts untouched.

## Protected-path check (Phase 3)

`git status --porcelain` against baseline: the only tracked changes are the 7 planned files. No edit touched `contracts/**`, program-root docs (`README.md`/`LICENSE`), `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`, `tsconfig*.json`, `package.json`, or root `index.ts`. Pre-existing untracked `drenyra-ai-0.3.0.tgz` and `openspec/changes/sdd-020-host-integration/` unchanged in nature.

## Spec pass/fail check (Phase 3)

| Req / Scenario | Result | Evidence |
| --- | --- | --- |
| R1 Per-Host Pin Record | PASS | types/constants/validation (1.1–1.3) |
| R1-S1 managed pin record creation for a present host | PASS | install test 1 (record kind/schemaVersion/host/runtime/model/tool) |
| R1-S2 pin version fields never use floats | PASS | `isPinVersion` rejection matrix (float/negative/NaN/Infinity/non-semver) + invalid-manifest doctor test (float → invalid) |
| R1-S3 pre-pin manifest not assigned invented pin bytes | PASS | pre-pin fail-closed test (upgrade + rollback `MANAGED_STATE_UNKNOWN`, zero writes) + legacy real-upgrade fail-closed |
| R2 Deterministic Pin Rendering Through Install and Sync | PASS | 1.2/1.4/1.5 |
| R2-S1 install renders managed pin for every present host | PASS | install test 1 (one pin file per present host; absent host none) |
| R2-S2 sync recreates a missing managed pin | PASS | install-sync test 3 (deleted pin recreated, `asset: "pin"`/`synced`) |
| R2-S3 renderings byte-identical across commands | PASS | install-sync test 2 (disk === snapshot content === repeat render === sync) |
| R2-S4 upgrade and rollback preserve foreign pin bytes | PASS | foreign preservation test (upgrade + rollback, `preserved`, bytes untouched) |
| R3 Doctor Pin Surfacing | PASS | 1.7 + doctor tests |
| R3-S1 doctor reports a managed pin | PASS | managed test (applicable/healthy, state managed, exit 0) |
| R3-S2 doctor reports managed pin drift | PASS | drift test (unequal + unreadable → drift, bytes unchanged, exit 1) |
| R3-S3 doctor reports a foreign pin distinctly and preserves it | PASS | foreign test (state foreign, detail keywords, bytes unchanged, exit 1) |
| R3-S4 doctor reports an absent managed pin | PASS | absent test (state absent, nothing created, exit 1) |
| R3-S5 doctor stays healthy for a pre-pin manifest | PASS | pre-pin test (healthy/not-applicable/empty hosts, nothing written, exit 0) |
| R4 Boundary and Invariant Compliance | PASS | 1.9 + boundary/isolation tests |
| R4-S1 pin operations never install a host and never touch foreign bytes | PASS | isolation test (no missing host dir, no host binary seam) + foreign preservation across install/sync/upgrade/rollback |
| R4-S2 pin writes target only re-derived managed paths | PASS | redirected-path fail-closed (legacy + pinned variants, machine-readable error, zero writes) + allowlist assertion with pin path |
| R5 Testability | PASS | 2.1–2.4 (isolated homes, no network, no real host processes, exit codes + JSON shape asserted) |
| R5-S1 the pin suite runs in isolation | PASS | all pin tests on `mkdtempSync` homes with injected versions |
| R5-S2 doctor classification matrix is fully covered | PASS | managed/drift/foreign/absent/pre-pin each asserted by name, per-host classification, and exit code |
| Out of scope (deferred) | — | Drenyra Pi host union/map/detection, capability wording per design (partially delivered via 1.10 wording fix), program-lock-aware install (slice C), four-host lifecycle flow (Slice B) |

## Evidence revision for settlement

SHA-256 over concatenated current contents (in order) of the 7 implementation-candidate files (`configurator/managed-config.ts`, `cmd/commands/install.ts`, `cmd/commands/sync.ts`, `cmd/commands/capabilities.ts`, `cmd/__tests__/install-sync.test.ts`, `cmd/__tests__/configurator-transitions.test.ts`, `cmd/__tests__/capabilities-doctor.test.ts`):

```
850a62e9d60a26ceef9f3e9d8332299d59f0cfa4eaa7e12207e26537013889ba
```

Attempt token `sha256:a9677eebf0a15ddd1fa6680519fa13cb93a9091294bd9cd2e5210242e03c236a` was parent-acquired and already active per native status; no acquire/settle performed by this phase (per delegation instructions). RDD-off clone-local precedent followed (same as SDD-020 configurator slice and SDD-030); no receipt claimed.

---

# Slice B Record — Drenyra Pi host and four-host lifecycle (SDD-020 slice 2B, separate apply unit)

> Appended on top of the Slice A record above (A record preserved verbatim — MERGED, not overwritten). This is the second apply unit of SDD-020 slice 2, delivered after Slice A merged to `main` via #46.

## Status consumed (openspec store, authoritative)

```yaml
schemaName: gentle-ai.sdd-status (native dispatcher, openspec-backed)
changeName: sdd-020-host-integration
artifactStore: openspec
applyState: ready
dependencies.apply: ready
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai]
nextRecommended: apply
blockedReasons: []
```

**Delivery decision (resolved by parent at delegation):** Slice B ships as the second stacked-to-main unit after #46 (tasks.md Forecast: `Chained PRs recommended: Yes`, `Chain strategy: stacked-to-main`, `400-line budget risk: Medium` for combined A+B; B alone ≈ +445/−27 gross ≈ 472 including the mandated four-host E2E test surface). This phase performed NO branch/PR/commit work (parent-owned per governance rows).

**Strict TDD:** active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`). RED → GREEN per unit executed and recorded below.

**Attempt token (parent-acquired, slice B):** `sha256:9745a972867ee0c5a4796970a7e1325e84497a11b03bc50c3a7e2a77b8842a99`. Recorded here per delegation; no acquire/settle performed by this phase (per delegation instructions).

**Scope honored:** only `configurator/managed-config.ts`, `cmd/commands/capabilities.ts`, and `cmd/__tests__/{install-sync,configurator-transitions,capabilities-doctor}.test.ts`, plus tasks.md B-scope checkboxes and this apply-progress record. Per the design boundary, `cmd/commands/install.ts`, `cmd/commands/sync.ts`, and `cmd/commands/doctor.ts` required NO edit in B: the Pi host flows through `HOST_DIR_MAP`/`detectHosts`/`runConfigDiagnostics` automatically. No `contracts/**`, program-root docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`, `tsconfig*.json`, `package.json`, or root `index.ts` touched. No `drenyra-pi` code imported/invoked and no host-serving integration (that is the pi session's side).

## Phase 0 evidence (B)

- **Revision frozen:** `git rev-parse HEAD` = `14fd4bd1a5a74bbbf19f45e90e1c475f9d292849` (`feat(configurator): per-host pinned runtime composition (SDD-020 slice 2A)`, main after #46). Working tree at baseline: only pre-existing `?? drenyra-ai-0.3.0.tgz`; no tracked source file mutated before baseline capture. `configurator/managed-config.ts` at baseline: `HostName = "codex" | "claude-code" | "opencode"`, `HOST_DIR_MAP` 3 entries, `PINNED_AI_COMPOSITION` exhaustive over 3 hosts (its comment explicitly noted "forces Slice B to add a reviewed `drenyra-pi` entry before it can compile"), `isHostName` 3 literals.
- **Green baseline:** `bun run test` → **64 files, 859 passed / 859 green, exit 0** (843 slice-1 baseline + 16 slice-A tests).
- **Protected paths:** same allowlist as A; no B task lists a protected path as an edit target; final scan confirmed none touched.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

Slice B rows B.1–B.6 (7 implementation rows) all `[x]`; the two parent-owned lifecycle rows remain `[ ]` (unchanged from A).

| Task | Summary |
| --- | --- |
| B.1 host union/map/isHostName | `HostName = "codex" \| "claude-code" \| "opencode" \| "drenyra-pi"`; `HOST_DIR_MAP["drenyra-pi"] = ".drenyra"` with an in-code decision note: the canonical Pi config directory is the Drenyra-managed home `~/.drenyra` (where the managed manifest already lives); presence of the Pi host = existence of that home; drenyra-ai manages only the marker/skills/pin assets for a present Pi host, never Pi host-serving. `isHostName` accepts the fourth literal. |
| B.1 exhaustive composition | `PINNED_AI_COMPOSITION["drenyra-pi"] = { runtime: { id: "drenyra-pi", version: 1 }, model: { id: "drenyra-pi-package-default", version: 1 }, tool: { id: "drenyra-ai-host-tools", version: 1 } }` (integer versions; package-owned release data) — the constant is now exhaustive over the 4 hosts and `satisfies Readonly<Record<HostName, PinnedAiCompositionValues>>` still enforces future union/constant parity. Stale "three hosts"/"forces Slice B" wording updated. No adapter edits needed: `install`/`sync`/`doctor`/`upgrade`/`rollback` enumerate hosts via `HOST_DIR_MAP`/`detectHosts`, so the Pi host is detected, rendered, reconciled, and classified automatically. |
| B.2 capability wording | `capabilities.ts` integrations entry: `"Codex/Claude Code/OpenCode/Drenyra Pi (managed marker/skills/pin configuration)"` — all four hosts named, still no "(planned)" for hosts, and still NO claim of Pi host-serving or program-lock-aware install. Wording-only (no capability surface, no new flags). |
| B.3 install/sync tests | 2 new tests in `install-sync.test.ts`: (a) `drenyra-pi` detected present when `~/.drenyra` exists and install renders its marker/skills/pin with a recorded managed entry (exact bytes + SHA-256); (b) all four hosts configured with one deterministic pin file each, `pinnedComposition` keys = the four hosts, absent dirs untouched. Existing exhaustive-keys assertion updated to the four-host list. |
| B.4 doctor tests | 2 new tests + 1 updated wording regression in `capabilities-doctor.test.ts`: (a) four-host fully-managed matrix → healthy, applicable, 4 hosts each `managed`, exit 0; (b) `drenyra-pi` drift (user-authored bytes preserved) then absent (nothing created) named distinctly, exit 1; (c) capabilities wording regression now asserts all four hosts (incl. "Drenyra Pi") are named while host-serving/program-lock claims stay absent and MCP stays "(planned)". Local `HOST_DIR`/`FixtureHostName`/`currentSchema` fixtures extended with the Pi dir. |
| B.5 four-host E2E | 1 new test in `configurator-transitions.test.ts`: full acceptance flow `install → doctor → sync → upgrade → rollback` across codex, claude-code, opencode, and drenyra-pi — install detects/configures all four with deterministic pin bytes; doctor healthy exit 0 (all `managed`); sync all `synced` (marker + pin per host); upgrade A→B updates all four marker/skills/pin with B bytes (current=B, previous=A, sequence 1 integer); rollback restores A bytes for all four (marker = `renderManagedMarker(INSTALLED)`, pin = `renderPinnedAiRuntime(host)`); second rollback exact zero-write unchanged. Local fixtures extended with the Pi dir. |
| B.6 verification | Focused 3-file run 55/55; full suite 64 files / 864 passed (859 baseline + 5 new; all green); `bun run typecheck` clean; `bun run build` clean; protected-path scan clean (git status shows only the 5 planned source/test files + pre-existing untracked tgz). |

## Files changed (with authored-line accounting)

| Path | Status | Lines (insertions / deletions) |
| --- | --- | ---: |
| `configurator/managed-config.ts` | modified | +31 / −12 |
| `cmd/commands/capabilities.ts` | modified | +1 / −1 |
| `cmd/__tests__/install-sync.test.ts` | modified | +94 / −1 |
| `cmd/__tests__/configurator-transitions.test.ts` | modified | +189 / −1 |
| `cmd/__tests__/capabilities-doctor.test.ts` | modified | +130 / −12 |
| `openspec/changes/sdd-020-host-integration/tasks.md` | modified | B-scope checkbox rows + header note |
| `openspec/changes/sdd-020-host-integration/apply-progress.md` | modified | this B record (appended, A record preserved) |
| **Net authored total (source + tests)** | | **+445 insertions / −27 deletions (gross ≈472)** |

No `tsconfig*.json`, `package.json`, root `index.ts`, `contracts/**`, docs, `agents/`, `ledger/`, `receipts/`, `missions/`, `evidence/`, `journal/`, `flow/`, or `skills/` changes; `dist/` is a generated build output (gitignored).

## Test commands and exact results

- `bun run test -- cmd/__tests__/install-sync.test.ts` — RED: **3 failed / 9 passed** (type-level: `"drenyra-pi"` not in `HostName`; runtime: `PINNED_AI_COMPOSITION` keys 3 vs 4, only 3 present hosts detected) → GREEN: **12/12**
- `bun run test -- cmd/__tests__/capabilities-doctor.test.ts` — RED: **3 failed / 21 passed** (wording lacks "Drenyra Pi"; `renderPinnedAiRuntime("drenyra-pi")`/`managedHostPin` TypeError from missing constant entry) → GREEN: **24/24**
- `bun run test -- cmd/__tests__/configurator-transitions.test.ts` — RED: **1 failed / 18 passed** (four-host E2E: only 3 present hosts detected) → GREEN: **19/19**
- Focused 3-file run: **3 files, 55 tests passed**
- `bun run test` (full suite) — **64 files, 864 tests passed** (859 baseline + 5 new; all green)
- `bun run typecheck` — clean (exit 0)
- `bun run build` — clean (exit 0)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B.1 union/map/isHostName + composition | `install-sync.test.ts` | Unit | ✅ 859/859 | ✅ 3 failed | ✅ 12/12 | ✅ Pi-present detection, four-host install, exhaustive keys, absent dirs untouched | ✅ canonical Pi dir documented in `HOST_DIR_MAP`; stale comments updated |
| B.2 capability wording | `capabilities-doctor.test.ts` | Unit | ✅ 859/859 | ✅ wording assertion failed | ✅ 24/24 | ✅ four hosts named; host-serving/program-lock still rejected | ✅ wording regression rewritten for B (old regex rejected "Drenyra Pi" — intentionally replaced) |
| B.4 doctor four-host matrix | `capabilities-doctor.test.ts` | Unit | ✅ 859/859 | ✅ 3 failed | ✅ 24/24 | ✅ fully-managed 4-host healthy + Pi drift/absent distinct states | ✅ local fixtures extended (no duplication) |
| B.5 four-host lifecycle E2E | `configurator-transitions.test.ts` | Unit | ✅ 859/859 | ✅ 1 failed | ✅ 19/19 | ✅ install→doctor→sync→upgrade→rollback over all 4 hosts + second-rollback idempotency | ✅ reused `HOST_DIR`/`snapshotFiles`/`capture` fixtures |

### Test Summary

- **Total tests written (new)**: 5 (install-sync +2, capabilities-doctor +2 new +1 updated, transitions +1); suite went 859 → 864
- **Total tests passing**: 864 (full suite, all green)
- **Layers used**: Unit (5); no network, no real host binaries, isolated `mkdtempSync` homes + injected package versions; the four-host E2E drives the real `installIntegrations`/`syncManaged`/`doctorCommand`/`upgradeCommand`/`rollbackCommand` adapters against one injected home
- **Pure data added**: `PINNED_AI_COMPOSITION["drenyra-pi"]` entry; no new functions required (the A engine already generalized over `HostName`)

## Deviations from design

1. **Authored-line estimate exceeded again (design 120–200 → actual gross ≈472).** The design's Slice B estimate under-forecast the mandated four-host E2E acceptance flow plus the doctor matrix extension (same pattern as A: the mandated test surface dominates). No required coverage was cut; fixtures were extended, not duplicated. The parent owns the PR/boundary decision (stacked-to-main B PR per the Forecast); this phase takes no delivery action.
2. **No adapter edits in B.** Design expected "existing configurator/command tests, and one four-host lifecycle test" and no adapter changes; confirmed in practice — `install.ts`/`sync.ts`/`doctor.ts` needed zero edits because host enumeration is library-driven (`HOST_DIR_MAP` + `detectHosts` + `runConfigDiagnostics`). The Pi host participates in install/sync/doctor/upgrade/rollback automatically.
3. **Slice A's wording regression test was intentionally updated.** A's test asserted the integrations string does NOT match `/drenyra pi|pi host-serving|pi host\b/i`; B deliberately adds "Drenyra Pi" to the wording, so the regression now asserts "Drenyra Pi" IS named while `/host-serving/i` and `/program-lock/i` claims stay absent. The A→B wording intent (no host-serving/program-lock claims) is preserved.
4. **Pi detection semantics documented.** `drenyra-pi` is present only when `~/.drenyra` (the Drenyra-managed home) exists; on a truly fresh home the first install creates `.drenyra` for the manifest, so the Pi host joins on the next install/sync. The four-host E2E models the documented state (Pi home already present), consistent with the orchestrator's instruction that the managed manifest already lives there.
5. tasks.md header now scopes both slices; the Forecast rows are unchanged (they describe the A→B split that was executed).

## Remaining tasks (unchecked, persisted in tasks.md)

- Parent-owned: "Start or reuse bounded review for the Slice A candidate after verification is frozen…" — `[ ]` (parent; unchanged from A)
- Parent-owned: "Deliver Slice A via a PR to `main`…, then open Slice B as a second PR to `main`…" — `[ ]` (parent; A delivered via #46, B delivery pending)
- Deferred (slice C, unchanged): program-lock-aware install of a genuinely promoted artifact.

## Workload / PR boundary

- **Batch:** SDD-020 slice 2 Slice B, ONE apply unit (this batch), built on main @ 14fd4bd (after #46). This phase created no branch.
- **Budget:** design estimate 120–200 authored lines; actual gross ≈472 (net +445/−27) — see deviation 1. The A→B split was executed as planned (A in #46, B is the second stacked PR); the combined product stays split into two review units as the Forecast mandates.
- **Rollback boundary:** revert `configurator/managed-config.ts`, `cmd/commands/capabilities.ts`, `cmd/__tests__/{install-sync,configurator-transitions,capabilities-doctor}.test.ts` to HEAD (14fd4bd); revert the B-scope tasks.md rows. A's pin capability is unaffected by a B revert (B only adds the host + wording + tests).

## Protected-path check (Phase 3)

`git status --porcelain` against baseline: the only tracked changes are the 5 planned files (plus tasks.md/apply-progress.md under `openspec/changes/sdd-020-host-integration/`). No edit touched `contracts/**`, program-root docs (`README.md`/`LICENSE`), `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`, `tsconfig*.json`, `package.json`, or root `index.ts`. Pre-existing untracked `drenyra-ai-0.3.0.tgz` unchanged in nature.

## Spec pass/fail check (B)

| Req / Scenario | Result | Evidence |
| --- | --- | --- |
| R1 Per-Host Pin Record — now over 4 hosts | PASS | `HostName` union + `PINNED_AI_COMPOSITION` exhaustive over codex/claude-code/opencode/drenyra-pi (B.1); four-host E2E records pins for all four |
| R2 Deterministic Pin Rendering Through Install and Sync — Pi host | PASS | install-sync B tests + E2E: `renderPinnedAiRuntime("drenyra-pi")` bytes identical on disk/snapshot/upgrade/rollback; sync `synced` for all four |
| R3 Doctor Pin Surfacing — Pi host | PASS | doctor B tests + E2E: four-host matrix healthy; Pi drift/absent named distinctly; exit codes 0/1 per convention |
| R4 Boundary and Invariant Compliance | PASS | no adapter edits, no reverse imports (library untouched in import surface), no host binary invoked, no Pi host-serving integration, allowlisted re-derived paths unchanged |
| R5 Testability — four-host lifecycle | PASS | one isolated-home E2E covering install → doctor → sync → upgrade → rollback over all four hosts; no network, no real host processes |
| Capability wording (design) | PASS | `capabilities.ts` names all four managed hosts; no "(planned)" for hosts; no Pi host-serving/program-lock claim |
| Out of scope (deferred) | — | program-lock-aware install (slice C); Drenyra Pi host-serving (pi session's side, drenyra-pi repo) |

## Evidence revision for settlement

SHA-256 over concatenated current contents (in order) of the 5 implementation-candidate files (`configurator/managed-config.ts`, `cmd/commands/capabilities.ts`, `cmd/__tests__/install-sync.test.ts`, `cmd/__tests__/configurator-transitions.test.ts`, `cmd/__tests__/capabilities-doctor.test.ts`):

```
dc068c6eddb7be286fc7917a8d3dfd1cf97271689113a3e01e4909d2eb17579c
```

Attempt token `sha256:9745a972867ee0c5a4796970a7e1325e84497a11b03bc50c3a7e2a77b8842a99` (parent-acquired, slice B) recorded here; no acquire/settle performed by this phase (per delegation instructions). RDD-off clone-local precedent followed (same as the SDD-020 configurator slice, SDD-030, and slice A); no receipt claimed.
