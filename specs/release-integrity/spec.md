# Release Integrity Specification

## Purpose

Release-integrity evidence is the set of artifacts that let a consumer prove that a packaged release is exactly the set of files its producer intended. For this change, that evidence is a checksum manifest (`dist/checksums.txt`) and a CycloneDX SBOM (`dist/sbom.json`) generated from the built package.

The evidence MUST be deterministic (identical inputs produce byte-identical output), independent of the caller's current working directory, fail-closed on any absent or invalid input, verified before packaging is allowed to succeed, and surfaced by the existing CI `package` job without adding any runner, workflow, or job. Evidence generation is owned by `dist/`: generated during packaging, shipped through the existing package `files` configuration, and never committed to the repository.

This is the first bounded slice of release-integrity evidence: generation, wiring, and verification. Lockfile-resolved SBOM versions and artifact signing are explicit non-goals of this change.

## Requirements

### Requirement: Deterministic SBOM Generation

The system MUST generate `dist/sbom.json` such that identical source inputs and identical declared dependency inputs always produce byte-identical output, independent of when generation runs. The generated SBOM MUST NOT contain wall-clock-derived content (such as a `new Date()` timestamp) in any field that contributes to its bytes. The output MUST remain valid CycloneDX JSON.

#### Scenario: Identical inputs produce identical SBOM bytes

- GIVEN the same repository state and the same declared runtime dependencies
- WHEN the SBOM generator runs twice with identical inputs
- THEN both runs produce byte-identical `dist/sbom.json`

#### Scenario: Wall-clock time does not affect SBOM output

- GIVEN two SBOM generation runs of the same inputs performed at different wall-clock times
- WHEN the two outputs are compared
- THEN the outputs are byte-identical

### Requirement: Cwd-Independent Evidence Generation

The system MUST resolve the repository root, the input `package.json`, and the output `dist/` directory from the location of the generator and verifier scripts, not from the caller's current working directory. Generation and verification MUST behave identically regardless of the directory from which they are invoked.

#### Scenario: Invocation from a non-repository directory

- GIVEN the generator scripts are invoked from a working directory outside the repository
- WHEN the checksum manifest and SBOM are generated
- THEN the generator reads the repository's `package.json`, writes `dist/checksums.txt` and `dist/sbom.json` inside the repository's `dist/` directory, and exits zero

#### Scenario: Invocation from the repository root

- GIVEN the generator scripts are invoked from the repository root
- WHEN the checksum manifest and SBOM are generated
- THEN the same `dist/` paths are read and written as when invoked from any other working directory, with identical output bytes

### Requirement: Fail-Closed Evidence Generation

The system MUST fail closed when generating release-integrity evidence: if a required input is absent or unreadable (for example, `dist/` does not exist or `package.json` cannot be read), generation MUST terminate with a non-zero exit code and a clear error message that names the missing or unreadable input. Generation MUST NOT report success when any required input is unavailable.

#### Scenario: Missing dist directory

- GIVEN `dist/` does not exist
- WHEN the checksum manifest generator runs
- THEN the generator exits non-zero and prints a clear error naming the missing `dist/` directory

#### Scenario: Unreadable package manifest

- GIVEN `package.json` is absent or unreadable at the resolved repository root
- WHEN the SBOM generator runs
- THEN the generator exits non-zero and prints a clear error naming the unreadable input

### Requirement: Explicit Non-Circular Evidence Ordering

The system MUST generate release-integrity evidence in one explicit, documented order such that the checksum manifest covers the intended packaged artifacts without circular or self-referential ambiguity. The checksum manifest MUST include the generated SBOM file among its entries, and MUST NOT contain an entry whose digest depends on the manifest's own content. Tests MUST pin the documented order and the exclusion of self-referential entries.

#### Scenario: Checksum manifest covers the SBOM without self-reference

- GIVEN a built `dist/` tree and the documented generation order (SBOM before checksum manifest)
- WHEN the evidence set is generated
- THEN `dist/checksums.txt` contains an entry for `dist/sbom.json` with its correct digest and contains no entry for the manifest file itself

#### Scenario: Regeneration preserves stable coverage

- GIVEN the same `dist/` tree
- WHEN the evidence set is generated a second time following the documented order
- THEN the second manifest covers exactly the same set of packaged files, with no circular or self-referential entries introduced

### Requirement: Checksum Manifest Verification

The system MUST verify that every entry in `dist/checksums.txt` matches the packaged file it names: each listed file MUST exist under `dist/` and MUST re-hash to the recorded digest. Verification MUST fail with a non-zero exit code and a clear error when any entry mismatches, when an entry names a missing file, or when a packaged file expected to be covered is absent from the manifest.

#### Scenario: Self-consistent manifest passes

- GIVEN a `dist/` tree whose `checksums.txt` was generated from that same tree
- WHEN the checksum verifier runs
- THEN verification succeeds and exits zero

#### Scenario: Corrupted packaged file fails verification

- GIVEN a packaged file listed in `checksums.txt` whose contents differ from the recorded digest
- WHEN the checksum verifier runs
- THEN verification exits non-zero with a clear error naming the mismatched file

#### Scenario: Missing manifest entry fails verification

