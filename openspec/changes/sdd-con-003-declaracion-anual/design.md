# Design — Annual Tax Declaration Engine (SDD-CON-003)

## Decision summary

- New pure library module `annual-declaration/` — deterministic Peruvian annual
  tax settlement (cierre fiscal definitivo), composed over the SDD-CON-002
  primitives (`closeResultAccounts`, shared invariants) and the `journal/`
  entry shape. No modification of `contracts/**`, `close-calculations/**`,
  `bank-reconciliation/**`; composition by import only.
- Money is BigInt cents everywhere; amounts travel as decimal strings only at
  module I/O boundaries where a caller supplies rows (monthly cédulas are
  already BigInt at the engine layer, mirroring `close-calculations`).
- Scope: one RUC (11 digits) + one fiscal year. The annual scope is a distinct
  type (`AnnualScope { ruc, year }`, `year` as `YYYY` string) because the
  existing `close-calculations` `Scope` is monthly (`YYYYMM`). The two types
  never clash in the star-export because the annual module uses its own names
  (`AnnualScope`, `AnnualEntry`, …) and reuses no exported names from
  `close-calculations` (verified against its barrel).
- Fail-closed: malformed/incomplete input is a typed `AnnualDeclarationError`;
  unbalanced output is a hard error; cross-RUC input is rejected before any
  computation; `buildAnnualDeclaration` is pure data (no I/O).
- Wiring follows the repo pattern: `tsconfig.json` + `tsconfig.build.json`
  include, `package.json` exports subpath `./annual-declaration`, root
  `index.ts` star-export (name-clash check in Module layout), capability matrix
  row `annual-declaration: implemented`.

## Module layout

```
annual-declaration/
  types.ts           — AnnualScope, monthly-input types, policies, cédulas, payload, error
  net-income.ts      — determineAnnualNetIncome() + countClosedMonthlyPeriods()
  isr.ts             — computeAnnualIsr()
  settlement.ts      — computeAnnualSettlement()
  close-results.ts   — closeAnnualResults() (composes closeResultAccounts)
  declaration.ts     — buildAnnualDeclaration()
  report.ts          — buildAnnualReport()
  index.ts           — public barrel
  __tests__/         — vitest per-module suites (strict TDD)
```

Star-export clash check against the existing root barrel (`index.ts` re-exports
`close-calculations` and every other module): all annual public names are
unique (`AnnualScope`, `AnnualEntry`, `AnnualKind`, `AnnualDeclarationError`,
`AnnualNetIncomeInput`, `AnnualIsrPolicy`, `AnnualSettlement`,
`MonthlyIsrCedula`, `AnnualDeclarationPayload`, `AnnualReport`,
`determineAnnualNetIncome`, `countClosedMonthlyPeriods`, `computeAnnualIsr`,
`computeAnnualSettlement`, `closeAnnualResults`, `buildAnnualDeclaration`,
`buildAnnualReport`). `close-calculations` exports `IsrCedula`, `CloseEntry`,
`CloseKind`, `CloseError`, `Scope`, `buildCloseReport` — none collide.

## Canonical types (`types.ts`)

```ts
/** One RUC (11 digits) + one fiscal year ("YYYY"). Distinct from monthly Scope. */
export interface AnnualScope {
 readonly ruc: string;
 readonly year: string; // "2025"
}

/** A monthly period that contributes to the annual net income. */
export interface AnnualMonthInput {
 readonly scope: AnnualScope & { readonly period: string }; // "2025-01".."2025-12"
 readonly closed: boolean; // false => INCOMPLETE_INPUT
 readonly netIncomeCents: bigint; // monthly net income, BigInt cents
}

/** Statutory reconciliation inputs (explicit, never auto-classified). */
export interface AnnualStatutoryAdjustments {
 readonly additionsCents: bigint; // adiciones (non-deductible, disallowed)
 readonly deductionsCents: bigint; // deducciones (allowed extra deductions)
}

export interface AnnualNetIncomeInput {
 readonly scope: AnnualScope;
 readonly months: readonly AnnualMonthInput[];
 readonly adjustments: AnnualStatutoryAdjustments;
}

/** ISR policy — rate is a policy input with a legal-entity default (2950 bp). */
export interface AnnualIsrPolicy {
 readonly statutoryRateBp?: number; // default 2950 (29.5%, LIR legal-entity rate)
 readonly maxStatutoryRateBp?: number; // default 10000 (100%): RATE_OUT_OF_BOUNDS above
}

/** One monthly provisional ISR cédula (pago a cuenta), already determined. */
export interface MonthlyIsrCedula {
 readonly scope: { readonly ruc: string; readonly period: string }; // "2025-01".."2025-12"
 readonly amountCents: bigint;
}

export type AnnualBalanceKind = "payable" | "in-favor" | "zero";

export interface AnnualSettlement {
 readonly scope: AnnualScope;
 readonly annualIsrCents: bigint;
 readonly provisionalCreditCents: bigint; // sum of the twelve monthly cédulas
 readonly balanceCents: bigint; // annualIsr - credit (may be negative => in-favor)
 readonly balanceKind: AnnualBalanceKind;
}

/** Balanced journal entry in the existing journal/ shape (CloseEntry-compatible). */
export type AnnualEntry = import("../close-calculations/index.js").CloseEntry;

export type AnnualDeclarationErrorCode =
 | "INVALID_SCOPE"
 | "CROSS_RUC_ACCESS"
 | "INCOMPLETE_INPUT"
 | "NEGATIVE_AMOUNT"
 | "RATE_OUT_OF_BOUNDS"
 | "UNBALANCED_ENTRY"
 | "ACCOUNT_NOT_IN_CHART";

export class AnnualDeclarationError extends Error {
 readonly code: AnnualDeclarationErrorCode;
 constructor(code: AnnualDeclarationErrorCode, message: string) {
  super(message);
  this.name = "AnnualDeclarationError";
  this.code = code;
 }
}
```

