# Apply Progress — Dominion Program Status Reconciliation

> **Updated (W2 batch):** 2026-08-15T00:06:08Z — W2 (composition and visibility)
> applied in this batch; the W1 record below is preserved in full. See the W2
> section at the end of this file.

## Work unit status

- **Unit:** W1 — vocabulary and gate (only W1 applied in this batch)
- **Date (UTC):** 2026-08-14T20:57:27Z (freeze) · edits + readback same session
- **Inspected revision:** `4975f4f` (branch `docs/drenyra-dominion-program`)
- **Runtime attempt token:** `sha256:c8a0603ac913cff56bac081442a2a55478972e0497ff8e77324472d8671343c3` (parent-provided, already acquired)
- **Delivery decision:** stacked-to-main; local max changed lines 299; W1 measured **262** (incl. 1 pre-existing user line in the protected README; W1-authored = 261)

## Structured status consumed

```yaml
schemaName: spec-driven
changeName: dominion-program-status-reconciliation
artifactStore: openspec
planningHome:
  root: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  changesDir: openspec/changes
changeRoot: openspec/changes/dominion-program-status-reconciliation
artifactPaths:
  proposal: openspec/changes/dominion-program-status-reconciliation/proposal.md
  specs: openspec/changes/dominion-program-status-reconciliation/specs/dominion-program-record/spec.md
  design: openspec/changes/dominion-program-status-reconciliation/design.md
  tasks: openspec/changes/dominion-program-status-reconciliation/tasks.md
  applyProgress: openspec/changes/dominion-program-status-reconciliation/apply-progress.md (this file)
artifacts: {proposal: done, specs: done, design: done, tasks: done, applyProgress: done}
taskProgress:
  total: 33   # 7 Phase 0 + 8 Phase 1 (W1) + 7 W2 + 6 W3 + 5 Phase 4
  complete: 15   # Phase 0 (7) + Phase 1/W1 (8)
  remaining: 18
  unchecked:
    - Phase 2 W2 tasks (7 rows)
    - Phase 3 W3 tasks (6 rows)
    - Phase 4 final integration tasks (5 rows)
deferredParentActions:
  total: 3
  complete: 0
  remaining: 3   # bounded review, chain PRs, SDD-020 record (parent-owned)
taskArtifactErrors: []
applyState: ready   # W1 complete; W2/W3/Phase 4 implementation tasks remain
dependencies:
  apply: ready
  verify: blocked   # requires full implementation + parent-approved review
  sync: blocked
  archive: blocked
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [repo-root]
  warnings:
    - Current worktree carries pre-existing uncommitted user state (protected README.md, ecosystem-coherence.md, ecosystem-coherence change dir, fiscal verify-report, this change dir); preserved byte-for-byte.
    - Engram HTTP server unreachable; OpenSpec file store used as the authoritative backend.
nextRecommended: parent-lifecycle (W1 delivery; W2 apply after chain PR 1)
```

## Completed tasks (persisted checkbox updates in tasks.md)

All 15 W1-scope rows are marked `[x]` in the persisted `tasks.md` (Phase 0 lines 99–105, Phase 1 lines 113–120). Exact rows:

- [x] Phase 0 — freeze inspection context
- [x] Phase 0 — protected-path SHA-256/blob hashes + deterministic manifest
- [x] Phase 0 — resolve local remote owner/name
- [x] Phase 0 — query authenticated GitHub metadata (visibility PUBLIC, direct, E-005)
- [x] Phase 0 — fresh test/typecheck evidence at `4975f4f` (774/774; typecheck clean)
- [x] Phase 0 — read fiscal verify-report read-only (revision-bound, E-004)
- [x] Phase 0 — build evidence register (E-001…E-009; three inputs `approved-pending-evidence`)
- [x] Phase 1 — create `status-and-evidence.md` (five-axis vocabulary, register, precedence, freshness, historical/current index)
- [x] Phase 1 — reconcile SDD-000 README (lifecycle:active; maturity implemented; not complete)
- [x] Phase 1 — reconcile SDD-010 README (lifecycle:active + W1-only evidence-contract amendment)
- [x] Phase 1 — reconcile gate-0.md (6 rows re-evaluated; inventory refreshed; inputs approved-pending-evidence)
- [x] Phase 1 — publish SDD-020 decision (BLOCKED; no implicit waiver) + ecosystem-coherence boundary pointer
- [x] Phase 1 — charter.md §7 and dependency-graph.md §9 Gate 0 wording
- [x] Phase 1 — W1 readback and integrity
- [x] Phase 1 — W1 delivery verification (local: allowlist match, evidence IDs preserved)

