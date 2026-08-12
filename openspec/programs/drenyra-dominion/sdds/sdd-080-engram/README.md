---

# SDD-080 — Engram Institutional Memory

> Status: PLANNED · Wave: 2 · Depends on: SDD-010 · Feeds: SDD-050

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

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
