# Mission Projection Specification — SDD-100 Command Center (Option A)

> Change: `sdd-100-command-center` · Domain: mission projection (new `projection/` library module, first slice)
>
> Repository convention: this repo keeps change specs as flat files under
> `openspec/changes/{change}/spec.md`; no canonical `openspec/specs/{domain}/spec.md`
> tree exists yet, so this is a full domain spec for the change, preserved as-is at archive.
>
> This specification defines behavior only (WHAT must be true). API shape, exact function
> signatures, the snapshot field list, and whether denial is a separate pure function are
> design decisions (HOW) and are intentionally not fixed here.

## Purpose

Create a read-only, deterministic projection of the canonical 15-state mission lifecycle
that consumers such as `drenyra-command-center` can render without reconstructing Core
lifecycle rules. The projection answers four questions — current canonical status, which
transitions are eligible now, what the operator should do next, and a typed denial when a
requested continuation is unavailable — while keeping the canonical state machine the
single authority. It is guidance and observation, never authorization and never mutation.

## Normative sources

The projection MUST read from these canonical sources and MUST NOT create a second
state machine:

| Source | Role |
| --- | --- |
| `missions/status.ts` — `AccountingMissionStatus` (15 canonical states) | The only valid status vocabulary. |
| `missions/status.ts` — `VALID_TRANSITIONS` | The canonical eligibility matrix; the single source for ordinary eligible transitions. |
| `missions/status.ts` — `TERMINAL_STATES` (`COMPLETED`, `FAILED`) | Terminal classification; no transitions out. |
| `missions/transitions.ts` — `UNKNOWN_RECOVERY_TRANSITIONS` / `RECOVERY_TARGETS` (`RUNNING`, `FAILED`, `COMPLETED`) | The canonical UNKNOWN recovery (reconciliation) target set. |
| `routing/types.ts` — `WorkStopReason` | Vocabulary discipline precedent for deny-with-code; the projection aligns with its terms without coupling to routing execution. |

