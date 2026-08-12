# Proposal — Release Integrity Evidence

## Intent

Close the release-integrity evidence gap by making checksum and SBOM generation deterministic, independent of the caller's current working directory, fail-closed, and part of the existing package verification path. The existing package CI job must prove that the generated evidence is present and valid before packaging succeeds.

This is an independent change. It must not touch, unblock, reinterpret, or share implementation paths with the blocked `gentle-ai-quality-parity` Slice A. It uses only the separately identified G4 release-integrity gap as motivation.

## Problem

The repository already contains checksum and CycloneDX SBOM generators, but they are not wired into package scripts or CI evidence. As a result, release-integrity claims are aspirational rather than enforced:

- package verification does not guarantee that `dist/checksums.txt` or `dist/sbom.json` exists;
- no verifier proves checksum self-consistency or SBOM coverage of declared runtime dependencies;
- SBOM output contains a wall-clock timestamp and is therefore non-deterministic for identical inputs;
- checksum generation resolves `dist/` from `process.cwd()`, so behavior depends on the caller's working directory;
- missing or unreadable inputs do not consistently produce clear, fail-closed failures.

The current state can allow incomplete, stale, malformed, or unverifiable release evidence to pass through the package path.

## Goals

1. Generate `dist/sbom.json` and `dist/checksums.txt` deterministically for identical source and declared dependency inputs.
2. Resolve repository and output paths from the scripts' locations rather than the caller's current working directory.
3. Fail closed with a clear error and non-zero exit when required inputs are absent, unreadable, malformed, incomplete, or inconsistent.
4. Verify that every checksum manifest entry matches its packaged file and that the SBOM is parseable and covers every declared runtime dependency.
5. Wire generation and verification into the existing package script path so package verification produces and validates both artifacts.
6. Surface release-integrity evidence through the existing CI `package` job without adding a runner, workflow, or parallel job.
7. Deliver the behavior under strict TDD with no more than 300 authored changed lines, counted as additions plus deletions.

## Proposed First Slice

Implement one bounded work unit: **deterministic, wired, and verified release-integrity evidence**.

The slice will:

- make SBOM generation deterministic by removing or deterministically controlling wall-clock-derived output;
- make checksum generation independent of the invocation cwd;
- define an explicit generation order so the checksum manifest covers the intended packaged artifacts without circular or self-referential ambiguity;
- add or extend a small release-integrity verifier for checksum self-consistency and declared-runtime-dependency SBOM coverage;
- add package scripts for generation and verification;
- wire those scripts into the existing package verification path after build output exists;
- run or expose the verifier in the existing CI `package` job as attributable release-integrity evidence;
- add focused tests first, then the minimum production changes needed to make them pass.

Generated evidence remains owned by `dist/`: it is gitignored, generated during packaging, included by the existing package `files` configuration, and must not be committed.

## Business and Operational Rules

- Package verification must not succeed when release-integrity evidence is missing or invalid.
- Identical inputs must produce byte-identical checksum and SBOM evidence regardless of invocation cwd.
- Generation must occur only after required build output exists.
- SBOM verification in this slice covers declared runtime dependencies from `package.json`; it must not claim lockfile-resolved fidelity.
- The existing package CI job remains the evidence owner. No new workflow job or execution environment is introduced.
- Existing baseline failures unrelated to this slice are not acceptance evidence and must not be changed or hidden.
- The authored diff has a hard ceiling of **300 changed lines**. If the required implementation exceeds that ceiling, work stops for re-scoping rather than taking an exception.

## Scope

### In Scope

- Determinism correction in the existing SBOM generator.
- Script-relative, cwd-independent path resolution in checksum/SBOM generation and verification.
- Clear fail-closed handling for missing, unreadable, malformed, incomplete, or mismatched release inputs.
- Checksum manifest verification against files under `dist/`.
- SBOM parsing and coverage verification for declared runtime dependencies.
- Package-script wiring for generation and verification.
- Evidence in the existing CI `package` job.
- Focused strict-TDD tests and bounded verification evidence.

### Non-Goals

- Any code, tests, artifacts, or paths belonging to blocked `gentle-ai-quality-parity` Slice A, including declared-surface integrity, MCP/CLI version parity, or `doctor` behavior.
- Lockfile-resolved dependency versions in the SBOM.
- Artifact signing, signatures, provenance attestations, or key management.
- Lint/format gate work, sibling-repository work, domain logic, or frozen-contract changes.
- A new CI runner, workflow, job, release system, state, flag, or command family.
- Committing generated `dist/checksums.txt` or `dist/sbom.json`.
- Fixing the three pre-existing baseline failures in `cmd/__tests__/cli.test.ts`.
- Modifying unrelated WIP, including:
  - `missions/__tests__/postgres.integration.test.ts`
  - `skills/__tests__/pe-skills.test.ts`
  - `openspec/changes/fiscal-authority-kernel/apply-progress.md`
  - `openspec/programs/drenyra-dominion/capability-matrix.yaml`

