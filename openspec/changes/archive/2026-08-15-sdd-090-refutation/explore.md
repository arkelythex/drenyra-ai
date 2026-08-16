# Exploration — SDD-090 Refutation Dual-Review + Findings Resolution (first slice)

> Purpose: size and recommend the first implementation slice of SDD-090's pending
> core — **refutation dual-review** and **findings resolution** — as pure, read-only
> library modules mirroring the SDD-070 `signature.ts`/`pinning.ts` precedent. This is
> a sizing/design exploration only: no code, tests, or commits are written. The suite
> stays 1158/1158 at `main` @ `bc8c662`.
>
> Repository scope: `drenyra-ai` only. The harness-side review-refuter agent is
> tooling outside this repo and is deliberately NOT imported or modeled here.

## Baseline evidence

- **Suite:** 1158/1158 at `main` @ `bc8c662` (clean). This exploration writes no code.
- **Guardian core (implemented, read-only single review):**
  `guardian/guardian.ts` — `runGuardianReview(candidate, options): GuardianReport`;
  `verdict` is always `"none"`; findings only (`GuardianFinding` severity
  blocker/concern/info, categories scope/materiality/approval/evidence/integrity);
  checks: checksummed RUC, valid period, subject-hash integrity, declared materiality
  tier, R3 dual distinct approvers (`r3DualRequired`), missing-review-history concern.
  Does not mutate the candidate. Exported via `guardian/index.ts`.
- **Pending core (verified absent):** grep for `refutation` / `dual-review` /
  `refuter` across `*.ts` = zero matches (the only hit is a prose comment in
  `guardian/guardian.ts`). `findings-resolution` = zero matches. No Command Center
  (SDD-100) integration.
- **Governance amendment (SDD-090 README, W3):** findings are advisory records with
  **no authority state**; a finding (or its absence) never approves or blocks on its
  own; a candidate change requires a **fresh review** — resolutions never carry over.

---

## 1. Current-state inventory

### 1.1 Guardian surface (`guardian/guardian.ts`)

Exact symbols:

- `type GuardianSeverity = "blocker" | "concern" | "info"`.
- `type GuardianCategory = "scope" | "materiality" | "approval" | "evidence" | "integrity"`.
- `interface GuardianFinding { id: string; severity; category; description }`.
  `id` is generated as `guardian-${findingSeq}` from a **module-level counter**
  (`let findingSeq = 0`); ids are not content-derived and are only stable within a
  single process invocation.
- `interface GuardianReport { candidateHash; findings; verdict: "none"; reviewedAt }`.
  Findings sorted blocker-first.
- `interface GuardianOptions { r3DualRequired?: boolean }`.
- `runGuardianReview(candidate, options)`: pure, deterministic for a fixed candidate
  - options (the only non-pure output is `reviewedAt = new Date().toISOString()`).
- `guardian/index.ts` re-exports everything (`export * from "./guardian.js"`).

Implication for refutation: a `RefutationChallenge` must bind to a finding. The
stable reference is the finding **`id`** carried on the `GuardianFinding` in the
report output (the natural handoff from `runGuardianReview`). Because ids are
per-process sequence values, a pure refutation library should treat the finding as an
opaque handle — it targets `findingId` and must also hold the finding's
severity/category/description to anchor the challenge. The simplest and most honest
contract is to pass the whole `GuardianFinding` (or at least `{ id, severity,
category }`) into the challenge rather than only a raw string id.

### 1.2 Review precedent (`review/lenses.ts`, `review/workload.ts`, `candidates/types.ts`)

- `review/lenses.ts`: `ReviewLens` (`review-risk`/`resilience`/`readability`/
  `reliability`/`judgment-day`), `ALL_4R_LENSES`, `selectReviewLenses`,
  `getLensDescription`. There is **no refutation concept** — lenses select review
  *depth*; they do not adjudicate findings.
- `review/workload.ts`: `forecastReviewWorkload`, `ReviewWorkloadForecast`,
  `ChainStrategy`, `DeliveryStrategy`. Planning-only; no adjudication.
