# Mission Projection Design — SDD-100 Command Center (Option A)

## Overview

Add a pure `projection/` library module that converts the minimum mission lifecycle input
into deterministic, transport-neutral guidance. It reads the canonical mission status enum
and transition matrix. It never executes a transition or gate, mutates a mission, emits a
receipt, performs I/O, or claims authority.

```ts
projectMission(snapshot, request?): MissionProjectionResult
```

A valid snapshot produces a `MissionProjection`. An unsupported status or malformed request
produces a closed fail-closed result containing only an `UNSUPPORTED_STATUS` denial. Invalid
input can never produce a partial projection.

The dependency direction remains:

```text
contracts/ -> missions/ -> projection/ -> agents/ -> cmd/
```

`projection/` imports only canonical mission types/data. It does not import `agents/`,
`cmd/`, UI, adapters, transports, stores, or sibling repositories. No lower-level module
imports `projection/`. It needs no Node API and remains inside the node:crypto-only ceiling.
There are no monetary fields, so the BigInt-cents rule is not applicable in this slice.

## Decisions

### D1. Dedicated three-file module

Create `projection/types.ts`, `projection/project-mission.ts`, and `projection/index.ts`,
matching the focused implementation/type/barrel convention used by existing modules.

**Rationale:** this creates one explicit consumer boundary without coupling projection to
persistence or putting authored guidance into the canonical state machine. Future projection
kinds remain additive; Option A does not freeze a transport contract.

### D2. Minimal snapshot and separate request context

The snapshot contains only `status`. Requested continuation and caller-known blocking facts
belong to a separate optional `MissionProjectionRequest`.

**Rationale:** status is observed mission state; a requested continuation is query context,
not persisted mission data. This avoids adopting a UI or transport envelope as the library
input contract.

### D3. Projection and denial use one pure function

`projectMission(snapshot, request?)` returns normal guidance and, when applicable, a denial.
No separate denial function is exposed.

**Rationale:** eligibility, recovery classification, and denial use one validated canonical
read. One call prevents consumers from rebuilding eligibility or querying two snapshots. A
denial remains explanation, never authorization.

### D4. UNKNOWN recovery is a separate field

For `UNKNOWN`, `eligibleTransitions` is an empty frozen array and
`recoveryTransitions` is a present frozen array. For all other statuses,
`recoveryTransitions` is absent.

**Rationale:** the field name is an explicit machine-readable label. Consumers cannot mistake
reconciliation for ordinary progression. A requested UNKNOWN target is available when it is
in `recoveryTransitions`; a supplied blocker can still deny it.

### D5. Recovery data comes from the exported UNKNOWN matrix entry

Read `VALID_TRANSITIONS.get(AccountingMissionStatus.UNKNOWN)`. Do not import/export a new
recovery constant and do not modify `missions/`.

**Rationale:** `UNKNOWN_RECOVERY_TRANSITIONS` is private, while the exported matrix entry is
canonical read data and currently has the identical ordered targets: `RUNNING`, `FAILED`,
`COMPLETED`. This avoids copying a transition list and respects the missions non-goal. A
conformance test pins those three values and their recovery-only representation. Divergence
therefore fails visibly. A future slice may expose one recovery-data read surface.

### D6. Preserve declaration order with fresh copies

Convert the canonical `Set` with `[...canonicalTransitions]` for each invocation. ECMAScript
`Set` iteration preserves insertion order.

**Rationale:** sorting would author a second product order; returning the `Set` would expose
mutable authority data. Fresh arrays preserve canonical declaration order and isolate callers.

### D7. Runtime freeze plus readonly types

Create and `Object.freeze` new arrays, denial objects, projections, and fail-closed results on
every call. Public declarations also use `readonly`.

**Rationale:** `readonly` is compile-time only. Freezing protects JavaScript consumers, while
fresh allocation prevents aliasing canonical state or another invocation. Mutation isolation
is stronger than merely documenting caller discipline.

### D8. Runtime validation and a disjoint result union