## Files changed (exact W1 allowlist)

| Path | Change | Lines |
| --- | --- | --- |
| `openspec/programs/drenyra-dominion/status-and-evidence.md` | **New** — canonical vocabulary, evidence register E-001…E-009, precedence, freshness, historical/current index | +95 |
| `openspec/programs/drenyra-dominion/gate-0.md` | Header status, 6 checklist rows re-evaluated, inventory refreshed, §3 approved-pending-evidence, §4 SDD-020 BLOCKED + boundary pointer, §5/§6 renumbered | +65 −21 |
| `openspec/programs/drenyra-dominion/charter.md` | Section 7 only — status column + SDD-020 blocked summary | +13 −7 |
| `openspec/programs/drenyra-dominion/dependency-graph.md` | Section 9 only — reconciled status wording | +5 |
| `openspec/programs/drenyra-dominion/sdds/sdd-000-dominion/README.md` | Header status + reconciliation note + progress note (status/progress/evidence only) | +15 −1 |
| `openspec/programs/drenyra-dominion/sdds/sdd-010-contracts/README.md` | Header status + reconciliation note + W1-only evidence-contract amendment + progress note | +37 −1 |
| **Total** | | **+137 −30 tracked + 95 new = 262** (< 299) |

## Test commands run (fresh, at inspected revision `4975f4f`)

| Command | Result |
| --- | --- |
| `bun run test` | ✅ 60 files, **774 passed (774/774)**, exit 0 (vitest 4.1.10) |
| `bun run typecheck` | ✅ clean (`tsc --noEmit`), exit 0 |
| `bun run build` | Not run in this unit (docs-only; `build` evidence already revision-bound in E-004) |

Corroborated by persisted revision-bound evidence E-004 (`fiscal-authority-kernel/verify-report.md`: 774/774, typecheck clean, build clean, tree clean at `4975f4f`).

## Strict TDD — docs-only rationale and evidence

No production code, tests, or runtime artifacts exist for this unit; the change surface is administrative documentation only (R17). Per tasks.md, the applicable verification is the **structural readback and evidence/integrity validation contract**, plus the required unchanged test/typecheck evidence above. No RED test can reference production code that this unit must not create.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Phase 0 evidence capture | n/a — docs-only | Structural | ✅ 774/774 at `4975f4f` | ➖ N/A (no code) | ✅ 774/774 green | ➖ N/A (no code) | ➖ None needed |
| W1 vocabulary + gate edits | n/a — docs-only | Structural | ✅ 774/774 at `4975f4f` | ➖ N/A (no code) | ✅ readback (below) | ➖ N/A (no code) | ✅ Markdown lint clean after each edit |

Triangulation skipped: docs-only unit; structural readback is the primary proof — every edited file parsed, evidence IDs resolved (E-001…E-009 defined; E-001/E-004/E-005/E-006/E-008/E-009 referenced across files), every current-state claim carries source+freshness, each term maps to exactly one axis (dual `planned` mapping explicitly qualified per R2), 12-SDD catalog unchanged, protected hashes byte-identical.

### W1 readback and integrity results

