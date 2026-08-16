# Refutation Dual-Review and Findings Resolution Specification — SDD-090 (Option A)

> Change: `sdd-090-refutation` · Domain: Guardian Angel verification lenses (new pure
> `guardian/refutation.ts` and `guardian/resolution.ts` library modules, first slice)
>
> Repository convention: this repo keeps change specs as flat files under
> `openspec/changes/{change}/spec.md`; no canonical `openspec/specs/{domain}/spec.md`
> tree exists yet, so this is a full domain spec for the change, preserved as-is at archive.
>
> This specification defines behavior only (WHAT must be true). API shape, exact function
> signatures, collection types, and whether a denial is returned by a separate function are
> design decisions (HOW) and are intentionally not fixed here. Illustrative payload shapes
> are transport-neutral and not frozen contracts.

## Purpose

Complete two missing Guardian Angel verification-lens gaps as pure, read-only library
modules: **finding-scoped refutation dual-review** (a challenge against a finding,
adjudicated by exactly two independent reviewers, compared for consistency) and
**findings resolution** (a one-way, advisory lifecycle from `open` to `resolved` or
`dismissed`). Both modules make adversarial findings challengeable and closable without
granting Guardian records any approval authority: a refutation verdict concerns a finding,
a resolution disposition records a finding lifecycle transition, and neither is a
candidate verdict. Every outcome is advisory evidence for professionals and gates; the
Guardian review core (`runGuardianReview`) and the CLI remain behaviorally unchanged.

## Normative decisions (closed in this specification)

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | A challenge binds the **whole `GuardianFinding`** from the same review's findings array, preserving its `id` as an opaque, process-scoped handle. | `GuardianFinding.id` is a per-process sequence, not content-derived; anchoring the whole finding plus same-array membership closes the identity-stability risk. |
| D2 | Verdict vocabulary is exactly `uphold` \| `refute` \| `downgrade`; `downgrade` means the finding stands with a **strictly lower** severity. | Keeps the severity model meaningful; binary uphold/refute would lose the overstated-severity case. |
| D3 | `consistent` ⟺ both valid reviews have the **identical verdict**; different verdicts are `inconsistent`; malformed or non-independent input is a **typed denial** distinct from `inconsistent`. | A denial and a valid-but-disagreeing result are different facts; both fail closed and neither is authoritative. |
| D4 | Reviewers are identified: each review carries a `reviewerId`, distinct from the other reviewer and from the challenger. The verdict-comparison function is pure equality over the closed vocabulary (its shape is a design decision). | "Two independent reviewers" is only meaningful when identities are distinct and comparable. |
| D5 | Resolution lifecycle is `open → resolved \| dismissed`, exactly one transition, no reopen, no revocation, no carry-over. | Matches the governance amendment: a candidate change requires a fresh review. |
| D6 | Candidate identity is the review's `candidateHash`; mismatch returns `candidate-changed`. A dedicated review-identity record is a possible design detail, not a spec requirement. | Closes the same-review freshness requirement with the identity already carried by `GuardianReport`. |
| D7 | `referenceTime` is a caller-supplied non-empty value; the library reads no clock. Strict ISO-8601 validation is a design decision and MAY be added. | Mirrors the SDD-070 pure-library precedent and keeps outputs deterministic. |
| D8 | Expected domain failures return closed typed denials; nothing throws for expected invalid input. | Mirrors the SDD-070 `pinning.ts`/`signature.ts` discipline. |

## Illustrative payload shapes (transport-neutral, NOT a frozen contract)

