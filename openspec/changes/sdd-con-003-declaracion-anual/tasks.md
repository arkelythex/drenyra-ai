# Tasks — Declaración Anual Engine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–450 authored lines across the chain (≈150–220 per PR) |
| 400-line budget risk | High (aggregate exceeds the 300-line budget as one unit) / Low–Medium per PR |
| Chained PRs recommended | Yes (exceeds the 300-line review budget) |
| Suggested split | PR1 → types + net-income + isr + settlement (+ their tests); PR2 → close-results + declaration + report + wiring (+ their tests) |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

**Forecast notes (read before apply):** The aggregate change (~8 source modules + 7 test suites + wiring) is forecast to exceed the 300-line review budget set in `openspec/config.yaml` (`review_budget_lines: 300`). Chained PRs are therefore recommended: PR1 ships the deterministic calculation core (types, net-income, isr, settlement) and PR2 ships the composition + report + barrel + wiring (close-results, declaration, report, index). Each PR stays under the budget where possible. Strict TDD is active: `bun run test` (vitest), `bun run typecheck`, `bun run build`. Money is BigInt cents; no floats. `annual-declaration/` composes over the SDD-CON-002 primitives (`closeResultAccounts`, `assertBalanced`, `assertChartAccount`, `RETAINED_EARNINGS_ACCOUNT`, `CloseLine`, `CloseEntry`) by import only and MUST NOT modify `contracts/**`, `close-calculations/**`, or `bank-reconciliation/**`.

**Composition reference (read before apply):** `close-calculations/index.ts` exports `closeResultAccounts` and `close-results.ts`/`types.ts` export `assertBalanced`, `assertChartAccount`, `RETAINED_EARNINGS_ACCOUNT` (= `"59"`), `CloseLine`, and `CloseEntry`. The annual module reuses these names (no re-declaration): `AnnualEntry` aliases `CloseEntry`; `closeAnnualResults` converts the annual scope to a monthly December scope and delegates. Star-export clash check vs the root barrel is documented in the design; all annual public names are unique.

---

## How to read this task list

- **Ownership markers**: each checkbox ends with exactly one terminal `<!-- sdd-owner: ... -->`. `implementation` covers RED/GREEN/TRIANGULATE/REFACTOR, code, tests, exports, wiring, and apply-owned verification. `parent` covers only explicit post-apply bounded review and lifecycle-gate actions, grouped separately at the end.
- **Work-unit mapping**: the leading `[W1|W2|W3|W4|W5]` tag marks the work unit a task belongs to; each unit has a clear start, finish, verification, and rollback boundary. PR1 ships W1–W3, PR2 ships W4–W5 (chain strategy: feature-branch-chain).
- **Conventions**: every task that adds behavior starts with a failing test (RED) before implementation (GREEN); boundaries follow via TRIANGULATE/REFACTOR. Full suite `bun run test` plus `bun run typecheck` and `bun run build` must pass after each slice.
- **Journal shape (existing `journal/`)**: `JournalLine { accountCode, side: "debit" | "credit", amountCents: bigint }`; `JournalEntry { id, scope, lines, evidence, status }`. Annual closing entries alias the SDD-CON-002 `CloseEntry`/`CloseLine` shape; the spec's journal-shape conformance requirement is validated on the produced entries.
- **Exact numbers from spec scenarios**: 12 closed months summing `12_000_000n` + additions `500_000n` − deductions `200_000n` = `12_300_000n`; ISR `10_000_000n` × 2950bp = `2_950_000n`; floor `3_333_333n`×2950/10000 = `983_333n`; payable `2_500_000n` vs `2_000_000n` → `500_000n` payable; in-favor `2_500_000n` vs `2_700_000n` → `200_000n`; zero `2_500_000n` vs `2_500_000n`; `RATE_OUT_OF_BOUNDS` at 15000bp; `NEGATIVE_AMOUNT` at `−500_000n`.

---

## Phase 1 — Planning / completion (W1 · PR1)

