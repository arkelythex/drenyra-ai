---

# SDD-080 — Engram Institutional Memory

> Status: lifecycle:active · Maturity: partial (non-authorization boundary implemented; sibling core awaiting evidence) · Wave: 2 · Depends on: SDD-010 · Feeds: SDD-050

## Purpose

Delivers useful, persistent institutional memory — prior decisions and context —
that informs missions but never authorizes governed actions. Serves the ecosystem
through `drenyra-engram`, whose repository-verifiable capabilities include
scope-first storage, immutable evidence copies, professional memory review, and
integrity receipts. None of those capabilities transfers fiscal authority to Engram.

## Scope

- Scope-first SQLite store (implemented).
- EvidenceObject WORM records, ed25519 receipts, and offline verification
  (implemented).
- CLI, HTTP, and MCP interfaces (partial → complete).
- Lifecycle/vigencia and provenance tracking (implemented).
- Non-authorization boundary: AccountingMemory informs but never authorizes a
  governed action (implemented).
- Cross-tenant isolation (implemented).
- Audit register closure (active change in the capability matrix).

## Terminology and authority boundary

| Concept | Meaning |
| --- | --- |
| `AccountingMemory` | Institutional context that may inform a mission but never proves or authorizes a governed action. |
| `EvidenceObject` | An immutable Engram copy of an external artifact. Its authoritative origin remains the external source. |
| `approveMemory` | Professional review of an institutional memory, never authorization of a fiscal action. |
| Engram `SignedReceipt` | Integrity proof for an act performed inside Engram, including stored content or memory review. |
| `drenyra-ai` receipt | The authoritative result of a governed operation. |
| Fiscal authorization | Exclusively belongs to `drenyra-ai` and the enabled professional. |

**Constitutional rule:** Engram MAY certify what it stored and who reviewed a
memory; it MUST NOT authorize journal entries, payments, declarations, fiscal
closes, SUNAT actions, or any other governed fiscal operation.

## Non-goals

- `AccountingMemory` is never authoritative evidence and never fiscal approval;
  only the verified external source and the governing authority can prove or
  authorize a governed operation.
- Engram does not own fiscal authority state or fiscal decision logic. Its
  `SignedReceipt` integrity proofs are not `drenyra-ai` operation receipts.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | provides — interface and compatibility contract for memory services |
| SDD-050 | consumes — prior-decision context for the close journey (informs only) |

## Input/output contract

- Inputs: mission context, prior decisions, verified facts, and external
  artifacts copied as `EvidenceObject`s.
- Outputs: queryable institutional memory with provenance and lifecycle/vigencia,
  immutable artifact copies, and offline-verifiable Engram integrity receipts.
  Consumers MUST retain the external source as the authority for copied evidence.

## Threats

- `AccountingMemory` accepted as authoritative evidence by any surface.
- An `EvidenceObject` copy mistaken for its external authoritative source.
- Cross-tenant leakage of fiscal context.
- Memory drift or forged provenance.
- Authorization smuggling through recalled state, `approveMemory`, or an Engram
  `SignedReceipt`.

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

- **Non-authorizing context:** `AccountingMemory` provides prior decisions and
  context that inform missions; it never authorizes them and is never treated as
  authoritative evidence or fiscal approval on any surface.
- **Separation of authority:** Engram has no fiscal authority state or fiscal
  decision logic. It may retain `EvidenceObject` copies, professional memory
  approvals, and integrity `SignedReceipt`s, but those records never replace the
  external source or a `drenyra-ai` governed-operation receipt.
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
