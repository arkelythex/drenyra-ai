# Archive Report — Resolved SBOM Fidelity, Slice A

## Status

**PASS** — change archived.

- Artifact store: `openspec` (change artifacts under `openspec/changes/resolved-sbom-fidelity/`). Native status (`gentle-ai sdd-status ... --json` per parent) reported `dependencies.archive: ready`, `nextRecommended: archive`, all 27/27 tasks complete, and a parsed final verify report.
- Lifecycle: RDD is clone-locally disabled by explicit user authorization; **no review lifecycle was invoked or re-enabled** this run. Delivery proceeds under ordinary repository policy.
- No commit, push, or source-file modification was performed by this archive run.

## Artifacts read

- `proposal.md`
- `specs/release-integrity/spec.md`
- `design.md`
- `tasks.md`
- `apply-progress.md`
- `verify-report.md`
- `openspec/config.yaml`

## Final task completion gate

Re-read `tasks.md` before archiving. **All 27/27 task rows are `- [x]`; no unchecked `- [ ]` implementation task markers remain.** No stale-checkbox reconciliation was required. The two Task 8 parent-owned rows (bounded review + delivery gate) were flipped post-apply by the parent, consistent with `apply-progress.md`.

## Verify report verdict

- `verdict: pass`, `blockers: 0`, `critical_findings: 0`
- `requirements: 12/12`, `scenarios: 41/41`
- Focused test: `bunx vitest run scripts/__tests__/release-integrity.test.ts` → exit 0
- Build: `bun run typecheck` → exit 0
- Evidence revision: `sha256:0c80a1f853bdbf59dd27625758d78b5b2858f0f03513260c7ea102bf18e29875`
- Known baseline: 3 pre-existing `cmd/__tests__/cli.test.ts` failures (documented in config; unchanged/unrelated)
- No unresolved FAIL / BLOCKED / CRITICAL / verification blockers.

## Domains synced

**None.** This repository does not maintain a canonical spec tree.

## Canonical sync note (repository convention)

`openspec/specs/` does not exist anywhere in this repository, and no `sync-report.md` exists for **any** change (present or archived). The prior archive `2026-08-11-drenyra-ecosystem-cleanup` preserved its spec inside the archived change folder without syncing to a canonical tree. `openspec/config.yaml` `rules.archive` specifies only: "Warn before merging destructive deltas; archived changes are an audit trail and are never modified."

Consistent with this established repository OpenSpec convention (and the parent's instruction to "archive according to repository OpenSpec convention"), the change spec is archived as-is inside the change folder. **No canonical `openspec/specs/{domain}/spec.md` tree was created**, because none exists in this repo and archive-time sync fallback would invent a new top-level structure that no prior change or archive produced. There are therefore no ADDED / MODIFIED / REMOVED canonical requirement names to report, and no destructive merge guard applies.

## Requirement names (change spec, `specs/release-integrity/spec.md`)

The change spec is a full domain spec for `release-integrity` (Slice A). Verified requirements (12 total): Bun Lockfile v1 Parse and Validation; Root Dependency Consistency Guard; Unique Record Resolution; Required-Runtime Closure over Dependencies Edges; Exact Resolved Component Emission; Direct/Transitive Classification; Deterministic Closed Dependency Graph; Deterministic Output; Verifier Parity by Independent Recompute; Fail-Closed Generation; Optional Range-Satisfaction Hardening (MAY, omitted under line budget); TDD/Budget/Path-Audit/Rollback Boundaries.

## Active same-domain change warnings

No other active change under `openspec/changes/*/specs/release-integrity/` touches the same domain in a way that affects this archive (no canonical tree to conflict with).

## Scope / budget / path audit

- Actual changed lines: **274 (237+ / 37−)** in commit `293523d`, within the 300 hard cap; per-file caps respected; no size exception.
- Path audit: diff confined to four allowlisted `scripts/` paths plus the change's own `openspec/changes/resolved-sbom-fidelity/` artifacts; `package.json`, `bun.lock`, CI, `dist/`, checksum/signature surfaces untouched.
- Rollback boundary: revert/remove the four allowlisted paths (`scripts/lib/bun-lockfile.mjs`, `scripts/sbom.mjs`, `scripts/verify-release-integrity.mjs`, `scripts/__tests__/release-integrity.test.ts`) as one unit.

## Structured status / actionContext findings

- `actionContext`: no workspace-planning mode, no edit-root constraints; edits confined to the change's four-file allowlist. No warnings.
- Native status authoritative: `dependencies.archive: ready`, `nextRecommended: archive`.

## Archive-time sync fallback

Not performed and not required. Parent prompt did not approve archive-time sync fallback, and no canonical spec target exists in this repository; per repository convention the spec is archived change-local. No destructive canonical merge was attempted.

## Destructive merge approvals / blockers

None. No destructive canonical delta merge was performed; no REMOVED/MODIFIED canonical requirements were applied.

## Archived path

`openspec/changes/archive/2026-08-12-resolved-sbom-fidelity/`

## Engram persistence

`mem_save` for topic `sdd/resolved-sbom-fidelity/archive-report` was attempted. If the Engram HTTP server is unreachable (as in prior apply/verify runs), the OpenSpec file store remains authoritative and complete.
