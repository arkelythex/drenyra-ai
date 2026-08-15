# SDD-110 Option A — Connector-Adapter Conformance Design

> Contract target: `connector-adapter` v0.1 · Status: **DRAFT**
> Scope: transport-agnostic mutation-adapter surface and in-memory conformance only

## Overview

This change adds a mutation port beside the fetch-only `EvidenceAdapter`. It composes existing mission idempotency, reconciliation, tenant-scope, and receipt primitives without modifying them.

The dependency direction remains `contracts/ -> library modules -> agents/ -> cmd/`. The normative document lives in `contracts/`; executable types and validators live in `adapters/`. No agent, command, flow, registry, capability declaration, network, filesystem, database, credential, or vendor integration is added.

Deterministic Core remains authoritative. A connector performs only a declared mutation and returns evidence or uncertainty. It does not decide materiality, mint receipts, promote capabilities, infer an external verdict, or bypass gates.

There are no money fields. The BigInt-cents rule is not exercised and no monetary representation is introduced.

## Decisions

### D1 — Minimal two-branch result

```ts
type ConnectorExecuteResult =
  | { kind: "SUCCESS"; evidence: ExternalEvidence }
  | { kind: "UNKNOWN"; stableIdentifier: string };
```

There is no `FAILED` or `REFUSED` branch in v0.1. Invalid input, authority refusal, scope mismatch, concurrency rejection, and definitive local failures are fail-closed errors. They are recorded and replayed but are not external outcomes. This prevents any non-success result from being mistaken for proof that an action did not execute (REQ-CONN-001/002/005).

`SUCCESS` uses `evidence.identifier` as its stable identifier. `UNKNOWN` carries one directly because acceptable evidence does not yet exist.

### D2 — Adapter receives only branded scope

`ConnectorAdapter.execute` accepts `ValidatedTenantScope`, never raw `TenantScope`. A boundary helper accepts a raw request, calls `validateTenantScope`, and returns a branded input. Invalid scope throws the existing `TenantScopeError` before adapter invocation.

This preserves tenant-core as validation authority and makes unchecked fiscal identity unavailable to the mutation port. `assertSameConnectorScope(expected, actual)` delegates to `sameTenantScope` before any response-associated evidence is accepted.

### D3 — Inject the existing IdempotencyStore

A `ConnectorAdapterFactory` receives `ConnectorAdapterDependencies`, with the existing `IdempotencyStore` as a required member. The store is injected once at composition, not passed per execution and not created globally in `connector.ts`.

The mock driver creates one `InMemoryIdempotencyStore` and reuses the adapter across replay vectors. `canonicalHash`, `IdempotencyConflict`, `IdempotencyStore`, and the in-memory store are imported through `../missions/index.js`; no hash, conflict, record, or store implementation is copied.

The key binds to the complete immutable execution envelope excluding the key: mission ID, target, validated scope components, and command. `canonicalHash(envelope)` prevents replay across tenant or authority boundaries while retaining the single canonical hash primitive.

`IdempotencyRecord.result` stores an internal terminal connector envelope: either the result or a replayable error descriptor plus creation time. `EXECUTING` is written before mutation; `COMPLETED` or `FAILED` follows a terminal result or error.

### D4 — Assert receipt compatibility; do not construct receipts

The success vector asserts `SUCCESS`, verifiable evidence, compatibility with `ReceiptType.EXTERNAL_SUBMISSION`, and absence of receipt/signature/issuance fields. The mock does not construct or sign a receipt.

Core owns receipt construction under REQ-CONN-005. Constructing one in the adapter test would blur authority and introduce unrelated receipt fields.

### D5 — Explicit restricted-authority checks

Input names a target system, jurisdiction, and operation. The adapter declares one `ConnectorCapability`. `assertConnectorAuthority` compares all three as exact, case-sensitive strings before idempotency claim or mutation. An empty operations list grants no authority.

### D6 — Reuse reconciliation unchanged

No parallel resolver or decision vocabulary is added. For `UNKNOWN`, the caller builds existing `ExternalCall` from the result's `stableIdentifier`, the target `system`, and input `missionId`, then calls `reconcileExternalCall` unchanged.

Existing outcomes remain `executed | not-executed | indeterminate`; decisions remain `record | retry | human-intervention`. A retry reuses the original key and envelope. No helper retries automatically.

### D7 — Small connector error vocabulary

`ConnectorValidationError` covers only failures not owned by an existing primitive:

- `INVALID_IDEMPOTENCY_KEY`
- `ALREADY_EXECUTING`
- `SCOPE_MISMATCH`
- `UNDECLARED_SYSTEM`
- `UNDECLARED_JURISDICTION`
- `UNDECLARED_OPERATION`
- `UNVERIFIABLE_EVIDENCE`
- `INVALID_STABLE_IDENTIFIER`

Different-payload reuse throws existing `IdempotencyConflict`; invalid raw scope throws `TenantScopeError`; reconciliation failures remain `ReconciliationError`.

## Module layout and file map

