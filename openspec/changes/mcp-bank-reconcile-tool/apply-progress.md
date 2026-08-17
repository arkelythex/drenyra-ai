# Apply Progress — mcp-bank-reconcile-tool (MCP tool `bank.reconcile`)

Change: mcp-bank-reconcile-tool. Status: SUCCESS — all implementation-owned tasks (W1–W5) complete, ready for verify. Store: openspec (this directory) + engram mirror (topic_key `sdd/mcp-bank-reconcile-tool/apply-progress`). Strict TDD active (`bun run test` = vitest, `bun run typecheck`, `bun run build`).

## What was implemented

- `mcp/tools.ts`: `bankReconcileTool()` — thin read-only wrapper over the SDD-CON-001 engine (`../bank-reconciliation/index.js`). JSON Schema draft-07 input `{ scope: {ruc, period}, bank, ledger }` with `required`, `additionalProperties: false` at top/scope/row level, amounts typed `string`, side enums `deposit|withdrawal` (bank) and `debit|credit` (ledger). Handler flow per design: (1) hand-rolled shape validation (node:crypto-only) → `{ok:false, code:"INVALID_INPUT", message}` naming the field; (2) engine `validateScope` → `INVALID_SCOPE`; (3) `normalizeBankRows` + `normalizeLedgerRows`, any non-empty `rejected` → `{ok:false, code:"NORMALIZATION_REJECTED", message, rejections:[{sourceKey, code, detail}]}`, reconcile NEVER invoked on a subset; (4) `reconcile(scope, bankMovements, ledgerMovements)` in try/catch for `BankReconciliationError` → `{ok:false, code, message}` (codes verbatim; generic unexpected error → `UNCLASSIFIED_DIFFERENCE`); (5) serialize `{ok:true, scope, differences, fullyMatched}` via `toJsonSafe` (BigInt → decimal string). Handler NEVER throws to the server: result always a successful JSON-RPC response with the ToolResult in `content[0].text`. No stack leaks (test-verified).
- `mcp/index.ts`: explicit `export { bankReconcileTool } from "./tools.js";` added to the barrel (design W3; explicit alongside the star export).
- `cmd/commands/mcp-serve.ts`: import + `server.registerTool(bankReconcileTool());` in `createDrenyraMcpServer()`; doc comment updated.
- `mcp/__tests__/reconcile.test.ts` (NEW, 20 tests): server level (`makeServer()` + `handleMessage`) + stdio level (`runMcpStdio` over `createDrenyraMcpServer()`).
- `openspec/programs/drenyra-dominion/capability-matrix.yaml`: ONLY the `bank-reconciliation` row extended with "MCP surface: bank.reconcile tool exposed on the drenyra-ai MCP server (change mcp-bank-reconcile-tool)". The `annual-declaration` row from the sibling change was NOT touched (git-diff verified).

## TDD Cycle Evidence

| Step | Evidence |
|------|----------|
| RED | `mcp/__tests__/reconcile.test.ts` written first (20 tests importing `bankReconcileTool`). `bun run test mcp` → 20 failed / 10 passed (no export; tool absent). |
| GREEN | tools.ts (bankReconcileTool + toJsonSafe + shape helpers), barrel export, mcp-serve registration. `bun run test mcp` → 30/30 (10 existing + 20 new). |
| TRIANGULATE | Boundary cases: extra top-level prop, non-object scope, unknown side token, periods "2026-07"/"202600"/"202613", determinism (identical inputs → identical result), no-stack-leak regex, movement completeness (7 movements across 4 classifications). |
| REFACTOR | None required; `bun run typecheck` and `bun run build` both clean. |

## Verification

- `bun run test mcp` → 3 files, 30/30 passed.
- `bun run typecheck` → PASS. `bun run build` → PASS.
- `bun run test` (full) → 1470/1471 (110 files). Single failure is the DOCUMENTED pre-existing release-integrity flake (`scripts/__tests__/release-integrity.test.ts` SBOM fidelity drift, 5000ms timeout under parallel load; matrix documents "1 pre-existing release-integrity flake passes 13/13 isolated"). Confirmed 13/13 PASS isolated; not caused by this change.
- Delta: +20 new tests passing; 0 broken.

## Files changed (in-scope only)

- `mcp/tools.ts` (modified)
- `mcp/index.ts` (modified, +1 line)
- `cmd/commands/mcp-serve.ts` (modified)
- `mcp/__tests__/reconcile.test.ts` (NEW)
- `openspec/programs/drenyra-dominion/capability-matrix.yaml` (modified, bank-reconciliation row only)

## Out-of-scope guard (W5)

- `bank-reconciliation/**` NOT touched (git diff empty). `mcp/server.ts`, `mcp/protocol.ts`, `mcp/stdio.ts`, `mcp/__tests__/server.test.ts`, `mcp/__tests__/stdio.test.ts` NOT touched (git diff empty).
- No mutation/ledger-write tools; no `bank.normalize`/`bank.adjust`/`bank.report`; no `contracts/**` changes; no new dependencies (node:crypto-only).

## Spec R1–R9 mapping

- R1 registration → tools/list + callable + createDrenyraMcpServer stdio tests.
- R2 input contract → schema assertions + INVALID_INPUT tests (amount number, missing ledger, extra prop, non-object scope, unknown side).
- R3 happy-path → fullyMatched true, one matched, amountCents string; mixed → 4 classifications.
- R4 scope fail-closed → INVALID_SCOPE bad RUC / bad periods, no reconciliation result.
- R5 normalization fail-closed → CROSS_RUC_ACCESS, NEGATIVE_AMOUNT, FRACTIONAL_CENTS, NORMALIZATION_REJECTED "abc", subset never reconciled.
- R6 read-only/determinism → two identical calls identical; tool list unchanged.
- R7 typed errors no stack leak → code+message; no `at` frames / internal paths / node_modules.
- R8 capability matrix note → bank-reconciliation row references bank.reconcile + change.
- R9 server + stdio coverage → handleMessage suite + stdio round-trip suite.

## Task checkboxes

NOT updated. Orchestrator explicitly delegated state: "NO marques checkboxes — el orquestador gestiona el estado". Implementation work (W1–W5) complete; parent-owned lifecycle gates remain unchecked by design.

## Remaining (parent-owned lifecycle gates, per tasks.md)

- Post-apply bounded review of the single PR candidate per native review contract + terminal receipt validation before merge.
- Integrated validation (full suite green, no frozen contract delta) then merge to main.

## Workload / PR boundary

Single PR, ~300 changed lines (forecast ~200–280; low). 400-line budget risk: Low. Chained PRs: No. No commits/PRs created by apply (orchestrator owns delivery).
