# Apply Progress — Program-Lock Promotion (SDD-010, release-train)

> Change: `sdd-010-release-train` · Program: Drenyra Dominion · Batch: 1 (of 1 — apply unit) · Phase: apply
> Structured status consumed (native `gentle-ai sdd-status`): `artifactStore: openspec`, `applyState: ready`,
> `nextRecommended: apply`, `blockedReasons: []`, `actionContext.mode: repo-local`, allowedEditRoots =
> `[/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai]`. Engram HTTP server unreachable at apply time
> (gentle-engram could not reach 127.0.0.1:7437) — OpenSpec store used exclusively; no engram persistence performed.

## Runtime attempt ledger

- Attempt token (parent-provided, recorded per working context): `sha256:a0aca442db7b9e136c2be2aad2e8e760605f650da60667b951c8067fe64eccd4`
  (work unit `promote`, objective `sha256:5cc0422c3e5025ca3d74976763e6f6c8c28f7238ea9db3728b88ac687781031a`, max_attempts 1, max_changed_lines 400).
- `sdd-attempt acquire` (request `apply-baseline-*`) with the parent token → `state: proceed`.
- Baseline runtime runs settled: `sdd-attempt settle --outcome passed` (request `apply-baseline-settle-*`) →
  `state: complete`; evidence-revision `cc79d3eaa0471c4910c3ecdeeb8fcbc7bc12a84dd8486fecddc9e5cb409cb136`.
- Final verification acquire (request `apply-final-*`) → `state: complete` (objective attempt budget of 1 exhausted
  by design). Final suite/typecheck/build runs executed as evidence-gathering; outcomes recorded below.

## SDD-010 evidence supplement (apply-time, resolves evidence IDs cited by the promoted lock)

Resolution rule: `010E-*` resolve in this section; `E-*` resolve in `status-and-evidence.md` §3 (W1 register,
unmodified — W1-owned); `W2E-*` resolve in the archived W2 apply-progress. All facts captured at apply time
2026-08-15 against frozen revision `R = d440203183e24b2a0ecf773915888bb6072fc015` (branch `main`).

| `claimId` | Axis / value | Temporal class | Source kind | Source locator | Repository identity | Revision | Captured at (UTC) | Verification method | Freshness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 010E-001 | evidence — host version + license | current-claim (revision-bound) | repository | `package.json` (version `0.4.0`), `LICENSE` (proprietary) | arkelythex/drenyra-ai | d440203 | 2026-08-15 (read at frozen revision) | Read at inspected revision; `package.json` version corroborated by `git show HEAD:package.json` | verified-revision-bound (d440203) |
| 010E-002 | evidence — host test suite | current-claim (revision-bound) | executable-verification | `bun run test` (vitest 4.1.10) | arkelythex/drenyra-ai | d440203 | 2026-08-15T07:28:33Z | Fresh run: 65 files, **915/915 passed**, exit 0 | verified-revision-bound (d440203) |
| 010E-003 | evidence — host typecheck | current-claim (revision-bound) | executable-verification | `bun run typecheck` (tsc --noEmit) | arkelythex/drenyra-ai | d440203 | 2026-08-15T07:29Z | Fresh run: clean, exit 0 | verified-revision-bound (d440203) |
| 010E-004 | evidence — host conformance | current-claim (revision-bound) | executable-verification | `bun run brand:conformance` (scripts/brand-conformance.mjs) | arkelythex/drenyra-ai | d440203 | 2026-08-15T07:31:38Z | Fresh run: PASS, exit 0 | verified-revision-bound (d440203) |
| 010E-005 | evidence — host GitHub visibility | current-claim (observation-scoped) | github-metadata | `gh repo view arkelythex/drenyra-ai --json nameWithOwner,visibility,isPrivate` | arkelythex/drenyra-ai | n/a (live) | 2026-08-15T07:38:15Z | Direct API query: visibility PUBLIC, isPrivate false, default branch main = d440203 | verified-current (observation-scoped); corroborates E-005 |
| 010E-006 | evidence — engram sibling fact | current-claim (observation-scoped) | github-metadata | `gh api repos/arkelythex/drenyra-engram` + `git/ref/heads/main` | arkelythex/drenyra-engram | f997abc9cd97551cb0b9cae74623ec1fe002b9d2 | 2026-08-15T07:38:12Z | Direct API queries: visibility public, default branch main, immutable main SHA | verified-current (observation-scoped); corroborates E-010 |
| 010E-007 | evidence — pi sibling fact | current-claim (observation-scoped) | github-metadata | `gh api repos/arkelythex/drenyra-pi` + `git/ref/heads/main` | arkelythex/drenyra-pi | 42607035c42901eebadc1bf2879cb09a1416f3b5 | 2026-08-15T07:38:14Z | Direct API queries: visibility public, default branch main, immutable main SHA | verified-current (observation-scoped); corroborates E-010 |
| 010E-008 | evidence — host artifact digest | current-claim (revision-bound) | immutable release asset | GitHub Release `drenyra-ai v0.4.0` asset `drenyra-ai-0.4.0.tgz` (downloaded to `dist/`) | arkelythex/drenyra-ai | d440203 | 2026-08-15T07:33Z | Local `sha256sum` = release asset digest `2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36` | verified-current (immutable asset) |

