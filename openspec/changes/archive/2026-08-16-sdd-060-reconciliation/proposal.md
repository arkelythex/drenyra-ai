# SDD-060 Reconciliation — Authorization Enforcement Surface

> Change: `sdd-060-reconciliation` · Type: docs-only reconciliation
> Status: proposal

## Intent

Reconcile the SDD-060 multi-operator record against the now-implemented
authorization surface, following the same pattern as `sdd-050-reconciliation`.
The record's "Pending core" section states the RBAC/ABAC authorization engine is
"absent (no module or symbols)" — that was true when the record was last
reconciled, but it is no longer true: `authorization/` shipped in PR #61 and the
`AuthorizationGate` (PR #64) now wires `authorize()` into the approval pipeline,
closing the "live enforcement wiring" gap the record still lists as pending.

## What changed since the last reconciliation

| Surface | Implemented symbols (PR #61 + PR #64) | Evidence |
| --- | --- | --- |
| RBAC/ABAC authorization engine | `authorization/` — `assignRoles`, `authorize`, `assertSegregation`, closed permission/role vocabularies, frozen role→permission matrix (+ 5 test files, 60 tests) | suite 1390/1390 (PR #61 landed earlier; 1363 baseline + 27 gate tests) |
| Enforcement wiring (gate) | `gates/authorization.ts` — `AuthorizationGate` (ApprovalGate quantity + per-approver `close:approve` at exact tenant scope, fail-closed); `GateName` += "authorization"; exported from `gates/index.ts` (+ 27 tests) | suite 1389/1390 at PR #64 tip (1 pre-existing release-integrity flake); `gates/__tests__/authorization-gate.test.ts` |

## Scope

- SDD-060 record: correct the "Pending core" section — move the RBAC/ABAC engine
  and the enforcement wiring from "absent" to the implemented-surface mapping;
  keep the genuinely pending items as follow-up slices (per-org policies,
  approval hierarchies, views, connectors, canonical operator identity,
  organization-wide SoD beyond the R3 rule). Record the PR #61 + PR #64 evidence
  with revision-bound suite numbers. Keep `lifecycle:active` (R3/R4: the record
  stays active — this reconciles implemented surface, no promotion).
- Change record: proposal, tasks, apply-progress, verify-report.

## Non-goals

- NO code, NO contract changes, NO new permissions/roles.
- NO lifecycle promotion (SDD-060 stays `active`).
- No changes to the implemented authorization surface (already shipped).

## Acceptance

- `bun run test` green (1389 + the known release-integrity flake, which passes
  13/13 isolated), typecheck green, protected paths unchanged except the SDD-060
  record.
- Record states implemented surface truthfully; pending items accurately reflect
  the remaining gaps; no capability claimed beyond evidence.
