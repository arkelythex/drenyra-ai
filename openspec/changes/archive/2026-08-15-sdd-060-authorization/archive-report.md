# Archive Report — sdd-060-authorization (RBAC/ABAC engine + org-wide segregation of duties, first slice)

> Change: `sdd-060-authorization` · Phase: archive · Store: openspec (artifacts) + engram (archive
> report) · Branch: `feat/sdd-060-authorization` @ `7c0aaff` (implementation) · Merged: `ef2ee1e` via
> PR #61 (squash commit) · Archive date: 2026-08-15
>
> **Archive status: PASS.** Implementation verification PASS 15/15 requirements (REQ-AUTH-001..015) and
> 35/35 scenarios (SC-AUTH-001..035) with zero code findings; all bookkeeping blockers (stale
> checkboxes, matrix-count document correction, state record) remediated by the orchestrator before
> archive; no implementation task checkboxes remain unchecked; no destructive canonical merge was
> required (nested per-domain spec preserved as-is).

## Executive summary

This change delivered the **first implementation slice of the SDD-060 Multi-Operator Control Plane's
declared core** (which the 2026-08-15 `sdd-060-multi-operator` reconciliation recorded as genuinely
absent): a pure, tenant-scoped **RBAC/ABAC authorization engine** plus an **organization-wide
segregation-of-duties (SoD) rule** over monthly-close steps, shipped as a self-contained library module.

Following the `projection` pattern-A precedent, the slice is a **pure `authorization/` library module**
with closed permission and role vocabularies, a frozen role-to-permission matrix, per-org role
assignment built on `tenant-core`'s `ValidatedTenantScope`, a fail-closed `authorize()` decision with
typed denial, a pure same-close-step `assertSegregation()` SoD rule, a `./authorization` package
subpath export, and 60 unit tests. It is deterministic, side-effect-free, and independent of Drenyra,
Drenyra Pi, Drenyra Engram, commands, and MCP. It makes **zero capability claims beyond the verified
slice**: the engine is not yet wired into the live monthly-close approval path, per-org policies,
approval hierarchies, views, and connectors remain pending, and no identity provider exists.

