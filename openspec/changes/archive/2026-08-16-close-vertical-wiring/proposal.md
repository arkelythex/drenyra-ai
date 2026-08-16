# Proposal — Close Vertical Wiring

## Decision

Wire the two verified deterministic engines — `bank-reconciliation/`
(SDD-CON-001) and `close-calculations/` (SDD-CON-002) — into the monthly-close
vertical `flow/close.ts` (SDD-050). Today `runMonthlyClose()` receives
`proposals?: readonly ReconciliationProposal[]` — SYNTHETIC candidates that
agents would supply externally, so the vertical's numbers come from nowhere in
the deterministic core. This change adds `flow/close-wiring.ts` converters that
generate `ReconciliationProposal[]` FROM engine output — reconciliation
differences/adjustments and close entries — feeding the existing pipeline
(CandidateLifecycle.propose → runGuardianReview → buildSignedReceipt →
validateLedger) unchanged. After this slice the monthly close produces its
candidates FROM the deterministic engines, not from external guesswork.

## Intent

SDD-050 declared the monthly close as the flagship vertical and its closure
record is `lifecycle:complete` for the orchestrator core. The two sibling
changes closed the engine gaps: `conciliacion-bancaria` (bank-vs-ledger
matching, differences, fail-closed adjustment drafts) and `cierre-mensual`
(depreciation, provisions, provisional ISR per LIR Art. 85, closing entries to
PCGE 59). Both explicitly deferred "mission wiring / flow/close.ts
orchestration" as the next slice, and shaped their outputs ("proposals shaped so
the next slice binds them without rework") for exactly this step. This change is
that next slice: it binds the engines to the vertical without modifying either
engine, without touching frozen contracts, and without changing the authority
model (the Core still stages candidates, the Guardian still audits, humans still
approve).

## Proposed outcome

After this change:

1. `flow/close-wiring.ts` exports two deterministic converters:
   - `reconciliationToProposals(scope, bankRows, ledgerRows, opts?)` → normalizes
     both sides, runs `reconcile()`, then `buildAdjustments()` over the
     differences, and maps every adjustment draft to a `ReconciliationProposal`
     (label from the draft reference, explanation from the justification,
     amountCents from the draft amount, reversibility from the draft side and
     approval requirement).
   - `closeEntriesToProposals(scope, closeInputs)` → runs the close-calculations
     engines (depreciation, provisions, ISR, closing) and maps every balanced
     `CloseEntry` to a `ReconciliationProposal` (label from the entry kind/id,
     explanation from the entry lines, amountCents from the line amounts,
     reversibility per kind).
   - Both are fail-closed: an engine error surfaces as a typed risk, never a
     silent skip; no proposal is fabricated from unclassifiable output.
2. `runMonthlyClose()` accepts OPTIONAL new inputs (bank rows + ledger movements
   for reconciliation; close inputs for the four close calculations) and, when
   present, generates the proposals internally via the converters instead of
   requiring external `proposals`. External `proposals` remain fully supported
   (backward compatible).
3. The generated proposals flow through the EXISTING candidate/guardian/receipt/
   ledger pipeline unchanged — no authority-model change, no new gates, no new
   receipt types.
4. Tests (strict TDD): unit tests for both converters (happy path + fail-closed
   paths) and an integration test proving `runMonthlyClose()` generates
   candidates from engine output end-to-end (bank rows + ledger movements →
   reconciliation candidates; close inputs → close candidates → guardian →
   receipts → ledger valid).

## Scope

### Slice 1 — Wiring converters + vertical integration (this change)

- `flow/close-wiring.ts` — the two converters (pure, deterministic, BigInt
  cents, RUC + period scoped).
- `flow/close.ts` — extend `MonthlyCloseInput` with optional engine inputs
  (`bankRows`, `ledgerRows`, `closeInputs`) and generate proposals when present.
- `flow/__tests__/close-wiring.test.ts` — unit tests for the converters.
- `flow/__tests__/close-integration.test.ts` — end-to-end: vertical generates
  candidates from engine output, guardian audit runs, receipts sign, ledger
  validates.
- No changes to `bank-reconciliation/`, `close-calculations/`, `contracts/**`,
  `ledger/`, skills, missions, MCP, or CLI.

### Follow-up slices (out of scope)

- Real connectors (SDD-110): the vertical still consumes canonical row shapes;
  adapters bind later.
- Command Center UI (SDD-100) and multi-operator plane (SDD-060).
- Human-approval UX (the existing gates/approval pipeline already covers
  authority; this slice only feeds it better candidates).

## Non-goals

- No modification of the two engines, frozen contracts, or the authority model.
- No new skills, no conformance delta (11 PE skills stay).
- No ledger writes (ledger stays audit-only; validateLedger unchanged).
- No MCP tools, no CLI commands, no mission-intent changes.
- No real ERP/SUNAT/bank connectors.

## Tradeoffs

- **Converters in `flow/`, engines untouched** — the engines stay pure and
  independently verifiable; the wiring is a thin, reviewable translation layer
  (same pattern the engines used: deterministic core first, binding later).
- **Backward-compatible optional inputs** — external proposals still work, so
  agents and tests that stage synthetic candidates keep functioning; the
  vertical gains a deterministic path without breaking the existing one.
- **Fail-closed conversion** — an engine error or unclassifiable output never
  fabricates a candidate; it surfaces as a typed risk, protecting the ledger from
  invented postings (consistent with both engines' fail-closed contracts).
- **One vertical, two engines** — reconciliation candidates (differences and
  adjustments) and close candidates (entries) both become proposals in the same
  pipeline, so the monthly close is one coherent, auditable candidate stream.