The 15 canonical states are: `DRAFT`, `QUEUED`, `RUNNING`, `BLOCKED`, `AWAITING_APPROVAL`,
`APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `COMPLETED`, `FAILED`, `UNKNOWN`,
`RECOVERING`, `WAITING_FOR_EVIDENCE`, `BLOCKED_BY_GATE`, `RETRYING`.

## Payload shape (illustrative, transport-neutral, NOT a frozen contract)

The projection surface is described neutrally; this slice does not freeze a public
transport contract (that is a later slice). The following is illustrative only:

```ts
projectMission(snapshot) => { status, eligibleTransitions, nextAction, deny? }
```

- `status`: the canonical status, passed through unchanged.
- `eligibleTransitions`: a fresh, ordered, read-only collection of canonical states.
- `nextAction`: one machine-readable action code (or `"none"` for terminal states).
- `deny?`: present only when the request context carries a requested continuation that is
  not eligible; carries `code`, `cause`, and `continuation`.

Field names, collection types, and the exact snapshot shape are design decisions.

## Requirements

### Requirement: REQ-PROJ-001 — Canonical status passthrough

The projection MUST accept a mission snapshot whose status is one of the 15 canonical
states and MUST return that exact status unchanged. The projection MUST NOT reinterpret,
translate, normalize, or reclassify the input status. If the input status is not one of
the 15 canonical states, the projection MUST fail closed per REQ-PROJ-007 and MUST NOT
approximate or invent a status.

#### Scenario: SC-PROJ-001 — Canonical status passes through unchanged

- GIVEN a snapshot with canonical status `QUEUED`
- WHEN the projection is invoked
- THEN the returned `status` is exactly `QUEUED`, identical to the input
- AND the projection returns the same result for every other canonical state, including
  `COMPLETED`, `FAILED`, and `UNKNOWN`

### Requirement: REQ-PROJ-002 — Canonical eligibility with separated UNKNOWN recovery

The projection MUST derive ordinary eligible transitions for a state exclusively from the
canonical transition matrix (`VALID_TRANSITIONS`). It MUST NOT author, copy, or interpret
a second transition matrix. UNKNOWN recovery targets MUST be derived from the canonical
recovery transition data (`UNKNOWN_RECOVERY_TRANSITIONS` / `RECOVERY_TARGETS`) and MUST
NOT be invented by the projection. Recovery targets MUST be exposed under a clearly
separated, labeled recovery collection (or equivalent distinguishing marker) and MUST NOT
be presented as ordinary progression transitions.

#### Scenario: SC-PROJ-002 — Eligibility equals the canonical matrix for all 15 states

- GIVEN a snapshot for each of the 15 canonical states
- WHEN the projection is invoked for that state
- THEN the returned ordinary `eligibleTransitions` equals the canonical
  `VALID_TRANSITIONS` targets for that state: `DRAFT→{QUEUED}`,
  `QUEUED→{RUNNING, FAILED}`,
  `RUNNING→{BLOCKED, AWAITING_APPROVAL, COMPLETED, FAILED, UNKNOWN, WAITING_FOR_EVIDENCE, BLOCKED_BY_GATE, RETRYING}`,
  `BLOCKED→{RUNNING, FAILED}`, `WAITING_FOR_EVIDENCE→{RUNNING, FAILED}`,
  `BLOCKED_BY_GATE→{RUNNING, AWAITING_APPROVAL, FAILED}`, `RECOVERING→{RUNNING, FAILED}`,
  `RETRYING→{RUNNING, FAILED}`, `AWAITING_APPROVAL→{APPROVED, REJECTED, RUNNING}`,
  `APPROVED→{COMPLETED, FAILED}`, `REJECTED→{REVISION_REQUESTED}`,
  `REVISION_REQUESTED→{QUEUED}`, `COMPLETED→{}`, `FAILED→{}`, `UNKNOWN→recovery set`
- AND no transition outside the canonical matrix appears in the result

#### Scenario: SC-PROJ-003 — UNKNOWN recovery is labeled separately

- GIVEN a snapshot with status `UNKNOWN`
- WHEN the projection is invoked
- THEN the ordinary `eligibleTransitions` does not imply normal progression
- AND the projection exposes `RUNNING`, `FAILED`, and `COMPLETED` as a distinct,
  clearly-labeled recovery set (or equivalent distinguishing marker)
- AND a consumer can distinguish "recover from UNKNOWN" from "normal progression"

### Requirement: REQ-PROJ-003 — Determinism

For equal valid inputs the projection MUST return deeply equal outputs. The projection
MUST NOT perform I/O, read the clock, use randomness, access the network, or read or
mutate shared mutable state during projection. Repeated invocation with the same snapshot
MUST produce identical `status`, `eligibleTransitions` (same members, same order),
`nextAction`, and denial results.

#### Scenario: SC-PROJ-004 — Same input twice yields deeply equal output

- GIVEN a snapshot with status `AWAITING_APPROVAL`
- WHEN the projection is invoked twice with that same snapshot
- THEN both results are deeply equal: identical `status`, identical `eligibleTransitions`
  in the same order, and identical `nextAction`

### Requirement: REQ-PROJ-004 — Closed next-action mapping

The projection MUST map every one of the 15 canonical states to exactly one
machine-readable `nextAction` code. Terminal states (`COMPLETED`, `FAILED`) MUST map to
`"none"`. Every non-terminal state MUST have an explicit, non-empty action. The
`nextAction` vocabulary MUST be a closed, locale-neutral set:
`none`, `queue`, `run`, `monitor`, `resume`, `review`, `finalize`, `request-revision`,
`requeue`, `reconcile`, `provide-evidence`, `resolve-gate`. No other action code MAY be
returned. The normative per-state mapping is fixed by SC-PROJ-005.

#### Scenario: SC-PROJ-005 — Every state maps to exactly one closed action

- GIVEN a snapshot for each of the 15 canonical states
- WHEN the projection is invoked
- THEN the returned `nextAction` is exactly: `DRAFT→"queue"`, `QUEUED→"run"`,
  `RUNNING→"monitor"`, `BLOCKED→"resume"`, `AWAITING_APPROVAL→"review"`,
  `APPROVED→"finalize"`, `REJECTED→"request-revision"`,
  `REVISION_REQUESTED→"requeue"`, `COMPLETED→"none"`, `FAILED→"none"`,
  `UNKNOWN→"reconcile"`, `RECOVERING→"monitor"`, `WAITING_FOR_EVIDENCE→"provide-evidence"`,
  `BLOCKED_BY_GATE→"resolve-gate"`, `RETRYING→"monitor"`
- AND every code belongs to the closed vocabulary above
- AND no non-terminal state returns `"none"` or a missing action

#### Scenario: SC-PROJ-006 — Terminal states project `"none"` and empty eligibility

- GIVEN a snapshot with status `COMPLETED` (or `FAILED`)
- WHEN the projection is invoked
- THEN `nextAction` is `"none"`, ordinary `eligibleTransitions` is empty, and no recovery
  set is exposed

#### Scenario: SC-PROJ-007 — Wait states expose an operator action

- GIVEN a snapshot with status `WAITING_FOR_EVIDENCE`
- WHEN the projection is invoked
- THEN `nextAction` is `"provide-evidence"`
- AND, given status `BLOCKED_BY_GATE`, `nextAction` is `"resolve-gate"`
- AND, given status `AWAITING_APPROVAL`, `nextAction` is `"review"`

### Requirement: REQ-PROJ-005 — Guidance ceiling

A `nextAction` MUST NOT represent or imply that a transition was approved, executed,
verified, or completed, and MUST NOT be treated as authorization. `nextAction` is
descriptive, machine-readable guidance for the operator or consumer. The projection MUST
NOT expose any field whose semantics claim an operation occurred; all mutations MUST
return through Core for current-state and gate recalculation.

#### Scenario: SC-PROJ-008 — Actions never imply approval, execution, or verification

- GIVEN a snapshot with status `AWAITING_APPROVAL`
- WHEN the projection is invoked
- THEN `nextAction` is `"review"`, which describes the operator task
- AND no output field claims the mission was approved, executed, verified, or completed
- AND a consumer rendering `"review"` cannot conclude any transition already occurred

### Requirement: REQ-PROJ-006 — Typed denial

When the request context includes a requested continuation that is not eligible from the
current status, the projection MUST return a typed denial carrying a stable `code` from
the closed denial vocabulary, a `cause` describing the reason, and an actionable
`continuation`. The projection MUST NOT throw for a semantically-answerable denial.
When no continuation is requested, or the requested continuation is eligible, the
projection MUST NOT emit a denial. The closed denial code set is exactly:
`INVALID_TRANSITION`, `APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, `POLICY_BLOCKED`,
`UNSUPPORTED_STATUS`. The meaning of each code:

