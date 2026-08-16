# Design — Authorization Enforcement in Approval Gates

## Decision summary

A new `AuthorizationGate` (`gates/authorization.ts`) that composes the existing
`ApprovalGate` quantity logic with the standalone `authorize()` RBAC engine:
the gate first evaluates the materiality-proportional approval quantity
(R0/R1 no approval, R2 one record, R3 two distinct approvers) exactly as
`ApprovalGate` does, then — when an approval is required and present — runs
`authorize()` for EVERY approval record with permission `close:approve` at the
exact tenant scope derived from the mission. One unauthorized approver denies the
gate. Missing evidence (no assignments, or no derivable scope) yields
`needs_input`, never a silent allow. `gates/types.ts` `GateName` gains
`"authorization"`; `gates/index.ts` exports the gate. Nothing in
`authorization/`, `approval.ts`, `contracts/**`, missions, or cmd changes.

## Module layout

```text
gates/
  authorization.ts              NEW — AuthorizationGate (this slice)
  approval.ts                   unchanged
  types.ts                      GateName += "authorization" (vocabulary only)
  index.ts                      export AuthorizationGate
  __tests__/
    authorization-gate.test.ts  NEW — strict TDD unit tests
```

Layer: `gates/` is the lifecycle-checkpoint subsystem (contract
`contracts/gate.md`). `authorization.ts` imports only `./approval.js`,
`./types.js`, `../authorization/index.js` (`authorize`, `assignRoles` types),
and `../tenant-core/index.js` (scope derivation). No `agents/`, `cmd/`,
`ledger/`, `mcp/`, `adapters/`.

## Gate surface

```ts
// gates/authorization.ts
export interface AuthorizationGateOptions {
  /** Role assignments resolvable for the tenant scope (from assignRoles). */
  assignments: readonly RoleAssignment[];
}

export class AuthorizationGate implements Gate {
  constructor(options: AuthorizationGateOptions);
  public readonly name: "authorization";
  evaluate(ctx: GateContext): GateResult;
}
```

**Scope derivation.** The tenant scope comes from `ctx.mission`:
`{ companyId: mission.companyId, ruc: mission.companyId === scope? — see below }`.
The mission snapshot carries `companyId` and `fiscalPeriod`; the candidate scope
is `{ ruc, period }`. The gate builds `ValidatedTenantScope` from the mission's
company/RUC + fiscal period via `validateTenantScope`, and if the mission is
absent or the scope cannot be derived, fails closed to `needs_input` (the gate
cannot prove identity/permission without a scope).

## Evaluation flow (deterministic, fail-closed)

```ts
evaluate(ctx) {
  // 1. Quantity tier exactly as ApprovalGate (R0/R1 allowed, R2 one, R3 two distinct).
  const approvalResult = new ApprovalGate().evaluate(ctx);
  if (approvalResult.verdict !== "allowed") return approvalResult; // passthrough incl. needs_input

  // 2. Approval required and present: per-approver RBAC.
  const approvals = ctx.approval ?? [];
  if (approvals.length === 0) return approvalResult; // R0/R1 path — no authorization needed

  const scope = deriveScope(ctx);                       // needs_input if underivable
  if (this.#assignments.length === 0) {
    return needsInput("no role assignments supplied for authorization"); // fail-closed
  }

  for (const record of approvals) {
    const decision = authorize({
      assignments: this.#assignments,
      identity: record.approverId,
      permission: "close:approve",
      scope,
      materiality: ctx.materiality, // inert but vocabulary-validated
    });
    if (!decision.allowed) {
      return blocked(decision.denial); // typed cause + continuation, frozen
    }
  }
  return allowed("every approver holds close:approve at the tenant scope");
}
```

**Fail-closed rules (explicit):**

- R0/R1: `ApprovalGate` allows without approval → no `authorize()` consultation
  (the tier is permissive by contract).
- R2/R3 with approvals: every `ApprovalRecord.approverId` MUST be authorized.
  A single denial → `blocked` with the typed denial (cause + continuation from
  `authorize()`'s frozen tables — never another org's detail).
- No assignments supplied → `needs_input` with the decision envelope (the gate
  cannot prove authorization; it requests the evidence).
- Mission absent or scope underivable → `needs_input` (same rationale).
- `authorize()` never throws for caller-shaped input; the gate mirrors that
  contract (no try/catch around it — denials are values).

## GateName vocabulary

`gates/types.ts` `GateName` becomes:

```ts
export type GateName =
  | "mission"
  | "receipt"
  | "approval"
  | "authorization"   // NEW
  | "pre-commit"
  | "release";
```

This is a vocabulary extension inside `gates/` (NOT a protected path) — required
for `name: "authorization"` to satisfy `implements Gate`.

## Reversibility / scope notes

- The gate is a checkpoint, not an action — no reversibility, no receipt, no
  ledger interaction.
- Scope-exact: `authorize()` compares the assignment scope and the target scope
  via `sameTenantScope`; a foreign-org identity yields `scope-mismatch` and the
  denial reveals no foreign detail (guaranteed by `authorize()`'s frozen
  tables).

## Error model

No new error codes. Verdicts are the gate vocabulary:
`allowed` (quantity + all approvers authorized), `blocked` (typed denial from
`authorize()` or quantity), `needs_input` (missing evidence: no assignments /
no derivable scope / ApprovalGate quantity needs input). Deterministic: identical
inputs ⇒ identical verdicts; the `at` timestamp in ApprovalRecord is inert.

## Non-goals (restated)

No change to `authorization/`, `approval.ts`, `contracts/**`, missions, cmd.
No new permissions/roles (closed vocabulary stays; `close:approve` already
granted to `approver`). No ledger writes, no MCP/CLI, no operator directory/SSO.

## Test plan (strict TDD)

- R0/R1 passthrough: materiality R0/R1 → allowed, `authorize()` never consulted
  (assert via spy or by omitting assignments and still getting allowed).
- R2 quantity: R2 without approval → needs_input (same as ApprovalGate).
- R3 quantity: R3 with one distinct approver → blocked (quantity, before RBAC).
- R2/R3 with approvals + authorized approvers → allowed.
- Single unauthorized approver → blocked with typed denial (e.g.
  `insufficient-permission` when approver lacks `close:approve`).
- Foreign-org identity → blocked (`scope-mismatch`), denial has no foreign
  detail.
- No assignments → needs_input.
- Mission absent → needs_input.
- Determinism: same inputs twice ⇒ same verdict.
- GateName accepts "authorization"; gates/index.ts exports it.
