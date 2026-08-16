# Design — MCP Bank Reconciliation Tool

## Decision summary

- Add `bankReconcileTool()` to `mcp/tools.ts` — a thin, read-only wrapper over
  the SDD-CON-001 engine (`bank-reconciliation/`, imported via the package
  subpath) exposed as MCP tool `bank.reconcile` on the existing JSON-RPC 2.0
  stdio server. No engine changes, no protocol changes, no mutations.
- Money on the wire is decimal strings only: the input schema types every
  `amount` as `string`, and the serialized result converts BigInt cents to
  decimal strings (never BigInt literals, never JSON numbers).
- Typed errors are structured result payloads, not thrown exceptions: the
  handler returns `{ ok: true, …reconciliation }` or `{ ok: false, code,
  message, rejections? }` inside the MCP `content[0].text`. This avoids the
  server's generic `INTERNAL_ERROR` mapping (thrown handler errors) and cannot
  leak stack frames — satisfying the "structured typed errors without stack
  leakage" requirement without touching `server.ts`.
- Scope validation delegates to the engine's `validateScope` (RUC + `YYYYMM`
  with real month), so the tool's notion of a valid scope is byte-identical to
  the engine's.

## Module layout

- `mcp/tools.ts` — add `bankReconcileTool()` + a small JSON-safe serializer
  (`reconcileToJson`) + a schema-violation error helper.
- `mcp/index.ts` — export `bankReconcileTool` from the barrel (the compose
  point `cmd/commands/mcp-serve.ts` imports from `../../mcp/index.js`).
- `cmd/commands/mcp-serve.ts` — register the tool in
  `createDrenyraMcpServer()` (one line).
- `mcp/__tests__/reconcile.test.ts` — new suite: server-level
  (`handleMessage`) + stdio-level (`runMcpStdio`) coverage. Existing
  `server.test.ts` / `stdio.test.ts` stay untouched.
- Capability matrix — note the MCP surface under the `bank-reconciliation`
  row.

## Tool contract

### Input schema (JSON Schema draft-07 style, mirrors `ledgerValidateTool()`)

```ts
{
  type: "object",
  properties: {
    scope: {
      type: "object",
      properties: {
        ruc: { type: "string", minLength: 11, maxLength: 11 },
        period: { type: "string", pattern: "^\\d{6}$" },
      },
      required: ["ruc", "period"],
      additionalProperties: false,
    },
    bank: {
      type: "array",
      items: { $ref: "#/definitions/bankRow" },
    },
    ledger: {
      type: "array",
      items: { $ref: "#/definitions/ledgerRow" },
    },
  },
  required: ["scope", "bank", "ledger"],
  additionalProperties: false,
  definitions: {
    bankRow: {
      type: "object",
      properties: {
        ruc: { type: "string" },
        date: { type: "string" },
        reference: { type: "string" },
        amount: { type: "string" }, // decimal string; NEVER a JSON number
        side: { enum: ["deposit", "withdrawal"] },
        sourceKey: { type: "string" },
      },
      required: ["ruc", "date", "reference", "amount", "side", "sourceKey"],
      additionalProperties: false,
    },
    ledgerRow: {
      // identical, side: enum ["debit", "credit"]
    },
  },
}
```

The engine's `BankRow`/`LedgerRow` types are imported by `import type` for the
handler's compile-time contract; runtime validation of *shape* (types, enums,
required, extra props) happens in the handler before any engine call because
the repo has no runtime JSON-Schema validator in the library (node:crypto-only
constraint).

### Handler flow

1. **Shape validation** — check the input is an object with `scope` object,
   `bank`/`ledger` arrays, and per-row shape (amount is a `string`, side is a
   valid token, required fields present, no extra props). Any violation →
   `{ ok: false, code: "INVALID_INPUT", message }` naming the field.
2. **Scope** — call the engine's `validateScope({ ruc, period })`; on failure
   → `{ ok: false, code: "INVALID_SCOPE", message }`.
