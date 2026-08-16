# Declaración Anual Specification

## Purpose

Defines the deterministic annual tax-declaration engine, a pure library module that computes the Peruvian annual income-tax settlement (cierre fiscal definitivo): the determination of annual net income from the closed monthly periods and the explicit statutory adjustments, the annual ISR liability for legal entities (configurable statutory rate with a 2950 bp default per the LIR), the credit for the cumulative provisional payments (pagos a cuenta), the resulting balance payable or in favor, the year-end closing of result accounts to retained earnings (PCGE 59), and a structured declaration payload plus a post-settlement report. Every monetary value is BigInt cents, every operation is scoped to one RUC and one fiscal year (period form YYYY), every produced journal entry is balanced (sum of debits equals sum of credits), and unprocessable or incomplete inputs are rejected fail-closed with a typed error. The engine composes over the SDD-CON-002 close primitives (`closeResultAccounts`, ISR helpers) without modifying frozen contracts or existing modules, and is the deterministic core that a future SUNAT DJ adapter consumes; SUNAT wiring, CDR handling, and FSD `declaracion` mission/gate orchestration are out of scope for this slice.

## Requirements

### Requirement: Annual scope isolation (one RUC, one fiscal year)

Every annual engine operation MUST be scoped to exactly one RUC (11 digits) and one fiscal year (period form `YYYY`); a call that omits or invalidates the scope MUST be rejected (`INVALID_SCOPE`), and inputs that mix cédulas, periods, or movements from more than one RUC MUST be rejected fail-closed (`CROSS_RUC_ACCESS`) with nothing computed.

#### Scenario: Valid annual scope is accepted

- GIVEN an operation with an 11-digit RUC and a valid fiscal year `2025`
- WHEN the operation is invoked
- THEN the scope is accepted and the computation proceeds for that RUC and year only

#### Scenario: Malformed scope is rejected

- GIVEN an operation with a malformed RUC (not 11 digits) or a period that is not a `YYYY` fiscal year
- WHEN the operation is invoked
- THEN the operation is rejected with `INVALID_SCOPE` and no amount or entry is produced

#### Scenario: Cross-RUC input is rejected

- GIVEN an annual operation whose inputs include monthly cédulas or periods belonging to two different RUCs
- WHEN the operation is invoked
- THEN the operation is rejected with `CROSS_RUC_ACCESS` and no movement from one RUC is observable to the other

### Requirement: Annual net income determination

`determineAnnualNetIncome()` MUST compute the annual net income for the fiscal year as the BigInt-exact sum of the net incomes of the closed monthly periods plus the explicit statutory additions minus the statutory deductions supplied as inputs; an input set that is incomplete — a missing month, a monthly period that is not closed, or absent statutory adjustment inputs — MUST be rejected fail-closed (`INCOMPLETE_INPUT`) and MUST NEVER produce a partial or estimated amount.

#### Scenario: Annual net income is determined from closed months and adjustments

- GIVEN twelve closed monthly periods whose net incomes sum to `12_000_000n` cents, statutory additions of `500_000n` cents, and statutory deductions of `200_000n` cents for fiscal year `2025`
- WHEN `determineAnnualNetIncome()` is invoked
- THEN the annual net income is `12_300_000n` cents (`12_000_000n + 500_000n − 200_000n`) with no rounding applied

#### Scenario: Incomplete monthly input is blocked

- GIVEN only eleven closed monthly periods for the fiscal year (one month missing)
- WHEN `determineAnnualNetIncome()` is invoked
- THEN the determination is rejected with `INCOMPLETE_INPUT` and no annual net income is produced

#### Scenario: Unclosed monthly period is blocked

- GIVEN an input set where one monthly period is present but not closed
- WHEN `determineAnnualNetIncome()` is invoked
- THEN the determination is rejected with `INCOMPLETE_INPUT` and no amount is produced from partial data

### Requirement: Annual ISR liability (configurable statutory rate)

`computeAnnualIsr()` MUST compute the annual ISR liability for legal entities as the BigInt floor of `taxableBaseCents * statutoryRateBp / 10000`, where `statutoryRateBp` comes from the policy input and defaults to `2950` bp (29.5%, LIR legal-entity rate) when absent; a rate outside the legal envelope configured in the policy MUST be rejected (`RATE_OUT_OF_BOUNDS`) and a negative taxable base MUST be rejected (`NEGATIVE_AMOUNT`).

