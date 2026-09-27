# Specification — GO-010 Differential Test Harness & TS Oracle

## Purpose

This specification defines the requirements and testable acceptance scenarios for the GO-010 differential testing harness. The harness provides the automated mechanism to verify that Go implementations strictly match the frozen contract surface and the observable behavior of the TypeScript 0.5.0 oracle.

## Requirements

### Requirement: Shared fixture loader reads frozen contracts and test vectors

The test harness MUST load and parse test fixtures from `contracts/**` without mutating any contract file. It MUST support loading frozen conformance vectors (`receipt-schema/fixtures/conformance-vectors.v1.json`), dev signing keys, and structured test inputs.

#### Scenario: Conformance vectors are loaded from contracts
- GIVEN the frozen conformance vectors in `contracts/receipt-schema/fixtures/conformance-vectors.v1.json`
- WHEN the fixture loader reads the test vectors
- THEN all vector entries are parsed into strongly-typed fixture structures
- AND no `contracts/**` file is modified

#### Scenario: Missing or corrupted fixture fails closed
- GIVEN a non-existent or malformed fixture path
- WHEN the fixture loader attempts to read it
- THEN an error MUST be returned immediately
- AND test execution fails closed without silent fallback

### Requirement: TS 0.5.0 oracle invocation is isolated and deterministic

The harness MUST execute the TypeScript 0.5.0 oracle as an isolated subprocess. It MUST NOT rely on ambient PATH lookup, shell aliases, or global Node installations. Environment variables MUST be explicit, and process execution MUST enforce bounded timeouts and structured output capture.

#### Scenario: Oracle runs under explicit environment isolation
- GIVEN a differential test case requiring oracle reference behavior
- WHEN the oracle runner executes `dist/cmd/cli.js`
- THEN execution uses explicit Node/Bun runtime parameters without ambient PATH discovery
- AND stdout, stderr, and exit code are captured completely

#### Scenario: Subprocess timeout or failure is handled cleanly
- GIVEN an oracle execution that hangs or crashes
- WHEN the bounded timeout expires
- THEN the subprocess is terminated
- AND the test reports an explicit timeout/crash failure with captured diagnostics

### Requirement: Differential comparator enforces shallow canonicalization and byte exactness

The comparison engine MUST compare Go outputs against TS oracle outputs using the shallow key-sorted JSON canonicalization rule (`sortedStringify`). Monetary values MUST be compared as exact integer cents. Serialized byte payloads, hashes, and signatures MUST be byte-exact.

#### Scenario: Key order differences in shallow JSON are reconciled
- GIVEN two JSON payloads with identical key-value pairs but different top-level key order
- WHEN the differential comparator evaluates them
- THEN shallow canonicalization sorts top-level keys
- AND the comparison passes as matching

#### Scenario: Monetary precision preserves integer cents
- GIVEN a fiscal monetary amount in cents
- WHEN compared across Go and TS oracle
- THEN amounts are compared as whole integer cents (BigInt-safe)
- AND any floating-point representation drift causes comparison failure

#### Scenario: Serialized byte drift fails comparison
- GIVEN two receipt hash or signed receipt outputs
- WHEN their serialized byte representations differ by even one byte
- THEN the comparison fails
- AND the diff indicates the exact byte divergence

### Requirement: Mismatch diagnostics provide structured, deterministic reporting

When a differential comparison fails, the harness MUST emit structured, deterministic diagnostic reports detailing the failure cause, field-level divergence, hex dumps of binary/string representations, and exit code differences.

#### Scenario: Property divergence produces field-path diff
- GIVEN a candidate output that differs from the oracle on a specific property
- WHEN comparison fails
- THEN the diagnostic report identifies the exact JSON property path
- AND displays the expected oracle value vs actual candidate value

#### Scenario: Hex dump generated for serialized divergence
- GIVEN a serialized string or byte array mismatch
- WHEN comparison fails
- THEN the diagnostic report includes side-by-side hexadecimal formatting of the divergent bytes

### Requirement: Sentinel test validates the differential harness mechanism

The harness MUST include at least one sentinel test that exercises the entire differential pipeline end-to-end against the TS oracle. The sentinel test MUST demonstrate both a passing match on valid baseline input and a detected failure on deliberately mutated input.

#### Scenario: Baseline sentinel input passes comparison
- GIVEN a known valid baseline input
- WHEN executed through both the candidate adapter and the TS oracle
- THEN outputs match byte-for-byte under the comparison protocol
- AND the sentinel test passes

#### Scenario: Mutated sentinel input fails with diagnostic report
- GIVEN an input with an intentional mutation
- WHEN executed and compared against the oracle
- THEN the comparison fails
- AND a complete diagnostic report is emitted verifying the failure detection mechanism

### Requirement: Bounded scope and zero production domain runtime

GO-010 MUST NOT introduce production domain business logic (receipt signing, ledger persistence, mission runners, candidate evaluation, gate checks). All code created MUST reside in test/harness packages.

#### Scenario: Artifact scope verification
- GIVEN the completed GO-010 candidate
- WHEN file paths and symbols are inspected
- THEN all new code is located under test harness directories (`internal/testutil/...` or `test/harness/...`)
- AND no production business logic files are created
