# Native Go Runtime Constitution Specification

## Purpose

This specification establishes the bounded GO-000 constitution for the Drenyra AI native Go migration. It preserves the frozen, transport-independent fiscal contract surface, defines the temporary TypeScript oracle and compatibility boundary, and constrains the ordered GO-010 through GO-100 program. GO-000 changes governance only; it does not implement a runtime or alter runtime behavior.

## Requirements

### Requirement: GO-000 remains a bounded governance work unit

GO-000 MUST update only the approved OpenSpec governance configuration and the minimal auditable program documentation needed to govern the migration. The work MUST be bound to Master issue #80 and approved work-unit issue #81. It MUST preserve unrelated OpenSpec state.

#### Scenario: Approved GO-000 changes are applied

- GIVEN GO-000 is being applied
- WHEN the resulting change is reviewed
- THEN its changed configuration fields and documentation are limited to the approved constitutional, delivery-control, and migration-program boundary
- AND the change identifies issues #80 and #81
- AND unrelated OpenSpec changes remain byte-for-byte and semantically unaffected

#### Scenario: A prohibited change is proposed

- GIVEN GO-000 is the active work unit
- WHEN a proposed change adds runtime code, runtime behavior, or unrelated repository state
- THEN the proposal MUST be rejected as outside the GO-000 boundary

### Requirement: The executable target and contract surface are language-independent

The system MUST define compatibility by the frozen, transport-independent fiscal contracts, conformance evidence, and observable deterministic behavior rather than by TypeScript module structure or broad JavaScript export shape. The target executable implementation MUST be a deterministic native Go runtime with explicit adapters and no transport-specific authority in the core.

#### Scenario: A later implementation is assessed for compatibility

- GIVEN a native implementation is compared with the current system
- WHEN compatibility is evaluated
- THEN the comparison uses the frozen contract surface and deterministic observable behavior
- AND TypeScript-specific module layout is not treated as normative

#### Scenario: An adapter or transport is evaluated

- GIVEN a transport or adapter is introduced in a later work unit
- WHEN its authority boundary is reviewed
- THEN the transport-independent fiscal core remains the governing behavior
- AND the adapter MUST NOT redefine the frozen contracts or fiscal authority

### Requirement: Frozen contracts and byte behavior are protected

`contracts/**`, including schemas, fixtures, and conformance vectors, MUST be read-only during this program unless a separate approved contract-change SDD explicitly authorizes contract versioning and migration. Canonicalization MUST remain shallow and top-level. Hashing, serialization, candidate identity, receipts, and comparison evidence MUST preserve exact frozen byte behavior. A contract mismatch MUST fail closed and MUST NOT be resolved by editing `contracts/**` within GO-000.

#### Scenario: A migration implementation differs from a frozen contract

- GIVEN a contract, fixture, or conformance vector under `contracts/**` is the comparison input
- WHEN a mismatch is detected
- THEN the mismatch is reported as a blocker or contract-regime decision
- AND no `contracts/**` file is modified by GO-000

#### Scenario: Canonicalization is evaluated

- GIVEN equivalent-looking nested input is processed
- WHEN canonicalization is applied
- THEN only the specified shallow top-level behavior is used
- AND recursive, deep, or convenience normalization is not accepted as compatible behavior

#### Scenario: Deterministic identity is compared

- GIVEN two implementations process the same frozen input
- WHEN their serialized identity, hash, candidate identity, or receipt evidence is compared
- THEN the comparison is byte-exact and any byte drift fails the applicable gate

### Requirement: Fiscal authority invariants remain exact and fail closed

Monetary values MUST use exact integer cents with BigInt-safe semantics; floating-point money behavior is prohibited. A complete bound scope MUST include tenant, organization, company, fiscalPeriod, ledgerBook, operationType, sourceSnapshot, policyVersion, actor, and authorityLevel. Company/RUC and fiscal-period values MUST be validated and isolated. Material action MUST require its immutable receipt first. Gates and approvals MUST fail closed on missing, incomplete, mismatched, or changed evidence. Audit records MUST be append-only and preserve required actor, reason, RUC/company, period, and ordering evidence. Forecasts, adapters, diagnostics, and migration harnesses MUST remain non-authoritative.

