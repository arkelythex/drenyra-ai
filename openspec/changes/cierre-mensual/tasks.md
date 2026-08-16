# Tasks — Cierre Contable Mensual Engine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950–1,150 authored lines across the chain (≈180–280 per work-unit) |
| 400-line budget risk | High (total exceeds 400 as one unit) / Low–Medium per work-unit |
| Chained PRs recommended | No (user decision: single PR, size exception recorded) |
| Suggested split | Work units W1 (planning+types) → W2 (depreciation+provisions) → W3 (isr+close-results) → W4 (report+barrel+wiring) → W5 (skills+conformance) as commits within one PR |
| Delivery strategy | single-pr (user decision; size exception recorded per openspec config `review_budget_lines: 300`) |
| Chain strategy | n/a (single PR) |

```text
Decision needed before apply: No
Chained PRs recommended: No (user decision: single-pr with size exception)
Chain strategy: n/a
400-line budget risk: High
```

**Forecast notes (read before apply):** The user chose a single PR with a recorded size exception (`openspec/config.yaml` sets `review_budget_lines: 300`; the change exceeds that aggregate and the exception is recorded). Work units W1–W5 ship as sequential commits within that one PR, each kept under the 300-line review budget where possible. Strict TDD is active: `bun run test` (vitest), `bun run typecheck`, `bun run build`. Money is BigInt cents; no floats. `close-calculations/` is a pure library module importing only within itself plus `node:` builtins (zero deps); it MUST NOT be imported by `ledger/`, and it imports nothing from `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, or the sibling `bank-reconciliation/` in this slice.

**Sibling coordination (read before apply):** The sibling change `conciliacion-bancaria` is ACTIVE and mutates the same files (`skills/pe.ts`, `skills/__tests__/pe-skills.test.ts`, `../drenyra-skills/skills/registry.json`). Do NOT assume a fixed baseline — read the current state of each file at apply time. As of this task, `skills/pe.ts` holds 7 entries (including `pe.conciliacion-bancaria`), `pe-skills.test.ts` asserts `BASE_PE_SKILLS.length === 7` plus an exact id list, and the sibling manifest holds the 6-field `pe.conciliacion-bancaria` entry. This change adds 4 entries → final count 11. If the sibling has not yet landed by apply time, coordinate merges so `skills:conformance` stays green and the counts reconcile to 11 (or the agreed merged total).

---

## How to read this task list

- **Ownership markers**: each checkbox ends with exactly one terminal `<!-- sdd-owner: ... -->`. `implementation` covers RED/GREEN/TRIANGULATE/REFACTOR, code, tests, exports, wiring, and apply-owned verification. `parent` covers only explicit post-apply bounded review and lifecycle-gate actions, grouped separately at the end.
- **Work-unit mapping**: the leading `[W1|W2|W3|W4|W5]` tag marks the work unit a task belongs to; each unit has a clear start, finish, verification, and rollback boundary and maps to one sequential commit inside the single PR.
- **Conventions**: every task that adds behavior starts with a failing test (RED) before implementation (GREEN); boundaries follow via TRIANGULATE/REFACTOR. Full suite `bun run test` plus `bun run typecheck` and `bun run build` must pass after each slice.
- **Journal shape (existing `journal/`)**: `JournalLine { accountCode, side: "debit" | "credit", amountCents: bigint }`; `JournalEntry { id, scope, lines, evidence, status }`. Close modules emit their own balanced `CloseEntry`/`CloseLine` aligned to this shape; the spec's journal-shape conformance requirement is validated on the produced entries.

---

## Phase 1 — Planning / completion (W1)

- [x] `[W1]` Confirm slice start state: `close-calculations/` does not exist; `skills/pe.ts` has no `pe.depreciacion-activo-fijo`, `pe.provision-cartera`, `pe.isr-mensual`, or `pe.cierre-resultados` entry; the sibling `drenyra-skills/skills/registry.json` has none either. Record the current `BASE_PE_SKILLS.length` and exact id list from `skills/__tests__/pe-skills.test.ts` (7 at apply time) — both MUST be updated to the final count when the entries ship. <!-- sdd-owner: implementation -->
- [x] `[W1]` Define the shared error-model contract used across all modules: `CloseError` with codes `INVALID_SCOPE`, `NEGATIVE_AMOUNT`, `UNBALANCED_ENTRY`, `RATE_OUT_OF_BOUNDS`, `UNCLASSIFIABLE_INPUT`, `ACCOUNT_NOT_IN_CHART`; no partial result is ever returned as a success. <!-- sdd-owner: implementation -->

## Phase 2 — Types (W1)

- [x] `[W1]` RED — in `close-calculations/__tests__/types.test.ts`, write failing tests for the canonical types and shared invariants: `Scope` (RUC 11 digits + YYYYMM), `validateScope`, `assertChartAccount`, `assertRateInBounds`, `assertBalanced` (debits === credits, sealed sides, positive BigInt cents), the sealed constants (`CLOSE_SIDE`, `CLOSE_KIND`, `PROVISION_KIND`, `ISR_RULE`, `MAX_RATE_BP`, `RETAINED_EARNINGS_ACCOUNT`). <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement `close-calculations/types.ts`: canonical types, `CloseError`, scope/chart/rate/balance validation, sealed unions; const-object types and flat interfaces; no `any`. <!-- sdd-owner: implementation -->
- [x] `[W1]` TRIANGULATE — add boundary tests proving a `FixedAsset` cost cannot be a Number (type-level guard) and every validation rejects the exact fail-closed codes. <!-- sdd-owner: implementation -->

## Phase 3 — Depreciation (W2)

- [x] `[W2]` RED — in `close-calculations/__tests__/depreciation.test.ts`, write failing tests: `computeDepreciation(scope, assets, policy)` produces one balanced entry per asset at the BigInt floor `(cost*rate/10000)/12`; zero/negative cost → `NEGATIVE_AMOUNT`; rate outside envelope → `RATE_OUT_OF_BOUNDS`; monthly rounding to zero → `NEGATIVE_AMOUNT`; account not in chart → `ACCOUNT_NOT_IN_CHART`; invalid scope → `INVALID_SCOPE`. <!-- sdd-owner: implementation -->
- [x] `[W2]` GREEN — implement `close-calculations/depreciation.ts` with the documented BigInt floor and the shared invariants. <!-- sdd-owner: implementation -->
- [x] `[W2]` TRIANGULATE — add floor-rounding and multi-asset boundary cases; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 4 — Provisions (W2)

- [x] `[W2]` RED — in `close-calculations/__tests__/provisions.test.ts`, write failing tests: `computeProvisions` produces one balanced entry per classified input at `exposure*rate/10000`; unclassifiable kind → `UNCLASSIFIABLE_INPUT` with NO entry; negative aging / zero exposure / rounding-to-zero → `NEGATIVE_AMOUNT`; account not in chart → `ACCOUNT_NOT_IN_CHART`; invalid scope → `INVALID_SCOPE`. <!-- sdd-owner: implementation -->
- [x] `[W2]` GREEN — implement `close-calculations/provisions.ts`. <!-- sdd-owner: implementation -->
- [x] `[W2]` TRIANGULATE — add floor-rounding and multi-input boundary cases; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 5 — Provisional ISR (W3)

- [x] `[W3]` RED — in `close-calculations/__tests__/isr.test.ts`, write failing tests: coefficient path, statutory-minimum path (1.5% = 150 bp), greater-of, greater-of fallback to minimum without prior-year ratio, coefficient rule without ratio → `RATE_OUT_OF_BOUNDS`, negative net income → `NEGATIVE_AMOUNT`, unsupported rule → `UNCLASSIFIABLE_INPUT`, zero pago a cuenta → `NEGATIVE_AMOUNT`, invalid scope → `INVALID_SCOPE`. <!-- sdd-owner: implementation -->
- [x] `[W3]` GREEN — implement `close-calculations/isr.ts` per LIR Art. 85 (coefficient vs 150 bp statutory minimum, BigInt-exact). <!-- sdd-owner: implementation -->
- [x] `[W3]` TRIANGULATE — add cédula and cross-path boundary cases; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 6 — Closing entries (W3)

- [x] `[W3]` RED — in `close-calculations/__tests__/close-results.test.ts`, write failing tests: revenue (credit balance) closes with a debit into PCGE 59, expense (debit balance) closes with a credit, zero balances skipped, account not in chart → `ACCOUNT_NOT_IN_CHART`, PCGE 59 as source → `UNCLASSIFIABLE_INPUT`, invalid scope → `INVALID_SCOPE`. <!-- sdd-owner: implementation -->
- [x] `[W3]` GREEN — implement `close-calculations/close-results.ts`. <!-- sdd-owner: implementation -->
- [x] `[W3]` TRIANGULATE — add multi-account and direction boundary cases; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 7 — Report + barrel + wiring (W4)

- [x] `[W4]` RED — in `close-calculations/__tests__/report.test.ts`, write failing tests: `buildCloseReport` compiles entries, `trialBalanceBalanced`, ISR cédula, retained movement before/after; unbalanced state → `UNBALANCED_ENTRY` (never emitted); account not in chart → `ACCOUNT_NOT_IN_CHART`; invalid scope → `INVALID_SCOPE`. <!-- sdd-owner: implementation -->
- [x] `[W4]` GREEN — implement `close-calculations/report.ts` with the trial-balance identity check. <!-- sdd-owner: implementation -->
- [x] `[W4]` Add `close-calculations/index.ts` barrel exporting only the public surface (computeDepreciation, computeProvisions, computeProvisionalIsr, closeResultAccounts, buildCloseReport, and all types). <!-- sdd-owner: implementation -->
- [x] `[W4]` Add an import-boundary test asserting `close-calculations/` imports no project module and no `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, or `bank-reconciliation/` path; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[W4]` Module wiring per repo pattern: add `close-calculations` to `tsconfig.json` and `tsconfig.build.json` include, add `./close-calculations` to the `package.json` exports map, add `export * from "./close-calculations/index.js"` to the root `index.ts` barrel; `bun run build` MUST emit `dist/close-calculations/`. <!-- sdd-owner: implementation -->
- [x] `[W4]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 8 — Skills + conformance (W5)

