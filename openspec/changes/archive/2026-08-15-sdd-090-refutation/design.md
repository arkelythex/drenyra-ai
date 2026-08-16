# Refutation Dual-Review and Findings Resolution Design — SDD-090 (Option A)

> Change: `sdd-090-refutation` · Domain: Guardian Angel verification lenses (pure library, first slice)
> This design implements the normative spec (REQ-GU-001..014, SC-GU-001..032, closed decisions D1-D8).

## Overview

Two pure, read-only `guardian/` library modules that make adversarial findings challengeable
and closable WITHOUT granting Guardian records any approval authority:

- `guardian/refutation.ts` — finding-scoped refutation dual-review: a challenge binds a whole
  `GuardianFinding` from the same review's findings array; exactly two independent reviewers
  each return a closed verdict (`uphold | refute | downgrade`); consistency is pure equality
  over the closed vocabulary; disagreement produces an advisory escalation signal only.
- `guardian/resolution.ts` — one-way advisory findings lifecycle: `open → resolved | dismissed`,
  exactly one transition, no reopen/revocation/carry-over, candidate identity enforced via the
  review's `candidateHash`.

Neither module alters `runGuardianReview`'s verdict (always `"none"`), a candidate, a
`CandidateReviewVerdict`, or any approval state (REQ-GU-008). No clock reads (REQ-GU-012);
`referenceTime` is a caller-supplied argument. `guardian/guardian.ts` and the CLI remain
behaviorally unchanged (non-goal).

```text
contracts/ -> guardian/guardian.ts (live findings-only reviewer, unchanged)
           -> guardian/refutation.ts + guardian/resolution.ts (NEW pure lenses)
           -> guardian/index.ts (barrel, +2 exports)
```

## Decisions

### D1. Two cohesive module files, types inline

`guardian/refutation.ts` and `guardian/resolution.ts`, each defining its own public types and
denial codes inline (mirroring the `skills/signature.ts` + `skills/pinning.ts` pattern). The
barrel `guardian/index.ts` extends with `export * from "./refutation.js"` +
`export * from "./resolution.js"`.

**Rationale:** one file per concern with cohesive types keeps the modules self-contained and
mirrors the proven pure-library layout (SDD-070). No new package subpath (REQ-GU-013).

### D2. Review identity = the GuardianReport

Operations take the `GuardianReport` as the review identity (its `candidateHash` is the
candidate identity per spec D6). A challenge/resolution that ASSERTS a `candidateHash`
different from the report's denies with `candidate-changed` (REQ-GU-009); if the challenge/
record asserts no identity, no mismatch is possible (no `candidate-changed`).

**Rationale:** the report already carries the review identity (spec D6); a dedicated identity
record would duplicate it. Findings arrays are validated against `report.findings` (spec D1).

### D3. Two refutation functions (binding, then evaluation)

- `challengeRefutation(report, challenge)` — validates shape + same-review membership +
  asserted identity; returns `accepted` or a typed denial (`malformed-challenge`,
  `unknown-finding`, `candidate-changed`).
- `evaluateDualReview(report, challenge, reviewA, reviewB)` — validates everything (shape,
  membership, identity, verdicts, independence, downgrade target) and returns
  `consistent | inconsistent | denied`.

**Rationale:** the spec separates "challenge binds" (SC-GU-001/002) from "dual review
evaluated" (SC-GU-005..015); two functions map 1:1 to those scenario groups and keep each
denial path independently testable.

### D4. Closed verdict vocabulary with downgrade validation

`RefutationVerdict = "uphold" | "refute" | "downgrade"`. A `downgrade` verdict is valid only
when the challenge carries a `severityOverride` strictly lower than the finding's severity
(`blocker` > `concern` > `info`); otherwise `downgrade-without-target` (spec D2, REQ-GU-003).
Any verdict outside the closed set → `invalid-verdict`.

### D5. Dual-review independence and consistency

