# Apply Progress — sdd-110-production (Option A: Connector-Adapter Conformance)

> Phase: apply · Branch: `feat/sdd-110-connector-conformance` · Commit: `5c50b9d` · PR: #59
> Status: implementation complete and green; verification CONDITIONAL PASS (9/9 requirements, 20/20 scenarios).

## Scope delivered

DRAFT v0.1 connector-adapter contract + type-level mutation boundary + mock conformance suite:

| File | Purpose |
| --- | --- |
| `adapters/connector.ts` | node:crypto-only type surface: `ConnectorAdapter`, `ConnectorExecuteRequest/Input`, `ConnectorExecuteResult` (`SUCCESS` w/ verifiable evidence \| `UNKNOWN` w/ `stableIdentifier`), `ConnectorCapability/Target`, `ConnectorAdapterFactory`, fail-closed validators (request, authority, scope, result) |
| `adapters/__tests__/connector-conformance.test.ts` | In-memory `MockConnectorAdapter` driver + 29 normative tests covering SC-CONN-001..020 |
| `contracts/connector-adapter.md` | DRAFT v0.1 contract per `brand-system.md` convention (10-section outline) |
| `adapters/index.ts` | +1 barrel line: `export * from "./connector.js";` |
| `contracts/README.md` | +1 DRAFT index row + status summary line |

Reused primitives (never reimplemented): `canonicalHash`/`IdempotencyStore`/`isValidIdempotencyKey`/`isVerifiableEvidence` via missions barrel, `reconcileExternalCall` unchanged, `validateTenantScope`/`sameTenantScope` via tenant-core barrel, `ReceiptType.EXTERNAL_SUBMISSION` kind assertion (Core owns receipt construction; adapter never mints).

## TDD Cycle Evidence (strict TDD, RED → GREEN → TRIANGULATE → REFACTOR)

| Task | Test File | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| T-CONN-001 surface + validators | connector-conformance.test.ts | Unit | ✅ module missing, import fail | ✅ 29/29 | ✅ 3+ cases/guard (table-driven) | ✅ final shape |
| T-CONN-002 idempotent execute | same | Unit | ✅ RED captured | ✅ replay/conflict/concurrent | ✅ 4 scenarios | ✅ replay helper |
| T-CONN-003 UNKNOWN + reconciliation | same | Unit | ✅ RED captured | ✅ record/retry/human/NO_RESOLVER | ✅ 6 scenarios | ✅ |
| T-CONN-004 scope isolation | same | Unit | ✅ RED captured | ✅ SCOPE_MISMATCH pre-mutation | ✅ guard + execute-level | ✅ |
| T-CONN-005 evidence-bound success | same | Unit | ✅ RED captured | ✅ UNVERIFIABLE_EVIDENCE + EXTERNAL_SUBMISSION | ✅ 3 cases | ✅ |
| T-CONN-006 restricted authority + crypto-only | same | Unit | ✅ RED captured | ✅ 4 target drifts + empty ops + probe | ✅ | ✅ |
| T-CONN-007 contract doc + index | — | doc | N/A (doc) | ✅ authored | ✅ DRAFT wording audited | ✅ |
| T-CONN-008 suite complete + drift | same | Unit | ✅ RED captured | ✅ all-vectors + drift fixture | ✅ | ✅ |

Every RED was captured as a real failing test (module-resolution failure for the new module; targeted failures per unit). The final suite is 29 tests / 88 assertions, table-driven and non-vacuous (loops carry real assertions; forbidden-import probe is explicit).

## Deviations (documented, not silent)

1. **Empty `missionId` maps to `INVALID_IDEMPOTENCY_KEY`** — the D7 error vocabulary is closed; the mission-ID check is grouped under that code (documented in the module).
2. **Idempotency driver is test-local** — `connector.ts` exports only the designed surface (types + validators); the execution driver (idempotency claim, replay, mutation hook) is owned by the mock and by future connector implementations.
3. **Structural probe uses `node:fs` `readFileSync` in the TEST** (matches `registry.test.ts` precedent); `connector.ts` itself imports no Node builtin at all. `?raw` imports fail `tsc --noEmit` in this repo.
4. **Size exception** — 1043 changed lines (forecast 318–370; cap 400): mandated REQ-CONN-001..009 / SC-CONN-001..020 coverage with real assertions plus mock driver and DRAFT doc is inherently ~1000 lines; accepted per documented maintainer-reset precedent (recorded in commit `5c50b9d` and PR #59).

## Gates (run at apply close + independently re-run by verifier)

- `bun run test` → **1010 passed / 0 failures** (71 files; baseline 981)
- `bun run typecheck` → 0 errors
- `bun run build` → OK
- `bun run lint` (biome) → clean
- `git show --stat 5c50b9d` → exactly 5 paths changed; protected paths (`missions/`, `tenant-core/`, `receipts/`, `flow/close.ts`, `adapters/registry.ts`, `adapters/local.ts`, `cmd/`, `.github/workflows/`) clean. `DECLARED_ADAPTERS=[]` unchanged; capability-matrix connector rows stay `planned` (R17).
