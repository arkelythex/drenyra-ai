# Proposal — SDD-060 Authorization and Segregation of Duties First Slice

## Intent

Deliver the first missing deterministic authorization capability for the SDD-060 Multi-Operator Control Plane: a pure, tenant-scoped RBAC/ABAC library and an organization-wide segregation-of-duties (SoD) rule.

This slice establishes a closed, testable authorization decision surface without changing the live monthly-close approval path. Later integration slices can consume a fail-closed Core primitive instead of inventing authority in clients, agents, commands, or adapters.

## Roadmap and architecture alignment

This change belongs to the 16-program Peru v1 roadmap under SDD-060, the Wave 3 Multi-Operator Control Plane. It advances the implemented tenant model toward the pending multi-operator core:

- tenant and organization-scoped operator authority;
- RBAC grants refined by organization and selected context attributes;
- deterministic segregation of monthly-close duties;
- a reusable surface for later policies, approval chains, views, connectors, and Command Center slices.

The approved layer model is:

`contracts -> library modules -> agents -> cmd`

Authorization is deterministic authority and belongs in a Core-facing library, not AI advisory behavior or client-side presentation. Agents and commands may later request or project decisions, but they must not create authority. The module remains fail-closed, transport-agnostic, and independent of Drenyra, Drenyra Pi, Drenyra Engram, commands, and MCP.

This slice does not change the audit-only `ledger/`, the future accounting journal, or evidence and memory boundaries. Decisions are computed from explicit validated inputs.

## Current state and gap

The repository already provides tenant foundations:

- `tenant-core/validateTenantScope` produces branded `ValidatedTenantScope` values;
- tenant validation, keys, and comparison are fail-closed;
- `tenant-isolation/` provides tested scoped-read primitives;
- `./tenant` exports tenant-core.

RBAC/ABAC and org-wide SoD are absent:

- no closed permission vocabulary;
- no operator roles scoped per organization;
- no role-to-permission matrix;
- no identity-to-role assignment primitive;
- no authorization decision or typed denial;
- no organization-wide proposer/approver segregation.

Existing controls are candidate-scoped only. `gates/approval.ts` requires two distinct approvers for R3, and Guardian review separately checks distinct accepting reviewers. Neither prevents a proposer from approving the same close step, and neither supplies organization-wide authorization.

Identity is not a first-class entity. Existing surfaces use plain strings such as `approverId`, `reviewer`, `actorId`, and `signerKeyId`; `flow/close.ts` hardcodes `actor: "professional"`, while mission approval commands carry no operator identity.

The product can validate tenant scope and count R3 approvers, but cannot explain whether an operator may perform a capability for an organization or enforce separation between proposal and approval.

## Proposed change

Adopt Option A: add a pure `authorization/` library module, pure SoD check, unit tests, and `./authorization` package export.

### Closed permission vocabulary

Define a strict, frozen `Permission` vocabulary covering the initial control-plane shape:

- `close:propose`;
- `close:approve`;
- `close:review`;
- `close:audit-read`;
- `mission:operate`;
- `tenant:admin`.

The specification may refine names before implementation, but the shipped set must be closed. Unknown strings never become grants.

### Per-organization roles

Define the initial roles:

- `preparer`;
- `reviewer`;
- `approver`;
- `admin`.

A role has meaning only within its validated tenant/organization scope. Even `admin` is never global and cannot bypass tenant boundaries or autonomy ceilings.

### Frozen role-to-permission matrix

Publish one immutable role-to-permission matrix as the authorization source of truth. It follows least authority and cannot be expanded by runtime mutation or client configuration. Material matrix changes remain explicit and reviewable.

### Per-org role assignment

Bind each identity and role set to `tenant-core`'s `ValidatedTenantScope`. Empty roles, malformed scopes, and any implied global scope fail closed. Assignment produces the validated operator input consumed by authorization.

### Fail-closed authorization

Provide a pure decision surface equivalent to:

`authorize(identity, action, context) -> allow | deny`

An allow requires all applicable conditions:

- a valid per-org identity assignment;
- a known permission;
- at least one assigned role granting that permission;
- exact assignment/target scope compatibility;
- satisfaction of any defined ABAC refinement.

Everything else denies. Denial carries a typed code, safe cause, and actionable continuation. Missing, malformed, unknown, or cross-tenant inputs never receive a permissive default.

ABAC remains intentionally small: explicit target organization plus selected context such as materiality. Attributes may restrict a matrix grant; they may not invent one.

### Pure segregation-of-duties rule

