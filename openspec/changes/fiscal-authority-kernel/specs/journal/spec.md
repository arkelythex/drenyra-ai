# Journal Specification

## Purpose

Defines the module that is the sole owner of accounting entries. Entries use BigInt cents only, balance, bind a validated tenant scope and accepted evidence, produce signed receipts for material actions, correct by explicit superseding or revoking (never in-place mutation), and keep journal status independent from mission, submission, and other fiscal statuses. The audit ledger may chain receipts produced by journal actions but never owns or mutates entries.

## Requirements

### Requirement: BigInt-cent amounts

Entry amounts MUST be integer cents represented as BigInt; number-typed or fractional-cent amounts MUST be rejected fail-closed.

#### Scenario: Fractional cent is rejected

- GIVEN an entry line with amount `0.01` cents or any non-integer representation
- WHEN the entry is submitted for recording
- THEN the entry is rejected

#### Scenario: BigInt cents are accepted

- GIVEN an entry line with amount `100n` (integer cents)
- WHEN the entry is submitted for recording
- THEN the amount is accepted as integer cents

### Requirement: Balanced entries

An entry containing debits and credits MUST be recorded only when the sum of debits equals the sum of credits; an unbalanced entry MUST be rejected.

#### Scenario: Balanced entry is recorded

- GIVEN a valid entry with debits totaling `500n` and credits totaling `500n`
- WHEN the entry is submitted for recording
- THEN the entry is recorded

#### Scenario: Unbalanced entry is rejected

- GIVEN a valid entry with debits totaling `500n` and credits totaling `400n`
- WHEN the entry is submitted for recording
- THEN the entry is rejected and no entry state is created

### Requirement: Entry binding

Every entry MUST bind a validated tenant scope and at least one accepted evidence artifact; an entry without scope or without evidence MUST be rejected.

#### Scenario: Entry without evidence is rejected

- GIVEN a balanced BigInt-cents entry with a valid scope but no bound evidence
- WHEN the entry is submitted for recording
- THEN the entry is rejected

#### Scenario: Entry outside valid scope is rejected

- GIVEN a balanced BigInt-cents entry with evidence but a scope that fails validation
- WHEN the entry is submitted for recording
- THEN the entry is rejected

### Requirement: Journal owns entries

Only the journal MAY record, transition, or correct accounting entries; no other surface, including the audit ledger, MAY own, store, or mutate entries.

#### Scenario: Ledger does not own entries

- GIVEN a receipt produced by a journal action
- WHEN the audit ledger chains that receipt
- THEN the ledger records only the receipt and holds no accounting-entry state

### Requirement: Receipts for material actions

Posting, superseding, and revoking an entry MUST produce a signed receipt; no material journal change MAY occur without one.

#### Scenario: Posting produces a signed receipt

- GIVEN a valid balanced entry bound to scope and evidence
- WHEN the entry is posted
- THEN a signed receipt for the posting is produced

#### Scenario: Material change without receipt is impossible

- GIVEN an entry transition attempt that would change journal state
- WHEN no signed receipt can be produced
- THEN the transition fails and journal state is unchanged

### Requirement: Explicit corrections

Correction MUST be modeled as superseding or revoking an existing entry with a new entry; in-place mutation of a recorded entry MUST NOT occur.

#### Scenario: Supersede creates a new entry

- GIVEN a recorded entry E1
- WHEN E1 is superseded
- THEN a new entry E2 records the correction, E1 remains unchanged, and a signed receipt is produced

#### Scenario: In-place mutation is rejected

- GIVEN a recorded entry
- WHEN an attempt is made to modify its recorded amounts directly
- THEN the attempt fails and the recorded entry is unchanged

### Requirement: Independent statuses

Journal status MUST transition only through explicit journal transitions, and it MUST be neither driven by nor implicitly driving mission, submission, or other fiscal statuses.

#### Scenario: Journal transitions without fiscal status change

- GIVEN a posted journal entry whose fiscal workflow status is pending
- WHEN the journal status transitions independently
- THEN the fiscal status remains unchanged

#### Scenario: Fiscal status changes without journal status change

- GIVEN a journal entry whose fiscal workflow status transitions
- WHEN the journal status is not explicitly transitioned
- THEN the journal status remains unchanged

### Requirement: Ledger remains audit-only

Receipts produced by journal actions MAY be chained by the audit ledger; the ledger MUST NOT own, store, or mutate journal entries, and the ledger MUST reject entry-shaped payloads.

#### Scenario: Ledger rejects entry payloads

- GIVEN a payload shaped as an accounting entry rather than a receipt
- WHEN it is offered to the audit ledger
- THEN the ledger rejects it

### Requirement: Journal test coverage

The implementation MUST include deterministic tests covering fractional-cent rejection, unbalanced-entry rejection, receipt production per material action, correction immutability, and status independence in both directions.

#### Scenario: Journal suite is regression-proven

- GIVEN the journal test suite
- WHEN it runs under `bun run test`
- THEN every amount, balance, binding, receipt, correction, and independence scenario passes
