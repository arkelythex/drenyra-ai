# Tasks — Program-Lock-Aware Install (SDD-020, slice C)

> Scope: release-derived bundled composition manifest (`dist/promoted-composition.json`), offline configurator reader, install/doctor surfacing, capability boundary update, and strict-TDD tests. Delivered as two chained PRs per design D14 and the design §7 file-by-file plan.
>
> Requirement key: **R1** bundled composition manifest, **R2** offline reader, **R3** install surfacing, **R4** doctor surfacing, **R5** boundary compliance, **R6** testability. Design decision key: **D1**–**D5** generator/resource contract, **D6** package-root relocation, **D7** separate `configurator/promoted-composition.ts`, **D8** strict discriminated union read, **D9** package-root override test seam, **D10** install report-only surfacing, **D11** `matches`/`differs` relationship, **D12** dedicated doctor diagnostic, **D13** capability claim update, **D14** two-chained-PR split.
>
> Spec has 6 requirements and **20 scenarios** (R1×3, R2×4, R3×3, R4×3, R5×3, R6×4); every scenario is covered by an explicit Phase 2 test task.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | **~800–1080 authored total** (PR 1 ≈ 360–480; PR 2 ≈ 440–600, of which ≈70 are moved relocation lines); generated `dist/promoted-composition.json` and lockfiles are 0 authored lines. This is the pre-split single-PR concern of ~600–900+ lines. |
| 400-line budget risk | **Medium** — each individual PR is ≈300–480 authored (with the moved-lines caveat: if the review tool counts moves as delete+add, keep the relocation + adapter re-export as the first commit in PR 2 so the semantic diff stays near budget). Neither PR should ship as one ~800-line review. |
| Chained PRs recommended | **Yes** — PR 1 (generator + resource pipeline) then PR 2 (reader + surfacing + tests), per design D14 and §7. PR 2 depends on PR 1's frozen resource contract and must not duplicate generator changes. |
| Suggested split | PR 1 = `scripts/promoted-composition.mjs` + subprocess tests + `package.json` release wiring + `verify-package-files.mjs` + `verify-packed-install.mjs` + release-integrity extension (resource pipeline, no runtime consumer). PR 2 = package-root relocation + `configurator/promoted-composition.ts` reader + `configurator/index.ts` export + install/doctor/capability surfacing + reader/install/doctor/boundary tests. |
| Delivery strategy | ask-on-risk (the 2-PR chain is pre-authorized by design D14; no risk-dependent change to the plan is expected, but chained delivery is confirmed before apply). |
| Chain strategy | stacked-to-main (PR 1 merges to `main` first and is verified against the real generated+packed bytes; PR 2 lands second against that frozen resource contract — design §9 rollout). |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

Split boundary (design §7, D14) is explicit:

- **PR 1** touches only `scripts/promoted-composition.mjs`, `scripts/__tests__/promoted-composition.test.ts`, `package.json` (release wiring), `scripts/verify-package-files.mjs`, `scripts/verify-packed-install.mjs`, `scripts/__tests__/release-integrity.test.ts`, and generates `dist/promoted-composition.json` (ignored by Git, never hand-maintained). It introduces no command behavior.
- **PR 2** touches only `configurator/package-metadata.ts`, `cmd/adapters/package-metadata.ts` (re-export), `configurator/promoted-composition.ts`, `configurator/index.ts`, `cmd/commands/{install,doctor,capabilities}.ts`, and `configurator/__tests__/promoted-composition.test.ts`, `cmd/__tests__/install-sync.test.ts`, `cmd/__tests__/capabilities-doctor.test.ts`.

Strict TDD is active (`openspec/config.yaml` `strict_tdd: true`, runner vitest, `bun run test`, typecheck `bun run typecheck`, build `bun run build`). Follow RED → GREEN → TRIANGULATE → REFACTOR per unit. No change may touch `contracts/**`, program-root documents, `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`, the program-lock file or schema, the promotion process, or the attestation format. No runtime/install-time network fetch, no Git/HEAD/cwd dependence in the generator or reader. `managed.json` and `installIntegrations()`/`InstallManifest` stay unchanged. Money is never involved; version/schema values are semantic-version strings or JSON integers, never floats.

The current program lock (`openspec/programs/drenyra-dominion/program-lock.json`) is `status: "promoted"` with `currentVerified.host.version: "0.4.0"`, `inspectedRevision d440203183e24b2a0ecf773915888bb6072fc015`, host artifact `drenyra-ai-0.4.0.tgz` `sha256 2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36`, `setSha256 62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea`, `attestation.tag drenyra-dominion-v0.4.0`, and both carrying fields null. The packaged version is `0.4.1` — the documented skew is evidence, not a blocker.

