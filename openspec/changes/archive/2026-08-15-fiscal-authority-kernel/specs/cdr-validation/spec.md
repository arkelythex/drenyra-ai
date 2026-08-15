# CDR Validation Specification

## Purpose

Defines CDR fiscal validation as an application-level successor composition: candidate A is the validated input, a successor mission composed from existing mission commands, gates, idempotency, and receipt primitives validates it, and success produces candidate B with a distinct approval decision and receipt boundary. No successor primitive is added to the frozen mission protocol, and no SUNAT transport or ingest surface is introduced.

## Requirements

### Requirement: Successor mission composition

CDR validation MUST consume candidate A through a successor mission composed from existing mission commands, gates, idempotency, and receipt primitives.

#### Scenario: Candidate A drives the successor mission

- GIVEN a validated candidate A
- WHEN CDR validation starts
- THEN a successor mission consumes candidate A using existing mission primitives

### Requirement: Candidate B production

Successful CDR validation MUST produce candidate B with its own identity derived from the successor result.

#### Scenario: Success produces candidate B

- GIVEN a successor mission over candidate A that completes successfully
- WHEN the CDR result is materialized
- THEN candidate B is produced with its own identity derived from the successor result

### Requirement: Distinct approval and receipt boundary

Candidate B MUST receive its own approval decision and signed receipt; candidate A's approval and receipt MUST be neither reused nor mutated.

#### Scenario: Candidate A authority is untouched

- GIVEN a successful CDR validation producing candidate B
- WHEN candidate A's approval and receipt are inspected
- THEN they are unchanged and differ from candidate B's own approval and receipt

#### Scenario: Candidate B has its own receipt

- GIVEN candidate B produced by the successor mission
- WHEN its approval boundary is inspected
- THEN candidate B has a distinct approval decision and signed receipt of its own

### Requirement: Explicit link from A to B

The link from candidate A to the successor operation and candidate B MUST be carried through application input and evidence supported by existing mission primitives; it MUST NOT extend the frozen mission protocol.

#### Scenario: Link is carried as application data

- GIVEN candidate A and the successor operation
- WHEN the successor result links to candidate B
- THEN the linkage is expressible through application input and evidence without any normative protocol extension

### Requirement: Fail-closed CDR validation

CDR validation MUST fail closed when gates block, evidence is insufficient, or idempotency or receipt checks fail; candidate B MUST NOT be created in these cases.

#### Scenario: Blocked gate prevents candidate B

- GIVEN a successor mission whose gate blocks the outcome
- WHEN CDR validation completes that mission
- THEN validation fails closed and candidate B is not created

#### Scenario: Insufficient evidence prevents candidate B

- GIVEN a successor mission with insufficient bound evidence
- WHEN CDR validation runs
- THEN validation fails closed and candidate B is not created

### Requirement: Frozen contracts preserved

The mission protocol, candidate, gate, receipt, and ledger contracts MUST remain unchanged, and their conformance vectors MUST remain green.

#### Scenario: Frozen conformance suites stay green

- GIVEN the frozen mission, candidate, gate, receipt, and ledger conformance suites
- WHEN they run under `bun run test` after CDR composition is introduced
- THEN every conformance vector passes unchanged

### Requirement: No SUNAT transport

CDR validation MUST complete without a SUNAT submission transport or an ingest surface; transport and ingestion are deferred to later programs.

#### Scenario: CDR validation needs no transport

- GIVEN a complete CDR validation run over candidate A
- WHEN the flow executes
- THEN it completes within the library layer without a SUNAT transport or ingest module

### Requirement: CDR validation test coverage

The implementation MUST include deterministic tests proving the successor mission lifecycle conformance, that candidate A's authority is unchanged after candidate B is created, that candidate B exists only with its own approval and receipt, and that fail-closed paths produce no candidate B.

#### Scenario: CDR suite is regression-proven

- GIVEN the CDR validation test suite
- WHEN it runs under `bun run test`
- THEN every composition, boundary, and fail-closed scenario passes
