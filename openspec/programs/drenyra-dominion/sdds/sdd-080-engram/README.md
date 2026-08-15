---

# SDD-080 — Engram Institutional Memory

> Status: lifecycle:active · Maturity: partial (non-authorization boundary implemented; sibling core awaiting evidence) · Wave: 2 · Depends on: SDD-010 · Feeds: SDD-050

## Purpose

Delivers useful, persistent institutional memory — prior decisions and context —
that informs missions but never authorizes them. Serves the ecosystem through
`drenyra-engram` (alpha: v0.7.0 local-first EvidenceObject already delivered).

## Scope

- Scope-first SQLite store (implemented).
- EvidenceObject WORM records, ed25519 receipts, and offline verification
  (implemented).
- CLI, HTTP, and MCP interfaces (partial → complete).
- Lifecycle/vigencia and provenance tracking (implemented).
- Non-authorization boundary: memory informs, never serves as evidence or
  approval (implemented).
- Cross-tenant isolation (implemented).
- Audit register closure (active change in the capability matrix).

## Non-goals

- Engram is never evidence and never an approval — only the verifiable external
  response proves (constitutional rule 5).
- No authority state, receipts, or decision logic lives in memory.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | provides — interface and compatibility contract for memory services |
| SDD-050 | consumes — prior-decision context for the close journey (informs only) |

## Input/output contract

- Inputs: mission context, prior decisions, and verified facts.
- Outputs: queryable, offline-verifiable institutional memory with provenance
  and lifecycle/vigencia.

## Threats

- Memory accepted as evidence by any surface.
- Cross-tenant leakage of fiscal context.
- Memory drift or forged provenance.
- Authorization smuggling through recalled state.

## Tests and metrics

- `memory-never-authorizes` invariant enforced in tests.
- Cross-tenant isolation test suite.
- Offline verification of EvidenceObjects (ed25519).
- Provenance checks on recalled facts.

## Rollback

- Memory is WORM — records are never rewritten; the non-authorization boundary
  is enforced as a gate, not a data rollback.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Governance amendment — non-authorizing context and separation of authority (W3 only)

Allocated to SDD-080 by the Dominion reconciliation (W3 only; not repeated in any
other SDD). This is a governance clarification of the already-recorded
non-authorization boundary (R14): it claims no new memory capability (R17).

- **Non-authorizing context:** memory provides prior decisions and context that
  inform missions; it never authorizes them, and recalled state is never treated
  as evidence or approval on any surface.
- **Separation of authority:** no authority state, receipt, or decision logic
  lives in memory; only the verifiable external response proves, and a surface
  that accepts memory as evidence violates the boundary.
  - **No capability claim:** this amendment adds no new capability and promotes
      nothing to `implemented`; the existing non-authorization boundary and
      EvidenceObject maturity recorded in the capability matrix are unchanged.

## Reconciliation — 2026-08-15 (vertical-closures)

> Change: `vertical-closures` (documentation-only reconciliation). Records the
> implemented non-authorization boundary and marks the sibling-repo core as
> awaiting evidence (not verifiable from this clone); NO lifecycle promotion to
> `complete` (status-and-evidence rules R3/R4). Evidence axes: lifecycle `active`
> · evidence `verified-revision-bound` for the drenyra-ai boundary (`6a7f0f7`,
> suite 843/843) · temporal class `current-claim` (boundary) /
> `historical-snapshot` (sibling facts).

### Implemented in `drenyra-ai` — the non-authorization boundary (verified at `6a7f0f7`)

- `evidence/identity/types.ts` — `MEMORY_SHAPED_MARKERS = ["memory","engram","recall"]`,
  `EVIDENCE_CHANNEL`.
- `evidence/authority/authority.ts` — rejects memory-shaped channels
  (`EvidenceErrorCode.MEMORY_SHAPED`); `registerEvidence`, `assertEvidenceInScope`.
- `evidence/accept.ts` — `acceptEvidence` fails closed on memory-shaped input.
- `gates/approval.ts` — "Memory (Drenyra Engram) never authorizes — only a
  professional records…".
- Tests: `evidence/authority/__tests__/authority.test.ts`,
  `evidence/__tests__/accept.test.ts`, `evidence/identity/__tests__/identity.test.ts`
  (each asserts `MEMORY_SHAPED_MARKERS` rejection) — the `memory-never-authorizes`
  invariant.

### Sibling core — awaiting evidence (unverifiable from this clone)

The bulk of SDD-080's scope (scope-first SQLite, EvidenceObject WORM, ed25519
receipts, offline verification, provenance, cross-tenant isolation, CLI/HTTP/MCP,
audit-register closure) lives in the sibling `drenyra-engram` repo. Per the
capability matrix, sibling facts are `historical-snapshot / awaiting evidence`;
they cannot be verified from this clone. No engram runtime client is wired into
drenyra-ai — only the boundary. Federated integration and the sibling engram core
remain `awaiting evidence`; closure of this record is deferred to a change that
can verify the `drenyra-engram` surface. Nothing is promoted on documentary
presence alone (R4).

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