## Phase 0 — setup and evidence

- [x] Freeze the inspected revision: `git rev-parse HEAD` (record exact SHA and branch). Confirm working-tree state relative to baseline; no source file is mutated before baseline capture. Record that `cmd/adapters/package-metadata.ts` currently owns `getPackageRoot()`/`getPackageMetadata()` (with private `findPackageRoot()` and lazy success-only caching), that `package.json` `release:generate` is currently `node scripts/sbom.mjs && node scripts/checksums.mjs`, and that the promoted lock is the `0.4.0` checkpoint above — the exact extension points for this slice. <!-- sdd-owner: implementation -->
- [x] Capture the green baseline: `bun run test` → record actual file/test counts (orchestrator expectation **928 passed / 928 green**, exit 0). NOTE: any earlier count in `openspec/config.yaml` or prior change records may be stale — capture and record the actual current pass/fail counts; no failure is attributable to this change. Also run `bun run typecheck` and `bun run build` and record green. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `contracts/**`, program-root docs (including `openspec/programs/drenyra-dominion/program-lock.json` and its schema), `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, `flow/**`; confirm no task below lists any protected path as an edit target (Phases 1/2 touch only `scripts/`, `configurator/`, `cmd/adapters/package-metadata.ts`, `cmd/commands/{install,doctor,capabilities}.ts`, `cmd/__tests__/{install-sync,capabilities-doctor}.test.ts`, `configurator/__tests__/promoted-composition.test.ts`, `scripts/__tests__/{promoted-composition,release-integrity}.test.ts`, `package.json`, and `openspec/changes/sdd-020-slice-c/*`). <!-- sdd-owner: implementation -->
- [x] Confirm the boundary assertion location for this slice: `cmd/__tests__/capabilities-doctor.test.ts` line 91 names the test "…without claiming Pi host-serving or program-lock-aware install" and line 107 asserts `expect(hostIntegration).not.toMatch(/program-lock/i);`. This is the exact `/program-lock/i` negative boundary to be replaced with the new positive claim (R5; D13). The current integration string in `cmd/commands/capabilities.ts` line 30 is `"Codex/Claude Code/OpenCode/Drenyra Pi (managed marker/skills/pin configuration)"`. <!-- sdd-owner: implementation -->

## Phase 1 — implementation

### PR 1 — Generator and package resource pipeline

#### 1.1 Generator script (R1; D1, D2, D3, D4, D5)

- [x] Create `scripts/promoted-composition.mjs` as a new deterministic, fail-closed generator that mirrors `scripts/checksum-lock.mjs`: repository root resolved from `import.meta.url` (never `process.cwd()`), bounded CLI (`--lock`, `--output` with defaults to the promoted Drenyra Dominion lock and `dist/promoted-composition.json`; relative args resolved against the derived root; unknown/duplicate flags or missing values fail), diagnostics prefixed `promoted-composition:`, exit 1 without output on any failure. It must not invoke Git, GitHub, `HEAD`, environment variables, package metadata, or the network, and must not take timestamps or random values. <!-- sdd-owner: implementation -->
- [x] In `scripts/promoted-composition.mjs`, read and structurally validate the source lock and fail closed when it is missing, malformed JSON, not `status: "promoted"`, or lacks the expected object/array structure (`currentVerified.host`, `currentVerified.inspectedRevision`, `checksums`, `attestation`). Require `checksums.algorithm === "sha256"` and `checksums.canonicalization === "json-entries-v1"`. <!-- sdd-owner: implementation -->
- [x] In `scripts/promoted-composition.mjs`, reconcile the checksum set before emitting: recompute the canonical SHA-256 over compact UTF-8 `JSON.stringify(checksums.entries)` and require it equals `checksums.setSha256` and `attestation.checksumSetSha256`; require exactly one host checksum entry whose `repository` equals `currentVerified.host.repository` (missing/duplicate/wrong-repository/malformed host entries fail); require `currentVerified.inspectedRevision` equals `attestation.verifiedRevision` and the host entry's `revision`. <!-- sdd-owner: implementation -->
- [x] In `scripts/promoted-composition.mjs`, enforce the bootstrap rule: require `currentVerified.host.commitSha === null` and `attestation.carryingCommitSha === null`; a non-null or malformed carrying field fails. Never take values from historical `repositories`, `host.programBaseCommit`, branch state, `HEAD`, or environment. The source lock is read-only and never rewritten. <!-- sdd-owner: implementation -->
- [x] In `scripts/promoted-composition.mjs`, emit exactly the five non-carrying fields as `JSON.stringify(manifest, null, 2) + "\n"` with property order `version`, `verifiedRevision`, `hostArtifactSha256`, `setSha256`, `attestationTag`. Derive them strictly: `version` from `currentVerified.host.version` (strict semver, host repository non-empty), `verifiedRevision` from `currentVerified.inspectedRevision` (lowercase 40-hex), `hostArtifactSha256` from the sole host entry `sha256` (lowercase 64-hex; artifact is a stable non-empty basename), `setSha256` from the reconciled `checksums.setSha256` (lowercase 64-hex), `attestationTag` from `attestation.tag` (non-empty trimmed string). <!-- sdd-owner: implementation -->
- [x] In `scripts/promoted-composition.mjs`, write through a fixed staging path and rename into place so a failed generation leaves the selected output absent: before validation, remove only the exact output and fixed sibling staging path; validate in memory; write deterministic bytes to the staging file; rename to the output; clean both on every failure. No random or timestamp value enters the file or staging name. A stale manifest from a prior build must not survive a failed generation (D5). <!-- sdd-owner: implementation -->

#### 1.2 Release wiring (R1; D3)

- [x] In `package.json`, prepend the generator to `release:generate`: `"release:generate": "node scripts/promoted-composition.mjs && node scripts/sbom.mjs && node scripts/checksums.mjs"`, so generation runs first and the checksum manifest covers the new resource. Reorder `verify:package` so `bun run release:generate` runs before `node scripts/verify-package-files.mjs` (generation precedes package-file verification so the verifier can require the manifest). `prepack` and `prepublishOnly` retain their existing gates. `scripts/build.mjs` remains TypeScript compilation/shebang patching only. <!-- sdd-owner: implementation -->

#### 1.3 Package-file verification (R1)

- [x] In `scripts/verify-package-files.mjs`, require and minimally parse `dist/promoted-composition.json`; assert the exact five-key set (`version`, `verifiedRevision`, `hostArtifactSha256`, `setSha256`, `attestationTag`) and fail closed on absence, invalid JSON, or any extra/missing key. <!-- sdd-owner: implementation -->

#### 1.4 Packed-install verification (R1)

- [x] In `scripts/verify-packed-install.mjs`, assert the resource exists at `node_modules/drenyra-ai/dist/promoted-composition.json` in the installed tarball; add an optional Node probe that imports the configurator reader (post-PR-2) and classifies the installed manifest as `valid`. Until PR 2 lands the reader, keep the presence assertion only so PR 1 is independently verifiable. <!-- sdd-owner: implementation -->

### PR 2 — Library reader, package-root boundary, surfacing, and tests

#### 1.5 Package-root relocation to the library layer (R5; D6)

- [x] Create `configurator/package-metadata.ts` by relocating the existing `PackageMetadata` interface, `getPackageRoot()`, `getPackageMetadata()`, and the private `findPackageRoot()` from `cmd/adapters/package-metadata.ts` **without semantic change**: same upward walk from `dirname(fileURLToPath(import.meta.url))`, lazy success-only caching, never `process.cwd()`. No `configurator/` source imports `cmd/` or `agents/` (R5 no-reverse-import). <!-- sdd-owner: implementation -->
- [x] Replace `cmd/adapters/package-metadata.ts` with a compatibility re-export: `export * from "../../configurator/package-metadata.js"`, so existing imports in `doctor.ts`, `upgrade.ts`, `declared-surface.ts`, `schema-loader.ts`, and tests remain source-compatible. Land this relocation as the **first commit of PR 2** so the reader/surfacing diff stays reviewable if moves count as delete+add (design §7). <!-- sdd-owner: implementation -->

#### 1.6 Offline reader and diagnostic builder (R2, R4; D1, D2, D7, D8, D9, D11, D12)

- [x] Create `configurator/promoted-composition.ts` with the exact TypeScript contracts from design §5.1: `PromotedComposition` (five fields), `PromotedCompositionRead` (strict discriminated union `valid`/`absent`/`invalid` with `invalidReason`), `PromotedCompositionReaderDeps { packageRoot?: string }` (test seam only), `readPromotedComposition(deps?)`, `VersionRelationship = "matches" | "differs"`, and `ProgramLockAwarenessDiagnostic` with `name: "program-lock-awareness"`, `ok`, `detail`, `applicability` (`applicable`/`not-applicable`/`unverifiable`), `manifestState`, `packageVersion`, optional `versionRelationship`, optional `promotedComposition`. Do not place this logic in `managed-config.ts` (D7). <!-- sdd-owner: implementation -->
- [x] In `configurator/promoted-composition.ts`, implement `readPromotedComposition()` per design §5.2: resolve package root from `deps.packageRoot ?? getPackageRoot()` (imported from `./package-metadata.js`); a resolution exception is `invalid`. Join only `<packageRoot>/dist/promoted-composition.json`; if absent return `absent`. Reject a symlink or non-regular file and treat read errors as `invalid`. Parse UTF-8 JSON, require a non-array object with exactly the five allowed keys. Validate strict semver, lowercase 40-hex revision, two lowercase 64-hex digests, and a non-empty trimmed attestation tag. Reject any carrying-commit field through the exact-key check and return no partial facts on any error. Return a fresh `composition` object only after all checks pass. No HTTP, child-process, Git, environment, cwd, or program-lock dependency. <!-- sdd-owner: implementation -->
- [x] In `configurator/promoted-composition.ts`, implement `programLockAwarenessDiagnostic(read, packageVersion)` to build the doctor check per design §6.2: valid+equal → `ok: true`, `applicability: "applicable"`, `versionRelationship: "matches"`, all five facts present; valid+`0.4.0`/`0.4.1` skew → `ok: true`, `applicability: "applicable"`, `versionRelationship: "differs"`, detail names both versions, all five facts present; absent → `ok: true`, `applicability: "not-applicable"`, `manifestState: "absent"`, no promoted facts; invalid → `ok: false`, `applicability: "unverifiable"`, `manifestState: "invalid"`, no promoted facts; unknown package metadata → `packageVersion: "unknown"`, omit `versionRelationship`. Never fabricate promoted facts in any state. The relationship is `matches`/`differs`, never an ordering gate (D11). <!-- sdd-owner: implementation -->
- [x] In `configurator/index.ts`, export the promoted-composition types/reader/diagnostic builder. Do not export the lower-level package-metadata module as new public API; command compatibility remains through `cmd/adapters/package-metadata.ts` (design §4). <!-- sdd-owner: implementation -->

#### 1.7 Install surfacing (R3; D10, D11)

- [x] In `cmd/commands/install.ts`, add an optional `readPromotedComposition` function to `InstallCommandDeps` (test seam; production uses the real reader). Keep `installIntegrations()` and the persisted `InstallManifest`/`managed.json` unchanged. In `installCommand()`, read the promoted evidence after installation and add a `promotedComposition` report object: valid → `{ state: "valid", availability: "available", versionRelationship: "matches"|"differs", composition: {version, verifiedRevision, hostArtifactSha256, setSha256, attestationTag} }`; absent → `{ state: "absent", availability: "unavailable" }`; invalid → `{ state: "invalid", availability: "unavailable", reason: "<bounded non-sensitive diagnostic>" }`. Keep the existing `version`, `detectedHosts`, `configured`, and `note` fields. Install must not hard-gate on version equality, must not claim the packaged version is promoted, must not claim promotion when evidence is absent/invalid, and must still return 0 in all states. <!-- sdd-owner: implementation -->

#### 1.8 Doctor surfacing (R4; D12)

- [x] In `cmd/commands/doctor.ts`, obtain package metadata once, read the promoted evidence once via `readPromotedComposition()`, convert it with `programLockAwarenessDiagnostic()`, and append the dedicated `program-lock-awareness` check to the existing `checks` array without mutating disk. Preserve the top-level `{ status, checks, readonly: true }` contract; an invalid manifest flips `status` to `degraded` and exits 1 (matching the existing doctor convention), an absent manifest stays healthy/not-applicable, and a valid skew stays healthy with the skew recorded as information. <!-- sdd-owner: implementation -->

#### 1.9 Capability claim update (R5; D13)

- [x] In `cmd/commands/capabilities.ts`, update the host integration string (line 30) to state program-lock awareness accurately, e.g. ending with `…managed marker/skills/pin configuration with program-lock-aware install/doctor reporting`. Keep the change a wording-only claim on the CLI-owned `integrations` array; do not touch the MCP common-field schema and do not claim host-serving or MCP completion. <!-- sdd-owner: implementation -->

## Phase 2 — tests (strict TDD: RED → GREEN per unit)

### 2.1 `scripts/__tests__/promoted-composition.test.ts` — generator (R1, R6; D1–D5) — R1 scenarios ×3

Subprocess fixtures with a temporary mini-repo, run from a non-repository cwd (mirror `scripts/__tests__/checksum-lock.test.ts`). RED first, then GREEN each behavior.

- [x] RED — write failing tests: run the generator twice from different cwd values with the same valid promoted lock fixture; assert byte-identical output equal to the exact five-field fixture (deterministic, cwd-independent, no timestamp/random) (scenario R1·1). GREEN via 1.1. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: non-`promoted` status, missing/malformed lock, inconsistent checksum set (host entry not referencing the promoted host, unreconciled `setSha256`, wrong algorithm/canonicalization), and carrying-commit-bearing sources each fail with `promoted-composition:` and write no manifest (scenario R1·2). GREEN via 1.1. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: successful JSON contains neither `commitSha`, `carryingCommitSha`, branch, `HEAD`, historical repository facts, nor extra keys; a pre-created output is cleaned up (both output and staging absent) after an invalid run (scenario R1·2, D5 stale cleanup). GREEN via 1.1. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: release checksums name `promoted-composition.json`; package-file verifier requires it; packed install contains it (scenario R1·3). GREEN via 1.2/1.3/1.4/2.6. <!-- sdd-owner: implementation -->

### 2.2 `configurator/__tests__/promoted-composition.test.ts` — reader and diagnostic matrix (R2, R4, R6; D7, D8, D9, D11, D12) — R2 scenarios ×4

Use `mkdtempSync` isolated package-root fixtures and the `deps.packageRoot` test seam; never cwd, network, or the real `dist`. RED first, then GREEN.

- [x] RED — write failing tests: valid manifest at the package root → `{ state: "valid" }` with the exact five facts (scenario R2·1). GREEN via 1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: no file → `{ state: "absent" }` with no facts; a valid-looking file under `process.cwd()` while the injected package root is absent still yields `absent` (no cwd fallback) (scenarios R2·2, R2·4). GREEN via 1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: malformed JSON, directory, symlink, unreadable file, missing/extra keys (including any carrying-like field), malformed semver, uppercase/wrong-length hashes, empty/whitespace tag → `{ state: "invalid", invalidReason }` with no composition (scenario R2·3). GREEN via 1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: production package-root resolution from a non-root cwd resolves relative to module/package location, not cwd; static source/import assertion proves no child-process/http/git/env/cwd imports exist and no network fixture is touched (scenario R2·4, R6·4). GREEN via 1.6. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for `programLockAwarenessDiagnostic` across the full matrix (valid equal → applicable/matches; valid `0.4.0`/`0.4.1` skew → applicable/differs naming both versions; absent → not-applicable/absent/no facts; invalid → unverifiable/not-ok/no facts; unknown package version → `"unknown"` and no relationship) (design §6.2 table). GREEN via 1.6. <!-- sdd-owner: implementation -->

### 2.3 `cmd/__tests__/install-sync.test.ts` — install surfacing (R3, R6; D10, D11) — R3 scenarios ×3

Use `mkdtempSync` isolated homes and injected `readPromotedComposition`; no network, no real host binaries. RED first, then GREEN.

- [x] RED — write failing tests: package `0.4.1`, valid manifest promoted `0.4.0` → report includes installed package identity and the promoted composition (all five facts), states the packaged version differs from the promoted version, returns 0 (skew recorded, not gated) (scenario R3·1). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: both versions equal → report says `matches` without claiming more than the manifest; absent and invalid evidence each complete normally with `promotedComposition.availability: "unavailable"` and no promoted facts (scenario R3·2). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: packaged `0.4.1` with promoted `0.4.0` never labels `0.4.1` as promoted (no false promotion) (scenario R3·3). GREEN via 1.7. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: `managed.json` shape before/after install is unchanged (no promoted-composition field persisted; transition behavior unchanged) and install exit is 0 in every evidence state (R3 persistence invariant). GREEN via 1.7. <!-- sdd-owner: implementation -->

### 2.4 `cmd/__tests__/capabilities-doctor.test.ts` — doctor surfacing + capability boundary (R4, R5, R6; D12, D13) — R4 scenarios ×3, R5 scenarios ×2

RED first, then GREEN.

- [x] RED — write failing tests: valid manifest with `0.4.0`/`0.4.1` skew → dedicated `program-lock-awareness` check is applicable/ok, surfaces the promoted version and packaged-versus-promoted relationship, and the outer `{status, checks, readonly}` report stays healthy/readonly with exit 0 (scenario R4·1). GREEN via 1.8. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: malformed/non-conforming manifest → check fails closed as unverifiable with no promoted facts, report degraded, exit 1 (scenario R4·2). GREEN via 1.8. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: absent manifest on an otherwise healthy package → check reports absent/not-applicable without promoted facts and the report stays healthy, exit 0 (clean-checkout invariant) (scenario R4·3). GREEN via 1.8. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: a healthy program-lock check does not mask managed-state/package-pin failures, and an invalid program-lock check does not suppress the rest of the report (other failures compose). GREEN via 1.8. <!-- sdd-owner: implementation -->
- [x] RED — rename the line-91 test and replace line 107 `expect(hostIntegration).not.toMatch(/program-lock/i);` with `expect(hostIntegration).toMatch(/program-lock-aware install\/doctor reporting/i);`; keep the negative `host-serving` assertion and the MCP-planned assertion unchanged (scenario R5·2, D13). GREEN via 1.9. <!-- sdd-owner: implementation -->

### 2.5 Boundary / import test — no reverse import (R5, R6; D6) — R5 scenario ×1

Prefer an existing configurator boundary test; otherwise add to `configurator/__tests__/promoted-composition.test.ts`.

- [x] RED — write failing tests: no module under `configurator/` imports from `cmd/` or `agents/`; existing adapter imports of `getPackageMetadata()`/`getPackageRoot()` continue to resolve through the `cmd/adapters/package-metadata.ts` re-export (scenario R5·1). GREEN via 1.5/1.6. <!-- sdd-owner: implementation -->

### 2.6 `scripts/__tests__/release-integrity.test.ts` — package coverage (R1, R6) — R1 scenario ×3, R6

- [x] RED — extend the release fixture/script list and add an assertion proving `dist/checksums.txt` names `promoted-composition.json` and that `verify-package-files.mjs` requires it (package inclusion + checksums coverage). GREEN via 1.2/1.3. <!-- sdd-owner: implementation -->

## Phase 3 — verification

- [x] PR 1: run the focused generator files first (`bun run test -- scripts/__tests__/promoted-composition.test.ts scripts/__tests__/release-integrity.test.ts`), then `bun run test`, `bun run typecheck`, `bun run build`, then `bun run release:generate`, `bun run verify:release-integrity`, package-file verification, and packed-install verification; all green. <!-- sdd-owner: implementation -->
- [x] PR 2: run the focused files first (`bun run test -- configurator/__tests__/promoted-composition.test.ts cmd/__tests__/install-sync.test.ts cmd/__tests__/capabilities-doctor.test.ts`), then the full suite `bun run test`, `bun run typecheck`, and `bun run build`; all green with only the recorded pre-existing baseline failures (if any) remaining. Command output assertions run from a non-root cwd. <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched `contracts/**`, program-root docs (including `openspec/programs/drenyra-dominion/program-lock.json` and its schema), `agents/**`, `ledger/**`, `receipts/**`, `missions/**`, `evidence/**`, `journal/**`, or `flow/**` (git status/diff against baseline); confirm the program lock, its schema, the promotion process, and the attestation format are byte-identical. <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement R1–R6 and each of the 20 scenarios as pass/fail against the implementation and tests; confirm no-hard-gate on version equality, no promotion claim without a valid manifest, no cwd/network fallback, and no reverse import all hold. <!-- sdd-owner: implementation -->
- [ ] Changed-line budget check: confirm PR 1 authored additions+deletions ≈360–480 and PR 2 ≈440–600 (of which ≈70 moved) stay within per-PR budget; if either PR exceeds its bound, stop and re-split (e.g. keep the PR 2 relocation as a separate leading commit) rather than merging an oversized review. Total across both PRs is the ~800–1080 authored range stated in the Forecast. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the PR 1 candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-020 configurator/archive slices: delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for the PR 2 candidate after verification is frozen (it depends on PR 1's frozen resource contract and must not duplicate generator changes); apply findings within the single correction budget, then validate the terminal receipt. <!-- sdd-owner: parent -->
- [ ] Deliver PR 1 to `main` first, verify the generated + packed bytes against the real lock, then deliver PR 2 to `main` (stacked-to-main chain PR 1 → PR 2); update the SDD-020 record (`proposal.md` lifecycle toward apply evidence; record tasks/verify/archive state; confirm the deferred-slice list) so the change record reflects the closed slice-C boundary. <!-- sdd-owner: parent -->