Although TypeScript callers receive a canonical snapshot type, implementation treats runtime
values as untrusted. It validates the snapshot object, enum membership, request keys, target,
and blocker before reading the matrix or action map.

Invalid input returns `UnsupportedMissionProjection`. It contains no `status`, transition
array, or `nextAction` and does not throw.

**Rationale:** JavaScript and deserialized inputs bypass static types. The result union makes
a partial projection unrepresentable and satisfies fail-closed behavior at the real boundary.

### D9. One explicit caller-supplied blocking condition

The request carries a target and at most one `blockingCondition`:
`APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, or `POLICY_BLOCKED`. It is evaluated only after the
target is found in the applicable canonical collection.

**Rationale:** projection cannot execute gates or infer missing facts. An explicit condition
obeys REQ-PROJ-006/008. One value avoids undefined precedence among simultaneous flags;
combined policy diagnostics are outside this slice.

Deterministic precedence is:

1. malformed snapshot/request -> `UNSUPPORTED_STATUS`;
2. unavailable target -> `INVALID_TRANSITION`;
3. available target plus blocker -> the supplied blocker code;
4. otherwise no denial.

### D10. Closed denial details

`code`, `cause`, and `continuation` are closed unions. Terminal invalid requests use a
terminal-specific cause and a continuation that suggests no invalid progression.

**Rationale:** consumers localize stable identifiers without parsing prose. Closing all three
fields prevents accidental display copy and makes handling exhaustive.

### D11. Exhaustive local next-action map

A private `satisfies Record<AccountingMissionStatus, MissionNextAction>` const object contains
the exact SC-PROJ-005 mapping.

**Rationale:** `nextAction` is authored guidance, not transition authority. Exhaustive typing
makes a newly added canonical state fail typechecking; the 15-state table pins semantics.

## Module layout and file map

```text
projection/
  index.ts                         Projection-only public barrel
  types.ts                         Closed public types and result union
  project-mission.ts               Validation, canonical read, action/denial logic
  __tests__/
    project-mission.test.ts        Conformance, denial, runtime, isolation tests
    exports.test.ts                Projection/root export smoke tests
index.ts                           Add narrow projection barrel re-export
package.json                       Add ./projection export-map entry
openspec/changes/sdd-100-command-center/design.md
```

No `missions/`, `routing/`, `agents/`, `cmd/`, `contracts/`, or sibling-repository file changes.

## Type definitions (illustrative TypeScript)

These names and shapes are the intended public API:

```ts
import type { AccountingMissionStatus } from "../missions/status.js";

export interface MissionProjectionSnapshot {
  readonly status: AccountingMissionStatus;
}
export type MissionNextAction =
  | "none" | "queue" | "run" | "monitor" | "resume" | "review"
  | "finalize" | "request-revision" | "requeue" | "reconcile"
  | "provide-evidence" | "resolve-gate";
export type MissionProjectionDenialCode =
  | "INVALID_TRANSITION" | "APPROVAL_REQUIRED" | "MISSING_EVIDENCE"
  | "POLICY_BLOCKED" | "UNSUPPORTED_STATUS";
export type MissionProjectionBlockingCondition =
  | "APPROVAL_REQUIRED" | "MISSING_EVIDENCE" | "POLICY_BLOCKED";
export type MissionProjectionDenialCause =
  | "unsupported-status-value" | "malformed-projection-request"
  | "terminal-state" | "transition-not-eligible"
  | "approval-context-required" | "evidence-context-required"
  | "policy-context-blocked";
export type MissionProjectionContinuation =
  | "provide-supported-status" | "correct-projection-request"
  | "choose-eligible-transition" | "no-continuation-available"
  | "provide-approval-context" | "provide-evidence-context"
  | "resolve-policy-context";