Exactly two reviews, each with a `reviewerId`; the two IDs distinct from each other and from
the challenge's `challengerId` — otherwise `invalid-independence` (wrong count, duplicate,
reviewer==challenger). Consistency = pure equality of the two verdicts: identical →
`consistent` (carrying the verdict and, for downgrade, the lowered severity); differing →
`inconsistent` with `escalation: "required"` as an ADVISORY signal only (no verdict, no
approval/block, no third reviewer — REQ-GU-006, SC-GU-016).

### D6. Resolution is one-way and state-explicit

`resolveFinding(report, record, currentDisposition?)` — the library holds no lifecycle state
(spec D5); the caller passes the finding's current disposition (`undefined` = open). A valid
record transitions `open → resolved | dismissed`. Already-terminal → `already-resolved` /
`already-dismissed`; no reopen/revocation path exists.

### D7. Closed typed denials, nothing throws

Every expected domain failure returns a closed typed denial (spec D8, REQ-GU-011):

| Module | Codes |
| --- | --- |
| Refutation (6) | `malformed-challenge`, `unknown-finding`, `invalid-verdict`, `invalid-independence`, `downgrade-without-target`, `candidate-changed` |
| Resolution (8) | `unknown-finding`, `already-resolved`, `already-dismissed`, `empty-reason`, `missing-actor`, `missing-timestamp`, `malformed-record`, `candidate-changed` |

Each denial carries `code`, stable machine-readable `cause`, and actionable `continuation`
(locale-neutral, mirroring the projection/authorization denial discipline). No exception
escapes for expected invalid input (SC-GU-028).

### D8. Immutability, determinism, no clock

Every created outcome/record is `Object.freeze`d with read-only collections; fresh
allocations per call; equal inputs → deeply-equal outputs; no `Date.now()`/`new Date()` —
`referenceTime` is caller-supplied and validated non-empty (REQ-GU-010/012, SC-GU-025/026/029).

## Module layout and file map

```text
guardian/refutation.ts        NEW — challenge + dual-review types, denial codes, validators
guardian/resolution.ts        NEW — resolution lifecycle types, denial codes, validator
guardian/index.ts             EDIT — +2 barrel lines (refutation, resolution)
guardian/__tests__/refutation.test.ts   NEW — challenge binding, verdicts, independence, consistency
guardian/__tests__/resolution.test.ts   NEW — lifecycle, denials, candidate-changed
guardian/__tests__/exports.test.ts      NEW — barrel smoke + advisory-only + existing-guardian green
```

No changes to `guardian/guardian.ts`, `cmd/`, `contracts/`, `candidates/`, `review/`, or any
other module. No new package subpath. No money fields.

## Type definitions (illustrative TypeScript)

```ts
// guardian/refutation.ts
import type { GuardianCategory, GuardianFinding, GuardianReport, GuardianSeverity } from "./guardian.js";

export type RefutationVerdict = "uphold" | "refute" | "downgrade";
export type RefutationDenialCode =
  | "malformed-challenge" | "unknown-finding" | "invalid-verdict"
  | "invalid-independence" | "downgrade-without-target" | "candidate-changed";

export interface RefutationChallenge {
  readonly finding: GuardianFinding;        // whole finding, opaque handle, same-review member
  readonly challengerId: string;
  readonly reason: string;
  readonly severityOverride?: GuardianSeverity; // strictly lower; required for downgrade
  readonly categoryOverride?: GuardianCategory;
  readonly candidateHash?: string;          // asserted identity; mismatch -> candidate-changed
}
export interface RefutationReview {
  readonly reviewerId: string;              // distinct from the other reviewer and the challenger
  readonly verdict: RefutationVerdict;
  readonly reason?: string;
}
export type RefutationChallengeResult =
  | { readonly state: "accepted" }
  | { readonly state: "denied"; readonly code: RefutationDenialCode; readonly cause: string; readonly continuation: string };
export type RefutationDualReviewResult =
  | { readonly state: "consistent"; readonly verdict: RefutationVerdict; readonly loweredSeverity?: GuardianSeverity }
  | { readonly state: "inconsistent"; readonly escalation: "required" }
  | { readonly state: "denied"; readonly code: RefutationDenialCode; readonly cause: string; readonly continuation: string };
```