Add `authorization/segregation.ts` with a pure check equivalent to:

`assertSegregation({ closeStepId, proposerId, approverIds })`

For one monthly-close step or artifact, no identity may be both proposer and approver. Plain string IDs are deliberate because no canonical identity source exists. Invalid input and identity overlap fail closed with an explicit result; the function never mutates workflow state.

SoD complements, rather than replaces, R3:

- R3 still requires two distinct approvers;
- SoD requires every approver to differ from the proposer;
- this slice does not alter `distinctApprovers`;
- live composition is deferred until identity plumbing exists.

## First-slice scope

Included:

- authorization types and closed vocabularies;
- per-org role assignment using `ValidatedTenantScope`;
- immutable role-to-permission matrix;
- fail-closed `authorize()` and typed denial;
- pure same-close-step SoD evaluation;
- public `./authorization` package subpath;
- unit tests for matrix, decisions, SoD, and tenant isolation.

The slice does not wire decisions into an existing runtime consumer.

## Requirements preview

### REQ-AUTH-001 — Closed permission vocabulary

The module MUST expose a finite, typed permission vocabulary. Unknown actions MUST fail closed and MUST NOT be coerced into known permissions.

### REQ-AUTH-002 — Closed organization role vocabulary

The module MUST define initial `preparer`, `reviewer`, `approver`, and `admin` roles. Roles MUST have authority only within their assigned organization.

### REQ-AUTH-003 — Per-org role assignment

Every assignment MUST bind one explicit identity and non-empty role set to one validated tenant/org scope. Invalid, malformed, or global assignments MUST be rejected.

### REQ-AUTH-004 — Frozen role-to-permission matrix

The module MUST expose one immutable role-to-permission matrix. Authorization MUST consult it and MUST NOT accept runtime-expanded grants.

### REQ-AUTH-005 — Fail-closed authorization

`authorize()` MUST return allow or deny. Missing identities, unknown actions, invalid roles, malformed context, absent grants, and scope mismatches MUST deny.

### REQ-AUTH-006 — Typed denial

Every denial MUST carry a typed code, safe cause, and actionable continuation suitable for deterministic callers and tests.

### REQ-AUTH-007 — Least authority and isolation

An assignment for organization A MUST NOT authorize an action for organization B. No role or operator authority may be global.

### REQ-AUTH-008 — Minimal ABAC refinement

Context MUST identify the target organization and MAY include specified attributes such as materiality. Attributes MUST only restrict or select a defined grant, never invent permission.

### REQ-AUTH-009 — Segregation of duties

For the same close step, a proposer MUST NOT approve that step. Any proposer/approver overlap MUST deterministically deny.

### REQ-AUTH-010 — Input-agnostic identity IDs

The SoD API MUST accept explicit plain string IDs and MUST NOT depend on a new identity provider, receipt signer, mission command, or close-flow actor.

### REQ-AUTH-011 — R3 compatibility

SoD MUST preserve the hard requirement for two distinct R3 approvers and MUST NOT redefine SoD as merely counting approvers.

### REQ-AUTH-012 — Public export

The package MUST expose the supported surface through `./authorization` without internal-file imports.

### REQ-AUTH-013 — Unit verification

Tests MUST cover roles × organizations × capabilities, SoD identity scenarios, denial behavior, and cross-tenant isolation.

### REQ-AUTH-014 — English technical surface

Public identifiers, denial codes, continuations, documentation, and tests introduced by this slice MUST use English.

## Non-goals

- No wiring into `gates/approval.ts` or `flow/close.ts`.
- No change to monthly-close, missions, candidates, Guardian, or existing gates.
- No actor plumbing into mission commands or replacement of the hardcoded close actor.
- No identity provider, operator directory, authentication, or key-to-operator model.
- No per-org policy engine, approval hierarchy, view, or connector.
- No general expression language or dynamically configurable ABAC.
- No command, CLI, MCP, agent, or Command Center surface.
- No capability-matrix promotion beyond verified authorization work.
- No `tenant-isolation/` export or frozen `contracts/**` change.
- No ledger, journal, evidence, memory, SUNAT, or connector behavior change.

## Product and architecture tradeoffs

### Option A — pure module, selected

Option A isolates deterministic semantics from incomplete identity and workflow plumbing. It is independently testable and avoids risk to monthly close. Its explicit limitation is that the product does not enforce these decisions in the live path yet: this is the authoritative primitive, not the complete operator experience.

### Option B — add approval-flow wiring, deferred

