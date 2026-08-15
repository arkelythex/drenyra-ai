# Apply Progress — SDD-040 (RDA v2) Closure Batch

> Change: `sdd-040-rda-v2` · Phase: apply (closure batch) · Store: openspec
> Change type: **documentation-only closure** — no production code, no tests, no
> contracts/ changes.
> Runtime attempt token (closure): `sha256:99aff3120ee11e1c0f98a53372f0de49785152ca43dd5b227f16c9653456951a`

## Phase 0 — evidence and baseline

- Inspected revision frozen: **`9b8aa1c356ed5d2b13ab95f7e6cd98e12de1f354`**, branch
  `docs/sdd030-slice-close`. Working tree at capture: only the untracked
  `openspec/changes/sdd-040-rda-v2/` change artifacts; no source file mutated
  before baseline capture.
- Green baseline captured: `bun run test` → **64 files, 843 passed / 843**, exit 0.
  No delta from the routed-candidate baseline 843/843 at `57ea56a`.
- Protected paths identified for the final check: `contracts/**`,
  `openspec/changes/archive/**` (including `2026-08-15-fiscal-authority-kernel/`),
  and non-allowlisted program root documents under
  `openspec/programs/drenyra-dominion/`. Phase 1 touches only
  `openspec/changes/sdd-040-rda-v2/*` and the allowlisted SDD-040 program record.

## Phase 1 — closure document edits

Files edited (the only non-change-directory edit is the allowlisted SDD-040
program record):

1. `openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2/README.md`
   - Header lifecycle update: `PLANNED` → `lifecycle:complete (RDA v2 core,
     closure 2026-08-15)` with `Maturity: implemented` and `Prerequisite
     authority: SDD-010`.
   - Added `## Closure — 2026-08-15 (RDA v2 core)` section:
     - **R1 surface-to-scope mapping table** — every declared scope area and RDA
       v2 invariant (authority-model §5, §5.8) mapped to implemented modules and
       symbols, with revision-bound evidence (`4975f4f` fiscal kernel envelope
       41/41, 61/61, 774/774; `57ea56a` 843/843 baseline; `9b8aa1c` closure
       re-confirmation). No scope item left unmapped.
     - **R2 five gaps as documented non-goals** — receipt claim types (4 vs 7),
       review lenses (4R + judgment-day vs 8 fiscal-domain), identity cardinality
       (3-element key vs 13-field structure), capacity ceilings (compositional,
       no dedicated matrix module), EXECUTION/RECONCILIATION receipt claim pair —
       each with a reason and the compositional mechanism, each stated as a
       deferred vocabulary/model non-goal of this closure, none claimed as a
       one-to-one symbol.
     - **R3 lifecycle and evidence** — `lifecycle:complete` recorded ONLY against
       the four closure criteria (1:1 mapping with revision-bound evidence, five
       gaps recorded, suite 843/843, protected paths unchanged); R3/R4 rules
       stated (maturity and documentary presence alone never complete a record).
     - **R3 dependency reconciliation** — `Depends on: SDD-030` retained as the
       direct routed-candidate dependency, `Feeds: SDD-090, SDD-050` retained as
       consumers, SDD-010 added as prerequisite-authority context; explicit note
       that closing SDD-040 does NOT close SDD-050/SDD-090 (both stay
       `lifecycle:planned`).
   - Dependencies table: added SDD-010 row.
   - Progress checklist: all eight items checked with per-item evidence
     annotations (each artifact exists and its evidence verifies; the closure
     change's own verify-report and archive-report are produced by the
     subsequent verify/archive phases, with the capability-level evidence
     already revision-bound).
2. `openspec/changes/sdd-040-rda-v2/apply-progress.md` — this file.

Deviations from task text (truthfulness improvements, per R1):

- Task 1.1's example listed `reconcileMission` as a UNKNOWN-reconciliation
  symbol. That symbol does not exist in the codebase (verified by grep). The
  implemented exports are `reconcileExternalCall` (`missions/reconciliation.ts`)
  plus `recoveryAction`/`decideUnknownRecovery` (`recovery/policy.ts`) and
  `replayMission` (`recovery/replay.ts`). The record maps the real symbols so no
  mapping claim references a symbol that does not exist (spec scenario
  "Mapping claims are traceable to a bound revision").

## Phase 2 — verification

All closure criteria verified at revision `9b8aa1c` (post-edit working tree):

| Check | Result | Evidence |
| --- | --- | --- |
| Suite unchanged | ✅ PASS | `bun run test` → **64 files, 843 passed / 843**, exit 0 (no delta from baseline / `57ea56a`); no test file or expectation changed |
| Typecheck | ✅ PASS | `bun run typecheck` (`tsc --noEmit`) → clean, exit 0 |
| Protected paths | ✅ PASS | `git status --porcelain contracts/` → empty; `openspec/changes/archive/` (incl. `2026-08-15-fiscal-authority-kernel/`) → empty; non-allowlisted program root docs → clean; the ONLY non-change-directory edit is the allowlisted SDD-040 record |
| Spec pass/fail R1–R6 | ✅ PASS | R1 mapping complete (every scope item/invariant → implemented symbol, revision-bound); R2 five gaps recorded as deferred non-goals with reasons; R3 record closed truthfully (lifecycle:complete only per the four criteria; R3/R4 honored; checklist per-item evidence; dependencies retained); R4 no scope expansion (843/843, `contracts/` clean, SDD-050/SDD-090 stay `lifecycle:planned`); R5 protected isolation (only allowlisted edits); R6 closure evidence reproducible from repo state. All 14 spec scenarios pass |
| 12-SDD invariant | ✅ PASS | directory enumeration per E-008: 12 SDDs by tens (SDD-000…SDD-110); SDD-050 (`Status: PLANNED`) and SDD-090 (`Status: PLANNED`) unchanged |
| Changed-line budget | ✅ PASS | closure-apply authored changes = 205 lines (90-line new `apply-progress.md` + 106 insertions / 9 deletions in the record) — under the 400-line hard cap, no split needed. NOTE (informational): the ≈80–140 forecast in tasks.md was undersized; the full single-PR docs-only change including the prior planning artifacts (explore 176 + proposal 113 + spec 161 + tasks 67) totals 722 docs-only lines — parent should confirm the single-PR boundary at delivery (no code, no contracts involved) |

**Lifecycle decision: `lifecycle:complete` (RDA v2 core)** — every closure criterion
verified (1:1 surface mapping with revision-bound evidence, five gaps recorded,
suite 843/843, protected paths unchanged). Had any criterion failed, the record
would read `lifecycle:active`.

## Workload / PR boundary

- Changed lines: docs-only, ≈140–160 additions across
  `openspec/changes/sdd-040-rda-v2/*` + the SDD-040 record — well under the
  400-line hard cap and the 300-line repo review target. No chaining.
- Delivery: single PR, `single-pr` strategy (parent-owned gate).
- Do NOT commit — the working tree retains the closure edits for the parent.

## Remaining tasks (post-apply, parent-owned)

- Start or reuse bounded review for the single SDD-040 closure candidate
  (RDD-off clone-local precedent — no review, Git-normal policy).
- Deliver the single-PR docs-only closure; update lifecycle toward
  verify/archive; archive the completed closure change. SDD-050 and SDD-090
  remain `PLANNED`.