- [x] `[W1]` Confirm slice start state: `annual-declaration/` does not exist; `close-calculations/` already exports `closeResultAccounts`, `assertBalanced`, `assertChartAccount`, `RETAINED_EARNINGS_ACCOUNT`, `CloseLine`, `CloseEntry`; root `package.json` exports already lists `./close-calculations`; `capability-matrix.yaml` already lists `close-calculations: implemented`. Record that no annual public name collides with the existing root barrel (per the design clash check). <!-- sdd-owner: implementation -->
- [x] `[W1]` Define the annual error-model contract in `annual-declaration/types.ts`: `AnnualDeclarationError` with codes `INVALID_SCOPE`, `CROSS_RUC_ACCESS`, `INCOMPLETE_INPUT`, `NEGATIVE_AMOUNT`, `RATE_OUT_OF_BOUNDS`, `UNBALANCED_ENTRY`, `ACCOUNT_NOT_IN_CHART`; no partial result is ever returned as a success; shared `UNBALANCED_ENTRY`/`ACCOUNT_NOT_IN_CHART` map 1:1 to the inherited `close-calculations` invariants. <!-- sdd-owner: implementation -->

## Phase 2 — Types (W1 · PR1)

- [x] `[W1]` RED — in `annual-declaration/__tests__/types/boundary.test.ts`, write failing tests for the canonical types and scope validation: `AnnualScope` (RUC 11 digits, `year` matches `/^\d{4}$/`); `AnnualMonthInput` (period `YYYY-MM`, `closed` flag, `netIncomeCents` BigInt); `AnnualStatutoryAdjustments`, `AnnualNetIncomeInput`, `AnnualIsrPolicy` (default `statutoryRateBp` 2950, `maxStatutoryRateBp` 10000), `MonthlyIsrCedula`, `AnnualSettlement`, `AnnualBalanceKind` (`"payable" | "in-favor" | "zero"`); `AnnualEntry` aliases `CloseEntry`. <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement `annual-declaration/types.ts` per the design block: flat interfaces, const-object types, `AnnualEntry = import("../close-calculations/index.js").CloseEntry`, `AnnualDeclarationError` class with a readonly `code`. No `any`. <!-- sdd-owner: implementation -->
- [x] `[W1]` TRIANGULATE — add boundary tests proving malformed RUC (not 11 digits) and non-`YYYY` year are typed to fail as `INVALID_SCOPE`; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 3 — Annual net income (W1 · PR1)

- [x] `[W1]` RED — in `annual-declaration/__tests__/net-income.test.ts`, write failing tests for `countClosedMonthlyPeriods` and `determineAnnualNetIncome`: valid scope; malformed scope → `INVALID_SCOPE`; cross-RUC month or out-of-year period → `CROSS_RUC_ACCESS`; eleven closed months → `INCOMPLETE_INPUT`; an unclosed month → `INCOMPLETE_INPUT`; twelve closed months summing `12_000_000n` + additions `500_000n` − deductions `200_000n` = `12_300_000n`; helper returns `12` closed periods ignoring one unclosed, computing no amount. <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement `annual-declaration/net-income.ts`: `countClosedMonthlyPeriods` counts only `closed === true` months (pure count); `determineAnnualNetIncome` validates scope, rejects cross-RUC/out-of-year periods, enforces exactly 12 closed months (01..12 present), then BigInt-sums net incomes + additions − deductions with no rounding. <!-- sdd-owner: implementation -->
- [x] `[W1]` TRIANGULATE — add a twelve-month set where periods are out of ascending order and a set with duplicate months; both must still fail closed on completeness; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 4 — Annual ISR liability (W2 · PR1)

- [x] `[W2]` RED — in `annual-declaration/__tests__/isr.test.ts`, write failing tests for `computeAnnualIsr(taxableBaseCents, policy?)`: default rate 2950bp applied to `10_000_000n` → `2_950_000n`; configured 2950bp on `3_333_333n` → `983_333n` (BigInt floor); rate 15000bp → `RATE_OUT_OF_BOUNDS`; base `−500_000n` → `NEGATIVE_AMOUNT`; custom `maxStatutoryRateBp` boundary accepted/denied. <!-- sdd-owner: implementation -->
- [x] `[W2]` GREEN — implement `annual-declaration/isr.ts`: `statutoryRateBp = policy?.statutoryRateBp ?? 2950`, `maxRateBp = policy?.maxStatutoryRateBp ?? 10000`; reject `statutoryRateBp <= 0 || > maxRateBp` → `RATE_OUT_OF_BOUNDS`; reject `taxableBaseCents < 0n` → `NEGATIVE_AMOUNT`; return `(base * rateBp) / 10000n` (BigInt floor, fractional cent discarded). <!-- sdd-owner: implementation -->
- [x] `[W2]` TRIANGULATE — add a rate exactly at `maxStatutoryRateBp` (accepted) and one just above (rejected); confirm `0n` base → `0n` liability; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 5 — Annual settlement (W2 · PR1)

