# Archive Report — sdd-040-rda-v2 (RDA v2 core closure)

> Change: `sdd-040-rda-v2` · Phase: archive · Store: openspec
> Archive status: **PASS** (RDA v2 core closed; deferred vocabularies documented)
> Archived to: `openspec/changes/archive/2026-08-15-sdd-040-rda-v2/`

## Structured status (consumed)

```yaml
schemaName: spec-driven
changeName: sdd-040-rda-v2
artifactStore: openspec
changeRoot: openspec/changes/sdd-040-rda-v2 (archived)
artifacts:
  exploration: done
  proposal: done
  specs: done (specs/rda-v2/spec.md — 6 requirements, 14 scenarios)
  design: not-required (docs-only closure)
  tasks: done (14/14 implementation + 2 parent gates)
  applyProgress: done
  verifyReport: done (gentle-ai.verify-result/v1 envelope; verdict pass, 0 blockers)
  archiveReport: done (this file)
applyState: complete
verifyState: complete
archiveState: complete
```

## What was closed

SDD-040 (RDA v2 — receipt-driven accounting authority) formal closure, docs-only:

- **Implemented-surface mapping (R1):** every declared scope area and RDA v2 invariant (authority-model §5, §5.8) mapped to the implemented surface with revision-bound evidence — `CandidateLifecycle` R0–R3, `SignedReceipt`/Ed25519, `validateLedger`, `GateRunner`, UNKNOWN recovery (`reconcileExternalCall`/`recoveryAction`/`decideUnknownRecovery`/`replayMission`), 4R + judgment-day review, journal, evidence, fiscal/policy/cdr, tenant-core, `runMonthlyClose`. Evidence: fiscal-authority-kernel archive (41/41, 61/61, 774/774 at `4975f4f`); suite 843/843 at main.
- **Five gaps as documented non-goals (R2):** receipt claim types (4 implemented vs 7 declared), review lenses (4R vs 8 fiscal-domain), candidate identity cardinality (compact 3-element key vs 13-field envelope), capacity ceilings not a first-class module, EXECUTION/RECONCILIATION claim pair not surfaced as distinct receipt symbols — each deferred with reasons.
- **Record closure (R3):** `sdds/sdd-040-rda-v2/README.md` → `lifecycle:complete` (RDA v2 core) per R3/R4 (every closure criterion verified). Dependency reconciled: `Depends on: SDD-030` (direct routed-candidate dependency), `SDD-010` prerequisite authority, feeds SDD-090/SDD-050.
- **No scope expansion (R4/R5):** `contracts/` byte-identical, zero code delta, SDD-050/090 stay `lifecycle:planned`, suite stays 843/843, protected paths zero delta, 12-SDD catalog intact.

## Delivery

- **Single PR** (docs-only, well under the 400-line cap): #42.
- Post-apply bounded review: **not applicable** — RDD off clone-local (immutable review transport unsupported); Git-normal policy precedent.

## Final state

- SDD-040 record: `lifecycle:complete` (RDA v2 core) · maturity `implemented`.
- Suite 843/843 and typecheck/build green (output hashes bound in the verify envelope).
- The RDA v2 core is the implementation seed for SDD-050 (monthly close) and SDD-090 (guardian), which remain `lifecycle:planned`.

## Follow-ups (documented non-goals, NOT part of this change)

1. Receipt claim-type vocabulary expansion (7 types) when a consumer requires it.
2. Fiscal-domain review lenses (8) beyond the 4R code set.
3. Canonical candidate identity (13-field envelope) when cross-system identity requires it.
4. First-class capacity ceilings.
5. EXECUTION/RECONCILIATION receipt symbols.

## Final verdict

**PASS** — SDD-040 (RDA v2 core) closed and archived; 6/6 requirements, 14/14 scenarios; suite 843/843 unchanged; no blockers.
