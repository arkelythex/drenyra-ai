# Router Specification

## Purpose

The router domain defines the deterministic preflight router for organic accounting work in Drenyra AI. Given a closed, transport-agnostic `RouteRequest` carrying fiscal scope and the eight §5 decision axes (materiality · reversibility · need for external evidence · duration and interruptibility · number of systems involved · segregation of duties · regulatory obligations · need for approval), the router selects the smallest route that preserves evidence, authority, and recovery: `direct-analysis`, `specialized-agent`, or `durable-mission`. The router is advisory and propose-only: it classifies a professional request before any work is executed, authorized, persisted, or transitioned. It never executes work, never determines an allowed Core transition, never authorizes a tool or destination, never creates or advances a mission or work unit, and never writes a ledger, receipt, journal, evidence, store, or network state. The decision is deterministic, offline, and fail-closed: ambiguous input yields a typed rejection with no guessed route.

## Requirements

### Requirement: RouteRequest Input

The system MUST provide a closed, transport-agnostic `RouteRequest` type whose fields are typed and required, carrying fiscal scope plus the eight §5 decision axes:

- fiscal scope derived from the existing routing and mission surfaces — tenant, RUC, company, fiscal period, and mission intent;
- `requestedEffect`: `read-only` | `proposes-change` | `core-governed-change`;
- `materiality`: the canonical `Materiality` tier (`R0`–`R3`) as already classified by policy;
- `reversibility`: the canonical candidate `Reversibility` union;
- `externalEvidence`: `none` | `bounded` | `material`;
- `durationAndInterruptibility`: `immediate` | `bounded-interruptible` | `recoverable`;
- `systemsInvolved`: a non-empty collection of stable system identifiers;
- `segregationOfDuties`: `not-required` | `required`;
- `regulatoryObligations`: `none` | `applicable`;
- `approval`: `not-required` | `required`.

The request MUST use closed unions and required structured fields only. Free text MUST NOT carry authoritative scope, materiality, permissions, or approvals: no request MAY rely on prose for any decision-relevant value. A request that omits a required axis, uses an unsupported literal, supplies an empty `systemsInvolved` collection, or otherwise fails the closed shape MUST be rejectable before any decision is attempted. Monetary inputs remain BigInt cents upstream in the candidate surface; the router consumes the policy-derived materiality tier and MUST NOT establish materiality thresholds itself.

#### Scenario: Complete typed request

- GIVEN a `RouteRequest` whose scope, `requestedEffect`, and all eight axes are present and drawn from the closed unions
- WHEN the request is submitted for routing
- THEN every decision-relevant value MUST be a typed field of the closed unions, and no free-text prose MAY influence the decision

#### Scenario: Missing or unsupported axis rejected

- GIVEN a `RouteRequest` that omits one of the eight axes or carries an unsupported literal in any axis
- WHEN the request is submitted for routing
- THEN the router MUST reject it without attempting a route decision

### Requirement: Route Decision (Fail-Closed)

The system MUST provide a deterministic `route(request) -> ValidationResult<Route>` decision function that classifies a valid request into exactly one of the three charter routes, following the §5 route-selection criteria and the escalation-only precedence:

1. **Reject as ambiguous** — any missing or unknown axis, empty `systemsInvolved`, or contradiction between `requestedEffect` and an authority-sensitive axis;
2. **Durable mission** — any of: `core-governed-change`; materiality `R2`/`R3`; `irreversible` work; `material` external evidence; `recoverable` work; more than one system involved; segregation of duties required; regulatory obligations applicable; or approval required;
3. **Specialized agent** — no durable signal present, but the request proposes a change (`proposes-change`), needs bounded external evidence, or is bounded-interruptible research, reconciliation, or classification needing its own context;
4. **Direct analysis** — read-only effect, `R0`/`R1`, reversible, immediate, one system, no external-evidence dependency, and no segregation, regulatory, or approval requirement.

The decision MUST be escalation-only: higher-authority requirements win, and no lower route MAY be selected when any axis requires a safer route. File count, document count, and agent count MUST NOT influence the decision. On any ambiguous, missing, unknown, insufficient, or contradictory input, the router MUST fail closed: it MUST return a typed rejection in the existing `ValidationResult` shape whose issues use the `AMBIGUOUS_INPUT` vocabulary and identify the affected fields, and MUST NOT return any `Route` value, partial route, or best-guess route. The function MUST be deterministic and offline: no clock, randomness, environment, transport, or mutable process state MAY influence a decision.

#### Scenario: Direct analysis from a fully safe request

- GIVEN a request that is read-only, `R0`, reversible, immediate, involves one system, needs no external evidence, and has no segregation, regulatory, or approval requirement
- WHEN `route(request)` is invoked
- THEN the function MUST return the `direct-analysis` route and MUST NOT escalate

#### Scenario: Specialized agent from bounded research

- GIVEN a request with no durable signal that proposes a change and needs bounded external evidence, or is bounded-interruptible research, reconciliation, or classification needing its own context
- WHEN `route(request)` is invoked
- THEN the function MUST return the `specialized-agent` route

#### Scenario: Durable mission from any escalation signal

