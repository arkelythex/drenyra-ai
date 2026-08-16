# Tasks — Authorization Enforcement in Approval Gates

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~260–360 authored lines (≈130–190 per work-unit) |
| 400-line budget risk | Medium (aggregate likely < 400; recorded size exception if exceeded) |
| Chained PRs recommended | No (user decision: single PR, size exception recorded) |
| Suggested split | Work units W1 (types vocabulary + gate implementation + unit tests) → W2 (barrel export + integration-ish coverage + full regression) as commits within one PR |
| Delivery strategy | single-pr (user decision; size exception recorded per openspec config `review_budget_lines: 300`) |
| Chain strategy | n/a (single PR) |

```text
Decision needed before apply: No
Chained PRs recommended: No (user decision: single-pr with size exception)
Chain strategy: n/a
400-line budget risk: Medium
```

**Forecast notes (read before apply):** The user chose a single PR with a recorded size exception (`openspec/config.yaml` sets `review_budget_lines: 300`; if the aggregate exceeds that, the exception is recorded). Work units W1–W2 ship as sequential commits within that one PR. Strict TDD is active: `bun run test` (vitest), `bun run typecheck`, `bun run build`. Money is BigInt cents; no floats; no `any`; fail-closed; English artifacts. The gate is a pure additive checkpoint — no ledger writes, no receipts, no reversibility.

**Scope-derivation note (confirm before Phase 3):** `authorize()` requires a full `ValidatedTenantScope { companyId, ruc, period }`, but `MissionSnapshot` carries only `companyId` + `fiscalPeriod` (no separate `ruc`). The existing fixtures use the 11-digit RUC as `companyId` (`"20123456789"`). Confirm the exact mission→scope field mapping at apply time (e.g. derive `{ companyId: mission.companyId, ruc: mission.companyId, period: mission.fiscalPeriod }` via `validateTenantScope`), so `authorize()` receives a scope that satisfies the RUC/period validation. If the mission carries no derivable scope, the gate fails closed to `needs_input`.

**Protected-path contract (mandatory):** This change MUST NOT modify `authorization/`, `gates/approval.ts`, `gates/__tests__/gates.test.ts`, `contracts/**`, `missions/`, `cmd/`, or any mission/flow/agents surface. Only `gates/authorization.ts` (NEW), `gates/types.ts` (GateName vocabulary), `gates/index.ts` (export), and `gates/__tests__/authorization-gate.test.ts` (NEW) change.

---

## How to read this task list

- **Ownership markers**: each checkbox ends with exactly one terminal `<!-- sdd-owner: ... -->`. `implementation` covers RED/GREEN/TRIANGULATE/REFACTOR, code, tests, exports, and apply-owned verification. `parent` covers only explicit post-apply bounded review and lifecycle-gate actions, grouped separately at the end.
- **Work-unit mapping**: the leading `[W1|W2]` tag marks the work unit a task belongs to; each unit has a clear start, finish, verification, and rollback boundary and maps to one sequential commit inside the single PR.
- **Conventions**: every behavior task starts with a failing test (RED) before implementation (GREEN), then boundaries via TRIANGULATE/REFACTOR. Full suite `bun run test` plus `bun run typecheck` and `bun run build` must pass after each slice.
- **Gate surface (exact)**: `AuthorizationGateOptions { assignments: readonly RoleAssignment[] }`; `AuthorizationGate implements Gate` with `name = "authorization"`; `evaluate(ctx: GateContext): GateResult` composes `ApprovalGate` then per-approval `authorize()`. No `GateContext` shape change.
- **Verification boundary**: after each phase end, run the slice verification and record exact results; the final phase runs the full regression.

---

## Phase 1 — Planning / completion (W1)

