# Contract: projection

> Version: 0.1 · Status: DRAFT · Transport-agnostic.
>
> The **read-only projection surface** for mission lifecycle observation: given a
> persisted mission snapshot, the projection describes the mission's current
> status, its canonical eligible transitions, the operator's next action, and —
> only for `UNKNOWN` — a labeled recovery set. It is guidance and observation,
> never authorization.

<!-- -->

> [!IMPORTANT]
> **Status: DRAFT at v0.1** — the normative surface is pinned by the existing
> slice-A conformance suite (`projection/__tests__/`) that runs in CI (the
> existing Vitest `test` job) and fails on drift. This slice adds no second
> conformance suite: slice A already pins the payload and behavior documented
> here. A passing suite proves the surface is freezable; it does NOT prove the
> surface is adopted by any consumer. Freezing requires documented ecosystem
> adoption plus explicit contract approval, following the `brand-system` and
> `connector-adapter` precedent.

The **projection** contract defines what any consumer may learn from a mission
snapshot without mutating it: the exact canonical status, the ordinary
transition choices Core would accept, the single machine-readable operator
action, and the fail-closed denial shape when a requested continuation cannot be
granted. It is transport-neutral — no HTTP, CLI, framework, or storage binding
lives in the projection types — and it sits **beside**, never replaces, the
mission protocol's guarded transition machinery: projection reads canonical
data as data and never invokes guards, gates, mutations, or receipts.

## Purpose

- Give every consumer the **same deterministic, immutable, read-only view** of a
  mission's lifecycle state and next operator action.
- Keep `nextAction` and `deny` as **descriptive guidance**: they never imply
  that a transition was approved, executed, verified, or completed.
- Make "no drift" an enforced property: the slice-A conformance suite fails CI
  on any typed or behavioral drift from this document.
- Preserve Core as the **single lifecycle authority** — the projection observes,
  it never becomes a second state machine.

## Normative surface

- **Snapshot input.** `{ status }` where `status` is one of the 15 canonical
  states, passed through unchanged: `DRAFT`, `QUEUED`, `RUNNING`, `BLOCKED`,
  `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`,
  `COMPLETED`, `FAILED`, `UNKNOWN`, `RECOVERING`, `WAITING_FOR_EVIDENCE`,
  `BLOCKED_BY_GATE`, `RETRYING`. The projection never reinterprets, translates,
  normalizes, or reclassifies the input status.
- **Eligibility.** `eligibleTransitions` is the ordered ordinary transition set
  derived exclusively from the canonical `VALID_TRANSITIONS` matrix, exposed as a
  fresh read-only array. `COMPLETED` and `FAILED` project an empty set.
- **UNKNOWN recovery.** Only for `UNKNOWN`, the projection exposes
  `recoveryTransitions` equal to exactly `["RUNNING", "FAILED", "COMPLETED"]`
  under a clearly separated, labeled collection that MUST NOT be presented as
  ordinary progression; for `UNKNOWN`, `eligibleTransitions` is empty.
- **Next action.** `nextAction` is exactly one of the closed 12-code
  vocabulary: `none`, `queue`, `run`, `monitor`, `resume`, `review`,
  `finalize`, `request-revision`, `requeue`, `reconcile`, `provide-evidence`,
  `resolve-gate`. Terminal states map to `none`; every non-terminal state maps
  to one explicit, non-empty action.
- **Denial.** When the projection request context carries a requested
  continuation that cannot be granted, the result carries a typed `deny` with
  `code`, `cause`, and `continuation`, using only the closed 5-code denial
  vocabulary with the slice-A meanings:
  - `INVALID_TRANSITION` — the requested continuation is not in the canonical
    eligible set for the current status: `terminal-state` /
    `no-continuation-available` (from a terminal state) or
    `transition-not-eligible` / `choose-eligible-transition`.
  - `APPROVAL_REQUIRED` — canonical but requires an approval decision the
    request context does not supply: `approval-context-required` /
    `provide-approval-context`.
  - `MISSING_EVIDENCE` — canonical but requires evidence the request context
    does not supply: `evidence-context-required` / `provide-evidence-context`.
  - `POLICY_BLOCKED` — canonical but a policy condition in the request context
    prevents it: `policy-context-blocked` / `resolve-policy-context`.
  - `UNSUPPORTED_STATUS` — the input status is not one of the 15 canonical
    states, or the request context is malformed: `unsupported-status-value` /
    `provide-supported-status` or `malformed-projection-request` /
    `correct-projection-request`.
  - When no continuation is requested, or the requested continuation is
    eligible, no `deny` is emitted. A normal result never contains a denial.

