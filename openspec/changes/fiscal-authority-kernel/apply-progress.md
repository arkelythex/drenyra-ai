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

---

## Work unit 1b-evidence-accept-conformance (batch 1) — 1B-1..1B-3, wrap-and-expose (batch complete)

**Status consumed (openspec store, authoritative):**

```yaml
schemaName: spec-driven
changeName: fiscal-authority-kernel
artifactStore: openspec
applyState: ready (fresh narrow correction after native runtime reset; orphaned attempt closed by parent)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
nextRecommended: parent-lifecycle (after batch freeze; RDD disabled clone-local, no receipt claimed)
```

**Conformance direction (resolved by parent):** wrap-and-expose. The evidence authority behavior already exists in this branch (commit 3785e27, `evidence/identity` + `evidence/authority`); this batch does NOT restructure to the design's `evidence/types.ts` layout. Instead it adds a thin accepted-evidence surface that delegates to `registerEvidence` unchanged, preserving `id` and `evidenceHash` and adding the canonical receipt-hash-based `identity`.

**Delivery decision (resolved by parent, no per-slice ask):** auto-chain, feature-branch-chain; batch cap 300 changed lines; this batch = 268 authored lines (51 `accept.ts` + 216 test + 1 wiring line in `evidence/index.ts`). No commit, push, PR, review, or reset performed.

**Scope honored:** only `evidence/accept.ts` (new), `evidence/__tests__/accept.test.ts` (new), `evidence/index.ts` (+1 export line), plus task checkboxes and this apply-progress. Frozen receipt contracts/vectors, persistence, ingest, SUNAT transport, `agents/`/`cmd/`, and the batch-2 boundary scanner (`tenant-isolation/__tests__/import-boundaries.test.ts`) are untouched.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

| Task | Summary |
| --- | --- |
| 1B-1 RED | `evidence/__tests__/accept.test.ts` written first: missing provenance → `MISSING_PROVENANCE`, malformed provenance (non-object, invalid timestamp) → `MALFORMED_PROVENANCE`, rejection yields no artifact / no downstream-capable partial object. Suite failed to load (`../accept.js` absent) — RED recorded (1 file failed, 0 tests ran). |
| 1B-1 GREEN | `evidence/accept.ts` — `AcceptedEvidence` (extends `RegisteredEvidence`; preserves `id`, `scope`, `scopeKey`, `items`, `evidenceHash`, `provenance`; adds `readonly identity`) and `acceptEvidence(input: unknown)` delegating the full fail-closed pipeline to `registerEvidence`; `evidence/index.ts` re-exports `./accept.js`. Focused suite 10/10. |
| 1B-1 TRIANGULATE | Provenance field boundaries: whitespace-only source, structurally invalid timestamp `2026-13-99`, unknown source kind `hearsay` — all fail closed `MALFORMED_PROVENANCE`. |
| 1B-1 REFACTOR | Full suite green (see commands below). |
| 1B-2 RED | Memory/advisory rejection tests written before the surface existed (fail at import): `memory`/`engram`/`recall` → `MEMORY_SHAPED`; `advisory`/`llm`/`assistant`/`chat` → `ADVISORY_SHAPED`; memory-shaped input cannot satisfy an evidence requirement. |
| 1B-2 GREEN | Memory exclusion flows through the `acceptEvidence` → `registerEvidence` narrowing before any other check (delegated, behavior unchanged); memory/advisory kinds remain absent from the accepted const-object channel types. |
| 1B-2 TRIANGULATE | Shape proof: `EVIDENCE_CHANNEL` values contain no `MEMORY_SHAPED_MARKERS`/`ADVISORY_SHAPED_MARKERS`; an accepted artifact's `provenance.channel` is always an evidence channel at runtime. |
| 1B-3 RED | `AcceptedEvidence.identity === computeEvidenceHash([item])` (frozen receipt primitive); two identical submissions → equal `identity` and `id`; `id` and `evidenceHash` preserved. |
| 1B-3 GREEN | `identity = computeEvidenceHash([...registered.items])` computed in `evidence/accept.ts` from `receipts/verify.ts` as the single source of canonical identity. |
| 1B-3 TRIANGULATE | Content change (label restated) → H2 ≠ H1 with `identity` equal to the re-computed receipt hash; original accepted artifact deep-immutable (`Object.isFrozen` on record/items/provenance/scope, frozen-array push throws); original keeps its identity after a second acceptance with different content. |
| 1B-3 REFACTOR | Frozen receipt conformance suite (`contracts/__tests__/receipt-conformance.test.ts`, 16 tests) unchanged and green; full suite, typecheck, build green. |

## Files changed (work unit 1b-evidence-accept-conformance)

