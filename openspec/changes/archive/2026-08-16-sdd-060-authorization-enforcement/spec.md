# Authorization Enforcement in Approval Gates Specification

## Purpose

Defines the wiring slice that binds the standalone, verified authorization engine (`authorization/` — `assignRoles`, `authorize`) into the approval gate pipeline as a new `AuthorizationGate` in `gates/`. Today `ApprovalGate` validates HOW MANY human approvals a candidate needs (R2 one, R3 two distinct approvers) but never WHO may approve; `AuthorizationGate` preserves that quantity behavior unchanged and additionally requires every approver on a required approval to hold the closed permission `close:approve` at the candidate's exact tenant scope (companyId, 11-digit RUC, YYYYMM period), so a preparer or reviewer cannot approve and a foreign-org identity is denied fail-closed. The gate is fail-closed: missing assignments or an underivable scope yield `needs_input` with the decision envelope (never a silent allow), and any `authorize()` denial is surfaced as `blocked` with the engine's typed, frozen cause and continuation, never leaking another organization's detail. The wiring is additive — hosts compose the gate with the existing gate set via GateRunner — and no change is made to `authorization/`, `gates/approval.ts`, `contracts/**`, missions, or `cmd/`.

## Requirements

### Requirement: AuthorizationGate surface

The system MUST provide an `AuthorizationGate` in `gates/` that implements the existing `Gate` interface: its name MUST be `"authorization"`, and `"authorization"` MUST be a valid gate name in the gate vocabulary. Its `evaluate(ctx)` MUST accept the existing `GateContext` shape unchanged and MUST return a `GateResult` with a verdict of `allowed`, `blocked`, or `needs_input`. Its constructor MUST accept `AuthorizationGateOptions` carrying `assignments: readonly RoleAssignment[]` (already-constructed assignments from the authorization engine's `assignRoles` construction boundary). The gate MUST derive the tenant scope from `ctx.mission` (companyId, 11-digit RUC, YYYYMM period), MUST be exported from `gates/index.ts` alongside `ApprovalGate`, and MUST NOT throw for caller-shaped input — every evaluation MUST return a structured verdict.

#### Scenario: Gate evaluates to an authorization verdict

- GIVEN an `AuthorizationGate` constructed with assignments for the mission's tenant scope and a `GateContext` requiring approval
- WHEN `evaluate(ctx)` runs
- THEN a `GateResult` with `gate: "authorization"` and one of `allowed`, `blocked`, or `needs_input` is returned

#### Scenario: Gate is exported from the gates barrel

- GIVEN the public exports of `gates/index.ts`
- WHEN the export surface is inspected
- THEN `AuthorizationGate` is exported alongside `ApprovalGate`

#### Scenario: Caller-shaped input never throws

- GIVEN a `GateContext` with missing or malformed optional fields
- WHEN `evaluate(ctx)` runs
- THEN a structured `GateResult` is returned and no exception escapes the gate

### Requirement: Quantity-tier passthrough

The `AuthorizationGate` MUST first evaluate the existing `ApprovalGate` on the same context and MUST preserve its quantity semantics and verdicts unchanged: unset materiality or R0/R1 is `allowed` (no approval required), R2 requires at least one `ApprovalRecord` else `needs_input` with the decision envelope, and R3 requires two DISTINCT `approverId`s else `blocked`. For identical inputs the gate's tier decision MUST be identical to `ApprovalGate`'s. `authorize()` MUST be consulted only when approval is required (R2/R3) AND `ApprovalRecord` evidence is present; at R0/R1 the gate MUST NOT consult `authorize()` and MUST allow exactly as `ApprovalGate` does.

#### Scenario: R0/R1 allowed without authorization consultation

- GIVEN a context with materiality R1 (or unset materiality treated as R0) and no approval records
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `allowed` with the no-approval-required reason and `authorize()` is never consulted

#### Scenario: R2 without records needs_input

- GIVEN a context with materiality R2 and no `ApprovalRecord`s
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `needs_input` with the decision envelope (`requiredApprovers: 1`), identical to `ApprovalGate`

#### Scenario: R3 with insufficient distinct approvers is blocked

- GIVEN a context with materiality R3 and a single `ApprovalRecord` (or the same `approverId` recorded twice)
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `blocked` for insufficient distinct approvers, identical to `ApprovalGate`

### Requirement: Per-approver RBAC enforcement

When approval is required (R2/R3) and `ApprovalRecord` evidence is present, the `AuthorizationGate` MUST run `authorize()` for EACH `ApprovalRecord` with permission `close:approve`, scope = the exact tenant scope derived from `ctx.mission`, and identity = the record's `approverId`. EVERY approver MUST be authorized; if ANY single approver is denied, the gate MUST return `blocked` with the typed denial (code, cause, continuation) from the authorization engine's closed denial vocabulary and MUST NOT allow the checkpoint. The gate MUST NOT allow when any approver lacks `close:approve` at the mission scope, regardless of the other approvers' grants.

#### Scenario: All approvers authorized allows the checkpoint

- GIVEN an R2 (or R3 with two distinct) approval whose `approverId`s all hold `close:approve` at the mission's tenant scope
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `allowed` for the authorization checkpoint

#### Scenario: One unauthorized approver denies the gate

- GIVEN an R3 approval with two distinct approvers where exactly one holds `close:approve` and the other holds only preparer permissions
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `blocked` with the typed `insufficient-permission` denial and the checkpoint is never allowed

#### Scenario: Every record is checked

- GIVEN two `ApprovalRecord`s where only the second `approverId` lacks `close:approve`
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `blocked` and the surfaced denial names the unauthorized approver's failure, proving the second record was not skipped

#### Scenario: Preparer or reviewer cannot approve

- GIVEN an approval whose `approverId` has an assignment granting only `close:propose` or `close:review`
- WHEN `evaluate(ctx)` runs at R2
- THEN the gate returns `blocked` with the typed `insufficient-permission` denial

### Requirement: Scope isolation

The `AuthorizationGate` MUST authorize each approver at the exact tenant scope derived from the mission (companyId, 11-digit RUC, YYYYMM period). An identity assigned at any other organization or scope MUST be denied with the typed `scope-mismatch` denial. The denial's reason, envelope, cause, and continuation MUST NOT expose any foreign scope detail — no other organization's companyId, RUC, period, roles, identities, or assignment information — and MUST NOT leak which foreign scope was involved.

#### Scenario: Foreign-organization identity is blocked

- GIVEN an `ApprovalRecord` whose `approverId` is assigned roles at a different companyId/RUC
- WHEN `evaluate(ctx)` runs at the mission's tenant scope
- THEN the gate returns `blocked` with the typed `scope-mismatch` denial

#### Scenario: Same organization, different period is blocked

- GIVEN an `ApprovalRecord` whose `approverId` is assigned at the same companyId/RUC but a different YYYYMM period
- WHEN `evaluate(ctx)` runs at the mission's period
- THEN the gate returns `blocked` with `scope-mismatch`, proving the scope comparison is exact on period as well as organization

#### Scenario: No foreign scope detail is leaked

- GIVEN a `scope-mismatch` denial produced by the gate
- WHEN the denial's reason, envelope, cause, and continuation are inspected
- THEN none of them contains the foreign scope's companyId, RUC, or period values

### Requirement: Fail-closed evidence

The `AuthorizationGate` MUST fail closed and MUST NEVER silently allow: when approval is required and `ApprovalRecord` evidence is present but no assignments were supplied, or the tenant scope cannot be derived from the context, the gate MUST return `needs_input` with the decision envelope describing the required approval evidence — the gate cannot prove identity/permission, so it requests the evidence rather than guessing. Every `authorize()` denial surfaced by the gate MUST be a frozen, typed decision carrying the denial code, cause, and continuation from the closed denial vocabulary.

#### Scenario: No assignments supplied yields needs_input

- GIVEN an R2 context with one `ApprovalRecord` and an `AuthorizationGate` constructed with an empty `assignments` list
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `needs_input` with the decision envelope and is never `allowed`

#### Scenario: Underivable scope yields needs_input

- GIVEN approval required and present but a context carrying no mission from which the tenant scope can be derived
- WHEN `evaluate(ctx)` runs
- THEN the gate returns `needs_input` with the decision envelope and is never `allowed`

#### Scenario: Denial is frozen and typed

- GIVEN an `authorize()` denial surfaced by the gate
- WHEN the denial object is inspected
- THEN it is immutable (frozen) and carries the typed denial code, cause, and continuation

### Requirement: Determinism

The `AuthorizationGate` MUST be deterministic: identical inputs MUST produce identical verdicts, reasons, and envelopes. The verdict MUST NOT depend on wall-clock time or on the `at` timestamp of an `ApprovalRecord`; materiality comparison MUST be ordinal and exact; scope comparison MUST use canonical tenant-scope equality (companyId, RUC, and period all exact); and no float MAY appear in any computation or comparison.

#### Scenario: Identical inputs produce identical results

- GIVEN the same `GateContext` and the same `assignments`
- WHEN `evaluate(ctx)` runs twice
- THEN both runs produce identical verdicts, reasons, and envelopes

#### Scenario: The approval timestamp is inert

- GIVEN two otherwise identical contexts whose only difference is the `ApprovalRecord.at` value
- WHEN `evaluate(ctx)` runs for each
- THEN both runs produce identical verdicts, proving no time-dependent behavior

### Requirement: No engine, gate, or contract drift

This change MUST NOT modify the authorization engine (`authorization/`), `gates/approval.ts`, `contracts/**`, missions, or `cmd/`; MUST NOT add, remove, or rename any permission or role — the closed vocabulary stays, with `close:approve` already defined and granted to the `approver` role; and MUST add only the new gate surface, its export from `gates/index.ts`, and its tests under `gates/__tests__/`. Compliance MUST be evidenced by the change's diff boundary and by the gate's import surface (public authorization-engine exports only).

#### Scenario: Diff boundary excludes the protected paths

- GIVEN the change's commit set
- WHEN `git diff --name-only` is checked
- THEN no path under `authorization/`, no `gates/approval.ts`, and no path under `contracts/`, `missions/`, or `cmd/` appears

#### Scenario: Closed permission and role vocabulary is unchanged

- GIVEN the authorization engine's permission and role sets before and after the change
- WHEN they are compared
- THEN the sets are identical and `close:approve` remains defined and granted to `approver`

#### Scenario: The gate imports only public authorization exports

- GIVEN `gates/authorization.ts`
- WHEN its imports of the authorization engine are inspected
- THEN they reference only public exports (for example `authorize`, `assignRoles`, `RoleAssignment`), and no authorization internal module or private helper is imported
