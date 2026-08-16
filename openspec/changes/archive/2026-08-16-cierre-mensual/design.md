# Design — Cierre Contable Mensual Engine

## Decision summary

A deterministic library module `close-calculations/` implementing the
[spec](spec.md): fixed-asset depreciation, provisions (receivables/inventory),
provisional ISR (pago a cuenta per LIR Art. 85), closing entries to retained
earnings, and a post-close report with the trial-balance identity check. Pure
TypeScript, zero runtime dependencies (node:crypto only), BigInt cents, one RUC +
one fiscal period per operation, fail-closed. No `flow/close.ts` wiring, no
mission/gate/receipt wiring, no MCP/CLI, no ledger writes in this slice.

## Module layout

```text
close-calculations/
  types.ts           canonical types: register, policies, inputs, entries, report
  depreciation.ts    fixed-asset monthly depreciation entries
  provisions.ts      receivables/inventory provision entries
  isr.ts             provisional ISR (pago a cuenta) entry
  close-results.ts   closing entries: result accounts -> retained earnings
  report.ts          post-close report + trial-balance identity
  index.ts           public surface (barrel)
  __tests__/         unit tests (strict TDD, vitest)
```

Layer: library module. It imports nothing from `agents/`, `cmd/`, `ledger/`,
`mcp/`, `adapters/`, or the sibling `bank-reconciliation/` (this slice); it MUST
NOT be imported by `ledger/` (audit-only stays untouched). Imports only within
`close-calculations/` plus `node:` builtins.

## Canonical types

```ts
type CloseSide = "debit" | "credit";              // journal/ alignment
type CloseScope = { ruc: string; period: string }; // period = YYYYMM

interface FixedAsset {
  id: string;                // stable asset id (sourceKey for auditability)
  description: string;
  costBasisCents: bigint;    // > 0, integer cents
  annualRateBp: number;      // annual depreciation rate in basis points (LIR-validated policy)
  acquisitionDate: IsoDate;  // YYYY-MM-DD
}

interface DepreciationPolicy {
  chart: ReadonlySet<string>;      // valid PCGE account codes (e.g. 391, 681)
  depreciationExpenseAccount: string; // e.g. "681" (gastos por depreciación)
  accumulatedDepreciationAccount: string; // e.g. "391" (depreciación acumulada)
}

interface ProvisionInput {
  id: string;
  agingDays: number;         // receivables: days past due; inventory: holding days
  exposureCents: bigint;     // cartera vencida / inventory value at risk
  provisionRateBp: number;   // policy rate in basis points (LIR-validated)
  kind: "receivable" | "inventory";
}

interface ProvisionalIsrInput {
  id: string;
  netIncomeCents: bigint;        // ingresos netos del mes
  priorYearRatioBp: number | null; // coeficiente (utilidad/ingresos), basis points; null = no prior-year
  monthlyNetIncomeCents: bigint;   // for the 1.5% path bound
  rule: "coeficiente" | "pct-ingresos" | "greater-of";
}

interface CloseEntry {
  id: string;                // deterministic, e.g. "depr-<n>", "prov-<n>", "isr-<n>", "close-<n>"
  scope: CloseScope;
  lines: readonly CloseLine[]; // balanced: sum(debit) === sum(credit)
  kind: "depreciation" | "provision" | "isr" | "closing";
}

interface CloseLine {
  accountCode: string;       // PCGE code, validated against the configured chart
  side: CloseSide;
  amountCents: bigint;       // > 0, integer cents
}

interface CloseReport {
  scope: CloseScope;
  entries: readonly CloseEntry[];
  trialBalanceBalanced: boolean; // sum(debit) === sum(credit) across all entries
  isrCedula: { coefficientPathCents: bigint; pctPathCents: bigint; appliedCents: bigint };
  balanceMovement: { beforeCents: bigint; afterCents: bigint }; // retained earnings
}
```

**Rounding rule (documented, deterministic).** Monthly depreciation =
`(costBasisCents * annualRateBp / 10000) / 12` computed with BigInt floor division
in that exact order; the remainder is deterministic (floor). This matches the
documented convention that monthly depreciation is the annual amount divided by
12, and keeps every intermediate value an integer cent. No float ever appears.

**Rates are policy, not code.** Annual rates and provision percentages are inputs
expressed in basis points and validated to be within a sane legal envelope
(positive, bounded — e.g. ≤ 100% annual); the exact LIR maxima are enforced by the
policy owner, not hardcoded. Example policy value in tests is marked as such.

## Depreciation (`depreciation.ts`)

- `computeDepreciation(scope, assets, policy)` returns `CloseEntry[]` (one entry
  per asset, or one aggregated entry — deterministic; design choice: one entry per
  asset keeps auditability per asset).
- Each entry: debit `depreciationExpenseAccount`, credit
  `accumulatedDepreciationAccount`, amount = monthly rule above.
