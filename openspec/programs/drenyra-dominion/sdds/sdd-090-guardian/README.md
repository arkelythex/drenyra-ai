---

# SDD-090 — Guardian Angel

> Status: PLANNED · Wave: 2 · Depends on: SDD-040 · Feeds: SDD-100

## Purpose

Provides independent, adversarial, strictly read-only verification over frozen
candidates. Guardian Angel is never part of the approval quorum — it inspects
exactly the bytes that could execute and reports findings, nothing more.

## Scope

- Posture documentation (partial in the capability matrix).
- Verification lenses (planned): read-only frozen candidates, refutation
  dual-review, findings resolution.
- Strictly read-only execution model: never approves, executes, or mutates
  candidates.
- Findings surfaced to Command Center (SDD-100) and the review process.

## Non-goals

- Guardian never approves, executes, or mutates candidates (charter §2.2).
- Never part of the approval quorum (RDA v2 invariant).
- Holds no authority state of its own.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-040 | provides — frozen candidates with exact identity and evidence |
| SDD-100 | consumes — Guardian findings displayed in the Command Center |

## Input/output contract

- Inputs: frozen candidates and their evidence (exact bytes, exact identity).
- Outputs: adversarial findings over those exact bytes; refutation outcomes for
  inferential findings.

## Threats

- Quorum capture or pressure to influence decisions.
- Review over stale bytes (candidate changed after freeze).
- Mutation attempts on the candidate during review.
- Collusion among review actors; findings suppressed.

## Tests and metrics

- Read-only enforcement: Guardian cannot approve, execute, or mutate.
- Planted-defect detection accuracy on adversarial candidates.
- Refutation dual-review consistency for inferential findings.
- Re-review required whenever the candidate identity changes.

## Rollback

- Findings are advisory records with no authority state to roll back.
- A candidate change requires a fresh review; prior findings never carry over.

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
