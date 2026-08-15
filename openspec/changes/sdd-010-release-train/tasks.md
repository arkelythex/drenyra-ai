# Tasks — Program-Lock Promotion (SDD-010, release-train)

> Change: `sdd-010-release-train` · Program: Drenyra Dominion. Proposal, spec (7 requirements **R1–R7**, each with `#### Scenario` headings; every scenario is covered by an explicit Phase 2 test/readback task below), and design (decisions **D1–D13**, file-by-file plan, `scripts/checksum-lock.mjs` design, promoted lock structure) complete.
>
> Requirement key: **R1** revision-bound freshness, **R2** honest sibling facts, **R3** promotion status / fail-closed gates, **R4** deterministic lock checksums, **R5** release attestation, **R6** no runtime consumption, **R7** testable promotion gates.
> Design decision key: **D1** structured `checksums` object stored in `program-lock.json` (no sidecar); **D2** checksum inputs = published host `.tgz` + locally available evidenced immutable sibling artifacts, none fabricated; **D3** `scripts/checksum-lock.mjs` reads lock + explicit `repository=path` bindings, emits canonical JSON, `--verify` check mode, working-directory independent; **D4** canonical order (Unicode code-point by `repository` then `artifact`, fixed property order, LF); **D5** self-inclusion + bootstrap rule enforced in tooling (reject lock path/aliases, never read HEAD/tag/carrying SHA); **D6** resolve host revision R at apply (version `0.4.0`, `915/915`, typecheck clean, conformance passing, `PUBLIC`, `host.commitSha: null`); **D7** fetch `drenyra-engram`/`drenyra-pi` default-branch SHAs + visibility via `gh api`, private trio stays `unknown`/`awaiting-evidence`; **D8** preserve `repositories[]` as historical snapshot; current sibling facts only under `currentVerified.siblingRepositories`; **D9** two-step publication — commit B with `status: promoted` only after local gates, external B5 attestation before claiming published; **D10** attestation = signed tag + GitHub Release asset (immutable), carrying commit only external; **D11** amend draft-07 schema with bounded definitions + `if`/`then` `status: promoted` conditional; **D12** fresh revision-bound verification at apply; **D13** readback gates (schema valid as draft-07, lock validates, evidence IDs resolve, capability matrix parses, checksum determinism, private trio unknown).
>
> Context note: `openspec/config.yaml` review budget is **300 changed lines**; design forecast is **~170–220 authored lines**. This is documentation + tooling only. Strict TDD is active (`strict_tdd: true`, runner vitest, `bun run test`). No runtime/install-time path may consume `program-lock.json` (R6).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~170–220 authored lines (design forecast: checksum-lock.mjs 60–70, focused test 50–60, program-lock.json 20–30, schema 25–35, docs 10–15, evidence/capability 5–10). Expected to stay under the 300-line repo review budget and the 400-line hard cap. |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (no chaining). If apply-time evidence changes exceed the forecast and push the diff past the review budget, promote `scripts/checksum-lock.mjs` + focused test as PR 1 and the lock/schema/docs/evidence refresh as PR 2 — do not weaken tests or schema to fit the budget. |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (~170–220 vs 300-line repo review budget; no 400-line exception required) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

This slice ships as ONE apply unit on one branch. Follow strict TDD RED → GREEN → TRIANGULATE → REFACTOR per checksum test unit; finish with `bun run typecheck` and `bun run build`. No edit may touch a runtime or install-time consumer path of `program-lock.json` and no frozen contract may change (R6).

## Phase 0 — setup and evidence

