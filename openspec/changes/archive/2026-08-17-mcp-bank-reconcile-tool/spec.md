# Bank Reconciliation MCP Tool Specification

## Purpose

Defines the `bank.reconcile` MCP tool: a read-only, thin typed wrapper that exposes the deterministic SDD-CON-001 bank-reconciliation engine (`bank-reconciliation/`) on the drenyra-ai MCP server (`mcp/`, JSON-RPC 2.0 over stdio, protocol 2025-03-26). The tool validates the RUC + fiscal-period scope, normalizes canonical bank and ledger rows through `normalizeBankRows`/`normalizeLedgerRows`, delegates to the engine `reconcile` when every row is accepted, and returns the structured `Reconciliation` — differences classified as matched / bank-only / ledger-only / conflict with the `fullyMatched` flag — serialized as JSON text content. Monetary amounts travel as decimal strings end-to-end (money is never a JS Number on the wire and never a float), typed engine errors surface as structured errors in the tool response with no stack leakage, and matching is advisory to the host: the tool never mutates the ledger, never creates candidates or receipts, and never reimplements engine matching.

## Requirements

### Requirement: `bank.reconcile` tool registration

The MCP server MUST register a tool named `bank.reconcile` whose `tools/list` entry exposes its `name`, `description`, and `inputSchema`; a `tools/call` request targeting `bank.reconcile` MUST complete with either a structured reconciliation result or a structured typed error, and MUST NOT return `METHOD_NOT_FOUND`; `createDrenyraMcpServer()` MUST register the tool so `drenyra-ai mcp serve` exposes it on the stdio surface.

#### Scenario: Tool is listed alongside the existing surface

- GIVEN a running MCP server with the registered tools
- WHEN `tools/list` is requested
- THEN the result includes an entry named `bank.reconcile` in addition to `capabilities` and `ledger.validate`

#### Scenario: Tool is callable by name

- GIVEN a `tools/call` request with `name: "bank.reconcile"` and a valid input
- WHEN the server processes the request
- THEN the server responds with a result or a structured error, and never with `METHOD_NOT_FOUND`

#### Scenario: Production server exposes the tool

- GIVEN `createDrenyraMcpServer()` built by the `drenyra-ai mcp serve` command
- WHEN the server is started and its tools are listed over stdio
- THEN `bank.reconcile` is discoverable and callable over the stdio surface

### Requirement: Input contract

The `bank.reconcile` inputSchema MUST be JSON Schema (draft-07 style) declaring a single object with `required: ["scope", "bank", "ledger"]` and `additionalProperties: false`; `scope` MUST be an object with required `ruc` (string) and `period` (string); `bank` MUST be an array of rows `{ ruc, date, reference, amount, side, sourceKey }` where `amount` is a decimal string and `side` is restricted to `"deposit" | "withdrawal"`; `ledger` MUST be an array of rows `{ ruc, date, reference, amount, side, sourceKey }` where `amount` is a decimal string and `side` is restricted to `"debit" | "credit"`; every monetary `amount` MUST be declared and handled as a string — the tool MUST NEVER accept a JSON number for an amount. A call whose input violates the schema — missing required field, non-object `scope`, amount as a number, unknown side token, or extra top-level property — MUST yield a tool error; the server MUST NOT crash and MUST remain responsive to subsequent requests.

#### Scenario: Schema declares the required shape

- GIVEN the registered `bank.reconcile` tool
- WHEN its `inputSchema` is inspected
- THEN it requires `scope`, `bank`, and `ledger`, forbids additional properties, types every amount as a string, and constrains each `side` to its two allowed tokens

#### Scenario: Amount as a JSON number is rejected

- GIVEN a `tools/call` for `bank.reconcile` where a row `amount` is a JSON number
- WHEN the tool runs
- THEN the call fails with a tool error and a subsequent valid request to the same server still succeeds

#### Scenario: Missing required field is rejected

