# Proposal — Annual Tax Declaration Engine (SDD-CON-003)

## Decision

Add a pure, verifiable annual-close calculation engine as a deterministic library
module (`annual-declaration/`) that computes the Peruvian annual tax settlement
(cierre fiscal definitivo): the determination of annual net income, the annual
ISR liability for legal entities, the credit for cumulative provisional payments
(pagos a cuenta), the resulting balance payable or in favor, and the closing of
the year's result accounts. Every output is a balanced journal entry in the
existing `journal/` shape (debit/credit lines, PCGE account codes, BigInt cents),
RUC- and fiscal-year-scoped, fail-closed. The engine reuses the SDD-CON-002
close primitives (`closeResultAccounts`, ISR helpers) where safe and is the
deterministic core that the `declaracion` phase of the FSD lifecycle (drenyra-sdd)
will consume; mission/gate/receipt wiring and SUNAT submission are the next slice.

## Intent

The FSD lifecycle (captura → clasificacion → conciliacion → cierre → declaracion
→ auditoria) reaches its `declaracion` phase: "Declaración SUNAT, CDR valid +
filed". SDD-CON-001 closed the bank-vs-ledger gap and SDD-CON-002 closed the
monthly-close calculation gap (depreciation, provisions, provisional ISR, closing
entries). But no deterministic module computes the *annual* settlement: the
determination of annual net income, the annual ISR liability, the reconciliation
against the twelve accumulated provisional payments, and the balance that the DJ
Anual (PJ/173, form 000-Renta) must declare. Without it, the `declaracion` phase
would depend on external spreadsheets or floats — violating the authority-core
rule that accounting decisions are deterministic, verifiable, and BigInt-exact.
This change closes that gap with a pure calculation engine, staged exactly like
its two predecessors: engine first, orchestration second.

## Proposed outcome

After this change:

1. `determineAnnualNetIncome()` computes the annual net income for the fiscal year
   from the closed monthly periods and the statutory reconciliation inputs,
   BigInt-exact, fail-closed on incomplete input.
2. `computeAnnualIsr()` computes the annual ISR liability applying the
   configurable statutory rate (policy input, LIR-referenced; default 2950 bp for
   legal entities) against the annual taxable base, with documented rounding.
3. `computeAnnualSettlement()` reconciles the annual ISR liability against the
   cumulative provisional payments (the twelve monthly ISR cédulas) and produces
   the balance payable or the credit in favor, plus a typed settlement cédula.
4. `closeAnnualResults()` produces the year-end closing entries that move result
   accounts (PCGE 12/13/14…) to retained earnings (PCGE 59), balancing the
   journal; unbalanced output is a hard error.
5. `buildAnnualDeclaration()` compiles the structured declaration payload: annual
   net income, taxable base, ISR liability, provisional credit, balance, and the
   supporting cédulas — the deterministic input shape a future SUNAT DJ adapter
   consumes (no SUNAT wire in this slice).
6. `buildAnnualReport()` compiles the post-settlement summary: journal entries,
   trial-balance identity check (debits === credits), settlement cédula, and
   balance movement (before vs after close).
7. Every monetary value is BigInt cents; every operation is scoped to one RUC and
   one fiscal year (period form YYYY); cross-RUC access is rejected fail-closed;
   every journal entry produced is balanced.

## Scope

### Slice 1 — Annual declaration engine (this change)

- `annual-declaration/types.ts` — annual inputs, policies, cédula and settlement
  types, declaration payload and report types; money as BigInt cents.
- `annual-declaration/net-income.ts` — annual net income determination from
  closed monthly periods and statutory reconciliation inputs.
- `annual-declaration/isr.ts` — annual ISR liability (configurable statutory rate,
  BigInt-exact rounding).
- `annual-declaration/settlement.ts` — annual settlement vs cumulative provisional
  payments (credit for pagos a cuenta), balance payable / credit in favor.
- `annual-declaration/close-results.ts` — year-end closing entries to retained
  earnings (thin composition over `close-calculations` primitives where safe).
- `annual-declaration/declaration.ts` — structured DJ payload builder.
- `annual-declaration/report.ts` — post-settlement report + balance identity check.
- `annual-declaration/index.ts` — public surface barrel.
- Tests (strict TDD): unit coverage for every module; node:crypto only.
- Module wiring per repo pattern: `tsconfig.json` + `tsconfig.build.json` include,
  `package.json` exports map, root `index.ts` barrel.
- Capability matrix: mark `annual-declaration: implemented` in
  `openspec/programs/drenyra-dominion/capability-matrix.yaml`.

### Follow-up slices (out of scope)

- Wiring into the FSD `declaracion` mission/gate/receipt flow and any `flow/`
  orchestration — next slice, mirroring how SDD-CON-001/002 staged their engines
  before adapters.
- SUNAT submission adapter (DJ Anual, CDR), Engram integration, CLI commands, MCP
  tools, real tax-engine connectors.

## Non-goals

- No modification of frozen contracts (`contracts/**`) or of existing SDD-CON-001
  (bank-reconciliation) / SDD-CON-002 (close-calculations) modules; composition
  only.
- No SUNAT submission, CDR handling, or official DJ form rendering; the engine
  produces the structured deterministic payload.
- No tax-reconciliation of the *accounting* vs *tax* base beyond the statutory
  adjustments the engine declares as explicit inputs; free-text adjustment
  classification is out of scope.
- No human-approval workflow (the existing `gates/` and mission protocol cover
  that; wiring is the next slice).
- No ledger writes (ledger stays audit-only).

## Tradeoffs

- **Engine before wiring** — the verifiable core lands first (same pattern as
  SDD-CON-001/002 and the authority-kernel precedent); the orchestration slice
  then becomes thin and reviewable.
- **Configurable statutory rate, not a hardcoded guess** — the annual ISR rate is
  a policy input with a documented LIR reference and a legal-entity default, so a
  normative change (a new rate year) is a policy update, not a code change. The
  engine validates that rates are within legal bounds and fails closed otherwise.
- **Composition over duplication** — the year-end closing reuses the proven
  SDD-CON-002 closing primitives instead of forking them, at the cost of a thin
  dependency on `close-calculations` (same direction as `close-vertical-wiring`).
- **BigInt-exact settlement** — annual ISR and the provisional credit use
  integer-cent arithmetic throughout with a documented rounding rule, so the
  declaration cédula is reproducible to the cent.