export interface MissionProjectionRequest {
  readonly requestedContinuation: AccountingMissionStatus;
  readonly blockingCondition?: MissionProjectionBlockingCondition;
}
export interface MissionProjectionDenial {
  readonly code: MissionProjectionDenialCode;
  readonly cause: MissionProjectionDenialCause;
  readonly continuation: MissionProjectionContinuation;
}
export interface MissionProjection {
  readonly status: AccountingMissionStatus;
  readonly eligibleTransitions: readonly AccountingMissionStatus[];
  readonly recoveryTransitions?: readonly AccountingMissionStatus[];
  readonly nextAction: MissionNextAction;
  readonly deny?: MissionProjectionDenial;
}
export interface UnsupportedMissionProjection {
  readonly deny: MissionProjectionDenial & { readonly code: "UNSUPPORTED_STATUS" };
}
export type MissionProjectionResult = MissionProjection | UnsupportedMissionProjection;
```

When a request object is present, `requestedContinuation` is required. `{}`, unknown keys,
non-canonical targets, and unknown blockers are malformed at runtime. Strict shape checking
prevents silently ignored caller intent. A larger canonical mission object can still satisfy
the snapshot structurally because only its `status` field is read.

## Function signature

```ts
export function projectMission(
  snapshot: MissionProjectionSnapshot,
  request?: MissionProjectionRequest,
): MissionProjectionResult;
```

The implementation internally narrows runtime values from `unknown` before projection.
Malformed-input tests cross an `unknown`/cast boundary; production code needs no `any`.
No overload accepts persistence snapshots, transport payloads, IDs, receipts, or gates.

## Fail-closed and denial flow

1. Validate snapshot object and canonical enum membership.
2. Validate the optional request's exact shape and closed values.
3. Read `VALID_TRANSITIONS.get(status)`. A missing entry is an unsupported-status invariant
   failure, never an empty transition set.
4. For `UNKNOWN`, copy/freeze targets into `recoveryTransitions` and create an empty frozen
   `eligibleTransitions`; otherwise copy/freeze ordinary targets and omit recovery.
5. Read the exhaustive private next-action map.
6. If requested, check membership in recovery targets for `UNKNOWN` or ordinary targets for
   every other status.
7. If unavailable, emit `INVALID_TRANSITION`. `COMPLETED`/`FAILED` use cause
   `terminal-state` and continuation `no-continuation-available`; other states use
   `transition-not-eligible` and `choose-eligible-transition`.
8. If available and a blocker exists, map it directly to its closed cause/continuation.
9. Freeze and return the complete result.

Unsupported status uses cause `unsupported-status-value` and continuation
`provide-supported-status`. Malformed request uses cause `malformed-projection-request` and
continuation `correct-projection-request`. Both use `UNSUPPORTED_STATUS`, the closed code
available for fail-closed input errors. Neither returns guessed guidance.

The module imports `VALID_TRANSITIONS` as data only. It never imports or invokes `transition`,
`validateTransition`, `guardTerminal`, `reconcileTransition`, or a gate.

## Immutability and ordering guarantees

- Canonical `Set` references never cross the module boundary.
- Every call allocates distinct arrays, including empty arrays.
- Order equals canonical `Set` insertion/declaration order; no sorting occurs.
- Arrays and containing result objects are frozen before return.
- Equal valid inputs are deeply equal but not reference-equal.
- No mutable cache, clock, randomness, environment, filesystem, network, or store is used.

Mutation testing widens a returned readonly array only inside the test, attempts mutation,
asserts the frozen array throws, confirms `VALID_TRANSITIONS` is unchanged, and confirms a
later call returns a distinct frozen array with canonical contents.

## Package export plan

`projection/index.ts` exports public types from `types.ts` and `projectMission` from
`project-mission.ts`. It exports no guard, gate, mutation, receipt, store, or private map.

Add the exact existing subpath pattern:

```json
"./projection": "./dist/projection/index.js"
```

The root `index.ts` convention re-exports every library module, so add only:

```ts
export * from "./projection/index.js";
```

This convention-required root addition exposes only projection symbols. The dedicated
`drenyra-ai/projection` subpath remains the preferred narrow authority boundary.

## Test plan with TDD order

Strict TDD is active. Use Vitest and write each focused RED before implementation.

### RED/GREEN 1 — shape and all 15 actions

Create `projection/__tests__/project-mission.test.ts` with all enum values and the exact
SC-PROJ-005 action table. Assert status passthrough, action, and no denial without a request.
Then add types, exhaustive action map, runtime status check, and minimal function.

### RED/GREEN 2 — canonical eligibility and UNKNOWN recovery

For every state, compare output to a fresh spread of `VALID_TRANSITIONS.get(status)`. For
`UNKNOWN`, assert ordinary eligibility is empty and recovery is exactly
`[RUNNING, FAILED, COMPLETED]`. For other states, assert recovery is absent and ordinary
eligibility matches canonical members/order. Include terminal and wait-state assertions.
Then implement canonical copies, recovery separation, and array freezing.

### RED/GREEN 3 — denial matrix

Table-drive: absent/eligible request (no denial); ineligible request; terminal request; each
eligible target with `APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, or `POLICY_BLOCKED`; eligible
UNKNOWN recovery; and blocked UNKNOWN recovery. Assert exact closed code/cause/continuation.
Then implement fixed precedence and freeze denial objects without invoking guards.

