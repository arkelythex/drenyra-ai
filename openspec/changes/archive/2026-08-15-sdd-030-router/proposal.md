# SDD-030 Slice C — Preflight Router Proposal

> Change: `sdd-030-router` · Program: Drenyra Dominion · SDD: SDD-030 · Slice: C

## Context and intent

SDD-030 is permitted by the Drenyra Dominion program and implements organic accounting work routing for the 16-program Peru v1 roadmap. Slices A+B are already delivered: `routing/` provides the advisory `WorkUnit` and `WorkResult` contracts, fail-closed validation helpers, typed budgets and stop reasons, candidate references, and compatibility with the Core-owned 15-state mission lifecycle.

Slice C adds the missing deterministic preflight router. Its intent is to select the smallest route that preserves evidence, authority, and recovery while keeping Drenyra-AI advisory-only. The router will classify a professional request before any work is executed, authorized, persisted, or transitioned.

This change follows the approved layer model: Drenyra-AI may propose typed routing decisions, while Drenyra Core retains deterministic accounting authority. It does not blur audit ledger, accounting journal, evidence, or memory responsibilities; the router writes to none of them.

## Current-state gap

The governing route criteria exist only as prose in `charter.md` §5 and `authority-model.md` §4. There is currently:

- no `RouteRequest` contract for deterministic preflight inputs;
- no route decision function;
- no `Route` discriminant or machine-checkable authority ceiling; and
- no route-selection tests.

The governing criteria are:

> File count, documents, or agent count alone never decides the route. Selection considers: materiality · reversibility · need for external evidence · duration and interruptibility · number of systems involved · segregation of duties · regulatory obligations · need for approval.

The three permitted routes are:

| Route | When used | Persistence | Authority |
| --- | --- | --- | --- |
| Direct analysis | Read-only query/explanation/inspection, small scope | Result and sources when relevant | No mutation |
| Specialized agent | Reconciliation, classification, bounded research needing its own context | Work unit, evidence, structured result | Proposes only |
| Durable mission | Close, declaration, material correction, multiple dependencies, recoverable work | Events, attempts, candidates, decisions, receipts | Passes through the Core |

Without executable preflight policy, callers could guess a route, over-route simple analysis, under-route regulated or material work, or accidentally imply authority that the advisory layer does not possess.

## Proposed first slice

Add the preflight router to `routing/` with:

1. A closed, transport-agnostic `RouteRequest` input type carrying fiscal scope, requested effect, and all eight §5 decision axes.
2. A deterministic `route(request) -> ValidationResult<Route>` function.
3. A closed `Route` discriminant with a literal authority ceiling per route:
   - `direct-analysis` → `no-mutation`;
   - `specialized-agent` → `proposes-only`;
   - `durable-mission` → `through-core`.
4. Typed fail-closed rejection for missing, unknown, contradictory, or otherwise ambiguous inputs. Rejection will identify affected fields as `AMBIGUOUS_INPUT` and return no partial or guessed route.
5. Boundary and decision tests covering all routes, ambiguity, determinism, and authority ceilings.

The router returns a proposal only. Calling it must never execute work, authorize a tool or destination, select or apply a Core transition, create or transition a mission, or write evidence, ledger, receipt, journal, store, or network state.

The expected review unit is approximately 130–220 authored source lines plus 100–150 test lines, within the SDD-030 review ceiling.

## Proposed input vocabulary

The request will use required structured fields and closed unions rather than authoritative free text:

- fiscal scope: tenant, RUC, company, period, and mission intent, using the existing routing/mission/candidate types where compatible;
- `requestedEffect`: `read-only | proposes-change | core-governed-change`;
- `materiality`: canonical `Materiality` (`R0`–`R3`), already classified by policy rather than recalculated from local constants;
- `reversibility`: the existing candidate `Reversibility` union;
- `externalEvidence`: `none | bounded | material`;
- `durationAndInterruptibility`: `immediate | bounded-interruptible | recoverable`;
- `systemsInvolved`: a non-empty collection of stable system identifiers;
- `segregationOfDuties`: `not-required | required`;
- `regulatoryObligations`: `none | applicable`;
- `approval`: `not-required | required`.

These fields make scope, permissions, risk, and evidence explicit. Any absent value, unsupported literal, empty systems collection, or contradictory combination fails closed. Monetary inputs remain BigInt cents upstream; the router consumes the policy-derived materiality tier and does not establish materiality thresholds itself.

## Route precedence

The decision is escalation-only: higher-authority requirements win, and no lower route may be selected when any axis requires a safer route.

| Precedence | Decision | Required conditions or escalation signals |
| --- | --- | --- |
| 1 | Reject as ambiguous | Any missing/unknown axis, empty system set, or contradiction between requested effect and authority-sensitive axes |
| 2 | Durable mission | `core-governed-change`; R2/R3 materiality; irreversible work; material external evidence; recoverable work; multiple systems; segregation of duties; regulatory obligations; or approval requirement |
| 3 | Specialized agent | No durable signal, but the request proposes a change, needs bounded external evidence, or is bounded-interruptible research/reconciliation/classification needing isolated context |
| 4 | Direct analysis | Read-only, R0/R1, reversible, immediate, one system, no external-evidence dependency, no segregation/regulatory/approval requirement |

