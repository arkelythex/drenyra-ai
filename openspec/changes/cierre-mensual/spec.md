# Cierre Contable Mensual Specification

## Purpose

Defines the deterministic monthly-close calculation engine, a pure library module that computes the accounting entries of the Peruvian monthly close: fixed-asset depreciation, provisions (past-due receivables and inventory), provisional ISR (pago a cuenta per LIR Art. 85), closing entries to retained earnings (PCGE 59), and a post-close report with the trial-balance identity. Every monetary value is BigInt cents, every operation is scoped to one RUC and one fiscal period, every produced entry is balanced (sum of debits equals sum of credits), and unprocessable inputs are rejected fail-closed with a typed error. The engine is the deterministic core the SDD-050 monthly-close workflow calls; mission/gate/receipt wiring is out of scope for this slice.

## Requirements

### Requirement: Fixed-asset depreciation

`computeDepreciation()` MUST produce one balanced monthly depreciation journal entry per fixed asset at the deterministic BigInt floor of `(costBasisCents * annualRateBp / 10000) / 12`; a zero or negative cost MUST be rejected fail-closed (`NEGATIVE_AMOUNT`), a rate outside the legal envelope MUST be rejected (`RATE_OUT_OF_BOUNDS`), and a monthly amount that rounds to zero MUST be rejected (`NEGATIVE_AMOUNT`).

#### Scenario: Depreciation entry is produced at the BigInt floor

- GIVEN a fixed asset with cost `120_000_000n` cents and an annual rate of `1200` bp (12%)
- WHEN monthly depreciation is computed
- THEN one balanced entry is produced with debit to the expense account and credit to the accumulated-depreciation account, each `1_200_000n` cents

#### Scenario: Zero or negative cost is rejected

- GIVEN a fixed asset with a zero or negative cost
- WHEN depreciation is computed
- THEN the computation is rejected with `NEGATIVE_AMOUNT` and no entry is produced

### Requirement: Provisions

`computeProvisions()` MUST produce one balanced provision entry per classified receivable/inventory input at the deterministic BigInt floor of `exposureCents * provisionRateBp / 10000`; an input that cannot be classified by the policy MUST produce NO entry and surface as a blocker (`UNCLASSIFIABLE_INPUT`), never a guess.

#### Scenario: Provision entry is produced per classified input

- GIVEN a past-due receivable with exposure `1_000_000n` cents and a provision rate of `1000` bp (10%)
- WHEN provisions are computed
- THEN one balanced entry is produced with debit to the provision expense account and credit to the provision liability account, each `100_000n` cents

#### Scenario: Unclassifiable input is blocked

- GIVEN an input whose kind has no rule in the configured policy
- WHEN provisions are computed
- THEN NO entry is produced and the input surfaces as a `UNCLASSIFIABLE_INPUT` blocker

### Requirement: Provisional ISR (pago a cuenta, LIR Art. 85)

`computeProvisionalIsr()` MUST compute the provisional ISR entry where the pago a cuenta is the greater of the coefficient path (`priorYearRatioBp * netIncomeCents / 10000`) and the statutory-minimum path (`statutoryMinimumBp * monthlyNetIncomeCents / 10000`, 1.5% = 150 bp); `rule` selects the path, `greater-of` applies the greater and falls back to the statutory minimum when no prior-year ratio exists; all arithmetic MUST be integer-cent BigInt with deterministic floor; negative net income MUST be rejected (`NEGATIVE_AMOUNT`).

#### Scenario: Coefficient path is applied

- GIVEN a provisional ISR input with rule `coeficiente`, net income `10_000_000n` cents and a prior-year ratio of `200` bp (2%)
- WHEN the pago a cuenta is computed
- THEN the applied amount is `200_000n` cents (debit ISR expense, credit ISR payable) and the cédula records both paths

#### Scenario: Statutory minimum path is applied

- GIVEN a provisional ISR input with rule `pct-ingresos` and monthly net income `10_000_000n` cents
- WHEN the pago a cuenta is computed
- THEN the applied amount is `150_000n` cents (1.5% = 150 bp)

#### Scenario: Greater-of applies the larger path

- GIVEN a provisional ISR input with rule `greater-of` where the coefficient path exceeds the statutory-minimum path
- WHEN the pago a cuenta is computed
- THEN the applied amount is the coefficient-path amount

### Requirement: Closing entries to retained earnings