| Path | Status | Lines |
| --- | --- | ---: |
| `evidence/accept.ts` | new | 51 |
| `evidence/__tests__/accept.test.ts` | new | 216 |
| `evidence/index.ts` | +1 additive export line | 1 |
| **Batch total** | | **268** (< 300 cap ✓) |

No root `index.ts`, `package.json`, or `tsconfig.json` change needed: the existing `export * from "./evidence/index.js"` wiring already propagates the new surface.

## Test commands and exact results

- `bunx vitest run evidence/__tests__/accept.test.ts` — RED: 1 file failed (module load, `../accept.js` absent) → GREEN: 10/10 → TRIANGULATE: 17/17
- `bunx vitest run evidence` — **3 files, 48 tests passed** (31 baseline + 17 new)
- `bunx vitest run contracts/__tests__/receipt-conformance.test.ts` — **1 file, 16 tests passed** (frozen, unchanged)
- `bun run test` (full suite) — **56 files, 690 tests passed** (673 baseline + 17 new accept tests)
- `bun run typecheck` — clean (exit 0)
- `bun run build` — clean (exit 0); `dist/evidence/` includes `accept.js` + `accept.d.ts`

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1B-1 | `evidence/__tests__/accept.test.ts` | Unit | ✅ 673/673 baseline | ✅ 1 file failed (module absent) | ✅ 4/4 | ✅ 3 boundary cases | ✅ 673+4 green |
| 1B-2 | `evidence/__tests__/accept.test.ts` | Unit | ✅ 673/673 baseline | ✅ same RED run (module absent) | ✅ 3/3 | ✅ shape proof (1 test) | ✅ 673+7 green |
| 1B-3 | `evidence/__tests__/accept.test.ts` | Unit | ✅ 673/673 baseline | ✅ same RED run (module absent) | ✅ 3/3 | ✅ H2≠H1 + immutability (3 tests) | ✅ full suite 690, typecheck, build, receipt conformance 16/16 |

### Test Summary

- **Total tests written**: 17 (all in `evidence/__tests__/accept.test.ts`)
- **Total tests passing**: 690 (full suite)
- **Layers used**: Unit (17)
- **Approval tests**: None — all new files
- **Pure functions created**: `acceptEvidence`; `AcceptedEvidence` type

## Deviations from design

1. **Wrap-and-expose replaces the design's `evidence/types.ts` + `evidence/accept.ts` layout.** The evidence authority already exists on this branch (`evidence/identity/*`, `evidence/authority/*`, commit 3785e27) with the fail-closed pipeline, provenance shape validation, memory/advisory channel gates, scope binding, and deep-freeze behavior. Per the parent-resolved conformance direction, no restructure was performed; `evidence/accept.ts` is a thin delegation surface. Types (`EvidenceProvenance`, provenance shape, origin constants `EVIDENCE_CHANNEL`, rejection codes `EvidenceErrorCode`) already exist in `evidence/identity/*`.
2. **`identity` and `evidenceHash` are equal in value** for the same accepted items because both are the frozen receipt primitive `computeEvidenceHash`. This is intended: the spec's "Identity matches canonical receipt hash" scenario requires exactly this equality, while the existing `id` keeps its distinct content-derived semantics (scope key + evidence hash + provenance). Tests assert both the equality and the preservation of `id`/`evidenceHash`.
3. 1B-1/1B-2/1B-3 RED shared one coherent failing run (module `../accept.js` absent) because the delegated behaviors already exist inside `registerEvidence`; the batch RED is the missing accepted surface, which is the honest RED for wrap-and-expose.

## Remaining tasks (unchecked, persisted in tasks.md)

- 1B-4 Tenant binding and composition — 4 unchecked rows
- 1B-5 Exports and wiring — 1 unchecked row
- All Slice 1C implementation rows (journal) — 25 unchecked
- All Slice 1D implementation rows (candidate ordering) — 15 unchecked
- All Slice 1E implementation rows (policy/CDR) — 18 unchecked
- Parent-owned chain lifecycle gates (review, chained PRs, tracker merge)

## Workload / PR boundary

- **Batch:** work unit `1b-evidence-accept-conformance` (rows 1B-1..1B-3), branch `fiscal-authority/evidence` boundary; 268 authored lines ≤ 300 cap.
- **Budget:** ≤300 ✓ (268 actual). Program-wide High 400-line risk handled by the chained-PR plan; no size exception requested or used.
- **Rollback boundary:** remove `evidence/accept.ts`, `evidence/__tests__/accept.test.ts`, and the one export line in `evidence/index.ts`; existing identity/authority modules remain intact.

## Evidence revision for settlement