```ts
// guardian/resolution.ts
import type { GuardianFinding, GuardianReport } from "./guardian.js";

export type ResolutionDisposition = "resolved" | "dismissed";
export type ResolutionDenialCode =
  | "unknown-finding" | "already-resolved" | "already-dismissed" | "empty-reason"
  | "missing-actor" | "missing-timestamp" | "malformed-record" | "candidate-changed";
export interface ResolutionRecord {
  readonly finding: GuardianFinding;
  readonly actorId: string;
  readonly disposition: ResolutionDisposition;
  readonly reason: string;
  readonly evidence?: string;
  readonly referenceTime: string;           // caller-supplied; the library reads no clock
  readonly candidateHash?: string;          // asserted identity; mismatch -> candidate-changed
}
export type ResolutionResult =
  | { readonly state: "applied"; readonly record: Readonly<ResolutionRecord> }
  | { readonly state: "denied"; readonly code: ResolutionDenialCode; readonly cause: string; readonly continuation: string };
```

## Function signatures

```ts
export function challengeRefutation(
  report: GuardianReport,
  challenge: RefutationChallenge,
): RefutationChallengeResult;
// validate challenge shape (finding present, challengerId + reason non-empty),
// same-review membership (report.findings includes challenge.finding),
// asserted identity (challenge.candidateHash vs report.candidateHash).

export function evaluateDualReview(
  report: GuardianReport,
  challenge: RefutationChallenge,
  reviewA: RefutationReview,
  reviewB: RefutationReview,
): RefutationDualReviewResult;
// validate challenge (as above), verdicts (closed set; downgrade needs strictly-lower
// severityOverride), independence (exactly 2, distinct reviewerIds, distinct from
// challengerId), then consistency = verdict equality.

export function resolveFinding(
  report: GuardianReport,
  record: ResolutionRecord,
  currentDisposition?: ResolutionDisposition,  // undefined = open (library holds no state)
): ResolutionResult;
// validate record shape (fields/types), finding membership, identity, non-empty reason,
// non-empty actorId, non-empty referenceTime, current disposition -> apply or deny.
```

## Fail-closed mechanics

Validation order (deterministic, first failure wins — mirroring projection/authorization):

1. **Refutation challenge:** malformed shape → `malformed-challenge`; finding not in
   `report.findings` → `unknown-finding`; asserted `candidateHash` ≠ report's →
   `candidate-changed`.
2. **Dual review adds:** verdict outside closed set → `invalid-verdict`; not exactly two
   reviews / duplicate reviewerId / reviewerId === challengerId → `invalid-independence`;
   `downgrade` without strictly-lower `severityOverride` → `downgrade-without-target`.
3. **Resolution:** malformed record → `malformed-record`; finding not in report.findings →
   `unknown-finding`; asserted identity mismatch → `candidate-changed`; empty reason →
   `empty-reason`; empty actorId → `missing-actor`; empty/malformed referenceTime →
   `missing-timestamp`; currentDisposition already terminal → `already-resolved` /
   `already-dismissed`.

Consistency is computed ONLY after all validation passes; a denial is never reported as
consistency (spec D3).

## Immutability and advisory guarantees

- All created outcomes/records frozen; fresh arrays; source mutation cannot alter a created
  record (SC-GU-025).
- Neither module touches `verdict` (always `"none"`), candidates, `CandidateReviewVerdict`,
  quorum, or approval state (SC-GU-021/022). `inconsistent` carries NO verdict and names no
  third reviewer (SC-GU-016).
- No clock, no I/O, no network, no persistence (REQ-GU-012).

## Export plan

`guardian/index.ts` adds:

```ts
export * from "./guardian.js";
export * from "./refutation.js";
export * from "./resolution.js";
```

No package.json change (REQ-GU-013, SC-GU-031).

