---

# SDD-060 — Multi-Operator Control Plane

> Status: lifecycle:active · Maturity: partial (tenant model implemented) · Wave: 3 · Depends on: SDD-050 · Feeds: SDD-100

## Purpose

Lets an accounting firm and an internal team operate the same Core with different
organizations, roles, views, policies, approval hierarchies, and connectors.
Delivers RBAC/ABAC authorization, tenant scope, and segregation of duties over
the monthly-close capability.

## Scope

- RBAC/ABAC authorization across organizations and roles.
- Tenant scope and isolation — `drenyra-ai` already ships `tenant-core` and
  `tenant-isolation` (implemented in the capability matrix).
- Per-org policies, approval hierarchies, views, and connectors.
- Segregation of duties enforcement (R3 requires two distinct approvers).
- Invariant: 0 fiscal data crosses tenants without full context.

## Non-goals

- No per-tenant fork of the Core — one Core, many projections.
- Never lowers the regulatory minimum; autonomy ceilings may only tighten.
- Does not invent states, receipts, or authority on any surface.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-050 | provides — the close capability the plane organizes across operators |
| SDD-100 | consumes — org-scoped views and approval chains projected in Command Center |

## Input/output contract

- Inputs: tenant, organization, role, policy, and connector configurations.
- Outputs: org-scoped, segregated operation with isolated views, per-org
  approval chains, and tenant-bound connectors.

## Threats

- Tenant boundary breach or cross-tenant data flow.
- Role escalation through ABAC/RBAC misconfiguration.
- Segregation-of-duties violation (same actor proposing and approving).
- Connector permission leakage between organizations.

## Tests and metrics

- Cross-tenant isolation test suite (0 data crosses without full context).
- RBAC/ABAC matrix tests over roles × orgs × capabilities.
- Segregation-of-duties scenarios (distinct identities for R3).
- Connector scope tests per tenant.

## Rollback

- Org/role/policy changes are versioned and reversible per tenant.
- Tenant isolation is a gate, not a rollback target; receipts are never rewritten.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Governance amendment — tenant-scoped least authority and segregation (W3 only)

Allocated to SDD-060 by the Dominion reconciliation (W3 only; not repeated in any
other SDD). This is a governance requirement allocation (R14): it records future
acceptance wording and does NOT claim RBAC/ABAC, per-org policy/approval
hierarchies, or per-org connectors exist today (R17).

- **Least authority:** every operator, organization, role, and projection operates
  with the minimum authority required for its own scope; authority is granted per
  tenant/organization, never globally, and autonomy ceilings may only tighten.
- **Tenant scope:** authorization decisions are scoped to the tenant and
  organization they concern; 0 fiscal data crosses tenants without full context.
- **Segregation of duties:** no single identity may both propose and approve the
  same monthly-close step; the R3 distinct-approvers rule is a hard acceptance
  criterion, never a default.
  - **No capability claim:** the RBAC/ABAC authorization engine, per-org policy and
      approval hierarchies, and tenant-bound connectors are NOT claimed to exist
      today; the `tenant-core`/`tenant-isolation` maturity already recorded in the
      capability matrix is unchanged, and this amendment promotes nothing to
      `implemented`.

## Reconciliation — 2026-08-15 (vertical-closures)

> Change: `vertical-closures` (documentation-only reconciliation). Records the
> implemented tenant slice and the pending core; NO lifecycle promotion to
> `complete` (status-and-evidence rules R3/R4 — the declared core is not fully
> implemented). Evidence axes: lifecycle `active` · evidence
> `verified-revision-bound` (`6a7f0f7`, suite 843/843) · temporal class
> `current-claim`.

### Implemented core (real symbols, verified at `6a7f0f7`)

- `tenant-core/validateTenantScope` (`tenant-core/scope.ts`) — atomic fail-closed
  validation of companyId/RUC/period; plus `tenantScopeKey`, `sameTenantScope`,
  branded `TENANT_SCOPE_BRAND`, `ValidatedTenantScope`/`TenantScopeError`
  (`tenant-core/types.ts`).
- `tenant-isolation/assertTenantReadScope` + `readArtifact`
  (`tenant-isolation/read.ts`) and `TenantScopedStore<T>` — scoped read with
  scope revalidation. Note: `index.ts` states "Not yet wired into the package
  exports"; `package.json` exports `./tenant` → `tenant-core/index.js` only —
  tenant-isolation is a tested unit, not yet a package export.
- Tests: `tenant-core/__tests__/scope.test.ts`,
  `tenant-isolation/__tests__/read.test.ts`,
  `tenant-isolation/__tests__/import-boundaries.test.ts`.

### Pending core (follow-up slices, NOT implemented)

- **RBAC/ABAC authorization engine** across organizations and roles — absent (no
  module or symbols).
- **Per-org policies, approval hierarchies, views, and connectors** — absent.
- **Segregation of duties:** only the R3 dual-distinct-approvers rule exists
  (`distinctApprovers` in `gates/approval.ts` + Guardian approval finding), scoped
  to R3 candidates; there is no organization-wide SoD enforcement.

Capability-matrix rows `tenant-core`/`tenant-isolation` stay `implemented`;
nothing is promoted on documentary presence alone (R4).

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