- [x] `[W2]` RED — in `annual-declaration/__tests__/settlement.test.ts`, write failing tests for `computeAnnualSettlement(scope, annualIsrCents, monthlyCedulas)`: twelve cédulas summing `2_000_000n` vs annual ISR `2_500_000n` → `payable` `500_000n`; summing `2_700_000n` → `in-favor` `200_000n`; summing exactly `2_500_000n` → `zero` `0n`; cross-RUC or out-of-year cédula → `CROSS_RUC_ACCESS`; fewer than twelve cédulas → `INCOMPLETE_INPUT`; full breakdown (annualIsr, credit, balance, kind) present in the returned cédula. <!-- sdd-owner: implementation -->
- [x] `[W2]` GREEN — implement `annual-declaration/settlement.ts`: reject cross-RUC/out-of-year cédulas before computing; enforce exactly 12 cédulas (one per month 01..12) → else `INCOMPLETE_INPUT`; `provisionalCreditCents = Σ amountCents`; `balanceCents = annualIsrCents − credit`; `balanceKind` = `payable` (>0) | `in-favor` (<0) | `zero` (=0); return the typed `AnnualSettlement`. <!-- sdd-owner: implementation -->
- [x] `[W2]` TRIANGULATE — add duplicate-month and missing-month cédula sets (both → `INCOMPLETE_INPUT`); run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 6 — Slice verification (PR1 gate)

