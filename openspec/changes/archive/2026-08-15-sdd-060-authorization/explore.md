# Exploration — SDD-060 Authorization: RBAC/ABAC engine + org-wide segregation of duties (first slice)

> Purpose: size the FIRST SLICE of SDD-060's pending core — the RBAC/ABAC
> authorization engine and organization-wide segregation-of-duties (SoD). This is
> the slice the 2026-08-15 reconciliation (`sdd-060-multi-operator/README.md`)
> records as genuinely ABSENT: no RBAC/ABAC module, no per-org policies/approval
> hierarchies, no org-wide SoD. Only the candidate-scoped R3 `distinctApprovers`
> gate exists today. Read-only; this change writes no code.
>
> Baseline: `main @ 757cf97`, clean, suite 1044/1044 (`bun run test`).

## Purpose

Add a fail-closed authorization decision surface (`authorize(identity, action,
context) -> allow | deny` with typed denial) plus a pure organization-wide
segregation-of-duties check (`no single identity may propose AND approve the same
monthly-close step/artifact`) — delivered as a **pure library module** first,
without touching the live monthly-close consumer. This mirrors the `projection`
slice pattern (a self-contained, tested, exported module) and defers flow wiring
to a follow-up slice.

Scope of this first slice: `authorization/` module (permission vocabulary, role
model, role→permission matrix, per-org role assignment, `authorize()` fail-closed
decision, typed denial) + SoD pure rule + unit tests + `./authorization` package
export. **No** changes to `gates/approval.ts`, `flow/close.ts`, `cmd/`, or `mcp/`.

---

## Current-state inventory

### 1. Approval flow (the SoD integration point)

`gates/approval.ts` is the only SoD-adjacent gate today:

- `ApprovalGate.evaluate(ctx)` is materiality-proportional: R0/R1 → `allowed`
  (no approval), R2 → needs ≥1 `ApprovalRecord` (`needs_input` with envelope when
  absent), R3 → needs ≥2 **distinct** `approverId`s else `blocked`.
- `DUAL_APPROVAL_TIER = "R3"`, `DUAL_APPROVAL_COUNT = 2`.
- `distinctApprovers(approval): number` — counts distinct `approverId`s via
  `Set`. This is the ONLY existing "distinct identities" primitive, and it is
  **candidate-scoped** (the approval records passed in the context), not
  org-wide.
- Gate vocabulary (`gates/types.ts`): `ApprovalRecord { approverId, at, reason? }`,
  `GateContext { materiality?, approval? }`, verdicts `allowed|blocked|needs_input`.

Where approvals are proposed/approved today:

- `flow/close.ts` → `runMonthlyClose`: preflight → evidence → candidates
  (`CandidateLifecycle.propose`) → `runGuardianReview` per candidate →
  `buildSignedReceipt(action:"approve-candidate", actor:"professional")` →
  `validateLedger` → `ClosePackage`. **Note:** the close flow itself never
  invokes `ApprovalGate` — it emits an "approve-candidate" receipt with a
  hardcoded `actor: "professional"`. Approval gating surfaces through
  `cmd/commands/gate-check.ts` (runs mission/receipt/approval gates) and the
  mission runtime, not inside `runMonthlyClose`.
- `guardian/guardian.ts` → `runGuardianReview(candidate, { r3DualRequired })`:
  read-only findings; for R3 candidates it checks candidate `reviews` with
  `verdict === "accept"` have ≥2 distinct `reviewer` ids — a **duplicate** of the
  `distinctApprovers` idea, again candidate-scoped, surfaced as a `blocker`
  finding (never mutated; `verdict` always `"none"`).
- `missions/` → `AWAITING_APPROVAL` state; `resolveTarget` maps command
  `"approve"` → `APPROVED` (`MissionEventType.APPROVAL_DECIDED`) and `"reject"` →
  `REJECTED`. `ApproveMissionCommand` carries `proposalId`, `evidenceHash`,
  `expectedMissionVersion` — **no actor/identity field** on the command.
