# Tasks — Conciliación Bancaria Engine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1,100 authored lines across the chain (≈250–380 per work-unit) |
| 400-line budget risk | High (total exceeds 400 as one unit) / Low–Medium per work-unit |
| Chained PRs recommended | No (user decision: single PR, size exception recorded) |
| Suggested split | Work units A (planning+types+normalize) → B (compare+adjust) → C (report+barrel+wiring) → D (skill registry+conformance) as commits within one PR |
| Delivery strategy | single-pr (user decision; size exception recorded per openspec config `review_budget_lines: 300`) |
| Chain strategy | n/a (single PR) |

```text
Decision needed before apply: No
Chained PRs recommended: No (user decision: single-pr with size exception)
Chain strategy: n/a
400-line budget risk: High
```

**Forecast notes (read before apply):** The user chose a single PR with a recorded size exception (`openspec/config.yaml` sets `review_budget_lines: 300`; the change exceeds that aggregate and the exception is recorded). Work units A–D ship as sequential commits within that one PR, each kept under the 300-line review budget where possible. Strict TDD is active: `bun run test` (vitest), `bun run typecheck`, `bun run build`. Money is BigInt cents; no floats. `bank-reconciliation/` is a pure library module importing only within itself (node:crypto only, zero deps); it MUST NOT be imported by `ledger/`.

---

## How to read this task list

- **Ownership markers**: each checkbox ends with exactly one terminal `<!-- sdd-owner: ... -->`. `implementation` covers RED/GREEN/TRIANGULATE/REFACTOR, code, tests, exports, and apply-owned verification. `parent` covers only explicit post-apply bounded review and lifecycle-gate actions, grouped separately at the end.
- **Chained-PR mapping**: the leading `[PR A|B|C|D]` tag marks the slice a task belongs to; each slice has a clear start, finish, verification, and rollback boundary.
- **Conventions**: every task that adds behavior starts with a failing test (RED) before implementation (GREEN); boundaries follow via TRIANGULATE/REFACTOR. Full suite `bun run test` plus `bun run typecheck` and `bun run build` must pass after each slice.

---

## Phase 1 — Planning / completion (PR A)

- [x] `[PR A]` Confirm slice start state: `bank-reconciliation/` does not exist, `skills/pe.ts` has no `pe.conciliacion-bancaria` entry, and the sibling `drenyra-skills/skills/registry.json` has none either. Record that `pe-skills.test.ts` currently asserts `BASE_PE_SKILLS.length === 6` and an exact id list (both must be updated when the entry ships). <!-- sdd-owner: implementation -->
- [x] `[PR A]` Define the error-model contract used across all modules: `ReconciliationError` with codes `INVALID_SCOPE`, `NORMALIZATION_REJECTED`, `CROSS_RUC_ACCESS`, `NEGATIVE_AMOUNT`, `FRACTIONAL_CENTS`, `UNCLASSIFIED_DIFFERENCE`; no partial result is ever returned as a success. <!-- sdd-owner: implementation -->

## Phase 2 — Types (PR A)

- [x] `[PR A]` RED — in `bank-reconciliation/__tests__/types.test.ts`, write failing tests for the canonical types: a `Movement` carries `date` (YYYY-MM-DD), normalized `reference`, positive `amountCents: bigint`, `side` (`inflow`|`outflow`), `source` (`bank`|`ledger`), and `sourceKey`; `Scope` carries `ruc` and `period` (`YYYYMM`); a `Reconciliation` result classifies every movement as `matched` | `bankOnly` | `ledgerOnly` | `conflict`. <!-- sdd-owner: implementation -->
- [x] `[PR A]` GREEN — implement `bank-reconciliation/types.ts`: `MovementSide`, `MovementSource`, `Movement`, `Scope`, `AdjustmentDraft`, `Reconciliation`, difference and report types using const-object types and flat interfaces; `amountCents` typed `bigint`; no `any`. <!-- sdd-owner: implementation -->
- [x] `[PR A]` TRIANGULATE — add boundary tests proving a `Movement` cannot carry a negative or non-integer amount (type-level and runtime guard), and `Scope` rejects a non-11-digit RUC or a non-`YYYYMM` period. <!-- sdd-owner: implementation -->

## Phase 3 — Normalize (PR A)

