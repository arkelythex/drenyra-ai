# Design — Conciliación Bancaria Engine

## Decision summary

A deterministic library module `bank-reconciliation/` implementing the
[spec](spec.md): canonical normalization, reference-first matching with
amount+same-day fallback, fail-closed adjustment drafts, and an executive report
with the reconciliation identity check. Pure TypeScript, zero runtime
dependencies (node:crypto only), BigInt cents, one RUC + one fiscal period per
operation. No adapters, missions, gates, receipts, or CLI in this slice.

## Module layout

```text
bank-reconciliation/
  types.ts        canonical types, scope, differences, adjustments, report
  normalize.ts    rows -> canonical movements (fail-closed)
  compare.ts      matching + difference classification
  adjust.ts       adjustment draft generation (fail-closed)
  report.ts       executive report + reconciliation identity
  index.ts        public surface (barrel)
  __tests__/      unit tests (strict TDD, vitest)
```

Layer: library module. It imports nothing from `agents/`, `cmd/`, or any adapter;
it MUST NOT be imported by `ledger/` (audit-only stays untouched). Imports only
within `bank-reconciliation/` plus `node:crypto` if hashing is ever needed (not
required for this slice — zero-dependency kept).

## Canonical movement

```ts
type MovementSide = "inflow" | "outflow";   // relative to the bank/cash account
type MovementSource = "bank" | "ledger";

interface Movement {
  date: IsoDate;             // YYYY-MM-DD
  reference: string;         // normalized, trimmed, case-folded
  amountCents: bigint;       // > 0, integer cents; never float
  side: MovementSide;
  source: MovementSource;
  sourceKey: string;         // unique id within its source set (auditability)
}

interface Scope { ruc: string; period: string; } // period = YYYYMM
```

**Side mapping (deterministic, documented rationale).** Bank statements report
deposits/withdrawals; the ledger reports debit/credit. For the PCGE asset account
"Bancos", a debit increases the balance and a credit decreases it. Normalization
therefore maps: bank deposit → `inflow`; bank withdrawal → `outflow`; ledger
debit → `inflow`; ledger credit → `outflow`. This single canonical frame makes
amounts directly comparable and keeps the engine independent of source dialects.

**Amount rule.** `amountCents` is always a positive BigInt; direction lives in
`side`. A negative or fractional-cent amount is a normalization error.

## Normalization (`normalize.ts`)

- `normalizeBankRows(scope, rows)` and `normalizeLedgerRows(scope, rows)` each
  return `{ movements, rejected }`.
- A row that cannot be parsed (missing date, empty reference, non-integer
  amount, unknown side token) is `rejected` with a typed reason — NEVER skipped
  silently and NEVER partially accepted. An empty `rejected` array is a
  precondition for `reconcile()`.
- `reference` normalization: trim, collapse internal whitespace, case-fold.
- Every row is bound to the caller's `scope`; rows carrying a foreign RUC are
  rejected (tenant isolation, fail-closed).

## Matching (`compare.ts`)

`reconcile(scope, bank, ledger, opts)` returns the full `Reconciliation`:

1. **Reference-first pass.** Index ledger movements by `reference`; for each
   bank movement, match a single ledger movement with the same normalized
   reference. A reference that matches more than one counterpart is a
   `conflict` (never guessed), and none of the candidates is auto-matched.
2. **Fallback pass (amount + same day).** For unmatched movements only: exact
   `amountCents` AND equal `date`, with equal canonical `side` (both frames are
   already canonical, so sides must agree). One-to-one greedy in deterministic
   order (sorted by `sourceKey`).
3. **Classification.** Every movement ends as exactly one of: `matched`
   (pair `{ bank, ledger }`), `bankOnly`, `ledgerOnly`, or `conflict`
   (ambiguous reference — surfaced, not matched).

Fail-closed: amount alone or date alone NEVER matches. A difference that cannot
be classified is surfaced as a blocker, never hidden.

## Adjustments (`adjust.ts`)

`buildAdjustments(differences, opts)` produces `AdjustmentDraft[]`:

```ts
interface AdjustmentDraft {
  draftId: string;          // deterministic, e.g. adj-<n>
  reference: string;        // originating bank/ledger reference
  source: MovementSource;
  amountCents: bigint;
  side: MovementSide;       // effect on the Bancos account
  justification: string;    // human-reviewable, references the movement
  requireApproval: boolean; // from opts or default true
  status: "draft" | "pending-approval";
}
```

- Only `bankOnly` / `ledgerOnly` differences generate drafts. `matched` and
  `conflict` never do; unclassified states produce a blocker entry, not a draft.
- `opts.requireApproval` defaults to `true`; per-draft override allowed.
- No account-code classification in this slice (that needs the PCGE chart and
  Engram memory of prior classifications — a later slice). The draft carries the
  effect on Bancos and a justification, which is the verifiable core.

## Report (`report.ts`)

`buildReport(reconciliation, balances)` compiles:

- `balances`: bankInitial, bankFinal (from bank statement), ledgerInitial,
  ledgerFinal (from scope/ledger query).
- `differences`: full detail of matched / bankOnly / ledgerOnly / conflict.
- `adjustments`: drafts with `netAdjustmentCents = Σ inflow − Σ outflow`.
- `reconciled: boolean` — the identity check:
  `ledgerFinal + netAdjustmentCents === bankFinal`.
  When unmatched differences exist, `reconciled` MUST be `false` (fail-closed;
  the report never claims reconciliation it did not achieve).

## Error model

Typed errors (`ReconciliationError`) with codes: `INVALID_SCOPE`,
`NORMALIZATION_REJECTED`, `CROSS_RUC_ACCESS`, `NEGATIVE_AMOUNT`,
`FRACTIONAL_CENTS`, `UNCLASSIFIED_DIFFERENCE`. Fail-closed is explicit: no
partial result is ever returned as a success.

## Skill registry entry (conformance)

`skills/pe.ts` gains a `make(...)` entry and joins `BASE_PE_SKILLS`:

| field | value |
| --- | --- |
| id | `pe.conciliacion-bancaria` |
| version | `1.0.0` |
| jurisdiction | `PE` |
| maxAutonomy | `R1` |
| normativeSources | `["PCGE — Plan Contable General Empresarial (R. SMV 043-2010-SMV/01)", "NIC 1 — Presentación de Estados Financieros", "Código Tributario — D.S. 133-2013-EF"]` |
| inputs | `["bank-statement", "ledger", "scope"]` |
| outputs | `["differences", "adjustments", "reconciliation-report"]` |

`scripts/skills-conformance.mjs` compares exactly those six fields
(version, jurisdiction, maxAutonomy, normativeSources, inputs, outputs) by JSON
equality against `../drenyra-skills/skills/registry.json`; the sibling manifest
entry MUST carry identical values (authored in the drenyra-skills workstream).

## Non-goals (restated)

No MCP tools, no mission/gate/receipt wiring, no real-bank parsers or mocks, no
Engram integration, no CLI commands, no PCGE account-code classification, no
ledger writes. Outputs are shaped so the next slice binds them to missions and
receipts without rework.
