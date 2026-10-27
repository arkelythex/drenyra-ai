---

# SDD-110 — Production and Commercial Readiness

> Status: lifecycle:in-progress · Maturity: partial (drenyra-ai connector-adapter conformance contract DRAFT v0.1 shipped; production operations still pending) · Wave: 4 · Depends on: SDD-100 · Feeds: — (operational)
>
> **Status note (2026-08-15):** under the five-axis vocabulary
> ([status-and-evidence.md](../../status-and-evidence.md)) the former `PLANNED`
> label maps to `lifecycle:planned`. This SDD is NOT implemented: production
> operations (real KMS/vault, SUNAT/SIRE/ERP/bank connectors, UNKNOWN
> reconciliation, observability, pilots) are future wave-4 deliverables.
>
> **Slice A note (2026-08-15):** the drenyra-ai contribution — the connector-adapter
> conformance contract (`contracts/connector-adapter.md`, DRAFT v0.1) + type-level
> mutation boundary (`adapters/connector.ts`, node:crypto-only) + mock conformance
> suite (29 tests, SC-CONN-001..020) — shipped as slice A via PR #59; change record
> archived at `openspec/changes/archive/2026-08-15-sdd-110-production/`. NO real
> connectors, credentials, or network shipped; `DECLARED_ADAPTERS` unchanged;
> capability-matrix connector rows stay `planned` (R17). Production operations remain
> future work; this record stays `lifecycle:in-progress` (R3/R4: not promoted on
> presence alone).

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

## Governance amendment — restricted authority, credentials, observability, incident evidence, and production acceptance (W3 only)

Allocated to SDD-110 by the Dominion reconciliation (W3 only; not repeated in any
other SDD). This is a governance requirement allocation (R14): it records future
acceptance wording and does NOT claim restricted adapters, KMS, production
storage, or observability infrastructure exist today (R17).

- **Restricted authority:** production adapters operate with the minimum external
  authority, are versioned and idempotent with UNKNOWN reconciliation, and never
  decide materiality or skip gates.
- **Credentials:** key and credential lifecycle follows the KMS runbooks —
  rotation, least-authority scope, and no credentials embedded in artifacts,
  logs, or memory.
- **Observability:** production operations are observable; incident, key,
  migration, and recovery runbooks exist and are exercised, so failed or
  duplicate executions are visible.
- **Incident evidence:** every incident and its resolution is captured as
  attributable, durable evidence (verifiable response), not narrative memory.
- **Production acceptance:** entry to production requires the v1-definition pilot
  acceptance criteria, conformance revalidation through `program-lock`
  reproducibility, and a recorded open-core gate decision — a decision, not a
  date.
- **No capability claim:** restricted adapters, KMS, production storage, and
  observability infrastructure are NOT claimed to exist today; their `planned`
  rows in the capability matrix are unchanged, and this amendment promotes
  nothing to `implemented`.

## Progress

- [x] Exploration
- [x] Proposal
- [x] Specification (RFC 2119 + Given/When/Then)
- [x] Design
- [x] Tasks (vertical TDD units)
- [x] Apply (strict TDD)
- [x] Verification report
- [x] Archive report

> Progress reflects the drenyra-ai connector-conformance slice A (PR #59, archived 2026-08-15);
> production operations (real connectors, KMS, observability, pilots) remain future wave-4 work
> and this record stays `lifecycle:in-progress`.
