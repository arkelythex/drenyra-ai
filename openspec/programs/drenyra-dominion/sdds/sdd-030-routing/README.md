---

# SDD-030 — Organic Accounting Work Routing

> Status: lifecycle:in-progress · Maturity: partial (WorkUnit/WorkResult surfaces implemented; preflight router pending) · Wave: 1 · Depends on: SDD-010 · Feeds: SDD-040
>
> **Slice A+B delivered 2026-08-15** (change `sdd-030-routing`, PRs #39/#40):
> new `routing/` module with the immutable `WorkUnit`/`WorkResult` typed
> surfaces and fail-closed helpers (type-only Core boundaries, branded
> JsonInteger/Sha256Hash, 9-kind typed stop reasons, injected canonical
> transition validation, candidate refs by subjectHash, BigInt cents). Suite
> 843/843 green. Remaining (slice C, deferred): the preflight router over the
> §5 criteria.

## Purpose

Routes every professional request through a deterministic preflight and picks
the smallest safe route: direct analysis, specialized agent, or durable mission.
Defines the WorkUnit contract with bounded attempts and the structured WorkResult
schema so agents propose while authority stays in the Core.

## Scope

- Deterministic preflight: scope, permissions, risk, evidence.
- Route selection by materiality, reversibility, external-evidence need,
  duration/interruptibility, systems involved, segregation of duties, regulatory
  obligations, and approval need — never file/agent counts.
- Three routes with their persistence and authority (no mutation / proposes
  only / passes through the Core).
- WorkUnit contract: missionId and objective, full scope (tenant, RUC, company,
  period), evidence allowed by hash, skills/policies pinned by version,
  authorized tools and destinations, mandatory output schema, time/token/cost/
  attempt budgets, verifiable success condition, typed reasons to stop.
- Two distinct budgets: research/technical attempts (initially up to 3) and
  frozen-candidate correction (max ONE before escalation).
- WorkResult schema: outcome, evidenceRefs, proposedCandidates,
  unresolvedExceptions, policyVersions, toolProvenance, costAndAttempts,
  nextTransition — amounts as BigInt in minimum monetary units.
- Mission lifecycle (15 frozen states) and negotiated transitions
  (status / eligibleTransitions / nextAction with denial codes and
  continuations).

## Non-goals

- No execution authority — routes propose; only the Core determines the allowed
  transition and only an authorized adapter executes.
- No free text carrying authoritative amounts, states, permissions, or approvals.
- Does not build the durable mission engine itself (consumed by SDD-040 RDA).

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | provides — the contract surface for preflight and negotiated transitions |
| SDD-040 | consumes — routed candidates and WorkResults enter freeze/review/gate |

## Input/output contract

- Inputs: professional requests from Command Center, Pi, and external hosts.
- Outputs: typed routes with WorkUnits and WorkResults; candidates proposed to
  RDA; denial envelopes with typed cause and executable continuation.

## Threats

- Over-routing small queries into durable missions.
- Infinite agent loops (bounded by the two-budget scheme).
- Free-text smuggling of authority (amounts, states, approvals).
- Alternative state machines on surfaces; transitions decided on stale state.

## Tests and metrics

- Route-selection cases against the §5 criteria (charter).
- Budget enforcement: research attempts capped, correction capped at one.
- WorkResult schema conformance (structured fields, BigInt, no free-text authority).
- Negotiated-transition consistency: the same deterministic function feeds both
  `status` and `apply`, so they cannot contradict each other.

## Rollback

- Routing policy is versioned; running missions keep their pinned route and
  budgets; no receipts exist at this layer.

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
