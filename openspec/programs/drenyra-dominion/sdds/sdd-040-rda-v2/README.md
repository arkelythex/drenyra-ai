---

# SDD-040 — Receipt-Driven Accounting v2

> Status: PLANNED · Wave: 1 · Depends on: SDD-030 · Feeds: SDD-090, SDD-050

## Purpose

The transactional core of the ecosystem: freeze the candidate, review
proportionally by tier (R0–R3), gate, execute through authorized adapters, and
confirm against the external system. Produces receipts that prove exactly what
was observed — a review receipt never proves external execution.

## Scope

- Candidate freeze with canonical identity: schemaVersion, tenantId, ruc,
  companyId, fiscalPeriodId, intent, subjectHash, evidenceSetHash, policySetHash,
  skillSetHash, materiality, currency, canonicalPayload — any change creates a
  different candidate.
- Tier derivation R0–R3 and proportional review (automatic / one approval / two
  distinct approvers).
- Receipt types: Analysis, Review, Approval, Authorization, Execution,
  Reconciliation, Close package — shared signed envelope, different claims.
- Autonomy policy A + C: `A_effective = A_org ∩ A_jurisdiction ∩ A_skill ∩
  A_connector ∩ A_materiality ∩ A_actor`; R3 never lowered; integrity gates have
  no kill switch.
- Capacity ceilings as versioned policies (propose entry R2, record material
  entry R3, file with SUNAT R3, delete evidence/receipts forbidden).
- Bounded correction: one correction, independent validation that it answers the
  findings without widening scope, then escalation.
- Review lenses: scope, evidence, accounting, tax, materiality, execution,
  fraud/adversarial, explainability.
- Mandatory pre-execution gates that RECALCULATE their decision — never trust an
  `approved: true` boolean from the UI or an agent.
- UNKNOWN reconciliation: an uncertain external result is queried and reconciled
  before any retry; never classified as terminal success/failure.
- RDA v2 invariants (receipts never over-claim; approval is not execution;
  Guardian never part of the quorum; ledger is history, not the journal).

## Non-goals

- No external execution itself — only authorized adapters execute (SDD-110
  connectors); no monetary floats (BigInt only).
- Guardian Angel (SDD-090) is never part of the approval quorum.
- Receipts never prove SUNAT/bank/ERP acceptance — that is the Execution or
  Reconciliation receipt's separate claim.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-030 | provides — routed candidates and WorkResults entering freeze/review |
| SDD-090 | consumes — frozen candidates handed to Guardian for adversarial read-only review |
| SDD-050 | consumes — RDA receipts, gates, and UNKNOWN reconciliation used by the close journey |

## Input/output contract

- Inputs: candidates from work units (SDD-030) with evidence and pinned policies.
- Outputs: signed receipts, audit-ledger entries, UNKNOWN reconciliation records,
  denial envelopes with typed causes and continuations.

## Threats

- A modified candidate inheriting previous approval or receipts.
- Receipt over-claiming (UI showing "verified" when only a review exists).
- R3 downgraded to auto-approval; segregation of duties violated.
- Blind retry after an uncertain external response.
- The same actor proposing, approving, and confirming a material action.

## Tests and metrics

- Candidate-identity immutability: changing any identity element invalidates
  prior approvals and forces fresh Guardian review.
- Gate recalculation tests (gates never trust client state).
- Invariant suite: 0 self-authorization paths, approvals bound to exact
  candidate/scope/evidence/policy, 0 floats, 0 blind retries.
- Adversarial scenarios: altered evidence, duplicates, collusion, malicious
  instructions.

## Rollback

- Receipts are never rewritten; a changed candidate creates a new identity and a
  new review.
- Vertical rollback reverts the PR chain in reverse order to the previous
  `program-lock` composition.

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
