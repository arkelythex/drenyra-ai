# Archive Report — sdd-110-production (Option A: Connector-Adapter Conformance, slice A)

> Change: `sdd-110-production` · Phase: archive · Store: openspec (artifacts) + engram (archive
> report) · Branch: `feat/sdd-110-connector-conformance` · Implementation commit: `5c50b9d`
> (parent `27dfd03`) · Merged: `602f524` via PR #59 · Archive date: 2026-08-15
>
> **Archive status: PASS.** Implementation verification PASS 9/9 requirements (REQ-CONN-001..009)
> and 20/20 scenarios (SC-CONN-001..020) with zero code findings; both artifact-state CRITICAL
> findings (F1 stale checkboxes, F2 missing TDD table) remediated by the orchestrator; all
> implementation task checkboxes confirmed complete; no destructive merge (no canonical specs tree
> exists — full domain spec preserved as-is).

## Executive summary

This change delivered the **first drenyra-ai-side slice for SDD-110 (Production and Commercial
Readiness)**: the transport-agnostic **connector-adapter conformance contract** (`contracts/
connector-adapter.md`, DRAFT v0.1) plus a node:crypto-only type-level mutation surface
(`adapters/connector.ts`) and an in-memory mock conformance suite
(`adapters/__tests__/connector-conformance.test.ts`). It pins the Core semantics a future
restricted ERP, SUNAT/SIRE, bank, e-invoicing, or document connector MUST satisfy — idempotent
execution, UNKNOWN reconciliation, tenant scope isolation, restricted authority, and evidence-bound
success — **before any real vendor integration is shipped or represented as available**.

The slice composes existing RDA primitives (idempotency, reconciliation, tenant-core, receipts)
rather than inventing parallel mechanisms. It ships **no real connectors**, makes **zero capability
claims** (R17: `DECLARED_ADAPTERS` stays `[]`, capability-matrix connector rows stay `planned`), and
leaves the fetch-only `EvidenceAdapter` / `flow/close.ts` (SDD-050) surfaces untouched. The contract
remains **DRAFT** despite CI conformance coverage, following the `brand-system` precedent: the
conformance suite controls drift now; ecosystem adoption and explicit approval are required before
freezing.