Private trio: `drenyra-command-center`, `drenyra-skills`, `drenyra-guardian-angel` are PRIVATE (E-010) with NO
credentialed revision evidence produced before promotion → remain `temporalClass: "unknown"`, `commitSha: null`,
`status: "awaiting-evidence"`. No SHA/version/test total/visibility invented for them (R2, D7).

## Phase 0 — setup and evidence (completed)

1. ✅ Revision frozen: `R = d440203183e24b2a0ecf773915888bb6072fc015`, branch `main` (tag `v0.4.0` annotated →
   `d440203`, GPG-signed, released as `drenyra-ai v0.4.0` with assets). `scripts/checksum-lock.mjs` absent at
   baseline (verified). No source file mutated before the baseline capture.
2. ✅ Green revision-bound baseline at R: `bun run test` → **915 passed / 915 total** (65 files), exit 0, started
   2026-08-15T02:28:33 local (07:28:33Z); `bun run typecheck` clean; `bun run brand:conformance` PASS
   (010E-001..004). Stale W2-era `0.2.1`/`774`/`549ed640…` claims replaced, not carried forward (R1, D12).
3. ✅ Sibling facts fetched at apply time via `gh api` (R2, D7): engram `f997abc9…` PUBLIC (010E-006),
   pi `42607035…` PUBLIC (010E-007); host PUBLIC (010E-005). Private trio PRIVATE (E-010) → unknown.
4. ✅ Protected paths identified (`contracts/**`, archived changes, `missions/**`, `candidates/**`, `agents/**`,
   `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**`, runtime library modules) — no task edits any
   protected path; final `git status` confirms (see Phase 3).

## Phase 1 — implementation (completed)

### 1.1 `scripts/checksum-lock.mjs` (new, 284 lines)

Bounded generation/verification CLI per design D2/D3/D4/D5: root from `import.meta.url`, `--lock`,
`--artifact repository=path` bindings, `--output <staging-file>`, `--verify`. `realpath` resolution, exactly one
host binding, duplicate repo/artifact rejection, admissible-current-claim admission, unknown-repo rejection,
lock self-inclusion rejection (incl. aliases), stable-basename rules, `node:crypto` SHA-256 lowercase hex, canonical
sort (repository→artifact, code-point), `setSha256` over compact `entries` serialization, two-space JSON + trailing LF.
Never invokes Git/GitHub; never reads/emits HEAD/tag-target/carrying-commit SHAs.

### 1.2 Focused checksum test (new, 478 lines, strict TDD)