`closeResultAccounts()` MUST close each non-zero result account (PCGE 12/13/14…) into retained earnings (PCGE 59) through one balanced entry per account: a credit-balance account (revenue/gain) closes with a debit, a debit-balance account (expense/loss) closes with a credit; zero balances MUST be skipped; an unbalanced draft is a hard error (`UNBALANCED_ENTRY`); retained earnings as a source account MUST be rejected (`UNCLASSIFIABLE_INPUT`).

#### Scenario: Revenue closes with a debit into retained earnings

- GIVEN a result account `70` with a credit balance of `500_000n` cents
- WHEN closing entries are produced
- THEN one balanced entry debits `70` and credits PCGE `59`, each `500_000n` cents

#### Scenario: Expense closes with a credit into retained earnings

- GIVEN a result account `60` with a debit balance of `200_000n` cents
- WHEN closing entries are produced
- THEN one balanced entry credits `60` and debits PCGE `59`, each `200_000n` cents

### Requirement: Journal-shape conformance

Every produced entry MUST conform to the existing `journal/` shape: `JournalLine { accountCode, side: "debit" | "credit", amountCents: bigint }` and `JournalEntry { id, scope, lines, evidence, status }`; every entry MUST satisfy `sum(debits) === sum(credits)` via the shared `assertBalanced` invariant; every line account MUST be present in the configured PCGE chart (`ACCOUNT_NOT_IN_CHART` otherwise).

#### Scenario: Entries conform to the journal shape and balance

- GIVEN entries produced by any engine function
- WHEN the shared balanced-entry invariant runs
- THEN every entry satisfies `sum(debits) === sum(credits)` with sides debit|credit and positive BigInt-cent amounts

#### Scenario: Account outside the chart is rejected

- GIVEN a produced entry referencing an account absent from the configured PCGE chart
- WHEN the entry is validated
- THEN the entry is rejected with `ACCOUNT_NOT_IN_CHART`

### Requirement: RUC and fiscal-period scope isolation

Every engine operation MUST be scoped to exactly one RUC (11 digits) and one fiscal period (YYYYMM); a call that omits or invalidates the scope MUST be rejected (`INVALID_SCOPE`), and no movement or result from one RUC MAY be observable to another.

#### Scenario: Valid scope is accepted

- GIVEN an operation with an 11-digit RUC and a valid YYYYMM period
- WHEN the operation is invoked
- THEN the scope is accepted

#### Scenario: Invalid scope is rejected

- GIVEN an operation with a malformed RUC or period
- WHEN the operation is invoked
- THEN the operation is rejected with `INVALID_SCOPE`

### Requirement: Post-close report

`buildCloseReport()` MUST compile the post-close report containing every produced journal entry, the trial-balance identity (sum of debits equals sum of credits across every line of every entry), the provisional ISR cédula, and the retained-earnings (PCGE 59) balance movement before vs after the close; a state that would violate the trial-balance identity MUST be rejected (`UNBALANCED_ENTRY`) and NEVER emitted.

#### Scenario: Report compiles a balanced close

- GIVEN balanced depreciation, provision, ISR and closing entries for one RUC and period
- WHEN the post-close report is built
- THEN the report states the entries, `trialBalanceBalanced === true`, the ISR cédula, and the before/after retained-earnings movement

#### Scenario: Unbalanced close state is never reported

- GIVEN entries whose total debits do not equal total credits
- WHEN the post-close report is requested
- THEN the report is rejected with `UNBALANCED_ENTRY` and no report is emitted

### Requirement: Skill registry conformance

Four new PE skills MUST ship in `BASE_PE_SKILLS` and MUST conform byte-identically to the sibling authoring manifest `drenyra-skills/skills/registry.json` on the six conformance fields (version, jurisdiction, maxAutonomy, normativeSources, inputs, outputs); the `skills:conformance` check MUST pass.

#### Scenario: Registry entries match the manifest

- GIVEN the four new entries in `BASE_PE_SKILLS` and the sibling registry manifest
- WHEN conformance is checked
- THEN the entries match the manifest on id, version, jurisdiction, maxAutonomy, normativeSources, inputs, and outputs

#### Scenario: Drift fails conformance

- GIVEN a `BASE_PE_SKILLS` entry that drifts from the sibling manifest
- WHEN conformance is checked
- THEN the check fails and the drift is reported