- `INVALID_TRANSITION` — the requested continuation is not in the canonical eligible set
  for the current status (includes any requested continuation from a terminal state).
- `APPROVAL_REQUIRED` — the requested continuation is canonical but requires an approval
  decision that the request context does not supply.
- `MISSING_EVIDENCE` — the requested continuation is canonical but requires evidence that
  the request context does not supply.
- `POLICY_BLOCKED` — the requested continuation is canonical but a policy condition in
  the request context prevents it.
- `UNSUPPORTED_STATUS` — the input status is not one of the 15 canonical states
  (malformed or unknown input); used by fail-closed handling per REQ-PROJ-007.

Denial codes other than `INVALID_TRANSITION` and `UNSUPPORTED_STATUS` MUST be derived
only from facts present in the request context, never from executing gates, guards, or
external checks (see REQ-PROJ-008). The `cause` MUST be stable and machine-readable
(locale-neutral, not free-form prose). The `continuation` MUST be actionable and
machine-readable, MUST NOT itself claim approval, execution, or verification, and MUST
NOT suggest a progression that is not canonical.

#### Scenario: SC-PROJ-009 — Ineligible requested transition returns a typed denial

- GIVEN a snapshot with status `DRAFT`
- AND a requested continuation `DRAFT → COMPLETED`
- WHEN the projection is invoked
- THEN the projection returns a denial, not a throw
- AND the denial `code` is `INVALID_TRANSITION`
- AND the denial carries a stable `cause` naming the reason
- AND the denial carries an actionable, machine-readable `continuation`

