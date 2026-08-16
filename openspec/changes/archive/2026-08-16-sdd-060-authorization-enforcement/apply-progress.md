# Apply Progress — sdd-060-authorization-enforcement

Authorization Enforcement in Approval Gates — wires the standalone `authorize()` RBAC engine into the approval gate pipeline as a new `AuthorizationGate`.

## Structured status consumed

Native `gentle-ai sdd-status` (openspec store, authoritative):

- `changeName`: sdd-060-authorization-enforcement
- `artifactStore`: openspec
- `applyState`: ready → (after this phase) all implementation tasks complete
- `dependencies.apply`: ready
- `nextRecommended`: apply
- `blockedReasons`: []
- `actionContext`: `mode: repo-local`, `workspaceRoot`/`allowedEditRoots`: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai` (safe to edit)
- `taskArtifactErrors`: null

Runtime attempt ledger: `sdd-attempt acquire` → `state: proceed` (token `sha256:6bf0…69d8d`); `sdd-attempt settle` → `state: complete` (evidence revision `2b57f6a00f1453b05c4f648c831868ccef4f629cad26f7a0f9df96d7dbb0c772`).

## Baseline (safety net, pre-change)

- `gates/__tests__/gates.test.ts`: **19/19 passing** (captured before any edit).
- Repo baseline per orchestrator: 1363 tests / 89 files + known pre-existing release-integrity flake (passes 13/13 isolated).
- Slice start state confirmed (Phase 1): `gates/authorization.ts` absent; `GateName` union was `"mission" | "receipt" | "approval" | "pre-commit" | "release"`; `gates/index.ts` exported `ApprovalGate`, `distinctApprovers`, `ReceiptGate`, `MissionStateGate`, `GateRunner` (no `AuthorizationGate`); `gates/__tests__/authorization-gate.test.ts` absent.

## Scope-derivation mapping (confirmed before implementation)

`MissionSnapshot` carries `companyId` + `fiscalPeriod` (no separate `ruc`). Gate fixtures and mission tests use the 11-digit RUC as `companyId` (`"20123456789"`), but synthetic tenants use non-RUC ids (`"synthetic-pe-01"` in `e2e-monthly-close.test.ts`). Mapping:

```ts
validateTenantScope({ companyId: mission.companyId, ruc: mission.companyId, period: mission.fiscalPeriod })
```

- `ruc` mirrors `companyId` (established convention: companyId IS the RUC for real tenants).
- `validateTenantScope` rejects non-11-digit RUC / malformed periods → scope underivable → `needs_input` (fail closed). Synthetic tenants therefore fail closed, never allow.

## Completed tasks (24 implementation-owned, persisted `- [x]` in tasks.md)

| Task | Evidence |
|---|---|
| W1 confirm start state + scope mapping | recorded above |
| W1 vocabulary RED → GREEN (`GateName` += `"authorization"`) | typecheck RED TS2322 → exit 0 after edit |
| W1 quantity passthrough RED → GREEN | 5 tests |
| W1 per-approver RBAC RED → GREEN | 5 tests |
| W1 scope isolation RED → GREEN | 3 tests |
| W1 fail-closed evidence RED → GREEN | 4 tests |
| W1 determinism RED → GREEN | 2 tests |
| W1 TRIANGULATE boundaries | 3 tests (never-throws, unknown-identity, gate label) |
| W1 slice verification | gates suite 42/42, typecheck exit 0 |
| W2 barrel export RED → GREEN | export test: RED (undefined) → GREEN |
| W2 import-boundary test | 4-specifier set equality + forbidden-module scan |
| W2 GateRunner composition tests | 2 tests (short-circuit + allow) |
| W2 full regression | see Verification below |
| W2 spec R1–R7 mapping | see Spec mapping below |
| W2 no-drift check | see No-drift below |

## Files changed

- `gates/types.ts` — `GateName` union gains `"authorization"` (vocabulary only; `GateContext`, `ApprovalRecord`, `GateResult` untouched).
- `gates/authorization.ts` — NEW: `AuthorizationGateOptions { assignments: readonly RoleAssignment[] }`; `AuthorizationGate implements Gate` (`name = "authorization"`); `evaluate` = ApprovalGate quantity passthrough (re-branded `gate: "authorization"`) THEN per-approval `authorize({ assignments, identity: record.approverId, permission: "close:approve", scope, materiality })`; every approver MUST be authorized; no assignments / underivable scope → `needs_input`; never throws.
- `gates/index.ts` — `export { AuthorizationGate } from "./authorization.js";` added alongside `ApprovalGate` (existing exports unchanged).
- `gates/__tests__/authorization-gate.test.ts` — NEW: 27 tests.

## Verification (commands + exact results)

| Command | Result |
|---|---|
| `bunx vitest run gates/__tests__/gates.test.ts` (safety net) | 19/19 pass |
| `bun run typecheck` (vocabulary RED) | exit 1, TS2322 `"authorization"` not assignable to `GateName` |
| `bunx vitest run gates/__tests__/authorization-gate.test.ts` (behavior RED) | 1 file failed, no tests (module `../authorization.js` missing) |
| `bun run typecheck` + focused vitest (post-GREEN) | exit 0; 23/23 pass |
| `bunx vitest run gates/__tests__/` (W1 slice) | 2 files, 42/42 pass |
| `bunx vitest run gates/__tests__/authorization-gate.test.ts` (W2 export RED) | 1 failed (export undefined) → after GREEN 27/27 |
| `bunx vitest run gates/__tests__/` (W2 slice) | 2 files, 46/46 pass |
| `bun run test` (full regression) | 1389 passed / 1 failed (1390 total, 100 files) |
| `bunx vitest run scripts/__tests__/release-integrity.test.ts` (isolated) | 13/13 pass — pre-existing flake under full-suite load, untouched by this change |
| `bun run typecheck` | exit 0 |
| `bun run build` | exit 0 |

Test count delta: 1363 baseline + 27 new = 1390. (file count 100 vs the 89 baseline reflects later branch evolution; count is exactly baseline + 1 new file).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| GateName vocabulary | `gates/__tests__/authorization-gate.test.ts` | Unit | 19/19 gates | Written (typecheck TS2322) | Passed (exit 0) | Single (closed union) | Clean |
| Quantity-tier passthrough | same file | Unit | N/A (new file) | Written (module missing) | Passed 5/5 | 5 cases incl. ApprovalGate identity | Clean |
| Per-approver RBAC | same file | Unit | N/A | Written | Passed 5/5 | allow + preparer/reviewer deny + 2nd-record | Clean |
| Scope isolation | same file | Unit | N/A | Written | Passed 3/3 | org + period + no-leak | Clean |
| Fail-closed evidence | same file | Unit | N/A | Written | Passed 4/4 | 3 needs_input paths + frozen denial | Clean |
| Determinism | same file | Unit | N/A | Written | Passed 2/2 | identical inputs + at-inert | Clean |
| Boundary triangulation | same file | Unit | N/A | Written | Passed 3/3 | never-throws + unknown-identity + label | Clean |
| Barrel export | same file | Unit | N/A | Written (undefined export) | Passed | identity/class equivalence | Clean |
| Import boundary | same file | Unit | N/A | Written (assertion corrected) | Passed | 4-specifier exact set | Clean |
| GateRunner composition | same file | Integration | N/A | Written | Passed 2/2 | short-circuit + allow | Clean |

### Test Summary

- **Total tests written**: 27 (all passing)
- **Total tests passing**: 27/27 (plus 19/19 pre-existing gates tests preserved)
- **Layers used**: Unit (25), Integration (2)
- **Approval tests** (refactoring): None — no refactoring tasks
- **Pure functions created**: `deriveScope` (1); gate logic is deterministic by construction

## Spec requirement mapping (R1–R7)

| Requirement | Evidence |
|---|---|
| R1 AuthorizationGate surface | `name: "authorization"` (types.ts vocabulary + test); `evaluate` accepts `GateContext` unchanged, returns `GateResult`; constructor takes `AuthorizationGateOptions.assignments`; exported from `gates/index.ts` (barrel test asserts identity with direct import); never throws (triangulation test); every returned result carries `gate: "authorization"` |
| R2 Quantity-tier passthrough | `ApprovalGate` composed first; verdict/reason/envelope identical to `ApprovalGate` for identical inputs (5 tests); R0/R1/unset allowed without consulting `authorize()` (empty-assignments proof); R2 no records → `needs_input` `requiredApprovers: 1`; R3 single/same approver → `blocked` |
| R3 Per-approver RBAC | `authorize()` per `ApprovalRecord` with `close:approve` at mission scope; every approver must pass (second-record test proves no skip); preparer/reviewer → `blocked` `insufficient-permission`; R2 one approver / R3 two distinct allowed |
| R4 Scope isolation | scope derived from mission (`{companyId, ruc: companyId, period: fiscalPeriod}` via `validateTenantScope`); foreign org → `scope-mismatch`; same org different period → `scope-mismatch`; serialized reason+envelope contains no foreign companyId/RUC/period |
| R5 Fail-closed evidence | empty `assignments` → `needs_input` (never allowed); mission absent → `needs_input`; mission scope fails validation (synthetic tenant) → `needs_input`; denial frozen + typed code/cause/continuation |
| R6 Determinism | identical inputs → identical verdict/reason/envelope (toEqual); `ApprovalRecord.at` inert; materiality compared ordinally on closed R0–R3 vocabulary (no floats); scope equality exact via engine `sameTenantScope` |
| R7 No engine/gate/contract drift | `git diff --name-only`: only `gates/index.ts` + `gates/types.ts` (tracked) and the 2 new files; no `authorization/`, `gates/approval.ts`, `gates/__tests__/gates.test.ts`, `contracts/`, `missions/`, `cmd/`, `flow/`, `agents/`; `authorization/roles.ts` byte-identical (no diff); import-boundary test locks the gate's 4-module import surface |

## No-drift confirmation

- Tracked diff: `gates/index.ts`, `gates/types.ts` only.
- New files: `gates/authorization.ts`, `gates/__tests__/authorization-gate.test.ts`.
- Protected-path scan: NO matches for `authorization/`, `gates/approval.ts`, `gates/__tests__/gates.test.ts`, `contracts/`, `missions/`, `cmd/`, `flow/`, `agents/`.
- Closed permission/role vocabulary: `authorization/roles.ts` byte-identical before/after; `close:approve` still granted to `approver` (imported unchanged from the engine).

## Deviations from design

- **Gate-name re-branding on passthrough**: the design text says "return its result verbatim", but the spec (R1) and the triangulation task require every returned `GateResult.gate` to be `"authorization"`. The passthrough therefore re-brands the `gate` field while preserving verdict, reason, and envelope exactly (verified equal to `ApprovalGate`'s in the identity test). This is the spec-compliant reading; recorded here so no reviewer sees it as drift.
- **R0/R1-with-records guard**: the design's `approvals.length === 0` passthrough guard would consult `authorize()` at R0/R1 when records exist, contradicting R2 ("at R0/R1 the gate MUST NOT consult authorize()"). Implemented an explicit tier guard (`tier === "R0" || tier === "R1"` on the closed 4-value vocabulary) instead of importing `orderOf` from `candidates/` — keeping the import surface to the 4 allowed modules required by the W2 import-boundary test.
- **Test-file size**: 27 tests / ~590 lines total (implementation 155 + tests 391 + 2 export lines) vs the ~260–360 forecast. Size exception recorded (single-pr, user decision; `review_budget_lines: 300` exceeded → exception recorded per tasks.md).

## Workload / PR boundary

- Delivery strategy: `single-pr` (user decision, size exception recorded). Chain strategy: n/a.
- Work units: W1 (vocabulary + gate implementation + unit tests) → W2 (barrel export + import-boundary + GateRunner composition + full regression) as sequential commits within the single PR — commit splitting is a **parent-owned** lifecycle action.
- Estimated authored change: ~547 lines added, 0 deleted, 2 modified lines (1 in `types.ts`, 1 in `index.ts`). >300 `review_budget_lines` → size exception recorded (forecast allowed this: "size exception recorded per openspec config").

## Remaining tasks (exact unchecked lines — parent-owned, deferred)

- `- [ ] Ship the two work units (W1 → W2) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge. <!-- sdd-owner: parent -->`
- `- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->`
- `- [ ] Validate the integrated change: full suite green, no protected-path diff (`authorization/`,`gates/approval.ts`,`contracts/**`), then merge to main. <!-- sdd-owner: parent -->`

## Notes

- The single full-suite failure is the known pre-existing `scripts/__tests__/release-integrity.test.ts` flake (`resolved SBOM fidelity > fails verification on every SBOM fidelity drift class`, 6500ms under load): passes **13/13 isolated**, is outside the change's diff boundary, and is NOT a failure of this change.
- Runtime attempt ledger settled `complete` with the full-suite evidence fingerprint.
