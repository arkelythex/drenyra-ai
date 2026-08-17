```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:34cb6ffafb1bae42b22bee33d666a8469db52ffdb3ea05a52b8914631ef3549f
verdict: pass
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 23/23
test_command: bun run test
test_exit_code: 0
test_output_hash: sha256:80047e32a8b952a9b11deac462468142636a996d4fcd46de1334f7168c02de7d
build_command: bun run typecheck
build_exit_code: 0
build_output_hash: sha256:1383d3b3e514b0940d50f6b0e77596f839420a9680372de8c536ec57c0ce6e98
```

# Verify Report — mcp-bank-reconcile-tool (MCP tool `bank.reconcile`)

- Change: `mcp-bank-reconcile-tool`
- Store: `openspec` (this directory) + Engram mirror (topic_key `sdd/mcp-bank-reconcile-tool/verify-report`)
- Verified against: real code, not apply-progress claims
- Date: 2026-08-16
- **Veredicto final: APPROVED** (9/9 requirements PASS, no CRITICAL, no verification blockers)

---

## Resumen de ejecución

| Command | Result |
|---------|--------|
| `bun run test mcp` | ✅ 30/30 passed (3 files: server.test.ts 6 + stdio.test.ts 4 + reconcile.test.ts 20) |
| `bun run typecheck` | ✅ PASS (tsc --noEmit, strict) |
| `bun run build` | ✅ PASS (dist compiled) |
| `bun run test` (full) | ✅ 1471/1471 passed (110 files) — the documented pre-existing release-integrity flake did NOT reproduce |

Delta: +20 new tests, 0 broken.

---

## Estado por requirement

### R1 — `bank.reconcile` tool registration — PASS

**Evidence:**

- `mcp/__tests__/reconcile.test.ts` → "lists bank.reconcile alongside the existing surface" (server level via `makeServer()` + `handleMessage`): asserts `bank.reconcile`, `capabilities`, and `ledger.validate` are all present in `tools/list`.
- "lists bank.reconcile alongside the production surface over stdio" (stdio level via `runMcpStdio(createDrenyraMcpServer())`): same assertion over the line protocol.
- `cmd/commands/mcp-serve.ts`: `server.registerTool(bankReconcileTool());` added in `createDrenyraMcpServer()` (git diff verified: +1 import, +1 registration, doc comment updated).
- Callable by name / never `METHOD_NOT_FOUND`: every `tools/call` test helper asserts `parsed.error` is undefined and the server always responds.
- `mcp/server.ts` (lines 94–103) serializes `name`, `description`, `inputSchema` in `tools/list`.

### R2 — Input contract — PASS

**Evidence:**

- Schema test "declares the input schema": `required: ["scope", "bank", "ledger"]`, `additionalProperties: false` at top/scope/row level, `scope` object with `required: ["ruc", "period"]` (`ruc` string min/max 11, `period` pattern `^\d{6}$`), bank row `amount` typed `string`, `side` enum `["deposit","withdrawal"]`, ledger row `side` enum `["debit","credit"]`, rows `required` all six fields.
- `BANK_RECONCILE_INPUT_SCHEMA` in `mcp/tools.ts` matches the spec verbatim.
- Rejection tests (all `INVALID_INPUT`, message names the field): amount as JSON number (`bank[0].amount`), missing `ledger`, extra top-level property, non-object `scope`, unknown `side` token.
- Responsiveness after error: "rejects an amount as a JSON number … and stays responsive" makes a subsequent valid call succeed on the same server.

### R3 — Happy-path reconciliation result — PASS

**Evidence:**