- [x] Freeze the inspected revision `R` = `git rev-parse HEAD` (record exact SHA and branch). Confirm no source file is mutated before the baseline capture, and that `scripts/checksum-lock.mjs` does not yet exist (verified at planning time). <!-- sdd-owner: implementation -->
- [x] Capture the green revision-bound baseline against the exact frozen revision: `bun run test` → expect **915 passed / 915 total**, exit 0. Record actual counts and command + revision + timestamp. Record `bun run typecheck` clean. This baseline is fresh (2026-slice) and replaces the stale W2-era `0.2.1`/`774`/`549ed640…` claim (R1, D12). <!-- sdd-owner: implementation -->
- [x] Verify the two public sibling facts at apply time via `gh api` (no fabrication, R2/D7): fetch default-branch SHA and visibility for `drenyra-engram` and `drenyra-pi` (e.g. `gh api repos/<owner>/drenyra-engram` and `/drenyra-pi` — record SHA, visibility=PUBLIC, fetch time, endpoint). Also fetch current host repo visibility. Record evidence IDs to attach to each fact. Confirm the private trio (`drenyra-command-center`, `drenyra-skills`, `drenyra-guardian-angel`) has NO credentialed evidence → must stay `unknown`/`awaiting-evidence` with `commitSha: null`. <!-- sdd-owner: implementation -->
- [x] Identify protected paths for the final protected-path check: `contracts/**`, archived change records, `missions/**`, `candidates/**`, `agents/**`, `ledger/**`, `receipts/**`, `journal/**`, `evidence/**`, `flow/**`, and all runtime library modules. Confirm no task below lists any protected path as an edit target (Phase 1/2 touch only `scripts/checksum-lock.mjs`, its focused test under `scripts/__tests__/`, `openspec/programs/drenyra-dominion/{program-lock.json, program-lock.schema.json, release-train.md, delivery-sequence.md}`, the evidence/capability records, and `openspec/changes/sdd-010-release-train/*`). <!-- sdd-owner: implementation -->

## Phase 1 — implementation

### 1.1 `scripts/checksum-lock.mjs` — deterministic checksum producer (R4; D2, D3, D4, D5)

- [x] Create `scripts/checksum-lock.mjs` resolving the repository root from `import.meta.url` (never `process.cwd()`), reading the lock and explicit `--artifact repository=path` bindings, and exposing generation mode (emit canonical checksum JSON to stdout or `--output <staging-file>`) and `--verify` mode (exit non-zero on any difference, emit no replacement data). <!-- sdd-owner: implementation -->
- [x] Resolve each supplied file with `realpath`; require a regular, readable, non-symlink file. Require exactly one host artifact binding (the published `dist/drenyra-ai-0.4.0.tgz`) and reject duplicate repository/artifact identities. Require every artifact binding to name a repository with an admissible current claim in the lock. <!-- sdd-owner: implementation -->
- [x] Enforce self-inclusion + bootstrap rules in tooling (D5): reject any artifact input that resolves to `program-lock.json` (including aliases), reject any artifact for an `unknown` repository, require stable basenames free of separators/`.`/`..`/control chars/backslashes, and never inspect or emit HEAD/tag-target/carrying-commit SHAs. Fail if a lock-declared artifact entry has no supplied readable input or if a supplied input is not admitted by the lock. Never call Git or GitHub and never read commit/tag metadata. <!-- sdd-owner: implementation -->
- [x] Hash raw bytes with `node:crypto` SHA-256 (lowercase hex). Build entries with fixed key order `repository, revision, artifact, sha256`; sort by `repository` then `artifact` via direct Unicode code-point comparison (no locale collation); serialize `entries` as compact UTF-8 JSON; compute `setSha256` over those canonical bytes; emit the full `checksums` object as two-space JSON with one trailing LF (D4). Exclude timestamps from checksum output so identical inputs give byte-identical output in any working directory. <!-- sdd-owner: implementation -->

### 1.2 Focused checksum test — strict TDD coverage (R4, R7; D4, D5)

- [x] RED — write failing tests under `scripts/__tests__/` (follow the existing `release-integrity.test.ts`/`ecosystem-script-resilience.test.ts` spawn-based convention): identical lock + artifact bytes from two different working directories produce byte-identical JSON; reversed CLI artifact order yields the same sorted entries and `setSha256`; every digest is lowercase 64-char SHA-256 and changes when artifact bytes change (R4 determinism). GREEN via 1.1. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: direct, relative, normalized, or symlinked references to `program-lock.json` are rejected (self-inclusion); missing, unreadable, non-regular, symlinked, duplicate, unknown-repository, and undeclared inputs fail closed (D5). GREEN via 1.1. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: unknown private siblings produce no entries and a supplied artifact for one is rejected; `--verify` passes for the exact lock block and fails for changed artifact, missing entry, extra entry, wrong revision, or changed ordering/canonicalization. GREEN via 1.1. <!-- sdd-owner: implementation -->

