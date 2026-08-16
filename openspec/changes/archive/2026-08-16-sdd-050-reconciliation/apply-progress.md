# Apply Progress — SDD-050 Reconciliation (Engine + Wiring Surface)

Change: `sdd-050-reconciliation` (OpenSpec, file-backed)
Phase: apply (docs-only)
Status: **success** — all implementation-owned tasks (phases 1–2) complete.

## Structured status consumed

- Artifact store: `openspec` (file-backed under `openspec/changes/sdd-050-reconciliation/`).
- Delivery decision: recorded in tasks.md Review Workload Forecast — `Decision needed
  before apply: No`; single-pr (docs-only); chain strategy n/a. No parent decision required.
- Strict TDD: N/A (docs-only change; no behavior added — verification is readback + gates).

## Completed tasks (persisted checkboxes updated in tasks.md)

### Phase 1 — SDD-050 record reconciliation

- **Baseline frozen:** `bun run test` 1362 green / 1 pre-existing release-integrity
  flake (SBOM fidelity timeout, passes 13/13 isolated — unrelated to flow/);
  `bun run typecheck` EXIT 0; `bun run build` EXIT 0. Protected paths confirmed:
  `contracts/**`, `openspec/changes/archive/**`, non-allowlisted program root docs.
- **Surface mapping extended** (`openspec/programs/drenyra-dominion/sdds/sdd-050-monthly-close/README.md`):
  - "Candidate generation through RDA v2" row now records engine-generated candidates
    via `flow/close-wiring.ts` (`reconciliationToProposals`, `closeEntriesToProposals`)
    when `bankRows`/`ledgerRows`/`closeInputs` are supplied, external-first merge.
  - New row: **Bank reconciliation engine (SDD-CON-001)** — `bank-reconciliation/`
    (normalizeBankRows, normalizeLedgerRows, reconcile, buildAdjustments, buildReport)
    - `pe.conciliacion-bancaria`; evidence suite 1363/1363, 65 tests.
  - New row: **Monthly close calculations engine (SDD-CON-002)** — `close-calculations/`
    (computeDepreciation, computeProvisions, computeProvisionalIsr LIR Art. 85,
    closeResultAccounts, buildCloseReport) + 4 skills; evidence suite 1363/1363, 63 tests.
- **Evidence revision updated:** closure evidence axes now cite PR #64 tip suite
  1363/1363 as an additional `verified-revision-bound` re-confirmation; `lifecycle:complete`
  KEPT (core remains complete — this records additional implemented surface, not a new claim).
- **Gaps section confirmed accurate:** connectors → SDD-110, professional UI → SDD-100,
  multi-operator → SDD-060 remain follow-up slices; nothing unimplemented added.

### Phase 2 — Verification

- Gates: `bun run test` green (minus known flake), `bun run typecheck` EXIT 0,
  `bun run build` EXIT 0; protected paths unchanged except the SDD-050 record;
  no capability claimed beyond evidence; `lifecycle:complete` kept.
- Readback: the record's new rows cite real exported symbols (verified against
  `bank-reconciliation/index.ts`, `close-calculations/index.ts`, `flow/close-wiring.ts`)
  and real test files.

## Files changed (this run)

- `openspec/programs/drenyra-dominion/sdds/sdd-050-monthly-close/README.md` (modified)
- `openspec/changes/sdd-050-reconciliation/proposal.md`, `tasks.md`,
  `apply-progress.md`, `verify-report.md` (change record)

## Deviations

None. Docs-only reconciliation followed the `vertical-closures` precedent exactly.