`scripts/__tests__/checksum-lock.test.ts` — 13 tests, spawn-based per the existing script-test convention.
RED (all 13 failed: `scripts/checksum-lock.mjs` did not exist) → GREEN (13/13) → TRIANGULATE (duplicate artifact
identity across repos, `--output` byte fidelity, declared-entry-without-input) → REFACTOR (none needed; pure
functions, fail-closed errors, no stack traces). Coverage: cwd-independent determinism, reversed CLI order,
lowercase 64-hex digests + change-on-tamper, no lock path / carrying-commit SHA in output, lock self-inclusion
(direct/relative/normalized/symlinked), missing/unreadable/non-regular/symlinked/duplicate/unknown/undeclared
fail-closed, exactly-one-host, declared-entry-without-input, unknown-trio omission/rejection, six `--verify`
mismatch classes (changed artifact, missing entry, extra entry, wrong revision, reordering, bad setSha256).

### 1.3 Schema amendment — `program-lock.schema.json` (D11)

Structured `checksums` (`algorithm` const, `canonicalization` const, `entries[]` with `repository`/`revision`
40-hex/`artifact`/`sha256` 64-hex, `setSha256` 64-hex), `attestation` declaration (scheme const, tag, asset,
`verifiedRevision` 40-hex, `checksumSetSha256` 64-hex, `carryingCommitSha` string|null 40-hex, note),
per-sibling `siblingRepositories` (temporalClass enum, commitSha 40-hex|null, githubVisibility enum, source,
fetchedAt, evidence, status), `testPassed`/`testTotal` non-negative integers, and an `if`/`then` rule requiring
populated `currentVerified`/`checksums`/`attestation` when `status: promoted`. Schema validates as draft-07
(`ajv.validateSchema` true with `ajv-formats`); promoted lock validates (true). Cross-field equality / attestation
bindings remain readback-gate concerns, not schema claims (D11).

### 1.4 Lock promotion — `program-lock.json` (R1, R2, R3; D6, D7, D8, D9)

`status: candidate → promoted` only after every local gate passed. `currentVerified` refreshed to revision-bound
facts: version `0.4.0`, `testTotal: 915`, `testPassed: 915`, clean typecheck, passing conformance, `PUBLIC`,
`inspectedRevision: d440203…`, `inspectedAt: 2026-08-15T07:28:33Z`, evidence `010E-001..007`, `commitSha: null`.
`currentVerified.siblingRepositories` populated per sibling; private trio unknown. `repositories[]` preserved as the
historical snapshot (D8). `checksums` = exact `scripts/checksum-lock.mjs` output (1 entry: drenyra-ai, revision R,
artifact `drenyra-ai-0.4.0.tgz`, sha256 `2e3bd072…` = published release asset digest; setSha256
`62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea`, independently recomputed and verified).
`attestation` declaration recorded (scheme `signed-git-tag+github-release-asset-v1`, tag `drenyra-dominion-v0.4.0`,
asset `drenyra-dominion-v0.4.0.attestation.json`, `verifiedRevision` = R, `checksumSetSha256`, `carryingCommitSha: null`).

### 1.5 Attestation workflow + docs (R5; D10)

- `release-train.md` §4.1: checksum generation/readback, signed-tag + GitHub Release asset attestation workflow,
  two-step publication semantics (commit B `status: promoted` = local gate; publication only after external B5
  readback).
- `delivery-sequence.md` §7 item 4: **documented, kept OPEN** — see "Deviations and decisions" below.
- `capability-matrix.yaml`: evidence block refreshed (inspectedRevision d440203, sdd010Supplement pointer), host
  version 0.4.0 (010E-001), tests.current 915 (010E-002), sibling_facts (010E-006/010E-007 + E-010); sibling
  capability/test rows unchanged (still unknown — only SHAs/visibility verified).

## Phase 2 — tests and verification (completed)