- [x] `[W1]` Confirm slice start state: `gates/authorization.ts` does not exist; `GateName` in `gates/types.ts` lacks `"authorization"`; `gates/index.ts` does not export `AuthorizationGate`; `gates/__tests__/authorization-gate.test.ts` does not exist. Record the current `GateName` union and the existing exports of `gates/index.ts` as the pre-change baseline. <!-- sdd-owner: implementation -->
- [x] `[W1]` Confirm the scope-derivation mapping for Phase 3 (see Forecast notes): read `MissionSnapshot` (`missions/types.ts`), `validateTenantScope` (`tenant-core/scope.ts`), and `authorize()` (`authorization/authorize.ts`) so the gate builds a `ValidatedTenantScope` the engine accepts; record the exact mission→scope field mapping in the apply-progress before implementation. <!-- sdd-owner: implementation -->

## Phase 2 — Types vocabulary (W1)

- [x] `[W1]` RED — in `gates/__tests__/authorization-gate.test.ts`, write failing tests asserting the vocabulary: a gate whose `name` equals `"authorization"` is assignable to the `Gate` interface, and `GateResult` with `gate: "authorization"` type-checks. This RED fails to compile until `GateName` gains the literal. <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — in `gates/types.ts`, extend `GateName` to add `"authorization"` (vocabulary only; do not alter `GateContext`, `ApprovalRecord`, or `GateResult`). No other file changes in this phase. <!-- sdd-owner: implementation -->
- [x] `[W1]` Slice verification — run `bun run typecheck` and `bun run test`; confirm the vocabulary test compiles and passes. <!-- sdd-owner: implementation -->

## Phase 3 — AuthorizationGate implementation (W1, strict TDD)

Behavior tests live in `gates/__tests__/authorization-gate.test.ts`; the implementation is `gates/authorization.ts`. Follow RED → GREEN per behavior group below, then TRIANGULATE boundaries, then a slice pass.