Implementation, tests, and export wiring were delivered as one cohesive PR and merged on `main` at
`602f524` (PR #59). All gates are green: suite **1010/1010**, typecheck **0 errors**, build **OK**,
lint clean, CI **6/6**.

## Final state

- **What shipped:** DRAFT v0.1 `connector-adapter` contract document; `adapters/connector.ts`
  (public DRAFT surface — `ConnectorCapability`, `ConnectorExecuteRequest`/`ConnectorExecuteInput`
  branded scope, `ConnectorExecuteResult` SUCCESS|UNKNOWN only, `ConnectorAdapter`,
  `ConnectorAdapterDependencies`, `ConnectorAdapterFactory`, `ConnectorValidationError` with the
  closed D7 code union, and fail-closed request/authority/scope/result validators); the in-memory
  `MockConnectorAdapter` conformance suite (29 tests / 88 assertions covering SC-CONN-001..020);
  barrel export in `adapters/index.ts`; DRAFT index row in `contracts/README.md`.
- **Commit / PR:** implementation committed at `5c50b9d`; merged on `main` at `602f524` via PR #59
  (`feat(adapters): connector-adapter conformance surface for restricted connectors (SDD-110 slice A)`).
- **Reused primitives (never reimplemented):** `canonicalHash`/`IdempotencyStore`/
  `isValidIdempotencyKey`/`isVerifiableEvidence` via the missions barrel, `reconcileExternalCall`
  unchanged, `validateTenantScope`/`sameTenantScope` via the tenant-core barrel, and
  `ReceiptType.EXTERNAL_SUBMISSION` (Core owns receipt construction; the adapter never mints).
- **Rollback:** additive and low risk — remove the DRAFT document, `adapters/connector.ts`, the mock
  suite, and the two exports as one unit; no connector mutation, credential, production state,
  journal entry, or historical receipt was created.

## Requirements verification summary

**PASS — 9/9 requirements (REQ-CONN-001..009) verified with concrete test evidence; all 20 scenarios
(SC-CONN-001..020) covered; zero code findings; zero WARNINGs.**

| Verdict | Detail |
| --- | --- |
| PASS | REQ-CONN-001..009 all PASS with direct test evidence (see verify-report requirement mapping) |
| Gates | `bun run test` 1010 passed / 0 failures (71 files; +29 from baseline 981) · `bun run typecheck` 0 errors · `bun run build` OK · biome lint clean · CI 6/6 |
| TDD compliance | Implementation PASS; both artifact-state CRITICALs (F1 stale checkboxes, F2 missing TDD table) remediated by the orchestrator before archive |
| Test layer | Unit-only (29 tests, 1 file) — correct layer for an in-memory conformance suite with no UI/HTTP/browser surface |

Requirement families verified: idempotent execute (replay / `IDEMPOTENCY_CONFLICT` / concurrent
fail-closed), UNKNOWN outcome honesty, reconciliation mapping (record/retry/human-intervention),
scope isolation, evidence-bound success bound to `EXTERNAL_SUBMISSION`, restricted authority,
node:crypto-only with no I/O, DRAFT status with no capability claims, and the CI drift gate.

## Deliverables inventory

| Artifact | File / topic | Status |
| --- | --- | --- |
| Exploration | `explore.md` (Option A sizing, gap analysis) | read |
| Proposal | `proposal.md` (Option A rationale, non-goals, tradeoffs) | read |
| Specification | `spec.md` (REQ-CONN-001..009, SC-CONN-001..020, full domain spec) | read |
| Design | `design.md` (decisions D1–D7, module layout, strict-TDD test plan) | read |
| Tasks | `tasks.md` (8 TDD units, gates, acceptance mapping, review workload forecast) | read |
| Apply progress | `apply-progress.md` (canonical TDD Cycle Evidence table, deviations, size-exception record) | read |
| Verify report | `verify-report.md` (PASS 9/9 + 20/20; CRITICAL F1/F2 closed) | read |
| Archive report | `archive-report.md` (+ engram `sdd/sdd-110-production/archive-report`) | written |
| SDD program record | `openspec/programs/drenyra-dominion/sdds/sdd-110-production/README.md` | read; stays `lifecycle:in-progress` |

## Deviations & decisions

1. **Size exception (accepted).** 1043 changed lines (git counts 1042 = 1041 insertions + 1
   deletion; one-line EOF-newline bookkeeping difference) vs the 318–370 forecast and the 400-line
   hard cap (~2.6×). Accepted by the orchestrator per the documented maintainer-reset precedent
   (SDD-100 slice A at 425 lines; SDD-020 slices at 768–788). Root cause: the design forecast
   undercounted mandated REQ-CONN/SC-CONN coverage with real (non-trivial) assertions plus the mock
   driver and DRAFT doc — inherently ~1000 lines. Documented in the commit message and PR #59; no
   safety vector was weakened and no scope was silently added (5 files = design file map). Delivered
   as a single cohesive PR honoring the Review Workload Forecast (`exception-ok` /
   `size:exception`, `Decision needed before apply: No`).
2. **Empty `missionId` maps to `INVALID_IDEMPOTENCY_KEY`.** The D7 error vocabulary is closed; the
   mission-ID check is grouped under that code (documented in the module).
3. **Idempotency driver is test-local.** `connector.ts` exports only the designed surface (types +
   validators); the execution driver (idempotency claim, replay, mutation hook) is owned by the mock
   and by future connector implementations.
4. **Structural probe uses `node:fs` in the TEST.** `connector-conformance.test.ts` uses
   `readFileSync` for the static import probe (matches the `registry.test.ts` precedent; `?raw`
   imports fail `tsc --noEmit`). `connector.ts` itself imports zero Node built-ins — hashing flows
   through the missions barrel.

## Findings resolution

- **F1 (CRITICAL) — Unchecked implementation task markers.** Remediated by the orchestrator: all
  33 implementation-owned `- [ ]` markers in `tasks.md` are now `[x]` (verified: 36 checked, 0
  unchecked), proven complete by apply-progress and the verify report. The 3 parent-owned lifecycle
  gates (commit/PR #59, bounded review, `sdd-verify`) are complete. **No `- [ ]` implementation task
  boxes remain.**
- **F2 (CRITICAL) — Missing TDD Cycle Evidence table.** Remediated by the orchestrator: the
  file-backed `apply-progress.md` now contains the canonical RED/GREEN/TRIANGULATE/REFACTOR table
  (T-CONN-001..008). This was an artifact-state format gap only; TDD substance was always present
  and independently verified (GREEN confirmed by the verifier via the passing suite).
- **W1 (WARNING) — Size exception executed.** Documented and accepted; no safety vector weakened, no
  silent scope addition. Actual-vs-forecast recorded above.
- **S1–S4 (SUGGESTION)** — `node:fs` probe note, constant-valued `EXTERNAL_SUBMISSION` assertion
  (D4 design choice), shared-helper hash recomputation (behavioral guard still proves no second
  mutation), and per-cycle TDD evidence — recorded as non-blocking follow-ups only.

## Non-goals respected

Verified via `git show --name-only 5c50b9d` (exactly five paths: `adapters/connector.ts`,
`adapters/__tests__/connector-conformance.test.ts`, `adapters/index.ts`,
`contracts/connector-adapter.md`, `contracts/README.md`):

- ✅ Zero changes to `missions/`, `tenant-core/`, `receipts/`, `flow/close.ts`,
  `adapters/registry.ts`, `adapters/local.ts`, `cmd/`, `capability-matrix.yaml`, or
  `.github/workflows`.
- ✅ `DECLARED_ADAPTERS` stays `[] as const`; `adapters-ERP-SUNAT-banks` stays `planned`; no
  capability-matrix promotion (R17).
- ✅ No real ERP/SUNAT/SIRE/bank/e-invoicing/document connector; no credentials, KMS, network,
  HTTP, filesystem, PostgreSQL, cloud SDK, or vendor dependency; no production storage,
  observability, pilots, or open-core gate decision; no receipt minting; no materiality decision,
  policy authority, or gate bypass; no freeze of `connector-adapter` v0.1.

## Lessons learned

- **Strict-TDD mandated coverage inflates changed-line forecasts.** The 318–370 estimate missed by
  ~2.6× because mandated REQ-CONN-001..009 / SC-CONN-001..020 coverage with real, non-vacuous
  assertions plus a mock driver and DRAFT doc cannot fit a naive implementation estimate — the same
  pattern observed in SDD-100 slice A (425 vs 300). **Future slices should size from mandated
  scenario (SC) coverage**, not from an optimistic implementation-line estimate; table-driven
  consolidation helps but does not fully offset conformance coverage.
- **Artifact-state discipline matters.** Both archive blockers (F1 unchecked boxes, F2 missing TDD
  table) were artifact-state, not code defects. Keeping tasks.md checkboxes and the canonical TDD
  evidence table updated from the start avoids archive-time reconciliation.
- **Conformance-before-adoption is the right seam.** A DRAFT contract with a CI-pinned conformance
  suite controls drift today without overstating maturity — the value only materializes when a real
  connector family actually adopts the surface (tracked below).

## Follow-ups

1. **Option B — wire `DECLARED_ADAPTERS` + flow integration.** Populate `cmd/declared-surface.ts`
   `DECLARED_ADAPTERS` and thread the connector port through `flow/close.ts` after a real connector
   exists to declare. Deferred deliberately (no connector to declare; avoids implied readiness and
   protects the SDD-050 close flow).
2. **Real connector families.** ERP, SUNAT/SIRE, bank, e-invoicing, and document connectors per
   their vendor contracts, tested against this DRAFT contract. Note the atomic-claim gap: a
   distributed production adapter needs transactional serialization/fencing beyond the in-memory
   `IdempotencyStore` (`get`/`put`, not CAS) — must be resolved before any live connector.
3. **KMS, observability, pilots, open-core gate.** Production storage, key lifecycle runbooks,
   incident/recovery runbooks, and the v1-definition pilot acceptance + open-core transition decision
   remain future SDD-110 wave-4 work.
4. **S1:** add a comment in the conformance test citing the `registry.test.ts` `node:fs` precedent.
5. **S2 (later slice):** a Core-side vector that actually constructs the `EXTERNAL_SUBMISSION`
   receipt from adapter evidence (beyond kind-compatibility assertion).
6. **S4:** persist the per-cycle TDD evidence table as part of `apply` for future strict-TDD changes.
7. **Program record:** SDD-110 stays `lifecycle:in-progress` — this slice delivers the Core seam
   only; production operations (real connectors, KMS, observability, pilots) remain pending.

## Sync / move note

This repo has no canonical `openspec/specs/{domain}/spec.md` tree — change specs are flat files under
`openspec/changes/{change}/`. Per repo convention the full domain spec is preserved as-is at archive;
no destructive canonical merge was required, so no archive-time sync fallback was needed and no
ADDED/MODIFIED/REMOVED canonical requirement changes apply.

---
*Archive performed by sdd-archive executor. All artifacts read; all implementation checkboxes confirmed
complete; verification PASS 9/9 + 20/20. Archive report persisted to engram topic
`sdd/sdd-110-production/archive-report`. No active artifacts deleted or modified.*