- `candidates/types.ts`: `CandidateReviewVerdict = "accept" | "reject"` and
  `CandidateReview { id, verdict, reason?, reviewer, reviewedAt }`. This is the
  existing "challenge" surface — a human/agent review verdict recorded on a candidate.
  It is a **binary accept/reject**, not a finding-scoped refutation.
- `review/index.ts` exports lenses + workload.

Implication: the Guardian's refutation is **orthogonal** to the review module and to
`CandidateReviewVerdict`. There is no existing symbol to reuse; the refutation and
resolution semantics must be net-new pure modules. The review module stays untouched.

### 1.3 SDD-070 pure-library precedent (pattern to mirror)

`skills/signature.ts` + `skills/pinning.ts` (`2026-08-15-sdd-070-skill-supply-chain`):

- Discriminated-union results: `{ valid: true; ... } | { valid: false; denial }`.
- Closed typed denial vocabularies (`MissionSkillPinDenialCode`) with frozen,
  canonical-order `reasons` arrays.
- `Object.freeze` on all outputs; **never throws** and never mutates caller inputs.
- No API reads the clock (timestamp is a caller-supplied arg).
- Runtime shape guards for untrusted input.
- Sized honestly at ~1100–1400 authored lines with the lesson that mandated-coverage
  forecasts undercount ~2×.

This is the exact template for `guardian/refutation.ts` + `guardian/resolution.ts`.

---

## 2. Gap analysis

| Declared lens (README) | Status today | Gap |
|---|---|---|
| Read-only frozen candidates | Implemented | `runGuardianReview` emits findings; `verdict:"none"` |
| Refutation dual-review | Absent | no symbols; no adjudication of findings |
| Findings resolution | Absent | no lifecycle (open → resolved/dismissed); no records |
| Command Center integration | Absent | SDD-100 consumer; out of this repo's slice |

The implemented core proves the adversarial single review. The declared core also
requires findings to be challengeable (refutation) and closable (resolution), which
are genuinely absent. Per R3/R4, this slice does not promote the lifecycle; it closes
two of the pending verification-lens gaps.

---

## 3. Design sketch

### 3.1 Refutation dual-review (`guardian/refutation.ts`, pure)

Advisory only, **no authority state** (governance amendment). Two independent
reviewers each judge a finding; their verdicts are compared for consistency.

```ts
// Semantics (sketch, not final API)
type RefutationVerdict = "uphold" | "refute" | "downgrade";

interface RefutationChallenge {
  findingId: string;      // anchor: the GuardianFinding.id from runGuardianReview
  challengerId: string;   // the actor raising the challenge (independent reviewer #1)
  reason: string;         // why the finding is wrong / overstated
  severityOverride?: GuardianSeverity;  // claim: severity is wrong
  categoryOverride?: GuardianCategory;  // claim: category is wrong
}

interface RefutationReview {          // one reviewer's independent judgment
  reviewerId: string;                 // distinct from challengerId (independence)
  verdict: RefutationVerdict;
  reason?: string;
}

interface RefutationDualReview {
  challenge: RefutationChallenge;
  reviews: readonly RefutationReview[];   // exactly 2, distinct reviewerId
  // consistency decision
  state: "consistent" | "inconsistent";
  // consistent = both reviewers return the same verdict
  // inconsistent = verdicts differ (or one review is malformed) -> escalate
}
```

Key decisions (recommended):

- **All findings are challengeable** — the Guardian is adversarial and nothing is
  sacred. The README names *inferential* findings as the refutation *target*, but
  deterministic findings are equally challengeable on correctness grounds (e.g. a
  challenge that a scope check misread the RUC). Restricting to inferential-only
  requires a `finding.kind` that does not exist today and adds a category with no
  consumer. **Recommendation: challenge anything; the dual-review still applies
  identically.** This keeps the type surface minimal and matches the "adversarial"
  posture.
- **Verdict vocabulary:** `uphold` | `refute` | `downgrade`. `downgrade` captures the
  "the finding is real but the severity is overstated" case (severityOverride).
  Dropping it would force every partial-agreement into binary uphold/refute and lose
  the severity nuance the README's severity model exists for.