`AnnualEntry` aliases `CloseEntry` (the shared balanced-entry shape) so the
report and the closing entries stay structurally identical to SDD-CON-002
output — composition, not a fork.

## Per-module design

### `net-income.ts`

```ts
export function countClosedMonthlyPeriods(months: readonly AnnualMonthInput[]): number;
export function determineAnnualNetIncome(input: AnnualNetIncomeInput): bigint;
```

- `countClosedMonthlyPeriods` counts only `closed === true` months; pure count,
  no amounts.
- `determineAnnualNetIncome`:
  1. `assertAnnualScope(input.scope)` — RUC 11 digits, `year` matches `/^\d{4}$/`
     → else `INVALID_SCOPE`.
  2. Reject cross-RUC: every month's `scope.ruc` must equal `input.scope.ruc`,
     and every `period` must belong to the year (`period.slice(0,4) === year`)
     → else `CROSS_RUC_ACCESS`.
  3. Completeness: exactly 12 months (01..12 present) and all `closed === true`
     → else `INCOMPLETE_INPUT`. Adjustments are required inputs (type-level),
     so absence is a compile error, not a runtime partial.
  4. Sum `netIncomeCents` (BigInt), add `adjustments.additionsCents`, subtract
     `adjustments.deductionsCents`. No rounding — pure BigInt addition.
- Errors thrown: `INVALID_SCOPE`, `CROSS_RUC_ACCESS`, `INCOMPLETE_INPUT`.

### `isr.ts`

```ts
export function computeAnnualIsr(taxableBaseCents: bigint, policy?: AnnualIsrPolicy): bigint;
```

- `statutoryRateBp = policy?.statutoryRateBp ?? 2950`;
  `maxRateBp = policy?.maxStatutoryRateBp ?? 10000`.
- Rate bounds: `statutoryRateBp > 0 && statutoryRateBp <= maxRateBp` → else
  `RATE_OUT_OF_BOUNDS`. (Default max 10000 bp rejects the spec scenario's
  15000 bp; a normative envelope change is a policy update.)
- `taxableBaseCents < 0n` → `NEGATIVE_AMOUNT`.
- Result: BigInt floor `(base * rateBp) / 10000n` — integer division, fractional
  cent discarded (deterministic, documented; matches `close-calculations`
  rounding convention).

### `settlement.ts`

```ts
export function computeAnnualSettlement(
 scope: AnnualScope,
 annualIsrCents: bigint,
 monthlyCedulas: readonly MonthlyIsrCedula[],
): AnnualSettlement;
```

- Reject cross-RUC/out-of-year cédulas (`CROSS_RUC_ACCESS`) before computing.
- Completeness: exactly 12 cédulas, one per month 01..12 of `scope.year` →
  else `INCOMPLETE_INPUT` (no partial credit).
- `provisionalCreditCents = Σ amountCents` (BigInt); `balanceCents =
  annualIsrCents - provisionalCreditCents`; `balanceKind` = `payable` (>0) |
  `in-favor` (<0) | `zero` (=0). Returns the typed cédula with full breakdown.

### `close-results.ts`

```ts
export function closeAnnualResults(
 scope: AnnualScope,
 balances: readonly CloseLine[],
 chart: ReadonlySet<string>,
): AnnualEntry[];
```