SHA-256 over concatenated current contents (in order) of the 3 implementation-candidate files (`evidence/accept.ts`, `evidence/__tests__/accept.test.ts`, `evidence/index.ts`):

```
57c912e3fe74f9aa9bed4936ab455d4450696d33ace436d5cba4c7fe5659e6a8
```

Attempt token `sha256:0bb723b4f4d9f8db4bb815fc94d28c2d0c4d275c5c3731553286b0737a2ded2d` was parent-acquired; this phase settles it exactly once (outcome passed, `--remediates-evidence-revision sha256:e627d6faf71779263b1fb9e673fbefa0ad69fe806c7da023cbf6b9742f732e8d`). RDD remains disabled clone-local; no receipt claimed.

---

## Work unit 1b-evidence-accept-conformance (batch 2) — 1B-4 tenant binding/composition + 1B-5 boundary wiring (batch complete)

**Status consumed (openspec store, authoritative):**

```yaml
schemaName: spec-driven
changeName: fiscal-authority-kernel
artifactStore: openspec
applyState: ready (parent-native: apply ready, 30/100 tasks complete before this batch)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
nextRecommended: parent-lifecycle (after batch freeze; RDD disabled clone-local, no receipt claimed)
```

**Delivery decision (resolved by parent):** isolated batch 2 of Slice 1B, rows 1B-4 and 1B-5 only; batch cap 300 source changed lines. No commit, push, PR, review, or reset performed; no attempt acquired (parent acquired the only attempt token).

**Scope honored:** only `evidence/__tests__/accept.test.ts` (+169/−23 net +146) and `tenant-isolation/__tests__/import-boundaries.test.ts` (+91/−37 net +54) changed; task checkboxes and this apply-progress updated. Batch 1 evidence surface (`accept.ts`, `evidence/index.ts`, identity/authority layout), frozen receipt contracts/vectors, persistence, ingest, SUNAT, `agents/`/`cmd/`, and all other slices untouched.

## Completed tasks (persisted checkboxes verified `[x]` in tasks.md)

| Task | Summary |
| --- | --- |
| 1B-4 RED | Tests written first in `evidence/__tests__/accept.test.ts`: acceptance requires an explicit validated tenant scope (`INVALID_SCOPE` for missing and forged/unbranded scope), the binding check accepts the same scope and rejects a different one (`SCOPE_MISMATCH`) plus a forged one (`INVALID_SCOPE`), and a journal-style consumer binds accepted evidence using only existing receipt primitives. Coverage-first RED: all passed against the existing delegated authority (no production defect found — the required behavior already exists in `registerEvidence`/`assertEvidenceInScope`). |
| 1B-4 GREEN | `AcceptedEvidence` retains `scope: ValidatedTenantScope` (via `RegisteredEvidence`), `evidence/index.ts` already re-exports the accepted surface — no production change needed; the 9 new tests prove both. |
| 1B-4 TRIANGULATE | Accepted-surface key set is exactly the registered keys + `identity` (no receipt field additions); frozen receipt conformance suite `contracts/__tests__/receipt-conformance.test.ts` 16/16 unchanged; nested immutability proven at every level (see below). |
| 1B-5 | `evidence/index.ts` public exports, root `index.ts` re-export, `package.json` `./evidence` export, `tsconfig.json` + `tsconfig.build.json` `evidence` includes all already present (pre-batch-1 wiring, verified in committed tree); the static boundary scanner extended to scan `evidence/` with a per-module approved-dependency allowlist (`receipts`, `tenant-core`, internal evidence modules) rejecting all high-level layers. |

## Immutability coverage (nested state)

Four new tests in the 1B-4 immutability describe:

1. every nested node frozen — record, `items` array, every item object, `provenance`, `scope`;
2. nested mutation attempts throw `TypeError` — `items.push`, item-field assignment, `delete provenance.source`, scope-field assignment, `identity` assignment;
3. acceptance copies rather than mutates the input scope;
4. accepted surface adds no receipt contract fields (key-set + hash proof).

No immutability defect was found; batch 1 code (`accept.ts`, `evidence/index.ts`) was NOT touched, per the delegation's guard.

## Files changed (work unit 1b-evidence-accept-conformance batch 2)

| Path | Status | Net | Gross |
| --- | --- | ---: | ---: |
| `evidence/__tests__/accept.test.ts` | modified | +146 | 192 |
| `tenant-isolation/__tests__/import-boundaries.test.ts` | modified | +54 | 128 |
| **Batch total** | | **+200 authored** | **320 changed** |

