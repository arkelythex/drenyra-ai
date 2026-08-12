---

# SDD-100 — Professional Command Center

> Status: PLANNED · Wave: 3 · Depends on: SDD-020, SDD-060, SDD-090 · Feeds: SDD-110

## Purpose

The professional Web UI projection of the Core for firms and internal teams, in
professional Spanish. Projects `status` and `nextTransition` from `drenyra-ai`;
it is never a second authority and never reconstructs the state machine.

## Scope

- Portfolio and Mission Workspace (projection of the 15-state lifecycle).
- Evidence Room, Reconciliation Workspace, and Candidate Review.
- Decision Queue (R2/R3 approvals), Guardian Findings, Receipt Explorer, and
  Close Package.
- Control Center: autonomy configuration within ceilings (never below the
  regulatory minimum).
- Projection of negotiated transitions: render only `status`, `eligibleTransitions`,
  and `nextAction` — deny with code, cause, and continuation.
- Receipt fidelity: never show "verified" when only a review receipt exists.

## Non-goals

- No alternative state machine; no invented states, receipts, or authority.
- No decision logic in the UI — gates RECALCULATE in the Core and never trust
  client `approved: true`.
- No fiscal content authored by the UI; terminology follows professional Spanish
  accounting norms.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-020 | provides — configured, pinned hosts that run the missions being projected |
| SDD-060 | provides — org-scoped views and approval chains |
| SDD-090 | provides — Guardian findings for display |
| SDD-110 | consumes — the product surface that enters production and commercial operation |

## Input/output contract

- Inputs: Core `status`/`nextTransition`, receipts, Guardian findings, close data.
- Outputs: a usable, Spanish-language professional Web UI for the monthly close,
  reviews, approvals, and supervision.

## Threats

- UI inventing states, receipts, or authority.
- Stale projections deciding transitions on outdated state.
- Fiscal terminology errors in Spanish user-facing copy.
- Approval actions trusting client-side state instead of Core recalculation.

## Tests and metrics

- Projection conformance: rendered `status`/`nextAction` match the Core exactly.
- Receipt Explorer fidelity: each receipt shows only its claimed scope.
- Authorization rendering tests per role and tenant.
- Spanish terminology review against professional accounting usage.

## Rollback

- UI releases are versioned projections; a bad release reverts to the prior
  projection without touching Core state or receipts.

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