### 1.3 Schema amendment — `program-lock.schema.json` (R3, R7; D11)

- [x] Amend `openspec/programs/drenyra-dominion/program-lock.schema.json` (draft-07) with bounded definitions for `currentVerified.siblingRepositories` (per-sibling current-claim: `temporalClass`, `commitSha` 40-hex or `null`, `githubVisibility` enum, `source`, `fetchedAt`, `evidence`), the structured `checksums` object (`algorithm`, `canonicalization`, `entries[]` with `repository`/`revision`/`artifact`/`sha256`, `setSha256` lowercase 64-hex), and the `attestation` declaration (`scheme`, `tag`, `asset`, `verifiedRevision`, `checksumSetSha256`, `carryingCommitSha: null`, `note`). Add non-negative integer `testPassed`/`testTotal` constraints and lowercase 40-hex/lowercase 64-hex patterns. <!-- sdd-owner: implementation -->
- [x] Add the `if`/`then` conditional: when `status` is `promoted`, require the populated `currentVerified`, `checksums`, and `attestation` structures per D11. Keep the schema itself a valid draft-07 document (validate it with the existing `ajv` dependency after the edit). Cross-field equality and attestation bindings that draft-07 cannot express are NOT claimed as schema validation — they are enforced by the readback gate/tests. <!-- sdd-owner: implementation -->

### 1.4 Promote the lock — `program-lock.json` (R1, R2, R3; D6, D7, D8, D9)

- [x] In `openspec/programs/drenyra-dominion/program-lock.json`: set `status` from `candidate` to `promoted` ONLY after every local gate passes (fresh verification, resolved sibling facts, populated checksums, resolved evidence IDs, schema validity) — do not promote on stale W2-era evidence. Keep `snapshot` and `repositories[]` as historical snapshots (D8); do not relabel them as current facts. <!-- sdd-owner: implementation -->
- [x] Replace the stale `currentVerified.host` facts with revision-bound `0.4.0`, `testTotal: 915`, `testPassed: 915`, clean typecheck, passing conformance, `PUBLIC` visibility, the exact inspected revision `R`, the inspection time, and resolvable evidence IDs for every current claim (R1, D6). Keep `host.commitSha: null` (bootstrap rule). Remove the stale `0.2.1`/`774`/`549ed640…` current claim. <!-- sdd-owner: implementation -->
- [x] Populate `currentVerified.siblingRepositories`: `drenyra-engram` and `drenyra-pi` as verified `PUBLIC` current-claims with freshly fetched immutable SHAs, source `gh-api`, fetch time, and evidence IDs (R2, D7). Keep the private trio `temporalClass: "unknown"`, `commitSha: null`, `status: "awaiting-evidence"`. No fabricated SHA/version/test total/conformance/visibility. <!-- sdd-owner: implementation -->
- [x] Insert the exact `checksums` object produced by `scripts/checksum-lock.mjs` (R4) and the `attestation` declaration (scheme `signed-git-tag+github-release-asset-v1`, tag `drenyra-dominion-v0.4.0`, asset `drenyra-dominion-v0.4.0.attestation.json`, `verifiedRevision` = R, `checksumSetSha256`, `carryingCommitSha: null`) per the design's promoted-lock structure (D9, D10). Never record the carrying commit inside the lock. <!-- sdd-owner: implementation -->

### 1.5 Release attestation workflow + docs — §7 item 4 / Phase B5 (R5; D10)