Accounting note: net authored = 200 ≤ 300 cap ✓ (the batch-1 convention counts authored lines). Gross changed = 320; 60 of those are deletions of the replaced naive boundary-check logic (the RED invalidated it: the old "program modules only" invariant rejects evidence's legitimate `receipts` dependency). Disclosed for the parent; all 200 authored lines are required coverage.

## Test commands and exact results

- `bunx vitest run evidence tenant-isolation` — RED (scanner): 1 failed, 2 passed (evidence escapes the old program-modules invariant via `receipts/`) → GREEN: 5/5 → after trims: **5 files, 67 tests passed**
- `bunx vitest run contracts/__tests__/receipt-conformance.test.ts` — **1 file, 16 tests passed** (frozen, unchanged — 1B-4 TRIANGULATE)
- `bun run test` (full suite) — **56 files, 702 tests passed** (690 batch-1 baseline + 12 new)
- `bun run typecheck` — clean (exit 0)
- `bun run build` — clean (exit 0)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1B-4 | `evidence/__tests__/accept.test.ts` | Unit | ✅ 690/690 baseline | ✅ coverage-first: binding/composition/immutability tests written first; all passed (no defect — delegated authority already enforces scope requirement, binding check, deep freeze) | ✅ 17→26 tests (9 new), no production change required | ✅ key-set (no receipt fields), nested-frozen nodes, mutation-throw, input-scope copy semantics | ✅ trimmed 2 duplicate tests, 26/26 + full suite green |
| 1B-5 | `tenant-isolation/__tests__/import-boundaries.test.ts` | Unit | ✅ 690/690 baseline | ✅ added `evidence` to scanned dirs with old invariant → 1 failed (5 violations: receipts escapes) | ✅ per-module `APPROVED_TARGETS` allowlist — 3 module scans pass | ✅ synthetic fixtures: agents/cmd/ingest rejected from evidence, unapproved sibling rejected, approved receipts/tenant-core/internal allowed | ✅ compacted triangulation to table form; 5/5 |

### Test Summary

- **Total tests written**: 12 (9 accept binding/composition/immutability + 3 boundary scans/triangulation net-new)
- **Total tests passing**: 702 (full suite)
- **Layers used**: Unit (12)
- **Approval tests**: None — test-file modifications only
- **Pure functions created**: `importTarget`, `moduleBoundaryViolations` (test-scoped scanner helpers); production surface unchanged

## Deviations from design

1. **Boundary target is `tenant-core`, not `tenant/`.** Task row 1B-5 says "asserting `evidence/` imports only `tenant/` and `receipts/`"; per the rescoped layout the approved dependency is the `tenant-core` module (which is what `evidence/authority` actually imports), and the parent delegation explicitly authorized (`receipts`, `tenant-core`, internal evidence modules). The scanner enforces exactly that.
2. **1B-4 required no production change.** The wrap-and-expose surface from batch 1 already requires the branded revalidated scope (`validateScopeValue`), exposes the binding check (`assertEvidenceInScope`, exported via `evidence/authority/index.js` → `evidence/index.js`), and deep-freezes the full nested graph. The batch's contribution is strict, persisted coverage proving those guarantees plus the composition seam — the honest outcome for wrap-and-expose, matching batch 1's RED framing.
3. **Gross changed lines 320 vs the 300 cap.** Net authored 200 ≤ 300; the extra 60 gross lines are deletions of the old `isWithinProgramModules`/`FORBIDDEN_SEGMENTS` logic that the RED proved incapable of expressing evidence's legitimate `receipts` dependency. See accounting note above.

## Remaining tasks (unchecked, persisted in tasks.md)

- All Slice 1C implementation rows (journal) — 25 unchecked
- All Slice 1D implementation rows (candidate ordering) — 15 unchecked
- All Slice 1E implementation rows (policy/CDR) — 18 unchecked
- Parent-owned chain lifecycle gates (review, chained PRs, tracker merge) — 7 unchecked

## Workload / PR boundary

- **Batch:** work unit `1b-evidence-accept-conformance` batch 2 (rows 1B-4..1B-5), branch `fiscal-authority/evidence` boundary; 200 authored lines ≤ 300 cap.
- **Budget:** ≤300 ✓ (200 net authored; 320 gross disclosed). Program-wide High 400-line risk handled by the chained-PR plan; no size exception requested or used.
- **Rollback boundary:** revert the two modified test files (`evidence/__tests__/accept.test.ts`, `tenant-isolation/__tests__/import-boundaries.test.ts`) to HEAD (42bd1d0); batch 1 evidence surface and wiring remain intact.

## Evidence revision for settlement

SHA-256 over concatenated current contents (in order) of the 2 implementation-candidate files (`evidence/__tests__/accept.test.ts`, `tenant-isolation/__tests__/import-boundaries.test.ts`):

```
1750ab3ba97f6f5937faf079fbc0668a608637dbfd27611eaaf5aa5bcf632e4a
```

Attempt token `sha256:c0ddccecd6eb722a463c921236e23f0d8e0e35317b355842f2bc9a651c919213` was parent-acquired; this phase settled it exactly once via the runtime's prescribed continuation (`sdd-attempt finish`, request id `batch2-1b4-1b5-finish-01`, outcome passed, evidence revision recorded). The `--remediates-evidence-revision` flag was rejected by the runtime (no failed verification on record; batch-1 revision 57c912e3 was passed, not failed) and correctly omitted. RDD remains disabled clone-local; no receipt claimed.

**Budget flag — parent decision required (ledger):** the runtime ledger counts changed lines as the gross worktree diff vs the begin candidate tree, including the mandatory OpenSpec artifacts; ordinal 4 recorded `changed_lines: 432` > `max_changed_lines: 300`, so the attempt finished passed but with `changed_line_budget_exceeded: true` and the objective now reports `decision_required: true, next_action: reset` (same shape as ordinal 2's maintainer-authorized reset). The batch's implementation files alone are 320 gross / 200 net authored lines; the remaining ~112 counted lines are the tasks.md checkbox updates and this apply-progress section, which are mandatory phase outputs and cannot be removed. Per delegation, this phase performed no reset (parent-owned) and no second settle (single-settle contract honored). Parent options: authorize a reset of the gen-4 objective (precedent: ordinal 2), or accept the overage as a size exception for the 1B-5 scanner extension
---

## Work unit 1c-journal-batch-1 (batch 1 of Slice 1C) — 1C-1 amount/balance/binding (batch complete)
**Status:** openspec store, applyState ready -> batch complete; actionContext repo-local, allowedEditRoots [repo-root]; parent owns ledger settlement (no acquire/settle by this phase).
**Scope:** only `journal/types.ts`, `journal/validate.ts`, `journal/journal.ts`, `journal/__tests__/journal.test.ts`, tasks.md (7 rows -> [x]), this apply-progress. 1C-2/1C-3, wiring, scanner untouched. Engram batch summary saved.
## Files changed
| Path | Status | Lines |
| journal/types.ts | new | 57 |
| journal/validate.ts | new | 72 |
| journal/journal.ts | new | 24 |
| journal/__tests__/journal.test.ts | new | 101 |
| tasks.md | 7 rows `- [ ]` -> `- [x]` | 14 |
## TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
| 1C-1 amounts/balance | 1 file failed, 0 tests (module ../journal.js absent) | 12/12 | -1n, 0n, "1.50"/"100", multi-line sums, no-entry-state on every rejection | full suite 714 green |
| 1C-1 binding | same RED run | MISSING_EVIDENCE / EVIDENCE_SCOPE_MISMATCH / INVALID_SCOPE | frozen entry/lines/scope; mutation throws TypeError | typecheck/build clean |
## Test commands and exact results
- `bunx vitest run journal/__tests__/journal.test.ts` — RED 1 failed/0 tests -> GREEN 12 passed
- `bun run test` — 57 files, 714 passed (702 + 12); `bun run typecheck` — clean; `bun run build` — clean; focused `tsc --ignoreConfig` over the 4 journal files — clean (repo-wide journal typecheck/build wiring is 1C-3)

## Deviations from design
- `JournalRecordInput.scope` typed `unknown` + runtime revalidation (mirrors `EvidenceInput.scope`); entry carries a fresh branded scope copy. Empty-lines guard implemented in `validateRecord`; dedicated test trimmed for the 300-line cap.

## Workload / PR boundary
- Batch: 1C-1, branch `fiscal-authority/journal` boundary (parent owns branch/commits). Total changed lines: source+tests 254 + tasks 14 + this section 28 <= 300 cap.
- Rollback boundary: delete the 4 journal files; no wiring/scanner change to revert.
## Evidence revision for settlement
`07bf08d167ff6e5b5f75fc584960b4d13bba56e536b5be6460ca253804157c7f`
---

## Work unit 1c-journal-batch-2 — 1C-2 receipts, corrections, status axes, ledger boundary (batch complete)
**Status:** openspec store, applyState ready -> batch complete; actionContext repo-local, allowedEditRoots [repo-root]; parent owns ledger settlement (no acquire/settle by this phase). Strict TDD: RED -> GREEN -> TRIANGULATE -> REFACTOR, `bun run test` authoritative.
**Scope:** only `journal/types.ts`, `journal/journal.ts`, `journal/__tests__/journal.test.ts`, tasks.md (13 rows -> [x]), this section. 1C-3 (`journal/index.ts` + wiring + scanner), validate.ts, and all other files untouched.
## Files changed
| Path | Status | Lines |
| journal/types.ts | modified | +33 |
| journal/journal.ts | modified | +30 |
| journal/__tests__/journal.test.ts | modified | +177 |
| tasks.md | 13 rows `- [ ]` -> `- [x]` | 26 |
## TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
| post + issuer port | 7 failed/14 passed (post/supersede/revoke/JOURNAL_ACTION absent) | 21/21 | receipt-failure leaves prior RECORDED snapshot untouched | full suite 724 green |
| supersede/revoke | same RED run | E2 linked via supersedesEntryId, prior ref-identical; reversal entry id `revoke:<id>` | unbalanced successor throws with 0 receipts; append-only snapshot equality | typecheck/build clean |
| status independence | same RED run | JournalEntry carries only JournalStatus; no fiscal type in any signature | both directions (journal changes/fiscal constant; fiscal changes/journal constant) | strict tsc exit 0 |
| ledger boundary | same RED run | post/supersede/revoke return SignedReceipt (re-exported from receipts/); no journal export surface added | ledger accepts RECEIPT_RECORDED with journal receiptHash; rejects JournalEntry-shaped payload | frozen receipt 16 + ledger 29 conformance green |
## Test commands and exact results
- `bunx vitest run journal/__tests__/journal.test.ts` — RED 7 failed/14 passed -> GREEN 21/21 -> TRIANGULATE 22/22
- `bunx vitest run contracts/__tests__/receipt-conformance.test.ts contracts/__tests__/ledger-conformance.test.ts` — 2 files, 45 passed (frozen, unchanged)
- `bun run test` — 57 files, 724 passed (714 + 10); `bun run typecheck` — clean; `bun run build` — clean; strict `tsc --ignoreConfig` over the 4 journal files — exit 0
## Deviations from design
- `post` returns `{ entry, receipt }` (JournalPostResult) so the POST receipt is auditable; design's "POSTED snapshot" is `result.entry`. Supersede successor status = POSTED; reversal entry status = REVOKED with reversed lines (design does not pin these).
- `JOURNAL_ACTION` const added for the receipt-issue context (design's port had no signature).
## Remaining tasks (unchecked, persisted in tasks.md)
- 1C-3 exports and wiring (journal/index.ts, root/package/tsconfig wiring, scanner extension) — 1 unchecked row
## Workload / PR boundary
- Batch: 1C-2, branch `fiscal-authority/journal` boundary. Changed lines: journal 240 + tasks 26 + this section <= 300 cap (ledger counts the full worktree diff incl. OpenSpec artifacts).
- Rollback boundary: revert the 3 journal files and the 13 tasks.md checkboxes; 1C-1 surface (validate.ts, record) untouched except additive functions.
## Evidence revision for settlement
`673c906a8ccc0031afa8408feaae032af5ae3619c4691dcdb3ede27609c540ea`
## Work unit 1c-journal-batch-3 — 1C-3 exports and wiring (batch complete)
**Status:** openspec store, applyState ready -> batch complete; actionContext repo-local, allowedEditRoots [repo-root]; parent owns ledger settlement (no acquire/settle by this phase). Strict TDD: `bun run test` authoritative (wiring batch; coverage-first RED per the 1B-2 precedent).
**Scope:** only `journal/index.ts` (new), root `index.ts` (+1 export line), `package.json` (`./journal` export), `tsconfig.json` + `tsconfig.build.json` (`journal` includes), `tenant-isolation/__tests__/import-boundaries.test.ts` (scanner MODULE_DIRS + APPROVED_TARGETS + journal triangulation), tasks.md (1C-3 row -> [x]), this section. Ledger, receipts, evidence, tenant-core, frozen conformance suites, and all other files untouched.
## Files changed
| Path | Status | Lines |
| journal/index.ts | new | 12 |
| index.ts | +1 additive export line | 1 |
| package.json | +1 additive export line | 1 |
| tsconfig.json | +1 include entry | 1 |
| tsconfig.build.json | +1 include entry | 1 |
| tenant-isolation/__tests__/import-boundaries.test.ts | MODULE_DIRS + APPROVED_TARGETS + journal triangulation | +45/-5 |
| tasks.md | 1 row `- [ ]` -> `- [x]` | 1 |
## TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
| 1C-3 wiring | coverage-first RED: journal was unscanned; after MODULE_DIRS extension the 3 existing journal sources scan clean (6/6) — the gap is the missing public entry (no journal/index.ts, no dist/journal/, no `./journal` export, no tsconfig includes, all proven) | journal/index.ts (record/post/supersede/revoke + types + consts, no ledger export) + root/package/tsconfig wiring; scanner 6/6, typecheck clean (now covers journal/) | journal triangulation: rejects ledger/missions/candidates/agents/cmd/ingest, allows tenant-core/evidence/receipts/internal, rejects `../ledger/index.js` from journal/index.ts | full suite 727, typecheck clean, build clean, dist/journal/ emitted, runtime exports = record/post/supersede/revoke + JOURNAL_* consts + JournalError, zero ledger names |
## Test commands and exact results
- `bunx vitest run tenant-isolation/__tests__/import-boundaries.test.ts` — RED 6/6 (existing journal sources conform; wiring gap proven by missing entry file/build emit/export/includes) -> GREEN 6/6 -> TRIANGULATE 8/8
- `bun run test` — 57 files, 727 passed (724 baseline + 3 new scanner tests)
- `bun run typecheck` — clean (exit 0; now covers journal/ via tsconfig include)
- `bun run build` — clean (exit 0); dist/journal/ emitted (index/types/validate/journal .js + .d.ts)
- `git diff --stat HEAD` + untracked journal/index.ts — ~97 changed lines total <= 300 cap
- dist/journal/index.js runtime export check — record/post/supersede/revoke + JOURNAL_SIDE/STATUS/ERROR/ACTION + JournalError; ledger-ish exports: NONE
## Deviations from design
- Task row 1C-3 says `tenant/`; per the rescoped layout the approved tenant dependency is `tenant-core` (same deviation as 1B-5). journal/index.ts re-exports types (incl. the SignedReceipt type via types.ts) that resolve through receipts/ and tenant-core/evidence/, which ARE approved targets — no scanner false positive.
## Remaining tasks (unchecked, persisted in tasks.md)
- Slice 1C fully complete (25/25 rows). Slices 1D (15) and 1E (18) implementation rows unchecked; 7 parent-owned chain lifecycle gates unchecked.
## Workload / PR boundary
- Batch: 1C-3 (final of Slice 1C), branch `fiscal-authority/journal` boundary (parent owns branch/commits and the chained-PR gate). Changed lines ~97 <= 300 cap.
- Rollback boundary: remove `journal/index.ts`, the 4 wiring additions (root index.ts export, package.json `./journal`, tsconfig.json + tsconfig.build.json includes), and the scanner extension; journal core (types/validate/journal + tests) remains intact.
## Evidence revision for settlement
`dd12c5445c6642dd67dc9cdf98155577d41a855a33a711b62f7ca5887a7d737c`

## Work unit 1d-candidate-ordering-batch-1 — 1D-1 + 1D-2 (batch complete)
**Status:** openspec store, applyState ready -> batch complete; actionContext repo-local, allowedEditRoots [repo-root]; parent owns ledger settlement (no acquire/settle by this phase). Strict TDD: RED -> GREEN -> TRIANGULATE -> REFACTOR, `bun run test` authoritative; objective `1d-candidate-ordering-1` (max 300 changed lines, 1 attempt) — parent owns ledger accounting.
**Scope:** only `fiscal/types.ts`, `fiscal/candidate-ordering.ts`, `fiscal/__tests__/candidate-ordering.test.ts`, tasks.md (6 rows -> [x]), this section. 1D-3/1D-4/1D-5, `fiscal/index.ts`, scanner, wiring untouched.
## Files changed
| Path | Status | Lines |
| fiscal/types.ts | new | 61 |
| fiscal/candidate-ordering.ts | new | 68 |
| fiscal/__tests__/candidate-ordering.test.ts | new | 132 |
| tasks.md | 6 rows `- [ ]` -> `- [x]` | 12 |
## TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
| 1D-1 validation | 1 file failed, 0 tests (modules ../candidate-ordering.js + ../types.js absent) | 7/7 | spy order validate->reconcile->build->propose->inspect; builder receives exactly the validated input (toBe VALIDATED); core-throw stops before any candidate call | full suite 734 |
| 1D-2 reconciliation | same RED run | >=1 same-scope gate; MISSING_RECONCILIATION_EVIDENCE / RECONCILIATION_SCOPE_MISMATCH | other-scope evidence fails closed, inspect never reached | typecheck/build clean |
## Test commands and exact results
- `bunx vitest run fiscal/__tests__/candidate-ordering.test.ts` — RED 1 failed/0 tests -> GREEN 7 passed
- `bun run test` — 58 files, 734 passed (727 + 7); `bun run typecheck` clean; `bun run build` clean; strict `tsc --ignoreConfig` over the 3 fiscal files — exit 0
## Deviations from design
- Evidence copies (never shares) the input scope reference, so same-scope assertions use `scopeKey` equality; the adapter runs the full ordered flow through the candidate port seam (propose + inspect) in this batch, with 1D-3 wiring the real `CandidateLifecycle` and adding byte-identity tests.
## Remaining tasks (unchecked, persisted in tasks.md)
- 1D-3 (4 rows), 1D-4 (3 rows), 1D-5 (1 row) — 8 unchecked
## Workload / PR boundary
- Batch: 1D-1 + 1D-2, branch `fiscal-authority/candidate-ordering` boundary (parent owns branch/commits). Changed lines: fiscal 261 + tasks 12 + this section <= 300 cap.
- Rollback boundary: delete the 3 fiscal files; revert the 6 tasks.md checkboxes; no wiring/scanner change to revert.
## Evidence revision for settlement
`7e855010a9d37335f292f6f8458bb55af5c8b2afc03261258a64b287d2a194b5`

## Work unit 1d-candidate-ordering-batch-2 — 1D-3 + 1D-4 (batch complete)
**Status:** openspec store, applyState ready -> batch complete; actionContext repo-local, allowedEditRoots [repo-root]; parent owns ledger settlement (no acquire/settle by this phase). Strict TDD: RED -> GREEN -> TRIANGULATE -> REFACTOR, `bun run test` authoritative; objective `1d-candidate-ordering-2` (max 300 changed lines, 1 attempt) — parent owns ledger accounting.
**Scope:** only `fiscal/types.ts`, `fiscal/candidate-ordering.ts`, `fiscal/__tests__/candidate-ordering.test.ts`, tasks.md (7 rows -> [x]), this section. 1D-5 (`fiscal/index.ts`, exports, wiring, scanner), `contracts/**`, and all other files untouched (contracts/candidate.md is only read by a test).
## Files changed
| Path | Status | Lines |
| fiscal/types.ts | modified | +22 |
| fiscal/candidate-ordering.ts | modified | +24 |
| fiscal/__tests__/candidate-ordering.test.ts | modified | +186 |
| tasks.md | 7 rows `- [ ]` -> `- [x]` | 14 |
## TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
| 1D-3 concrete wiring | 2 failed/13 passed: CandidateLifecyclePort absent + 3-arg default wiring missing (candidatePort undefined) | CandidateLifecyclePort wrapper + adapter default `new CandidateLifecyclePort(new CandidateLifecycle())`; 15/15 | SUBJECT_MUTATED: downstream in-place byte corruption after hashing -> real inspect throws, no fiscal result returned | full suite 742 |
| 1D-4 frozen lifecycle | same RED run | correction path via real lifecycle: submitForReview -> correct (lineage, new id) -> re-inspect -> second correct throws CORRECTION_BUDGET_EXCEEDED; contract version pinned (0.1 FROZEN); no ingest/SUNAT import in fiscal sources | ordering: default-wired adapter completes validate->reconcile->build then real propose->inspect; missing evidence never reaches construction | conformance 16/16, typecheck/build clean |
## Test commands and exact results
- `bunx vitest run fiscal/__tests__/candidate-ordering.test.ts` — RED 2 failed/13 passed -> GREEN 15/15
- `bun run test` — 58 files, 742 passed (734 + 8); `bunx vitest run contracts/__tests__/candidate-conformance.test.ts` — 16/16 frozen, unchanged
- `bun run typecheck` — clean; `bun run build` — clean; strict `tsc --ignoreConfig` over the 3 fiscal files (mandatory flags) — exit 0
- `git diff --stat HEAD` — fiscal 232 changed (211 ins / 21 del) + tasks 14 + this section <= 300 cap
## Deviations from design
- The candidate port stays injectable for spies; the concrete `CandidateLifecyclePort` wrapper is the default wiring, and the adapter never subclasses or modifies the frozen lifecycle. SUBJECT_MUTATED propagates as the real CandidateError (fail-closed), matching the design's "local snapshot not returned as a successful fiscal result".
## Remaining tasks (unchecked, persisted in tasks.md)
- 1D-5 exports and wiring (fiscal/index.ts, root/package/tsconfig wiring, scanner extension) — 1 unchecked row
## Workload / PR boundary
- Batch: 1D-3 + 1D-4, branch `fiscal-authority/candidate-ordering` boundary (parent owns branch/commits). Changed lines: fiscal 232 + tasks 14 + this section <= 300 cap (ledger counts the full worktree diff incl. OpenSpec artifacts).
- Rollback boundary: revert the 3 fiscal files and the 7 tasks.md checkboxes; batch-1 surface (1D-1/1D-2) remains intact.
## Evidence revision for settlement
`973fdaf0893129174f37a7ea845d184e142b0f98175f84694d4dd03adb255c38`
