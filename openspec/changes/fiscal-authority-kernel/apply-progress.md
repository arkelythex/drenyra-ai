# Apply Progress — Fiscal Authority Kernel (Program 1)

## Slice 1A — Tenant authority (batch complete)

**Status consumed (openspec store, authoritative):**

```yaml
schemaName: spec-driven
changeName: fiscal-authority-kernel
artifactStore: openspec
applyState: ready -> all_done (Slice 1A batch)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
dependencies.apply: ready
nextRecommended: apply (Slice 1A) -> parent-lifecycle (after batch freeze)
```

**Delivery decision (resolved by parent, no per-slice ask):** `auto-chain`, feature-branch-chain, explicit 1A boundary `fiscal-authority/tenant` ≤300 lines. Slice 1A implemented; parent runs bounded review before chaining PR 1A.

**Scope honored:** only `tenant/**`, root `index.ts`, `package.json`, `tsconfig.json` (additive wiring), plus task checkboxes and this apply-progress. No `agents/`, `cmd/`, docs, contracts, ledger, candidates, or other modules touched. The pre-existing dirty worktree (recovered `agents/` slice, 463-test baseline) was left byte-for-byte intact except the additive `"tenant"` include in `tsconfig.json`.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

| Task | Summary |
| --- | --- |
| 1A-1 RED | `scope.test.ts`: valid scope accepted; non-numeric RUC rejected — RED failed loading `../index.js` (module absent). |
| 1A-1 GREEN | `tenant/types.ts` (`TenantScope`, branded `ValidatedTenantScope` via `TENANT_SCOPE_BRAND`, `TENANT_SCOPE_ERROR`, `TenantScopeError`), `tenant/scope.ts` `validateTenantScope` (atomic: trimmed non-empty company, exactly 11 ASCII digits RUC, `YYYYMM` month 01–12). |
| 1A-1 TRIANGULATE | RUC lengths 9/10/11/12 + non-numeric; periods `202613`, `20261`, `2026a3`; empty/whitespace company; padded company trimmed; non-object input. |
| 1A-1 REFACTOR | Extracted `normalizeCompanyId` / `normalizeRuc` / `normalizePeriod` helpers; tests still green. |
| 1A-2 RED | `sameTenantScope` / `tenantScopeKey` tests written before implementation — 5 failing (`is not a function`). |
| 1A-2 GREEN | `tenantScopeKey` length-delimited canonical encoding (`len:value;...`); `sameTenantScope` compares canonical keys. One test expectation corrected: `"4:ACME"` (ACME is 4 chars, not 3) — implementation was correct. |
| 1A-2 TRIANGULATE | Differing period, company, RUC assert distinctness. |
| 1A-2 REFACTOR | Helpers small and documented; tests green. |
| 1A-3 RED | Cross-tenant isolation tests written first — 5 failing (missing exports). |
| 1A-3 GREEN | `SCOPED_READ_KIND` / `SCOPED_READ_DETAIL` const objects, `ScopedReadFound` / `ScopedReadNotDisclosing`, `ScopedReadResult`, `TenantScopedStore` seam (single-scope `select`, no cross-scope probe); `assertTenantReadScope` (fail-closed revalidation), `readArtifact` selecting by scope key + artifact id, identical non-disclosing result for missing and foreign. |
| 1A-3 TRIANGULATE | Deterministic retry (no side effect); foreign artifact never returned from any scope; forged scope fails closed. |
| 1A-3 REFACTOR | Tests green. |
| 1A-4 exports | `tenant/index.ts` public surface; root `index.ts` `export * from "./tenant/index.js"`; `package.json` `"./tenant": "./dist/tenant/index.js"`; `tsconfig.json` `"tenant"` in include (kept recovered `agents` entry). |
| 1A-4 scanner | `tenant/__tests__/import-boundaries.test.ts`: static scan of relative imports in new-module dirs — `tenant/` imports only within itself, no `agents/`, `cmd/`, or `ingest/` path. Extendable by later slices. |
| 1A-4 regression | Full suite 487 passed (463 baseline + 24 new tenant tests), typecheck clean, build clean (`dist/tenant/` emitted). |

## Files changed (Slice 1A)