- GIVEN a `tools/call` for `bank.reconcile` whose input omits `ledger`
- WHEN the tool runs
- THEN the call fails with a tool error naming the missing field

### Requirement: Happy-path reconciliation result

Given a valid scope and rows that all normalize, the tool MUST normalize the bank rows through `normalizeBankRows(scope, bank)` and the ledger rows through `normalizeLedgerRows(scope, ledger)`, delegate to the engine `reconcile(scope, bankMovements, ledgerMovements)` when both passes report zero rejections, and return the structured `Reconciliation` serialized as JSON text in the MCP `content[0].text` result — including the `scope`, every `difference` classified as `matched` / `bankOnly` / `ledgerOnly` / `conflict`, and the `fullyMatched` flag. The serialized payload MUST be JSON-safe with monetary amounts represented as decimal strings — never as BigInt literals and never as JSON numbers.

#### Scenario: Fully matched input reports `fullyMatched`

- GIVEN one bank row and one ledger row in the same scope that normalize to the same reference, date, amount, and side
- WHEN the tool is called
- THEN the text content serializes a `Reconciliation` with `fullyMatched: true` and exactly one difference classified `matched`

#### Scenario: Mixed input reports every classification

- GIVEN bank and ledger rows where one pair matches, one bank row has no counterpart, one ledger row has no counterpart, and one reference is ambiguous
- WHEN the tool is called
- THEN every movement appears in exactly one classified difference (`matched` / `bankOnly` / `ledgerOnly` / `conflict`) and `fullyMatched` is false

### Requirement: Scope validation fail-closed

The tool MUST validate the scope before any normalization or matching — exactly one 11-digit RUC and one `YYYYMM` fiscal period with a real month (01-12). A malformed or out-of-range scope MUST fail with the typed error `INVALID_SCOPE` and MUST NOT produce a reconciliation result.

#### Scenario: Invalid RUC is rejected

- GIVEN a call whose `scope.ruc` is not exactly 11 digits
- WHEN the tool runs
- THEN the response carries the typed error `INVALID_SCOPE` and no reconciliation result

#### Scenario: Invalid period is rejected

- GIVEN a call whose `scope.period` is not `YYYYMM` or whose month is outside 01-12
- WHEN the tool runs
- THEN the response carries the typed error `INVALID_SCOPE` and no reconciliation result

### Requirement: Normalization rejections fail-closed

Every row that cannot be normalized MUST be rejected with a typed code: `CROSS_RUC_ACCESS` when the row RUC differs from the scope RUC, `NEGATIVE_AMOUNT` for a negative amount, `FRACTIONAL_CENTS` for an amount below the integer cent, and `NORMALIZATION_REJECTED` for any other unprocessable row (malformed amount string, invalid date, empty reference after normalization, unknown side token, empty or duplicate `sourceKey`). When either normalize result has a non-empty `rejected` list, the tool MUST NOT invoke `reconcile`; it MUST fail with a structured error carrying the overall code `NORMALIZATION_REJECTED` and the per-row rejections (`sourceKey`, `code`, `detail`). The tool MUST NEVER reconcile the accepted subset as if it were the complete input.

#### Scenario: Cross-RUC row is rejected

- GIVEN a bank row whose `ruc` differs from the scope RUC
- WHEN the tool runs
- THEN the response carries a rejection with code `CROSS_RUC_ACCESS` naming the row `sourceKey` and no reconciliation result

#### Scenario: Negative amount is rejected

- GIVEN a row with `amount: "-250.00"`
- WHEN the tool runs
- THEN the response carries a rejection with code `NEGATIVE_AMOUNT`

#### Scenario: Fractional cents are rejected

- GIVEN a row with `amount: "250.005"`
- WHEN the tool runs
- THEN the response carries a rejection with code `FRACTIONAL_CENTS`

#### Scenario: Malformed amount is rejected

- GIVEN a row with `amount: "abc"` or an empty string
- WHEN the tool runs
- THEN the response carries a rejection with code `NORMALIZATION_REJECTED`

