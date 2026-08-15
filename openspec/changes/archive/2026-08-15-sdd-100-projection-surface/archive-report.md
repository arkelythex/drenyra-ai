# SDD-100 Option B — Archive Report (projection DRAFT contract + CLI dump)

> Change: `sdd-100-projection-surface` · Phase: archive · Executor: sdd-archive
> Commit under archive: `7b88351` (`feat(cmd): projection contract DRAFT + 'drenyra-ai project' JSON dump (SDD-100 Option B) (#60)`)
> Parent commit (baseline): `7049fe2` · Date: 2026-08-15

## Verdict

**PASS — archive-ready.**

All 12 requirements (REQ-PB-001..012) and all 22 scenarios (SC-PB-001..022) are satisfied and
proven by the verification report and executed evidence. The single archive-only CRITICAL from
verification — 21 stale `- [ ]` checkboxes in `tasks.md` — has been closed by the parent/orchestrator
(stale-checkbox reconciliation, sed flip). No `- [ ]` implementation or gate checkbox remains.
Suite 1044/1044, typecheck 0 errors, build OK, lint clean, CI 6/6 green.

## 1. Executive summary

SDD-100 Option B delivered the second projection-surface integration slice for the SDD-100
Professional Command Center program (Peru v1, Wave 3). It shipped two additive surfaces:

1. **DRAFT transport-neutral contract** `contracts/projection.md`, v0.1, English, documenting the
   Core-owned projection payload, invariants, fail-closed behavior, and authority boundary exactly
   as the archived slice-A spec (REQ-PROJ-001..013) defines them, with conformance delegated to the
   existing slice-A suite.
2. **Read-only CLI dump** `drenyra-ai project <missionId> [--store <file>]`, which loads one
   persisted mission and emits the existing `projectMission` library result unchanged as JSON.