- [x] `[PR A]` RED — in `bank-reconciliation/__tests__/normalize.test.ts`, write failing tests: `normalizeBankRows(scope, rows)` and `normalizeLedgerRows(scope, rows)` return `{ movements, rejected }`; a bank deposit maps to `side: inflow` and a ledger debit also to `inflow`, a bank withdrawal and a ledger credit to `outflow`; the canonical shapes are indistinguishable between sources. <!-- sdd-owner: implementation -->
- [x] `[PR A]` RED — write failing rejection tests: an unparseable row (missing date, empty reference, non-integer/fractional-cent amount, unknown side token, negative amount) is `rejected` with a typed reason, NEVER skipped and NEVER partially accepted; a row carrying a foreign RUC is rejected (`CROSS_RUC_ACCESS`); an empty `rejected` array is a precondition. <!-- sdd-owner: implementation -->
- [x] `[PR A]` GREEN — implement `bank-reconciliation/normalize.ts`: reference normalization (trim, collapse internal whitespace, case-fold), deterministic side mapping per the design, and typed fail-closed rejection for every malformed row. <!-- sdd-owner: implementation -->
- [x] `[PR A]` TRIANGULATE — add boundary cases: fractional cents, decimal-string amounts, whitespace/reference-fold cases, and mixed RUC rows; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[PR A]` REFACTOR — extract shared row-parsing helpers in `normalize.ts` without behavior change; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[PR A]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 4 — Compare (PR B)

- [x] `[PR B]` RED — in `bank-reconciliation/__tests__/compare.test.ts`, write failing tests for `reconcile(scope, bank, ledger, opts)`: reference-first matching classifies a shared reference as `matched`; a bank movement with no matching ledger reference is `bankOnly`; a ledger movement with no matching bank reference is `ledgerOnly`. <!-- sdd-owner: implementation -->
- [x] `[PR B]` RED — write failing fallback tests: no matching references but identical BigInt-cent amount AND same date match (both sides equal in canonical `side`); identical amount on different days does NOT match; same-day different amount does NOT match; amount alone or date alone NEVER matches. <!-- sdd-owner: implementation -->
- [x] `[PR B]` RED — write failing conflict and scope tests: a reference matching more than one counterpart is surfaced as `conflict` (never guessed, none auto-matched); mixing or crossing RUC scopes is rejected (`CROSS_RUC_ACCESS`, `INVALID_SCOPE`). <!-- sdd-owner: implementation -->
- [x] `[PR B]` GREEN — implement `bank-reconciliation/compare.ts`: index ledger by reference, single-candidate match, deterministic one-to-one greedy fallback (amount + same date + equal canonical side) sorted by `sourceKey`, and typed difference classification; no movement left unclassified. <!-- sdd-owner: implementation -->
- [x] `[PR B]` TRIANGULATE — add ambiguity and ordering boundary cases (duplicate references, multiple same-amount same-day candidates in deterministic order); run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[PR B]` REFACTOR — run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 5 — Adjust (PR B)

- [x] `[PR B]` RED — in `bank-reconciliation/__tests__/adjust.test.ts`, write failing tests for `buildAdjustments(differences, opts)`: a classified `bankOnly` or `ledgerOnly` difference of `250n` cents yields a draft with a debit/credit of `250n` cents, a human-reviewable `justification` referencing the movement, `requireApproval: true` by default, deterministic `draftId`, and `status: "draft" | "pending-approval"`. <!-- sdd-owner: implementation -->
- [x] `[PR B]` RED — write fail-closed tests: `matched` and `conflict` differences NEVER produce a draft; an unclassified difference produces NO adjustment and surfaces as a blocker (`UNCLASSIFIED_DIFFERENCE`); `opts.requireApproval` defaults to `true` with per-draft override. <!-- sdd-owner: implementation -->
- [x] `[PR B]` GREEN — implement `bank-reconciliation/adjust.ts`: derive drafts only from `bankOnly`/`ledgerOnly`, deterministic draft ids, justification strings, and approval flag; unclassified states produce a blocker entry, never a draft. <!-- sdd-owner: implementation -->
- [x] `[PR B]` TRIANGULATE — add per-draft override and multiple-difference cases; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[PR B]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 6 — Report (PR C)