- GIVEN a request carrying at least one durable signal, such as `core-governed-change`, materiality `R3`, irreversible work, material external evidence, recoverable work, multiple systems, segregation of duties, applicable regulatory obligations, or a required approval
- WHEN `route(request)` is invoked
- THEN the function MUST return the `durable-mission` route even when every other axis is low-risk

#### Scenario: Ambiguous input fails closed with no route

- GIVEN a request that is missing an axis, carries an unknown literal, has an empty `systemsInvolved`, or contradicts its own `requestedEffect` against an authority-sensitive axis (for example `read-only` with approval required)
- WHEN `route(request)` is invoked
- THEN the function MUST return a typed `AMBIGUOUS_INPUT` rejection identifying the affected fields and MUST NOT return any `Route` value or guessed route

### Requirement: Route Discriminant and Authority Ceiling

The system MUST provide a closed `Route` discriminant with exactly three members, each carrying a literal authority ceiling that is inseparable from the route:

- `direct-analysis` — authority `no-mutation`;
- `specialized-agent` — authority `proposes-only`;
- `durable-mission` — authority `through-core`.

Every returned route MUST carry exactly its fixed authority ceiling, and no route MAY express, carry, or escalate to greater authority than its ceiling. The router MUST NOT execute work, MUST NOT authorize tools, destinations, or operations, MUST NOT select or apply a Core transition, MUST NOT create or advance a mission or work unit, and MUST NOT write to a ledger, receipt, journal, evidence store, or any other persistence or network state: it returns a proposal only. Work-unit and mission materialization for the specialized and durable routes is deferred to a later integration slice; the router MUST return the typed route proposal and validated routing facts without requiring or creating a mission.

#### Scenario: Authority ceiling is fixed per route

- GIVEN each member of the `Route` discriminant
- WHEN its authority value is inspected
- THEN `direct-analysis` MUST carry `no-mutation`, `specialized-agent` MUST carry `proposes-only`, and `durable-mission` MUST carry `through-core`, and no member MAY expose any authority beyond its ceiling

#### Scenario: Router call proposes only

- GIVEN a valid request and a successful `route(request)` invocation
- WHEN the surrounding storage, mission, and transition surfaces are observed before and after the call
- THEN the router MUST have executed no work, applied no transition, created or advanced no mission or work unit, authorized no tool or destination, and written no ledger, receipt, journal, evidence, store, or network entry

### Requirement: Boundary Compliance

The router MUST import only type-only `missions/` and `candidates/` dependencies and the existing `routing/` surface. It MUST NOT import `agents/`, commands, adapters, stores, ledgers, receipts, journals, transports, or network clients. The router MUST NOT introduce any local transition table or parallel state vocabulary: the Core-owned 15-state mission machine remains frozen, and any transition-aware validation MUST use the injected `CanonicalTransitionValidator` — never a duplicated matrix. The router MUST NOT add, rename, or remove any of the 15 canonical mission states and MUST NOT introduce a reverse import into the mission Core or any other frozen layer. The existing layer order (`contracts -> library modules -> agents -> cmd`) MUST be preserved.

#### Scenario: Import boundary holds

- GIVEN the router's dependency graph
- WHEN its imports are inspected
- THEN it MUST import only mission and candidate types (type-only) and the routing surface, and MUST NOT import `agents/`, commands, adapters, ledgers, receipts, journals, stores, transports, or network clients

#### Scenario: Frozen state machine preserved

- GIVEN the router implementation and the canonical 15-state mission machine
- WHEN its transition handling is inspected
- THEN the router MUST contain no local transition matrix and MUST delegate any transition validation to the injected canonical validator, leaving the 15 states and their transitions unchanged

### Requirement: Testability

The router MUST ship with focused conformance tests that cover, at minimum: correct selection of each of the three routes from valid inputs, including precedence when multiple axes differ; fail-closed `AMBIGUOUS_INPUT` rejection with no route for missing, unknown, empty, or contradictory inputs; authority-ceiling enforcement proving that no route escalates beyond its fixed ceiling; and boundary compliance — the router file MUST be covered by the routing boundary-test production allowlist, with no forbidden imports, no reverse imports, propose-only behavior, and deterministic offline behavior. All tests MUST be deterministic, MUST run without network, transport, or external services, and MUST produce identical results on repeated runs with fixed fixtures.

#### Scenario: Route-selection conformance suite passes

- GIVEN the router conformance suite with representative valid requests for direct analysis, specialized agent, and durable mission, plus precedence cases where axes differ
- WHEN the suite runs
- THEN each request MUST be decided to exactly the route the §5 criteria and precedence require, and no case MAY select a lower route when a durable signal is present

#### Scenario: Authority ceilings enforced by test

- GIVEN the route-selection tests and the authority-ceiling assertions
- WHEN they run
- THEN every returned route MUST carry exactly its fixed ceiling, and no test MAY observe any route expressing greater authority

#### Scenario: Deterministic and offline

- GIVEN the router conformance suite
- WHEN it runs twice in sequence without network or external services
- THEN both runs MUST produce identical pass/fail results and MUST require no clock, randomness, transport, or external runtime