The projection library, its package export, its conformance suite, and the six FROZEN declared
contracts (`cmd/declared-surface.ts`) remain byte-for-byte untouched. The DRAFT is not frozen,
adopted, or consumed; the CLI is a diagnostic observation surface, never a second lifecycle
authority. Shipped as a single cohesive PR (#60), per the `exception-ok` delivery strategy.

## 2. Final state (what shipped, PR ref)

- **PR:** #60 — squash commit `7b88351`, merged to `main`, parent `7049fe2`.
- **Files (exactly 6, per `git show --name-only 7b88351`):**

  | Path | Change | Notes |
  |------|--------|-------|
  | `contracts/projection.md` | New | DRAFT v0.1 transport-neutral projection contract (11-section structure). |
  | `contracts/README.md` | Modify | DRAFT index row + status-banner clause. |
  | `cmd/commands/project.ts` | New | Parse, read mission, call projector, emit wrapped JSON, map exits. |
  | `cmd/__tests__/project.test.ts` | New | Command-layer behavior + wiring smoke (34 tests). |
  | `cmd/cli.ts` | Modify | `COMMANDS` entry, one-level dispatch branch, header/help/usage text. |
  | `cmd/commands/doctor.ts` | Modify | `project` added to CLI inventory via shared test seam. |

- **Runtime gates:** typecheck 0 errors · build OK · full suite 1044/1044 (72 files, +34) ·
  focused command suite 34/34 · lint 170 files clean · CI 6/6 green.
- **E2E smoke (built `dist` CLI):** exit 0/1/2 verified, including `--continue-to` rejection and
  malformed-store fail-closed behavior.

## 3. Requirements verification

| Coverage | Result |
|----------|--------|
| Requirements (REQ-PB-001..012) | **12/12 PASS** |
| Scenarios (SC-PB-001..022) | **22/22 PASS** |
| Code findings | 0 (1 archive-only CRITICAL bookkeeping, closed) |
| TDD compliance | 5/5 checks passed (one documented RED deviation, T-PB-003) |

## 4. Deliverables inventory

- DRAFT `contracts/projection.md` (v0.1, English, transport-agnostic, 11-part structure matching
  `connector-adapter.md`; normative surface, invariants, fail-closed behavior, conformance
  delegation, compatibility, freeze criteria, non-claims).
- `drenyra-ai project <missionId> [--store <file>]` command + command-layer test suite (34 tests).
- Contracts index entry `projection | 0.1 | DRAFT | Drenyra Command Center, Drenyra Pi, CLI`.
- CLI registration/help/usage + doctor inventory wiring.

## 5. Deviations & decisions

1. **Size exception (documented, `exception-ok`).** Actual 627 additions / 39 deletions / **588 net**
   changed lines vs 300-line budget and 400-line chaining threshold. Design estimate was ~499
   (range 413–585). Precedent: slice A 425, SDD-110 1043. Recorded in commit message and
   apply-progress. Test file (330 lines vs ~150–220 estimate) is the overage driver, mandated by
   SC-PB coverage under strict TDD — consistent with the repo's ~2× forecast-undercount precedent.
2. **No `--continue-to` flag.** Carried verbatim from the approved non-goal: the CLI accepts only
   `project <missionId> [--store <file>]`. Requested continuation belongs to the projection library
   request context (already conformance-tested in slice A); the CLI passes any library-returned
   `deny` through unchanged. This overrides the parent delegation's tentative `--continue-to`
   recommendation, which contradicted approved scope.
3. **Conformance delegation (REQ-PB-003).** No new conformance suite. The DRAFT cites
   `projection/__tests__/` as the normative proof; no `contracts/__tests__/` projection tests.
4. **T-PB-003 no-production-change honesty.** RED recorded as `➖ No production change required`
   because the status-agnostic adapter (design D4) makes the 15-state table pass on first
   execution. Tests still exercise real production paths; the RED gate was satisfied by T-PB-001/002
   runs. Documented, justified deviation — not fabrication.
5. **`cmd/cli.ts` cosmetic indent SUGGESTION.** `main()` body rewritten with 6-space indentation vs
   baseline 2-space; entry-guard block similarly mis-indented. Cosmetic only (formatter disabled),
   non-functional, not gated. Accepted; no action required.
6. **Import-order assist SUGGESTION.** 4 fixable import-order suggestions (`project.test.ts`,
   `cli.ts`, `doctor.ts`), outside repo's configured lint rules. Cosmetic; optional future
   `biome check --write` on the 3 changed `.ts` files.

## 6. Findings resolution

- **CRITICAL (archive-only, bookkeeping): 21 stale `- [ ]` checkboxes in `tasks.md`.** Root cause:
  the apply delegation was mandated not to touch `openspec/` (apply-progress deviation #2,
  slice-A precedent); all checkboxes remained unchecked despite completion. Proven complete by
  apply-progress + verification (gates, 34/34 tests, E2E, doc read-back, declared-surface
  byte-identical). **Resolved by the parent/orchestrator** via stale-checkbox reconciliation (sed
  flip): **all 23 checkboxes (21 implementation/gate + 2 Phase-3 parent-owned) are now `[x]`, and
  zero `- [ ]` remain.** No archive-time mechanical repair was needed by this phase.
- **SUGGESTIONs:** import-order assist and `cli.ts` indentation — cosmetic, outside gates, no
  action required for archive.

## 7. Non-goals respected

- ✅ No projection library, type, package-export, or slice-A conformance changes.
- ✅ No freeze, approval ceremony, declared-surface promotion, or new conformance suite.
- ✅ No MCP projection tool; Option C remains gated on adoption.
- ✅ No UI, Command Center implementation, localization, or professional Spanish copy.
- ✅ No new mission state, transition, mutation, gate, approval, reconciliation, or receipt.
- ✅ No evidence, memory, ledger, journal, money, fiscal, or SUNAT behavior.
- ✅ No widened CLI input (`--snapshot`, `--raw`, `--demo`, `--continue-to`).
- ✅ `cmd/declared-surface.ts` **declared surface byte-for-byte unchanged** — exactly six FROZEN
  declared contracts intact; `projection` absent from `DECLARED_CONTRACTS`/`DECLARED_CONTRACT_FILES`.
- ✅ `projection/`, `missions/`, `routing/`, `adapters/`, `tenant-core/`, `receipts/` untouched;
  exactly **6 files** changed.

## 8. Lessons learned

1. **Forecast undercount pattern — now thrice-confirmed.** Slice A forecast 216–257 → shipped 425
   (~2.6× undercount); SDD-110 shipped 1043; this slice forecast ~499 → shipped 588. Strict-TDD
   SC-PB coverage consistently overruns additive-command estimates. The upper-bounded
   "apply-the-lesson" estimate still undercounts; a larger safety factor (≥1.5× upper bound) is
   warranted for command-layer slices with per-scenario test mandates.
2. **pi-lens LSP phantom class.** The verifier reported typecheck phantoms from the pi-lens LSP that
   `tsc --noEmit` (authoritative) dismissed at 0 errors. Treat `tsc --noEmit` as authoritative and
   ignore LSP phantoms; do not gate on them.
3. **Adapter-opaque projection (D4) is a real cost saver.** Emitting the library result unchanged
   (rather than reconstructing/normalizing) keeps one semantic authority and makes command tests
   pass-through assertions instead of a second semantic suite.

## 9. Follow-ups

1. **Option C — freeze + MCP:** remains gated on Command Center adoption evidence (approved at the
   slice-A gate). No freeze, declared-surface promotion, or MCP projection tool was introduced.
2. **Command Center adoption coordination:** the `drenyra-ai` Core projection surface is now
   adoptable and manually inspectable; coordinate adoption evidence (integration branch, released
   consumer, or approved payload fixture) with the sibling `drenyra-command-center` repo.
3. **SDD-100 record stays `lifecycle:in-progress`:** the Command Center UI product itself remains
   pending in `drenyra-command-center`; this record is not promoted on presence alone (R3/R4).
4. **Optional cleanups (no action required):** `biome check --write` on the 3 changed `.ts` files
   for import-order cleanliness, and correcting the `cli.ts` `main()` indentation, if a future
   reviewer wants them.

## 10. Structured status and actionContext

```yaml
schemaName: spec-driven
changeName: sdd-100-projection-surface
artifactStore: engram            # apply-progress/verify-report in Engram; spec/design/tasks
                                 # mirrored as flat files under openspec/changes/ (repo convention)
artifacts: proposal done · explore done · specs done · design done · tasks done · applyProgress done (Engram obs 10073) · verifyReport done · archiveReport done
taskProgress: total 21 (implementation+gate) + 2 parent; 23 checked / 0 unchecked (all reconciled)
applyState: all_done (checkboxes reconciled)
dependencies: apply done · verify done · sync not_applicable (engram, no canonical openspec/specs tree) · archive ready
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: (not provided; repo-local mode — write scope limited to this archive report)
  warnings: []
archivedPath: (Engram-backed; change folder retained under openspec/changes/sdd-100-projection-surface/
  per repo flat-file convention; no openspec/specs canonical tree exists)
```

## 11. Blockers

- **None.** The single archive-only CRITICAL (stale checkboxes) is resolved by the orchestrator's
  reconciliation. No verification CRITICAL/WARNING/BLOCKED remains. All implementation and gate
  checkboxes are `[x]`; no `- [ ]` remains.

## 12. Notes for the parent

- This change is **Engram-backed** for apply-progress/verify-report; no canonical `openspec/specs/`
  sync was applicable (repo keeps change specs flat). No archive-time sync fallback was needed or
  performed.
- The SDD-100 Option B slice is **complete and archive-ready**. The Command Center product work
  continues in the sibling repo; this change closes the Option B projection-surface slice only.
