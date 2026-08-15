# SDD-030 Slice C — Preflight Router Design

> Change: `sdd-030-router` · Program: Drenyra Dominion · SDD: SDD-030 · Slice: C

## Design objective

Add one deterministic, offline preflight decision inside the existing `routing/` library module. The router validates a closed request, applies escalation-only precedence, and returns a typed route proposal. It does not execute work, create a `WorkUnit` or mission, authorize anything, select a Core transition, or write state.

This design follows `openspec/programs/drenyra-dominion/charter.md` §5 and `authority-model.md` §4: use the smallest route that preserves evidence, authority, and recovery. It also preserves the repository layer order (`contracts -> library modules -> agents -> cmd`) and the existing routing dependency boundary.

## Decisions

| ID | Decision | Rationale and repository evidence |
| --- | --- | --- |
| D1 | Place the implementation at `routing/router.ts`; keep public types in `routing/types.ts`; re-export through `routing/index.ts`. Do not create a top-level `router/` module. | Routing A+B already owns `WorkScope`, `ValidationResult`, and the advisory work contracts. `routing/index.ts` is the existing public boundary. A sibling module would duplicate that boundary and make reverse imports more likely. |
| D2 | Model the eight §5 axes with the exact required fields `materiality`, `reversibility`, `externalEvidence`, `durationAndInterruptibility`, `systemsInvolved`, `segregationOfDuties`, `regulatoryObligations`, and `approval`. `requestedEffect` is a separate required routing input. | These names directly encode the charter criteria without relying on prose. `Materiality` and `Reversibility` reuse `candidates/types.ts`; fiscal scope reuses `WorkScope` from `routing/types.ts`. |
| D3 | Use `RouteRequest.scope: WorkScope`, plus required closed unions. Represent `systemsInvolved` as a non-empty readonly tuple. Runtime validation still treats the parameter defensively because JavaScript, deserialization, or casts can bypass TypeScript. | `WorkScope` already carries tenant, RUC, company ID/name, fiscal period, and canonical `MissionIntent`. The tuple makes emptiness unrepresentable to typed callers while runtime checks preserve fail-closed behavior. |
| D4 | Expose `route(request: RouteRequest): ValidationResult<Route>`. Validation runs before decision logic. Decision precedence is: ambiguous rejection, durable mission, specialized agent, direct analysis. | This is the exact result shape already exported by `routing/helpers.ts`. It guarantees failure has `issues` and no `value`, while success has one route and no issues. |
| D5 | Use a `kind` discriminant and an inseparable `authorityCeiling` literal. The three pairs are `direct-analysis/no-mutation`, `specialized-agent/proposes-only`, and `durable-mission/through-core`. Each success also carries a validated `request` snapshot. | Existing routing unions (`WorkStopReason`, `WorkOutcome`, success conditions) consistently use `kind`. A discriminated union prevents an authority ceiling from being paired with the wrong route at compile time; runtime tests assert the same invariant. Carrying the validated request gives downstream integration the routing facts without creating a `WorkUnit`. |
| D6 | Extend `ValidationIssue["code"]` with the exact literal `AMBIGUOUS_INPUT`; do not create a second router-specific issue type or overload another issue code. Emit one deterministic issue per affected path. | `routing/types.ts` already defines `WorkStopReason` with `kind: "AMBIGUOUS_INPUT"`. Reusing that exact vocabulary is additive and avoids mislabeling ambiguity as `INVALID_SCOPE` or `INVALID_STOP_REASON`. The existing `ValidationResult` shape remains unchanged. |
| D7 | `router.ts` imports only local routing types: type-only imports from `./types.js` and `./helpers.js`. Candidate and mission types enter through `routing/types.ts`, where imports are already type-only. Add `router.ts` to `PRODUCTION_FILES` and explicitly permit type-only local routing imports in the boundary test. | `routing/__tests__/boundary.test.ts` currently permits mission/candidate type imports, `node:crypto`, and local re-exports; its allowlist contains only `types.ts`, `helpers.ts`, and `index.ts`. The new file must be inspected by the same forbidden-specifier test. No `agents/` dependency is needed or allowed. |
| D8 | Do not inject or call `CanonicalTransitionValidator` in `route()`. Do not define a transition table. The existing injected validator remains mandatory only for later transition-aware operations such as `advanceWorkUnit`. | Route selection neither has nor changes a mission stage. Accepting a transition validator here would imply authority the router does not use. `routing/helpers.ts` already demonstrates the correct injected-validator boundary. |
| D9 | Defer `WorkUnit` and mission materialization to SDD-040 or a later integration slice. `Route` contains the validated request, not a `WorkUnit`, mission ID, stage, tool authorization, destination, or transition. | Creating a mission before deciding that one is required is circular; creating a specialized-agent `WorkUnit` would require an artificial `MissionSnapshot`. This resolves the older exploratory suggestion in favor of the approved proposal and specification. |
| D10 | Treat `partially-reversible` as a specialized-agent signal when no durable signal is present. Treat `read-only` combined with `approval: "required"` or `reversibility: "irreversible"` as contradictory and reject it before escalation. Other high-risk facts remain escalation signals rather than contradictions. | Direct analysis requires reversible work, while irreversible work is explicitly durable; the middle reversibility tier therefore maps conservatively to the middle route. Approval for the requested work and irreversible work both contradict a claimed read-only effect. Materiality, evidence, systems, regulatory duties, or recoverability can legitimately govern read-only professional work, so they escalate rather than reject. |
| D11 | Validate duplicate system IDs as ambiguous instead of counting duplicates as multiple systems; do not trim, normalize, deduplicate, or otherwise guess caller intent. | Route selection depends on the number of systems. Silently normalizing duplicates could change the selected route and violate deterministic fail-closed behavior. |

