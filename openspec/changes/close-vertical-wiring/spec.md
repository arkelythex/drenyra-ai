# Monthly-Close Vertical Wiring Specification

## Purpose

Defines the wiring slice that binds the two verified deterministic engines — `bank-reconciliation/` (SDD-CON-001) and `close-calculations/` (SDD-CON-002) — into the monthly-close vertical `flow/close.ts` (SDD-050). Two pure converters in `flow/close-wiring.ts` translate engine output into the vertical's existing `ReconciliationProposal` shape: reconciliation adjustment drafts and balanced close entries become proposals that feed the existing candidate/guardian/receipt/ledger pipeline unchanged. `runMonthlyClose()` gains optional engine inputs and generates its proposals from the engines when those inputs are present, while externally supplied `proposals` remain fully supported (backward compatible). Every monetary value is BigInt cents, every operation is scoped to exactly one RUC and one fiscal period, conversion is fail-closed (engine errors surface as typed risks; nothing is fabricated or silently skipped), and neither engine nor any frozen contract is modified.

## Requirements

### Requirement: Reconciliation converter — one proposal per adjustment draft

The system MUST provide a deterministic converter `reconciliationToProposals(scope, bankRows, ledgerRows, opts?)` that normalizes the bank rows and ledger movements within the scope, runs `reconcile()`, builds adjustment drafts with `buildAdjustments()`, and produces exactly one `ReconciliationProposal` per adjustment draft. Each proposal MUST derive `label` from the draft's reference, `explanation` from the draft's justification, `amountCents` from the draft's BigInt-cent amount (lossless; the existing `ReconciliationProposal.amountCents` is a string the pipeline reads with `BigInt()`), and `reversibility` deterministically from the draft's `side` and `requireApproval` flag, yielding one of `reversible`, `partially-reversible`, or `irreversible`. No proposal MAY be produced for any movement that is not a classified adjustment draft, and the optional `opts?` parameter MAY forward adjustment-generation controls to the engine's public `buildAdjustments` options. Proposals MUST be produced in deterministic order matching the draft order.

#### Scenario: One proposal per classified adjustment draft

- GIVEN a reconciliation input with two `bank-only` differences of `250n` cents and one fully matched pair, all within the close's RUC and period
- WHEN the converter runs
- THEN exactly two `ReconciliationProposal`s are produced, each with `label` from the draft reference, `explanation` from the draft justification, `amountCents` carrying `250` BigInt cents, and a `reversibility` deterministically derived from the draft's side and approval flag

#### Scenario: Fully matched reconciliation yields no proposals

- GIVEN bank rows and ledger movements where every movement is matched
- WHEN the converter runs
- THEN zero proposals are produced

#### Scenario: Conversion is deterministic

- GIVEN identical `scope`, `bankRows`, and `ledgerRows` inputs
- WHEN the converter runs twice
- THEN both runs produce identical proposal sets in identical order (same labels, explanations, amounts, and reversibility values)

### Requirement: Close converter — one proposal per balanced close entry

The system MUST provide a deterministic converter `closeEntriesToProposals(scope, closeInputs)` that runs the close-calculations engines (fixed-asset depreciation, provisions, provisional ISR, and closing entries to retained earnings) for the scope and produces exactly one `ReconciliationProposal` per balanced `CloseEntry`. Each proposal MUST derive `label` from the entry's kind and id, `explanation` from the entry's lines, `amountCents` from the entry's line amounts in BigInt cents (entries are balanced, so debits equal credits), and `reversibility` deterministically from the entry's kind. An unbalanced entry MUST NOT be mapped: an engine `UNBALANCED_ENTRY` failure surfaces fail-closed and produces no proposal. The provisional-ISR computation returns `{ entry, cedula }`; exactly one proposal is derived from its entry, and the cédula is not a proposal.

#### Scenario: Each balanced close entry yields exactly one proposal

- GIVEN a close run producing one depreciation entry, one provision entry, one ISR entry, and two closing entries (five balanced `CloseEntry`s total)
- WHEN the converter runs
- THEN exactly five proposals are produced, one per entry, in deterministic order, each with `amountCents` reflecting the entry's balanced BigInt-cent magnitude