## Invariants

1. **Canonical passthrough.** The projected `status` is the input status,
   byte-for-byte identical; the projection never invents, guesses, or
   approximates a status.
2. **Canonical eligibility.** `eligibleTransitions` is derived only from the
   canonical transition matrix; the projection never authors or copies a second
   transition matrix.
3. **UNKNOWN separation.** Recovery targets are labeled and separated; a
   consumer can always distinguish "recover from UNKNOWN" from normal
   progression, and recovery targets never appear as ordinary eligibility.
4. **Determinism.** Equal inputs yield deeply equal outputs — same status, same
   eligibility members in the same order, same action — with no I/O, clock,
   randomness, or network access during projection.
5. **Immutability.** Returned collections are fresh read-only structures;
   consumer mutation can never affect canonical data or any later projection.
6. **Fail closed.** Any input or request the projection cannot satisfy produces
   a typed denial or typed error, never a partial or fabricated projection.
7. **Never-second-authority.** The projection observes Core as the single
   lifecycle authority and never becomes a second state machine. `nextAction`
   is descriptive guidance and `deny` is explanation: neither approves,
   executes, verifies, or completes a transition, and no output field claims
   that any transition occurred.
8. **Receipt fidelity.** The projection exposes no generic `verified` claim and
   no receipt, hash, signature, signer-trust, or integrity-verification
   authority. A future receipt projection, if any, would carry receipt type and
   verification status as separate fields; that is deferred and not part of
   this surface.

## Fail-closed behavior

A canonical stored status with no requested continuation always projects a
normal result. An unknown or malformed status, or a malformed request context,
returns the denial-only `UNSUPPORTED_STATUS` result with a stable, actionable
`cause`/`continuation` pair — never a guessed status, invented transitions,
fabricated eligibility, or a guessed action. Because the CLI slice passes no
request context, a canonical stored status normally projects with no `deny`; if
the library returns a denial, the CLI emits it unchanged. Nothing in the
projection surface approves, executes, verifies, or completes anything.

## Conformance

- **Suite.** The slice-A conformance suite at `projection/__tests__/` is the
  normative proof that the payload and behavior documented here hold: canonical
  passthrough for all 15 states, canonical eligibility and ordering, separated
  UNKNOWN recovery, the closed 12-code action mapping, the typed denial matrix,
  determinism, immutability, and fail-closed behavior.
- **No second suite.** This slice adds no conformance suite under
  `contracts/__tests__/` or anywhere else: slice A already pins the normative
  surface, and a second suite would only re-assert the same semantics.
- **Drift gate.** Any vector that drifts from this document fails the suite and
  the CI `test` job.
- **CI:** the suite runs automatically in the existing `test` job; no workflow
  change is required.

## Compatibility

DRAFT changes are expected; each change bumps the version and updates the
documented surface and the slice-A conformance vectors in lockstep. Nothing in
v0.1 is frozen or implied stable, and no consumer should depend on DRAFT
behavior as if it were a commitment.

## Freeze criteria

v0.1 freezes only after (1) documented ecosystem adoption of the surface and
(2) explicit contract approval by the maintainers, following the `brand-system`
and `connector-adapter` precedent. CI pinning now controls drift; it does not
freeze, and a passing conformance suite does not constitute adoption.

## Non-claims

This DRAFT does not ship or claim: adoption or consumption of this surface by
any consumer in production; a frozen or declared contract status; a second
lifecycle authority, transition matrix, or state machine; MCP projection tooling
or Command Center UI; any mutation, transition, gate, approval, reconciliation,
or receipt behavior; evidence, memory, ledger, journal, or integrity-verification
authority; money fields, fiscal conclusions, accounting-journal behavior, or
SUNAT-facing semantics.
