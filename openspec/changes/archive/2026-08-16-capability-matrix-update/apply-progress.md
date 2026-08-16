# Apply Progress — Capability Matrix Update (PR #64 Surface)

Change: `capability-matrix-update` (OpenSpec, file-backed)
Phase: apply (docs-only)
Status: **success** — all implementation-owned tasks (phases 1–2) complete.

## Structured status consumed

- Artifact store: `openspec` (file-backed under `openspec/changes/capability-matrix-update/`).
- Delivery decision: single-pr (docs-only); `Decision needed before apply: No`.

## Completed tasks

### Phase 1 — Capability matrix update

- **Start state confirmed:** drenyra-ai capabilities block ended at the SDD-010
  checkpoint (`d440203`, `tests.current: 915`); no engine/wiring/authorization rows.
- **Five capability rows added** (`capability-matrix.yaml` drenyra-ai block):
  - `bank-reconciliation: implemented` (65 tests)
  - `close-calculations: implemented` (63 tests)
  - `close-vertical-wiring: implemented` (30 tests)
  - `authorization-enforcement: implemented` (27 gate + 60 engine tests)
  - `pe-skills-registry: implemented` (11 BASE_PE_SKILLS, conformance PASS)
- **`tests.current` updated** to `1390` with revision-bound evidence (PR #64 tip,
  99 files, exit 0; 1 pre-existing release-integrity flake passes 13/13 isolated),
  superseding 010E-002 915/915 at d440203.
- **Sibling rows untouched** (command-center/pi/engram remain
  historical-snapshot/awaiting-evidence per R13); YAML parses clean.

### Phase 2 — Verification

- Readback: every new row maps to a real exported symbol/test file at the PR #64
  tip (verified against bank-reconciliation/, close-calculations/, flow/close-wiring.ts,
  gates/authorization.ts, skills/pe.ts); `tests.current` matches the fresh run;
  temporal class stated per R6/R13; no capability claimed beyond evidence.

## Files changed (this run)

- `openspec/programs/drenyra-dominion/capability-matrix.yaml` (modified)
- `openspec/changes/capability-matrix-update/proposal.md`, `tasks.md`,
  `apply-progress.md`, `verify-report.md` (change record)

## Deviations

None. Docs-only program reconciliation following the established precedent.
