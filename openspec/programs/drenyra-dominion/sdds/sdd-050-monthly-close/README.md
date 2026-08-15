---

# SDD-050 — Peruvian Monthly Close

> Status: lifecycle:complete (monthly-close core, closure 2026-08-15) · Maturity: implemented · Wave: 3 · Depends on: SDD-040, SDD-070, SDD-080 · Feeds: SDD-060

## Purpose

The first complete vertical: takes ERP exports, SIRE reports, and bank statements
through preflight, normalization, reconciliation, and exceptions, then generates
candidates that pass Guardian review and R0–R3 decisions, authorized execution,
and a verifiable Close Package. This is the conquest that defines Drenyra v1.

## Scope

- Evidence import: ERP exports, SIRE reports, bank statements (adapter
  capabilities planned under SDD-110; evidence lifecycle and journal lifecycle
  slices in progress in `drenyra-ai`).
- Preflight, normalization, and reconciliation; exception surfacing with typed
  causes and continuations.
- Candidate generation through RDA v2 (SDD-040): freeze → tier → review →
  gates → authorized execution with UNKNOWN reconciliation.
- Guardian Angel review (SDD-090) over the frozen close candidates.
- Close Package receipt and audit-ledger records.
- PE policy/CDR composition (in-progress slices 1D/1E) and skills pinned to the
  close period (SDD-070).

## Non-goals

- Drenyra AI never becomes an ERP, bank, or primary accounting ledger.
- No fiscal data crosses tenants without full context.
- Engram memory informs the close but is never accepted as evidence.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-040 | provides — freeze/review/gate/execution mechanics and receipt types |
| SDD-070 | provides — versioned fiscal skills and policies pinned to the period |
| SDD-080 | provides — institutional memory context for the close (informs only) |
| SDD-060 | consumes — the close runs for firms and internal teams via the multi-operator plane |
| SDD-100 | coordinates — Close Package and Evidence Room are projected in Command Center |

## Input/output contract

- Inputs: ERP exports, SIRE reports, bank statements; pinned skills and policies
  (SDD-070); memory context (SDD-080).
- Outputs: a verifiable monthly close — Close Package receipt, audit-ledger
  entries, exception reports, and full evidence chain.

## Threats

- Evidence gaps producing assumption instead of wait/block.
- UNKNOWN external responses misclassified as success or failure.
- Skill/policy vigencia violations during the close.
- Altered or forged evidence; cross-tenant leakage; memory accepted as evidence.

## Tests and metrics

- End-to-end close journey from evidence import to Close Package.
- Exception handling and reconciliation correctness.
- Adversarial scenarios: altered evidence, duplicate operations, blind retries.
- Receipt-chain integrity across the close (Review → Approval → Authorization →
  Execution → Reconciliation → Close package).

## Rollback

- Per-vertical reverse-order rollback; Close Package receipts are preserved.
- Historical receipts are never rewritten; recovery never duplicates operations.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Closure — 2026-08-15 (monthly-close core)

> Change: `vertical-closures` (documentation-only closure). Evidence axes
> (per `openspec/programs/drenyra-dominion/status-and-evidence.md`): lifecycle
> `complete` (deterministic local monthly-close core) · evidence
> `verified-revision-bound` · temporal class `current-claim`. Closing this record
> does NOT close SDD-060/070/080/090 or SDD-100; those records remain
> `lifecycle:active`.

### Surface-to-scope mapping (R1)

Every declared scope area belonging to the deterministic local close core maps to
an implemented, exported, tested symbol. Evidence anchor: suite **843/843 (64
files, `bun run test`) re-confirmed at `6a7f0f7`** (branch
`docs/constitutional-closure`, this working tree), building on the routed-candidate
baseline `57ea56a` → `9b8aa1c` recorded in the SDD-040 closure; typecheck clean
(`tsc --noEmit`); protected paths zero-delta.

