# Proposal — MCP Bank Reconciliation Tool

## Decision

Expose the SDD-CON-001 bank-reconciliation engine as a read-only MCP tool
(`bank.reconcile`) on the existing MCP server (`mcp/`, JSON-RPC 2.0 over stdio,
protocol 2025-03-26). The server today registers only `capabilities` and
`ledger.validate`; this change adds the deterministic matching engine as a
first-class tool so external hosts (Codex, Claude Code, OpenCode, and the
drenyra-pi ecosystem) can run bank-vs-ledger reconciliation with the same
RUC-scoped, BigInt-exact, fail-closed semantics as the library — never a
reimplementation. Inputs travel as decimal strings (money is never a JS Number
on the wire), and typed engine errors serialize into the tool response instead
of being masked.

## Intent

SDD-CON-001 shipped the reconciliation *engine* and the `close-vertical-wiring`
slice proved the converter pattern, but the MCP surface is still the two-tool
minimum (`capabilities`, `ledger.validate`). The ecosistema integration doc
(`docs/architecture/ecosystem-integration.md`) frames the MCP server as the
uniform external-host surface; a host that wants to reconcile bank statements
against the ledger today has no deterministic tool for it and would be tempted
to re-implement matching ad hoc (floats, guessed matches — exactly what the
engine forbids). This change closes that surface gap: the engine stays the
single source of truth, and the tool is a thin typed wrapper that validates
scope, normalizes canonical rows, delegates to `reconcile`, and returns the
structured result. Read-only: no mutations, no ledger writes, no approval
workflow — matching is advisory to the host, exactly like `ledger.validate`.

## Proposed outcome

After this change:

1. `mcp/tools.ts` adds `bankReconcileTool()` — name `bank.reconcile`, JSON Schema
   draft-07 input `{ scope: { ruc, period }, bank: BankRow[], ledger: LedgerRow[] }`
   with `required` and `additionalProperties: false`, mirroring the
   `ledgerValidateTool()` shape.
2. The handler validates the scope, normalizes both row sets through
   `normalizeBankRows`/`normalizeLedgerRows` (rejecting cross-RUC access and
   malformed amounts fail-closed), delegates to `reconcile`, and returns the
   structured `Reconciliation` (differences classified as matched / bank-only /
   ledger-only / conflict, `fullyMatched` flag) serialized as text content.
3. Typed `BankReconciliationError`s surface as a structured error in the tool
   response (no stack leaks, no silent fallback to a guessed match).
4. `cmd/commands/mcp-serve.ts` registers the new tool in
   `createDrenyraMcpServer()` so `drenyra-ai mcp serve` exposes it.
5. MCP tests cover the happy path, the matched/bank-only/ledger-only/conflict
   classifications, scope rejection, cross-RUC rejection, and malformed-amount
   rejection, over the stdio surface.
6. The capability matrix notes the MCP surface extension under
   `bank-reconciliation`.

## Scope

### Slice 1 — bank.reconcile tool (this change)

- `mcp/tools.ts` — `bankReconcileTool()` (wrapper over the engine subpath
  `./bank-reconciliation`).
- `cmd/commands/mcp-serve.ts` — registration in `createDrenyraMcpServer()`.
- `mcp/__tests__/` — server-level and stdio-level tests for the new tool.
- Capability matrix note in
  `openspec/programs/drenyra-dominion/capability-matrix.yaml`.

### Follow-up slices (out of scope)

- `bank.normalize` / `bank.adjust` / `bank.report` companion tools — the
  follow-up once the shape is proven.
- Wiring into drenyra-pi host configuration (which hosts connect and how) —
  consumer-side, not this repo.
- Mutation-style tools (candidate/receipt/ledger writes) — they stay behind the
  Core gates by design (see `mcp/tools.ts` header).

## Non-goals

- No modification of `bank-reconciliation/` engine semantics; the tool is a thin
  wrapper, not a reimplementation.
- No new MCP protocol features (no streaming, no resources); the existing
  JSON-RPC 2.0 over stdio surface is unchanged.
- No ledger writes or approval flow through the tool.
- No float money: amounts stay decimal strings end-to-end.

## Tradeoffs

- **Thin wrapper, single source of truth** — the tool adds ~no logic beyond
  validation and delegation, so the engine's invariants (reference-first match,
  amount+date fallback, conflict fail-closed, RUC scope) cannot drift between
  the library and the wire.
- **Structured errors, not stack leaks** — typed engine errors map to a readable
  error payload in the tool response; the host can act on `INVALID_SCOPE` or
  `CROSS_RUC_ACCESS` instead of parsing a generic internal error.
- **Read-only advisory surface** — matching is advice to the host (like
  `ledger.validate`); mutations stay behind gates, which keeps the MCP server
  safe to expose to third-party hosts.
- **Subpath import** — the tool imports via the package subpath
  `./bank-reconciliation` (the module is deliberately excluded from the root
  star-export to avoid name clashes); the explicit import keeps the surface
  honest about the dependency.
