# Vertical Closures — SDD-050/060/070/080/090 Reconciliation

> Change: `vertical-closures` · Type: docs-only closure/reconciliation
> Status: proposal

## Intent

Reconcile the five vertical SDD records against the implemented surface (following the SDD-040 pattern). **SDD-050 closes** (`lifecycle:complete` — its deterministic local monthly-close vertical is verifiably implemented and tested); **SDD-060/070/080/090 stay `lifecycle:active`** (real implemented cores, but their declared cores are incomplete — R3/R4 forbid promotion).

## Per-SDD outcome

| SDD | Implemented core (real symbols) | Gaps (documented, NOT implemented) | Lifecycle |
| --- | --- | --- | --- |
| 050 Monthly Close | `flow/close.ts runMonthlyClose`, `AdapterRegistry`/`LocalFileAdapter`, e2e + unit tests | Real ERP/SIRE/bank connectors → SDD-110; professional-validation UI → SDD-100 | **complete** (core) |
| 060 Multi-Operator | `tenant-core/validateTenantScope`, `tenant-isolation/assertTenantReadScope` | RBAC/ABAC + segregation of duties (W3 governance wording already in the record) | active |
| 070 Skills | `SkillRegistry`, `computeSkillChecksum`, `isSkillInForce`, `BASE_PE_SKILLS` | Signing/vigencia/pinning/rollback (W3 wording in the record); **wording correction: `skills:conformance` is a vitest suite, not a CLI command** | active |
| 080 Engram | `evidence/identity/types.ts MEMORY_SHAPED_MARKERS` boundary only | Federated integration; core spans sibling `drenyra-engram` (unverifiable from this clone → awaiting evidence) | active |
| 090 Guardian | `guardian/runGuardianReview` (verdict "none", findings only) | Dual refutation, full integration (W3 wording in the record) | active |

## Scope

- SDD-050 record: lifecycle → complete (core) with implemented-surface mapping + evidence; checklist updated.
- SDD-060/070/080/090 records: reconciliation notes recording the implemented core, the gaps as follow-up slices, and (070) the `skills:conformance` wording correction. No lifecycle promotion.
- Change record: proposal, tasks, apply-progress.

## Non-goals

- NO new code, NO contract changes, NO connector/RBAC/signing/federation/refutation implementation.
- NO lifecycle promotion for 060/070/080/090 (R3/R4).
- Suite stays 843/843; protected paths unchanged; 12-SDD invariant.

## Acceptance

- Suite 843/843, typecheck green, protected paths unchanged.
- Each record states its implemented core + gaps truthfully; no capability claimed beyond evidence.
