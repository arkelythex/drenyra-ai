# Proposal — Conciliación Bancaria Engine

## Decision

Add a pure, verifiable bank-reconciliation engine as a deterministic library module
(`bank-reconciliation/`) that normalizes bank-statement and ledger movements into a
canonical form, matches them, classifies differences, generates adjustment drafts,
and emits an executive reconciliation report. The engine is the deterministic core
the monthly-close mission (SDD-050) will call; adapters (MCP, gates, receipt
signing, CLI) are out of scope for this slice.

## Intent

The SDD-050 monthly-close vertical already scopes bank statements ("takes ERP
exports, SIRE reports, and bank statements through preflight, normalization,
reconciliation, and exceptions"), but no module owns bank-vs-ledger reconciliation.
`missions/reconciliation.ts` reconciles interrupted external calls (executed /
not-executed / indeterminate) and is a different concern; it MUST NOT be confused
or duplicated.

This change closes the gap with a deterministic engine whose every monetary value
is BigInt cents, whose operations are RUC- and period-scoped, and whose outputs
are shaped so the next slice can bind them to missions, gates, and signed receipts
without rework.

## Proposed outcome

After this change:

1. Bank statement rows and ledger movements normalize to one canonical movement
   shape (date, reference, amount in BigInt cents, side, source).
2. `reconcile()` matches movements by reference, falling back to amount+date, and
   classifies each movement as `matched`, `bank-only`, or `ledger-only`.
3. `buildAdjustments()` produces adjustment drafts (debit/credit in BigInt cents)
   with a justification per draft and a `requireApproval` flag; unclassified
   differences NEVER silently produce an adjustment.
4. `buildReport()` compiles the executive reconciliation report: initial/final
   balances for bank and ledger, the full difference detail, and adjustments with
   their impact on the reconciled balance.
5. One skill registry entry `pe.conciliacion-bancaria` ships in `BASE_PE_SKILLS`
   and matches the authoring manifest in `drenyra-skills/skills/registry.json`
   (skills:conformance MUST pass).

## Scope

### Slice 1 — Reconciliation engine (this change)

- `bank-reconciliation/types.ts` — canonical movements, differences, adjustments,
  report types; money as BigInt cents; RUC + fiscal-period scope on every input.
- `bank-reconciliation/normalize.ts` — canonical movement normalization.
- `bank-reconciliation/compare.ts` — reference-first, amount+date fallback
  matching; typed difference classification.
- `bank-reconciliation/adjust.ts` — adjustment draft generation with justification
  and approval requirement.
- `bank-reconciliation/report.ts` — executive report compilation.
- `bank-reconciliation/index.ts` — public surface.
- `skills/pe.ts` — `pe.conciliacion-bancaria` entry in `BASE_PE_SKILLS`.
- Tests (strict TDD): unit coverage for every module; node:crypto only.

## Non-goals

- MCP servers/tools (banco/ERP/documentos) — next slice.
- Mission wiring, per-step gates, and signed receipts — next slice; the engine
  outputs are shaped for that binding.
- Real bank CSV/XML parsers and mocks — the normalize module accepts canonical
  row shapes; adapters come later.
- Engram integration (memory remains advisory and never evidence).
- CLI commands.

## Tradeoffs

- **Engine before adapters** — the verifiable core lands first, exactly like the
  authority kernel precedent (fiscal-authority-kernel); adapters then become thin
  and reviewable.
- **Reference-first matching** — deterministic and auditable; amount+date fallback
  is bounded to exact amount and same-day matches to avoid false positives.
- **Fail-closed adjustments** — a difference that cannot be classified produces no
  adjustment and surfaces as a blocker, protecting the ledger from invented
  entries.