### RED/GREEN 4 — malformed input

Pass nullish/non-object snapshots, empty/misspelled statuses, malformed request objects,
non-canonical targets, unknown blockers, and unexpected keys through an `unknown` boundary.
Assert only `UNSUPPORTED_STATUS` denial is returned, with no projection fields. Also assert
every enum value has a matrix entry, proving the missing-entry invariant without mutating
shared canonical data. Then add runtime validators and the total fail-closed branch.

### RED/GREEN 5 — determinism and mutation isolation

Assert equal calls are deeply equal, preserve RUNNING declaration order, return distinct
references, and are frozen. Attempt consumer mutation and prove the matrix and next call are
unchanged.

### RED/GREEN 6 — exports

In `projection/__tests__/exports.test.ts`, smoke-test projection and root barrels. Confirm the
projection barrel exposes only intended projection operations/types and no mutation entry.
Build output/packed verification confirms the package export target; avoid package-name
self-import if the harness does not support unpublished self-references.

Final checks, in order: `bun run test -- projection/__tests__`, `bun run typecheck`,
`bun run build`, then `bun run test`. Report the three documented pre-existing CLI failures
separately; they never convert a new projection regression into a pass.

## Changed-line estimate

| Area | Estimated changed lines |
| --- | ---: |
| `projection/types.ts` | 45–55 |
| `projection/project-mission.ts` | 70–85 |
| `projection/index.ts` | 4–8 |
| Projection tests | 95–105 |
| Root barrel and `package.json` | 2–4 |
| **Total implementation + tests** | **216–257** |

This stays inside the 200–260 target and 300-line review budget. If validation or export
testing pushes above 300, remove fixture repetition before adding contracts, CLI, or MCP.

## Open risks

1. **Recovery-source visibility:** the spec names private recovery constants, but Option A
   cannot read them without changing `missions/`. The exported identical UNKNOWN matrix entry
   plus a pinned conformance test resolves this without a second machine.
2. **Blocking-condition trust:** projection does not verify a caller-supplied blocker. It is
   contextual guidance; Core must evaluate authority for mutation.
3. **Action-map drift:** exhaustive typing and the 15-state table detect canonical additions
   and semantic changes.
4. **Strict request shape:** rejecting unknown keys is fail-closed but makes future additions
   breaking. Option A is not frozen; a future contract must version evolution.
5. **Root API growth:** convention requires a root re-export, while the dedicated subpath is
   the preferred narrow surface. No unrelated API changes.
6. **Snapshot staleness:** guidance can become stale immediately. Every mutation returns
   through Core for current-state and gate recalculation.

There is no behavioral conflict with REQ-PROJ-001 through REQ-PROJ-013. The only traceability
tension is the private UNKNOWN source; the requested use of its exported identical matrix
entry and a pinned conformance test resolves it without widening `missions/`.
