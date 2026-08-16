# Capability Matrix Update — PR #64 Surface (drenyra-ai)

> Change: `capability-matrix-update` · Type: docs-only program reconciliation
> Status: proposal

## Intent

Refresh the drenyra-ai capability rows in the Dominion capability matrix
(`openspec/programs/drenyra-dominion/capability-matrix.yaml`) to reflect the
surface shipped in PR #64 (conciliacion-bancaria, cierre-mensual,
close-vertical-wiring, sdd-060 authorization enforcement), with revision-bound
evidence per rules R6/R13 and the five-axis temporal-class vocabulary. The
matrix's drenyra-ai `capabilities` block currently ends at the SDD-010
checkpoint (`d440203`, 915 tests) and predates the engines, the wiring, the
AuthorizationGate, and the new PE skills.

## What changed in the implemented surface (PR #64, revision-bound)

| Capability | Matrix row (proposed) | Evidence |
| --- | --- | --- |
| Bank reconciliation engine | `bank-reconciliation: implemented` | `bank-reconciliation/` (types/normalize/compare/adjust/report, 65 tests) at PR #64 tip |
| Monthly close calculations engine | `close-calculations: implemented` | `close-calculations/` (depreciation/provisions/isr/close-results/report, 63 tests) at PR #64 tip |
| Monthly close vertical wiring | `close-vertical-wiring: implemented` | `flow/close-wiring.ts` converters + `MonthlyCloseInput` engine inputs (30 tests) at PR #64 tip |
| Authorization enforcement | `authorization-enforcement: implemented` | `gates/authorization.ts` `AuthorizationGate` (27 tests) + `authorization/` engine (60 tests) at PR #64 tip |
| PE skills registry (11) | `pe-skills-registry: implemented` | `BASE_PE_SKILLS` 11 entries, `skills:conformance` PASS at PR #64 tip |
| Test count | `tests.current: 1390` | fresh run at PR #64 tip, 99 files, exit 0 (1 pre-existing release-integrity flake passes 13/13 isolated) |

## Scope

- `capability-matrix.yaml` drenyra-ai block: add the five capability rows, update
  `tests.current` to 1390 with revision-bound evidence, and note the PR #64 tip
  revision in the block's evidence metadata.
- Change record: proposal, tasks, apply-progress, verify-report.

## Non-goals

- NO code, NO contract changes, NO lifecycle promotion of any SDD.
- No changes to sibling-repo rows (command-center/pi/engram facts remain
  historical-snapshot/awaiting-evidence per R13 — unverifiable from this clone).
- No changes to `status-and-evidence.md` (W1-owned) or archived records.

## Acceptance

- YAML parses; drenyra-ai capability rows match the implemented surface;
  `tests.current` cites the revision-bound PR #64 tip run; sibling rows untouched;
  no capability claimed beyond evidence; temporal class stated per R6/R13.
