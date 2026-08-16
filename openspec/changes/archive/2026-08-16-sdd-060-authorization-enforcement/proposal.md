# Proposal — Authorization Enforcement in Approval Gates

## Decision

Wire the standalone, verified authorization engine (`authorization/` —
`assignRoles`, `authorize`, `assertSegregation`) into the approval gate pipeline
as a new `AuthorizationGate` in `gates/`. Today `ApprovalGate` validates HOW MANY
human approvals a candidate needs (R2 one, R3 two distinct approvers) but never
WHO may approve — and `authorize()` implements exactly that check (permission
`close:approve`, exact tenant scope, fail-closed typed denials) yet no runtime
surface imports it. This change closes the SDD-060 gap "RBAC/ABAC exists but is
not enforced": the approval gate now also requires every approver to hold
`close:approve` at the candidate's exact RUC + period scope, so a preparer or
reviewer cannot approve R3 work and a foreign-org identity is denied fail-closed.

## Intent

SDD-060 (`openspec/programs/drenyra-dominion/sdds/sdd-060-multi-operator/README.md`)
declares the multi-operator control plane: RBAC/ABAC across organizations and
roles, tenant scope, and segregation of duties over the monthly-close capability.
Its record is `lifecycle:active` with "RBAC/ABAC + SoD core implemented" — the
authorization module shipped in PR #61 — but the "Pending core" section still
lists "live enforcement wiring" as absent, and the record's own contradiction
(the implemented core vs the pending-absent wording) is drift. The module is
exported from the root barrel (`index.ts` exports `./authorization/index.js`) yet
NOT imported by `cmd/`, `missions/`, `flow/`, `gates/`, or `agents/`. This change
is the enforcement wiring slice: it binds `authorize()` into the gate pipeline so
approval decisions are RBAC-enforced at the exact tenant scope.

## Proposed outcome

After this change:

1. `gates/authorization.ts` exports an `AuthorizationGate` implementing the
   existing `Gate` interface:
   - Accepts the existing `GateContext` plus an optional
     `assignments: RoleAssignment[]` and an `identity` (the acting professional)
     — carried via the context (see Scope below for the exact surface).
   - Runs `ApprovalGate.evaluate(ctx)` first (quantity tier unchanged: R0/R1 no
     approval, R2 one, R3 two distinct) and then, when an approval is required
     and present, runs `authorize()` for EACH approval record: permission
     `close:approve`, scope = the candidate/mission tenant scope, identity =
     `approverId`. Every approver MUST be authorized; a single unauthorized
     approver denies the gate.
   - Fail-closed: no assignments supplied → `needs_input` with the decision
     envelope (the gate cannot prove identity/permission, so it requests the
     evidence); `authorize()` denial → `blocked` with the typed denial cause and
     continuation (never exposing another org's detail — `authorize()` already
     guarantees that).
   - Deterministic, BigInt/scope-exact, no floats, no `any`; never throws for
     caller-shaped input.
2. The gate is exported from `gates/index.ts` alongside `ApprovalGate`.
3. No change to `authorization/`, `ApprovalGate`, `contracts/**`, or the mission
   runtime. The wiring is additive: a new gate surface that hosts can compose
   with the existing gate set (GateRunner).

### Surface (exact)

```ts
// gates/authorization.ts
export interface AuthorizationGateOptions {
  /** Role assignments resolvable for the tenant scope (from assignRoles). */
  assignments: readonly RoleAssignment[];
}
export class AuthorizationGate implements Gate {
  constructor(options: AuthorizationGateOptions);
  name: "authorization";
  evaluate(ctx: GateContext): GateResult; // runs ApprovalGate then authorize per approver
}
```

`GateContext` already carries `mission` (which carries companyId/RUC/period),
`materiality`, and `approval` — the gate derives the tenant scope from the
mission and requires `assignments` from its options. No `GateContext` shape
change is needed.

## Scope

### Slice 1 — AuthorizationGate (this change)

- `gates/authorization.ts` — the gate (compose ApprovalGate + authorize).
- `gates/index.ts` — export `AuthorizationGate`.
- `gates/__tests__/authorization-gate.test.ts` — strict TDD unit tests: R0/R1
  passthrough; R2/R3 quantity from ApprovalGate; per-approver authorize allow;
  single unauthorized approver → blocked; foreign-org identity → blocked
  (scope-mismatch); no assignments → needs_input; denial typed and frozen;
  determinism; scope-exact.
- No changes to `authorization/`, `approval.ts`, `contracts/**`, missions, cmd.

### Follow-up slices (out of scope)

- Live wiring into the mission runtime / CLI command paths (which host
  composes AuthorizationGate with GateRunner) — next slice, mirroring how
  engines were wired after verification.
- Per-org policy engine, approval hierarchies, views, connectors (SDD-060
  remaining gaps; Command Center territory).
- Canonical operator identity store (SDD-060 pending).

## Non-goals

- No modification of the authorization engine, ApprovalGate, frozen contracts,
  or the mission protocol.
- No new permissions/roles (the closed vocabulary stays; `close:approve` is
  already defined and granted to `approver`).
- No ledger writes, no MCP/CLI, no mission-intent changes.
- No real operator directory / SSO (identity is an explicit input).

## Tradeoffs

- **Gate composition, not engine change** — the authorization engine stays pure
  and independently verified; the gate is the thin, reviewable binding (same
  pattern as close-wiring: deterministic core first, binding later).
- **Per-approver enforcement at exact scope** — each ApprovalRecord's author must
  hold `close:approve` at the candidate's RUC + period; a preparer/reviewer
  cannot approve, and cross-org identity is denied without leaking scope detail.
- **Fail-closed on missing evidence** — absent assignments yield `needs_input`
  (the gate cannot prove authorization), never a silent allow; this protects the
  ledger from unauthorized approvals.
- **Additive surface** — hosts keep composing gates via GateRunner; nothing
  existing breaks, and the SDD-060 "enforcement wiring" gap becomes a real,
  tested surface.
