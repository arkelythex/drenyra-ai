# Evidence Specification

## Purpose

Defines the provenance-bearing evidence lifecycle: canonical identity produced by the existing receipt hash primitive, immutable identity and provenance, and fail-closed rejection of incomplete, malformed, or memory-shaped input. Memory remains advisory and can never satisfy an evidence requirement.

## Requirements

### Requirement: Canonical evidence identity

Every accepted evidence item MUST have a canonical identity computed by the existing receipt primitive (`computeEvidenceHash` over `EvidenceItem`), and that identity MUST equal the canonical receipt result for the same evidence content.

#### Scenario: Identity matches canonical receipt hash

- GIVEN an evidence item with valid identity and provenance
- WHEN its canonical identity is computed through the existing receipt primitive
- THEN the result equals `computeEvidenceHash` over the corresponding `EvidenceItem`

#### Scenario: Same content, same identity

- GIVEN two evidence items with identical content and provenance
- WHEN their canonical identities are computed
- THEN the identities are equal

### Requirement: Provenance requirement

Evidence acceptance MUST require provenance that is present and valid; evidence with missing or malformed provenance MUST be rejected.

#### Scenario: Missing provenance fails closed

- GIVEN evidence content with no provenance
- WHEN acceptance is attempted
- THEN the evidence is rejected and nothing is accepted

#### Scenario: Malformed provenance fails closed

- GIVEN evidence whose provenance is structurally invalid
- WHEN acceptance is attempted
- THEN the evidence is rejected

### Requirement: Fail-closed acceptance

Evidence missing identity or provenance, malformed, or memory-shaped MUST be rejected, and rejection MUST NOT produce partial acceptance, a partially valid artifact, or any authoritative output.

#### Scenario: Rejection produces no artifact

- GIVEN evidence that is missing provenance
- WHEN acceptance is attempted
- THEN no evidence artifact is produced and no downstream binding is possible

### Requirement: Immutable identity and provenance

Accepted evidence identity and provenance MUST be immutable; any change to the evidence content MUST yield a new identity rather than an in-place mutation of the accepted artifact.

#### Scenario: Content change yields new identity

- GIVEN an accepted evidence item with identity H1
- WHEN its content is changed and re-validated
- THEN the re-validated item has identity H2 ≠ H1 and the original item with H1 remains unchanged

### Requirement: Memory is never evidence

No evidence requirement MAY be satisfied by advisory or memory-shaped output; the evidence acceptance surface MUST reject memory-shaped input fail-closed.

#### Scenario: Memory-shaped input is rejected

- GIVEN input that is advisory or memory-shaped rather than a canonical evidence artifact
- WHEN acceptance is attempted
- THEN the input is rejected and no evidence requirement is satisfied by it

### Requirement: Composition without contract change

Accepted evidence MUST be usable to bind journal entries and candidate subjects without modifying the frozen receipt contract or its conformance vectors.

#### Scenario: Evidence binds downstream artifacts

- GIVEN an accepted evidence item
- WHEN it is bound to a journal entry or a candidate subject
- THEN the binding succeeds using only existing receipt primitives and the receipt contract remains unchanged

### Requirement: Evidence test coverage

The implementation MUST include deterministic tests proving canonical-hash equality, memory-shape rejection, missing and malformed provenance rejection, and identity immutability.

#### Scenario: Evidence suite is regression-proven

- GIVEN the evidence test suite
- WHEN it runs under `bun run test`
- THEN every acceptance, rejection, and immutability scenario passes