| Gate | Result |
| --- | --- |
| Focused checksum Vitest file | ✅ 13/13 green (also post-all-edits) |
| Schema/lock validity | ✅ both JSON parse; schema valid draft-07 (`ajv.validateSchema` + formats); promoted lock validates |
| (1) Fresh revision-bound host verification binds to exact promoted revision | ✅ 010E-001..005 bound to d440203 = `currentVerified.inspectedRevision` |
| (2) Sibling unknown preservation | ✅ private trio `unknown`/`awaiting-evidence`, SHAs null |
| (3) Promotion valid only after all gates pass | ✅ promoted only after fresh facts + resolved sibling facts + checksums + evidence + schema validity; stale W2 facts replaced (script even fail-closed on the 41-char stale `549ed640…` revision before promotion) |
| (4) Checksums exclude the lock + no carrying-commit reference | ✅ `program-lock.json` absent from output (0 matches); host `commitSha` null; trio SHAs null; no commit-B SHA (commit B does not exist) |
| (5) Attestation recording | ✅ declaration recorded (carryingCommitSha null); §7 item 4 documented but **open** pending external B5 readback over commit B (spec R5 fail-closed; see deviations) |
| (6) No runtime/install-time consumption code | ✅ only script + tests + governance records added; `git status` shows no protected/runtime path |
| Generation twice + `--verify` | ✅ byte-identical; verify exit 0; no lock path/carrying SHA in output |
| Evidence ID resolution | ✅ 010E-001..008 resolve in this document; E-010 in status-and-evidence.md §3; each record names the same revision/fetch result the lock claims |
| Public sibling SHAs/visibility vs fresh gh api | ✅ f997abc9… / 42607035… PUBLIC (re-fetched twice, immutable) |
| Existing release-integrity / ecosystem-script-resilience suites | ✅ unchanged results (21/21) — new checksum test does not alter sbom/checksums/verify-release-integrity behavior |

## Phase 3 — verification (completed)

- Focused checksum test first (green), then full suite `bun run test` → **928 passed / 928 total** (66 files) —
  baseline 915 at R + 13 new checksum tests, all green — then `bun run typecheck` clean and `bun run build` done.
- Spec pass/fail: see R1–R7 table below. Runtime consumption of the lock (SDD-020 slice C) and full private-repo
  federation remain explicitly out-of-scope/deferred.
- Protected-path check: `git status` lists only
  `openspec/programs/drenyra-dominion/{program-lock.json, program-lock.schema.json, release-train.md,
  delivery-sequence.md, capability-matrix.yaml}`, `scripts/checksum-lock.mjs`, `scripts/__tests__/checksum-lock.test.ts`,
  and `openspec/changes/sdd-010-release-train/`. No protected path, no archived change record, no frozen contract,
  no runtime consumer touched.

## Spec requirement pass/fail (R1–R7)

| Requirement | Result | Notes |
| --- | --- | --- |
| R1 revision-bound freshness | ✅ PASS | fresh 0.4.0/915/915/clean typecheck/passing conformance/PUBLIC at d440203; stale 0.2.1/774/549ed640… removed; `commitSha: null` |
| R2 honest sibling facts | ✅ PASS | engram/pi PUBLIC with fetched immutable SHAs + source/fetchedAt/evidence; private trio unknown, nothing fabricated; snapshots not relabeled |
| R3 promotion status / fail-closed gates | ✅ PASS | promoted only after all gates; unsupported/dangling claims block (script fail-closed on stale malformed revision); schema conditional requires populated structures |
| R4 deterministic lock checksums | ✅ PASS | sha256 lowercase hex, canonical order, setSha256; lock self-excluded; no carrying-commit SHA; deterministic across cwds (tests) |
| R5 release attestation | ✅ PASS (declaration + workflow) / completion pending | declaration recorded (tag/asset/verifiedRevision/checksumSetSha256, carryingCommitSha null); §7 item 4 workflow documented, completion gated on external B5 readback over commit B (parent-owned) |
| R6 no runtime consumption | ✅ PASS | docs + tooling only; no consumer added; no frozen contract changed |
| R7 testable promotion gates | ✅ PASS | 13 focused tests exercise determinism, ordering, digest format, self-exclusion, fail-closed inputs, verify mismatch classes; six gate facets exercised above |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 checksum-lock producer | `scripts/__tests__/checksum-lock.test.ts` | Unit (spawn) | N/A (new file) + existing suites later 21/21 | ✅ Written (10 tests failed: script absent) | ✅ 11/11 | ✅ +2 cases (duplicate artifact identity, `--output` byte fidelity) + declared-entry-without-input | ✅ Clean (pure functions, fail-closed, no stack traces) |