Implementation, tests, and export wiring were delivered as one cohesive PR and merged on `main` at
`ef2ee1e` (PR #61). All gates are green: suite **1104/1104** (1044 baseline + 60 new), typecheck **0
errors**, build **OK**, dist surface verified, CI **6/6**.

## Final state

- **What shipped:** `authorization/` module — `types.ts`, `roles.ts`, `authorize.ts` (assignRoles +
  authorize), `segregation.ts` (assertSegregation), `index.ts` barrel; 5 test files under
  `authorization/__tests__/` (`roles`, `authorize`, `isolation`, `segregation`, `exports`); a
  `./authorization` package subpath in `package.json`; a root `index.ts` re-export. Closed six-permission
  and four-role vocabularies, frozen 9-grant/15-denial matrix (spec-normative REQ-AUTH-004), per-org
  assignment, fail-closed typed-denial `authorize()`, and pure input-agnostic SoD.
- **Commit / PR:** implementation committed at `7c0aaff`; merged on `main` at `ef2ee1e` via PR #61
  (`feat(authorization): RBAC/ABAC engine + segregation-of-duties rule (SDD-060)`). Squash diff:
  **1601 insertions, 3 deletions** across exactly **14 files** (`authorization/` ×10, `index.ts`,
  `package.json`, `tsconfig.json`, `tsconfig.build.json`).
- **Reused primitives (never reimplemented):** `validateTenantScope` / `sameTenantScope` /
  `tenantScopeKey` via the `tenant-core` barrel; the `Materiality` type via `candidates` (import type
  only). No `node:crypto` operation is used.
- **Rollback:** additive and low risk — remove `./authorization`, the module, its tests, and the two
  export lines as one unit; no tenant data, approval state, receipts, ledger entries, or close artifacts
  were migrated or rewritten; live R3 behavior is unchanged.

## Requirements verification summary

**PASS — 15/15 requirements (REQ-AUTH-001..015) verified with concrete test evidence; all 35 scenarios
(SC-AUTH-001..035) covered; zero code findings; zero WARNINGs.**

| Verdict | Detail |
| --- | --- |
| PASS | REQ-AUTH-001..015 all PASS with direct test evidence (see verify-report requirement mapping) |
| Gates | `bun run test` 1104 passed / 0 failures (77 files; +60 from baseline 1044) · `bun run typecheck` 0 errors · `bun run build` OK (dist emitted + verified) · CI 6/6 |
| Scenario coverage | SC-AUTH-001..035 — 35/35 PASS, each mapped to at least one concrete assertion |
| Test layer | Unit-only (60 tests, 5 files) — correct layer for a pure library module with no UI/HTTP/browser surface |
| No-wiring proof | `git diff ... -- gates/ flow/` = 0 lines; gate/close suites inside the 77 green files (SC-AUTH-032) |

Requirement families verified: closed permission/role vocabularies, per-org assignment, frozen matrix
(9/15), fail-closed `authorize()`, typed denial (closed 10-code set, disjoint `sod-*` subset), least
authority and cross-org isolation, minimal inert ABAC (materiality never grants), org-wide SoD (plain
string IDs, set-like duplicates, empty-approver allows, `sod-invalid-input`), R3 compatibility
(`distinctApprovers` preserved, SoD is not approver counting), public `./authorization` export, unit
verification without wiring, English surface, and determinism/side-effect-freedom (25-iteration
byte-identical loops, no I/O/clock/network).

## Deliverables inventory

| Artifact | File / topic | Status |
| --- | --- | --- |
| Exploration | `explore.md` (Option A sizing, current-state inventory, gap analysis) | read |
| Proposal | `proposal.md` (Option A rationale, requirements preview, non-goals, tradeoffs) | read |
| Specification | `specs/authorization/spec.md` (NESTED per-domain; REQ-AUTH-001..015, SC-AUTH-001..035) | read |
| Design | `design.md` (decisions D1–D10, module layout, denial mechanics, strict-TDD test plan) | read |
| Tasks | `tasks.md` (7 TDD units T-AUTH-001..007, gates, acceptance mapping, review workload forecast) | read |
| Apply progress | no separate `apply-progress.md`; apply progress documented in verify-report (not a repo convention for this change) | n/a |
| Verify report | `verify-report.md` (PASS 15/15 + 35/35; bookkeeping blockers closed by orchestrator) | read |
| Archive report | `archive-report.md` (+ engram `sdd/sdd-060-authorization/archive-report`) | written |
| SDD program record | `openspec/programs/drenyra-dominion/sdds/sdd-060-multi-operator/README.md` | read; stays `lifecycle:active` |

## Deviations & decisions

1. **Size exception (accepted, 4th confirmation of the pattern).** 1601 authored lines vs the ~820
   forecast and the 400-line review unit (~2×). Root cause: mandated REQ-AUTH/SC-AUTH coverage (matrix
   roles × orgs × capabilities, 12 malformed SoD variants, cross-tenant isolation, 25-iteration
   determinism loops) with real, non-vacuous assertions cannot fit a naive implementation-line estimate —
   the same undercount observed at 425/588/1043. Accepted by the orchestrator per the standing precedent;
   recorded in the commit message and PR #61; user-approved single-PR delivery (`exception-ok` /
   `size:exception`). Not scope creep: the diff is confined to the 14 declared files.
2. **Matrix-count document correction (10/14 → 9/15).** The draft `tasks.md`/explore said the 24-pair
   matrix had "10 grants, 14 denials"; the **normative spec** (REQ-AUTH-004 table: preparer 3, reviewer
   2, approver 2, admin 2) yields **9 grants / 15 denials**. Implementation and tests follow the spec;
   the tasks document was corrected to the normative count by the orchestrator at reconciliation.
3. **No-wiring non-goal honored.** This slice deliberately does NOT wire `authorize()`/SoD into
   `gates/approval.ts` or `flow/close.ts`; live enforcement is deferred to a follow-up slice after an
   identity source exists. Gaps and close flow have **zero diff**.
4. **Input-agnostic SoD IDs pending identity source.** `assertSegregation` accepts explicit plain string
   IDs only (`closeStepId`/`proposerId`/`approverIds`), consistent with the existing `distinctApprovers`
   precedent. A canonical authenticated operator identity source does not exist; populating these inputs
   from live flows is deferred.
5. **State record not created (not a repo convention).** The verify report flagged the absent `state.yaml`;
   this was checked against all prior archives — **none contains a `state.yaml`**, so it is not a repo
   convention and was intentionally skipped (verified at archive time).

## Findings resolution

- **Bookkeeping blockers (all closed by the orchestrator, no code changes):**
  - **Stale Phase 0/2 checkboxes (lines 57–202).** Every named gate (typecheck/build/test, focused +
    full) was executed and is green; the apply delegation was forbidden from touching openspec planning
    files (orchestrator-owned), so the boxes were intentionally flipped at reconciliation. Substance was
    independently verified (60 tests green, 15/15 requirements).
  - **State record (line 207).** Skipped as non-convention (see deviation 5).
  - **Parent-owned lifecycle gates (lines 210–213).** Commit, PR #61, bounded review, and `sdd-verify`
    all completed; merge at `ef2ee1e`.