#### Scenario: Any rejection blocks the reconcile delegation

- GIVEN valid rows plus at least one rejected row in the same call
- WHEN the tool runs
- THEN the response is a structured `NORMALIZATION_REJECTED` error that includes the rejected row `sourceKey`, and no reconciliation result is emitted

### Requirement: Read-only advisory surface

The tool MUST NOT write to the ledger, create candidates, emit receipts, or mutate any persisted state; `bank.reconcile` is advisory matching for the host, exactly like `ledger.validate`. The tool MUST be deterministic: identical inputs MUST produce identical results with no state change between calls.

#### Scenario: Successful call performs no mutations

- GIVEN a successful `bank.reconcile` call
- WHEN the call completes
- THEN no ledger entry, candidate, or receipt is created or modified

#### Scenario: Repeated calls are deterministic and side-effect-free

- GIVEN two calls with identical inputs to the same server
- WHEN both run
- THEN both return the same reconciliation result and no persisted state changed between them

### Requirement: Structured typed errors without stack leakage

Engine failures MUST surface in the tool response as structured typed errors that identify the `BankReconciliationErrorCode` — `INVALID_SCOPE`, `NORMALIZATION_REJECTED`, `CROSS_RUC_ACCESS`, `NEGATIVE_AMOUNT`, `FRACTIONAL_CENTS`, or `UNCLASSIFIED_DIFFERENCE` — together with a readable message. The response MUST NOT leak stack traces or internal module frames, and MUST NOT fall back to a guessed match or a fabricated `fullyMatched` result on failure.

#### Scenario: Error payload is typed and readable, with no stack trace

- GIVEN a call that fails with `INVALID_SCOPE`
- WHEN the response is inspected
- THEN it carries the code `INVALID_SCOPE` and a readable message, and contains no `at` stack frames or internal source paths

#### Scenario: Failure never fabricates a match

- GIVEN a call with unprocessable input (invalid scope, cross-RUC row, or malformed amount)
- WHEN the tool runs
- THEN it never returns a reconciliation result claiming matches or `fullyMatched: true`

### Requirement: Capability matrix note

The `bank-reconciliation` capability row in `openspec/programs/drenyra-dominion/capability-matrix.yaml` MUST note the MCP surface extension — the `bank.reconcile` tool on the drenyra-ai MCP server.

#### Scenario: Matrix row notes the MCP surface extension

- GIVEN the capability matrix under `openspec/programs/drenyra-dominion/`
- WHEN the `bank-reconciliation` capability row is inspected
- THEN it references the `bank.reconcile` MCP tool surface

### Requirement: Server and stdio test coverage

The MCP test suite MUST cover `bank.reconcile` at the server level (driving the server with `handleMessage` as in `mcp/__tests__/server.test.ts`) and over the stdio surface (driving `runMcpStdio` as in `mcp/__tests__/stdio.test.ts`), exercising the happy path, every difference classification (`matched` / `bankOnly` / `ledgerOnly` / `conflict`), scope rejection, cross-RUC rejection, and malformed-amount rejection.

#### Scenario: Server-level tests cover the happy path and classifications

- GIVEN the test server with `bank.reconcile` registered
- WHEN `tools/call` runs with a fully matched input and with mixed inputs
- THEN the assertions verify `fullyMatched` true and false, and each of the four difference classifications

#### Scenario: Server-level tests cover the rejections

- GIVEN the test server with `bank.reconcile` registered
- WHEN `tools/call` runs with an invalid scope, a cross-RUC row, and a malformed amount
- THEN each call returns the corresponding typed error (`INVALID_SCOPE`, `CROSS_RUC_ACCESS`, `NORMALIZATION_REJECTED`)

#### Scenario: Stdio round-trip delivers the result

- GIVEN the stdio test harness
- WHEN a full `bank.reconcile` request is driven through `runMcpStdio`
- THEN the response is delivered over the line protocol with the expected reconciliation content
