# Apply Progress — SDD-020 Slice C (Program-Lock-Aware Install)

> Store: OpenSpec · Phase: apply · Sliced: two chained PRs per D14 (stacked-to-main).
> This is the **initial PR 1 record**; the PR 2 apply run MUST read this file and MERGE
> its record below rather than overwriting (the PR 2 section will be appended).

## Structured status consumed

- Artifact store: `openspec` (native OpenSpec change dir `openspec/changes/sdd-020-slice-c/`).
- Execution mode: automatic; delivery strategy: ask-on-risk pre-authorized by design D14 as a
  stacked-to-main 2-PR chain; chain strategy: `stacked-to-main`.
- Review Workload Forecast (tasks.md): `Decision needed before apply: No`; `Chained PRs
  recommended: Yes`; `Chain strategy: stacked-to-main`; `400-line budget risk: Medium`.
- Strict TDD active (`openspec/config.yaml` `strict_tdd: true`; runner vitest; `bun run test`;
  typecheck `bun run typecheck`; build `bun run build`).
- Runtime attempt token (PR 1 generator, orchestrator-supplied):
  `sha256:89cba9e28c195a536aba99515089912f7510eff623b1e8a6a82f54395950c31b`
- **Baseline note:** orchestrator prompt said branch `main` at `3a1542d`; the actual working
  HEAD at apply time is `0c6303975c22e09c102924d007eb3144e8a69756` (the SDD-080
  `docs(program)` sibling-evidence commit landed after the SDD-010 close; `3a1542d` is its
  parent). Working tree was clean except the change dir. No source file was mutated before
  baseline capture.

## Phase 0 — baseline evidence (tasks 0.1–0.4, all `[x]`)

- Inspected revision frozen: `git rev-parse HEAD` → `0c6303975c22e09c102924d007eb3144e8a69756`
  on branch `main`; working tree clean except `openspec/changes/sdd-020-slice-c/` (untracked).
- Baseline captured: `bun run test` → **66 test files, 928 passed / 928 green, exit 0**
  (orchestrator expectation 928 confirmed; the `647/52` count in `openspec/config.yaml` is
  stale). `bun run typecheck` clean; `bun run build` done.
- Extension points recorded: `cmd/adapters/package-metadata.ts` owns `getPackageRoot()`/
  `getPackageMetadata()` (private `findPackageRoot()`, lazy success-only caching);
  `package.json` `release:generate` was `node scripts/sbom.mjs && node scripts/checksums.mjs`;
  promoted lock is the `0.4.0` checkpoint (`verifiedRevision d440203183e24b2a0ecf773915888bb6072fc015`,
  host artifact `drenyra-ai-0.4.0.tgz` `sha256 2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36`,
  `setSha256 62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea`,
  `attestation.tag drenyra-dominion-v0.4.0`, both carrying fields null).
- Boundary assertion location confirmed: `cmd/__tests__/capabilities-doctor.test.ts` line 91
  (test name) / line 107 (`expect(hostIntegration).not.toMatch(/program-lock/i)`);
  `cmd/commands/capabilities.ts` line 30 integration string
  `"Codex/Claude Code/OpenCode/Drenyra Pi (managed marker/skills/pin configuration)"`.
  These are the PR 2 (D13) edit points; untouched in PR 1.

## PR 1 — implemented (tasks 1.1–1.4, 2.1, 2.6, PR-1 Phase 3, protected-path check: `[x]`)

### Files changed (PR 1)