- **SUGGESTION (informational):** `expect(name).toBeTruthy()` appears as a decorative companion inside
  two table-driven loops; it proves nothing on its own but every loop iteration's substantive assertion
  is a full denial-object `toEqual`. Harmless; recorded as a non-blocking follow-up only.

## Non-goals respected

Verified via `git show --stat 7c0aaff` (exactly 14 files, confined to `authorization/`, exports, and
build config):

- ✅ Zero changes to `gates/approval.ts` or `flow/close.ts` (0-line diff vs `gates/ flow/`); live
  monthly-close approval path byte-identical.
- ✅ Zero changes to `tenant-core/`, `missions/`, `candidates/`, `projection/`, `cmd/`, `mcp/`,
  `contracts/`, or the capability matrix.
- ✅ No actor plumbing into mission commands; hardcoded close-flow `actor: "professional"` untouched.
- ✅ No identity provider, operator directory, authentication, or key-to-operator model.
- ✅ No per-org policy engine, approval hierarchy, view, or connector.
- ✅ No general expression language or dynamically configurable ABAC; materiality is inert and never
  grants.
- ✅ No command, CLI, MCP, agent, or Command Center surface.
- ✅ No capability-matrix promotion beyond the verified authorization work (R3 `distinctApprovers`
  intact; no capability row promoted).
- ✅ No `tenant-isolation/` export or frozen `contracts/**` change; no ledger/journal/evidence/memory/
  SUNAT/connector behavior change.

## Lessons learned

- **Mandated scenario coverage inflates changed-line forecasts — 4th confirmation.** The ~820 forecast
  missed by ~2× because mandated REQ-AUTH/SC-AUTH coverage (roles × orgs × capabilities, 12 malformed
  SoD variants, cross-tenant isolation, determinism loops) with real, non-vacuous assertions cannot fit
  a naive implementation estimate. **The program should size from mandated coverage (SC/requirement
  surface) by default**, not from an optimistic implementation-line estimate — matching the 425/588/1043
  precedent. Table-driven consolidation helps but does not fully offset conformance coverage.
- **The nested-spec path was used.** This change carries its spec at `specs/authorization/spec.md`
  (per-domain) rather than a legacy flat `spec.md`, matching the OpenSpec nested layout. Archive
  preserves the domain spec as-is.
- **Input-agnostic pure seams are the right first move.** A pure SoD rule on plain string IDs closes the
  hard governance gap deterministically and testably without inventing dangerous temporary identity
  assumptions — but the value only materializes when an identity source and live wiring exist (below).
- **Artifact-state discipline.** The archive blockers were bookkeeping/document-state only (stale
  checkboxes, matrix-count doc slip, absent non-convention state file), not code defects. Keeping
  `tasks.md` checkboxes and the matrix count aligned with the normative spec from the start avoids
  archive-time reconciliation.

## Follow-ups

1. **Wire `authorize()`/SoD into the live approval path** (approval gate / close flow) **after a
   canonical operator identity source exists** — thread identity through mission and close inputs,
   compose authorization/SoD/R3, enforce fail-closed decisions in the live consumer, and specify
   migration + denial UX. Deferred deliberately (no trustworthy identity plumbing today).
2. **Canonical operator identity.** Define an authenticated identity source (built on the receipts
   `actorId`/`signerKeyId` precedent) before live enforcement.
3. **Per-org policy engine, approval hierarchies, views, and connectors.** Remaining SDD-060 declared
   core; each is separate roadmap work, and org-scoped projections feed SDD-100 Command Center.
4. **Optional CLI/MCP surface** for `authorize`/SoD (follow-up C) when SDD-100 consumes org scopes.
5. **S (informational):** drop or justify the decorative `toBeTruthy()` companions in the two malformed
   table loops.
6. **Program record:** SDD-060 stays **`lifecycle:active`** (R3/R4) — the RBAC/ABAC engine + SoD rule
   now have a real, tested core, but per-org policy/approval hierarchies/views/connectors and live
   enforcement wiring (identity source + gates integration) remain — **NOT complete**.

## Sync / move note

This change uses the **nested per-domain spec** `openspec/changes/sdd-060-authorization/specs/authorization/spec.md`.
No canonical `openspec/specs/{domain}/spec.md` tree exists for this domain, so per repo convention the
domain spec is preserved as-is at archive; no destructive canonical merge was required, so no
archive-time sync fallback was needed and no ADDED/MODIFIED/REMOVED canonical requirement changes apply.

---
*Archive performed by sdd-archive executor. All artifacts read; verification PASS 15/15 + 35/35; no
unchecked implementation task boxes remain; non-goals respected; SDD-060 program record stays
`lifecycle:active`. Archive report persisted to engram topic `sdd/sdd-060-authorization/archive-report`.
No active artifacts deleted or modified.*
