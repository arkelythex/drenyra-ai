# SDD-090 Archive Report — Refutation Dual-Review and Findings Resolution

> Change: `sdd-090-refutation` · Phase: archive · Domain: Guardian Angel verification lenses
> Branch: `main` · Commit: `de46f5f` (squash of PR #63) · Baseline: `bc8c662`
> Artifact store: hybrid (file mirror + engram) · Verifier: sdd-archive executor (write-only; one artifact)

## Archive status

**PASS.** Implementation verified and merged, prerequisites satisfied: verification report present
and passing, all task checkboxes reconciled to `[x]`, non-goals honored, and PR #63 closed on `main`
at `de46f5f`. This archive records the first implementation slice of SDD-090; the SDD record remains
`lifecycle:active` (see Follow-ups).

---

## Executive summary

SDD-090's first implementation slice shipped the two missing Guardian verification-lens modules as
pure, strictly read-only libraries: `guardian/refutation.ts` (finding-scoped challenge + dual-review
consistency) and `guardian/resolution.ts` (one-way advisory findings lifecycle). Both make adversarial
findings challengeable and closable WITHOUT granting any approval authority, and both are advisory
only — they never set a verdict, mutate a candidate, or participate in a quorum. The slice merged via
PR #63 (squash commit `de46f5f`) and is verified green.

---

## Final state (what shipped)

Merged to `main` at `de46f5f` via PR #63. Exactly **6 files, 1676 insertions** — zero scope creep:

```
guardian/refutation.ts                |  284  A  (challenge + dual-review, closed verdicts, denials)
guardian/resolution.ts                |  230  A  (one-way lifecycle, 8 denial codes)
guardian/index.ts                     |    2  M  (barrel: +refutation, +resolution exports)
guardian/__tests__/refutation.test.ts |  527  A
guardian/__tests__/resolution.test.ts |  386  A
guardian/__tests__/exports.test.ts    |  247  A
```

`guardian/guardian.ts`, `package.json`, the CLI, and pre-existing tests are byte-identical to the
baseline. No wiring into `runGuardianReview`; no changes under `cmd/`, `candidates/`, `review/`,
`contracts/`, `flow/`, `gates/`.

---

## Requirements verification

**14/14 REQ-GU + 32/32 SC-GU PASS** (sdd-verify, read-only, independently re-run):

- Runtime gates: typecheck (`tsc --noEmit`) 0 errors; build PASS; full suite 1210/1211 (1
  pre-existing flake); Guardian suite 62/62; biome clean on the 6 changed files.
- REQ-GU-001..014 and SC-GU-001..032 all map to concrete assertions or code paths re-run green —
  binding, closed verdict set, independence, consistency, escalation (advisory, no verdict, no
  third reviewer), lifecycle, advisory-only boundary, fresh review, immutability/determinism, typed
  denials (never throws), no clock, barrel ESM exports, unit evidence.
- Strict TDD evidence validated (7 TDD rows cross-referenced and re-executed); assertion-quality
  audit clean (0 CRITICAL, 0 WARNING, 0 mocks).

## Findings resolution

- **0 implementation findings** in the verify report.
- **1 process finding** (31 unchecked `+ [ ]` task markers) — remediated by the orchestrator under
  explicit stale-checkbox reconciliation: apply was instructed not to modify `openspec/changes/*`,
  and checkbox marking is parent-owned. All 31 are now flipped to `[x]` in `tasks.md`; a fresh scan
  shows **0** `- [ ]` / `[ ]` implementation-task markers. Completion is independently proven by the
  TDD table + 62/62 + gates, so these were stale, not evidence of incomplete work.
- **1 environmental finding** — pre-existing flaky SBOM timeout test (`release-integrity.test.ts`,
  5s vitest timeout under parallel load). Byte-identical to baseline `bc8c662`; passes 13/13 in clean
  isolation; flake confirmed at baseline BEFORE this change. **Documented non-regression**, not a
  defect of this slice.

---

## Deliverables inventory

| Deliverable | Lines | Notes |
|---|---|---|
| `guardian/refutation.ts` | 284 | `challengeRefutation` + `evaluateDualReview`; 6 denial codes |
| `guardian/resolution.ts` | 230 | `resolveFinding`; one-way lifecycle; 8 denial codes |
| `guardian/index.ts` | +2 | `export * from "./refutation.js"` / `"./resolution.js"` |
| Tests (3 files) | 53 | refutation 31 + resolution 15 + exports 7, all unit |

---

## Deviations & decisions

1. **Size exception — 1676 changed lines vs 400 review unit** (estimate 1060–1420). 6th program
   occurrence, user-approved continuation (precedent 425/588/1043/1601/1773). No coverage dropped to
   trim the diff — driven by mandated coverage (consistency matrix, independence, full lifecycle,
   every denial code, identity change, immutability, determinism, advisory-only proofs). Recorded in
   tasks.md (`exception-ok` / `size-exception`), apply-progress, and the commit message.
2. **Design authored INLINE by the orchestrator** after the `sdd-design` provider errored twice;
   recovery followed the documented inline-takeover precedent. No impact on spec fidelity.
3. **SBOM flake** documented as a pre-existing, load-dependent non-regression (see Findings
   resolution).
4. **`candidateHash` optionality (MEDIUM, carried):** operations that assert no identity cannot
   detect candidate change. Documented in the design; callers SHOULD always assert it. Assertion
   wiring is a follow-up slice.

---

## Non-goals respected

- `guardian/guardian.ts` byte-identical — live review core untouched.
- No `cmd/`, `candidates/`, `review/`, `contracts/`, `flow/`, `gates/` wiring.
- No Command Center (SDD-100) integration — SDD-100 is the consumer (follow-up).
- Advisory-only — no verdict (`"none"`), no quorum, no authority state, no third reviewer, no reuse
  of `CandidateReviewVerdict`.
- **No capability-matrix promotion** — capability rows stay `planned`; the SDD-090 record stays
  `lifecycle:active` (R3/R4 evidence rules). Program-level `complete` pass is a follow-up, consistent
  with all prior slices.

---

## Lessons learned

1. **Forecast undercount is now the DEFAULT planning assumption.** This is the 7th confirmation
   that mandated denial + lifecycle + invariant coverage runs ~2x a naive estimate (estimates 1060–
   1420; actual 1676). Size exception should be the default planning posture, not an anomaly.
2. **The pi-lens phantom guard blocks sub-agent edit tools mid-task.** Atomic `write` (single call,
   never edit/append) prevents verify/archive timeouts. Archive reports should always be written in
   one atomic call.
3. **Provider API flakes on `openai-codex`.** The `sdd-design` provider errored twice; the
   orchestrator took over inline per documented precedent. Plan for orchestrator inline takeover as
   a standard recovery path.

---

## Follow-ups (next slices, SDD-090 remains `active`)

- **Command Center integration (SDD-100):** Guardian findings + refutation/resolution surfaced to
  the Command Center — the primary consumer of SDD-090.
- **Close-package projection:** project final Guardian findings into the close package.
- **`candidateHash` assertion wiring:** wire callers/CLI so operations always assert the candidate
  identity (closes the optionality gap).
- **Capability-matrix promotion pass:** program-level `complete` review once the lenses are fully
  integrated (consistent with all prior slices).

---

## Structured status & actionContext findings

- **Status:** implementation complete, verified, merged, and archived; no `blockedReasons`.
- **actionContext:** `mode: sdd-archive` (executor); write-only, one artifact
  (`archive-report.md`); `allowedEditRoots` = repo root under `openspec/changes/sdd-090-refutation/`.
  Artifact store: hybrid (file mirror + engram `sdd/sdd-090-refutation/archive-report`).
- **Delivery strategy:** exception-ok · **Chain strategy:** size-exception · **PR boundary:** single PR.

## Destructive merge / approval

No destructive merge applied. No REMOVED requirements; this slice only ADDED two library modules and
barrel exports. No canonical spec filesystem sync performed at archive time (SDD-090 is recorded in
the program-level SDD README, not a per-domain canonical spec; the change is mirrored as flat files
under `openspec/changes/sdd-090-refutation/`).

## Archived path

`openspec/changes/sdd-090-refutation/` — report written in place before any move. No folder move was
performed (file-mirror + engram mode); the change directory remains as the audit trail.

## Memory

Engram observation saved under topic key `sdd/sdd-090-refutation/archive-report` (project
`drenyra-ai`).