#### Scenario: Depreciation entry maps label, explanation, and amount

- GIVEN a depreciation entry debiting the expense account and crediting accumulated depreciation, each `1_200_000n` cents
- WHEN the converter runs
- THEN one proposal is produced whose label derives from the entry kind/id, whose explanation summarizes the entry lines, and whose `amountCents` carries the balanced magnitude in BigInt cents

#### Scenario: Unbalanced entry is never mapped

- GIVEN a calculation whose produced entry would violate `sum(debits) === sum(credits)`
- WHEN the converter runs
- THEN no proposal is produced for that entry and the `UNBALANCED_ENTRY` failure surfaces fail-closed (per the fail-closed conversion requirement)

### Requirement: Fail-closed conversion

Conversion MUST fail closed. Any engine error (`BankReconciliationError` or `CloseError` with its typed code), any normalization rejection, and any unclassifiable output MUST surface as a typed risk in the close package's risks channel (currently `ClosePackage.risks`), MUST preserve the engine's typed error or rejection code, MUST NOT produce a proposal from the failed input, and MUST NEVER be silently skipped or fabricated. A row rejected during normalization MUST NOT yield a proposal for that row, while accepted rows MAY still produce their proposals per the engines' per-row semantics. An engine call that throws MUST NOT yield proposals derived from that failed call's output.

#### Scenario: Unclassified difference produces no proposal and a typed risk

- GIVEN a reconciliation whose differences cannot be classified by the engine (typed `UNCLASSIFIED_DIFFERENCE`)
- WHEN the converter runs
- THEN zero proposals are produced from the reconciliation path and the close result surfaces a risk carrying the typed code

#### Scenario: Normalization rejection surfaces instead of vanishing

- GIVEN a bank row with fractional cents while other rows normalize cleanly
- WHEN the converter runs
- THEN no proposal is produced for the rejected row, the typed rejection (`FRACTIONAL_CENTS`) surfaces as a risk, and proposals for the accepted rows are still produced

#### Scenario: Unclassifiable close input is blocked

- GIVEN a provision input whose kind has no rule in the configured policy
- WHEN the converter runs
- THEN no proposal is produced for that input and the typed `UNCLASSIFIABLE_INPUT` failure surfaces as a risk

#### Scenario: No silent skip of engine failure

- GIVEN any engine error during conversion
- WHEN the close completes
- THEN the failure is reported in the close package risks; an empty, clean success that pretends nothing failed is never emitted

### Requirement: Vertical integration — internal proposal generation

`MonthlyCloseInput` MUST accept optional engine inputs (`bankRows`, `ledgerRows`, `closeInputs`) alongside the existing optional `proposals`. When engine inputs are present, `runMonthlyClose` MUST generate the proposals internally via the converters and feed them into the existing pipeline. When engine inputs are absent, the vertical MUST behave exactly as today: externally supplied `proposals` are honored, and a close supplying neither external proposals nor engine inputs produces zero candidates. When both external `proposals` and engine inputs are supplied, the close MUST complete deterministically and MUST NOT silently discard either source: any supplied proposal not carried into the candidate stream MUST be explicitly surfaced in risks.

#### Scenario: Engine inputs generate candidates end-to-end

- GIVEN a `MonthlyCloseInput` with `bankRows`, `ledgerRows`, and `closeInputs`, no external `proposals`, and all required evidence present
- WHEN `runMonthlyClose` runs
- THEN proposals are generated internally from the engine output and the close completes with candidates produced through the existing pipeline

#### Scenario: External proposals remain fully supported

- GIVEN a `MonthlyCloseInput` with external `proposals` and no engine inputs
- WHEN `runMonthlyClose` runs
- THEN behavior is identical to the pre-change vertical: the external proposals feed the pipeline and produce the same candidate, receipt, and ledger outcomes

#### Scenario: Close without either source behaves as today

- GIVEN a `MonthlyCloseInput` with neither external `proposals` nor engine inputs and all required evidence present
- WHEN `runMonthlyClose` runs
- THEN zero candidates are produced, the close reports `complete`, and `ledgerValid` is computed exactly as before

#### Scenario: Both sources are never silently dropped