| Path | Status |
| --- | --- |
| `tenant/types.ts` | new |
| `tenant/scope.ts` | new |
| `tenant/index.ts` | new |
| `tenant/__tests__/scope.test.ts` | new |
| `tenant/__tests__/import-boundaries.test.ts` | new |
| `index.ts` | +1 additive export line |
| `package.json` | +1 additive export line |
| `tsconfig.json` | +1 additive include entry (recovered `agents` entry untouched) |

## Test commands and exact results

- `bunx vitest run tenant/__tests__/scope.test.ts` — 23 passed after final GREEN (focused)
- `bunx vitest run tenant/__tests__/import-boundaries.test.ts` — 1 passed
- `bun run test` (full suite) — **27 files passed, 487 tests passed** (463 baseline + 24 new)
- `bun run typecheck` — clean (exit 0)
- `bun run build` — clean (exit 0); `dist/tenant/` emitted (index/scope/types .js + .d.ts)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1A-1 | `tenant/__tests__/scope.test.ts` | Unit | ✅ 463/463 baseline | ✅ Written (suite failed to load: module absent) | ✅ 2/2 | ✅ RUC 9/10/11/12, period, company boundaries (13 tests) | ✅ Helpers extracted, 13/13 |
| 1A-2 | `tenant/__tests__/scope.test.ts` | Unit | ✅ 13/13 | ✅ Written (5 failing, fn not defined) | ✅ 18/18 | ✅ Company/RUC/period differences | ✅ 18/18 |
| 1A-3 | `tenant/__tests__/scope.test.ts` | Unit | ✅ 18/18 | ✅ Written (5 failing, missing exports) | ✅ 23/23 | ✅ Retry determinism, foreign never returned, forged scope | ✅ 23/23 |
| 1A-4 | `tenant/__tests__/import-boundaries.test.ts` | Unit | ✅ 23/23 | ➖ Static scanner (no pre-existing module) | ✅ 1/1 | ✅ Forbidden segments + escape checks | ➖ None needed |

### Test Summary

- **Total tests written**: 24 (23 scope + 1 import-boundary)
- **Total tests passing**: 487 (full suite)
- **Layers used**: Unit (24)
- **Approval tests**: None — all new files
- **Pure functions created**: `validateTenantScope`, `tenantScopeKey`, `sameTenantScope`, `assertTenantReadScope`, `readArtifact`

## Deviations from design

1. **Authored line count exceeds the 1A batch budget.** The parent prompt said "keep under 300 authored changed lines"; the actual Slice 1A authored surface is **~592 lines** (589 new `tenant/**` lines + 3 wiring additions). All 24 new tests are required by the spec scenarios (RUC boundaries, period boundaries, identity, isolation, import scan), and the implementation follows the design's exact module boundary. This is a batch-size deviation that needs a parent decision: either accept a size exception for PR 1A, or split 1A into two chained PRs (e.g., `fiscal-authority/tenant-core` = types/scope/index + validation/identity tests; `fiscal-authority/tenant-isolation` = read-isolation + scanner). Implementation is complete and green either way.
2. One test expectation was corrected during 1A-2 GREEN (ACME length 4, not 3); no production behavior changed.
3. `readArtifact` is implemented as `readArtifact(store, scope, artifactId)` with a narrow `TenantScopedStore` seam (design said "`readArtifact(scope, artifactId)`-shaped"); the store seam is the test seam the design's "in-memory scoped map" implies, and it structurally prevents cross-scope probing.

## Remaining tasks (unchecked, persisted in tasks.md)

- All Slice 1B implementation rows (evidence authority) — 16 unchecked
- All Slice 1C implementation rows (journal) — 25 unchecked
- All Slice 1D implementation rows (candidate ordering) — 15 unchecked
- All Slice 1E implementation rows (policy/CDR) — 18 unchecked
- 7 parent-owned chain lifecycle gates (review, chained PRs, tracker merge)

## Workload / PR boundary

- **Batch**: Slice 1A, branch `fiscal-authority/tenant` (per tasks.md chain plan).
- **Budget**: tasks.md forecasts ≤300 for 1A; actual ~592 authored lines (see deviation 1). Program-wide High 400-line risk handled by the chained-PR plan; no size exception was requested — parent must decide on the 1A overage.
- **Rollback boundary**: remove `tenant/` module and the three wiring additions (`index.ts` export line, `package.json` `./tenant` export, `tsconfig.json` include entry). Recovered-slice files are untouched and their rollback is independent.

