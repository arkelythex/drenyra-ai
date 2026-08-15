# Archive Report — dominion-program-status-reconciliation

> Change: `dominion-program-status-reconciliation` · Phase: archive · Store: openspec
> Archive status: **PASS**
> Archived to: `openspec/changes/archive/2026-08-15-dominion-program-status-reconciliation/`

## Structured status (consumed)

```yaml
schemaName: spec-driven
changeName: dominion-program-status-reconciliation
artifactStore: openspec
changeRoot: openspec/changes/dominion-program-status-reconciliation (archived)
artifacts:
  proposal: done
  specs: done (specs/dominion-program-record/spec.md — 18 requirements, 25 scenarios)
  design: done
  tasks: done (36/36 complete)
  applyProgress: done (W1 + W2 + W3 + Phase 4 records preserved)
  verifyReport: done (gentle-ai.verify-result/v1 envelope; verdict pass, 0 blockers)
  archiveReport: done (this file)
applyState: complete
verifyState: complete
archiveState: complete
```

## What was delivered

The Dominion program record was reconciled into one consistent evidence model before SDD-020:

- **W1 — vocabulary and gate:** canonical five-axis status vocabulary + attributed evidence register (`status-and-evidence.md`, W1-owned), Gate 0 re-evaluation at inspected revision `4975f4f` with an explicit **SDD-020 blocked** decision (rows 3–4 unsatisfied, no implicit waiver, R10), SDD-000/SDD-010 status reconciliation, SDD-010 evidence-precedence governance amendment.
- **W2 — composition and visibility:** capability matrix, program lock (+schema), delivery sequence, and ROADMAP reconciled against attributable evidence — 640-test checkpoint kept historical (E-006), current total 774/774 bound to revision (W2E-001), typecheck clean (W2E-002), visibility **PUBLIC** verified via `gh repo view` (E-005 + W2E-003), package version 0.2.1 + proprietary license verified (W2E-004); lock separates historical snapshot from `currentVerified` with no self-reference; sibling repositories recorded awaiting evidence.
- **W3 — governance allocation:** non-implementation governance amendments on SDD-060 (tenant-scoped least authority/segregation), SDD-070 (provenance/vigencia/pinning/rollback), SDD-080 (non-authorizing context), SDD-090 (independent adversarial findings/non-approval), SDD-110 (restricted authority/credentials/observability/incident evidence/production acceptance) — each explicitly states the capability is **not claimed to exist** (R17).
- **Phase 4 — final integration validation:** 12-SDD catalog verified, 8/8 protected-path hashes byte-identical, no non-allowlisted path changed, `bun run test` 774/774 + `bun run typecheck` clean at merged main `b4d3cbf`, R1–R18 pass/fail recorded, Gate 0 SDD-020 blocked confirmed.

## Delivery

- Chained PRs, stacked-to-main: **#27 (W1)** → **#28 (W2)** → **#29 (W3)**, all merged 2026-08-15T00:30–01:04Z; **#30 (Phase 4 record + verify report)** merged 2026-08-15T01:28Z.
- Post-apply bounded review: **not applicable** — RDD off clone-local (immutable review transport unsupported in this runtime); delivered under Git-normal policy, same precedent as the fiscal-authority kernel chain (#14–#21).
- Changed lines: W1 262, W2 165, W3 102, P4 53 — all within the 300-line review budget.

## Final state

- **SDD-020 remains BLOCKED** (gate-0.md §4) until Gate 0 rows 3–4 are satisfied: cross-repo README/license/visibility alignment directly verified (row 3) and durable attributable approval capture for the three business inputs (row 4, E-009). The decision is not reopened; no waiver is recorded.
- Exactly 12 canonical SDDs preserved; the reconciliation change itself is documented outside the canonical count.
- No product capability was implemented, renamed, merged, or removed by this change.

## Follow-ups (recorded in gate-0.md §6, NOT part of this change)

1. Capture durable attributable approval evidence for the §3 business inputs (E-009).
2. Archive `fiscal-authority-kernel` (verification complete, E-004); refresh `bounded-agent-roles` state from its owning repository.
3. Refresh sibling-repository alignment and change inventory at the next integrated checkpoint (row 3).
4. Begin SDD-020 only after Gate 0 permits it.

## Final verdict

**PASS** — change complete and archived; 36/36 tasks, 18/18 requirements, 25/25 scenarios; docs-only with suite 774/774 and typecheck green; protected paths isolated; no blockers.
