# Apply Progress — Resolved SBOM Fidelity, Slice A (corrective run)

## Status

`completed` — one bounded corrective run that validated and finished the partial implementation. All four allowlisted paths are correct, all per-file caps and the 300-line hard cap are met, focused tests pass, real-repo release-integrity verification passes, typecheck/lint pass, and the full-suite differential shows only the 3 documented pre-existing `cmd/__tests__/cli.test.ts` failures.

Native corrective attempt: `sha256:bcee9b23a19426a28cf9eaa2c69dd29cb804e11e44dab28fa2fb2de20f44e137` (parent settles; no commit/push/review/settle performed).

## Structured status consumed

Artifact store: `openspec` (change artifacts under `openspec/changes/resolved-sbom-fidelity/`; Engram HTTP server unreachable, `mem_search` failed — file store authoritative and complete). No prior `apply-progress.md` existed; this is the first batch. Strict TDD active per `openspec/config.yaml` (`strict_tdd: true`, runner vitest, `test_command: bun run test`). `actionContext` warnings: none (no workspace-planning mode, no edit-root constraints; edits confined to the change's allowlist).

## What the corrective run did

The earlier worker left a partial candidate: resolver + verifier + tests + sbom changes (tracked diff 180+/59− plus an 80-line untracked resolver = 319 total, with `scripts/sbom.mjs` at 64 and tests at 125, both over their per-file caps). This run:

1. **Assessed the partial candidate** against spec/design/tasks and the repository's real `bun.lock` (authoritative shape: `lockfileVersion: 1`, trailing commas, `optionalPeers: string[]`, single-record `packages` values, `workspaces[""].dependencies` = `{ajv, ajv-formats, pg}`). The resolver validated cleanly against the real lock and produced exactly the 19-node required-runtime closure the spec asserts. Verifier and tests were functionally sound (focused suite already green 12/12). The only defect was **budget**: total 319 > 300, sbom.mjs 64 > 35, tests 125 > 110.
2. **Rewrote `scripts/sbom.mjs`** to the minimum honest diff from HEAD: keeps the manifest validation block (defense-in-depth; the shared resolver re-validates), single compact component map, multi-line dependency entry matching the prior shape, atomic temp-write + rename with cleanup, explicit missing-`dist/` fail-closed check, `sbom:`-prefixed catches without stack traces. Result: **35 changed lines (21+/14−)**, exactly at cap.
3. **Trimmed the test file** from 125 to **109 changed lines** without dropping any coverage class: compressed the `buildLock` doc/body, dropped a redundant `existsSync` guard on the fixture copy, inlined the missing-record case, compacted the branched fixture and drift/loop statements. All 12 tests (8 existing + 4 new fidelity tests) still pass; all RED cases from Task 1, drift classes, and lock mutations remain asserted.
4. **Re-ran the full evidence battery** on the final bytes (below).

## Completed tasks and persisted checkbox updates

All 21 implementation-owned checkboxes in `openspec/changes/resolved-sbom-fidelity/tasks.md` are marked `- [x]` (Tasks 1–7), including the RED/GREEN/TRIANGULATE/REFACTOR sequence and the final-evidence items. The two parent-owned Task 8 rows (`sdd-owner: parent`) are untouched and remain `- [ ]` — deferred lifecycle actions (bounded review + delivery gate), not executable by `sdd-apply`.

## Files changed (four allowlisted paths only)

- `scripts/lib/bun-lockfile.mjs` — **new**, 80 lines (cap 80): `resolveRuntimeGraph(root)`; trailing-comma-tolerant v1 parse; validates manifest identity/deps, lockfileVersion 1, root workspace, record tuples, string-map fields, `optionalPeers: string[]`; unique-record resolution (name-prefix version extraction, zero/>1 record fail-closed); required-runtime closure over `dependencies` only; deterministic sorted output. No I/O side effects, no process exit, no logging.
- `scripts/sbom.mjs` — 35 changed lines (cap 35): imports the shared resolver, maps nodes to CycloneDX components (`type`, `bom-ref`, exact `version`, `scope: "required"`, single `drenyra:resolution`), root `bom-ref` = package name, closed sorted `dependencies` array, atomic write.
- `scripts/verify-release-integrity.mjs` — 50 changed lines (cap 65): imports the shared resolver, recomputes the expected contract independently, rejects component/name-set/version/type/scope/classification drift, duplicate components, malformed dependency entries, duplicate/extra/missing/dangling edges; runs before the preserved checksum verification.
- `scripts/__tests__/release-integrity.test.ts` — 109 changed lines (cap 110): compact `bun.lock` fixture helper, 4 new fidelity tests (exact versions/closure/exclusions, branched+cyclic dedup with `optionalPeers: string[]`, all verifier drift classes, table-driven resolver fail-closed), existing checksum/cwd/no-partial-output tests still active.

## Test commands run (exact)

| Command | Result |
|---|---|
| `bunx vitest run scripts/__tests__/release-integrity.test.ts` | 12/12 passed |
| `node scripts/sbom.mjs && node scripts/checksums.mjs && node scripts/verify-release-integrity.mjs` (real repo) | 19 components; checksums and SBOM verified; exit 0 |
| `node scripts/verify-package-files.mjs` | OK (dist tree + packaged files complete) |
| `bun run typecheck` | exit 0 |
| `bun run lint` (biome 2.3.15) | 158 files checked, no fixes, exit 0 |
| `bun run test` (full suite) | 668 passed / 3 failed (671 tests, 54 files) |
| Baseline differential: `git stash -u` → `bunx vitest run cmd/__tests__/cli.test.ts` at HEAD | 3 failed / 8 passed — identical 3 failures, pre-existing and unrelated (mission-start store path; config.yaml documents "3 pre-existing failures in cmd/**tests**/cli.test.ts as of this init"); restored via `git stash pop` |

## TDD Cycle Evidence

- **RED** (authored by the earlier worker before production changes, preserved and validated here): the four fidelity tests assert exact locked versions, complete deduplicated closure, exclusions, classification/scope, closed sorted graph, byte determinism, every verifier drift class, and every resolver fail-closed class. These fail against the pre-slice direct-only/declared-range behavior.
- **GREEN**: resolver (80), sbom.mjs (35), verifier (50) implemented; focused suite 12/12 green.
- **TRIANGULATE**: branched shared-transitive dedup, cyclic graph, malformed record/map, `optionalPeers` non-array rejection, missing/ambiguous records, root drift, unsupported version, missing lock — all covered and green.
- **REFACTOR**: sbom.mjs rewritten to the minimum diff from HEAD (64 → 35 changed lines) and tests compacted (125 → 109) with no behavior change; suite re-run green after each compression.

## Determinism evidence

Two generations from identical inputs 1.3 s apart produced byte-identical `dist/sbom.json`:

```
657ea86f8d7b824e8a361e0a8cc8aa121ae41a74a098b6cbb4e9ac3583ed37ce  dist/sbom.json
657ea86f8d7b824e8a361e0a8cc8aa121ae41a74a098b6cbb4e9ac3583ed37ce  dist/sbom.json
```

Generated SBOM spot-check: CycloneDX 1.5; 19 components; all `scope: "required"`; exactly one `drenyra:resolution` each; direct = `ajv, ajv-formats, pg`; no `pg-cloudflare`/`pg-native`/dev packages; no `^`/`~`/`>=` range strings; 20 dependency entries (root + 19 nodes) with no dangling refs; root metadata `bom-ref: drenyra-ai`, `version: 0.2.0`.

## Diff budget and path audit

| File | Cap | Actual |
|---|---|---|
| `scripts/lib/bun-lockfile.mjs` (new) | 80 | 80 |
| `scripts/sbom.mjs` | 35 | 35 |
| `scripts/verify-release-integrity.mjs` | 65 | 50 |
| `scripts/__tests__/release-integrity.test.ts` | 110 | 109 |
| **Total** | **≤300** | **274** |

Path audit (`git status --porcelain`): only the four allowlisted paths changed. `package.json`, `bun.lock`, CI, `dist/` (gitignored — generated SBOM/checksums are not a rollback surface), checksum/signature surfaces, and unrelated modules are untouched. Rollback boundary: revert/remove the four allowlisted paths as one unit.

## Deviations from design

None functional. `scripts/lib/bun-lockfile.mjs` implements the tasks.md allowlist path (the design's earlier `scripts/bun-lock-runtime.mjs` name was superseded by tasks.md and the partial). No other deviation; the design's range-satisfaction hardening (MAY) was omitted, as permitted.

## Remaining tasks (deferred lifecycle actions, parent-owned)

- `- [ ] Start or reuse a bounded review of the four allowlisted paths ... <!-- sdd-owner: parent -->`
- `- [ ] Apply the resolved review/delivery gate (single PR, no chaining, size-exception) ... <!-- sdd-owner: parent -->`

## Workload / PR boundary

Single PR, no chaining (`Chained PRs recommended: No`; `Decision needed before apply: No`; `400-line budget risk: Low`). Changed lines 274 ≤ 300, no size exception needed. No commit, push, review, or attempt settle performed (parent-owned).

## Continuation run (apply verification, no code changes authored)

Native status consumed (`gentle-ai sdd-status resolved-sbom-fidelity --cwd . --json`): `applyState: ready`, `nextRecommended: apply`, `verify/archive: blocked`, `blockedReasons: []`. The two remaining unchecked task rows are Task 8, both `<!-- sdd-owner: parent -->` (bounded review + delivery gate) — preserved byte-for-byte and deferred; `sdd-apply` MUST NOT execute bounded-review, receipt, or delivery-gate lifecycle actions. All 25 implementation-owned rows (Tasks 1–7) were already `- [x]` and committed at HEAD `293523d`; the working tree was clean, so this run authored **zero** new code changes and updated no checkboxes.

Verification re-run evidence:

| Command | Result |
|---|---|
| `bunx vitest run scripts/__tests__/release-integrity.test.ts` | 12/12 passed |
| `node scripts/sbom.mjs && node scripts/checksums.mjs && node scripts/verify-release-integrity.mjs` (real repo) | 19 components; checksums and SBOM verified; exit 0 |
| Two generations from identical inputs (`node scripts/sbom.mjs` x2, 1s apart) | `657ea86f8d7b824e8a361e0a8cc8aa121ae41a74a098b6cbb4e9ac3583ed37ce` both runs — byte-identical |
| `git status --porcelain` / `git diff HEAD --stat` | clean; no tracked changes beyond committed HEAD |

Native attempt settled exactly once (token `sha256:09977…963b4`, work unit `complete-pending-sbom-tasks`, request id `settle-resolved-sbom-apply-20260812-1`): outcome `passed` — evidence revision `sha256:fa121037477655c444074e3c4600a54d3305a0beaf12cfb982dac85f5a62a2a3` (HEAD tree at `293523d`), harness `reused` (existing vitest suite), no cleanup needed (tree clean, no temp artifacts). Diagnosis records that the apply scope is complete and the two remaining rows are parent-owned lifecycle actions.

Engram persistence: `mem_search`/`mem_save` for topic `sdd/resolved-sbom-fidelity/apply-progress` could not reach the Engram HTTP server at `http://127.0.0.1:7437` (same as the prior run); OpenSpec file store remains authoritative and complete.

## Lifecycle resolution (parent-owned, post-apply)

Task 8 resolved by the parent after ordinary-policy verification passed. Bounded review was not started: native immutable review transport is unsupported in this runtime (`immutable_review_transport_unsupported`). Receipt-driven development was disabled for this clone by explicit user authorization; no review lifecycle was invoked and no review was re-enabled. Delivery therefore proceeded under ordinary repository policy, which passed.

Verifier evidence (exact):

- Focused suite (`bunx vitest run scripts/__tests__/release-integrity.test.ts`): 12/12 passed.
- Real release chain (`node scripts/sbom.mjs && node scripts/checksums.mjs && node scripts/verify-release-integrity.mjs`): exit 0.
- Determinism: two generations from identical inputs byte-identical, SBOM SHA-256 `657ea86f8d7b824e8a361e0a8cc8aa121ae41a74a098b6cbb4e9ac3583ed37ce`.
- Typecheck (`bun run typecheck`): exit 0.
- Package-file verification (`node scripts/verify-package-files.mjs`): exit 0.
- Full suite (`bun run test`): 668 passed / 3 known baseline failures in `cmd/__tests__/cli.test.ts`.
- Change budget: 274/300 changed lines; single-PR/no-chain resolution (size-exception not needed).

Both Task 8 parent-owned checkboxes in `tasks.md` are marked complete; the change is ready to archive.