## Affected Areas

Expected implementation is limited to the existing release/package layer:

- checksum and SBOM scripts under `scripts/`;
- one small verifier under `scripts/`, or the existing package-file verifier if extending it remains clearer and smaller;
- focused tests for those scripts;
- `package.json` package verification scripts;
- the existing `.github/workflows/ci.yml` `package` job.

No generated files, unrelated active-change files, domain modules, or blocked Slice A paths may be modified.

## Strict TDD Acceptance Evidence

Implementation must follow RED → GREEN → TRIANGULATE → REFACTOR and retain exact command/results in apply and verification artifacts.

### RED evidence required before production changes

Focused tests must initially demonstrate the missing behavior:

1. Two runs with identical inputs produce byte-identical `sbom.json` and `checksums.txt`.
2. Invocation from a non-repository cwd still reads and writes the intended repository `dist/` paths.
3. Missing `dist/`, unreadable required manifests, malformed SBOM, checksum mismatch, missing checksum entries, and missing declared dependencies cause a non-zero, clear failure.
4. A valid fixture produces a self-consistent checksum manifest and an SBOM covering all declared runtime dependencies.
5. Generation order avoids circular/self-referential checksum ambiguity and is pinned by test.

### GREEN and TRIANGULATE evidence

- Focused tests pass after the minimum implementation.
- At least one additional malformed or partial-data case is added during triangulation to prevent a fixture-specific implementation.
- The existing package verification command generates both evidence files and verifies them successfully.
- The existing CI `package` job contains and executes attributable integrity verification without introducing a new job.
- Full applicable tests and type checks pass, except only explicitly documented pre-existing baseline failures that remain unchanged and are proven unrelated.
- The final authored additions plus deletions are **≤300 lines**.
- A final path audit proves no blocked Slice A, generated, unrelated WIP, or non-goal path changed.

## Success Criteria

The proposal succeeds when all of the following are true:

- package verification deterministically generates `dist/sbom.json` and `dist/checksums.txt`;
- outputs are identical for identical inputs regardless of caller cwd;
- verification fails closed on absent, unreadable, malformed, incomplete, or mismatched evidence;
- checksum entries re-hash correctly and SBOM coverage includes every declared runtime dependency;
- the existing package CI job provides explicit successful verification evidence;
- generated artifacts are shipped through the existing `dist` package path but remain uncommitted;
- strict-TDD evidence and exact verification results are recorded;
- no unrelated baseline, WIP, blocked Slice A, or non-goal path is modified;
- the total authored changed-line count does not exceed 300.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A deterministic SBOM timestamp choice diverges from future CycloneDX policy. | Low | Omit wall-clock output or use an explicit deterministic input while preserving valid CycloneDX structure; defer richer provenance semantics. |
| Checksum and SBOM files create circular generation semantics. | Medium | Define one explicit order, normally SBOM before checksums, and exclude self-referential entries where required; pin the contract with tests. |
| Verification checks only a happy-path fixture. | Medium | Triangulate with corruption, omission, malformed JSON, missing input, and non-root cwd cases. |
| Package verification becomes slower or more brittle. | Low | Reuse the existing package job and local files only; keep verification small, deterministic, and fail-fast. |
| Scope expands into signing or lockfile parsing. | Medium | Treat both as explicit follow-up slices; stop if they become necessary to satisfy the first-slice contract. |
| The change accidentally overlaps blocked or unrelated work. | High | Enforce an explicit path audit before acceptance and reject any diff touching blocked Slice A or listed WIP paths. |
| Implementation exceeds the review budget. | High | Enforce the hard 300-line ceiling; re-scope before implementation continues, with no size exception. |

## Rollback

Rollback is a single independent release/package-layer reversal:

1. remove package-script and existing package-job wiring added by this change;
2. remove the bounded verifier if newly introduced;
3. revert determinism, cwd-independence, and fail-closed edits in the release scripts;
4. remove only the focused tests introduced for this behavior.

Because generated evidence remains under gitignored `dist/`, rollback requires no repository artifact migration or data cleanup. It must not revert or alter any unrelated active change. After rollback, run the pre-change package verification path to confirm baseline behavior is restored.

## Follow-Up Candidates

The following require separate proposals and budgets:

- lockfile-resolved SBOM component versions;
- artifact signing and provenance attestations;
- broader release-policy or cross-repository integrity gates.

## Next Recommended Phase

Proceed to `spec` for this first slice only, preserving the independent-change boundary, strict TDD requirement, fail-closed behavior, existing package-job ownership, and hard 300 changed-line ceiling.