```ts
// guardian/refutation.ts (semantics sketch; final API is a design decision)
type RefutationVerdict = "uphold" | "refute" | "downgrade";

interface RefutationChallenge {
  finding: GuardianFinding;        // whole finding, opaque handle, from the same review
  challengerId: string;
  reason: string;
  severityOverride?: GuardianSeverity; // must be strictly lower; required for downgrade
  categoryOverride?: GuardianCategory;
  candidateHash?: string;          // review identity for candidate-changed detection
}

interface RefutationReview {
  reviewerId: string;              // distinct from challengerId and the other reviewer
  verdict: RefutationVerdict;
  reason?: string;
}

// Dual evaluation outcome (design decides the exact discriminated shape):
//   { state: "consistent", verdict } | { state: "inconsistent", escalation: "required" }
//   | { state: "denied", code: RefutationDenialCode }
```

```ts
// guardian/resolution.ts (semantics sketch; final API is a design decision)
type ResolutionDisposition = "resolved" | "dismissed";

interface ResolutionRecord {
  finding: GuardianFinding;        // whole finding, opaque handle
  actorId: string;
  disposition: ResolutionDisposition;
  reason: string;
  evidence?: string;               // optional supporting evidence reference
  referenceTime: string;           // caller-supplied; the library reads no clock
  candidateHash: string;           // review identity; mismatch denies with candidate-changed
}

// Outcome (design decides the exact discriminated shape):
//   { state: "applied", record } | { state: "denied", code: ResolutionDenialCode }
```

## Requirements

### Requirement: REQ-GU-001 — Finding binding

The refutation operation MUST bind a challenge to the whole `GuardianFinding` produced by
a Guardian review, preserving the finding's `id` as an opaque, process-scoped handle. The
operation MUST accept a finding only when it is an element of the findings array of the
same review the challenge targets; a free-standing raw `id` SHALL NOT be sufficient to
bind a challenge.

#### Scenario: SC-GU-001 — Challenge binds a finding from the same review

- GIVEN a Guardian report whose findings array contains a blocker scope finding
- WHEN a challenge binds that whole finding with a challengerId and a reason
- THEN the challenge is accepted for evaluation AND the finding's `id` is preserved as an opaque handle

#### Scenario: SC-GU-002 — Unknown finding fails closed

- GIVEN a challenge whose bound finding is not an element of the same review's findings array
- WHEN the refutation operation validates it
- THEN it returns a typed `unknown-finding` denial AND performs no evaluation

### Requirement: REQ-GU-002 — Challenge coverage

The refutation operation MUST accept a challenge against any `GuardianFinding` regardless
of severity (`blocker`, `concern`, `info`) or category. The slice MUST NOT introduce a
finding-kind distinction; no finding is exempt from challenge.

#### Scenario: SC-GU-003 — Every severity and category is challengeable

- GIVEN findings of severity blocker, concern, and info across the five Guardian categories
- WHEN a separate challenge binds each finding
- THEN every challenge is accepted for evaluation

#### Scenario: SC-GU-004 — Refute applies to every severity

- GIVEN a blocker, a concern, and an info finding, each with its own challenge
- WHEN both reviewers return `refute` for each challenge
- THEN each dual review is `consistent` with verdict `refute`

### Requirement: REQ-GU-003 — Closed verdict set

Each reviewer judgment MUST use exactly one of the closed verdicts `uphold`, `refute`, or
`downgrade`. Any other value MUST fail closed with a typed denial. A `downgrade` verdict
is valid only when the challenge carries a `severityOverride` that is strictly lower than
the finding's severity (severity order: `blocker` > `concern` > `info`).

#### Scenario: SC-GU-005 — Closed verdicts accepted

- GIVEN two valid reviewer judgments
- WHEN both return `uphold`, or both return `refute`, or both return `downgrade`
- THEN each accepted evaluation produces a consistent result

#### Scenario: SC-GU-006 — Unknown verdict fails closed

- GIVEN a reviewer judgment whose verdict is not one of `uphold`, `refute`, `downgrade`
- WHEN the operation validates it
- THEN it returns a typed `invalid-verdict` denial

### Requirement: REQ-GU-004 — Dual-review independence

An evaluation MUST contain exactly two reviewer judgments, each carrying a `reviewerId`.
The two reviewer IDs MUST be distinct from each other and from the challenge's
`challengerId`. Any violation — wrong review count, duplicate reviewer, or a reviewer
identical to the challenger — MUST fail closed and MUST NOT be reported as consistency.