## Public contracts

The following declarations are added to `routing/types.ts`. All fields are authoritative structured data; no explanation or instruction string participates in routing.

```ts
import type {
  Materiality,
  Reversibility,
} from "../candidates/index.js";

export type RequestedEffect =
  | "read-only"
  | "proposes-change"
  | "core-governed-change";

export type ExternalEvidence = "none" | "bounded" | "material";

export type DurationAndInterruptibility =
  | "immediate"
  | "bounded-interruptible"
  | "recoverable";

export type SegregationOfDuties = "not-required" | "required";
export type RegulatoryObligations = "none" | "applicable";
export type ApprovalRequirement = "not-required" | "required";

export interface RouteRequest {
  readonly scope: WorkScope;
  readonly requestedEffect: RequestedEffect;
  readonly materiality: Materiality;
  readonly reversibility: Reversibility;
  readonly externalEvidence: ExternalEvidence;
  readonly durationAndInterruptibility: DurationAndInterruptibility;
  readonly systemsInvolved: readonly [string, ...string[]];
  readonly segregationOfDuties: SegregationOfDuties;
  readonly regulatoryObligations: RegulatoryObligations;
  readonly approval: ApprovalRequirement;
}

export type AuthorityCeiling =
  | "no-mutation"
  | "proposes-only"
  | "through-core";

export type Route =
  | {
      readonly kind: "direct-analysis";
      readonly authorityCeiling: "no-mutation";
      readonly request: RouteRequest;
    }
  | {
      readonly kind: "specialized-agent";
      readonly authorityCeiling: "proposes-only";
      readonly request: RouteRequest;
    }
  | {
      readonly kind: "durable-mission";
      readonly authorityCeiling: "through-core";
      readonly request: RouteRequest;
    };
```

`Materiality` and `Reversibility` are added to the existing type-only candidate import in `routing/types.ts`; `MissionIntent` remains reached through `WorkScope`. `AuthorityCeiling` is a closed vocabulary, while the `Route` union narrows each member to exactly one ceiling.

The function in `routing/router.ts` is:

```ts
export function route(request: RouteRequest): ValidationResult<Route>;
```

The implementation validates the runtime shape before reading decision fields. On success it creates a fresh `RouteRequest` snapshot, including a fresh `scope` object and `systemsInvolved` array, and embeds that snapshot in the route. It does not freeze caller objects or mutate them.

## Validation and `AMBIGUOUS_INPUT`

`ValidationIssue` remains structurally unchanged except for one additive code literal:

```ts
export interface ValidationIssue {
  readonly code:
    | "INVALID_ID"
    | "INVALID_SCOPE"
    | "INVALID_HASH"
    | "INVALID_INTEGER"
    | "INVALID_BUDGET"
    | "MISSING_CONDITION"
    | "INVALID_STOP_REASON"
    | "INVALID_TRANSITION"
    | "MISSION_MISMATCH"
    | "AMBIGUOUS_INPUT";
  readonly path: string;
}
```

The router returns only issues with `code: "AMBIGUOUS_INPUT"`. This literal is the same domain vocabulary already present in `WorkStopReason`; it is not a new competing stop reason. `path` identifies each affected field.

Validation is deterministic and follows declaration order:

1. Require a non-null object with exactly `scope`, `requestedEffect`, and the eight axis fields.
2. Require `scope` with the `WorkScope` fields; validate non-empty IDs and intent, 11-digit RUC, six-digit period, and a non-empty optional company name. Unknown scope keys fail closed.
3. Validate every closed literal using local readonly literal sets typed against the imported unions. No monetary threshold or materiality derivation is introduced.
4. Require `systemsInvolved` to be an array with at least one non-empty string; reject duplicates. Do not normalize values.
5. Reject unknown top-level keys so prose or undeclared flags cannot become accidental routing inputs.
6. Reject contradictions before route selection:
   - `requestedEffect === "read-only" && approval === "required"` produces issues at `requestedEffect` and `approval`;
   - `requestedEffect === "read-only" && reversibility === "irreversible"` produces issues at `requestedEffect` and `reversibility`.