## Test plan and strict TDD order

Strict TDD is active (`bun run test`). Each unit writes the focused RED test first.

| Unit | Files | RED | GREEN criteria | REQ/SC |
| --- | --- | --- | --- | --- |
| T-GU-001 challenge binding | refutation.test.ts | accepted/denied paths fail (module missing) | same-review accepted; foreign finding → `unknown-finding`; missing shape → `malformed-challenge`; asserted identity mismatch → `candidate-changed` | REQ-GU-001/009, SC-GU-001/002/023 |
| T-GU-002 verdicts + downgrade | refutation.test.ts | fail on absent impl | closed set accepted for all severities/categories; `invalid-verdict`; `downgrade-without-target` (no override / not strictly lower) | REQ-GU-002/003, SC-GU-003/004/005/006/013/014 |
| T-GU-003 independence | refutation.test.ts | fail on absent impl | 2 distinct reviewers pass; reviewer==challenger, duplicate, wrong count → `invalid-independence` | REQ-GU-004, SC-GU-007/008/009/010 |
| T-GU-004 consistency matrix | refutation.test.ts | fail on absent impl | uphold/uphold, refute/refute, downgrade/downgrade (lowered severity) → `consistent`; mixed → `inconsistent` + escalation advisory, no verdict/no approval | REQ-GU-005/006, SC-GU-011/012/015/016 |
| T-GU-005 resolution lifecycle | resolution.test.ts | fail on absent impl | open→resolved; open→dismissed; double-resolution → `already-resolved`/`already-dismissed`; no reopen/revocation | REQ-GU-007, SC-GU-017/018/019/020 |
| T-GU-006 resolution denials | resolution.test.ts | fail on absent impl | `empty-reason`, `missing-actor`, `missing-timestamp`, `malformed-record`, `unknown-finding`, `candidate-changed`; never throws | REQ-GU-009/011, SC-GU-023/027/028/030 |
| T-GU-007 advisory + immutability + determinism + exports | exports.test.ts | fail on absent impl | verdict stays "none"; no approval signal; frozen + source-independent; deterministic; barrel resolves; existing guardian/CLI tests green | REQ-GU-008/010/012/013/014, SC-GU-021/022/025/026/029/031/032 |

Final gates: `bun run typecheck` (repo tsc --noEmit authoritative; ignore pi-lens LSP phantoms —
documented repo defect), `bun run build`, full `bun run test` (expect baseline 1158 + new, 0 failures).

## Honest changed-line estimate

| Area | Estimated |
| --- | ---: |
| `guardian/refutation.ts` | 170–220 |
| `guardian/resolution.ts` | 150–200 |
| `guardian/index.ts` (+2) | 2–4 |
| Refutation tests | 320–420 |
| Resolution tests | 300–400 |
| Exports/advisory tests | 120–180 |
| **Total** | **~1060–1420** |

Sized from mandated coverage (consistency matrix, independence, full lifecycle, every denial
code, identity change, immutability, determinism, advisory-only proofs) — consistent with the
program-wide lesson that coverage mandates ~2x naive estimates. Single PR with a documented
size exception (precedent 425/588/1043/1601/1773, user-approved continuation); chained
refutation/resolution split is the fallback.

## Open risks

1. **Finding-id stability (HIGH, carried):** `GuardianFinding.id` is a per-process sequence —
   binding the WHOLE finding + same-array membership closes it; content-derived IDs are a
   follow-up touching the live reviewer (out of scope).
2. **Advisory-boundary drift (MEDIUM):** refutation/resolution must never approve/block —
   guarded by SC-GU-021/022 tests and the `inconsistent` no-verdict shape.
3. **`candidateHash` optionality (MEDIUM):** operations that assert no identity cannot detect
   candidate change — documented; callers SHOULD always assert it (the CLI/reviewer wiring is
   a follow-up slice).
4. **Budget overrun (HIGH):** ~1060–1420 vs 400 review unit — exception precedent applies;
   no coverage dropped.