- **Consistency:** consistent ⟺ the two reviewers return the identical `verdict`.
  Inconsistent (verdicts differ, a reviewer is missing, or a review is malformed)
  ⟺ `state: "inconsistent"` → escalate to a human/further review. There is no
  third-tiebreaker in this slice (an escalation surface is a follow-up).
- **Advisory, no authority:** the `state` never approves or blocks a candidate. It is
  metadata a professional/gate may consume. `RefutationVerdict` is a *claim about a
  finding*, not a candidate verdict (`CandidateReviewVerdict` stays untouched).
- Independent review verification: both reviewers must be present with distinct
  `reviewerId` (and distinct from `challengerId`); otherwise the review is invalid →
  `state: "inconsistent"`. This enforces "two independent reviewers".

### 3.2 Findings resolution (`guardian/resolution.ts`, pure)

A finding lifecycle: `open → resolved | dismissed`. Advisory only — resolution does
**not** approve or block, and a candidate change requires a fresh review (resolutions
never carry over).

```ts
type ResolutionDisposition = "resolved" | "dismissed";

interface ResolutionRecord {
  findingId: string;     // anchor to a GuardianFinding
  actorId: string;       // who resolved/dismissed
  disposition: ResolutionDisposition;
  reason: string;
  evidence?: string;     // optional supporting evidence reference
  timestamp: string;     // caller-supplied ISO; pure library reads no clock
}

interface FindingResolution {
  // lifecycle state machine over a finding id
  resolve(record: ResolutionRecord): ...;
  dismiss(record: ResolutionRecord): ...;
}
```

Key decisions (recommended):

- **Single-owner record:** a resolution is a leaf decision — one `ResolutionRecord`
  moves a finding from `open` to `resolved`/`dismissed`. No re-open in this slice
  (a fresh review resets everything; that is the governance boundary).
- **Typed denial codes** (mirror `pinning.ts`): e.g.
  `unknown-finding` | `already-resolved` | `already-dismissed` | `empty-reason` |
  `missing-actor` | `missing-timestamp` | `malformed-record` | `candidate-changed`.
  `candidate-changed` encodes "a candidate change requires fresh review; resolutions
  never carry over" as a fail-closed denial rather than silent invalidation.
- **Advisory-only proof:** a resolution record explicitly carries no authority or
  approval signal; there is no way to derive an approval from it. Test asserts a
  resolution can never set `verdict` or mutate a candidate.

### 3.3 Module layout (mirrors SDD-070)

```
guardian/
  refutation.ts   -> RefutationChallenge, RefutationReview, RefutationDualReview,
                     reviewFinding(dual) pure fn, typed denial/state
  resolution.ts   -> ResolutionRecord, ResolutionDisposition, finding lifecycle,
                     typed denial codes
  index.ts        -> export * from "./guardian.js"; "./refutation.js"; "./resolution.js"
  __tests__/refutation.test.ts
  __tests__/resolution.test.ts
```

No wiring into `runGuardianReview`, `flow/`, or `cmd/` in Option A.

---

## 4. First-slice options

| Option | Contents | Relative size | Risk |
|--------|----------|---------------|------|
| **A (recommended)** | `guardian/refutation.ts` + `guardian/resolution.ts` as pure libraries + unit tests. No wiring into `runGuardianReview` or `cmd`. | Medium | Low |
| **B** | A + wire refutation state into `runGuardianReview`/`GuardianFinding` (findings carry challenge/refutation state). | Medium–large | Medium–high (touches the live reviewer's types + output shape; existing tests/CLI consumers may break) |
| **C** | A/B + `cmd` surface (extend `candidate audit` with `--refute`/`--resolve`, or new subcommands). | Large | Medium–high (CLI contract churn; help-text/usage regression surface) |

**Recommendation — Option A.** It is the smallest vertical slice that independently
satisfies two of SDD-090's core threats (unrefuted false findings; unresolved stale
findings) with zero risk to the live single-review path, and it establishes the
`RefutationChallenge`/`ResolutionRecord` shapes that wiring (B) and CLI (C) later
build on. This mirrors the SDD-070 recommendation exactly (pure library first,
wiring later).

