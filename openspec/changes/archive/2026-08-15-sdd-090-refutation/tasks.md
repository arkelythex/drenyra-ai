# Refutation Dual-Review and Findings Resolution — Implementation Tasks (SDD-090)

> Change: `sdd-090-refutation` · Phase: tasks · Strict TDD active (`bun run test`)
> Implements spec REQ-GU-001..014 / SC-GU-001..032 under design decisions D1-D8.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1060–1420 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High
```

## Scope recap and delivery shape

**What ships (in scope):** two new pure, read-only library modules
`guardian/refutation.ts` and `guardian/resolution.ts`, two barrel lines in
`guardian/index.ts`, and three new test files. Both modules make adversarial findings
challengeable and closable WITHOUT any approval authority. This is a single cohesive PR with
a **documented size exception** (precedent sizes 425/588/1043/1601/1773, all
user-approved continuations): estimated ~1060–1420 changed lines driven by mandated coverage
(consistency matrix, independence, full lifecycle, every denial code, identity change,
immutability, determinism, advisory-only proofs). No coverage is dropped to stay under the
400-line review unit.

**Split fallback (only if the size exception is rejected):** PR1 = `guardian/refutation.ts`

+ refutation tests (T-GU-001..004); PR2 = `guardian/resolution.ts` + resolution tests
(T-GU-005..006) + exports/advisory tests (T-GU-007) + barrel. Each PR stays independently
green against the same spec.

**Non-goals (must NOT happen):** no wiring into `runGuardianReview`, no changes to
`guardian/guardian.ts`, `GuardianReport`/`GuardianFinding` shapes, the CLI, contracts,
agents, flows, gates, ledgers, or journals. No Command Center integration (SDD-100 is the
consumer). No authority state, no third reviewer, no automated escalation, no reuse of
`CandidateReviewVerdict`. No lifecycle promotion; capability-matrix rows stay `planned`. No
money fields. No new package subpath — exports extend the existing `guardian/index.ts`
barrel only (`export * from "./guardian.js"`).

**Invariants (advisory-only):** both modules never read a clock (`referenceTime` is
caller-supplied); all created records/outcomes are frozen with read-only collections;
validation is deterministic with first-failure-wins; every expected domain failure returns a
closed typed denial and never throws (SC-GU-028).

## Precedent for the size exception

This estimate is consistent with the program-wide lesson that mandated denial + lifecycle +
invariant coverage runs ~2x a naive estimate. Precedent approved continuations:
425 / 588 / 1043 / 1601 / 1773 changed lines. Decision already recorded in the design; no
new approval required to apply. Chained split is the documented fallback only.

---

## Phase 0 — Preflight

### 0.1 Baseline verification

+ [x] Confirm the worktree is clean (`git status --porcelain` empty) and the current HEAD is
      `bc8c662`. <!-- sdd-owner: implementation -->
+ [x] Run the baseline test suite and confirm `1158/1158` passing, `0` failures
      (`bun run test`). <!-- sdd-owner: implementation -->
+ [x] Run `bun run typecheck` and `bun run build`; both green on the clean baseline. Note:
      pi-lens LSP phantoms are a documented repo defect and are ignored — repo
      `tsc --noEmit` is authoritative. <!-- sdd-owner: implementation -->
+ [x] Confirm the current barrel `guardian/index.ts` exports exactly
      `export * from "./guardian.js"` (line 8), with the fiscal-convention header intact.
      <!-- sdd-owner: implementation -->

---

## Phase 1 — RED / GREEN / TRIANGULATE / REFACTOR units

Strict TDD is active. For each unit: write the focused RED test first, watch it fail on the
absent implementation, then implement the minimal GREEN code, then triangulate + refactor
inside that unit's own module. Run `bun run test` after each GREEN and each refactor.

### T-GU-001 — Challenge binding (refutation) · REQ-GU-001/009, SC-GU-001/002/023

File: `guardian/__tests__/refutation.test.ts` (first group) + `guardian/refutation.ts` (new)

+ [x] RED — write focused tests that assert: a challenge binding a finding from
      `report.findings` is accepted; a foreign finding returns typed `unknown-finding`; a
      challenge missing the finding/challengerId/reason returns `malformed-challenge`; an
      asserted `candidateHash` differing from the report's returns `candidate-changed`.
      Confirm each fails (module missing / not implemented). <!-- sdd-owner: implementation -->
+ [x] GREEN — implement `challengeRefutation(report, challenge)` in
      `guardian/refutation.ts`: validate shape → `malformed-challenge`; same-review
      membership (`report.findings.includes(challenge.finding)`) → `unknown-finding`;
      asserted identity vs `report.candidateHash` → `candidate-changed`; otherwise
      `{ state: "accepted" }`. Every failure is a frozen closed denial with `code`,
      `cause`, `continuation`. All RED assertions now pass. <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — add boundary cases (challengerId/reason empty vs whitespace,
      no asserted identity, denial immutability). Keep validation order deterministic and
      first-failure-wins. <!-- sdd-owner: implementation -->

### T-GU-002 — Verdicts + downgrade (refutation) · REQ-GU-002/003, SC-GU-003/004/005/006/013/014

File: `guardian/__tests__/refutation.test.ts` + `guardian/refutation.ts`

+ [x] RED — write tests asserting: the closed set `uphold|refute|downgrade` is accepted
      across all severities and all five categories; a verdict outside the set returns
      `invalid-verdict`; a `downgrade` with no `severityOverride`, or an override not
      strictly lower (`blocker` > `concern` > `info`), returns `downgrade-without-target`.
      Confirm each fails. <!-- sdd-owner: implementation -->
+ [x] GREEN — extend `guardian/refutation.ts` with closed verdict validation and downgrade
      target checks applied during challenge + dual evaluation; return the corresponding
      typed denials. All RED assertions pass. <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — cover the severity boundary matrix (blocker/concern, concern/
      info, equal severity, lowering to same severity, `info` can never be lowered). Ensure
      severity order is a single source of truth. <!-- sdd-owner: implementation -->

### T-GU-003 — Independence (refutation) · REQ-GU-004, SC-GU-007/008/009/010

File: `guardian/__tests__/refutation.test.ts` + `guardian/refutation.ts`

+ [x] RED — write tests asserting: exactly two reviews with distinct `reviewerId`s, both
      distinct from the challenge's `challengerId`, pass; reviewer==challenger, duplicate
      reviewerId, and wrong count (1 or 3) each return `invalid-independence`. Confirm
      each fails. <!-- sdd-owner: implementation -->
+ [x] GREEN — implement independence validation in the dual-review path: exactly two
      reviews, reviewerIds pairwise distinct and distinct from challengerId; any violation →
      `invalid-independence`. All RED assertions pass. <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — add empty-reviewerId and missing-verdict-on-review cases;
      confirm independence is never conflated with consistency (a denial is never reported
      as `consistent`). <!-- sdd-owner: implementation -->

### T-GU-004 — Consistency matrix (refutation) · REQ-GU-005/006, SC-GU-011/012/013/015/016

File: `guardian/__tests__/refutation.test.ts` + `guardian/refutation.ts`

+ [x] RED — write tests asserting: uphold/uphold → `consistent` verdict `uphold`;
      refute/refute → `consistent` verdict `refute`; downgrade/downgrade with a strictly
      lower override → `consistent` with the lowered severity; a mixed verdict pair →
      `inconsistent` with `escalation: "required"` carrying NO verdict and NO third-reviewer
      reference. Confirm each fails. <!-- sdd-owner: implementation -->
+ [x] GREEN — implement `evaluateDualReview(report, challenge, reviewA, reviewB)`:
      validate challenge, verdicts, independence, downgrade target, THEN compute
      consistency as pure verdict equality. `inconsistent` exposes only an advisory
      escalation signal (SC-GU-016). All RED assertions pass. <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — assert that `inconsistent` output carries no verdict value and
      cannot approve/block anything (structural shape check). Ensure consistency is computed
      ONLY after all validation passes. <!-- sdd-owner: implementation -->

### T-GU-005 — Resolution lifecycle (resolution) · REQ-GU-007, SC-GU-017/018/019/020

File: `guardian/__tests__/resolution.test.ts` (new) + `guardian/resolution.ts` (new)

+ [x] RED — write tests asserting: `open` + valid `resolved` record → applied frozen record;
      `open` + valid `dismissed` record → applied frozen record; a second transition on an
      already-terminal finding → `already-resolved`/`already-dismissed`; no reopen/revocation
      path exists. Confirm each fails. <!-- sdd-owner: implementation -->
+ [x] GREEN — implement `resolveFinding(report, record, currentDisposition?)` in
      `guardian/resolution.ts`: library holds no lifecycle state (`undefined` = open);
      `open → resolved | dismissed` exactly once; already-terminal → typed denial; no
      reopen/revocation. All RED assertions pass. <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — add boundary cases: `currentDisposition` already `resolved`
      with a `dismissed` record (still `already-resolved`), and vice-versa. Confirm
      applied records are frozen. <!-- sdd-owner: implementation -->

### T-GU-006 — Resolution denials (resolution) · REQ-GU-009/011, SC-GU-023/027/028/030

File: `guardian/__tests__/resolution.test.ts` + `guardian/resolution.ts`

+ [x] RED — write tests asserting each resolution denial: empty reason → `empty-reason`;
      empty/missing actorId → `missing-actor`; missing/malformed `referenceTime` →
      `missing-timestamp`; wrong fields/types → `malformed-record`; foreign finding →
      `unknown-finding`; asserted identity mismatch → `candidate-changed`. Confirm each
      fails and that expected invalid input NEVER throws. <!-- sdd-owner: implementation -->
+ [x] GREEN — implement record-shape, membership, identity, non-empty reason/actorId/
      referenceTime, and disposition validation; return the corresponding closed typed
      denials; no exception escapes for any expected invalid input (SC-GU-028). All RED
      assertions pass. <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — add a denial-shaped check for each of the 8 resolution codes;
      verify `malformed-record` ordering against the fail-closed sequence in design D7/D8.
      <!-- sdd-owner: implementation -->

### T-GU-007 — Advisory + immutability + determinism + exports · REQ-GU-008/010/012/013/014, SC-GU-021/022/025/026/029/031/032

File: `guardian/__tests__/exports.test.ts` (new) + `guardian/index.ts` (edit, +2 lines)

+ [x] RED — write tests asserting: a report's `verdict` stays `"none"` and candidate bytes
      are unchanged after refutation/resolution run; no outcome carries a verdict/accept/
      reject/quorum or references `CandidateReviewVerdict`; created records are frozen and
      source-independent (mutating the source finding afterwards does not change the
      record); identical inputs produce deeply-equal outputs; barrel exports resolve via
      ESM `.js` conventions. Confirm each fails (barrel lacks the new symbols).
      <!-- sdd-owner: implementation -->
+ [x] GREEN — extend `guardian/index.ts` barrel with
      `export * from "./refutation.js"` and `export * from "./resolution.js"` (no new
      subpath); ensure immutability/determinism (fresh frozen allocations, no
      `Date.now()`/`new Date()`) in both modules. All RED assertions pass.
      <!-- sdd-owner: implementation -->
+ [x] TRIANGULATE/REFACTOR — verify no clock reads across both modules (static check for
      `Date` usage); verify barrel smoke via `import ... from "guardian/index.ts"` and that
      all supported refutation + resolution symbols resolve with no subpath.
      <!-- sdd-owner: implementation -->
+ [x] Verify the existing Guardian single-review tests (`guardian/__tests__/guardian.test.ts`)
      and the CLI tests remain green and unchanged after this unit. <!-- sdd-owner: implementation -->

---

## Phase 2 — Gates

### 2.1 Typecheck

+ [x] Run `bun run typecheck`; repo `tsc --noEmit` is authoritative and must pass with no
      new errors (pi-lens LSP phantoms are a documented repo defect and are ignored).
      <!-- sdd-owner: implementation -->

### 2.2 Build

+ [x] Run `bun run build`; it must succeed with no changes to `guardian/guardian.ts`, the
      CLI, or any other module. <!-- sdd-owner: implementation -->

### 2.3 Full test

+ [x] Run the full suite `bun run test`; expect the 1158 baseline + the new refutation,
      resolution, and exports tests to all pass with `0` failures. <!-- sdd-owner: implementation -->

---

## Phase 3 — Close

### 3.1 Change record

+ [x] Update this change's state/record to mark apply complete: file map delivered as
      designed (2 new modules + 2 barrel lines + 3 test files), T-GU-001..007 all green,
      gates passed, single-PR size exception applied. <!-- sdd-owner: implementation -->

### 3.2 Orchestrator commit + PR (parent-owned, after apply/verify approve)

+ [x] Start or reuse bounded review, then commit the reviewed candidate and open the single
      PR with the documented size exception (~1060–1420 lines) and the split-fallback note.
      <!-- sdd-owner: parent -->

---

## Acceptance mapping (REQ → tasks)

| Requirement | Task(s) |
| --- | --- |
| REQ-GU-001 Finding binding | T-GU-001 |
| REQ-GU-002 Challenge coverage | T-GU-002 |
| REQ-GU-003 Closed verdict set | T-GU-002 |
| REQ-GU-004 Dual-review independence | T-GU-003 |
| REQ-GU-005 Consistency | T-GU-004 |
| REQ-GU-006 Escalation | T-GU-004 |
| REQ-GU-007 Resolution lifecycle | T-GU-005 |
| REQ-GU-008 Advisory-only boundary | T-GU-007 |
| REQ-GU-009 Fresh review | T-GU-001, T-GU-006 |
| REQ-GU-010 Immutable deterministic records | T-GU-007 |
| REQ-GU-011 Typed denials | T-GU-001..006 |
| REQ-GU-012 No clock | T-GU-007 |
| REQ-GU-013 Barrel exports | T-GU-007 |
| REQ-GU-014 Unit evidence | T-GU-001..007, Phase 2 |