### Test Summary

- **Total tests written**: 13 (checksum-lock.test.ts)
- **Total tests passing**: 13; full suite 928/928 (66 files)
- **Layers used**: Unit (13, subprocess)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: `parseArgs`, `readLock`, `assertStableBasename`, `resolveArtifact`, `canonicalCompare`, `declaredRepositories`, `computeEntries`, `checksumSet`, `verify`

## Files changed

| File | Change | Content-delta lines (whitespace-ignored) |
| --- | --- | --- |
| `scripts/checksum-lock.mjs` | new deterministic checksum producer | 284 (new) |
| `scripts/__tests__/checksum-lock.test.ts` | new strict-TDD focused tests | 478 (new) |
| `openspec/programs/drenyra-dominion/program-lock.json` | promotion + refresh + checksums + attestation | 93 +/– |
| `openspec/programs/drenyra-dominion/program-lock.schema.json` | bounded definitions + if/then | 73 +/– |
| `openspec/programs/drenyra-dominion/release-train.md` | §4.1 attestation workflow | 40 |
| `openspec/programs/drenyra-dominion/delivery-sequence.md` | §7 item 4 state + supersede rule | 5 |
| `openspec/programs/drenyra-dominion/capability-matrix.yaml` | evidence refresh + sibling facts | 23 +/– |

## Deviations and decisions

1. **Changed-line budget overrun → required two-PR split.** Forecast estimated ~170–220 authored lines; the actual
   authored delta (whitespace-ignored tracked 205+/29−, plus new files 284 + 478) totals **~990 authored lines**,
   driven mainly by the focused test file (478 lines vs the 50–60 forecast; coverage per tasks 1.2 is inherently
   broad and matches the existing release-integrity test convention of 430+ lines). This exceeds the 300-line repo
   review budget and the 400-line hard cap. Per tasks Phase 3, this slice MUST NOT merge as one unit: promote the
   Forecast's split boundary — **PR 1: `scripts/checksum-lock.mjs` + `scripts/__tests__/checksum-lock.test.ts`;
   PR 2: lock/schema/docs/evidence refresh** (do not weaken tests/schema to fit). The working tree holds the full
   uncommitted set (do-not-commit constraint); the parent owns the two-PR delivery.
2. **delivery-sequence §7 item 4 kept OPEN.** The task text requires marking it complete ONLY after the external
   attestation is recorded and read back successfully (spec R5). Commit B does not exist (apply is explicitly
   do-not-commit), so no signed tag/release asset can pin it yet; the existing signed `v0.4.0` tag pins d440203 = R
   (the inspected revision), not the carrying commit. The workflow is documented and the declaration recorded; the
   parent completes §7 item 4 after B5 readback over commit B.
3. **Runtime attempt ledger:** the promote objective has `max_attempts: 1`; the baseline settle closed it
   (`state: complete`), so the final verification acquire returned `complete` (no further ledger attempt).
   Final runs executed as evidence-gathering; outcomes recorded above.
4. **status-and-evidence.md untouched** (W1-owned per its header); evidence supplement `010E-*` lives in this
   apply-progress and is pointed to by capability-matrix.yaml `program.evidence.sdd010Supplement`.
5. **Lock/schema files re-emitted with clean 2-space indentation** (the committed files had inconsistent
   12-space/6-space indentation). JSON semantics unchanged except the intended amendments; content delta measured
   whitespace-ignored.

## Remaining tasks (exact unchecked lines)

Implementation-owned rows below remain **unchecked by design** (see deviations 1–2); all other implementation rows
are `[x]` in `tasks.md`:

- Phase 2 gate facet (5) attestation completion — external B5 readback over commit B (parent-owned post-commit).
- Parent-owned governance rows (bounded review/delivery) are deferred lifecycle actions, not implementation work.
