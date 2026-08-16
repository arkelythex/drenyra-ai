# SDD-050 Reconciliation — Engine + Wiring Surface

> Change: `sdd-050-reconciliation` · Type: docs-only closure/reconciliation
> Status: proposal

## Intent

Reconcile the SDD-050 monthly-close record against the newly implemented engine
and wiring surface, following the exact pattern of `vertical-closures` (docs-only,
revision-bound evidence, no lifecycle promotion beyond evidence). The vertical's
candidate-generation gap is now closed: where `vertical-closures` recorded
"candidates from external/synthetic proposals", the deterministic core now
generates its candidates FROM the two verified engines via the wiring layer.

## What changed in the implemented surface since the 6a7f0f7 closure

| Surface | Implemented symbols (all on `feat/conciliacion-bancaria/4-skills`, PR #64) | Evidence |
| --- | --- | --- |
| Bank reconciliation engine | `bank-reconciliation/` — `normalizeBankRows`, `normalizeLedgerRows`, `reconcile`, `buildAdjustments`, `buildReport` (+ 6 test files, 65 tests); skill `pe.conciliacion-bancaria` | suite 1363/1363 (99 files); `bank-reconciliation/__tests__/` |
| Monthly close calculations engine | `close-calculations/` — `computeDepreciation`, `computeProvisions`, `computeProvisionalIsr`, `closeResultAccounts`, `buildCloseReport` (+ 8 test files, 63 tests); skills `pe.depreciacion-activo-fijo`, `pe.provision-cartera`, `pe.isr-mensual`, `pe.cierre-resultados` | suite 1363/1363; `close-calculations/__tests__/` |
| Vertical wiring | `flow/close-wiring.ts` — `reconciliationToProposals`, `closeEntriesToProposals`, `CloseEngineInputs`; `flow/close.ts` `MonthlyCloseInput` optional `bankRows?`/`ledgerRows?`/`closeInputs?` with external-first merge + wiring risks surfaced before the candidate loop (+ 2 test files, 30 tests) | suite 1363/1363; `flow/__tests__/close-wiring.test.ts`, `flow/__tests__/close-integration.test.ts` |

## Scope

- SDD-050 record: extend the implemented-surface mapping table with the two
  engines and the wiring layer; update the "candidate generation" row to reflect
  engine-generated candidates; update the closure evidence revision (1363/1363 at
  the PR #64 tip); keep `lifecycle:complete` (the core remains complete — this
  reconciliation records additional implemented surface, not a new lifecycle
  claim).
- Change record: proposal, tasks, apply-progress, verify-report.

## Non-goals

- NO new code, NO contract changes, NO connector/RBAC/signing/federation
  implementation.
- NO lifecycle promotion for 060/070/080/090/100 (R3/R4).
- No changes to the engines or the wiring (already shipped in PR #64).
- Suite stays green; protected paths unchanged (`contracts/**`, archived change
  records, non-allowlisted program root docs — zero delta except the SDD-050
  record itself).

## Acceptance

- `bun run test` green (1362 + the pre-existing release-integrity flake which
  passes 13/13 isolated), typecheck green, protected paths unchanged.
- SDD-050 record states its implemented core truthfully; no capability claimed
  beyond evidence; gaps (connectors → SDD-110, professional UI → SDD-100,
  multi-operator → SDD-060) remain as follow-up slices.
