# Program-Lock Awareness Specification

## Purpose

Make the promoted Drenyra Dominion composition visible to installed `drenyra-ai` packages as offline evidence. The release process derives a bundled composition manifest from the promoted program lock, and package-level `install` and `doctor` flows read and report that manifest so every configured host can identify the promoted artifact rather than treating the package version and `PINNED_AI_COMPOSITION` constants as the complete composition authority. The bundled manifest is a derived package resource carrying only non-carrying promotable facts; it is not a second program lock and introduces no new normative contract.

## Requirements

### Requirement: Bundled Composition Manifest

The release process MUST generate a deterministic JSON composition manifest under `dist/` from the promoted Drenyra Dominion program lock, such that the manifest is automatically included in the published npm package tarball. The manifest MUST carry exactly the non-carrying promotable subset of the lock: the promoted host version, the verified revision, the host artifact SHA-256 digest, the promoted checksum-set SHA-256, and the attestation tag. The manifest MUST NOT include the SHA of the commit that carries the program lock (bootstrap rule) and MUST NOT include branch or `HEAD` state.

Generation MUST derive output only from the supplied promoted lock: no network access, no `process.cwd()` dependence, no timestamps or random values, and identical input MUST produce byte-identical output. The generator MUST fail closed (reject with a diagnostic and emit no manifest) when the source lock is missing, malformed, not `status: "promoted"`, inconsistent (for example, a checksums block whose host entry does not reference the promoted host, or a `setSha256` that cannot be reconciled with the lock's checksum entries), or carries a carrying-commit SHA. The source program lock MUST remain authoritative and its schema and content MUST NOT be changed by generation.

#### Scenario: Deterministic non-carrying generation

- GIVEN a valid promoted program lock
- WHEN the release generation step runs twice with the same lock
- THEN both runs produce byte-identical manifest content under `dist/`
- AND the manifest contains exactly the promoted version, verified revision, host artifact digest, checksum-set digest, and attestation tag
- AND the manifest contains no carrying-commit SHA and no branch or `HEAD` state

#### Scenario: Non-promoted or carrying-commit source rejected

- GIVEN a source lock that is not `status: "promoted"`, or that carries a carrying-commit SHA, or whose checksum block is inconsistent with the promoted host
- WHEN the generation step runs
- THEN generation fails closed with a diagnostic and writes no manifest

#### Scenario: Ships in the published package

- GIVEN a built package
- WHEN package-integrity verification inspects the packed tarball
- THEN the bundled composition manifest is present under `dist/` in the published package

### Requirement: Offline Reader

The configurator library MUST read the bundled composition manifest offline through the established package-root resolution semantics: the installed package root MUST be resolved from the executing module's location (never `process.cwd()`, never network, never branch state), and the manifest MUST be located relative to that root. The reader MUST classify the manifest strictly as valid, absent, or invalid and MUST fail closed: an absent or malformed manifest MUST NOT be replaced by ambient fallbacks such as package-version inference, hardcoded promoted facts, files under `process.cwd()`, or network retrieval. The reader MUST validate every carried fact (semantic version, lowercase 40-hex verified revision, lowercase 64-hex digests, non-empty attestation tag) and MUST reject a manifest that carries a carrying-commit SHA or an unrecognized or extra field set. The reader MUST NOT perform any runtime or install-time network fetch.

#### Scenario: Valid manifest read

- GIVEN a valid bundled manifest at the installed package root
- WHEN the reader is invoked offline
- THEN it returns the promoted composition facts: promoted version, verified revision, host artifact digest, checksum-set digest, and attestation tag

#### Scenario: Absent manifest

- GIVEN no bundled manifest at the installed package root
- WHEN the reader is invoked
- THEN it reports the manifest as absent and returns no promoted facts

#### Scenario: Malformed manifest

- GIVEN a bundled manifest that is not valid JSON, or that fails strict field validation, or that carries a carrying-commit SHA or extra fields
- WHEN the reader is invoked
- THEN it reports the manifest as invalid and returns no promoted facts

#### Scenario: No cwd or network fallback

- GIVEN an installed package whose bundled manifest is absent
- AND a manifest-like file exists under `process.cwd()` or is reachable over the network
- WHEN the reader is invoked
- THEN it still reports absent and never reads the cwd file and never fetches anything

### Requirement: Install Surfacing

Install MUST report the promoted composition carried by the bundled manifest alongside the installed package identity (package version). Install MUST NOT hard-gate on version equality: when the promoted version differs from the packaged version (for example promoted `0.4.0` versus packaged `0.4.1`), install MUST record and report the skew and MUST NOT fail solely because the packaged version is ahead of the latest promoted checkpoint. Install MUST NOT claim that the packaged version itself is promoted, and MUST NOT claim promotion when the bundled manifest is absent or invalid — in those states the promoted-composition evidence MUST be reported as unavailable. Install MUST NOT alter the persisted managed manifest schema, per-host pins, or upgrade/rollback/transition logic; this slice adds reporting only, and the managed composition record (`managed.json`) MUST remain unchanged in shape.

#### Scenario: Skew recorded, not gated

- GIVEN an installed package version `0.4.1` and a valid bundled manifest carrying promoted version `0.4.0`
- WHEN install runs
- THEN the install report includes the installed package identity and the promoted composition (promoted version `0.4.0`, verified revision, host artifact digest, checksum-set digest, attestation tag)
- AND the report states that the packaged version differs from the promoted version
- AND install completes successfully without gating on version equality

#### Scenario: No promotion claim without a valid manifest

- GIVEN an absent or invalid bundled manifest
- WHEN install runs
- THEN install completes normally and reports the promoted-composition evidence as unavailable
- AND the report makes no promotion claim

#### Scenario: No false promotion

- GIVEN a packaged version that differs from the promoted version carried by a valid bundled manifest
- WHEN install reports
- THEN the report never states that the packaged version itself is promoted

### Requirement: Doctor Surfacing

Doctor MUST surface program-lock awareness as a dedicated diagnostic within the `{status, checks, readonly}` report. The diagnostic MUST classify the bundled manifest as valid, absent, or invalid. When the manifest is valid, the diagnostic MUST surface the promoted version, verified revision, host artifact digest, checksum-set digest, attestation tag, and the relationship between the promoted version and the installed/packaged version. Version skew MUST be recorded and reported as information and MUST NOT by itself fail the check. An invalid bundled manifest MUST fail the check closed as unverifiable and MUST NOT surface promoted facts. An absent bundled manifest MUST be reported as absent/not-applicable without fabricated promoted facts and MUST NOT degrade an otherwise healthy package (clean-checkout invariant). The diagnostic MUST NOT invent promoted facts in any state.

#### Scenario: Valid manifest with skew

- GIVEN a valid bundled manifest carrying promoted version `0.4.0` and an installed package version `0.4.1`
- WHEN doctor runs
- THEN the report includes a program-lock-awareness check that surfaces the promoted version and the packaged-versus-promoted relationship
- AND the check is ok (the skew is recorded information, not a failure)
- AND the report remains consistent with the `{status, checks, readonly}` contract

#### Scenario: Invalid manifest fails closed

- GIVEN a malformed or non-conforming bundled manifest
- WHEN doctor runs
- THEN the program-lock-awareness check fails closed as unverifiable and surfaces no promoted facts
- AND the report is degraded

#### Scenario: Absent manifest stays healthy

- GIVEN no bundled manifest
- WHEN doctor runs on an otherwise healthy package
- THEN the program-lock-awareness diagnostic reports the manifest as absent without promoted facts and without fabricating evidence
- AND the report remains healthy

### Requirement: Boundary Compliance

The bundled-manifest reader MUST remain library-level under `configurator/` and MUST NOT reverse-import from `cmd/` or `agents/`. Package-root resolution MUST be shared through a library-safe boundary (the existing `getPackageMetadata()` primitive reused, injected, or relocated) without creating a `configurator/` to `cmd/` import. The shared capability claim MUST be updated to state program-lock awareness, and the negative `/program-lock/i` boundary assertion in `cmd/__tests__/capabilities-doctor.test.ts` (the test at approximately line 91, negative match at approximately line 107) MUST be replaced with an assertion for the new, accurate claim. The change MUST NOT modify the program-lock schema, the promotion process, the bootstrap rule, or the attestation format.

#### Scenario: No reverse import

- GIVEN the configurator library source
- WHEN its imports are checked
- THEN no module under `configurator/` imports from `cmd/` or `agents/`
- AND the reader's package-root resolution is a library-safe shared primitive

#### Scenario: Capability claim updated

- GIVEN the shared declared capability surface
- WHEN the capabilities command renders the host integration claim
- THEN the claim states program-lock awareness
- AND the boundary test asserts the new claim instead of the previous negative `/program-lock/i` match

#### Scenario: Lock unchanged

- GIVEN the promoted program lock
- WHEN the release generates the bundled manifest
- THEN the program-lock file, its schema, the promotion process, and the attestation format are unchanged

### Requirement: Testability

The change MUST include automated tests, runnable in the standard Vitest suite with no network access, that verify: deterministic manifest generation and carrying-commit exclusion; offline reading in valid, absent, and malformed states; install reporting of the promoted composition and the recorded skew; doctor surfacing of program-lock awareness in valid, absent, and invalid states; the updated capability boundary assertion; and the no-network/no-branch property of generation and reading.

#### Scenario: Generation tests

- GIVEN fixture promoted locks covering valid, non-promoted, inconsistent, and carrying-commit-bearing sources
- WHEN the generation tests run
- THEN they assert byte-identical deterministic output for identical input
- AND they assert non-promoted, inconsistent, and carrying-commit-bearing sources are rejected with no manifest emitted
- AND they assert the emitted manifest never contains a carrying-commit SHA or branch state

#### Scenario: Reader tests

- GIVEN package fixtures with valid, absent, and malformed bundled manifests
- WHEN the reader tests run
- THEN they assert the valid/absent/invalid classification
- AND they assert no cwd or network fallback occurs

#### Scenario: Surfacing tests

- GIVEN install and doctor fixtures covering valid, absent, and invalid manifests and the `0.4.0` promoted versus `0.4.1` packaged skew
- WHEN the install and doctor tests run
- THEN they assert the promoted composition is reported, the skew is recorded and not a failure, and no promotion claim is made without a valid manifest

#### Scenario: Boundary and no-network tests

- GIVEN the changed capability claim and the reader and generator sources
- WHEN the boundary and integrity tests run
- THEN the boundary assertion matches the new program-lock-awareness claim
- AND no `configurator/` to `cmd/` import exists
- AND generation and reading perform no network or git operations