#### Scenario: Default statutory rate is applied

- GIVEN an annual taxable base of `10_000_000n` cents and a policy with no statutory rate
- WHEN `computeAnnualIsr()` is invoked
- THEN the annual ISR liability is `2_950_000n` cents (2950 bp applied to the base)

#### Scenario: Configured statutory rate is applied with documented rounding

- GIVEN an annual taxable base of `3_333_333n` cents and a policy statutory rate of `2950` bp
- WHEN `computeAnnualIsr()` is invoked
- THEN the annual ISR liability is `983_333n` cents, the deterministic BigInt floor of `3_333_333n * 2950 / 10000` (fractional cent discarded)

#### Scenario: Rate outside the legal envelope is rejected

- GIVEN a policy statutory rate of `15000` bp (150%), outside the validated legal envelope
- WHEN `computeAnnualIsr()` is invoked
- THEN the computation is rejected with `RATE_OUT_OF_BOUNDS` and no liability is produced

#### Scenario: Negative taxable base is rejected

- GIVEN an annual taxable base of `−500_000n` cents
- WHEN `computeAnnualIsr()` is invoked
- THEN the computation is rejected with `NEGATIVE_AMOUNT` and no liability is produced

### Requirement: Annual settlement against cumulative provisional payments

`computeAnnualSettlement()` MUST reconcile the annual ISR liability against the cumulative provisional payments, where the credit equals the BigInt-exact sum of the twelve monthly ISR cédula amounts (pagos a cuenta) scoped to the same RUC and fiscal year; when the annual ISR exceeds the credit the settlement MUST report a balance payable, when the credit exceeds the annual ISR it MUST report a balance in favor, and when they are equal it MUST report a zero balance; the settlement MUST produce a typed cédula with the breakdown (annual ISR, provisional credit, balance amount, balance kind), and a missing or incomplete set of monthly cédulas MUST be rejected (`INCOMPLETE_INPUT`).

#### Scenario: Balance payable is computed

- GIVEN an annual ISR liability of `2_500_000n` cents and twelve monthly ISR cédulas summing to `2_000_000n` cents of provisional payments
- WHEN `computeAnnualSettlement()` is invoked
- THEN the settlement cédula reports balance kind `payable` with a balance of `500_000n` cents and the full breakdown (annual ISR, credit, balance)

#### Scenario: Balance in favor is computed

- GIVEN an annual ISR liability of `2_500_000n` cents and twelve monthly ISR cédulas summing to `2_700_000n` cents of provisional payments
- WHEN `computeAnnualSettlement()` is invoked
- THEN the settlement cédula reports balance kind `in-favor` with a balance of `200_000n` cents

#### Scenario: Zero balance is reported when liability equals the credit

- GIVEN an annual ISR liability of `2_500_000n` cents and monthly cédulas summing to exactly `2_500_000n` cents
- WHEN `computeAnnualSettlement()` is invoked
- THEN the settlement cédula reports balance kind `zero` with a balance of `0n` cents

#### Scenario: Incomplete provisional-payment set is blocked

- GIVEN fewer than twelve monthly ISR cédulas for the fiscal year
- WHEN `computeAnnualSettlement()` is invoked
- THEN the settlement is rejected with `INCOMPLETE_INPUT` and no balance is produced

### Requirement: Year-end closing of result accounts to retained earnings

`closeAnnualResults()` MUST produce the year-end closing entries that move non-zero result accounts (PCGE 12/13/14…) into retained earnings (PCGE 59), composing over the SDD-CON-002 `closeResultAccounts` primitive; every produced entry MUST conform to the existing `journal/` shape (`JournalLine { accountCode, side: "debit" | "credit", amountCents: bigint }`, `JournalEntry { id, scope, lines, ... }`) and MUST satisfy `sum(debits) === sum(credits)` via the shared `assertBalanced` invariant; an unbalanced draft MUST be a hard error (`UNBALANCED_ENTRY`) and MUST NEVER be emitted silently or auto-corrected; a line referencing an account absent from the configured PCGE chart MUST be rejected (`ACCOUNT_NOT_IN_CHART`).

#### Scenario: Result accounts close into retained earnings balanced

- GIVEN result accounts `70` (credit balance `500_000n` cents) and `60` (debit balance `200_000n` cents) for the fiscal year
- WHEN `closeAnnualResults()` is invoked
- THEN each produced entry is balanced, every credit-balance account closes with a debit into PCGE `59` and every debit-balance account closes with a credit into PCGE `59`, and every amount is positive BigInt cents

