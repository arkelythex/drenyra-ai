# Archive Report — fiscal-authority-kernel

> Change: `fiscal-authority-kernel` · Phase: archive · Store: openspec
> Archive status: **PASS**
> Archived to: `openspec/changes/archive/2026-08-15-fiscal-authority-kernel/`

## Structured status (consumed)

```yaml
schemaName: spec-driven
changeName: fiscal-authority-kernel
artifactStore: openspec
changeRoot: openspec/changes/fiscal-authority-kernel (archived)
artifacts:
  exploration: done
  proposal: done
  specs: done (6 specs: tenant, evidence, journal, candidate-ordering, policy, cdr-validation — 41 requirements, 61 scenarios)
  design: done
  tasks: done (100/100 complete)
  applyProgress: done
  verifyReport: done (gentle-ai.verify-result/v1 envelope; verdict pass, 0 blockers)
  archiveReport: done (this file)
applyState: complete
verifyState: complete
archiveState: complete
```

## What was delivered

The fiscal authority kernel — the deterministic authority layer required before later ingestion and SUNAT-facing programs:

- **Tenant core** (slice 1A): tenant-scoped stores, authority model.
- **Evidence authority** (slice 1B): `AcceptedEvidence` surface with tenant binding and boundary coverage (PR #15).
- **Journal lifecycle** (slice 1C): accounting journal with BigInt-cent validation, receipt-issuing post, supersede and revoke, ledger boundary (PR #19).
- **Candidate ordering** (slice 1D): candidate-ordering adapter with validation, reconciliation, and exact subject lifecycle; frozen-candidate contract preserved (PR #20).
- **PE policy + CDR composition** (slice 1E): PE restriction policy with mandatory composition order; successor mission composition with gates and reconciliation (PR #21).
- **Tracker integration** (PR #14): feature-branch chain merged to main `eb2e930`; full suite 774 green; conformance frozen unchanged.

## Delivery

- Feature-branch chain: PR #14 (tracker, merged to main) ← #15 ← #19 ← #20 ← #21 (slices 1B–1E). All merged 2026-08-13.
- Post-apply bounded reviews: **not applicable** — RDD off clone-local (immutable review transport unsupported in this runtime); delivered under Git-normal policy.

## Final state

- 100/100 tasks complete; 41/41 requirements and 61/61 scenarios satisfied; suite 774/774 and typecheck green (output hashes bound in the verify envelope).
- Frozen contracts have no normative delta; conformance vectors unchanged.
- This change is the fiscal authority foundation consumed by the Dominion program: it satisfies Gate 0 row 1 inventory item `fiscal-authority-kernel` (verification complete, E-004).

## Follow-ups (NOT part of this change)

- `bounded-agent-roles` state refresh from its owning repository (unverified from this clone, gate-0.md §1).
- Later ingestion and SUNAT-facing programs build on this kernel per the 16-program Peru v1 roadmap.

## Final verdict

**PASS** — change complete and archived; 100/100 tasks, 41/41 requirements, 61/61 scenarios; suite 774/774 and typecheck green; no blockers.