- [x] `[W1]` RED — write failing tests for **quantity-tier passthrough**: R0/R1 (and unset materiality) → `allowed` with no-approval-required reason and `authorize()` never consulted (assert by constructing the gate with empty `assignments` and still getting `allowed`); R2 with no records → `needs_input` with `envelope.requiredApprovers === 1`; R3 with a single distinct approver (or the same `approverId` twice) → `blocked` with the dual-approval reason. The tier decision MUST equal `ApprovalGate`'s for identical inputs. <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement `gates/authorization.ts` quantity passthrough: run `new ApprovalGate().evaluate(ctx)` first; return its result verbatim when not `allowed` (blocked/needs_input), and return it unchanged when `allowed` and `ctx.approval` is empty. Import `ApprovalGate` from `./approval.js`. <!-- sdd-owner: implementation -->
- [x] `[W1]` RED — write failing tests for **per-approver RBAC allow/deny**: R2 with one authorized approver → `allowed`; R3 with two distinct authorized approvers → `allowed`; R2 with an approver holding only preparer/reviewer permissions (`close:propose`/`close:review`) → `blocked` with typed `insufficient-permission`; R3 where only the SECOND of two records lacks `close:approve` → `blocked` (proving every record is checked, none skipped). <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement per-approver RBAC: after the quantity passthrough allows with approvals present, derive the scope, and for EACH `ApprovalRecord` run `authorize({ assignments, identity: record.approverId, permission: "close:approve", scope, materiality: ctx.materiality })`; if any decision is not allowed, return `blocked` surfacing `decision.denial` (code/cause/continuation) and never allow. Import `authorize`, `type RoleAssignment` from `../authorization/index.js`. <!-- sdd-owner: implementation -->
- [x] `[W1]` RED — write failing tests for **scope isolation**: an approver assigned at a different `companyId`/`ruc` → `blocked` with typed `scope-mismatch`; an approver assigned at the same company/ruc but a different YYYYMM period → `blocked` with `scope-mismatch`; assert the denial's `reason`, `envelope`, `cause`, and `continuation` contain NO foreign companyId, ruc, or period value (no foreign detail leak). <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement scope isolation by passing the mission-derived scope to `authorize()` (which already compares via `sameTenantScope` and freezes denial tables that never name another org). No new error codes; rely on the engine's typed denials. <!-- sdd-owner: implementation -->
- [x] `[W1]` RED — write failing tests for **fail-closed evidence**: R2 with one record and an `AuthorizationGate` constructed with empty `assignments` → `needs_input` (never `allowed`); approval required + present but no mission from which scope is derivable → `needs_input`; assert the surfaced `authorize()` denial is frozen and carries typed code/cause/continuation. <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — implement fail-closed: if `this.#assignments.length === 0` → `needs_input` with decision envelope; if the scope is underivable (mission absent / `validateTenantScope` fails) → `needs_input` with decision envelope; mirror `authorize()`'s never-throw contract (no try/catch around it — denials are values). <!-- sdd-owner: implementation -->
- [x] `[W1]` RED — write failing tests for **determinism**: identical `GateContext` + `assignments` evaluated twice produce identical `verdict`/`reason`/`envelope`; two contexts differing only in `ApprovalRecord.at` produce identical results (timestamp inert); no float appears in any comparison (ordinal `orderOf` for materiality, exact scope equality). <!-- sdd-owner: implementation -->
- [x] `[W1]` GREEN — confirm determinism by construction (no wall-clock/time dependency, ordinal materiality comparison via `ApprovalGate`, exact scope equality via engine); add a determinism regression assertion. <!-- sdd-owner: implementation -->
- [x] `[W1]` TRIANGULATE — add boundary cases: caller-shaped input with missing/malformed optional fields never throws (always a structured verdict); an `approverId` with no assignment at all → `blocked` with typed `unknown-identity`; assert `name === "authorization"` on every returned `GateResult.gate`. <!-- sdd-owner: implementation -->
- [x] `[W1]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm the W1 slice passes and changed lines < 300. <!-- sdd-owner: implementation -->

## Phase 4 — Barrel export + full regression + spec mapping + no-drift (W2)

- [x] `[W2]` GREEN — add `export { AuthorizationGate } from "./authorization.js";` to `gates/index.ts` alongside `ApprovalGate`; do not reorder or remove existing exports. <!-- sdd-owner: implementation -->
- [x] `[W2]` RED — write failing import-boundary tests asserting the barrel export surface: `AuthorizationGate` is exported from `gates/index.js` alongside `ApprovalGate`; and an import-boundary test proving `gates/authorization.ts` imports ONLY `./approval.js`, `./types.js`, `../authorization/index.js` (public `authorize`/`assignRoles`/`RoleAssignment` only), and `../tenant-core/index.js` — no `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, or authorization internal/private module. <!-- sdd-owner: implementation -->
- [x] `[W2]` Integration-ish coverage — add a test composing `AuthorizationGate` in a `GateRunner` alongside the existing gate set, asserting the composed pipeline returns the authorization verdict and short-circuits like `GateRunner` does; keep it in `gates/__tests__/authorization-gate.test.ts`. <!-- sdd-owner: implementation -->
- [x] `[W2]` Full regression — run `bun run test` (baseline 1363 tests / 89 files; confirm no regression and no new failure beyond the pre-existing release-integrity flake), `bun run typecheck`, and `bun run build`; all green. <!-- sdd-owner: implementation -->
- [x] `[W2]` Map each spec requirement to completion evidence: R1 AuthorizationGate surface (name/vocabulary/export/never-throws), R2 quantity-tier passthrough, R3 per-approver RBAC enforcement, R4 scope isolation, R5 fail-closed evidence, R6 determinism, R7 no engine/gate/contract drift. <!-- sdd-owner: implementation -->
- [x] `[W2]` No-drift check — run `git diff --name-only` and confirm no path under `authorization/`, no `gates/approval.ts`, and no path under `contracts/`, `missions/`, `cmd/`, `flow/`, or `agents/` appears; confirm the closed permission/role vocabulary in `authorization/roles.ts` is byte-identical before/after (no added/removed/renamed permission or role; `close:approve` still granted to `approver`). <!-- sdd-owner: implementation -->
- [x] `[W2]` Slice verification — run `bun run test`, `bun run typecheck`, `bun run build`; confirm the W2 slice passes and aggregate changed lines stay within the single-PR size exception. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [ ] Ship the two work units (W1 → W2) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge. <!-- sdd-owner: parent -->
- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [ ] Validate the integrated change: full suite green, no protected-path diff (`authorization/`, `gates/approval.ts`, `contracts/**`), then merge to main. <!-- sdd-owner: parent -->