#### Scenario: SC-GU-007 — Two distinct independent reviewers

- GIVEN two reviewer judgments with distinct reviewerIds, both distinct from the challengerId
- WHEN the dual review is evaluated
- THEN the reviews are accepted as independent

#### Scenario: SC-GU-008 — Reviewer equals challenger fails closed

- GIVEN a reviewer judgment whose reviewerId equals the challengerId
- WHEN the operation validates independence
- THEN it returns a typed `invalid-independence` denial

#### Scenario: SC-GU-009 — Duplicate reviewers fail closed

- GIVEN two reviewer judgments carrying the same reviewerId
- WHEN the operation validates independence
- THEN it returns a typed `invalid-independence` denial

#### Scenario: SC-GU-010 — Wrong review count fails closed

- GIVEN exactly one reviewer judgment, or three
- WHEN the operation validates the dual review
- THEN it returns a typed `invalid-independence` denial

### Requirement: REQ-GU-005 — Consistency

A dual review MUST be `consistent` if and only if both valid reviewer judgments carry the
identical verdict. Different verdicts MUST produce the `inconsistent` outcome. Consistency
is decided by equality of the two verdict values over the closed vocabulary.

#### Scenario: SC-GU-011 — Consistent uphold

- GIVEN two valid reviews that both return `uphold` for a valid challenge
- WHEN the dual review is evaluated
- THEN the outcome is `consistent` with verdict `uphold`

#### Scenario: SC-GU-012 — Consistent refute

- GIVEN two valid reviews that both return `refute`
- WHEN the dual review is evaluated
- THEN the outcome is `consistent` with verdict `refute`

#### Scenario: SC-GU-013 — Consistent downgrade lowers severity

- GIVEN a blocker finding and a challenge whose severityOverride is `concern`
- WHEN both reviewers return `downgrade`
- THEN the outcome is `consistent` with verdict `downgrade` AND the lowered severity is `concern`

#### Scenario: SC-GU-014 — Downgrade without a valid target fails closed

- GIVEN a reviewer returning `downgrade` for a challenge with no severityOverride, or with an override that is not strictly lower
- WHEN the operation validates it
- THEN it returns a typed `downgrade-without-target` denial

### Requirement: REQ-GU-006 — Escalation

An `inconsistent` dual review — both reviews valid but disagreeing — MUST produce an
escalation-needed advisory outcome. Invalid or malformed dual input MUST fail closed with
a typed denial. Neither outcome MAY approve, reject, block, or execute a candidate, and
this slice MUST NOT invoke a third reviewer or automate escalation; the escalation signal
is advisory evidence for a human or a follow-up slice.

#### Scenario: SC-GU-015 — Mixed verdicts are inconsistent

- GIVEN two valid reviews where one returns `uphold` and the other returns `refute`
- WHEN the dual review is evaluated
- THEN the outcome is `inconsistent` with escalation required

#### Scenario: SC-GU-016 — Escalation never decides

- GIVEN an `inconsistent` dual review
- WHEN the caller inspects the outcome
- THEN it is an advisory escalation signal only: it carries no verdict, approves nothing, blocks nothing, and names no third reviewer

### Requirement: REQ-GU-007 — Resolution lifecycle

A finding under a review identity MUST begin `open`. A single valid resolution record MAY
transition it to `resolved` or `dismissed`. A finding that has reached a terminal
disposition MUST deny any further transition in this slice with `already-resolved` or
`already-dismissed`; reopen and revocation are not supported. The library holds no
lifecycle state itself; prior resolution state is an explicit input.

#### Scenario: SC-GU-017 — Open to resolved

- GIVEN an `open` finding under a review identity
- WHEN a valid resolution record with disposition `resolved`, actorId, reason, and referenceTime is applied
- THEN the finding is `resolved` AND a frozen record is produced