- GIVEN a `MonthlyCloseInput` supplying both external `proposals` and engine inputs
- WHEN `runMonthlyClose` runs
- THEN the close completes deterministically and every supplied proposal that does not reach the candidate stream is explicitly surfaced in risks

### Requirement: Pipeline unchanged

Engine-generated proposals MUST flow through the existing candidate/guardian/receipt/ledger pipeline exactly like externally supplied proposals. Each proposal MUST become exactly one candidate via `CandidateLifecycle.propose` with the close's `{ ruc, period }` scope and materiality derived from `BigInt(amountCents)` and `reversibility` through the existing `MaterialityInput` path. Guardian findings MUST apply unchanged: blocker findings surface in risks and prevent receipting. Receipts MUST use the existing `buildSignedReceipt` flow with the IGV skill version, and `validateLedger` MUST run on the same manifest and ledger entries. The change MUST NOT add gates, MUST NOT add receipt types or receipt actions, and MUST NOT change the authority model (the Core stages candidates, the Guardian audits, humans approve).

#### Scenario: Generated proposal produces exactly one candidate

- GIVEN one engine-generated proposal
- WHEN the pipeline runs
- THEN exactly one candidate is produced, carrying the close's `{ ruc, period }` scope and the materiality derived from the proposal's `BigInt(amountCents)` and `reversibility`

#### Scenario: Guardian blockers still block receipting

- GIVEN a generated proposal whose candidate receives blocker findings from the Guardian
- WHEN the pipeline runs
- THEN the blockers surface in risks and no receipt is signed for that candidate, matching the existing external-proposal behavior

#### Scenario: Identical proposals produce identical outcomes on both paths

- GIVEN an external proposal and an engine-generated proposal with identical contents
- WHEN each flows through the pipeline
- THEN both produce the same candidate, guardian, receipt, and ledger outcome with no additional gate or receipt type on either path

### Requirement: Scope isolation — one RUC and one fiscal period

Every converter operation MUST be scoped to exactly one RUC (11 digits) and one fiscal period (YYYYMM), and the scope MUST be the close's own scope. Cross-RUC rows and mixed-scope inputs MUST be rejected fail-closed per the engines' `validateScope`/`CROSS_RUC_ACCESS` semantics and MUST NOT produce proposals. Every candidate generated from converter output MUST carry the close's `{ ruc, period }` scope, and no movement or result from one RUC MAY be observable to another.

#### Scenario: Cross-RUC row is rejected fail-closed

- GIVEN a bank row whose RUC differs from the close's scope RUC
- WHEN normalization runs
- THEN the row is rejected with the typed `CROSS_RUC_ACCESS` rejection, no proposal is produced for it, and the rejection surfaces as a risk

#### Scenario: Invalid scope is rejected

- GIVEN a converter call with a malformed RUC or period
- WHEN the converter runs
- THEN the engine's `INVALID_SCOPE` failure surfaces and no proposals are produced

#### Scenario: Generated candidates carry the close scope

- GIVEN proposals generated from engine output for one close
- WHEN candidates are produced
- THEN every candidate's scope equals the close's `{ ruc, period }`

### Requirement: No engine or contract drift

This change MUST NOT modify any file under `bank-reconciliation/`, `close-calculations/`, `contracts/**`, `ledger/`, skills, missions, MCP, or CLI. The converters MUST consume the engines only through their public exports — never internal files, private helpers, or monkey-patching — and MUST NOT add, remove, or rename any engine export. Compliance MUST be evidenced by the change's diff boundary (paths touched) and by the converters' import surface.

#### Scenario: Diff boundary excludes the engines and contracts

- GIVEN the change's commit set
- WHEN `git diff --name-only` is checked
- THEN no path under `bank-reconciliation/`, `close-calculations/`, `contracts/`, `ledger/`, skills, missions, MCP, or `cmd/` appears

#### Scenario: Converters import only public engine exports

- GIVEN `flow/close-wiring.ts`
- WHEN its imports of the two engines are inspected
- THEN they reference only the engines' public exports (for example `normalizeBankRows`, `normalizeLedgerRows`, `reconcile`, `buildAdjustments`; `computeDepreciation`, `computeProvisions`, `computeProvisionalIsr`, `closeResultAccounts`, `buildCloseReport`), and no engine internal module is imported
