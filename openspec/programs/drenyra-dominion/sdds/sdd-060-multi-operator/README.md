---

# SDD-060 — Multi-Operator Control Plane

> Status: PLANNED · Wave: 3 · Depends on: SDD-050 · Feeds: SDD-100

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

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