- ✅ Every edited file parses (markdown lint clean: `✓ Markdown clean` after each edit; gate-0.md §2 table repaired after structural check)
- ✅ Evidence IDs resolve against the register; no dangling references
- ✅ Current-state claims carry source + freshness (evidence IDs / freshness labels in register; sibling-repo claims flagged unverified)
- ✅ Exactly one axis/value per mapped term; cross-axis `planned` uses qualified `lifecycle:planned` / `maturity:planned`
- ✅ 12-SDD catalog unchanged (SDD-000…SDD-110 by tens, directory enumeration)
- ✅ Protected-path hashes re-verified byte-for-byte (manifest below)
- ✅ Changed lines 262 < 300
- ✅ W1 delivery verification (local): changed-path set = W1 allowlist exactly; evidence IDs and historical/current labels preserved in rendered text (delivery verification per §5 of tasks.md deferred to the PR review gate for GitHub-rendered text; no commit/PR opened in this batch)

### Protected-path manifest (pre == post, SHA-256)

| Path | Hash |
| --- | --- |
| `openspec/programs/drenyra-dominion/README.md` | `94b6cdebc11409360ba1d8ef305c434453b59bc8122f07cfeaf01283aa4142cc` |
| `openspec/programs/drenyra-dominion/ecosystem-coherence.md` | `a73452c654085dc37cc886b1f8802556e8acd32287aebf482c689b5ac404a82d` |
| `openspec/changes/fiscal-authority-kernel/verify-report.md` | `bee009a50f94267c3544da06db464d0e7fe0d42ab0873249e3392a1e9ec9f04c` |
| `openspec/changes/ecosystem-coherence/apply-progress.md` | `ab292d3c224e8c7c2debcc690f47700bf250db8976fc2ec13adc2ed857ad024e` |
| `openspec/changes/ecosystem-coherence/design.md` | `f6e263982c2d01d1ca10c1c7c49b0cf77580e0991a71fdb3e9d0433548bd25ae` |
| `openspec/changes/ecosystem-coherence/proposal.md` | `5f2e1fe2474c7a2ce5e4e551ce85176b00620929f6d33c762b14ffa5d72b9be1` |
| `openspec/changes/ecosystem-coherence/specs/ecosystem-coherence/spec.md` | `5b60d235db372d43dae35bc2a2a48a3525132028871f0223a11ca37bed7efa38` |
| `openspec/changes/ecosystem-coherence/tasks.md` | `2dd6db3a3d973f7c220f32a7a1a854a53b6c3317fed55b543a9cd0395131dc7b` |

All 8 protected paths byte-for-byte identical before and after W1. `git diff --name-only` shows only the six W1 allowlisted paths plus the pre-existing user-modified README (protected, hash unchanged from baseline). The README's 1-line diff vs HEAD (`ecosystem-coherence.md` row in the program-documents table) is pre-existing user state, preserved untouched.

## Deviations from design

- None. Edits follow design.md evidence matrix and allowlist. Gate 0 rows 1, 2, 5, 6 → `satisfied`; row 3 → `pending`; row 4 → `approved-pending-evidence`; SDD-020 explicitly **blocked** (rows 3–4 incomplete, no waiver). The three business inputs remain `approved-pending-evidence` (E-009); no durable approval reference exists in the authoritative record, so no promotion was made.
- SDD-000/SDD-010 lifecycle recorded `active` (not `complete`); maturity of landed foundations exposed separately (R3/R4).

## Evidence limitations

- **Sibling-repository facts** (drenyra-engram/command-center/pi/skills/guardian-angel change states, per-repo README notices): unverified from this clone; flagged as such in gate-0.md §1/§5. Refresh at the next integrated checkpoint.
- **`bounded-agent-roles`**: not present under `openspec/changes/` at `4975f4f`; recorded `unverified` (may live in another repository).
- **GitHub visibility**: directly verified PUBLIC (E-005, `gh repo view arkelythex/drenyra-ai`, observed 2026-08-14T20:57:27Z) — this is W2 evidence; W1 only records it in the register. W1 made no current visibility claim in ROADMAP (W2-owned path).
- **Engram** HTTP server was unreachable during the read/search phase of this run; the OpenSpec file store was used as the authoritative backend and the first `mem_search` failed. A later `mem_save` succeeded (observation id 9950, topic key `sdd/dominion-program-status-reconciliation/apply-progress`) — record it as best-effort cross-session recovery; the file artifact remains authoritative.
- No commit/PR opened, nothing staged, nothing pushed (parent-owned lifecycle gates).