- Fail-closed: zero/negative `costBasisCents` → `NEGATIVE_AMOUNT`; rate outside
  the validated envelope → `RATE_OUT_OF_BOUNDS`; account not in chart →
  `ACCOUNT_NOT_IN_CHART`. No partial result is ever returned as success.

## Provisions (`provisions.ts`)

- `computeProvisions(scope, inputs, policy)` returns `CloseEntry[]` (one per
  input).
- Amount = `exposureCents * provisionRateBp / 10000` (BigInt floor), debit
  provision expense, credit provision liability account.
- Fail-closed: `agingDays < 0`, `exposureCents <= 0`, or a rate outside the
  envelope → typed error. An input that cannot be classified by `kind` →
  `UNCLASSIFIABLE_INPUT` and produces NO entry (blocker surfaced, never guessed).

## Provisional ISR (`isr.ts`)

- `computeProvisionalIsr(scope, inputs)` returns `CloseEntry` + cédula figures.
- LIR Art. 85 rule: coefficient path = `priorYearRatioBp * netIncomeCents / 10000`;
  1.5% path = `150 * netIncomeCents / 10000` (150 bp = 1.5%); `rule: "greater-of"`
  applies the greater. All BigInt-exact.
- Entry: debit ISR expense, credit ISR payable, amount = applied path amount.
- Fail-closed: negative net income → `NEGATIVE_AMOUNT`; invalid scope →
  `INVALID_SCOPE`.

## Closing entries (`close-results.ts`)

- `closeResultAccounts(scope, balances, chart)` closes net result accounts
  (PCGE 12/13/14…) to retained earnings (PCGE 59).
- Balanced invariant: each produced entry MUST satisfy
  `sum(debit) === sum(credit)`; an unbalanced draft is a hard error
  (`UNBALANCED_ENTRY`), never a silent entry.

## Report (`report.ts`)

- `buildCloseReport(scope, entries, chart)` compiles:
  - `entries` (all produced entries),
  - `trialBalanceBalanced` — the identity check across every line of every entry,
  - `isrCedula` — coefficient and percentage path amounts plus the applied amount,
  - `balanceMovement` — retained-earnings balance before vs after the close.
- Fail-closed: no scope → `INVALID_SCOPE`; any unbalanced entry in the input
  rejects the report (never claims a balanced close it did not achieve).

## Error model

Typed errors (`CloseError`) with codes: `INVALID_SCOPE`, `NEGATIVE_AMOUNT`,
`UNBALANCED_ENTRY`, `RATE_OUT_OF_BOUNDS`, `UNCLASSIFIABLE_INPUT`,
`ACCOUNT_NOT_IN_CHART`. Fail-closed is explicit: no partial result is ever
returned as a success.

## Skill registry entries (conformance)

`skills/pe.ts` gains four `make(...)` entries joined into `BASE_PE_SKILLS` (7 → 11;
`pe-skills.test.ts` length assertion updated). Identical entries go into the
sibling manifest `../drenyra-skills/skills/registry.json`. Conformance compares six
fields: version, jurisdiction, maxAutonomy, normativeSources, inputs, outputs.

| id | version | jurisdiction | maxAutonomy | normativeSources | inputs | outputs |
| --- | --- | --- | --- | --- | --- | --- |
| `pe.depreciacion-activo-fijo` | 1.0.0 | PE | R1 | PCGE (R. SMV 043-2010-SMV/01), LIR (D.S. 179-2004-EF) | `["fixed-asset", "policy", "scope"]` | `["depreciation-entries"]` |
| `pe.provision-cartera` | 1.0.0 | PE | R1 | PCGE, LIR (provisiones), Código Tributario (D.S. 133-2013-EF) | `["receivables", "inventory", "policy", "scope"]` | `["provision-entries"]` |
| `pe.isr-mensual` | 1.0.0 | PE | R1 | LIR Art. 85 (D.S. 179-2004-EF) | `["net-income", "prior-year-ratio", "scope"]` | `["isr-entry", "cedula"]` |
| `pe.cierre-resultados` | 1.0.0 | PE | R1 | PCGE, NIC 1 | `["result-balances", "chart", "scope"]` | `["closing-entries"]` |

**Coordination with sibling change `conciliacion-bancaria` (active):** both changes
mutate `skills/pe.ts` and the sibling manifest. Apply must merge entries, keep
`skills:conformance` green, and update `pe-skills.test.ts` to the final count
(7 + 1 existing conciliacion entry already merged + 4 new = 12 once both changes
land; the cierre-mensual apply updates to 11 from its own baseline of 7+1=8 if
conciliacion is already applied, or coordinates with the sibling apply). The
integration point is the shared `BASE_PE_SKILLS` list — apply must read current
state, not assume a fixed baseline.

## Non-goals (restated)

No `flow/close.ts` orchestration wiring, no mission/gate/receipt wiring, no MCP
tools, no CLI commands, no real-ERP connectors, no Engram integration, no ledger
writes, no PCGE chart auto-discovery (chart is an explicit input), no
modification of `contracts/**`. Outputs are shaped so the next slice binds them to
the monthly-close vertical without rework.