- [x] `[PR C]` RED — in `bank-reconciliation/__tests__/report.test.ts`, write failing tests for `buildReport(reconciliation, balances)`: the report states `bankInitial`/`bankFinal` and `ledgerInitial`/`ledgerFinal`, lists every difference with its classification, and lists each adjustment with `netAdjustmentCents = Σ inflow − Σ outflow`. <!-- sdd-owner: implementation -->
- [x] `[PR C]` RED — write identity-check tests: `reconciled` is `true` only when `ledgerFinal + netAdjustmentCents === bankFinal`; when unmatched differences exist `reconciled` MUST be `false` (fail-closed, never claims unachieved reconciliation); a report request without a single RUC and period is rejected (`INVALID_SCOPE`). <!-- sdd-owner: implementation -->
- [x] `[PR C]` GREEN — implement `bank-reconciliation/report.ts`: compile balances, difference detail, adjustments, and the reconciled identity check with BigInt arithmetic; no float. <!-- sdd-owner: implementation -->
- [x] `[PR C]` TRIANGULATE — add reconciled-true and reconciled-false boundary cases including negative `netAdjustmentCents`; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[PR C]` Add `bank-reconciliation/index.ts` barrel exporting only the public surface (`normalizeBankRows`, `normalizeLedgerRows`, `reconcile`, `buildAdjustments`, `buildReport`, and all types); run `bun run test`, `bun run typecheck`, `bun run build`. <!-- sdd-owner: implementation -->
- [x] `[PR C]` Add an import-boundary test asserting `bank-reconciliation/` imports no project module and no `agents/`, `cmd/`, or `ledger/` path; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] `[PR C]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 7 — Skill registry entry (PR D)

- [x] `[PR D]` RED — in `skills/__tests__/pe-skills.test.ts`, write/update failing tests: `BASE_PE_SKILLS.length` becomes `7` and the sorted id list gains `"pe.conciliacion-bancaria"`; the new entry registers and resolves at a date in validity with a 64-char checksum. <!-- sdd-owner: implementation -->
- [x] `[PR D]` Add the `pe.conciliacion-bancaria` entry to `skills/pe.ts` via `make(...)` joining `BASE_PE_SKILLS`: id `pe.conciliacion-bancaria`, version `1.0.0`, jurisdiction `PE`, maxAutonomy `R1`, normativeSources `["PCGE — Plan Contable General Empresarial (R. SMV 043-2010-SMV/01)", "NIC 1 — Presentación de Estados Financieros", "Código Tributario — D.S. 133-2013-EF"]`, inputs `["bank-statement", "ledger", "scope"]`, outputs `["differences", "adjustments", "reconciliation-report"]`. <!-- sdd-owner: implementation -->
- [x] `[PR D]` Add the identical entry to the sibling authoring manifest `drenyra-skills/skills/registry.json` (authored in the drenyra-skills workstream) matching exactly the six conformance fields: version, jurisdiction, maxAutonomy, normativeSources, inputs, outputs. <!-- sdd-owner: implementation -->
- [x] `[PR D]` Conformance — run `bun run skills:conformance` (scripts/skills-conformance.mjs) and confirm it passes (no drift between the manifest and runtime `BASE_PE_SKILLS` on the six fields). <!-- sdd-owner: implementation -->
- [x] `[PR D]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`, `bun run skills:conformance`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 8 — Final integration verification (PR D)

- [x] `[PR D]` Run the full regression across all four slices: `bun run test`, `bun run typecheck`, `bun run build`, and `bun run skills:conformance`; all green with no frozen contract or conformance delta. <!-- sdd-owner: implementation -->
- [x] `[PR D]` Map each spec requirement to completion evidence: canonical normalization (R1–R2), BigInt-cent amounts (R3), RUC/period scope (R4), reference-first matching (R5), amount+date fallback (R6), fail-closed adjustments (R7), executive report (R8), and skill registry conformance (R9). <!-- sdd-owner: implementation -->
- [x] `[PR D]` Confirm no out-of-scope surface shipped: no MCP tools, mission/gate/receipt wiring, real-bank parsers, Engram integration, CLI commands, PCGE account-code classification, or ledger writes. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [ ] Ship the four work units (A → B → C → D) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge. <!-- sdd-owner: parent -->
- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [ ] Validate the integrated change: full suite green, no frozen contract or conformance delta, then merge to main. <!-- sdd-owner: parent -->