#### Scenario: SC-PROJ-010 — Denial from a terminal state is still typed

- GIVEN a snapshot with status `COMPLETED`
- AND any requested continuation
- WHEN the projection is invoked
- THEN the denial `code` is `INVALID_TRANSITION`
- AND the `cause` identifies the terminal state
- AND the `continuation` does not suggest an invalid progression

#### Scenario: SC-PROJ-011 — No denial for eligible or absent requests

- GIVEN a snapshot with status `QUEUED`
- AND either no requested continuation, or a requested continuation `QUEUED → RUNNING`
- WHEN the projection is invoked
- THEN no denial is emitted

### Requirement: REQ-PROJ-007 — Fail closed

If the input status is not one of the 15 canonical states, or the request context is
malformed, the projection MUST NOT yield an invented transition, a guessed status,
fabricated eligibility, or a guessed `nextAction`. It MUST return a typed denial with
code `UNSUPPORTED_STATUS` (or a typed error) and MUST NOT proceed with a partial
projection.

#### Scenario: SC-PROJ-012 — Malformed status fails closed

- GIVEN a snapshot whose status is not one of the 15 canonical states (for example an
  empty value, a misspelled status, or an unknown string)
- WHEN the projection is invoked
- THEN the projection fails closed with a typed denial carrying `UNSUPPORTED_STATUS`
- AND no output contains an invented transition, a guessed status, or fabricated
  eligibility

### Requirement: REQ-PROJ-008 — Read-only

The projection MUST NOT invoke transition guards (`transition()`, `validateTransition()`,
`reconcileTransition()`, or any equivalent throwing guard), MUST NOT execute gates, MUST
NOT mutate mission state, MUST NOT emit receipts, and MUST NOT trigger any side effect.
Eligibility MUST be computed by reading canonical transition data as data, never by
calling guarded transition functions.

#### Scenario: SC-PROJ-013 — Projection never invokes guards or mutates

- GIVEN any valid snapshot
- WHEN the projection is invoked
- THEN no transition guard function is called, no gate executes, no receipt is emitted,
  and no mission state changes
- AND the result is identical whether or not a state-machine guard would throw for the
  same status

### Requirement: REQ-PROJ-009 — Deterministic ordering

Eligibility MUST have deterministic ordering that follows the canonical declaration order
of the transition matrix, independent of mutable `Set` iteration behavior and independent
of any consumer-visible mutable structure. The projection MUST return a fresh, ordered
collection whose order is stable across invocations for equal inputs.

#### Scenario: SC-PROJ-014 — Ordering is stable and canonical

- GIVEN a snapshot with status `RUNNING`
- WHEN the projection is invoked twice
- THEN both invocations return the eligible transitions in the same order
- AND that order matches the declaration order of the canonical `VALID_TRANSITIONS`
  entry for `RUNNING`

### Requirement: REQ-PROJ-010 — Immutability

The projection MUST NOT expose mutable references to canonical transition data
(`VALID_TRANSITIONS` or the canonical recovery data). Returned eligibility collections
MUST be fresh read-only structures. Consumer mutation of a returned collection MUST NOT
affect canonical data or any subsequent projection.

#### Scenario: SC-PROJ-015 — Consumer mutation does not leak into canonical data

- GIVEN a snapshot with status `QUEUED`
- WHEN the projection is invoked and the consumer mutates the returned eligibility
  collection (for example adding or removing a state)
- THEN the canonical `VALID_TRANSITIONS` data is unchanged
- AND a second invocation with the same snapshot returns the canonical eligibility
  unchanged

### Requirement: REQ-PROJ-011 — Receipt fidelity

