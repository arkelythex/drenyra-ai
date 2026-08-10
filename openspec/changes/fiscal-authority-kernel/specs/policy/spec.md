# Policy Specification

## Purpose

Defines the PE-only restriction surface that constrains journal and CDR outcomes. Policy restricts permitted outcomes; it never grants authority. Unsupported jurisdictions or insufficient evidence fail closed rather than auto-accepting.

## Requirements

### Requirement: PE jurisdiction only

Policy evaluation MUST apply the PE (Peru) jurisdiction rules, and a non-PE jurisdiction MUST NOT be auto-accepted.

#### Scenario: PE jurisdiction is evaluated

- GIVEN a fiscal outcome in the PE jurisdiction with valid input
- WHEN policy evaluation runs
- THEN the PE restriction rules apply

#### Scenario: Non-PE jurisdiction is not auto-accepted

- GIVEN a fiscal outcome outside the PE jurisdiction
- WHEN policy evaluation runs
- THEN the outcome is not auto-accepted and fails closed

### Requirement: Restriction of journal and CDR outcomes

Policy MUST restrict automatic journal transitions and CDR validation outcomes, and restrictions MUST be enforced before the outcome is produced.

#### Scenario: Journal outcome above threshold is restricted

- GIVEN a journal transition whose materiality exceeds the PE threshold
- WHEN policy is applied
- THEN the automatic transition is blocked or escalated, never silently permitted

#### Scenario: CDR outcome is restricted before production

- GIVEN a CDR validation outcome that policy restricts
- WHEN policy is applied
- THEN the restricted outcome is blocked before any approval or receipt is produced

### Requirement: Fail-closed on insufficient authority

When evidence or authority is insufficient, policy MUST block or escalate the outcome; it MUST NOT auto-accept.

#### Scenario: Insufficient evidence blocks auto-accept

- GIVEN a fiscal outcome with insufficient bound evidence
- WHEN policy is applied
- THEN the outcome is blocked or escalated and no auto-accept occurs

### Requirement: No multi-jurisdiction engine

The policy surface MUST NOT silently treat an unknown jurisdiction as PE; an unsupported jurisdiction MUST fail closed.

#### Scenario: Unknown jurisdiction fails closed

- GIVEN a fiscal outcome whose jurisdiction is unsupported
- WHEN policy is applied
- THEN the outcome fails closed and is never treated as PE by default

### Requirement: Policy test coverage

The implementation MUST include deterministic tests proving the PE acceptance path, non-PE rejection, escalation on insufficient evidence, and unknown-jurisdiction fail-closed behavior.

#### Scenario: Policy suite is regression-proven

- GIVEN the policy test suite
- WHEN it runs under `bun run test`
- THEN every restriction, escalation, and fail-closed scenario passes