- "returns fullyMatched true with one matched difference and amountCents as a string": `ok: true`, `fullyMatched: true`, exactly 1 difference `classification: "matched"`, `amountCents` is a string `"250"` (BigInt→string via `toJsonSafe`; no BigInt literal, no JSON number on the wire).
- "classifies every movement across matched, bankOnly, ledgerOnly, and conflict": `fullyMatched: false`, classifications sorted `[bankOnly, conflict, ledgerOnly, matched]`, movement completeness 7/7 (4 bank + 3 ledger), conflict reference `b-conflict`, sourceKeys correct.
- Handler flow verified in `mcp/tools.ts`: shape → `validateScope` → `normalizeBankRows`/`normalizeLedgerRows` → `reconcile(scope, bankMovements, ledgerMovements)` → `toJsonSafe({ ok: true, scope, differences, fullyMatched })`.
- Engine signatures match usage: `normalizeBankRows(scope: Scope, rows: readonly BankRow[]): NormalizeResult`, `normalizeLedgerRows(...)`, `reconcile(scope, bank: readonly Movement[], ledger: readonly Movement[]): Reconciliation` (bank-reconciliation/compare.ts:60).

### R4 — Scope validation fail-closed — PASS

**Evidence:**

- "rejects an invalid RUC with INVALID_SCOPE and no reconciliation result": `INVALID_SCOPE`, message contains "RUC", and the result has no `differences`/`fullyMatched` properties.
- "rejects a bad period": `"2026-07"`, `"202600"`, `"202613"` all → `INVALID_SCOPE`, message contains "period".
- Engine `validateScope` (bank-reconciliation/types.ts:219) enforces exactly 11-digit RUC, `YYYYMM` pattern, and month 01–12 — matches the spec exactly. The tool returns `error.code` verbatim.

### R5 — Normalization rejections fail-closed — PASS

**Evidence:**

- `CROSS_RUC_ACCESS`: cross-RUC row → overall `NORMALIZATION_REJECTED` with `rejections[0].code === "CROSS_RUC_ACCESS"`, `sourceKey "stmt-0001"`, no `differences`.
- `NEGATIVE_AMOUNT`: `amount: "-250.00"` → rejection code `NEGATIVE_AMOUNT`.
- `FRACTIONAL_CENTS`: `amount: "250.005"` → rejection code `FRACTIONAL_CENTS`.
- `NORMALIZATION_REJECTED`: `amount: "abc"` → rejection code `NORMALIZATION_REJECTED` naming `sourceKey`.
- "blocks the reconcile delegation when any single row is rejected": valid rows + one bad row (`stmt-bad`) → `NORMALIZATION_REJECTED`, `rejections` length 1, no `differences`, no `fullyMatched` — the accepted subset is never reconciled (verified in handler: `if (rejections.length > 0) return …` before `reconcile`).
- Rejections carry `{ sourceKey, code, detail }` as required.

### R6 — Read-only advisory surface — PASS

**Evidence:**

- "is deterministic and side-effect-free for identical inputs": two identical `tools/call` requests to the same server return identical results (`toEqual`), and the `tools/list` surface is unchanged between calls.
- The tool exposes no write path: no ledger writes, candidates, receipts, or persisted state APIs; it delegates to the pure engine `reconcile` (no `adjust`/`report`/mutation surface in the tool). No mutation/ledger-write tools were added anywhere (diff verified).

### R7 — Structured typed errors without stack leakage — PASS

**Evidence:**

- "surfaces typed errors without stack frames or internal paths": `INVALID_SCOPE` response serialized and asserted to contain no `at .+:\d+:\d+` frames, no `bank-reconciliation/` path, and no `node_modules`.
- Error codes are the engine's own `BankReconciliationErrorCode` verbatim (`INVALID_SCOPE`, `NORMALIZATION_REJECTED`, `CROSS_RUC_ACCESS`, `NEGATIVE_AMOUNT`, `FRACTIONAL_CENTS`, `UNCLASSIFIED_DIFFERENCE` fallback for non-engine exceptions) — `mcp/tools.ts` try/catch on `BankReconciliationError` returns `{ ok: false, code, message }`; the handler never throws across the wire (always a successful JSON-RPC result with the `ToolResult` in `content[0].text`).
- Failure never fabricates a match: every failure test asserts the absence of `differences`/`fullyMatched`.

### R8 — Capability matrix note — PASS

**Evidence:**

- `openspec/programs/drenyra-dominion/capability-matrix.yaml`, `bank-reconciliation` row now ends with: `MCP surface: bank.reconcile tool exposed on the drenyra-ai MCP server (change mcp-bank-reconcile-tool)` (git diff verified — only that row extended by this change; the `annual-declaration` row line belongs to the sibling change `sdd-con-003-declaracion-anual`).

