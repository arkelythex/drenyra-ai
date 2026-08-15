# Tenant Scope Specification

## Purpose

Defines fiscal scope identity — company, 11-digit RUC, and `YYYYMM` fiscal period — and the fail-closed isolation boundary for all fiscal artifacts. Tenant scope is the authority for isolation: every fiscal artifact is bound to exactly one scope, and any read across scopes fails closed without revealing whether the target artifact exists.

## Requirements

### Requirement: Fiscal scope identity

A fiscal scope MUST consist of a company identifier, an 11-digit numeric RUC, and a `YYYYMM` fiscal period.

#### Scenario: Valid scope is accepted

- GIVEN a company identifier `"ACME"`, an 11-digit RUC `"20123456789"`, and a period `"202603"`
- WHEN the scope is validated
- THEN the scope is accepted and usable to bind fiscal artifacts

#### Scenario: Non-numeric RUC is rejected

- GIVEN a RUC containing a non-digit character, e.g. `"2012345678X"`
- WHEN the scope is validated
- THEN validation fails closed and no scope is produced

### Requirement: Scope validation is fail-closed

Scope validation MUST reject any scope whose RUC is not exactly 11 digits, whose period is not `YYYYMM` with a valid month 01-12, or whose company identifier is empty, and MUST NOT partially accept such a scope.

#### Scenario: RUC length boundaries

- GIVEN a RUC with 10 digits `"2012345678"` or 12 digits `"201234567890"`
- WHEN the scope is validated
- THEN the scope is rejected

#### Scenario: Invalid period

- GIVEN a period `"202613"` (month 13) or `"20261"` (five characters)
- WHEN the scope is validated
- THEN the scope is rejected

#### Scenario: Empty company identifier

- GIVEN a company identifier that is empty or whitespace only
- WHEN the scope is validated
- THEN the scope is rejected

### Requirement: Cross-tenant isolation on reads

A fiscal read bound to scope S MUST fail closed when the requested artifact belongs to a different scope T, and MUST NOT reveal whether that artifact exists: the outcome MUST be identical whether the artifact exists in scope T or does not exist at all.

#### Scenario: Existence does not leak across scopes

- GIVEN an artifact belonging to scope T and a read request bound to scope S, where S and T differ
- WHEN the read is attempted
- THEN the read fails closed

#### Scenario: Missing artifact is indistinguishable from foreign artifact

- GIVEN a read bound to scope S
- WHEN the requested artifact is absent from S but present in T, or absent everywhere
- THEN the outcome is identical in both cases, revealing no existence information about T

### Requirement: Deterministic scope identity

Scopes with identical components MUST be equal and interchangeable, and scopes differing in any component MUST be distinct; scope equality MUST be deterministic across evaluations.

#### Scenario: Equal scopes compare equal

- GIVEN two scopes with identical company, RUC, and period
- WHEN equality is evaluated
- THEN they are equal

#### Scenario: Any component difference distinguishes scopes

- GIVEN two scopes that differ only in period
- WHEN equality is evaluated
- THEN they are distinct

### Requirement: Tenant scope test coverage

The implementation MUST include deterministic tests covering RUC boundary cases (9, 10, 11, 12 digits, non-numeric), period validation, cross-tenant read isolation, and scope equality.

#### Scenario: Isolation and validation are regression-proven

- GIVEN the tenant scope test suite
- WHEN it runs under `bun run test`
- THEN every boundary, fail-closed rejection, and isolation scenario passes