#### Scenario: SC-GU-018 — Open to dismissed

- GIVEN an `open` finding under a review identity
- WHEN a valid resolution record with disposition `dismissed` is applied
- THEN the finding is `dismissed` AND a frozen record is produced

#### Scenario: SC-GU-019 — Double resolution fails closed

- GIVEN a finding already transitioned to `resolved`
- WHEN a second resolution record, `resolved` or `dismissed`, is applied
- THEN the operation returns `already-resolved` AND produces no record

#### Scenario: SC-GU-020 — No reopen or revocation

- GIVEN a finding in a terminal disposition (`resolved` or `dismissed`)
- WHEN a caller attempts to reopen or revoke it
- THEN the operation denies with `already-resolved` or `already-dismissed`; no reopen or revocation path exists in this slice

### Requirement: REQ-GU-008 — Advisory-only boundary

Neither refutation nor resolution outputs MUST alter a Guardian review's `verdict` (always
`"none"`), a candidate, a `CandidateReviewVerdict`, an approval quorum, or any
candidate/review/approval state. Outputs MUST carry no authority state and MUST NOT be
usable as approval, rejection, or execution signals.

#### Scenario: SC-GU-021 — Verdict stays "none"

- GIVEN a Guardian report whose verdict is `"none"`
- WHEN refutation and resolution operations run against its findings
- THEN the report's verdict remains `"none"` AND the candidate bytes are unchanged

#### Scenario: SC-GU-022 — No approval signal derivable

- GIVEN any refutation outcome or resolution record
- WHEN it is inspected
- THEN it contains no verdict, no accept/reject value, no quorum signal, and no reference to `CandidateReviewVerdict`

### Requirement: REQ-GU-009 — Fresh review

When a challenge or resolution asserts a candidate identity that differs from the review
identity it is scoped to, the operation MUST deny with `candidate-changed`. Findings,
challenges, and resolutions MUST NOT carry over to a changed candidate; a fresh Guardian
review is required.

#### Scenario: SC-GU-023 — Candidate change denies with candidate-changed

- GIVEN a challenge or resolution record scoped to review identity (candidateHash) A
- WHEN the operation is invoked with an asserted candidate identity B, where B differs from A
- THEN it returns a typed `candidate-changed` denial AND creates no record; a fresh review is required

#### Scenario: SC-GU-024 — No carry-over across candidates

- GIVEN prior findings, challenges, and resolutions recorded for candidate A
- WHEN candidate B is presented
- THEN no finding, challenge, or resolution for A is applied to B; every operation on B starts from a fresh review

### Requirement: REQ-GU-010 — Immutable deterministic records

Every created record and outcome MUST be immutable (frozen) with read-only collections;
subsequent mutation of any source input MUST NOT change a created record. Identical inputs
MUST produce identical outputs, with no dependence on ambient time, call order, or process
state.

#### Scenario: SC-GU-025 — Records are frozen and source-independent

- GIVEN a created refutation outcome or resolution record
- WHEN the source finding or another input object is mutated afterwards
- THEN the created record's contents do not change; created outputs are frozen with read-only collections

#### Scenario: SC-GU-026 — Deterministic for equal inputs

- GIVEN two invocations with identical inputs (same finding, same reviews, same caller-supplied timestamps)
- WHEN both run
- THEN they produce identical outputs regardless of wall-clock time or call order

### Requirement: REQ-GU-011 — Typed denials

Every expected domain failure — malformed input, unknown finding, invalid verdict, invalid
independence, missing fields, and invalid lifecycle transitions — MUST return a closed
typed denial carrying a code from the defined vocabulary. Expected invalid input MUST NOT
require exception handling and MUST NOT throw.

Closed denial vocabulary:

| Code | Meaning |
| --- | --- |
| `malformed-challenge` | challenge missing the finding, challengerId, or reason; or severityOverride present but not strictly lower |
| `unknown-finding` | bound finding is not an element of the same review's findings array |
| `invalid-verdict` | review verdict outside the closed set |
| `invalid-independence` | not exactly two reviews, duplicate reviewerId, or reviewerId equals challengerId |
| `downgrade-without-target` | a `downgrade` verdict with no strictly-lower severityOverride on the challenge |
| `already-resolved` | resolution attempted on a finding already `resolved` |
| `already-dismissed` | resolution attempted on a finding already `dismissed` |
| `empty-reason` | resolution reason missing or empty |
| `missing-actor` | resolution actorId missing or empty |
| `missing-timestamp` | referenceTime missing or malformed |
| `malformed-record` | resolution record shape invalid (wrong fields or types) |
| `candidate-changed` | asserted candidate identity differs from the review identity |

#### Scenario: SC-GU-027 — Typed denials for expected failures

- GIVEN each expected failure: empty reason, missing actor, missing timestamp, unknown finding, invalid verdict, invalid independence, and malformed record
- WHEN the operation runs
- THEN it returns the corresponding typed denial without throwing

#### Scenario: SC-GU-028 — Expected invalid input never throws

- GIVEN untrusted or malformed input
- WHEN the operation validates it
- THEN it returns a denial value; no exception escapes for any expected invalid input

### Requirement: REQ-GU-012 — No clock

The libraries MUST NOT read the system clock. Timestamps (`referenceTime`) MUST be
caller-supplied and validated as non-empty; strict ISO-8601 format validation MAY be
adopted by the design but is not required by this specification.

#### Scenario: SC-GU-029 — No clock reads

- GIVEN a caller-supplied referenceTime
- WHEN the operation runs at different wall-clock times with identical inputs
- THEN the outputs are identical; the library never reads the clock

#### Scenario: SC-GU-030 — Missing timestamp denied

- GIVEN a resolution record with no referenceTime, or one that is malformed
- WHEN it is validated
- THEN the operation returns `missing-timestamp` (or `malformed-record`) AND creates no record

### Requirement: REQ-GU-013 — Barrel exports

The new public symbols MUST be exported from `guardian/index.ts` using ESM `.js` import
conventions, extending the existing barrel (`export * from "./guardian.js"`) without
adding a new package or subpath.

#### Scenario: SC-GU-031 — Barrel export smoke

- GIVEN the guardian module root
- WHEN the new refutation and resolution symbols are imported from `guardian/index.ts` using ESM `.js` conventions
- THEN all supported symbols resolve AND no new subpath is required

### Requirement: REQ-GU-014 — Unit evidence

English unit tests MUST cover consistency, independence, the full lifecycle, every denial
code, identity change, immutability, determinism, and the non-mutation/non-authority
invariants. The existing Guardian single-review tests and CLI behavior MUST remain green
and unchanged.

#### Scenario: SC-GU-032 — Unit evidence coverage

- GIVEN the refutation and resolution test suites
- WHEN they run
- THEN they cover consistency, independence, lifecycle, every denial code, identity change, immutability, determinism, and non-mutation/non-authority, AND the existing Guardian and CLI tests remain green

## Non-goals (restated from the proposal)

- **No wiring** into `runGuardianReview`, `GuardianReport`/`GuardianFinding` shapes, the CLI, contracts, agents, flows, gates, ledgers, or journals. `guardian/guardian.ts` stays the unchanged live findings-only reviewer.
- **No Command Center integration** — SDD-100 is the consumer; out of scope here.
- **No authority state** — no quorum/approval signal, no third reviewer, no automated escalation, no reuse or modification of `CandidateReviewVerdict`.
- **No lifecycle promotion** — the capability-matrix rows stay `planned`; this slice promotes nothing.
- **No money fields** — fiscal convention (BigInt cents only) is untouched; this slice introduces no monetary data.
- **No new package subpath** — exports extend the existing `guardian/index.ts` barrel only.
- **No resolution reopen/revocation/carry-over** and **no content-derived finding IDs** — both require touching the live review core or its types, which is out of this slice.