| File | Change | Responsibility |
| --- | --- | --- |
| `adapters/connector.ts` | add | Public mutation types, dependency type, errors, fail-closed validators. |
| `adapters/__tests__/connector-conformance.test.ts` | add | In-memory mock and normative vectors. |
| `adapters/index.ts` | modify | Export `connector.js`. |
| `contracts/connector-adapter.md` | add | DRAFT v0.1 normative contract. |
| `contracts/README.md` | modify | DRAFT index row and status summary. |

Explicitly unchanged:

- `adapters/registry.ts`, `EvidenceAdapter`, and `adapters/local.ts`;
- `flow/close.ts`;
- `cmd/declared-surface.ts` and `DECLARED_ADAPTERS`;
- mission, tenant, receipt, capability-matrix, and CI workflow primitives.

The package already exports `./adapters`, so `package.json` does not change.

## Type definitions (illustrative TypeScript)

```ts
import type { ExternalEvidence, IdempotencyStore } from "../missions/index.js";
import type {
  TenantScope,
  ValidatedTenantScope,
} from "../tenant-core/index.js";

export interface ConnectorCapability {
  readonly system: string;
  readonly jurisdiction: string;
  readonly operations: readonly string[];
}

export interface ConnectorTarget {
  readonly system: string;
  readonly jurisdiction: string;
  readonly operation: string;
}

export interface ConnectorExecuteRequest {
  readonly missionId: string;
  readonly idempotencyKey: string;
  readonly command: unknown;
  readonly tenantScope: TenantScope;
  readonly target: ConnectorTarget;
}

export interface ConnectorExecuteInput
  extends Omit<ConnectorExecuteRequest, "tenantScope"> {
  readonly tenantScope: ValidatedTenantScope;
}

export type ConnectorExecuteResult =
  | { readonly kind: "SUCCESS"; readonly evidence: ExternalEvidence }
  | { readonly kind: "UNKNOWN"; readonly stableIdentifier: string };

export interface ConnectorAdapter {
  readonly name: string;
  declareCapability(): ConnectorCapability;
  execute(input: ConnectorExecuteInput): Promise<ConnectorExecuteResult>;
}

export interface ConnectorAdapterDependencies {
  readonly idempotencyStore: IdempotencyStore;
}

export type ConnectorAdapterFactory = (
  dependencies: ConnectorAdapterDependencies,
) => ConnectorAdapter;
```

The factory describes injection only; it does not register an adapter or claim availability. Implementations may use classes or closures if they satisfy the factory and conformance behavior.

## Function signatures

```ts
export function validateConnectorExecuteRequest(
  request: ConnectorExecuteRequest,
): ConnectorExecuteInput;

export function assertConnectorAuthority(
  capability: ConnectorCapability,
  target: ConnectorTarget,
): void;

export function assertSameConnectorScope(
  expected: ValidatedTenantScope,
  actual: TenantScope,
): void;

export function assertConnectorResult(result: ConnectorExecuteResult): void;

export class ConnectorValidationError extends Error {
  readonly code: ConnectorValidationErrorCode;
}
```

`validateConnectorExecuteRequest` checks non-empty mission ID, validates the key through `isValidIdempotencyKey`, validates raw scope through `validateTenantScope`, and returns a branded input. Authority remains separate because it depends on the adapter declaration.

`assertConnectorResult` accepts `SUCCESS` only when `isVerifiableEvidence` passes and `UNKNOWN` only with a non-empty stable identifier. Unknown runtime shapes fail closed despite the static union.

## Fail-closed flow

1. Receive raw `ConnectorExecuteRequest` at Core composition.
2. Validate mission ID, key, and scope; reject before adapter invocation.
3. Read capability and call `assertConnectorAuthority`.
4. Build the immutable execution envelope and call `canonicalHash(envelope)`.
5. Read the injected store by key.
6. Different hash: throw existing `IdempotencyConflict` with both hashes.
7. Matching terminal record: replay result or error without mutation.
8. Matching `EXECUTING`: throw `ALREADY_EXECUTING`.
9. Claim `EXECUTING` before mutation.
10. Invoke the mock mutation hook exactly once.
11. Compare expected and response scope before evidence acceptance.
12. Validate result; reject unverifiable success or empty UNKNOWN identifier.
13. Persist result/UNKNOWN as `COMPLETED`, or definitive local error as `FAILED`.
14. For `UNKNOWN`, make no verdict; delegate later resolution to `reconcileExternalCall`.
15. For `SUCCESS`, give evidence to Core for future `EXTERNAL_SUBMISSION` construction.

Failure order is observable: validation, authority, and replay precede mutation; scope and evidence validation precede evidence acceptance.

## Export plan

`adapters/index.ts` adds:

```ts
export * from "./connector.js";
```

Consumers use the existing package subpath:

```ts
import type { ConnectorAdapter } from "drenyra-ai/adapters";
```

`connector.ts` imports public primitives through mission and tenant barrels. No root or package export is added.

## Contract document outline

`contracts/connector-adapter.md` follows the `brand-system.md` convention:

