# Candidate Ordering Specification

## Purpose

Defines the application-level ordering that constructs the exact subject after deterministic core validation and reconciliation before invoking the existing candidate inspection/freeze behavior. This changes application ordering, not candidate lifecycle semantics: the existing subject identity, inspection freeze point, immutable lifecycle, and at-most-one-correction rule remain unchanged, and the frozen candidate contract and its conformance vectors are preserved.

## Requirements

### Requirement: Validation before subject construction

The fiscal flow MUST complete deterministic core validation before constructing the subject for candidate inspection; subject construction MUST NOT occur from unvalidated input.

#### Scenario: Unvalidated input cannot form a subject

- GIVEN fiscal input that has not passed core validation
- WHEN a candidate subject is requested for inspection
- THEN no subject is constructed and the flow fails closed

#### Scenario: Validated input forms the subject

- GIVEN fiscal input that has passed deterministic core validation
- WHEN the subject is constructed for inspection
- THEN construction proceeds with exactly that validated input

### Requirement: Reconciliation before freeze

The fiscal flow MUST obtain and bind reconciliation evidence before the candidate is inspected or frozen; candidate inspection MUST be unreachable without bound reconciliation evidence.

#### Scenario: Freeze is unreachable without reconciliation evidence

- GIVEN a validated subject with no bound reconciliation evidence
- WHEN the flow attempts to reach the candidate inspection/freeze point
- THEN the freeze point is unreachable and the flow fails closed

#### Scenario: Reconciliation evidence precedes inspection

- GIVEN a validated subject with bound reconciliation evidence
- WHEN the flow proceeds toward inspection
- THEN the candidate is inspected/frozen only after that evidence is bound

### Requirement: Exact subject passed to inspection

Candidate inspection/freezing MUST receive the exact subject produced from the validated and reconciled data; it MUST NOT receive a different or stale subject.

#### Scenario: Inspection receives the exact reconciled subject

- GIVEN a subject formed from validated, reconciled data with a known identity
- WHEN the candidate is inspected
- THEN the inspected subject identity matches exactly that subject, and no other subject is used

### Requirement: Premature inspection unreachable

No path through the fiscal flow MAY invoke candidate inspection before core validation and reconciliation complete; ordering tests MUST prove premature inspection is unreachable.

#### Scenario: Ordering test proves inspection ordering

- GIVEN the fiscal flow and a candidate inspection entry point
- WHEN an attempt is made to invoke inspection before validation and reconciliation
- THEN the attempt fails, and the ordering tests pass under `bun run test`

### Requirement: Frozen lifecycle preserved

The existing candidate subject identity, inspection freeze point, immutable lifecycle, and at-most-one-correction rule MUST remain unchanged; the frozen candidate conformance suites MUST remain green without addendum or version bump.

#### Scenario: Frozen conformance suite stays green

- GIVEN the existing frozen candidate conformance suite
- WHEN it runs under `bun run test` after the ordering adapter is introduced
- THEN every conformance vector passes unchanged

#### Scenario: Correction budget is unchanged

- GIVEN a candidate created through the fiscal flow that requires correction
- WHEN the existing correction path is used
- THEN the at-most-one-correction rule applies exactly as in the frozen lifecycle

### Requirement: No dependency on ingest or transport

The candidate ordering flow MUST complete without an ingest module or a SUNAT submission transport; those surfaces are deferred and MUST NOT be required for the flow.

#### Scenario: Flow completes within the library layer

- GIVEN a complete candidate ordering run
- WHEN the flow executes
- THEN it completes using only library-level composition and existing candidate primitives, with no ingest or transport dependency

### Requirement: Candidate ordering test coverage

The implementation MUST include deterministic tests proving that freeze is unreachable without validation and reconciliation, that inspection receives the exact validated and reconciled subject, and that the frozen candidate conformance suite remains unchanged.

#### Scenario: Ordering suite is regression-proven

- GIVEN the candidate ordering test suite
- WHEN it runs under `bun run test`
- THEN every ordering, exactness, and frozen-preservation scenario passes