### R9 — Server and stdio test coverage — PASS

**Evidence:**

- Server level (`handleMessage`): happy path, all four classifications, scope rejection (`INVALID_SCOPE`), cross-RUC rejection (`CROSS_RUC_ACCESS`), malformed-amount rejection (`NORMALIZATION_REJECTED`) — all asserted.
- Stdio level (`runMcpStdio` over `createDrenyraMcpServer()`): full `tools/call` round-trip delivers `jsonrpc: "2.0"`, `id: 7`, `content[0].type: "text"`, reconciliation content with `ok: true`, `fullyMatched: true`, 1 `matched` difference, `amountCents` string `"250"`.

---

## Invariants (contra el código real)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Money as decimal strings on the wire | ✅ | Schema types every `amount` as `string`; handler rejects JSON numbers with `INVALID_INPUT`; tests assert `amountCents` is a string `"250"` |
| BigInt → string in serialization | ✅ | `toJsonSafe` in `mcp/tools.ts` converts `bigint` → `value.toString()`, recurses arrays/objects; no BigInt literal can reach `content[0].text` |
| node:crypto-only (no new deps) | ✅ | `git diff HEAD -- package.json` shows only the sibling change's `./annual-declaration` export line; no new dependency introduced by this change; shape validation is hand-rolled |
| Frozen files byte-identical | ✅ | `git diff HEAD -- mcp/server.ts mcp/protocol.ts mcp/stdio.ts bank-reconciliation/` → empty (exit 0) |
| Capability-matrix row notes MCP surface | ✅ | R8 evidence above |
| Strict TS, no `any` | ✅ | `grep ": any\|<any>" mcp/tools.ts` → none; `bun run typecheck` PASS |

---

## TDD Compliance (strict TDD activo — `openspec/config.yaml: strict_tdd: true`)

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | `TDD Cycle Evidence` table present in apply-progress.md (RED/GREEN/TRIANGULATE/REFACTOR) |
| All implementation tasks have tests | ✅ | 17/17 tasks map to the 20-test suite; RED evidence "20 failed / 10 passed" consistent with the tool being absent |
| RED confirmed (test file exists) | ✅ | `mcp/__tests__/reconcile.test.ts` exists (570 lines, 20 `it()` tests) |
| GREEN confirmed (tests pass) | ✅ | `bun run test mcp` → 30/30; full suite 1471/1471 |
| Triangulation adequate | ✅ | Boundary cases present: extra top-level prop, non-object scope, unknown side token, periods `2026-07`/`202600`/`202613`, determinism, no-stack-leak regex, 7-movement completeness |
| Safety Net | ➖ N/A | Test file is NEW (untracked before); `git status` confirms `?? mcp/__tests__/reconcile.test.ts` |

### Assertion Quality Audit

- 0 `vi.mock` calls, 108 `expect()` calls across 20 tests.
- No tautologies, no ghost loops (the bad-period loop iterates a hardcoded 3-element literal), no type-only assertions standing alone (all combined with value assertions), no smoke-only tests, no CSS/implementation-detail assertions, no mock-call-count assertions.
- All tests drive production code (`handleMessage` / `runMcpStdio`).
- **Assertion quality: ✅ All assertions verify real behavior** (0 CRITICAL, 0 WARNING).

### Test Layer Distribution

| Layer | Tests | Files |
|-------|-------|-------|
| Integration (MCP server + stdio surface) | 30 (20 new + 10 existing) | 3 |
| Unit (tool-level) | 0 | 0 |
| E2E | 0 | 0 |

Layer choice is appropriate: the tool is a thin adapter over the engine (engine has its own 65-test suite); R9 explicitly requires server-level and stdio-level coverage.

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected (`openspec/config.yaml: coverage.available: false`). Not a failure.

### Quality Metrics

**Linter**: ➖ Not configured. **Type Checker**: ✅ No errors (`bun run typecheck`). **Formatter**: ➖ Not configured.

---

## Task completion status