1. DRAFT header: contract name, version 0.1, status, transport-agnostic.
2. Important notice: CI pins drift; freeze requires adoption and explicit approval.
3. Purpose and distinction from fetch-only `EvidenceAdapter`.
4. Normative surface: capability, branded input, SUCCESS/UNKNOWN, store injection, reconciliation composition.
5. Invariants: replay, UNKNOWN honesty, scope isolation, restricted authority, evidence-bound success, Core-owned receipts, no I/O/credentials.
6. Fail-closed behavior and inherited error identities.
7. Conformance statement: mock vectors run in the existing Vitest `test` job.
8. Compatibility: DRAFT changes require version and vector updates.
9. Freeze criteria: approved ecosystem adoption plus explicit contract approval.
10. Non-claims: no live connector, registration, flow wiring, capability promotion, production store, KMS, network, receipt issuance, or policy authority.

## Test plan and strict TDD order

Strict TDD is active. Tests are written failing first.

### RED 1 — Boundary vectors

1. Import intended public API from `adapters/index.ts`.
2. Reject invalid idempotency key with `INVALID_IDEMPOTENCY_KEY`.
3. Reject malformed RUC/period/company with existing `TenantScopeError` codes.
4. Reject undeclared operation, system, and jurisdiction before mutation.
5. Reject cross-tenant response scope before evidence acceptance.

### GREEN 1 — Minimal surface

Add types, errors, branding helper, authority/scope/result guards, and barrel export. Add no I/O or registry wiring.

### RED 2 — Idempotency vectors

1. Same key/envelope replays identical result; mutation count remains one.
2. Same key/different envelope throws existing `IdempotencyConflict`; no mutation.
3. Deferred first call leaves `EXECUTING`; concurrent call gets `ALREADY_EXECUTING`; at most one mutation reaches the hook.
4. Recorded terminal local error replays without another mutation.

### GREEN 2 — Mock driver

Implement only test-local `MockConnectorAdapter`: injected `InMemoryIdempotencyStore`, synchronous mock in-flight claim, mutation counter, response-scope fixtures, and controllable outcomes.

### RED 3 — Outcome and reconciliation vectors

1. Interrupted call returns `UNKNOWN` with stable identifier and no verdict.
2. `executed` plus verifiable evidence maps to `record`.
3. `executed` without valid evidence throws `EXECUTED_WITHOUT_EVIDENCE`.
4. `not-executed` maps to `retry`, demonstrated with the original key.
5. `indeterminate` maps to `human-intervention` without retry or record.
6. Missing resolver throws `NO_RESOLVER`.
7. `SUCCESS` accepts complete evidence with lowercase 64-hex response hash.
8. Invalid success evidence fails with `UNVERIFIABLE_EVIDENCE`.
9. Success is compatible with `EXTERNAL_SUBMISSION` and contains no receipt.

### GREEN 3 / REFACTOR — Pin behavior

Make the mock pass without changing mission, reconciliation, tenant, or receipt primitives. Keep fixtures deterministic and in-memory; refactor only after green.

### Structural and CI vectors

1. Inspect imports: no built-in except permitted `node:crypto` through existing Core; no HTTP, net, fs, database, cloud, or vendor dependency.
2. Conforming mock passes all vectors.
3. A negative fixture proves contract drift fails the suite without committing a failing test.
4. Existing `bun run test` discovers the Vitest file; no workflow edit.
5. Verification: `bun run typecheck`, `bun run test`, and available `bun run lint`.

## Changed-line estimate

| File | Estimated changed lines |
| --- | ---: |
| `adapters/connector.ts` | 90–105 |
| `adapters/__tests__/connector-conformance.test.ts` | 145–165 |
| `contracts/connector-adapter.md` | 80–95 |
| `contracts/README.md` | 2–4 |
| `adapters/index.ts` | 1 |
| **Total** | **318–370** |

Target: approximately 345 lines, within the requested 320–380 shape and below 400. This exceeds the older 300-line budget in `config.yaml`; tasks must forecast it rather than weaken conformance. Near 400, reduce fixture/prose duplication or split index/document mechanics, never safety vectors.

## Open risks and design conflicts

1. **Atomic claim gap.** `IdempotencyStore` has `get`/`put`, not compare-and-set. The in-memory mock proves single-process behavior by making `EXECUTING` visible before asynchronous mutation. A distributed production adapter needs transactional serialization or fencing. That primitive is outside Option A and must be resolved before a live connector; arbitrary store implementations are not implied race-safe.
2. **ExternalCall context gap.** `ExternalCall` lacks tenant scope and idempotency key. The caller retains original context, reuses the key on retry, and enforces scope before reconciliation. v0.1 does not create a parallel call type.
3. **Runtime versus static validation.** Branding protects typed callers, but transport inputs remain untrusted; raw-request and result guards are mandatory at composition boundaries.
4. **Premature availability claim.** The mock, export, and CI gate could be misread as production. DRAFT wording, unchanged `DECLARED_ADAPTERS`, and no capability promotion control this.
5. **Line-budget tension.** Table-driven tests and shared fixtures should reduce duplication without collapsing distinct fail-closed assertions.
6. **No other architecture conflict.** The design is additive, keeps `EvidenceAdapter` separate, reuses Core primitives, and adds no reverse import or forbidden I/O.