- `candidates/lifecycle.ts` → `propose` → `inspect` → `submitForReview` →
  `accept/reject` (appends `CandidateReview { reviewer, verdict, ... }`). The
  `reviewer` string is the only per-candidate identity marker.

**SoD integration point:** the propose/approve pair to police is the candidate
review path — `CandidateLifecycle.propose` (proposer) vs `CandidateReview.accept`
with `reviewer` (approver), and the mission `AWAITING_APPROVAL` approve command.
Today neither carries a structured operator identity.

### 2. Identity / actor model

There is **no** first-class operator/identity entity. Identity is a loose
string scattered across surfaces:

- `ApprovalRecord.approverId: string` (gates).
- `CandidateReview.reviewer: string` (candidates).
- `ReceiptContent.actorId: string` + `SignedReceipt.signerKeyId: string`
  - `ReceiptKeyPair.keyId` (receipts) — a key identity, not an operator identity.
- `flow/close.ts` hardcodes `actor: "professional"` (a role label, not an identity).
- Mission commands carry no actor; `MissionSnapshot` has `companyId`/`fiscalPeriod`
  but no operator.

**Confirmed: no role/permission/RBAC/ABAC concept exists anywhere in the
library.** A repo-wide grep for `role|permission|rbac|abac|authoriz` returns only:
`skills` `requiredPermissions` (a permission **string** on skill definitions, not
an engine), `routing` `authorizedTools/authorizedDestinations` (route scope, not
identity RBAC), `security` sanitize prompt-injection rules, and
`missions` `UNAUTHORIZED` error code. None is an authorization engine. The
declared SDD-060 core (RBAC/ABAC engine, per-org policies/approval hierarchies,
org-wide SoD) is genuinely absent.

### 3. Tenant / org surface (existing, to build on)

- `tenant-core/` — `validateTenantScope(input): ValidatedTenantScope` (branded,
  fail-closed), `tenantScopeKey`, `sameTenantScope`, `TenantScope`
  (`companyId/ruc/period`), `TenantScopeError`. Exported as `./tenant`.
- `tenant-isolation/` — `assertTenantReadScope`, `readArtifact`,
  `TenantScopedStore<T>`. **Not yet a package export** (README states so);
  tested unit only.
- `projection/` — the **pattern-A mirror**: a pure read-only module, root-exported
  (`projection/index.ts`), fail-closed denial (code/cause/continuation). The
  authorization slice should copy this shape.

---

## Gap analysis

| Need (SDD-060 declared core) | Today | Gap |
|---|---|---|
| RBAC/ABAC authorization engine | none (no module/symbols) | **absent** — build it |
| Permission vocabulary (closed set) | only `skills.requiredPermissions` strings | **absent** as an authorization vocabulary |
| Role model per org | `"professional"` hardcoded in close flow | **absent** |
| role→permission matrix | none | **absent** |
| per-org role assignment (identity→roles, tenant-scoped, never global) | none | **absent** (governance amendment: least authority per tenant, never global) |
| fail-closed `authorize()` with typed denial | none | **absent** |
| org-wide SoD (no single identity proposes AND approves a close step) | candidate-scoped `distinctApprovers` + Guardian R3 reviewer check only | **absent** — both existing checks are candidate-scoped, not org-wide |
| per-org approval hierarchies / connectors / views | none | follow-up slices (out of this first slice) |

The governance amendment is binding: authority is granted per tenant/org, **never
globally**, and the SoD distinct-identities rule is a hard acceptance criterion.

---

## RBAC/ABAC + SoD design sketch

### `authorization/` module (new library module, node:crypto only)

- **Permission vocabulary** (closed set, `Permission` union), mirroring the
  existing skill-permission naming convention (`resource:action`), e.g.
  `close:propose`, `close:approve`, `close:review`, `close:audit-read`,
  `mission:operate`, `tenant:admin`. Only these exist; unknown strings fail
  closed.
- **Role model** (`Role` union, per-org): e.g. `preparer`, `reviewer`,
  `approver`, `admin`. Roles are *named per org*, never global — a role has no
  meaning outside its tenant/org scope.
