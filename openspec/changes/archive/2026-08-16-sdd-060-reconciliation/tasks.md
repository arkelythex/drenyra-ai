# Tasks — SDD-060 Reconciliation (Authorization Enforcement Surface)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~60 (SDD-060 record + change record) |
| 400-line budget risk | Low |
| Chained PRs recommended | No (docs-only, single PR) |
| Delivery strategy | single-pr |
| Chain strategy | n/a |

```text
Decision needed before apply: No
Chained PRs recommended: No (docs-only)
Chain strategy: n/a
400-line budget risk: Low
```

**Notes:** docs-only reconciliation following the `sdd-050-reconciliation`
precedent. NO code, NO contracts, NO lifecycle promotion. Suite must stay green
(1389 + pre-existing release-integrity flake which passes 13/13 isolated);
protected paths unchanged except the SDD-060 record itself.

---

## Phase 1 — SDD-060 record reconciliation

- [ ] `[W1]` Freeze baseline: `bun run test gates` (46/46), `bun run typecheck` EXIT 0. Confirm protected paths: `contracts/**`, `openspec/changes/archive/**`, non-allowlisted program root docs. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Correct the "Pending core" section (`openspec/programs/drenyra-dominion/sdds/sdd-060-multi-operator/README.md`): move the RBAC/ABAC authorization engine (`authorization/` — assignRoles, authorize, assertSegregation, 60 tests) and the enforcement wiring (`gates/authorization.ts` — AuthorizationGate, GateName "authorization", 27 tests) from "absent" to the implemented-surface mapping. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Keep the genuinely pending items as follow-up slices: per-org policies, approval hierarchies, views, connectors, canonical operator identity, organization-wide SoD beyond the R3 dual-approver rule. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Add revision-bound evidence to the record: PR #61 (authorization engine) + PR #64 tip (AuthorizationGate; suite 1389/1390 with the known flake, 46/46 gates). Keep `lifecycle:active` (R3/R4 — no promotion). <!-- sdd-owner: implementation -->
- [ ] `[W1]` Write `openspec/changes/sdd-060-reconciliation/apply-progress.md` (this batch). <!-- sdd-owner: implementation -->

## Phase 2 — Verification

- [ ] `[W1]` `bun run test gates` (46/46), `bun run typecheck` EXIT 0; protected paths unchanged; no capability claimed beyond evidence; `lifecycle:active` kept. <!-- sdd-owner: implementation -->
- [ ] `[W1]` Write `openspec/changes/sdd-060-reconciliation/verify-report.md`. <!-- sdd-owner: implementation -->

---

## Lifecycle gates (parent-owned, post-apply)

- [ ] Ship as a single docs-only commit within PR #64 (or its own commit on the feature branch); post-apply bounded review per native contract; validate + merge. <!-- sdd-owner: parent -->