- [x] Update `openspec/programs/drenyra-dominion/release-train.md` to document checksum generation/readback, the signed-tag + GitHub Release asset attestation workflow, and the two-step publication semantics (commit B `status: promoted` is only a local gate; publication completes only after the external B5 attestation readback succeeds). <!-- sdd-owner: implementation -->
- [x] Update `openspec/programs/drenyra-dominion/delivery-sequence.md` to close §7 item 4 ("Add the release-manifest attestation workflow (B5)…") — mark it complete ONLY after the external attestation is recorded and read back successfully. Document that an invalid/out-of-date binding is superseded with a new lock commit, tag, and attestation, never by rewriting the historical tag/release asset/receipt/evidence record. <!-- sdd-owner: implementation -->
- [x] Add resolvable apply-time evidence records to the relevant evidence/capability records (e.g. `status-and-evidence.md`/capability matrix) and synchronize only claims actually proven by those records. No stale or inferred fact is recorded as current. <!-- sdd-owner: implementation -->

## Phase 2 — tests and verification

- [x] Run the focused checksum Vitest file (strict TDD RED → GREEN → TRIANGULATE → REFACTOR) and the schema/lock validity checks: both JSON documents parse; `program-lock.schema.json` validates as draft-07; the promoted `program-lock.json` validates against the schema (R7, D11). <!-- sdd-owner: implementation -->
- [x] Exercise the six promotion-gate facets as pass/fail per the spec (R7): (1) fresh revision-bound host verification binds to the exact promoted revision; (2) sibling unknown preservation (private trio stays `unknown`); (3) promotion valid only after all gates pass, unsupported/dangling claims block with `status` remaining `candidate`; (4) checksums exclude `program-lock.json` and carry no carrying-commit reference; (5) attestation recording pins the carrying commit with §7 item 4 recorded complete, mismatch fails closed without mutating the attestation; (6) no runtime/install-time consumption code was added. <!-- sdd-owner: implementation -->
- [x] Run checksum generation twice and `--verify`; assert no lock path or carrying-commit SHA appears in the checksum output; assert `host.commitSha === null` and the private trio SHAs are `null`. Resolve every evidence ID and confirm each record names the same revision/fetch result the lock claims (R3, R4, D13). <!-- sdd-owner: implementation -->
- [x] Confirm public sibling SHAs and visibility match fresh `gh api` evidence; confirm the private trio remains unknown. Confirm no diff touches a runtime/install-time consumer of `program-lock.json` and no frozen contract changed (R6). <!-- sdd-owner: implementation -->
- [x] Run the existing release-integrity / ecosystem-script-resilience suites unchanged; confirm identical results to baseline and that the new checksum test does not alter `sbom.mjs`/`checksums.mjs`/`verify-release-integrity.mjs` behavior. <!-- sdd-owner: implementation -->

## Phase 3 — verification

- [x] Run the focused checksum test file first (green), then the full suite `bun run test` → **915/915** green at the frozen revision, then `bun run typecheck` and `bun run build`; all green with only the recorded pre-existing baseline failures (if any) remaining. <!-- sdd-owner: implementation -->
- [x] Spec pass/fail check: record each requirement **R1–R7** and each `#### Scenario` as pass/fail against the implementation and tests; note runtime consumption of the lock (SDD-020 slice C) and full private-repo federation as explicitly out-of-scope/deferred. <!-- sdd-owner: implementation -->
- [x] Protected-path check: verify no edit touched any protected runtime path or archived change record (git status/diff against baseline). Changed-line budget check: confirm authored additions+deletions total ≈170–220 and stay under the 300-line repo review budget; if they exceed it, do NOT merge as one unit — stop and promote the split boundary defined in the Forecast to two chained PRs. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Start or reuse bounded review for the single SDD-010 slice candidate after verification is frozen; apply findings within the single correction budget, then validate the terminal receipt. (RDD-off clone-local precedent followed — same as the SDD-030 routing and SDD-020 configurator slices: no review, delivered under Git-normal policy.) <!-- sdd-owner: parent -->
- [ ] Deliver the slice via a single PR following repository policy; update the SDD-010 change record (`proposal.md` lifecycle toward apply evidence; record tasks/verify/archive state) and confirm SDD-010 remains active (not archived) until the federated release train is executed across the ecosystem. <!-- sdd-owner: parent -->