- [x] `[W5]` RED — in `skills/__tests__/pe-skills.test.ts`, write/update failing tests: `BASE_PE_SKILLS.length` becomes `11` and the sorted id list gains `pe.depreciacion-activo-fijo`, `pe.provision-cartera`, `pe.isr-mensual`, `pe.cierre-resultados`; each new entry registers and resolves at a date in validity with a 64-char checksum. <!-- sdd-owner: implementation -->
- [x] `[W5]` Add the four entries to `skills/pe.ts` via `make(...)` joining `BASE_PE_SKILLS` per the design table (id/version/jurisdiction/maxAutonomy/normativeSources/inputs/outputs). <!-- sdd-owner: implementation -->
- [x] `[W5]` Add the identical entries to the sibling authoring manifest `drenyra-skills/skills/registry.json` matching exactly the six conformance fields. <!-- sdd-owner: implementation -->
- [x] `[W5]` Conformance — run `bun run skills:conformance` and confirm it passes (no drift between the manifest and runtime `BASE_PE_SKILLS` on the six fields). <!-- sdd-owner: implementation -->
- [x] `[W5]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`, `bun run skills:conformance`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 9 — Final integration verification (W5)

- [x] `[W5]` Run the full regression: `bun run test`, `bun run typecheck`, `bun run build`, and `bun run skills:conformance`; all green with no frozen contract or conformance delta. <!-- sdd-owner: implementation -->
- [x] `[W5]` Map each spec requirement to completion evidence: depreciation (R1), provisions (R2), provisional ISR (R3), closing entries (R4), journal-shape conformance (R5), scope isolation (R6), post-close report (R7), skill registry conformance (R8). <!-- sdd-owner: implementation -->
- [x] `[W5]` Confirm no out-of-scope surface shipped: no `flow/close.ts` wiring, no mission/gate/receipt wiring, no MCP tools, no CLI commands, no ledger writes, no `contracts/**` changes. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [ ] Ship the five work units (W1 → W5) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge. <!-- sdd-owner: parent -->
- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [ ] Validate the integrated change: full suite green, no frozen contract or conformance delta, then merge to main. <!-- sdd-owner: parent -->