7. If any issue exists, return `{ ok: false, issues }`. Never evaluate route predicates and never include a `value`.

Issue paths use stable dotted names such as `scope.ruc`, `materiality`, and `systemsInvolved`. Unknown keys are sorted lexically before their issues are appended, keeping repeated calls byte-for-byte equivalent at the data level.

## Route precedence

Validation and contradiction checks always precede this table. Within a valid request, the first matching row wins.

| Precedence | Result | Exact trigger | Notes |
| ---: | --- | --- | --- |
| 1 | Reject: `AMBIGUOUS_INPUT` | Missing field; unsupported literal; malformed or unknown scope/request field; empty, malformed, or duplicate `systemsInvolved`; either contradiction defined above | Returns no `Route`. No normalization or fallback is attempted. |
| 2 | `durable-mission` / `through-core` | `requestedEffect === "core-governed-change"` **OR** `materiality` is `R2` or `R3` **OR** `reversibility === "irreversible"` **OR** `externalEvidence === "material"` **OR** `durationAndInterruptibility === "recoverable"` **OR** `systemsInvolved.length > 1` **OR** `segregationOfDuties === "required"` **OR** `regulatoryObligations === "applicable"` **OR** `approval === "required"` | Any one durable signal wins over every specialized or direct signal. A valid read-only request may still require this route for evidence, recovery, regulatory, segregation, materiality, or multi-system reasons. |
| 3 | `specialized-agent` / `proposes-only` | No durable trigger, and `requestedEffect === "proposes-change"` **OR** `reversibility === "partially-reversible"` **OR** `externalEvidence === "bounded"` **OR** `durationAndInterruptibility === "bounded-interruptible"` | `MissionIntent` alone does not select a route; the typed decision axes describe whether reconciliation or research needs isolated context. |
| 4 | `direct-analysis` / `no-mutation` | `requestedEffect === "read-only"` **AND** `materiality` is `R0` or `R1` **AND** `reversibility === "reversible"` **AND** `externalEvidence === "none"` **AND** `durationAndInterruptibility === "immediate"` **AND** exactly one system is involved **AND** segregation is `not-required` **AND** regulatory obligations are `none` **AND** approval is `not-required` | This is the only minimum-authority route. All valid non-direct combinations are already captured by rows 2 or 3. |

File count, document count, agent count, clock, randomness, environment, transport, mutable process state, and free text are absent from both the request and the predicates.

## Data flow

```text
caller-owned structured facts
  -> route(RouteRequest)
  -> closed-shape and contradiction validation
       -> failure: ValidationResult<Route> { ok: false, AMBIGUOUS_INPUT issues }
       -> success: escalation-only predicates
            -> fresh validated request snapshot
            -> Route { kind, authorityCeiling, request }
  -> later SDD-040 integration (outside this slice)
       -> optional WorkUnit/mission materialization through existing Core boundaries
```

There is no call from the router to `createWorkUnit`, `advanceWorkUnit`, mission handlers, candidate materiality calculation, stores, ledgers, receipts, evidence, commands, agents, or network clients.

## Import and boundary design

Exact production imports introduced or changed:

```ts
// routing/types.ts — additions to existing type-only imports
import type { Materiality, Reversibility } from "../candidates/index.js";

// routing/router.ts
import type { ValidationIssue, ValidationResult } from "./helpers.js";
import type {
  Route,
  RouteRequest,
} from "./types.js";

// routing/index.ts
export * from "./router.js";
```

`router.ts` has zero runtime imports. It defines no transition state or matrix. `CanonicalTransitionValidator` remains where transition-aware helpers already consume it by injection.

`routing/__tests__/boundary.test.ts` changes as follows:

- append `"../router.ts"` to `PRODUCTION_FILES`;
- allow `import type ... from "./types.js"` and `import type ... from "./helpers.js"` as routing-local imports;
- retain every existing forbidden specifier (`agents/`, `cmd/`, `adapters/`, ledger, receipt, journal, store, network, HTTP);
- include `router.test.ts` in the deterministic/offline source scan;
- invoke `route()` inside the existing before/after filesystem observation to prove no persistence or mission mutation.

## File-by-file change plan and line forecast

Only implementation planning is described here; no task breakdown is created.