## Evidence revision for settlement

SHA-256 over concatenated current contents (in order) of the 8 touched files (`tenant/types.ts`, `tenant/scope.ts`, `tenant/index.ts`, `tenant/__tests__/scope.test.ts`, `tenant/__tests__/import-boundaries.test.ts`, `index.ts`, `package.json`, `tsconfig.json`):

```
e627d6faf71779263b1fb9e673fbefa0ad69fe806c7da023cbf6b9742f732e8d
```

Attempt token was parent-acquired; no attempt acquire/settle performed by this phase (per delegation instructions).

<!-- rescope-section-starts -->

---

## Slice 1A rescope — tenant-core / tenant-isolation staging split (batch complete)

**Status consumed (openspec store, authoritative):**

```yaml
schemaName: spec-driven
changeName: fiscal-authority-kernel
artifactStore: openspec
applyState: ready
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
dependencies.apply: ready
nextRecommended: apply (rescope batch) -> parent-lifecycle (after batch freeze)
```

**Delivery decision (resolved by parent):** user explicitly authorized splitting by staging. Prior Slice 1A (~592 unreviewed lines) exceeds the 400-line review max as one candidate; native prior objective was reset. Intended partition: `tenant-core` then `tenant-isolation`, each with tests. Core target < 300 lines; isolation unit stays unstaged until core review passes. Parent owns staging/branching; nothing was staged by this phase.

**Scope honored:** only `tenant/**` -> `tenant-core/**` + `tenant-isolation/**` reorganization, root `index.ts`, `package.json`, `tsconfig.json`, `tsconfig.build.json` (wiring), plus tasks.md/apply-progress.md. Recovered `agents/`, `cmd/`, docs, contracts, ledger, candidates, missions, receipts, review, gates, recovery untouched.

### File partition (physical)

| Unit | Files | Lines | Staged |
| --- | --- | ---: | --- |
| **tenant-core** (core candidate) | `tenant-core/types.ts` | 42 | parent stages |
| | `tenant-core/scope.ts` | 100 | parent stages |
| | `tenant-core/index.ts` | 11 | parent stages |
| | `tenant-core/__tests__/scope.test.ts` | 142 | parent stages |
| | **core total** | **295** (< 300 ✓) | |
| **tenant-isolation** (unstaged) | `tenant-isolation/types.ts` | 48 | no |
| | `tenant-isolation/read.ts` | 53 | no |
| | `tenant-isolation/index.ts` | 10 | no |
| | `tenant-isolation/__tests__/read.test.ts` | 127 | no |
| | `tenant-isolation/__tests__/import-boundaries.test.ts` | 95 | no |
| | isolation total | 333 | no |

Wiring (core candidate): root `index.ts` re-exports `./tenant-core/index.js`; `package.json` `"./tenant": "./dist/tenant-core/index.js"` (public export name unchanged); `tsconfig.json` include `tenant-core` + `tenant-isolation` (typecheck covers both units); `tsconfig.build.json` include `tenant-core` only (build emits the core candidate; isolation ships in its own PR). Stale `tenant/` directory removed.

### Rescoped test count

| Suite | Tests | Notes |
| --- | ---: | --- |
| `tenant-core/__tests__/scope.test.ts` | 18 | validation (13) + identity (5); brand assertion added |
| `tenant-isolation/__tests__/read.test.ts` | 5 | non-disclosure, within-scope, retry determinism, foreign-never-returned, forged scope |
| `tenant-isolation/__tests__/import-boundaries.test.ts` | 2 | scanner over `tenant-core` + `tenant-isolation` |
| **Total tenant tests** | **25** | prior 24 (23 scope + 1 scanner) + 1 scanner dir |

### TDD Cycle Evidence (rescope batch)

| Task | Test File | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- |
| Repartition core | `tenant-core/__tests__/scope.test.ts` | 3 files failed (module load errors: `../index.js` absent) | 18/18 | inherited from prior 1A batch (boundaries + identity) | trimmed comments to 295 lines, 18/18 |
| Isolation unit | `tenant-isolation/__tests__/read.test.ts` + scanner | same RED run (load errors + scanner 0 files) | 5/5 + 2/2 | inherited from prior 1A batch (isolation cases) | import fix: `TENANT_SCOPE_BRAND`/`ValidatedTenantScope` from `../../tenant-core/index.js` |
| Wiring | full suite | ➖ | 488/488 | ➖ | `index.ts`, `package.json`, `tsconfig.json`, `tsconfig.build.json` updated; `tenant/` removed |