#### Scenario: Monetary values are processed

- GIVEN a monetary value enters a fiscal calculation or comparison
- WHEN the value is represented or serialized
- THEN it is represented as exact integer cents with BigInt-safe semantics
- AND no floating-point value is used as fiscal authority

#### Scenario: Scope is missing or changes

- GIVEN a material operation has a missing, incomplete, mismatched, or changed bound scope
- WHEN the operation reaches a gate or approval
- THEN the gate MUST fail closed
- AND no material action or authorization is performed

#### Scenario: Receipt ordering is checked

- GIVEN a material action is requested
- WHEN the action is evaluated
- THEN an immutable valid receipt MUST exist before the action
- AND the action MUST NOT occur when the receipt is absent or invalid

#### Scenario: Audit history is updated

- GIVEN an auditable event is accepted
- WHEN its audit record is written
- THEN the record is appended without modifying or deleting prior records
- AND the required authority and ordering evidence is retained

### Requirement: TS 0.5.0 is an oracle only and JavaScript remains temporary

TypeScript 0.5.0 MUST be treated as a temporary behavioral oracle for migration harnesses and differential evidence only. A production Go runtime MUST NOT import TypeScript artifacts, execute Node/TypeScript on its behalf, or discover the oracle through PATH, aliases, global installations, or ambient environment state. Existing JavaScript exports and the TS 0.5.0 CLI MUST remain available as temporary compatibility surfaces. GO-000 MUST NOT retire, version, or alter their runtime behavior.

#### Scenario: Differential evidence uses the oracle

- GIVEN a migration harness needs reference behavior
- WHEN it invokes the oracle
- THEN it identifies the TS 0.5.0 oracle explicitly and uses its result only as migration evidence
- AND the evidence does not grant production mutation authority

#### Scenario: A native runtime is operated independently

- GIVEN the native Go runtime is built or executed
- WHEN its dependencies and executable discovery are inspected
- THEN no TypeScript or Node execution, PATH lookup, alias, global installation, or ambient fallback is required or used

#### Scenario: Compatibility retirement is considered

- GIVEN a request removes an existing JavaScript export or TS CLI surface
- WHEN the request is assigned to a work unit
- THEN it is deferred to GO-100 or a separately approved change with migration and rollback evidence

### Requirement: The migration program follows ordered work-unit boundaries

The migration MUST follow these boundaries in order: GO-010 harness-only; GO-020 native Go skeleton; GO-030 through GO-070 staged parity; GO-080 native release; GO-090 Pi integration; and GO-100 compatibility retirement. A later work unit MUST NOT claim an earlier exit gate, pull later integration concerns forward, or advance when a required predecessor gate fails.

#### Scenario: GO-010 is planned or reviewed

- GIVEN GO-010 is the active work unit
- WHEN its scope is assessed
- THEN it is limited to fixture/oracle capture, deterministic invocation and comparison, mismatch diagnostics, staged parity criteria, and at least one sentinel/reference comparison
- AND it does not require a production Go runtime or claim full parity

#### Scenario: GO-020 and staged parity are planned

- GIVEN GO-020 through GO-070 are being sequenced
- WHEN a work unit is authorized
- THEN GO-020 owns the native Go skeleton and transport-independent package/runtime shape
- AND GO-030 through GO-070 own only their assigned staged parity evidence
- AND each work unit depends on the constitutional and evidence gates of its predecessors

#### Scenario: Release, Pi integration, and retirement are evaluated

- GIVEN a later work unit is proposed
- WHEN its boundary is checked
- THEN GO-080 owns release evidence only after applicable GO-030 through GO-070 parity gates pass
- AND GO-090 owns Pi integration only after the released native identity/provenance boundary exists
- AND GO-100 owns retirement only after approved compatibility, migration, and rollback criteria exist

### Requirement: Pi consumption is reserved for GO-090 and is exact and package-local

Drenyra AI MUST remain independent of Drenyra Pi, and Drenyra Pi MUST remain TypeScript. GO-000 MUST NOT edit Pi or implement integration. The constitution MUST require GO-090 to consume the native runtime using an exact, verified, package-local identity and provenance. PATH, global, alias-based, ambient, or unverified executable discovery MUST never be an allowed fallback.

