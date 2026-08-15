# Release-Train Specification

## Purpose

The release-train domain governs the promotion of the Drenyra Dominion program lock (`openspec/programs/drenyra-dominion/program-lock.json`) from a `candidate` composition to a published, reproducible `promoted` checkpoint. Promotion publishes a revision-bound host verification, records only verified sibling facts, populates deterministic composition checksums, and pins the otherwise self-unreferenceable carrying commit through the external Phase B5 release attestation. Promotion is a governance and release-integrity operation; it does not add any runtime consumption of the lock, which remains SDD-020 slice C territory.

## Requirements

### Requirement: Revision-Bound Freshness

The promoted lock MUST record in `currentVerified` a fresh, revision-bound green verification over the exact inspected revision. The host claim MUST record version `0.4.0`, a green `915/915` test result, clean typecheck, passing conformance, `PUBLIC` GitHub visibility, the exact inspected revision, the inspection time, and resolvable evidence identifiers for every current claim. The stale host facts (`0.2.1`, `774` tests, revision `549ed640…`) MUST be replaced and MUST NOT be carried forward as current claims. `currentVerified.host.commitSha` MUST remain `null` (bootstrap rule). A lock MUST NOT be promoted on the basis of W2-era evidence alone.

#### Scenario: Fresh verification binds to the exact promoted revision

- GIVEN a promotion candidate whose `currentVerified` cites version `0.4.0`, a green `915/915` suite, clean typecheck, passing conformance, `PUBLIC` visibility, and evidence IDs resolving against the evidence register for the exact inspected revision
- WHEN the readback gate runs before promotion
- THEN the host claim is accepted as current and the checkpoint may be promoted

#### Scenario: Stale W2 facts block promotion

- GIVEN `currentVerified` still cites `0.2.1`, `774` tests, and revision `549ed640…` without a fresh revision-bound re-verification over the current tree
- WHEN promotion is attempted
- THEN promotion is blocked and `status` remains `candidate` until fresh evidence replaces the stale claims

### Requirement: Honest Sibling Facts

The promoted lock MUST record verified sibling facts only for repositories with admissible evidence. `drenyra-engram` and `drenyra-pi` MUST be recorded as verified `PUBLIC` siblings using freshly fetched immutable main-branch commit SHAs, each with its source and freshness (fetch time and evidence ID). The private trio (`drenyra-command-center`, `drenyra-skills`, `drenyra-guardian-angel`) MUST remain `unknown` / `awaiting-evidence` unless credentialed evidence is produced before promotion. The lock MUST NOT fabricate SHAs, versions, test totals, conformance, or visibility for any sibling, and MUST NOT relabel historical snapshot values as current facts.

#### Scenario: Public sibling facts recorded with source and freshness

- GIVEN `drenyra-engram` and `drenyra-pi` are publicly reachable and their main-branch SHAs are fetchable without credentials
- WHEN promotion fetches the immutable main-branch SHAs directly and records an evidence ID with the fetch time
- THEN both siblings are recorded as verified `PUBLIC` facts with source and freshness

#### Scenario: Private trio preserved as unknown

- GIVEN no credentialed evidence exists for `drenyra-command-center`, `drenyra-skills`, or `drenyra-guardian-angel`
- WHEN the checkpoint is promoted
- THEN those siblings remain explicitly `unknown` / `awaiting-evidence`, no SHA or version is invented for them, and snapshot values are not relabeled as current

### Requirement: Promotion Status

The lock `status` MUST move from `candidate` to `promoted` only when the verifiable checkpoint passes every promotion gate: fresh revision-bound host verification, sibling facts resolved per evidence, deterministic checksums populated, every evidence identifier resolvable against the register, and schema validity. The promoted lock MUST validate against `program-lock.schema.json`, and any schema amendment MUST itself remain a valid draft-07 schema that accepts the promoted lock. Promotion MUST fail closed on any unsupported current claim, dangling evidence ID, or stale fact.

#### Scenario: Promotion valid only after all gates pass