## Remaining tasks (exact unchecked lines in tasks.md)

- Phase 2 W2: `- [ ] Reconcile capability-matrix.yaml …`, `- [ ] Reconcile program-lock.json …`, `- [ ] Update program-lock.schema.json …`, `- [ ] Update delivery-sequence.md …`, `- [ ] Update ROADMAP.md …`, `- [ ] W2 readback and integrity: …`, `- [ ] W2 delivery verification: …` (7 rows, lines 130–136)
- Phase 3 W3: Amendments 1–4 + readback + delivery verification (6 rows, lines 146–151)
- Phase 4: catalog enumeration, protected hashes on merged candidate, `bun run test`/`typecheck`, spec requirement pass/fail, Gate 0 SDD-020 confirmation (5 rows, lines 161–165)
- Parent-owned: post-apply bounded review; resolve chain_strategy + open 3 chained PRs (W1→W2→W3); record SDD-020 blocked/permitted in Gate 0 (3 rows, lines 200–202)

## Workload / PR boundary

- W1 changed lines: **262** (< 299 local max; < 300 unit budget; total change forecast 480–630 → chained PRs required).
- W1 is the first of three chained PRs (stacked-to-main, resolved by parent). W1 → W2 → W3 dependency order preserved (composition/amendments consume W1 vocabulary).
- Rollback (W1): revert the six W1 paths together to the prior program snapshot; captured historical entries preserved; if gate evidence disappears, SDD-020 returns to `blocked`.

## Completion criteria mapping (W1-scope subset)