The specification and design may refine combinations within this precedence, but may not weaken fail-closed behavior, the three authority ceilings, or the “smallest safe route” principle. File, document, and agent counts remain irrelevant.

## Materialization decision

Slice C will defer `WorkUnit` and mission materialization to SDD-040 or a later integration slice. The router will return a typed route proposal and the validated routing facts needed by the downstream Core-facing flow; it will not require a pre-existing `MissionSnapshot` merely to classify a request.

This avoids creating a mission before the decision that a durable mission is necessary, and avoids manufacturing a mission identity for specialized-agent work. Existing `createWorkUnit` remains the construction boundary once an owning mission and authorized inputs exist. Any future stage advance must continue to use the injected `CanonicalTransitionValidator`; the router introduces no local transition table and no new mission state.

## Scope and affected areas

### In scope

- `RouteRequest`, axis unions, and `Route` types within the `routing/` public surface.
- `router.ts` with deterministic validation and route selection.
- An ambiguity issue compatible with the existing `ValidationResult` fail-closed shape and the existing `AMBIGUOUS_INPUT` stop-reason vocabulary.
- Route decision tests for direct analysis, specialized agent, and durable mission.
- Authority-ceiling tests that assert each route literal is inseparable from its permitted authority.
- Extension of the routing boundary tests and production-file allowlist to cover `router.ts`.
- Export of the router surface through the existing routing boundary.

### Boundary constraints

- Router imports are limited to type-only `missions/` and `candidates/` dependencies plus the existing `routing/` surface.
- The router must never import `agents/`, commands, adapters, stores, ledgers, receipts, journals, transports, or network clients.
- The existing layer order remains `contracts -> library modules -> agents -> cmd`; no reverse import is introduced.
- The Core-owned 15-state machine remains frozen. Transition validity is available only through the injected canonical validator where transition-aware downstream operations need it.
- The implementation is deterministic and offline: no clock, randomness, environment, transport, or mutable process state may influence a decision.

## Non-goals

- Executing direct analysis, agent work, or durable missions.
- Granting permissions, authorizing tools/destinations, or deciding an allowed Core transition.
- Creating, advancing, or persisting missions or WorkUnits during route selection.
- Writing ledgers, receipts, journals, evidence stores, memory, or audit events.
- Runtime enforcement of time, token, cost, research-attempt, or correction budgets.
- Adapter, Command Center, Pi, external-host, or SDD-040 integration.
- Changing mission states, candidate materiality policy, Core transition policy, or the already-delivered WorkResult semantics.

## Product tradeoffs

- **Safety over convenience:** ambiguous requests are rejected instead of routed optimistically. Callers must supply complete structured preflight facts, but authority cannot be inferred from prose.
- **Conservative escalation:** any durable signal selects the durable route. This may route some borderline work through more ceremony, but prevents under-routing regulated, irreversible, or approval-bound work.
- **Policy-derived materiality:** the router consumes R0–R3 instead of embedding monetary thresholds. This preserves policy versioning, at the cost of requiring materiality classification before routing.
- **Deferred materialization:** returning a route proposal without a WorkUnit keeps preflight independent of mission creation and authority. Downstream integration must materialize the selected route later.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Router behavior exceeds propose-only authority | Literal route/authority pairs, forbidden-import tests, and before/after filesystem boundary checks |
| Ambiguous combinations are guessed | Required closed inputs, explicit contradiction checks, `AMBIGUOUS_INPUT`, and no value on validation failure |
| Route precedence drifts from §5 | Table-driven tests derived from the eight criteria and three charter routes |
| Local materiality or transition policy forks from Core policy | Consume canonical materiality tiers; add no monetary thresholds or transition table; retain injected canonical validation |
| Specialized route accidentally becomes execution authority | `proposes-only` is a compile-time discriminant and runtime assertion; no agent registry import |
| New router bypasses architecture tests | Add `router.ts` to the boundary-test production allowlist and retain deterministic/offline checks |
| Conservative rules over-route ordinary queries | Direct-analysis cases prove the minimum route remains available when every higher-risk signal is absent |

## Rollback

The router is additive and has no persistence or side effects. Rollback removes the router exports, implementation, and associated tests/allowlist entry. Existing `WorkUnit`/`WorkResult` contracts remain intact, no running mission or receipt requires migration, and callers continue without a preflight routing API until a revised policy is introduced.

## Success criteria

- A complete, valid request deterministically selects exactly one of the three charter routes.
- Tests cover representative decisions for direct analysis, specialized agent, and durable mission, including precedence when multiple axes differ.
- Missing, invalid, contradictory, or insufficient decision data returns a typed `AMBIGUOUS_INPUT` failure with no `Route` value.
- Every returned route carries exactly its fixed authority ceiling; no route can express greater authority.
- The router performs no execution, authorization, transition, persistence, network, clock, or randomness operation.
- `router.ts` is covered by the routing boundary allowlist and never imports `agents/` or another forbidden layer.
- The frozen mission state machine and injected canonical-validator boundary remain unchanged.
- The full test, typecheck, and build suites remain green.