#### Scenario: GO-000 is applied

- GIVEN GO-000 changes are reviewed
- WHEN Pi-related files or integration behavior are inspected
- THEN no Pi implementation, Pi configuration, or integration behavior is changed
- AND the GO-090 boundary is documented as the sole owner of Pi consumption

#### Scenario: GO-090 consumption is verified

- GIVEN GO-090 is the active integration work unit
- WHEN Pi invokes the native runtime
- THEN the selected executable identity and provenance are verified against the approved package-local target
- AND execution fails closed if exact package-local verification cannot be established
- AND no PATH, global, alias, or ambient fallback is attempted

### Requirement: Repository governance records delivery and evidence truthfully

The bounded configuration update MUST set the supported delivery strategy to `auto-chain`, retain automatic execution, `strict_tdd: true`, the 300 authored changed-line review budget, and `feature-branch-chain` for chained downstream work. Existing Bun/Vitest test, typecheck, and build commands MUST be classified as legacy TS-oracle evidence. Future Go test, typecheck, and build commands MUST be marked unavailable until a Go-bearing work unit establishes and verifies them. GO-000 MUST NOT fabricate Go evidence.

#### Scenario: Configuration is reviewed after GO-000 APPLY

- GIVEN `openspec/config.yaml` has been updated by GO-000
- WHEN its delivery and testing controls are inspected
- THEN `auto-chain`, automatic execution, strict TDD, the 300-line budget, and feature-branch-chain are present as approved controls
- AND unsupported `auto-forecast` is not the configured delivery strategy

#### Scenario: Current commands are used as evidence

- GIVEN a reviewer sees the current Bun/Vitest, typecheck, or build command
- WHEN the command's evidentiary role is assessed
- THEN it is labeled legacy TS-oracle evidence
- AND it is not presented as proof of an established Go toolchain

#### Scenario: Go commands are not yet established

- GIVEN no Go-bearing work unit has established and verified a Go command
- WHEN future Go verification is described
- THEN the corresponding command is recorded as unavailable or not established
- AND no successful Go test, typecheck, or build result is claimed

### Requirement: GO-000 has bounded rollback and explicit prohibitions

Rollback MUST revert only the GO-000 configuration fields and minimal program documentation, restore their prior values, and preserve unrelated OpenSpec state. Rollback MUST leave contracts, runtime behavior, TS 0.5.0, JavaScript exports, and Drenyra Pi unchanged. GO-000 MUST explicitly prohibit Go runtime code, frozen-contract edits, JavaScript retirement, Pi edits, and runtime behavior changes.

#### Scenario: GO-000 rollback is required

- GIVEN the constitutional governance update must be withdrawn
- WHEN rollback is performed
- THEN only the bounded GO-000 configuration/documentation delta is reverted
- AND unrelated concurrent OpenSpec state is preserved
- AND no frozen contract, executable, runtime, export, or Pi behavior is changed

#### Scenario: A GO-000 patch contains prohibited content

- GIVEN a GO-000 candidate is prepared
- WHEN its files and behavior are inspected
- THEN any Go runtime source, contract edit, JS retirement, Pi edit, or runtime behavior change causes the candidate to fail the GO-000 acceptance gate

### Requirement: GO-000 acceptance is evidence-based and does not claim migration completion

GO-000 MUST be accepted only when reviewers can verify the issue binding, constitutional requirements, fiscal invariants, oracle and compatibility boundaries, ordered work units, truthful repository controls, bounded rollback, and preservation of unrelated state. Acceptance MUST NOT be interpreted as GO-010 harness completion, native Go parity, release, Pi integration, or TypeScript retirement.

#### Scenario: The GO-000 exit review is performed

- GIVEN the configuration and minimal program documentation are complete
- WHEN the exit review checks the specification and applied delta
- THEN every GO-000 requirement has testable evidence or an explicit unavailable future-Go status
- AND no later migration outcome is claimed
- AND the next authorized work is the separately governed predecessor-dependent phase
