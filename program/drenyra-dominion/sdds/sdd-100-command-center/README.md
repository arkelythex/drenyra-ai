---

# SDD-100 — Professional Command Center

> Status: lifecycle:in-progress · Maturity: partial (drenyra-ai Core projection surface slice A implemented; Command Center UI product still pending) · Wave: 3 · Depends on: SDD-020, SDD-060, SDD-090 · Feeds: SDD-110
>
> **Status note (2026-08-15):** under the five-axis vocabulary
> ([status-and-evidence.md](../../status-and-evidence.md)) the former `PLANNED`
> label maps to `lifecycle:planned`. This SDD is NOT implemented: the Command
> Center product experience (SDD-100) is a future wave-3 deliverable consuming
> SDD-020 configurator, SDD-060 multi-operator, and SDD-090 guardian capabilities.
>
> **Slice A note (2026-08-15):** the drenyra-ai contribution of SDD-100 — the Core
> projection surface (`projection/` module: `status`/`eligibleTransitions`/`nextAction`/`deny`,
> read-only, deterministic, never a second authority) — shipped as slice A via PR #58; change
> record archived at `openspec/changes/archive/2026-08-15-sdd-100-command-center/`. The Command
> Center UI product itself remains pending in the sibling `drenyra-command-center` repo; this
> record stays `lifecycle:in-progress` (R3/R4: not promoted on presence alone).
>
> **Slice B note (2026-08-15):** the DRAFT projection contract (`contracts/projection.md`, v0.1,
> conformance delegated to the slice-A suite, freeze gated on ecosystem adoption) and the manual
> verification surface (`drenyra-ai project <missionId> [--store]` JSON dump, exit 0/1/2, read-only,
> no requested-continuation flag) shipped via PR #60; change record archived at
> `openspec/changes/archive/2026-08-15-sdd-100-projection-surface/`. Option C (contract freeze + MCP
> projection tool) remains, gated on Command Center adoption evidence; this record stays
> `lifecycle:in-progress`.

## Purpose

The professional Web UI projection of the Core for firms and internal teams, in
professional Spanish. Projects `status` and `nextTransition` from `drenyra-ai`;
it is never a second authority and never reconstructs the state machine.

## Scope

- Portfolio and Mission Workspace (projection of the 15-state lifecycle).
- Evidence Room, Reconciliation Workspace, and Candidate Review.
- Evidence Room fidelity: an `EvidenceObject` is displayed as an immutable
  Engram copy whose authoritative origin remains the external source.
- Decision Queue (R2/R3 approvals), Guardian Findings, Receipt Explorer, and
  Close Package.
- Control Center: autonomy configuration within ceilings (never below the
  regulatory minimum).
- Projection of negotiated transitions: render only `status`, `eligibleTransitions`,
  and `nextAction` — deny with code, cause, and continuation.
- Receipt fidelity: never show "verified" when only a review receipt exists.
  Engram `SignedReceipt`s prove Engram integrity and `approveMemory` is
  professional memory review — neither authorizes a fiscal action; only a
  `drenyra-ai` operation receipt claims the authoritative result.

## Non-goals

- No alternative state machine; no invented states, receipts, or authority.
- No decision logic in the UI — gates RECALCULATE in the Core and never trust
  client `approved: true`.
- No fiscal content authored by the UI; terminology follows professional Spanish
  accounting norms.
- No Engram artifact rendered as authority: `AccountingMemory`, `EvidenceObject`
  copies, `approveMemory` approvals, and Engram `SignedReceipt`s never authorize
  or prove a governed fiscal operation — that belongs to `drenyra-ai` and the
  enabled professional.

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
- Engram artifacts (`AccountingMemory`, `EvidenceObject` copies,
  `approveMemory`, Engram `SignedReceipt`s) rendered as authoritative.

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

- [x] Exploration
- [x] Proposal
- [x] Specification (RFC 2119 + Given/When/Then)
- [x] Design
- [x] Tasks (vertical TDD units)
- [x] Apply (strict TDD)
- [x] Verification report
- [x] Archive report

> Progress reflects the drenyra-ai projection-surface slices A (PR #58) and B (PR #60, both
> archived 2026-08-15); the Command Center UI product work continues in `drenyra-command-center`
> and this record stays `lifecycle:in-progress`.