- GIVEN a `candidate` lock with a fresh revision-bound host claim, verified public sibling facts, honest `unknown` private siblings, populated deterministic checksums, and resolvable evidence IDs
- WHEN the readback gate validates the lock against its schema and resolves every evidence identifier
- THEN `status` becomes `promoted`

#### Scenario: Unsupported claim blocks promotion

- GIVEN a `candidate` lock containing a dangling evidence ID or an unsupported current claim (for example, a stale or inferred sibling fact)
- WHEN promotion is attempted
- THEN the lock fails closed, `status` remains `candidate`, and the unsupported claim is reported

### Requirement: Deterministic Lock Checksums

The checksum producer (`scripts/checksum-lock.mjs`) MUST generate SHA-256 checksums over the lock's referenced pinned composition using deterministic ordering and fail-closed validation. The checksum set MUST exclude `program-lock.json` itself (checksum self-inclusion rule). The checksum set MUST NOT include or otherwise encode the SHA of the commit that carries the lock (bootstrap rule). Unknown private sibling facts MUST NOT receive invented checksum material. The producer MUST produce identical output for identical inputs regardless of working directory or environment ordering.

#### Scenario: Checksums exclude the lock file

- GIVEN the checksum producer runs over the pinned composition referenced by the lock
- WHEN the checksum set is generated
- THEN `program-lock.json` itself is not present among the checksummed artifacts

#### Scenario: Checksums carry no carrying-commit reference

- GIVEN the lock is carried by commit B
- WHEN the checksum set and the lock's `currentVerified.host.commitSha` are inspected
- THEN neither contains commit B's SHA, and commit B is pinned only by the external attestation

#### Scenario: Deterministic and fail-closed generation

- GIVEN identical pinned composition inputs
- WHEN the producer runs twice in different working directories
- THEN the checksum sets are byte-identical, and any verification mismatch fails closed and blocks promotion

### Requirement: Release Attestation

The Phase B5 release attestation MUST be recorded for the promoted checkpoint. A signed tag or release reference MUST pin the SHA of the commit that carries the promoted lock, bound to the exact lock/checksum output and the verified revision. Promotion MUST fail closed when the attestation references do not match the exact promoted lock output. Recording the attestation MUST close delivery-sequence §7 item 4 ("Add the release-manifest attestation workflow (B5)…").

#### Scenario: Attestation pins the carrying commit

- GIVEN a promoted lock carried by commit B with a populated checksum block and verified revision R
- WHEN the Phase B5 attestation is recorded as a signed tag or release artifact
- THEN the attestation references commit B's SHA along with the verification evidence, and §7 item 4 is recorded complete

#### Scenario: Attestation/lock mismatch fails closed

- GIVEN an attestation or manifest that references a commit SHA or checksum set that does not match the promoted lock output
- WHEN readback validates the attestation against the lock
- THEN promotion is blocked and the mismatch is reported without mutating the attestation

### Requirement: No Runtime Consumption

The promotion change MUST NOT add any runtime or install-time code that consumes `program-lock.json`. The change MAY add the bounded `scripts/checksum-lock.mjs` producer, its focused tests, and documentation/tooling. It MUST NOT introduce a new producer–consumer contract or alter any frozen contract. Runtime consumption of the program lock remains SDD-020 slice C territory and MUST NOT be pulled forward.

#### Scenario: No consumption code is added

- GIVEN the promotion change is complete
- WHEN the changed code paths are reviewed for consumers of `program-lock.json`
- THEN no runtime or install-time path reads the lock, and the only additions are the checksum producer, its tests, documentation, and governance records

### Requirement: Testable Promotion Gates

Each promotion gate MUST be exercised by a testable Given/When/Then scenario covering: fresh verification binding, sibling unknown preservation, promotion validity, checksum exclusion of the lock file, attestation recording, and absence of consumption code. The checksum producer MUST ship focused automated tests (strict TDD) demonstrating determinism, canonical ordering, SHA-256 encoding, self-exclusion of the lock file, and fail-closed behavior.

#### Scenario: Promotion gate suite is executable

- GIVEN the promotion change with its readback checks and the checksum producer's focused tests
- WHEN the gate suite runs
- THEN each of the six gate facets produces a pass/fail outcome, and any failure blocks promotion