- **role→permission matrix** (`ROLE_PERMISSIONS: Record<Role, readonly Permission[]>`)
  as a frozen, versioned constant — the single source of truth an `authorize()`
  consults.
- **Per-org role assignment**: `assignRoles({ identity, org, roles }) ->
  AuthorizedOperator` with a branded, fail-closed org scope reusing
  `tenant-core`'s `ValidatedTenantScope` (or a lighter `OrganizationScope`).
  Rejecting an empty role set or an invalid org scope throws. Never global.
- **`authorize(operator, action, context) -> AuthorizationDecision`**:
  fail-closed decision `allow` or `deny` with a **typed denial**
  (code/cause/continuation), mirroring `projection`'s denial shape. Unknown
  role, unknown action, or unknown operator all deny. ABAC attributes drawn from
  `context` (org, materiality tier, candidate state) can refine a role-based
  grant — but the first slice keeps ABAC minimal (org + action + optional
  materiality attribute), matching the reconciliation's "least authority, never
  global" ceiling.

### SoD rule (pure, org-wide)

- New pure check, recommend a `segregation.ts` (or fold into `authorization/`):
  `assertSegregation({ closeStepId, proposerId, approverIds })` →
  `allowed | denied`. Semantics: **no single identity may appear in both the
  proposer set and the approver set for the same monthly-close step/artifact.**
- Scope decision: the existing R3 `distinctApprovers` is *candidate-scoped*
  (distinct approverIds on one candidate). The org-wide SoD must be
  *same-close-step scoped*: union the proposer of a close step with all its
  approvers; any identity in both → deny. Recommend the pure rule live in the
  `authorization` library (not mutate `gates/approval.ts`), and be wired into the
  **approval gate consumption** in a follow-up slice — not this one.
- Interaction with existing R3: SoD is a *superset* invariant. R3
  `distinctApprovers` guarantees ≥2 distinct approvers; SoD additionally forbids
  the proposer being one of them and forbids an identity proposing and approving
  across the same close step. Both must hold; SoD does not weaken R3.

---

## First-slice options

### Option A — pure library slice (RECOMMENDED)

`authorization/` module + `segregation.ts` pure SoD rule + unit tests +
`./authorization` package export. No flow/gate/cmd/MCP wiring.

- Mirrors `projection` (pure module, root barrel, fail-closed denial).
- Zero risk to the live `runMonthlyClose` / gate consumers; the suite stays green
  by construction (new module only).
- Mandated test coverage achievable in-unit: RBAC/ABAC matrix roles×orgs×
  capabilities, SoD distinct identities, cross-tenant isolation.
- **Line estimate (honest, ~2x the naive forecast):**
  - `authorization/types.ts` (~100) + `authorization/matrix.ts` (~50) +
    `authorization/authorize.ts` (~80) + `authorization/segregation.ts` (~60) +
    `authorization/index.ts` (~15) + `tenant-core` org-scope reuse (~0) ≈ **305 code**.
  - Tests: `authorization/__tests__/matrix.test.ts` (~160) +
    `authorization/__tests__/authorize.test.ts` (~140) +
    `authorization/__tests__/segregation.test.ts` (~120) +
    `authorization/__tests__/isolation.test.ts` (~90) ≈ **510 tests**.
  - `package.json` export + root barrel ≈ **8**.
  - **Total ≈ 820 authored lines.** Because the mandated coverage (matrix
    roles×orgs×capabilities + SoD + isolation) is inherently test-heavy, this
    **exceeds the 400-line review unit**. Mitigation: split apply into 2 chained
    PRs (module+types, then tests) OR take a documented size-exception
    (precedent: 425/588/1043 documented). Budget undercount ~2x → plan for
    **~820**, actual may land higher; keep the test-first TDD shape.

### Option B — A + wire into gates/approval.ts or flow/close.ts