**Honest changed-line estimate: ~1100–1500 authored lines.** The mandated coverage
from the SDD-090 README — refutation dual-review consistency for inferential (and,
per our decision, all) findings, re-review on identity change, read-only/advisory
enforcement — plus the pure-library discipline (typed denial codes, `Object.freeze`,
runtime guards, never throws, no clock reads) drives the size. Applying the 2×
undercount lesson from SDD-070, the floor is ~900 and the realistic range is
**~1100–1500**; Option A sits at the low end of that band, Option B +200–400, Option
C +300–600 on top of B.

---

## 5. Recommendation

**Option A — pure `guardian/refutation.ts` + `guardian/resolution.ts` + unit tests;
no wiring, no CLI.** Target: ~1100–1500 authored lines. Defer wiring (B) and CLI (C)
to follow-up slices.

---

## 6. Non-goals

- **No wiring into `runGuardianReview`** — findings do not carry refutation/resolution
  state in this slice; `GuardianFinding`/`GuardianReport` shapes are unchanged.
- **No CLI surface** — `candidate audit` stays findings-only; `--refute`/`--resolve`
  are follow-ups.
- **No Command Center integration** — SDD-100 is the consumer; out of scope here.
- **No escalation adjudication** — an `inconsistent` dual review is recorded/escalated
  as a signal; there is no third-tiebreaker or human-adjudication surface in this slice.
- **No resolution re-open / revocation** — a finding moves open→resolved/dismissed once
  per review; the fresh-review rule resets state.
- **No authority/approval derivation** — advisory only; a resolution never approves or
  blocks and never touches `CandidateReviewVerdict`.
- **No lifecycle promotion** — per R3/R4, the SDD-090 record stays `active`/`planned`.

---

## 7. Risks

1. **Finding-id stability (HIGH):** `GuardianFinding.id` is a per-process sequence
   (`guardian-${findingSeq}`), not content-derived. Refutation/resolution bind to
   `findingId`, so ids are not portable across invocations. Mitigation: challenge/
   resolve within the same review's findings array; document ids as process-scoped
   handles. A follow-up could switch to content-derived ids, but that changes
   `guardian.ts` (out of this slice).
2. **Scope creep into wiring (MEDIUM):** the natural next step after A is wiring into
   `runGuardianReview`, which touches live types + the existing test/CLI surface and
   can break consumers. Guarded by making Option A explicitly non-wiring and leaving B/C
   as separate slices.
3. **Advisory-boundary drift (MEDIUM):** reviewers may be tempted to make resolution
   or `state` approval-like. Guarded by advisory-only tests (resolution/refutation can
   never set a verdict or mutate a candidate) and the fresh-review rule encoded as a
   denial code.
4. **CLI/contract freeze (LOW for A):** since A writes no `cmd` or `flow` changes,
   the live command surface and candidate contract stay byte-identical.

---

## 8. Test / metric hints (mapped to the SDD-090 README contract)

- **Refutation dual-review consistency for inferential (and all) findings:** test both
  reviewers return `uphold` → `consistent`; `refute`/`refute` → `consistent`; mixed
  verdicts → `inconsistent`; missing/distinct reviewer → `inconsistent`.
- **Downgrade semantics:** `severityOverride` present + both `downgrade` → consistent,
  finding severity flagged as overstated.
- **Re-review on identity change:** resolution denied with `candidate-changed` when the
  caller asserts a changed candidate identity; resolution records never carry across a
  candidate identity change.
- **Read-only/advisory enforcement:** assert no refutation or resolution path returns
  an approval, sets a `verdict`, or mutates a `Candidate`; outputs are `Object.freeze`d
  (mirror `pinning.ts` test discipline).
- **Determinism:** no clock reads — `timestamp` is caller-supplied; same inputs →
  same denial/state output.
- **Typed denials:** each denial code has a direct test (empty reason, missing actor,
  already-resolved, unknown finding, malformed record).
- **Regression guard:** `guardian.test.ts`, `review` lenses/workload tests, and the
  `candidate audit` CLI test remain untouched and green (1158/1158).

---

## 9. Skill resolution

- `skill_resolution`: `paths-injected` (SDD-070/vertical-closures archives and the
  review/guardian modules read before work; no registry skill strongly matched this
  read-only mapping task).
