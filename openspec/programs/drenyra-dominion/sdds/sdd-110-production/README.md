---

# SDD-110 — Production and Commercial Readiness

> Status: PLANNED · Wave: 4 · Depends on: SDD-100 · Feeds: — (operational)

## Purpose

Takes the validated ecosystem to real commercial operation: restricted adapters
for ERP, SUNAT/SIRE, banks, e-invoicing, and documents; KMS; production storage;
observability; professional pilots; and the open-core transition gate.

## Scope

- Restricted adapters: ERP, SUNAT/SIRE, banks, e-invoicing, documents (currently
  `planned` in the capability matrix) with idempotent execution and UNKNOWN
  reconciliation.
- KMS, production PostgreSQL, and object storage; key lifecycle runbooks.
- Observability: incident, key, migration, and recovery runbooks (v1 definition).
- Professional pilots who understand and accept the blocks.
- Security posture and conformance at the ecosystem level.
- Open-core transition gate per the acceptance-matrix commercial gate —
  registered as intention, not a contractual promise.

## Non-goals

- Adapters never decide materiality or skip gates.
- Core contracts and verifiers never depend on cloud, UI, or commercial
  connectors (constitutional rule 10).
- No open-core date; the gate is a decision based on conditions.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-100 | provides — the product surface entering production |
| SDD-040 | coordinates — connectors implement RDA idempotent execution and UNKNOWN reconciliation contracts |

## Input/output contract

- Inputs: validated verticals from waves 0–3; connector vendor contracts.
- Outputs: commercial operation — real connectors, KMS, observability, runbooks,
  pilot results, and a recorded open-core gate decision.

## Threats

- A defective integration breaking authority limits.
- Key management failure or credential leakage.
- Observability gaps hiding failed or duplicate executions.
- Unvalidated connectors; commercial gate bypassed or treated as a date.

## Tests and metrics

- Connector conformance: idempotency, UNKNOWN reconciliation, scope isolation.
- KMS and security test suites; recovery drills.
- Pilot acceptance criteria against the v1 definition.
- `program-lock` reproducibility with production connectors in the composition.

## Rollback

- Connectors are versioned adapters; revert an adapter without rewriting
  historical receipts; the ecosystem returns to the previous `program-lock`
  composition and revalidates conformance.

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