Adds wiring of `authorize()`/SoD into the live R2/R3 approval path
(`gates/approval.ts` `ApprovalGate` or `flow/close.ts` `runMonthlyClose`).
Higher risk: touches the live monthly-close consumer, changes gate behavior,
requires plumbing `actorId`/operator identity into the close flow (which today
hardcodes `"professional"`). Significantly larger; the identity-threading gap
(no operator identity in `runMonthlyClose`/mission commands) makes this a
multi-step change. **Not recommended for the first slice** — defer the wiring
until the pure module is verified.

### Option C — A + cmd surface/export + MCP (full vertical)

Adds an `authorization check` CLI command and MCP surface. Fullest, largest, far
over budget; the CLI/MCP contract surface is a follow-up (SDD-100 Command Center
is the eventual consumer). **Not recommended now.**

### Recommendation

**Option A** — pure library slice. It is the smallest slice that closes the
hard, verifiable gaps the reconciliation calls out (RBAC/ABAC engine + org-wide
SoD) and delivers the mandated test coverage, while leaving the live consumers
untouched. Follow-up slice B wires SoD/`authorize()` into the approval gate /
close flow using the operator identity that receipts (`actorId`/`signerKeyId`)
already carry. Follow-up C adds the CLI/MCP surface.

Honest changed-line estimate: **~820 authored lines** (code ~305 + tests ~510 +
export ~8), which crosses the 400-line review-unit threshold → plan chained PRs
or a documented size exception (precedent 425/588/1043).

---

## Non-goals (this first slice)

- No changes to `gates/approval.ts`, `flow/close.ts`, `cmd/`, `mcp/`, or any
  existing gate — the live approval path stays byte-identical.
- No operator-identity plumbing into `runMonthlyClose` or mission commands.
- No per-org approval hierarchies, views, or connectors (SDD-060 follow-ups).
- No ABAC beyond org/action/optional-materiality context attributes.
- No CLI/MCP surface (Option C).
- No change to frozen `contracts/**` (RBAC is library-internal this slice;
  a contract addition would be a separate, contract-governed change).

## Risks

1. **Line budget breach (high):** mandated test coverage is heavy; ~820 exceeds
   the 400 review unit → must plan chained PRs or a documented size exception up
   front, or the gate will block apply.
2. **Identity model is absent (medium):** the org-wide SoD needs proposer +
   approver identities; today `flow/close.ts` hardcodes `"professional"` and
   mission commands carry no actor. This slice defines the pure SoD on explicit
   `proposerId`/`approverIds` inputs; actually populating them is deferred to
   slice B (wire + identity threading). Risk that the SoD rule's input contract
   doesn't match a future identity source — mitigate by keeping the pure function
   input-agnostic (plain strings) like `distinctApprovers` today.
3. **Scope creep / never-global drift (medium):** the governance amendment forbids
   global authority. Risk that a role/assignment helper defaults to a global
   scope; enforce per-org scoping via `tenant-core`'s `ValidatedTenantScope`
   reuse and a branded org-scope rejection of global.

## Test / metric hints (map to SDD-060 README)

- RBAC/ABAC matrix: parameterized test over roles × orgs × capabilities asserting
  the exact allowed/denied set from `ROLE_PERMISSIONS` (README "matrix tests over
  roles × orgs × capabilities").
- SoD distinct identities: assert `assertSegregation` allows distinct
  proposer/approvers and denies an identity in both sets for the same close step;
  R3 two-distinct-approvers continues to hold as a superset (README "SoD
  scenarios: distinct identities for R3").
- Cross-tenant isolation: assert an operator scoped to org A cannot authorize an
  action in org B (fail-closed denial), and that role assignment is per-org
  (README "cross-tenant isolation test suite").

## Conclusion

The first slice of SDD-060's pending core is a **pure `authorization/` library
module** (permission vocabulary + per-org roles + role→permission matrix +
per-org assignment + fail-closed `authorize()` with typed denial) plus a **pure
org-wide segregation-of-duties check**, exported as `./authorization`, with
unit tests covering the matrix, SoD distinct identities, and cross-tenant
isolation. ~820 authored lines; wire into the live approval path and add the
CLI/MCP surface in follow-up slices.