The projection MUST NOT expose any generic `verified` claim. This slice performs no
receipt, hash, signature, signer-trust, or integrity verification and MUST NOT render or
imply "verified", "authorized", or "completed" from any such check. If a future slice
adds a receipt projection, it MUST carry receipt type and verification status as separate
fields; that is deferred and not part of this slice.

#### Scenario: SC-PROJ-016 — No generic verified claim

- GIVEN any valid snapshot
- WHEN the projection is invoked
- THEN no output field asserts or implies a generic `verified` status
- AND no output field claims receipt integrity, signer trust, or fiscal authorization

### Requirement: REQ-PROJ-012 — Consumer neutrality

All `nextAction` codes, denial codes, causes, and continuations MUST be machine-readable
and locale-neutral. The projection MUST NOT embed user-facing display text, and MUST NOT
emit professional Spanish copy; Spanish copy belongs to the UI/consumer layer.

#### Scenario: SC-PROJ-017 — Codes remain locale-neutral

- GIVEN any valid snapshot
- WHEN the projection is invoked
- THEN every `nextAction` code, denial code, `cause`, and `continuation` is a stable
  machine-readable identifier
- AND no output field contains display copy in any human language

### Requirement: REQ-PROJ-013 — Package export

The package SHOULD expose a dedicated `./projection` subpath so consumers can import the
projection without widening unrelated package APIs. The subpath MUST NOT expose canonical
transition-guard functions or any mutation entry point.

#### Scenario: SC-PROJ-018 — Consumers can import the projection subpath

- GIVEN the built package
- WHEN a consumer imports the dedicated `./projection` subpath
- THEN the projection surface is available from that subpath
- AND no guard, gate, mutation, or receipt-emitting entry point is exposed through it

## Non-goals (spec-relevant)

- UI components, layouts, or professional Spanish copy; no changes in
  `drenyra-command-center`.
- A second lifecycle machine or a copied transition matrix.
- New states, transitions, gates, approvals, receipts, or authority.
- Client-trusted `approved: true` behavior or mutation endpoints.
- A DRAFT or frozen public projection contract (deferred slice).
- A CLI project command, JSON dump, or MCP projection tool.
- Close, portfolio, tenant, candidate, Guardian, reconciliation, receipt, evidence,
  policy, journal, ingest, or SUNAT projections.
- Engram memory or evidence rendered as authority.
- Receipt verification, signer-trust evaluation, or a generic `verified` state.
- Monetary fields or accounting-journal behavior.
- Changes to canonical transition behavior, including correcting pre-existing comments
  or data in `missions/`.

## Resolved decisions and spec-level notes

- **UNKNOWN recovery representation (proposal open question 6):** recovery targets
  (`RUNNING`, `FAILED`, `COMPLETED`) appear under a clearly separated, labeled recovery
  set, never as ordinary eligibility — decided in REQ-PROJ-002 / SC-PROJ-003.
- **Eligibility ordering (proposal open question 3):** canonical declaration order of the
  transition matrix — decided in REQ-PROJ-009 / SC-PROJ-014.
- **Requested-continuation handling (proposal open question 2):** the projection surface
  MAY accept an optional requested continuation and MUST deny when it is ineligible;
  whether denial is the same function or a separate pure function is a design decision.
- **Conflict observed:** `missions/transitions.ts` documents that `UNKNOWN` "does NOT
  participate in the standard VALID_TRANSITIONS map", while `missions/status.ts`
  `VALID_TRANSITIONS` includes an `UNKNOWN` entry with the same targets
  (`RUNNING`, `FAILED`, `COMPLETED`). The data sets agree today; only the comment is
  stale. The projection MUST derive recovery targets from the canonical recovery
  transition data, and conformance tests MUST pin them to `{RUNNING, FAILED, COMPLETED}`.
  Comment correction is out of scope (non-goal: no changes to canonical transition
  behavior); flag for a future cleanup slice.
- **Snapshot fields (proposal open question 1):** the projection requires only canonical
  status plus the minimal request context needed for denial projection; the exact field
  list is a design decision and MUST NOT couple the projection to persistence or
  transport.