| Scope area | Implemented surface | Evidence |
| --- | --- | --- |
| Preflight (checksummed RUC + `isValidPeriod`) | `runMonthlyClose` (`flow/close.ts`) — fails closed on invalid RUC/period | suite 843/843 at `6a7f0f7`; `flow/__tests__/close.test.ts` |
| Evidence collection via adapters; absence never zero | `AdapterRegistry` over `REQUIRED_EVIDENCE_SYSTEMS` (`adapters/registry.ts`), `EvidenceAdapter` interface, `LocalFileAdapter` (`adapters/local.ts`); missing evidence returns `waiting-for-evidence` | suite 843/843; `flow/__tests__/close.test.ts` |
| Candidate generation through RDA v2 | `CandidateLifecycle.propose` (`candidates/lifecycle.ts`, SDD-040 core) | suite 843/843 |
| Guardian review per candidate | `runGuardianReview` per candidate (`guardian/guardian.ts`, SDD-090 slice); blockers surfaced as risks, receipt skipped | suite 843/843 |
| Close Package receipt + audit ledger | `buildSignedReceipt` (IGV skill version noted) + `validateLedger`; `ClosePackage { status, scope, sourcesUsed, sourcesMissing, candidates, guardianReports, receipts, ledgerValid, risks }` | suite 843/843; `flow/__tests__/close.test.ts` |
| E2E close journey | `missions/__tests__/e2e-monthly-close.test.ts` — mission → candidates → receipt → ledger with evidence-gated execution | suite 843/843 |
| Package export | `flow/index.ts` (`export * from "./close.js"`) | — |

### Gaps as follow-up slices (R2)

Each gap between the SDD-050 declaration and the implemented surface is an
explicit non-goal of this closure — a follow-up slice, not a missing capability
of the deterministic local close core:

1. **Real ERP/SIRE/bank connectors.** Only `LocalFileAdapter` + `AdapterRegistry`
   exist; no live connector. Follow-up slice: SDD-110.
2. **Professional validation surface.** R0–R3 decisions are implemented as gates
   (`ApprovalGate`, `distinctApprovers`, `GateRunner`) and Guardian findings, but
   the human professional decision/confirmation UI is Command Center territory.
   Follow-up slice: SDD-100.
3. **PE policy/CDR composition.** `pe-policy`/`cdr` exist (partial per capability
   matrix; slices 1D/1E in progress in `fiscal-authority-kernel`) — not a blocker
   for the deterministic local close core; tracked by that active change.

### Lifecycle and evidence (R3)

- `lifecycle:complete` (deterministic local monthly-close core) is recorded ONLY
  because every closure criterion verifies at `6a7f0f7` (this working tree):
  (1) the surface maps to the declared core with revision-bound evidence (table
  above); (2) the gaps are recorded as follow-up slices / non-goals; (3) the suite
  stays exactly 843/843 (64 files, `bun run test`); (4) protected paths unchanged
  (`contracts/**`, `openspec/changes/archive/**`, non-allowlisted program root
  documents — zero delta).
- Lifecycle is NOT derived from implementation maturity alone (status-and-evidence
  rule R3) and NOT marked complete on documentary presence alone (rule R4).
- Evidence axes: lifecycle `complete` (monthly-close core) · evidence
  `verified-revision-bound` (`57ea56a` 843/843 routed baseline; `9b8aa1c` SDD-040
  closure re-confirmation; `6a7f0f7` this closure re-confirmation) · temporal
  class `current-claim`.
- Closing SDD-050 does NOT close SDD-060/070/080/090 or SDD-100; SDD-060 still
  consumes the close capability.

### Dependency reconciliation (R3)

- Dependencies unchanged: SDD-040 provides the RDA v2 mechanics, SDD-070 provides
  pinned skills, SDD-080 provides memory context (informs only). Closing this
  record does NOT close those records.

## Progress

- [x] Exploration — `openspec/changes/vertical-closures/explore.md` (implemented-core inventory with real symbols + closure recommendation)
- [x] Proposal — `openspec/changes/vertical-closures/proposal.md` (per-SDD outcome table)
- [x] Specification (RFC 2119 + Given/When/Then) — closure criteria verified against the declared scope in `openspec/changes/vertical-closures/tasks.md`; docs-only closure adds no contract surface
- [x] Design — SDD-040 closure pattern (`sdds/sdd-040-rda-v2/README.md`) applied to the implemented surface (revision-bound `6a7f0f7`)
- [x] Tasks (vertical TDD units) — `openspec/changes/vertical-closures/tasks.md` (docs-only closure tasks; zero unchecked implementation tasks after apply)
- [x] Apply (strict TDD) — `openspec/changes/vertical-closures/apply-progress.md` (closure batch)
- [x] Verification report — Phase 2 verification: suite 843/843 (64 files) at `6a7f0f7`, typecheck clean, protected paths unchanged, 12-SDD invariant (change-level verify-report is a parent-owned post-apply gate)
- [x] Archive report — parent-owned post-apply gate for `vertical-closures` (single-PR delivery + archive)
