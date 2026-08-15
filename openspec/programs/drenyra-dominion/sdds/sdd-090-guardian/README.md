---

# SDD-090 — Guardian Angel

> Status: lifecycle:active · Maturity: partial (read-only verification core implemented) · Wave: 2 · Depends on: SDD-040 · Feeds: SDD-100

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

## Governance amendment — independent adversarial findings and non-approval (W3 only)

Allocated to SDD-090 by the Dominion reconciliation (W3 only; not repeated in any
other SDD). This is a governance requirement allocation (R14): it records future
acceptance wording and does NOT claim the verification lenses exist today (R17).

- **Independent adversarial findings:** Guardian inspects exactly the frozen bytes
  that could execute and reports findings; findings are advisory records with no
  authority state of their own.
- **Non-approval:** Guardian is never part of the approval quorum; a finding — or
  its absence — neither approves nor blocks on its own, and a candidate change
  requires a fresh review.
  - **No capability claim:** the adversarial verification lenses (read-only frozen
      candidates, refutation dual-review, findings resolution) are NOT claimed to
      exist today; the `partial` posture row in the capability matrix is unchanged,
      and this amendment promotes nothing to `implemented`.

## Reconciliation — 2026-08-15 (vertical-closures)

> Change: `vertical-closures` (documentation-only reconciliation). Records the
> implemented read-only single-review verification core and the pending
> verification-lens core; NO lifecycle promotion to `complete`
> (status-and-evidence rules R3/R4). Evidence axes: lifecycle `active` · evidence
> `verified-revision-bound` (`6a7f0f7`, suite 843/843) · temporal class
> `current-claim`.

### Implemented core (real symbols, verified at `6a7f0f7`)

- `guardian/guardian.ts` — `runGuardianReview(candidate, options): GuardianReport`.
  Strictly read-only: `verdict` is always `"none"`; findings only
  (`GuardianFinding` severity blocker/concern/info; categories scope/materiality/
  approval/evidence/integrity). Checks: checksummed RUC, valid period,
  subject-hash integrity, declared materiality tier, R3 dual distinct approvers
  (`r3DualRequired`), missing-review-history concern. Does not mutate the
  candidate.
- `guardian/index.ts` exports it.
- CLI: `candidate audit <candidate.json>` — "Guardian Angel read-only adversarial
  review (findings only)" (`cmd/cli.ts`).
- Tests: `guardian/__tests__/guardian.test.ts`.

### Pending core (follow-up slices, NOT implemented)

- **Refutation dual-review:** no refuter/dual-review symbols (grep for
  `refutation`/`dual-review`/`refuter` = zero matches).
- **Findings resolution:** absent.
- **Full integration:** Command Center (SDD-100) consumption and `close-package`
  projection remain planned in the capability matrix.

Capability-matrix rows `verification-lenses`/`read-only-frozen-candidates`/
`refutation-dual-review`/`findings-resolution` stay `planned`; `posture-docs` stays
`partial`; nothing is promoted on documentary presence alone (R4).

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
