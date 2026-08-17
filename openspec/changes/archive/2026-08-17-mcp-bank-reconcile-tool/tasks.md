# Tasks — MCP Bank Reconciliation Tool (`bank.reconcile`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200–280 (tools.ts +~120, mcp-serve 1, mcp/index 1, reconcile.test.ts ~150, capability matrix note) |
| 400-line budget risk | Low (under the `review_budget_lines: 300` budget as a single PR) |
| Chained PRs recommended | No |
| Suggested split | single PR (slices W1→W5 as sequential commits within it) |
| Delivery strategy | auto-forecast |
| Chain strategy | n/a (single PR) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a
400-line budget risk: Low
```

**Forecast notes (read before apply):** Strict TDD is active (`bun run test` = vitest, `bun run typecheck`, `bun run build`). Money on the wire is decimal strings only — never JSON numbers, never BigInt literals, never floats. The tool is a thin read-only wrapper over the engine subpath `./bank-reconciliation`; the engine `bank-reconciliation/**` stays byte-identical. The MCP response is always a successful JSON-RPC result with the `ToolResult` serialized in `content[0].text` — the handler returns `{ ok: true, … }` or `{ ok: false, code, message, rejections? }` and never throws across the wire. `INVALID_INPUT` is the one tool-level code (schema violation); all engine-derived failures use the engine's own `BankReconciliationErrorCode` verbatim.

---

## How to read this task list

- **Ownership markers**: each checkbox ends with exactly one terminal `<!-- sdd-owner: ... -->`. `implementation` covers RED/GREEN/TRIANGULATE/REFACTOR, code, tests, exports, wiring, and apply-owned verification. `parent` covers only explicit post-apply bounded review and lifecycle-gate actions, grouped separately at the end.
- **Work-unit mapping**: the leading `[W1|W2|W3|W4|W5]` tag marks the work unit a task belongs to; each unit has a clear start, finish, verification, and rollback boundary and maps to one sequential commit inside the single PR.
- **Conventions**: every task that adds behavior starts with a failing test (RED) before implementation (GREEN); boundaries follow via TRIANGULATE/REFACTOR. Full suite `bun run test` plus `bun run typecheck` and `bun run build` must pass after each slice.
- **Shape**: the input schema mirrors `ledgerValidateTool()` (JSON Schema draft-07 style, `additionalProperties: false`, amounts as `string`, `side` enum). Runtime shape validation is hand-rolled in the handler (the repo is node:crypto-only — no runtime JSON-Schema dependency).
- **Imports**: the tool imports the engine via the package subpath `./bank-reconciliation`; `bank-reconciliation/**` itself is never modified.

---

## Phase 1 — Tool construction (W1)

- [x] `[W1]` Confirm slice start state: `mcp/tools.ts` exports `capabilitiesTool` and `ledgerValidateTool` only; `cmd/commands/mcp-serve.ts` `createDrenyraMcpServer()` registers `capabilities` and `ledger.validate`; no `bankReconcileTool` exists anywhere; `mcp/__tests__/reconcile.test.ts` does not exist. Record the engine subpath import surface (`./bank-reconciliation` exports `validateScope`, `normalizeBankRows`, `normalizeLedgerRows`, `reconcile`, and the `BankReconciliationError` type). <!-- sdd-owner: implementation -->

## Phase 2 — Tool implementation (W2)

- [x] `[W2]` RED — in `mcp/__tests__/reconcile.test.ts` (server level via `makeServer()` + `handleMessage`, mirroring `server.test.ts`), write failing tests for the tool contract: `tools/list` includes `bank.reconcile`; happy path fully matched → `ok: true`, `fullyMatched: true`, exactly one `matched` difference, `amountCents` as a decimal string; mixed input → all four classifications (`matched` / `bankOnly` / `ledgerOnly` / `conflict`) present, `fullyMatched: false`. <!-- sdd-owner: implementation -->
- [x] `[W2]` RED — extend `reconcile.test.ts` with failing rejection tests: `INVALID_INPUT` for an amount as a JSON number and for a missing `ledger`; `INVALID_SCOPE` for a bad RUC and a bad period; `CROSS_RUC_ACCESS` for a row RUC differing from the scope RUC; `NEGATIVE_AMOUNT` for `amount: "-250.00"`; `FRACTIONAL_CENTS` for `amount: "250.005"`; `NORMALIZATION_REJECTED` for a malformed amount `"abc"`, asserting a rejection naming the row `sourceKey` and that any single rejection blocks the `reconcile` delegation (no result emitted). <!-- sdd-owner: implementation -->
- [x] `[W2]` RED — extend `reconcile.test.ts` with failing determinism/side-effect tests: two identical calls to the same server return identical results; a successful call performs no ledger/candidate/receipt mutation. <!-- sdd-owner: implementation -->
- [x] `[W2]` GREEN — implement `bankReconcileTool()` in `mcp/tools.ts`: JSON Schema draft-07 input (`{ scope: { ruc, period }, bank: BankRow[], ledger: LedgerRow[] }`, `required`, `additionalProperties: false`, amounts typed `string`, `side` enums `deposit|withdrawal` and `debit|credit`); handler flow: (1) hand-rolled shape validation → `{ ok: false, code: "INVALID_INPUT", message }` naming the field; (2) engine `validateScope` → `INVALID_SCOPE`; (3) `normalizeBankRows(scope, bank)` / `normalizeLedgerRows(scope, ledger)`, any non-empty `rejected` → `{ ok: false, code: "NORMALIZATION_REJECTED", rejections: [{ sourceKey, code, detail }] }`, never reconciling a subset; (4) `reconcile(scope, bankMovements, ledgerMovements)` wrapped in try/catch for `BankReconciliationError` → `{ ok: false, code, message }`; (5) serialize `{ ok: true, scope, differences, fullyMatched }` via a JSON-safe serializer. Import the engine types via `import type` for the compile-time contract. <!-- sdd-owner: implementation -->
- [x] `[W2]` GREEN — add the JSON-safe serializer (`toJsonSafe`: BigInt → decimal string, arrays/objects recursed, otherwise passthrough) and the schema-violation error helper so no BigInt literal and no JSON number can reach `content[0].text`. <!-- sdd-owner: implementation -->
- [x] `[W2]` TRIANGULATE — add boundary cases: `fullyMatched` false with every classification covered by a single input; `INVALID_INPUT` for an extra top-level property, a non-object `scope`, and an unknown `side` token; `INVALID_SCOPE` for a period with month 00 or 13; run `bun run test`. <!-- sdd-owner: implementation -->

## Phase 3 — Wiring and registration (W3)

- [x] `[W3]` Add `export { bankReconcileTool } from "./tools.js";` to the `mcp/index.ts` barrel. <!-- sdd-owner: implementation -->
- [x] `[W3]` In `cmd/commands/mcp-serve.ts`, import `bankReconcileTool` from `../../mcp/index.js` and register it in `createDrenyraMcpServer()` with `server.registerTool(bankReconcileTool());` so `drenyra-ai mcp serve` lists `bank.reconcile` alongside `capabilities` and `ledger.validate`. <!-- sdd-owner: implementation -->
- [x] `[W3]` Run `bun run typecheck` and `bun run build`; confirm `dist/mcp/tools.js` (and the mcp barrel) compile with strict TS (no `any`). <!-- sdd-owner: implementation -->

## Phase 4 — Stdio coverage and capability note (W4)

- [x] `[W4]` RED — in `mcp/__tests__/reconcile.test.ts` (stdio level via `runMcpStdio` with a `nodeStdioLines`-style harness, mirroring `stdio.test.ts`), write a failing full `tools/call` round-trip test asserting the reconciliation content is delivered over the line protocol. <!-- sdd-owner: implementation -->
- [x] `[W4]` GREEN — run the new stdio test against the server built by `createDrenyraMcpServer()` and confirm the round-trip delivers the expected `ToolResult` content. <!-- sdd-owner: implementation -->
- [x] `[W4]` In `openspec/programs/drenyra-dominion/capability-matrix.yaml`, extend the `bank-reconciliation` row (line 58) with a note that the MCP server now exposes the `bank.reconcile` tool (SDD change `mcp-bank-reconcile-tool`). <!-- sdd-owner: implementation -->
- [x] `[W4]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm slice changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 5 — Final integration verification (W5)

- [x] `[W5]` Run the full regression: `bun run test`, `bun run typecheck`, `bun run build`; all green with no frozen contract delta. <!-- sdd-owner: implementation -->
- [x] `[W5]` Map each spec requirement to completion evidence: tool registration (R1), input contract (R2), happy-path reconciliation (R3), scope validation fail-closed (R4), normalization rejections fail-closed (R5), read-only advisory surface + determinism (R6), structured typed errors without stack leakage (R7), capability matrix note (R8), server + stdio test coverage (R9). <!-- sdd-owner: implementation -->
- [x] `[W5]` Confirm no out-of-scope surface shipped: no engine `bank-reconciliation/**` changes, no changes to `mcp/server.ts`, `mcp/protocol.ts`, `mcp/stdio.ts`, no mutation/ledger-write tools, no `bank.normalize`/`bank.adjust`/`bank.report` follow-ups, no `contracts/**` changes. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [x] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [x] Validate the integrated change: full suite green, no frozen contract delta, then merge to main. <!-- sdd-owner: parent -->