- GIVEN a packaged file under `dist/` that is not listed in `checksums.txt`
- WHEN the checksum verifier runs
- THEN verification exits non-zero with a clear error

### Requirement: SBOM Verification

The system MUST verify that `dist/sbom.json` is parseable as valid CycloneDX JSON and that it covers every declared runtime dependency from `package.json`. Verification MUST fail with a non-zero exit code and a clear error when the SBOM is malformed or when any declared runtime dependency is absent from the SBOM's components. SBOM coverage in this change is verified against declared runtime dependencies only; verification MUST NOT require lockfile-resolved versions and MUST NOT claim lockfile-resolved fidelity.

#### Scenario: Valid SBOM covering declared dependencies passes

- GIVEN a `dist/sbom.json` that parses as CycloneDX JSON and lists every declared runtime dependency from `package.json`
- WHEN the SBOM verifier runs
- THEN verification succeeds and exits zero

#### Scenario: Malformed SBOM fails verification

- GIVEN a `dist/sbom.json` that is not valid CycloneDX JSON
- WHEN the SBOM verifier runs
- THEN verification exits non-zero with a clear error

#### Scenario: Missing declared dependency fails verification

- GIVEN a `dist/sbom.json` that omits one declared runtime dependency from `package.json`
- WHEN the SBOM verifier runs
- THEN verification exits non-zero with a clear error naming the missing dependency

### Requirement: Package Verification Wiring

The system MUST generate `dist/checksums.txt` and `dist/sbom.json` as part of the existing package verification path, after the required build output exists, and MUST run checksum and SBOM verification within that path. Package verification MUST NOT succeed when release-integrity evidence is missing or invalid.

#### Scenario: Package verification produces and validates evidence

- GIVEN the build output exists in `dist/`
- WHEN the existing package verification command runs
- THEN it generates `dist/checksums.txt` and `dist/sbom.json`, verifies both, and completes successfully

#### Scenario: Missing evidence fails package verification

- GIVEN `dist/checksums.txt` and `dist/sbom.json` are absent or invalid after build output exists
- WHEN the existing package verification command runs
- THEN it exits non-zero and package verification does not succeed

### Requirement: CI Package-Job Evidence

The system MUST execute release-integrity verification in the existing CI `package` job, after package verification, and MUST fail the job when verification fails. The evidence MUST be attributable to that job without adding a new runner, workflow, job, or parallel job.

#### Scenario: CI package job executes and passes integrity verification

- GIVEN the existing CI `package` job runs against a repository state with valid generated evidence
- WHEN the job reaches the release-integrity verification step
- THEN the verification step runs within the existing job and the job succeeds

#### Scenario: CI package job fails on invalid evidence

- GIVEN the existing CI `package` job runs against a repository state whose generated evidence fails verification
- WHEN the job reaches the release-integrity verification step
- THEN the step exits non-zero and the job fails

### Requirement: Generated-Evidence Ownership

The system MUST treat `dist/checksums.txt` and `dist/sbom.json` as generated artifacts: they MUST be produced during packaging, shipped through the existing package `files` configuration, and MUST NOT be committed to the repository.

#### Scenario: Evidence remains uncommitted

- GIVEN release-integrity evidence was generated for the package
- WHEN the repository working tree is inspected
- THEN neither `dist/checksums.txt` nor `dist/sbom.json` appears as a tracked or committed file, and both remain available under `dist/` for packaging

### Requirement: Independent Change Boundary

The release-integrity evidence work MUST NOT modify, reinterpret, or share implementation paths with the blocked `gentle-ai-quality-parity` Slice A work, and MUST NOT modify unrelated WIP paths or generated artifacts outside `dist/`. The change MUST be confined to the existing release/package layer: the checksum and SBOM scripts, a small verifier, focused tests, `package.json` package scripts, and the existing CI `package` job.

#### Scenario: Path audit confines the change

- GIVEN the implemented change is complete
- WHEN a path audit compares the changed files against the declared scope and the blocked Slice A and WIP path lists
- THEN every changed path falls within the declared release/package layer and no blocked Slice A or unrelated WIP path is modified

### Requirement: TDD, Budget, and Baseline Attribution

The system's release-integrity evidence behavior MUST be delivered under strict TDD, with focused tests written before the minimum production changes. The total authored changed-line count (additions plus deletions) MUST NOT exceed 300 lines, with no size exception. Pre-existing baseline failures unrelated to this change MUST remain unchanged and MUST be attributed as pre-existing, not hidden or fixed by this change.

#### Scenario: RED tests precede production changes

- GIVEN the change is implemented
- WHEN the recorded evidence is inspected
- THEN focused tests demonstrating the missing behavior (determinism, cwd independence, fail-closed failures, verification, ordering) were authored before the production changes that make them pass

#### Scenario: Changed-line budget is respected

- GIVEN the implemented change is complete
- WHEN the authored additions plus deletions are counted
- THEN the count is less than or equal to 300 lines

#### Scenario: Baseline failures stay unchanged and attributed

- GIVEN pre-existing baseline failures exist outside this change's scope
- WHEN the change's verification evidence is inspected
- THEN those failures remain unchanged, are explicitly documented as pre-existing and unrelated, and were neither fixed nor hidden by this change