- [x] `[W2]` Add `annual-declaration/index.ts` barrel exporting the W1–W2 public surface only: types (`AnnualScope`, `AnnualMonthInput`, `AnnualStatutoryAdjustments`, `AnnualNetIncomeInput`, `AnnualIsrPolicy`, `MonthlyIsrCedula`, `AnnualSettlement`, `AnnualBalanceKind`, `AnnualDeclarationError`) and functions (`countClosedMonthlyPeriods`, `determineAnnualNetIncome`, `computeAnnualIsr`, `computeAnnualSettlement`). <!-- sdd-owner: implementation -->
- [x] `[W2]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm PR1 changed lines stay within the 300-line budget. <!-- sdd-owner: implementation -->

## Phase 7 — Year-end closing + declaration + report (W3 · PR2)

- [x] `[W3]` RED — in `annual-declaration/__tests__/close-results.test.ts`, write failing tests for `closeAnnualResults(scope, balances, chart)`: result accounts `70` (credit `500_000n`) and `60` (debit `200_000n`) close balanced into PCGE `59` with positive amounts; unbalanced draft → `UNBALANCED_ENTRY` (inherited, never auto-corrected); account absent from chart → `ACCOUNT_NOT_IN_CHART`; invalid scope → `INVALID_SCOPE`; entries carry the December period (`year + "12"`). <!-- sdd-owner: implementation -->
- [x] `[W3]` GREEN — implement `annual-declaration/close-results.ts`: convert the annual scope to `{ ruc, period: scope.year + "12" }` and delegate to `closeResultAccounts`; return the entries untouched (thin composition, no reimplementation of balance/chart invariants). <!-- sdd-owner: implementation -->
- [x] `[W3]` RED — in `annual-declaration/__tests__/declaration.test.ts`, write failing tests for `buildAnnualDeclaration`: given a completed settlement it returns a payload with RUC, fiscal year, net income, taxable base, ISR, credit, balance amount and kind, and the supporting cédulas (net income, isr with rateBp, settlement); two invocations with identical inputs are deep-equal; the payload is pure data with no I/O side effect. <!-- sdd-owner: implementation -->
- [x] `[W3]` GREEN — implement `annual-declaration/declaration.ts`: stable field names and fixed ordering; `AnnualDeclarationPayload` embeds `scope`; pure deterministic data assembly, no I/O, no network, no CDR. <!-- sdd-owner: implementation -->
- [x] `[W3]` RED — in `annual-declaration/__tests__/report.test.ts`, write failing tests for `buildAnnualReport`: balanced entries → report states entries, `trialBalanceBalanced === true`, settlement cédula, PCGE 59 movement before/after; unbalanced entries → `UNBALANCED_ENTRY` (never emitted); `afterCents = beforeCents + netClosingMovement` across PCGE 59 lines. <!-- sdd-owner: implementation -->
- [x] `[W3]` GREEN — implement `annual-declaration/report.ts`: reuse the shared balanced check across all entry lines; reject unbalanced state with `UNBALANCED_ENTRY`; compute PCGE 59 net closing movement from the entries and derive `afterCents`. <!-- sdd-owner: implementation -->
- [x] `[W3]` TRIANGULATE — add a report scenario with multiple entries where one line touches PCGE 59 on debit and one on credit (net movement correct); add a closing scenario with a zero-balance account skipped; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 8 — Barrel + wiring (W4 · PR2)

- [x] `[W4]` Add the W3–W4 public functions to `annual-declaration/index.ts`: `closeAnnualResults`, `buildAnnualDeclaration`, `buildAnnualReport`, plus the remaining exported types (`AnnualEntry`, `AnnualDeclarationPayload`, `AnnualReport`, `AnnualDeclarationErrorCode`). <!-- sdd-owner: implementation -->
- [x] `[W4]` Add an import-boundary test asserting `annual-declaration/` imports no project module beyond `close-calculations/` and no `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, or `bank-reconciliation/` path, and no third-party runtime dependency beyond `node:` builtins; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[W4]` Module wiring per repo pattern: add `annual-declaration` to the `include` of `tsconfig.json` and `tsconfig.build.json`; add `"./annual-declaration": "./dist/annual-declaration/index.js"` to the `package.json` exports map; add `export * from "./annual-declaration/index.js";` to the root `index.ts` barrel (clash-checked); `bun run build` MUST emit `dist/annual-declaration/`. <!-- sdd-owner: implementation -->
- [x] `[W4]` Capability matrix — add row `annual-declaration: implemented # SDD-CON-003 — annual-declaration/ (net-income/isr/settlement/close-results/declaration/report)` to `openspec/programs/drenyra-dominion/capability-matrix.yaml` under the `drenyra-ai` `capabilities` list. <!-- sdd-owner: implementation -->
- [x] `[W4]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm PR2 changed lines stay within the 300-line budget. <!-- sdd-owner: implementation -->

## Phase 9 — Final integration verification (W5 · PR2)

- [x] `[W5]` Run the full regression: `bun run test`, `bun run typecheck`, `bun run build`; all green with no frozen-contract delta. <!-- sdd-owner: implementation -->
- [x] `[W5]` Frozen-path verification — diff `contracts/**`, `close-calculations/**`, and `bank-reconciliation/**` against pre-change state; the diff is empty (composition only). <!-- sdd-owner: implementation -->
- [x] `[W5]` Runtime-surface verification — scan `annual-declaration/` runtime imports; only Node built-ins and intra-repository modules (specifically `close-calculations/`) are imported, no third-party runtime dependency. <!-- sdd-owner: implementation -->
- [x] `[W5]` Map each spec requirement to completion evidence: annual scope isolation (R1), annual net income determination (R2), annual ISR liability (R3), annual settlement against cumulative provisional payments (R4), year-end closing of result accounts to retained earnings (R5), structured annual declaration payload (R6), annual settlement report with balance identity (R7), composition without modification of frozen modules (R8), closed-month counting helper (R9). <!-- sdd-owner: implementation -->
- [x] `[W5]` Confirm no out-of-scope surface shipped: no FSD `declaracion` mission/gate/receipt wiring, no SUNAT submission/CDR/DJ rendering, no `flow/` orchestration, no free-text adjustment classification, no new PE skills, no ledger writes, no `contracts/**` changes. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [x] Ship the work units as two chained PRs under feature-branch-chain strategy: PR1 (W1–W3, calculation core) then PR2 (W4–W5, composition + report + barrel + wiring); validate each PR candidate per native review contract before merge. <!-- sdd-owner: parent -->
- [x] Run post-apply bounded review of each PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [x] Validate the integrated change: full suite green, no frozen-contract delta, then merge to main. <!-- sdd-owner: parent -->