### Test commands and exact results

- `bunx vitest run tenant-core/__tests__/scope.test.ts tenant-isolation` — **3 files, 25 passed** (GREEN)
- `bunx vitest run tenant-core tenant-isolation` — **3 files, 25 passed** (final focused)
- `bun run test` (full suite) — **28 files, 488 tests passed** (463 baseline + 25 tenant) — exit 0
- `bun run typecheck` — clean, exit 0 (caught and fixed the isolation test import error first run)
- `bun run build` — clean, exit 0; `dist/tenant-core/` emitted (index/scope/types .js + .d.ts)

### Deviations from design

1. **Staging split replaces the single 1A candidate.** Prior apply-progress deviation 1 (592-line 1A) is resolved by the user-approved partition: core candidate = 295 lines, isolation unit = 333 lines unstaged. This is the explicit staging decision, not a size exception.
2. `readArtifact` (isolation) now imports core through `../tenant-core/index.js`; the scanner (`tenant-isolation`) permits relative imports that resolve inside any program module dir (`tenant-core`, `tenant-isolation`) — the design's no-reverse-import rule (never into existing modules, never `agents/`/`cmd/`/`ingest/`) is unchanged and enforced.
3. `tsconfig.build.json` gains a `tenant-core` include entry so the `./tenant` package export resolves to a real build artifact (the prior batch had left `dist/tenant` only as a stale manual emit).
4. Core test count is 18 (was 13+5=18 within the old 23); the 5 isolation tests moved with the behavior; brand-carrying assertion added to the valid-scope test.

### Remaining tasks (unchecked, persisted in tasks.md)

- All Slice 1B implementation rows (evidence authority) — 16 unchecked
- All Slice 1C implementation rows (journal) — 25 unchecked
- All Slice 1D implementation rows (candidate ordering) — 15 unchecked
- All Slice 1E implementation rows (policy/CDR) — 18 unchecked
- 7 parent-owned chain lifecycle gates (review, chained PRs, tracker merge)

### Workload / PR boundary

- **Batch:** Slice 1A rescope; core candidate `tenant-core` (295 lines) -> bounded review gate -> parent stages; `tenant-isolation` (333 lines) unstaged until core review passes.
- **Budget:** core < 300 ✓ (295 actual). Program-wide High 400-line risk handled by the chained-PR plan; no size exception requested or used.
- **Rollback boundary:** core — remove `tenant-core/` and its 4 wiring entries (`index.ts` export, `package.json` `./tenant` target, `tsconfig.json` include, `tsconfig.build.json` include). Isolation — remove `tenant-isolation/`; no wiring to revert. Recovered-slice files untouched.

## Evidence revision for settlement (rescope)

SHA-256 over concatenated current contents (in order) of the 13 implementation-candidate files (`tenant-core/types.ts`, `tenant-core/scope.ts`, `tenant-core/index.ts`, `tenant-core/__tests__/scope.test.ts`, `tenant-isolation/types.ts`, `tenant-isolation/read.ts`, `tenant-isolation/index.ts`, `tenant-isolation/__tests__/read.test.ts`, `tenant-isolation/__tests__/import-boundaries.test.ts`, `index.ts`, `package.json`, `tsconfig.json`, `tsconfig.build.json`):

```
69ac877e0785db155a6b0f1315eace21aaa3eb6295d37c4a43d96a719260ee77
```

Attempt token `sha256:05b3783cd3adb867318031f04da7ae5e8085a8556537bd29f28d2da6548fde2e` was parent-acquired; no attempt acquire/settle performed by this phase (per delegation instructions).

---

## PAUSED — parent decision 2026-08-12

**Status:** PAUSED by explicit user decision (ecosystem-first strategy). Slice 1A (tenant authority) complete and documented; slice 2 advanced de facto (RUC checksum in flow/guardian/candidates, commits 6f6223b, 09afdb9); 81 of 100 tasks unchecked in tasks.md (known discipline drift, not a full inventory of implemented work). Resumed in Phase 4 (v1.0) when real consumers require the remaining slices. No new implementation under this change while paused.
