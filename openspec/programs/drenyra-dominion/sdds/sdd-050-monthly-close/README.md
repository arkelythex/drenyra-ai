---

# SDD-050 — Peruvian Monthly Close

> Status: PLANNED · Wave: 3 · Depends on: SDD-040, SDD-070, SDD-080 · Feeds: SDD-060

## Purpose

The first complete vertical: takes ERP exports, SIRE reports, and bank statements
through preflight, normalization, reconciliation, and exceptions, then generates
candidates that pass Guardian review and R0–R3 decisions, authorized execution,
and a verifiable Close Package. This is the conquest that defines Drenyra v1.

## Scope

- Evidence import: ERP exports, SIRE reports, bank statements (adapter
  capabilities planned under SDD-110; evidence lifecycle and journal lifecycle
  slices in progress in `drenyra-ai`).
- Preflight, normalization, and reconciliation; exception surfacing with typed
  causes and continuations.
- Candidate generation through RDA v2 (SDD-040): freeze → tier → review →
  gates → authorized execution with UNKNOWN reconciliation.
- Guardian Angel review (SDD-090) over the frozen close candidates.
- Close Package receipt and audit-ledger records.
- PE policy/CDR composition (in-progress slices 1D/1E) and skills pinned to the
  close period (SDD-070).

## Non-goals

- Drenyra AI never becomes an ERP, bank, or primary accounting ledger.
- No fiscal data crosses tenants without full context.
- Engram memory informs the close but is never accepted as evidence.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-040 | provides — freeze/review/gate/execution mechanics and receipt types |
| SDD-070 | provides — versioned fiscal skills and policies pinned to the period |
| SDD-080 | provides — institutional memory context for the close (informs only) |
| SDD-060 | consumes — the close runs for firms and internal teams via the multi-operator plane |
| SDD-100 | coordinates — Close Package and Evidence Room are projected in Command Center |

## Input/output contract

- Inputs: ERP exports, SIRE reports, bank statements; pinned skills and policies
  (SDD-070); memory context (SDD-080).
- Outputs: a verifiable monthly close — Close Package receipt, audit-ledger
  entries, exception reports, and full evidence chain.

## Threats

- Evidence gaps producing assumption instead of wait/block.
- UNKNOWN external responses misclassified as success or failure.
- Skill/policy vigencia violations during the close.
- Altered or forged evidence; cross-tenant leakage; memory accepted as evidence.

## Tests and metrics

- End-to-end close journey from evidence import to Close Package.
- Exception handling and reconciliation correctness.
- Adversarial scenarios: altered evidence, duplicate operations, blind retries.
- Receipt-chain integrity across the close (Review → Approval → Authorization →
  Execution → Reconciliation → Close package).

## Rollback

- Per-vertical reverse-order rollback; Close Package receipts are preserved.
- Historical receipts are never rewritten; recovery never duplicates operations.

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