3. **Normalize** — `normalizeBankRows(scope, bank)` and
   `normalizeLedgerRows(scope, ledger)`; if either returns a non-empty
   `rejected` list → `{ ok: false, code: "NORMALIZATION_REJECTED", message,
   rejections: [{ sourceKey, code, detail }] }` and NEVER invoke `reconcile`
   on the accepted subset.
4. **Reconcile** — `reconcile(scope, bankMovements, ledgerMovements)`; wrap in
   try/catch for `BankReconciliationError` → structured `{ ok: false, code,
   message }` (codes: `INVALID_SCOPE`, `NORMALIZATION_REJECTED`,
   `CROSS_RUC_ACCESS`, `NEGATIVE_AMOUNT`, `FRACTIONAL_CENTS`,
   `UNCLASSIFIED_DIFFERENCE`).
5. **Serialize** — `{ ok: true, scope, differences, fullyMatched }` with BigInt
   → decimal string via the serializer.

### Error payload shape (in `content[0].text`)

```ts
type ToolResult =
  | { ok: true; scope: unknown; differences: unknown[]; fullyMatched: boolean }
  | { ok: false; code: string; message: string; rejections?: { sourceKey: string; code: string; detail: string }[] };
```

The MCP response itself stays a successful JSON-RPC result (`content[0].text`
carries the serialized `ToolResult`), so the server remains responsive and no
`INTERNAL_ERROR`/stack frame ever reaches the host. `INVALID_INPUT` is the one
tool-level code (schema violation) outside the engine's
`BankReconciliationErrorCode` union; all engine-derived failures use the
engine's own codes verbatim.

### JSON-safe serializer

```ts
function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString(); // decimal string of cents
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]));
  return value;
}
```

`amountCents` (and any BigInt) serializes as a decimal string of the cent value
— no BigInt literal can reach the wire. Identical inputs → identical output
(deterministic, side-effect-free; the handler never mutates state).

## Registration

- `mcp/index.ts` barrel: add `export { bankReconcileTool } from "./tools.js";`
- `cmd/commands/mcp-serve.ts`:

```ts
server.registerTool(bankReconcileTool());
```

- `drenyra-ai mcp serve` then lists `bank.reconcile` alongside `capabilities`
  and `ledger.validate`.

## Test plan (strict TDD, `mcp/__tests__/reconcile.test.ts`)

Server level (`makeServer()` + `handleMessage`, mirroring `server.test.ts`):

1. `tools/list` includes `bank.reconcile`.
2. Happy path fully matched → `ok: true`, `fullyMatched: true`, one
   `matched` difference, `amountCents` as string.
3. Mixed input → all four classifications present, `fullyMatched: false`.
4. `INVALID_INPUT` — amount as JSON number; missing `ledger`.
5. `INVALID_SCOPE` — bad RUC / bad period.
6. `CROSS_RUC_ACCESS` — row RUC differs from scope.
7. `NEGATIVE_AMOUNT` — `amount: "-250.00"`.
8. `FRACTIONAL_CENTS` — `amount: "250.005"`.
9. `NORMALIZATION_REJECTED` — malformed amount `"abc"`; any rejection blocks
   the reconcile delegation (no result emitted).
10. Determinism/side-effect-free — two identical calls, same result.

Stdio level (`runMcpStdio` with the `nodeStdioLines`-style harness, mirroring
`stdio.test.ts`):

1. Full `tools/call` round-trip delivers the reconciliation content over the
    line protocol.

Capability matrix: the `bank-reconciliation` row gains a note that the MCP
server exposes `bank.reconcile` (SDD change `mcp-bank-reconcile-tool`).

## Non-goals

- No `bank.normalize` / `bank.adjust` / `bank.report` tools (follow-up slice).
- No change to `mcp/server.ts`, `mcp/protocol.ts`, `mcp/stdio.ts`, or the
  engine (`bank-reconciliation/**` stays byte-identical).
- No mutations, no ledger writes, no candidates/receipts through the tool.
- No runtime JSON-Schema dependency (node:crypto-only); shape validation is
  hand-rolled in the handler.