#### Scenario: Unbalanced closing draft is a hard error

- GIVEN a closing draft whose total debits do not equal total credits
- WHEN `closeAnnualResults()` validates the draft
- THEN the closing is rejected with `UNBALANCED_ENTRY` and no entry is produced or silently adjusted

#### Scenario: Account outside the chart is rejected

- GIVEN a closing entry referencing an account absent from the configured PCGE chart
- WHEN the entry is validated
- THEN the entry is rejected with `ACCOUNT_NOT_IN_CHART`

### Requirement: Structured annual declaration payload

`buildAnnualDeclaration()` MUST compile a deterministic, structured declaration payload containing the RUC, the fiscal year, the annual net income, the taxable base, the annual ISR liability, the provisional-payment credit, the balance amount with its kind, and the supporting cédulas (annual net income determination, annual ISR, and settlement); the payload MUST have stable field names and ordering so that identical inputs produce byte-identical output, MUST be pure data with no I/O or network side effects, and MUST be the deterministic input shape a future SUNAT DJ adapter consumes (no SUNAT wire in this slice).

#### Scenario: Payload compiles the full settlement deterministically

- GIVEN a completed annual settlement for one RUC and fiscal year with net income, base, ISR, credit, and balance
- WHEN `buildAnnualDeclaration()` is invoked twice with the same inputs
- THEN both payloads are deep-equal, contain the RUC, fiscal year, net income, taxable base, ISR, credit, balance amount and kind, and the supporting cédulas, and the invocation performs no external I/O

#### Scenario: Payload is emitted without SUNAT interaction

- GIVEN a valid annual settlement
- WHEN `buildAnnualDeclaration()` is invoked
- THEN the function returns the structured payload and makes no network call, submission attempt, or CDR interaction of any kind

### Requirement: Annual settlement report with balance identity

`buildAnnualReport()` MUST compile the post-settlement report containing the produced journal entries, the trial-balance identity check (`sum(debits) === sum(credits)` across every line of every entry), the settlement cédula, and the retained-earnings (PCGE 59) balance movement before vs after the close; a state that would violate the trial-balance identity MUST be rejected (`UNBALANCED_ENTRY`) and the report MUST NEVER be emitted for an unbalanced state.

#### Scenario: Report compiles a balanced annual settlement

- GIVEN balanced closing entries and a settlement cédula for one RUC and fiscal year
- WHEN `buildAnnualReport()` is invoked
- THEN the report states the journal entries, `trialBalanceBalanced === true`, the settlement cédula, and the PCGE 59 balance movement before vs after the close

#### Scenario: Unbalanced state is never reported

- GIVEN closing entries whose total debits do not equal total credits
- WHEN `buildAnnualReport()` is invoked
- THEN the report is rejected with `UNBALANCED_ENTRY` and no report is emitted

### Requirement: Composition without modification of frozen modules

The annual engine MUST compose over the SDD-CON-002 close primitives and the existing `journal/` shape by import only, and MUST NOT modify `contracts/**`, `close-calculations/**`, `bank-reconciliation/**`, or any other existing SDD-CON-001/002 module; the module MUST remain node:crypto-only (no third-party runtime dependencies beyond repository modules and Node built-ins).

#### Scenario: Frozen paths stay byte-identical

- GIVEN the annual engine change applied
- WHEN the frozen paths `contracts/**`, `close-calculations/**`, and `bank-reconciliation/**` are diffed against the pre-change state
- THEN the diff is empty (no modification; composition only)

#### Scenario: Runtime dependency surface stays node:crypto-only

- GIVEN the `annual-declaration` module
- WHEN its runtime imports are scanned
- THEN only Node built-ins (including `node:crypto`) and intra-repository modules are imported, with no third-party runtime dependency

### Requirement: Closed-month counting helper

The engine MAY provide helpers that count the closed monthly periods in an input set to validate the twelve-period requirement; such helpers MUST count only closed periods and MUST NOT compute any amount or entry themselves.

#### Scenario: Helper counts the closed months

- GIVEN an input set with twelve closed monthly periods and one unclosed period for fiscal year `2025`
- WHEN the counting helper is invoked
- THEN it returns `12` closed periods, ignoring the unclosed one, and produces no amount or entry
