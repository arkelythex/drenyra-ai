---

# SDD-000 — Drenyra Dominion Program

> Status: PLANNED · Wave: 0 · Depends on: — (program master) · Feeds: SDD-010

## Purpose

Master SDD for the Drenyra ecosystem. Fixes the North Star (coverage, trust,
distribution), the frontiers, the authority model, the taxonomy, and the domain
criteria that every vertical SDD must honor. Ratifies the charter and defines
the program gates, waves, and Gate 0 that gate all downstream work.

## Scope

- North Star and the first conquest (Peruvian monthly close), with the common
  core extending to reconciliation/treasury, tax/SUNAT, and accounting/audit.
- Frontiers: ecosystem map (Command Center, Pi, external hosts, SDK/MCP/CLI,
  authority core, restricted adapters) and repository ownership boundaries
  ("responsible for" / "never may" per component).
- Constitutional rules 1–10 and the mandatory authority chain (evidence →
  frozen candidate → policy/materiality R0–R3 → gate/approval → authorized
  adapter → external confirmation, with UNKNOWN reconciliation).
- Verifiable invariants (0 self-authorization paths, 0 floats, 0 blind retries,
  0 alternative state machines, memory never evidence, 0 retroactive skills).
- Taxonomy and domain criteria for organic work routing (direct analysis /
  specialized agent / durable mission).
- SDD contract and per-SDD content contract; program gates (§6.2); Gate 0
  completion; wave sequencing; repository ownership table.

## Non-goals

- Does not implement any vertical capability itself; it is constitution, not code.
- Does not replace per-repository specs — full specs are never copied into
  participant repos (they would diverge).
- Does not design UI surfaces, connectors, or skills content.
- Does not promise an open-core date — the transition is registered as an
  intention, not a contractual promise (charter §9).

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | provides — consumes the charter, taxonomy, and gate criteria to fix multi-repo contracts and the release train |

## Input/output contract

- Inputs: program brief and design documents; real repository state
  (`capability-matrix.yaml`); Gate 0 evidence (active changes inventory,
  overlaps resolution, frozen ICP/operators, first journey).
- Outputs: ratified charter; frozen taxonomy and domain criteria; program gates;
  SDD catalog with waves and repo ownership; a reproducible composition via
  SDD-010's `program-lock`.

## Threats

- Charter drift: implementation diverges from declared authority boundaries.
- Duplicated normative functions across repositories.
- A vertical advancing without a producer–consumer contract or migration/rollback.
- Mock-proven work declared complete, or review budgets exceeded without splitting.

## Tests and metrics

- Every vertical passes the §6.2 program gates before advancing.
- Invariants hold at the ecosystem level: 0 paths allow an agent to authorize
  itself; 0 floats; 100% of material actions produce a receipt.
- Capability matrix rechecked at each program checkpoint; `planned` items tracked.
- Charter §8 success definition (v1) is the program's terminal metric.

## Rollback

- The charter is versioned; a breaking change requires a program-level migration,
  never a silent edit.
- Verticals roll back individually in reverse dependency order without rewriting
  historical receipts.

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
