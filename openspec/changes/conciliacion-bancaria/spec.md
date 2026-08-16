# Bank Reconciliation Specification

## Purpose

Defines the deterministic bank-reconciliation engine, a pure library module that normalizes bank-statement rows and ledger movements into one canonical movement shape, matches them, classifies differences, generates adjustment drafts, and compiles an executive reconciliation report. Every monetary value is BigInt cents, every operation is scoped to one RUC and one fiscal period, and unclassified differences never silently produce adjustments. The engine is the deterministic core the monthly-close workflow calls; adapters, mission wiring, and signed receipts are out of scope for this slice.

## Requirements

### Requirement: Canonical movement normalization

Bank-statement rows and ledger movements MUST normalize into one canonical movement shape carrying a date, a reference, an amount in BigInt cents, a side, and a source; any row that cannot be normalized MUST be rejected fail-closed rather than skipped.

#### Scenario: Bank row normalizes to a canonical movement

- GIVEN a bank-statement row with a date, reference, amount, side, and bank source
- WHEN the row is normalized
- THEN a canonical movement with that date, reference, BigInt-cent amount, side, and source is produced

#### Scenario: Ledger movement normalizes to the same shape

- GIVEN a ledger movement with a date, reference, amount, side, and ledger source
- WHEN the movement is normalized
- THEN a canonical movement with the same field set is produced, indistinguishable in shape from a bank-derived movement

#### Scenario: Unparseable row is rejected

- GIVEN a row whose amount, date, or side cannot be parsed into the canonical shape
- WHEN normalization is attempted
- THEN the row is rejected and no canonical movement is produced

### Requirement: BigInt-cent amounts

All monetary values MUST be integer cents represented as BigInt; float or fractional-cent amounts MUST be rejected fail-closed.

#### Scenario: BigInt cents are accepted

- GIVEN a movement with amount `100n` (integer cents)
- WHEN the movement is normalized or processed
- THEN the amount is accepted as integer cents

#### Scenario: Fractional cents are rejected

- GIVEN a movement with amount `100.5` or any non-integer cent representation
- WHEN the movement is processed
- THEN the movement is rejected

### Requirement: RUC and fiscal-period scope

Every engine operation MUST be scoped to exactly one RUC and one fiscal period; a call that omits, mixes, or crosses RUC scopes MUST be rejected, and no movement or result from one RUC MAY be observable to another.

#### Scenario: Matching within one RUC and period

- GIVEN bank rows and ledger movements for the same RUC and fiscal period
- WHEN reconciliation is invoked for that RUC and period
- THEN only movements within that scope are matched and classified

#### Scenario: Cross-RUC access is rejected

- GIVEN an operation carrying movements or results for more than one RUC
- WHEN the operation is invoked
- THEN the operation is rejected fail-closed

### Requirement: Reference-first matching

Reconciliation MUST match bank movements to ledger movements by reference first, and MUST classify every movement as `matched`, `bank-only`, or `ledger-only`.

#### Scenario: Reference match is found

- GIVEN a bank movement and a ledger movement sharing the same reference within the same RUC and period
- WHEN reconciliation matches them
- THEN both movements are classified `matched`

#### Scenario: Bank movement without matching ledger reference

- GIVEN a bank movement whose reference has no corresponding ledger movement
- WHEN reconciliation classifies it
- THEN the bank movement is classified `bank-only`

#### Scenario: Ledger movement without matching bank reference

- GIVEN a ledger movement whose reference has no corresponding bank movement
- WHEN reconciliation classifies it
- THEN the ledger movement is classified `ledger-only`

### Requirement: Amount-and-date fallback matching

Movements with no matching reference MUST fall back to exact amount plus same-day date matching; a match MUST NOT be claimed on amount alone or on date alone, bounding the fallback to avoid false positives.

#### Scenario: Exact amount on the same day matches

- GIVEN a bank movement and a ledger movement with no matching references but identical BigInt-cent amounts on the same date
- WHEN the fallback matcher runs
- THEN both movements are matched

#### Scenario: Same amount on different days does not match

- GIVEN a bank movement and a ledger movement with identical amounts on different dates and no matching references
- WHEN the fallback matcher runs
- THEN neither movement is matched and both remain in their difference classification

#### Scenario: Same-day different amount does not match

- GIVEN a bank movement and a ledger movement on the same date with different amounts and no matching references
- WHEN the fallback matcher runs
- THEN neither movement is matched

### Requirement: Fail-closed adjustment drafts

`buildAdjustments()` MUST produce adjustment drafts only from classified differences; each draft MUST carry a debit or credit in BigInt cents, a justification, and a `requireApproval` flag, and an unclassified difference MUST NOT produce any adjustment.

#### Scenario: Classified difference yields a justified draft

- GIVEN a classified `bank-only` or `ledger-only` difference of `250n` cents
- WHEN adjustment drafts are built
- THEN a draft with a debit or credit of `250n` cents, a justification, and `requireApproval: true` is produced

#### Scenario: Unclassified difference produces no adjustment

- GIVEN a difference that cannot be classified as matched, bank-only, or ledger-only
- WHEN adjustment drafts are built
- THEN no adjustment is produced and the difference surfaces as a blocker

### Requirement: Executive reconciliation report

`buildReport()` MUST compile an executive report containing initial and final balances for both bank and ledger, the full difference detail, and each adjustment with its impact on the reconciled balance.

#### Scenario: Report balances and differences

- GIVEN a completed reconciliation with balances and classified differences for one RUC and period
- WHEN the report is built
- THEN the report states the initial and final bank and ledger balances, lists every difference with its classification, and lists every adjustment with its impact on the reconciled balance

#### Scenario: Report fails closed without scope

- GIVEN an attempt to build a report without a single RUC and fiscal period
- WHEN the report is requested
- THEN no report is produced and the attempt is rejected

### Requirement: Skill registry entry

The `pe.conciliacion-bancaria` skill MUST ship in `BASE_PE_SKILLS` and MUST conform to the sibling authoring manifest `drenyra-skills/skills/registry.json`; the `skills:conformance` check MUST pass.

#### Scenario: Registry entry matches the manifest

- GIVEN the `pe.conciliacion-bancaria` entry in `BASE_PE_SKILLS` and the sibling registry manifest
- WHEN conformance is checked
- THEN the entry matches the manifest on id, version, jurisdiction, maxAutonomy, normative sources, inputs, and outputs

#### Scenario: Drift fails conformance

- GIVEN a `pe.conciliacion-bancaria` entry that drifts from the sibling manifest
- WHEN conformance is checked
- THEN the check fails and the drift is reported