| Req | Status |
| --- | --- |
| R1 12-SDD invariant | ✅ catalog enumerated, unchanged (12 by tens) |
| R2 one vocabulary, five axes | ✅ status-and-evidence.md §1; cross-axis qualified |
| R3 lifecycle/maturity independent | ✅ SDD-000/010 `active` + maturity `implemented`, not `complete` |
| R4 no completion on presence | ✅ progress checklists untouched; no gate row completed on presence |
| R5 evidence-source precedence | ✅ register + precedence list; 640/774 handled per rules |
| R6 source+freshness on current claims | ✅ E-IDs cited; unsupported → unverified/unknown |
| R7 history stays historical | ✅ 640-test + CLI-failure checkpoints retained as historical (E-006/E-007) |
| R8 Gate 0 reconciled | ✅ all rows re-evaluated; inventory refreshed; unresolved stays unresolved |
| R9 approvals pending evidence | ✅ `approved-pending-evidence` (E-009), decision not reopened |
| R10 SDD-020 blocked | ✅ gate-0.md §4 explicit BLOCKED, no implicit waiver |
| R11 visibility direct | ✅ E-005 direct metadata (PUBLIC); no prose inference (W1 doesn't state visibility in ROADMAP) |
| R12 test/CLI history | ✅ 640 historical; CLI baseline superseded; promoted totals bound to `4975f4f` (E-002/E-004) |
| R14 amendment allocation | ✅ SDD-010 evidence-precedence amendment lands in W1 only |
| R15 protected-path isolation | ✅ hashes byte-identical; no non-allowlisted path changed |
| R16 ecosystem-coherence boundary | ✅ pointer only in gate-0.md §4; no copied/modified records |
| R17 no capability implementation | ✅ docs-only |

    | R18 bounded evidence-backed edits | ✅ 262 lines < 300; every current claim evidence-backed |

---

## W2 — composition and visibility (this batch)

## Work unit status (W2)

- **Unit:** W2 — composition and visibility (only W2 applied in this batch; W1 record above preserved in full)
- **Date (UTC):** 2026-08-15T00:06:08Z (edits + readback same session)
- **Inspected revision:** `549ed64` (`549ed640e05bca03c0debd383ef523fb19605a5e7`, branch `sdd/dominion-reconciliation-w1`, W1 commit) — W2 edits build on W1
- **Runtime attempt token (W2):** `sha256:c9147c7b8e7e8422efb4ab5b8cc27bc7a9b38cfcb814d725c76a70f0e6781364` (parent-provided, already acquired)
- **Delivery decision:** stacked-to-main (parent-resolved); W2 measured **165** changed lines (< 300)

## W2 supplementary evidence (defined here, NOT in status-and-evidence.md — W1-owned)

W2 artifacts cite the W1 register E-IDs (E-002, E-004, E-005, E-006…) plus the following W2-owned supplement. Resolution rule: E-*resolve in `status-and-evidence.md` §3; W2E-* resolve in this section.

| `claimId` | Axis / value | Temporal class | Source kind | Source locator | Repository identity | Revision | Captured at (UTC) | Verification method | Freshness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W2E-001 | evidence — test suite | current-claim (revision-bound) | executable-verification | `bun run test` (vitest) | arkelythex/drenyra-ai | 549ed64 | 2026-08-14T19:03Z (parent-captured fresh run) | Fresh run: 60 files, 774/774 passed, exit 0 | verified-revision-bound (549ed64) — corroborates E-002/E-004 |
| W2E-002 | evidence — typecheck | current-claim (revision-bound) | executable-verification | `bun run typecheck` (tsc --noEmit) | arkelythex/drenyra-ai | 549ed64 | 2026-08-14T19:03Z (parent-captured) | Fresh run: clean, exit 0 | verified-revision-bound (549ed64) |
| W2E-003 | evidence — GitHub visibility | current-claim (observation-scoped) | github-metadata | `gh repo view arkelythex/drenyra-ai --json nameWithOwner,visibility,isPrivate,defaultBranchRef,url,pushedAt` | arkelythex/drenyra-ai | n/a (live) | 2026-08-15T00:06:08Z (fresh query by W2 writer) | Direct API query: visibility PUBLIC, isPrivate false, defaultBranch main, url <https://github.com/arkelythex/drenyra-ai> | verified-current (observation-scoped) — corroborates E-005 |
| W2E-004 | evidence — host version/license | current-claim | repository | `package.json` (version 0.2.1), `LICENSE` (proprietary) | arkelythex/drenyra-ai | 549ed64 | 2026-08-15T00:06:08Z | Read at inspected revision | verified-current (tree == inspected) |

Notes:

- W2E-001/W2E-002 are revision-bound to `549ed64` (the tree at capture); W2's docs-only edits do not touch runtime, and Phase 4 re-runs `bun run test`/`bun run typecheck` at the merged candidate as final proof.
- W2E-003 is the W2 fresh visibility observation; E-005 remains the W1 observation (2026-08-14T20:57:27Z). Both are direct metadata for the exact repository identity.
- W2E-004 reconciles the matrix/lock `0.2.0` narrative claim to `0.2.1` per precedence level 1 (current repository contents over narrative).

## Files changed (exact W2 allowlist; 5 paths)

| Path | Change | Lines (adds+dels) |
| --- | --- | --- |
| `openspec/programs/drenyra-dominion/capability-matrix.yaml` | W2 evidence/freshness block (program.evidence), version 0.2.0→0.2.1 (W2E-004), `github_visibility` (W2E-003/E-005), tests split historical 640 (E-006) / current 774 (W2E-001), sibling rows → `unknown` + `historical-snapshot` markers (R6/R13) | 37 |
| `openspec/programs/drenyra-dominion/program-lock.json` | `snapshot` (historical) + `currentVerified` (current-claim, revision-bound, host commitSha null — no self-reference) blocks; per-repo `temporalClass: historical-snapshot`; drenyra-ai `conformanceNote` (640 superseded by W2E-001) | 42 |
| `openspec/programs/drenyra-dominion/program-lock.schema.json` | `snapshot` + `currentVerified` + repo `temporalClass`/`conformanceNote` properties only; valid against draft-07 meta-schema and lock validates against it | 54 |
| `openspec/programs/drenyra-dominion/delivery-sequence.md` | New §1.1 (lock freshness, promotion, bootstrap, readback) + §4 step-4 freshness clause | 27 |
| `ROADMAP.md` | Visibility sentence (PUBLIC, E-005 + W2E-003 with observation timestamps; stale "private" claim superseded, not falsified; independent fields) + Dominion checkpoint reference (SDD-020 blocked pending Gate 0 rows 3–4) | 5 |
| **Total** | | **165** (< 300) |

`git diff --name-only` shows exactly these 5 allowlisted paths plus the pre-existing user-modified protected README.md (hash unchanged from baseline; not part of W2).

## W2 readback and integrity results

- ✅ JSON validates against the updated lock schema (draft-07 validator); schema valid against draft-07 meta-schema
- ✅ YAML parses; matrix assertions hold (640 historical + 774 current; version 0.2.1)
- ✅ Evidence IDs resolve: cited E-IDs {E-001, E-002, E-004, E-005, E-006, E-009} all defined in W1 register; cited W2E-IDs {W2E-001…W2E-004} defined in the W2 supplement above
- ✅ 640-test checkpoint remains historical (matrix `historical: 640` E-006; lock conformanceNote labels 640 a snapshot claim superseded by W2E-001); CLI-failure baseline remains historical in W1 register (E-007) — not presented as current anywhere
- ✅ Visibility metadata-backed: W2E-003 (fresh `gh repo view`, PUBLIC, 2026-08-15T00:06:08Z) + E-005; `license`/`productStage`/`sourceAvailability`/`githubVisibility` kept independent
- ✅ Exactly 12 canonical SDDs (SDD-000…SDD-110 by tens, directory enumeration)
- ✅ `status-and-evidence.md` byte-for-byte as W1 produced it (hash `8c7a7de9…` unchanged; not edited)
- ✅ Protected-path hashes all byte-identical to the W1 manifest (pre == post)
- ✅ Changed lines 165 < 300
- ✅ W2 delivery verification (local): changed-path set = W2 allowlist exactly; rendered text preserves evidence IDs and historical/current labels (GitHub-rendered text re-check deferred to the PR gate per §5 of tasks.md; no commit/PR opened in this batch)

### Strict TDD — docs-only rationale (W2)

No production code, tests, or runtime artifacts exist for this unit (R17). The applicable verification is the structural readback above plus the unchanged green suite at `549ed64` (W2E-001, parent-captured fresh run 2026-08-14T19:03Z). No RED test can reference code this unit must not create. Phase 4 re-runs the suite at the merged candidate.

## Deviations from design (W2)

- None structural. Two reconciliation outcomes worth recording:
  - `capability-matrix.yaml` host `version` 0.2.0 → **0.2.1** (W2E-004): precedence level 1 (package.json at 549ed64) beats the 2026-08-12 narrative claim.
  - Sibling-repository `tests` values (209 / partial / go-test-suite… / conformance-via… / none yet) → **`unknown`** with `historical-snapshot` row markers: unverifiable from this clone (R13), recorded as awaiting evidence, not deleted.
- Lock keeps the prior snapshot intact under `snapshot` and adds `currentVerified`; no self-reference (`currentVerified.host.commitSha` is `null`; `inspectedRevision` is the W1 commit `549ed64`, an ancestor of the future lock commit, explicitly not the lock commit itself).

## Remaining tasks (exact unchecked lines in tasks.md)

- Phase 3 W3: Amendments 1–4 + readback + delivery verification (6 rows)
- Phase 4: catalog enumeration, protected hashes on merged candidate, `bun run test`/`typecheck`, spec requirement pass/fail, Gate 0 SDD-020 confirmation (5 rows)
- Parent-owned: post-apply bounded review; open the 3 chained PRs W1→W2→W3; record SDD-020 blocked/permitted in Gate 0 (3 rows)

## Workload / PR boundary (W2)

- W2 changed lines: **165** (< 300). Cumulative forecast 480–630 across W1(262)+W2(165)+W3 — chained PRs required (stacked-to-main).
- W2 → W3 dependency preserved (W3 amendments consume W1 vocabulary).
- Rollback (W2): revert only the five W2 paths to the prior snapshot; prior lock retained as historical; no self-reference introduced.