| File | Change | Lines |
|---|---|---|
| `scripts/promoted-composition.mjs` | NEW deterministic fail-closed generator (D1–D5): root from `import.meta.url`; bounded `--lock`/`--output`; `promoted-composition:` diagnostics; strict lock structure/checksum-set/host-entry/revision reconciliation; bootstrap rule (both carrying fields must be null); strict semver/hex/tag derivation; staging-write + rename with pre-clean and failure cleanup; `node:crypto` only, no Git/HEAD/env/network/timestamps. | 234 |
| `scripts/__tests__/promoted-composition.test.ts` | NEW subprocess fixture tests (18): determinism × cwd, exact five-field shape/order, relative-arg resolution, flag rejection, 11 fail-closed source classes, output hygiene, D5 stale cleanup, read-only lock, checksums coverage + verifier wiring. | 361 |
| `package.json` | `release:generate` now `node scripts/promoted-composition.mjs && node scripts/sbom.mjs && node scripts/checksums.mjs`; `verify:package` reordered so `bun run release:generate` precedes `node scripts/verify-package-files.mjs`. | +2/−2 |
| `scripts/verify-package-files.mjs` | Requires + minimally parses `dist/promoted-composition.json`; asserts the exact five-key set, fails closed on absence/invalid/extra/missing keys. | +31/−4 |
| `scripts/verify-packed-install.mjs` | Asserts `node_modules/drenyra-ai/dist/promoted-composition.json` exists and is five-key in the installed tarball (presence assertion only — the PR 2 reader probe stays optional); also hardened the pre-existing unguarded `package.json` parse (fail-fast with diagnostic, flagged by the edit gate). | +31/−11 |
| `scripts/__tests__/release-integrity.test.ts` | Extends fixture/script list with the generator + package-file verifier; new test proves `dist/checksums.txt` names `promoted-composition.json` and `verify-package-files.mjs` requires it (behavioral: full packaged file set, then delete → non-zero naming the manifest). | +110/−2 |

Generated `dist/promoted-composition.json` is release output only: git-ignored (`dist/`),
never hand-maintained. Canonical content (matches design §3.1 byte-for-byte):

```json
{
  "version": "0.4.0",
  "verifiedRevision": "d440203183e24b2a0ecf773915888bb6072fc015",
  "hostArtifactSha256": "2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36",
  "setSha256": "62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea",
  "attestationTag": "drenyra-dominion-v0.4.0"
}
```

### Commands run (PR 1 verification — all green)

- `bun run test -- scripts/__tests__/promoted-composition.test.ts scripts/__tests__/release-integrity.test.ts` → 2 files, **31 passed** (RED → GREEN cycle; initial RED 18 failed with the generator missing, then 1 pipeline test RED until 1.2–1.4 landed).
- `bun run test` → **67 files, 947 passed / 947 green** (baseline 928 + 19 new: 18 generator + 1 release-integrity).
- `bun run typecheck` → clean. `bun run build` → done.
- `bun run release:generate` → generator ran first, then sbom, then checksums; manifest byte-identical across two consecutive runs (`sha256sum 495f01b3…` both times, determinism re-proven).
- `bun run verify:release-integrity` → `checksums and SBOM verified`; `dist/checksums.txt` names `promoted-composition.json`.
- `node scripts/verify-package-files.mjs` → `OK`.
- `node scripts/verify-packed-install.mjs` → `npm pack` + clean install; bin runs, library resolves, **installed `dist/promoted-composition.json` present and five-key — OK**.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 (generator) | `scripts/__tests__/promoted-composition.test.ts` | Unit (subprocess) | N/A (new) | ✅ Written (18 failed: script absent) | ✅ Passed (17/18) | ✅ 10 design scenarios + 18 tests | ✅ Clean (doc/validation split) |
| 1.2/1.3/1.4 (wiring) | `scripts/__tests__/promoted-composition.test.ts` (pipeline) + `scripts/__tests__/release-integrity.test.ts` (2.6) | Unit (subprocess) | ✅ 928/928 baseline | ✅ Written (pipeline test + 2.6 test RED) | ✅ Passed (31/31 focused) | ✅ checksums coverage + behavioral verifier-requires-it + packed-install live gate | ➖ None needed |
| 2.6 (release coverage) | `scripts/__tests__/release-integrity.test.ts` | Unit (subprocess) | ✅ 12/12 pre-existing in file | ✅ Written (new test failed) | ✅ Passed (13/13) | ✅ delete-manifest negative case | ✅ Helper extraction (`addPackageFiles`) |