- Composes `closeResultAccounts(monthlyScope, balances, chart)` from
  `close-calculations`, where `monthlyScope = { ruc: scope.ruc, period:
  scope.year + "12" }` — the year-end closing posts in December of the fiscal
  year. Inherits the balanced-entry invariant (`UNBALANCED_ENTRY`),
  `assertChartAccount` (`ACCOUNT_NOT_IN_CHART`), and the PCGE 59
  `RETAINED_EARNINGS_ACCOUNT` constant — composition, no reimplementation.
- The composition is thin: annual module converts the annual scope, delegates,
  and returns the entries untouched.

### `declaration.ts`

```ts
export interface AnnualDeclarationPayload {
 readonly scope: AnnualScope;
 readonly annualNetIncomeCents: bigint;
 readonly taxableBaseCents: bigint;
 readonly annualIsrCents: bigint;
 readonly provisionalCreditCents: bigint;
 readonly balanceCents: bigint;
 readonly balanceKind: AnnualBalanceKind;
 readonly cédulas: {
  readonly netIncome: AnnualNetIncomeInput;
  readonly isr: { readonly taxableBaseCents: bigint; readonly rateBp: number };
  readonly settlement: AnnualSettlement;
 };
}

export function buildAnnualDeclaration(input: {
 scope: AnnualScope;
 annualNetIncomeCents: bigint;
 taxableBaseCents: bigint;
 rateBp: number;
 settlement: AnnualSettlement;
}): AnnualDeclarationPayload;
```

- Pure data: fixed field order, stable names, deterministic — identical inputs
  yield deep-equal (byte-identical) payloads. No I/O, no network, no CDR.
- The payload is the deterministic input shape a future SUNAT DJ adapter
  consumes; `scope` is embedded so the adapter never guesses the RUC/year.

### `report.ts`

```ts
export interface AnnualReport {
 readonly entries: readonly AnnualEntry[];
 readonly trialBalanceBalanced: boolean;
 readonly settlement: AnnualSettlement;
 readonly retainedEarningsMovement: {
  readonly beforeCents: bigint;
  readonly afterCents: bigint;
 };
}

export function buildAnnualReport(input: {
 entries: readonly AnnualEntry[];
 settlement: AnnualSettlement;
 retainedEarningsBeforeCents: bigint;
}): AnnualReport;
```

- `trialBalanceBalanced` = every entry balanced across all lines (reuses the
  shared balanced check); false ⇒ `UNBALANCED_ENTRY` — the report is never
  emitted for an unbalanced state.
- `afterCents = beforeCents + netClosingMovement` where the closing movement is
  the sum of the PCGE 59 lines across entries (net of debit/credit).

### `index.ts` barrel

Exports the public surface: types (except the aliased `AnnualEntry` inline
import), the five compute/build functions, and `countClosedMonthlyPeriods`.

## Error model

`AnnualDeclarationError` with `code`:

| Code | Raised by | Semantics |
| --- | --- | --- |
| `INVALID_SCOPE` | net-income, close-results | RUC not 11 digits or year not `YYYY` |
| `CROSS_RUC_ACCESS` | net-income, settlement | input month/cédula RUC ≠ scope RUC, or period outside the year |
| `INCOMPLETE_INPUT` | net-income, settlement | missing/unclosed month, missing cédula, or absent statutory input |
| `NEGATIVE_AMOUNT` | isr | negative taxable base |
| `RATE_OUT_OF_BOUNDS` | isr | statutory rate outside the validated policy envelope |
| `UNBALANCED_ENTRY` | close-results (inherited), report | draft or state violates debits === credits |
| `ACCOUNT_NOT_IN_CHART` | close-results (inherited) | line account absent from the PCGE chart |

All errors fail closed: nothing computed, no partial entry, no silent
correction. Codes mirror the `close-calculations` conventions for the shared
invariants, so consumers already handling `CloseError` map 1:1.

## Wiring

- `tsconfig.json` + `tsconfig.build.json` `include`: add `"annual-declaration"`.
- `package.json` `exports`: add
  `"./annual-declaration": "./dist/annual-declaration/index.js"`.
- Root `index.ts`: add `export * from "./annual-declaration/index.js";`
  (clash-checked above).
- Capability matrix
  (`openspec/programs/drenyra-dominion/capability-matrix.yaml`): add row
  `annual-declaration: implemented # SDD-CON-003 — annual-declaration/ …`.

## Non-goals

- No modification of `contracts/**`, `close-calculations/**`,
  `bank-reconciliation/**`, or any existing module (composition only; the
  frozen-path diff is empty).
- No SUNAT submission, CDR, or official DJ form rendering; no FSD
  `declaracion` mission/gate/receipt wiring (next slice).
- No free-text adjustment classification; statutory adjustments are explicit
  typed inputs.
- No new PE skills in `skills/pe.ts` / `drenyra-skills` registry — deferred to
  the follow-up slice to keep this change inside the 300-line review budget.
- No ledger writes; ledger stays audit-only.