| File | Planned change | Estimated authored changed lines |
| --- | --- | ---: |
| `routing/types.ts` | Add candidate type imports, axis unions, `RouteRequest`, `AuthorityCeiling`, and `Route`. | 45–60 source |
| `routing/helpers.ts` | Add `AMBIGUOUS_INPUT` to `ValidationIssue["code"]`. | 1–3 source |
| `routing/router.ts` | New closed-shape validator, deterministic issue collection, contradiction checks, request snapshot, and precedence-only `route()` implementation. | 95–140 source |
| `routing/index.ts` | Re-export `router.js`. | 1 source |
| **Source subtotal** |  | **142–204** |
| `routing/__tests__/router.test.ts` | New table-driven conformance, ambiguity, precedence, authority, purity, and repeatability tests. | 105–135 tests |
| `routing/__tests__/boundary.test.ts` | Extend production allowlist/local-import handling, source scan, and propose-only observation. | 8–15 tests |
| **Test subtotal** |  | **113–150** |
| **Total forecast** |  | **255–354** |

The source and test subtotals stay within the proposal's expected ranges and the configured 300-line review budget may be approached or exceeded at the upper estimate. Apply should keep fixtures compact and table-driven; if the implementation forecast exceeds 300 authored changed lines, delivery planning must resolve that review-budget risk before apply.

## Test plan

Strict TDD is active (`bun run test`). The implementation phase should first add focused failing tests, then implement only enough policy to satisfy them.

### Scenario coverage

| Specification scenario | Test cases |
| --- | --- |
| Complete typed request | Compile-time fixture uses all required fields and imported canonical materiality/reversibility values; changing non-authoritative object identity does not alter the decision. |
| Missing or unsupported axis rejected | Table-drive every required top-level field as missing; test unsupported literals for `requestedEffect` and each closed axis; test an unknown top-level key and unknown scope key. Assert `ok: false`, exact `AMBIGUOUS_INPUT` paths, and absence of `value`. |
| Direct analysis from a fully safe request | R0 and R1 variants with read-only, reversible, immediate, no evidence, one system, and no duties/approval both return `direct-analysis/no-mutation`. |
| Specialized agent from bounded research | Separate cases for proposes-change, bounded evidence, bounded-interruptible duration, and partially-reversible work. Assert no durable trigger is present. |
| Durable mission from any escalation signal | A table starts from the direct fixture and changes exactly one field for each durable trigger: core-governed effect, R2, R3, irreversible, material evidence, recoverable duration, second system, segregation, regulation, and approval. Each returns `durable-mission/through-core`. |
| Ambiguous input fails closed with no route | Empty systems, malformed system ID, duplicate system ID, read-only plus approval, and read-only plus irreversible. Assert deterministic issue order and no route value. |
| Authority ceiling is fixed per route | Assert the exact pair for all three route members. Add type-level `satisfies Route` fixtures; wrong pairs must not be representable. |
| Router call proposes only | Snapshot watched persistence directories and a mission fixture before/after calls for all three routes; assert no file listing or mission data changes and no WorkUnit is returned. |
| Import boundary holds | Add `router.ts` to `PRODUCTION_FILES`; assert only type-only local routing imports and all existing forbidden specifiers remain absent. |
| Frozen state machine preserved | Existing assertions remain at 15 states and 15 transition-map entries; source scan confirms `router.ts` contains no transition matrix or mission-state vocabulary. No validator is called because the router is not transition-aware. |
| Route-selection conformance suite passes | Run the full precedence table, including requests with both specialized and durable signals; durable always wins. |
| Authority ceilings enforced by test | Covered by exact runtime pair assertions and compile-time discriminant checks. |
| Deterministic and offline | Invoke each fixture twice and compare deep equality; add `router.ts` and `router.test.ts` to scans forbidding clock, randomness, child process, network, and transport tokens. |

The specification contains 13 explicit `#### Scenario` headings; the final three restate conformance, authority, and determinism requirements at the testability boundary. The table maps every scenario without duplicating implementation policy.

### Verification commands

After focused RED/GREEN cycles:

```sh
bun run test -- routing/__tests__/router.test.ts
bun run test -- routing/__tests__/boundary.test.ts
bun run typecheck
bun run build
bun run test
```

The full-suite result must account for the repository's known pre-existing CLI failures separately; no new routing, typecheck, or build failure is acceptable.

## Rollout and rollback

The change is additive and has no migration or persistence impact. Rollout consists of exporting the new routing API after its conformance and boundary tests pass. No caller is automatically switched to it in this slice.

Rollback removes `routing/router.ts`, its export, the added types and issue literal, and its tests/allowlist entry. Existing WorkUnit/WorkResult behavior, Core mission states, candidates, and persisted data remain unchanged.

## Risks retained for implementation

- The 300-line review budget is close at the upper estimate; compact table-driven tests are required.
- Runtime closed-shape checks must not accidentally accept inherited, unknown, or prose fields as authority-bearing data.
- The boundary test's local-import exception must remain narrow: only type-only `./types.js` and `./helpers.js` imports for `router.ts`, not a general local runtime-import exemption.
- Route outputs carry a shallow structural snapshot, not a security boundary. Authorization remains exclusively downstream in Core.