- **Implementation tasks (W1–W5): 17/17 complete** — all `[x]`, no unchecked `- [ ]` implementation markers remain in `tasks.md`.
- **Parent-owned lifecycle gates (unchecked by design, `<!-- sdd-owner: parent -->`)**:
  - `- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge.`
  - `- [ ] Validate the integrated change: full suite green, no frozen contract delta, then merge to main.`
- These are NOT implementation tasks; they are deferred parent actions required before archive. Archive is **not ready** until they are reconciled at their native lifecycle boundaries.

---

## Review workload / PR boundary

- Forecast: single PR, Chained PRs: No, 400-line budget risk: Low, Decision needed: No → the returned work boundary (single PR scope, no chained PRs) **matches** the forecast. No `size:exception` needed/used.
- No scope creep beyond assigned tasks: the 5 in-scope files are exactly `mcp/tools.ts`, `mcp/index.ts` (+1), `cmd/commands/mcp-serve.ts`, `mcp/__tests__/reconcile.test.ts` (new), `capability-matrix.yaml` (one row). No engine changes, no `mcp/server.ts`/`protocol.ts`/`stdio.ts` changes, no `contracts/**` changes, no `bank.normalize`/`bank.adjust`/`bank.report`, no mutation tools.
- ⚠️ **WARNING — forecast size variance**: actual size materially exceeds the forecast. Forecast: `tools.ts +~120`, `reconcile.test.ts ~150`, total ~200–280. Actual: `tools.ts +294/−10`, `reconcile.test.ts 570` (new), source delta ~300 changed lines, ~870 new lines including the test file. The size is justified (hand-rolled shape validation per the node:crypto-only architecture; a comprehensive 20-test suite with real assertions) and does not represent feature creep, but the next forecast for this kind of change should be more generous, and the "400-line budget risk: Low" claim was understated.

---

## Structured status / actionContext

```yaml
schemaName: spec-driven
changeName: mcp-bank-reconcile-tool
artifactStore: openspec
planningHome:
  root: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  changesDir: openspec/changes
changeRoot: openspec/changes/mcp-bank-reconcile-tool
artifactPaths: { proposal: openspec/changes/mcp-bank-reconcile-tool/proposal.md, specs: .../spec.md, design: .../design.md, tasks: .../tasks.md, applyProgress: .../apply-progress.md, verifyReport: .../verify-report.md }
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: done, verifyReport: done }
taskProgress: { total: 17, complete: 17, remaining: 0, unchecked: [] }
deferredParentActions: { total: 2, complete: 0, remaining: 2, unchecked: [post-apply bounded review + terminal receipt, integrated validation + merge] }
taskArtifactErrors: []
applyState: all_done
dependencies: { apply: all_done, verify: ready, sync: ready, archive: blocked }
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: (n/a — repo-local mode; only the phase artifact was written)
  warnings: [forecast size variance, sibling change sharing the working tree]
nextRecommended: sync
isNonAuthoritative: false
```

---

## Riesgos / observaciones

1. **⚠️ WARNING — Forecast size variance** (see Review workload above). Not a blocker; boundary decision honored.
2. **ℹ️ Sibling change shares the working tree**: `annual-declaration/`, `index.ts`, `package.json`, `tsconfig*.json`, and the `annual-declaration` capability-matrix row belong to `sdd-con-003-declaracion-anual` (uncommitted). This change's own diff is clean and isolated; coordinate sync/archive/merge ordering with the sibling change.
3. **ℹ️ Full-suite result exceeded apply-progress**: apply-progress documented 1470/1471 with a pre-existing release-integrity flake; this verification run got 1471/1471 (flake did not reproduce). No action needed.
4. **ℹ️ Archive readiness**: requires the two parent-owned lifecycle gates (post-apply bounded review + integrated validation/merge) to be reconciled at their native boundaries. No `size:exception` recorded — none needed for a single-PR boundary.

---

## Blockers

**None.** No CRITICAL findings, no unchecked implementation tasks, no FAIL requirements, no failed commands.

Veredicto: **APPROVED** — ready for `sync`; archive after the parent-owned lifecycle gates are reconciled.