Wiring now would enforce decisions earlier, but touches the live consumer and requires trustworthy operator identity through flows and mission commands. That source does not exist. Doing this now would either broaden scope substantially or create dangerous temporary identity assumptions.

### Option C — full CLI/MCP vertical, deferred

External surfaces now would add transport contracts before Core semantics and identity are stable, overlap later SDD-100 consumption, and substantially increase the first slice.

## Affected areas

Expected changes are limited to new `authorization/` source and tests plus package/barrel exports. Existing approval, close, command, MCP, contract, and agent behavior remains unchanged.

Future consumers include approval gates, monthly close, mission commands, per-org policy, and Command Center projections. Each requires a separate proposal.

## Impact and risks

### High — review size

The honest estimate is approximately 820 authored lines: about 305 code, 510 tests, and 8 export lines. This exceeds both the program's 400-line review-unit limit and the OpenSpec session's conservative 300-line budget. The required test matrix must not be weakened to fit an optimistic estimate.

### Medium — absent canonical identity

The pure SoD rule accepts explicit string IDs, consistent with `approverId` and `reviewer`. A follow-up must define authenticated operator identity before live enforcement.

### Medium — never-global drift

A global role or universal admin violates governance. Every assignment requires `ValidatedTenantScope`; all target-scope mismatches deny.

### Medium — matrix drift or escalation

A mutable or duplicated matrix can grant capability unintentionally. One frozen matrix, closed vocabularies, and exhaustive tests reduce the risk. Later policy may tighten authority, not silently expand it.

### Low — misleading capability claims

An exported library can be mistaken for end-to-end enforcement. Documentation and capability reporting must state that live approval wiring remains absent.

## Rollback

Because this slice is additive and unused by live consumers, rollback removes `./authorization`, the new module, and its tests. No tenant data, approval state, receipts, ledger entries, or close artifacts are migrated or rewritten. Existing R3 behavior remains unchanged.

After later consumers adopt this surface, rollback requires a separate integration decision; bypassing a live authorization gate is not authorized here.

## Success criteria and test hints

The slice succeeds when:

- `./authorization` exposes the supported surface;
- every role and permission has one explicit frozen mapping;
- role × org × capability tests prove exact allow/deny behavior;
- an org A operator is denied for org B;
- unknown and malformed inputs deny with typed reasons;
- SoD allows distinct proposer and approvers;
- SoD denies proposer/approver overlap;
- tests preserve two distinct R3 approvers as a separate invariant;
- no live approval, close, command, MCP, or agent path changes;
- the full unit suite remains green.

These map to SDD-060's RBAC/ABAC matrix, distinct-identity SoD, and cross-tenant isolation metrics.

## Delivery shape

Recommend one PR with a documented size exception.

Reasons:

- code and tests form one coherent authorization contract;
- precedents exist around 425, 588, and 1043 authored lines;
- separating tests weakens the strict-TDD review narrative;
- the ~820 lines remain bounded to one additive module with no live wiring.

Alternative chained split:

1. PR 1: module types, matrix, decisions, SoD, and exports.
2. PR 2: exhaustive matrix, authorization, SoD, and isolation tests.

Chaining follows the review-unit policy more literally but creates an interval with incomplete verification. If required, each branch should retain test-first commits and PR 1 should not merge before PR 2 is reviewable. Tasks must record the selected exception or chain boundary before apply.

## Follow-up slices

Option B should define canonical operator identity, thread it through mission and close inputs, compose authorization/SoD/R3, wire fail-closed decisions into the live consumer, and specify migration and denial UX.

Option C may add command and MCP surfaces and project org scopes into SDD-100 Command Center. Per-org policies, approval hierarchies, views, and connectors remain separate roadmap work.

## Open questions and assumptions needing review

These product questions should be resolved during specification or design:

1. Should `admin` be allowed to propose or approve, or remain administrative-only?
2. Should materiality restrict R2/R3 approvers now, or remain reserved until live wiring?
3. Do multiple roles union their grants subject to SoD, or are some combinations invalid?
4. Should malformed SoD input use authorization denials or a dedicated segregation type?
5. Is the cohesive single-PR size exception acceptable, or is a chained split mandatory?

Until corrected, this proposal assumes:

- `admin` has least-authority org administration with no global or approval bypass;
- materiality may restrict grants but cannot create them;
- multiple roles union explicit grants while SoD remains an independent hard denial;
- malformed SoD inputs fail closed with segregation-specific typed reasons;
- delivery uses one documented size-exception PR, with chaining as the governance fallback.
