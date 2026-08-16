# Proposal — Cierre Contable Mensual Engine

## Decision

Add a pure, verifiable monthly-close calculation engine as a deterministic library
module (`close-calculations/`) that computes the accounting entries of the Peruvian
monthly close: fixed-asset depreciation, provisions, provisional ISR (pago a
cuenta), and the closing of result accounts to retained earnings. Every entry is a
balanced journal entry in the existing `journal/` shape (debit/credit lines,
PCGE account codes, BigInt cents), RUC- and period-scoped, fail-closed. The engine
is the deterministic core the SDD-050 monthly-close vertical (`flow/close.ts`)
will call; mission/gate/receipt wiring is the next slice.

## Intent

SDD-050 (`openspec/programs/drenyra-dominion/sdds/sdd-050-monthly-close`) declares
the monthly close as the flagship vertical — "takes ERP exports, SIRE reports, and
bank statements through preflight, normalization, reconciliation, and exceptions,
then generates candidates" — and its closure record is `lifecycle:complete` for the
orchestrator core. But the deterministic close *calculations* do not exist: no
module computes depreciation, provisions, provisional ISR, or the closing entries.
`flow/close.ts` orchestrates evidence → candidates → guardian → receipts → ledger,
but the numbers that would fill the candidates come from nowhere in the
deterministic core. The sibling change `conciliacion-bancaria` (SDD-CON-001) closed
the bank-vs-ledger gap; this change closes the calculation gap. They are consumed
in order: reconciliation first, close calculations second — the user's SDD-CON-002
explicitly lists "conciliación bancaria completed first" as a precondition.

## Proposed outcome

After this change:

1. `computeDepreciation()` produces monthly depreciation journal entries from a
   fixed-asset register and a policy of configurable annual rates (LIR-validated),
   with deterministic BigInt rounding; no float, no invented rate.
2. `computeProvisions()` produces provision entries for past-due receivables and
   inventory from a configurable policy (LIR-validated percentages and aging
   rules); unclassifiable inputs never silently produce an entry.
3. `computeProvisionalIsr()` produces the provisional ISR (pago a cuenta) entry
   per LIR Art. 85 rule (coeficiente vs 1.5% de ingresos netos), BigInt-exact.
4. `closeResultAccounts()` produces the closing entries that move net result
   accounts (PCGE 12/13/14…) to retained earnings (PCGE 59), balancing the
   journal; unbalanced output is a hard error.
5. `buildCloseReport()` compiles the post-close summary: journal entries,
   trial-balance identity check (debits === credits), provisional ISR cédula, and
   balance movement (before vs after close).
6. New PE skills join `BASE_PE_SKILLS` and the sibling authoring manifest
   `drenyra-skills/skills/registry.json` byte-identically (`skills:conformance`
   MUST pass): e.g. `pe.depreciacion-activo-fijo`, `pe.provision-cartera`,
   `pe.isr-mensual`, `pe.cierre-resultados`.
7. Every monetary value is BigInt cents; every operation is scoped to one RUC and
   one fiscal period; cross-RUC access is rejected fail-closed; every journal
   entry produced is balanced (sum of debits === sum of credits).

## Scope

### Slice 1 — Close calculation engine (this change)

- `close-calculations/types.ts` — fixed-asset register, policies, provision
  inputs, ISR inputs, journal-entry outputs, report types; money as BigInt cents.
- `close-calculations/depreciation.ts` — monthly depreciation entries
  (deterministic, LIR-validated configurable rates, documented rounding).
- `close-calculations/provisions.ts` — receivables/inventory provision entries.
- `close-calculations/isr.ts` — provisional ISR (pago a cuenta) entry.
- `close-calculations/close-results.ts` — closing entries to retained earnings.
- `close-calculations/report.ts` — post-close report + balance identity check.
- `close-calculations/index.ts` — public surface barrel.
- `skills/pe.ts` — new entries in `BASE_PE_SKILLS`.
- `../drenyra-skills/skills/registry.json` — identical sibling manifest entries.
- Tests (strict TDD): unit coverage for every module; node:crypto only.
- Module wiring per repo pattern: `tsconfig.json` + `tsconfig.build.json` include,
  `package.json` exports map, root `index.ts` barrel.

### Follow-up slices (out of scope)

- Wiring into `flow/close.ts` orchestration (feed the candidates, guardian review,
  receipts, ledger) — next slice, mirroring how `conciliacion-bancaria` staged its
  engine before adapters.
- Mission intents, per-step gates, signed receipts, Engram integration, CLI
  commands, MCP tools, real ERP connectors.

## Non-goals

- No modification of frozen contracts (`contracts/**`) or of the SDD-050
  `flow/close.ts` orchestrator in this slice.
- No ERP/SUNAT/bank connectors or adapters; the engine accepts canonical input
  shapes.
- No account-code auto-classification from free text; account codes are explicit
  inputs (PCGE) validated against the configured chart.
- No human-approval workflow (the existing `gates/` and mission protocol cover
  that; wiring is the next slice).
- No ledger writes (ledger stays audit-only; `validateLedger` belongs to the
  orchestrator slice).

## Tradeoffs

- **Calculations before wiring** — the verifiable core lands first (same pattern
  as `conciliacion-bancaria` and the authority-kernel precedent); the orchestration
  slice then becomes thin and reviewable.
- **Configurable LIR-validated rates, not hardcoded guesses** — depreciation and
  provision percentages are policy inputs with documented LIR references, so a
  normative change (e.g. a new TUO) is a policy update, not a code change. The
  engine validates that rates are within LIR-legal bounds and fails closed
  otherwise.
- **Balanced-entry invariant** — every produced journal entry must balance;
  unbalanced output is a typed error, never a silent entry, protecting the ledger
  from invented postings.
- **BigInt-exact ISR** — provisional ISR uses integer-cent arithmetic throughout
  (coeficiente and 1.5% paths), with a documented rounding rule, so the cédula is
  reproducible.