### Test Summary (PR 1)

- **Total tests written**: 19 (18 generator + 1 release-integrity)
- **Total tests passing**: 19
- **Layers used**: Unit/subprocess (19)
- **Approval tests**: none needed (no refactoring of live behavior; the packed-install parse hardening was covered by the existing gate)
- **Pure functions created**: generator derives facts as a pure validation pipeline (`deriveFacts`)

### Deviations from design

1. **PR 1 authored-line budget exceeded** (see "Remaining tasks" — the changed-line budget check
   task is deliberately left unchecked). Actual PR 1 authored additions: **788 lines**
   (new files 234 + 361 = 595; tracked modified 193). Design forecast was ≈360–480; the
   overage is concentrated in the mandated fail-closed test matrix (task 2.1 requires every
   rejection class; 361 vs 150–190 estimated) and the behavioral `verify-package-files`
   requirement proof (2.6, 110 vs 20–35 estimated, because it builds the full packaged file
   set the verifier needs). No silent re-split was performed — PR boundary decisions belong
   to the parent. Suggested options: (a) accept 788 and run the large-PR review workload,
   (b) move the 2.6 release-integrity extension (~110 lines) as a separate early commit
   within PR 1, or (c) accept the generator tests as-is and let the reviewer see the
   fail-closed matrix maps 1:1 to design §8.1.
2. `verify-packed-install.mjs` additionally hardened the pre-existing unguarded
   `package.json` parse (edit gate flagged it once the file was modified). No behavior change.
3. Orchestrator's stated baseline SHA (`3a1542d`) differs from actual HEAD (`0c63039`);
   recorded the actual value (0.1).

### Protected-path check (PR 1)

`git status --porcelain` shows only `package.json`, `scripts/verify-package-files.mjs`,
`scripts/verify-packed-install.mjs`, `scripts/__tests__/release-integrity.test.ts` (modified)
and `scripts/promoted-composition.mjs`, `scripts/__tests__/promoted-composition.test.ts`,
`openspec/changes/sdd-020-slice-c/` (untracked). No edit touched `contracts/**`, program-root
docs, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`,
`flow/**`; `openspec/programs/drenyra-dominion/program-lock.json` is byte-identical (schema,
promotion process, attestation format untouched). `dist/` output is git-ignored.

## Remaining tasks (PR 2 + spanning checks, unchanged from tasks.md)

PR 2 (reader + surfacing) tasks 1.5–1.9 and test tasks 2.2–2.5, Phase 3 PR 2 verification,
and the two spanning Phase 3 checks stay unchecked exactly as persisted. The two spanning
checks are noted here for the PR 2 run:

- Spec pass/fail check (line 149): R1 (3/3 scenarios) and the generation/no-network side of R6
  are implemented and tested; R2–R5 and reader/surfacing/boundary tests remain PR 2.
- Changed-line budget check (line 150): **PR 1 measured at 788 authored lines vs ≈360–480
  forecast — breached; no re-split performed; parent must decide before review** (see
  deviations). PR 2 will add its own count when implemented.

## Workload / PR boundary

- PR 1 (this slice): generator + resource pipeline + release coverage — frozen resource
  contract is the exact filename `dist/promoted-composition.json` and the five-field JSON
  shape above; introduces no command behavior.
- PR 2 (next slice): package-root relocation to `configurator/package-metadata.ts` + adapter
  re-export (first commit), `configurator/promoted-composition.ts` reader/diagnostic,
  install/doctor/capabilities surfacing, and reader/install/doctor/boundary tests. Must not
  duplicate generator changes.
- Chained PRs: stacked-to-main (PR 1 → main first, verify generated+packed bytes, then PR 2).
