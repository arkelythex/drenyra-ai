# SDD-030 Slice C — Preflight Router — Exploration

> Status: exploration · Change: `sdd-030-router` · Program: `drenyra-dominion`
> Slice C of SDD-030 (organic accounting work routing). Slices A+B already delivered
> the `routing/` WorkUnit/WorkResult typed surface (change `sdd-030-routing`, PRs
> #39/#40). This slice lands the **preflight router** over the §5 route-selection
> criteria. Propose-only, fail-closed, deterministic.

---

## 1. The §5 routing criteria (the router's spec source)

Source of truth: `openspec/programs/drenyra-dominion/charter.md` §5 (Taxonomy and
domain criteria) and `openspec/programs/drenyra-dominion/authority-model.md` §4
(Organic work routing). They are prose today — no discriminant, no function, no
tests.

Charter §5 core principle:

> Use the smallest route that preserves evidence, authority, and recovery.

Preflight precedes route selection: "Deterministic preflight — scope · permissions
· risk · evidence", then "Minimum safe route".

### The three routes (verbatim table, charter §5)

| Route | When used | Persistence | Authority |
| --- | --- | --- | --- |
| Direct analysis | Read-only query/explanation/inspection, small scope | Result and sources when relevant | No mutation |
| Specialized agent | Reconciliation, classification, bounded research needing its own context | Work unit, evidence, structured result | Proposes only |
| Durable mission | Close, declaration, material correction, multiple dependencies, recoverable work | Events, attempts, candidates, decisions, receipts | Passes through the Core |

(`authority-model.md` §4 gives the same three with near-identical wording.)

### The selection criteria (charter §5, verbatim list)

> File count, documents, or agent count alone never decides the route.
> Selection considers: materiality · reversibility · need for external evidence ·
> duration and interruptibility · number of systems involved · segregation of
> duties · regulatory obligations · need for approval.

That is the **eight-axis decision vector**. (SDD-030 README and the A+B exploration
restate the same eight: materiality, reversibility, external-evidence need,
duration/interruptibility, systems involved, segregation of duties, regulatory
obligations, approval need.)

### Which axis maps to which route (derived, for the router's decision table)

Charter/authority-model route *when-used* wording → axis mapping (this is the
inference the router must encode; it is derived, not verbatim):

- **Direct analysis** ⇐ read-only query + small scope + no external evidence need +
  no approval need + no mutation. Persistence: result + sources; authority: no mutation.
- **Specialized agent** ⇐ bounded research needing its own context (reconciliation,
  classification) + external-evidence need bounded. Persistence: work unit + evidence
  - structured result; authority: **proposes only**.
- **Durable mission** ⇐ material or multi-step process + multiple systems +
  regulatory obligations + approval need + recoverable. Persistence: events/attempts/
  candidates/decisions/receipts; authority: **passes through the Core**.

The route's **authority** column is a hard invariant for the router output: direct =
`no-mutation`, specialized = `proposes-only`, durable = `through-core`. The router
must never emit a route whose authority exceeds that ceiling (see Risks §5).

---

## 2. The routing surface the router consumes (exact symbols)

Delivered in `routing/` (change `sdd-030-routing`). `routing/index.ts` re-exports
`./types.js` and `./helpers.js`. Layer rule: **type-only imports from `missions/` and
`candidates/` only**; no `agents/`, adapters, stores, ledgers, receipts, journals,
transport. Runtime dependency: `node:crypto` only.

### `routing/types.ts`

- Brands: `JsonInteger`, `Sha256Hash`; limits `ResearchAttemptLimit = 1|2|3`,
  `CorrectionAttemptLimit = 1`.
- `EvidenceRef`, `VersionPin`, `WorkScope`, `AuthorizedTool`, `AuthorizedDestination`
  (`kind: "CORE"|"EVIDENCE_STORE"|"REVIEW_QUEUE"`), `OutputSchemaRef`,
  `SuccessCondition`, `WorkBudgets`, `WorkStopReason` (9-kind closed union incl.
  `AMBIGUOUS_INPUT`, `UNSUPPORTED_WORK`), `WorkUnit`, `ProposedCandidateRef`,
  `WorkOutcome`, `ToolProvenance`, `CostAndAttempts`, `NextTransition`, `WorkResult`.
- `CanonicalTransitionValidator = typeof validateTransition` (injected, never
  duplicated/imported locally).
- Boundary comment: advisory only; captures scope, evidence provenance, pinned skills
  and policies, bounded attempts, candidate identity, and deterministic transition
  compatibility **without executing work, writing ledgers, or changing authorization**.

### `routing/helpers.ts`

- `ValidationIssue` (codes: INVALID_ID, INVALID_SCOPE, INVALID_HASH, INVALID_INTEGER,
  INVALID_BUDGET, MISSING_CONDITION, INVALID_STOP_REASON, INVALID_TRANSITION,
  MISSION_MISMATCH) and `ValidationResult<T> = {ok:true;value} | {ok:false;issues}`.
- `toJsonInteger`, `parseSha256Hash`, `createEvidenceRef`.
- `createWorkUnit(mission, input)`, `validateWorkUnit(unit, mission)`,
  `advanceWorkUnit(unit, to, validateTransition)`, `createWorkResult(...)`,
  `validateWorkResult(...)`, `createProposedCandidateRef(candidate, materialityBasis)`.
- Fail-closed contract: invalid inputs return typed issues and **no partial envelope**.

### What the router can consume (and must reuse)

- `createWorkUnit` / `WorkUnit` for the `specialized-agent` and `durable-mission`
  legs (a WorkUnit is the specialized-agent persistence).
- `ValidationResult` + `ValidationIssue` as the fail-closed result shape the router
  should mirror.
- `WorkScope`, `WorkBudgets`, `SuccessCondition` as the envelope the router would
  seed for a route.
- Existing `AMBIGUOUS_INPUT` stop reason: the natural typed discriminant for a
  fail-closed "cannot decide a route" outcome.

---

## 3. The input surface (what a route request looks like today)

There is no request-level type today; the nearest existing input is the durable-mission
command. The router would need a **new request discriminant** that carries the eight
§5 axes plus scope.

### `missions/commands.ts`

- `MissionIntent = "monthly-close" | "correction" | "reconciliation" | "invoice-review"
  | "compliance-check"` (5 frozen intents).
- `CreateMissionCommand { companyId; fiscalPeriod; intent; input:{ instruction } }` —
  the current durable-mission request (no budgets, no skill pinning, no authorized
  tools, no route).
- `ExecuteMissionCommand { expectedMissionVersion }`.

### `missions/intents.ts` — IntentHandler contract (Core-owned)

- `IntentHandler { intent: MissionIntent; execute(mission, command): Promise<MissionSnapshot|null> }`.
- `IntentRegistry { register(handler); resolve(intent) }`; `IntentRegistryImpl`.

### `agents/registry.ts` — populated registry (a consumer of missions)

- `AGENT_HANDLERS`: the 5 handlers (monthlyCloseHandler, correctionHandler,
  reconciliationHandler, invoiceReviewHandler, complianceCheckHandler).
- `createAgentRegistry()` → `IntentRegistryImpl`.
- **Layer note:** `agents/` is a *consumer* of `missions/`. The router must NOT import
  `agents/` (boundary forbid-list includes `agents/`). Routing may reference intents
  by their string union but must not wire handlers directly.

### `candidates/types.ts`

- `Candidate`, `CandidateScope { ruc; period }`, `Materiality = "R0"|"R1"|"R2"|"R3"`,
  `Reversibility = "reversible"|"partially-reversible"|"irreversible"`,
  `MaterialityInput { value: bigint; reversibility; jurisdiction }`, `orderOf(...)`.
- The router's materiality axis maps onto `Materiality`/`orderOf` (R0<R1<R2<R3).

### `missions/types.ts`

- `MissionSnapshot` (id, companyId, fiscalPeriod, intent, status, ...), `AccountingException`.

**Gap on input:** `CreateMissionCommand` is durable-mission-specific. A preflight
router needs a broader `RouteRequest` that supplies scope (tenant/ruc/company/period —
the `WorkScope` fields) plus the eight §5 axes, independent of intent, so that
read-only queries and bounded research can also route.

---

## 4. The three routes (concrete output shape for slice C)

The router must produce a **typed route** (a proposal, never an execution). A faithful
discriminant:

```
type Route =
  | { route: "direct-analysis"; authority: "no-mutation"; resultSurface: "explainable-result" }
  | { route: "specialized-agent"; authority: "proposes-only"; workUnit: WorkUnit; destination: "REVIEW_QUEUE"|"CORE" }
  | { route: "durable-mission"; authority: "through-core"; missionIntent: MissionIntent; ... }
```

Route assignment derives from the eight §5 axes (section 1), not file/agent counts.
The `specialized-agent` leg maps onto the existing `WorkUnit` envelope (already built
in A+B); `durable-mission` maps onto `MissionIntent`; `direct-analysis` is a typed
record with no mutation authority.

---

## 5. The gap — what slice C must add

**Core gap statement:** the routing envelope (`WorkUnit`) and structured result
(`WorkResult`) are implemented (A+B); the **preflight router** (route selection over
the §5 criteria) is entirely absent — prose only. Confirmed: `routing/` has only
`index.ts`, `types.ts`, `helpers.ts` and `__tests__/` (boundary, work-unit,
work-result). No `router.ts`, no `Route` type, no route-decision function, no router
tests.

### First-slice candidate (slice C)

New `routing/router.ts` (+ `Route` type, likely in `routing/types.ts` or `router.ts`):

1. **`RouteRequest` input type** — scope (tenant, ruc, company, period) + the eight
   §5 axis inputs (materiality/`MaterialityInput`, reversibility, needForExternalEvidence,
   durationAndInterruptibility, systemsInvolved, segregationOfDuties,
   regulatoryObligations, needForApproval). Deterministic, offline.
2. **`route(request) → ValidationResult<Route>`** — the fail-closed decision function.
   Ambiguous/unknown/insufficient axis values → `{ ok:false, issues:[...] }` (reuse
   `ValidationIssue`, `AMBIGUOUS_INPUT`), **never a best-guess route**.
3. **`Route` discriminant** with per-route `authority` (no-mutation / proposes-only /
   through-core). The router returns a **proposal**; it never executes, never
   authorizes, never writes a ledger/receipt/journal, never transitions a mission.
4. Maps `specialized-agent` → a `WorkUnit` (reuse `createWorkUnit` or a small
   route-specific builder) and `durable-mission` → `MissionIntent`.

**Estimate:** ~130–220 authored lines + ~100–150 test lines (route-selection case
table per charter §5). Within the 400-authored-line review cap. Test count from the
A+B exploration: MEDIUM risk.

**Test surface to add** (`routing/__tests__/router.test.ts`):

- Per-axis route-selection cases against charter §5 (the "smallest safe route"
  decision table).
- Fail-closed: ambiguous/unknown/insufficient axis → typed issues, no route.
- Propose-only invariant: router call performs no execution, no transition, no
  ledger/receipt/journal write (mirror the `boundary.test.ts` "surface proposes only"
  pattern; add `router.ts` to the production-file allowlist so the import-boundary
  test still passes).
- Deterministic offline (mirror boundary "deterministic and offline").
- Direct-analysis never returns mutation authority; durable-mission never below
  through-core when it must pass through the Core.

---

## 6. Existing routing tests — what's covered (and what slice C adds)

`routing/__tests__/`:

- **`boundary.test.ts`** — import allowlist (type-only missions/candidates + node:crypto,
  forbid-list: agents/, cmd/, adapters/, ledger, receipts, journal, store, network,
  http); proves the frozen Core has no reverse imports and is unchanged; surface
  "proposes only" (watches ledger/receipts/journal/evidence dirs before/after); and
  "deterministic and offline" (no clock/randomness/network/transport).
- **`work-unit.test.ts`** — `createWorkUnit` mission-derived construction; 15-state
  stage alignment; budget types/bounds; typed stop reasons; evidence allowlist/hashing.
- **`work-result.test.ts`** — BigInt costs/integer attempts; evidence provenance;
  candidate identity; nextTransition consistency; typed outcomes / no free-text
  authority; structured exceptions/provenance.

**No router coverage exists.** Slice C adds the route-selection case table and the
fail-closed/propose-only router tests (section 5). The router file must be added to
`PRODUCTION_FILES` in `boundary.test.ts` so the import-boundary invariant extends to
it.

---

## 7. Risks & boundaries

- **Propose-only invariant (highest).** The router emits a `Route` *proposal*; it must
  never execute work, never determine the allowed transition, never authorize, never
  write a ledger/receipt/journal, never create or transition a mission. Only the Core
  determines the allowed transition; only an authorized adapter executes
  (`authority-model.md` §1, §4). The existing `boundary.test.ts` "surface proposes only"
  and "deterministic and offline" tests must extend to the router.
- **Fail-closed on ambiguity.** Ambiguous/unknown/insufficient §5 axes must yield typed
  issues and no route (`AMBIGUOUS_INPUT`), never a guessed "smallest" route. Mirror the
  `ValidationResult` fail-closed contract from `helpers.ts`.
- **Layer model / no reverse imports.** `missions/` is the frozen Core. The router must
  import only `missions` and `candidates` types (matching the A+B boundary test); it
  must **never import `agents/`** (a consumer of missions) even though it maps
  `durable-mission` onto `MissionIntent`. No new mission states; `WorkUnit.stage`
  stays aligned with the 15 frozen states via the injected canonical validator.
- **Frozen state machine / transition consistency.** `WorkResult.nextTransition` and any
  stage advance must go through the injected `CanonicalTransitionValidator`; no
  routing-local transition table.
- **No execution / budget enforcement.** The two budgets (research ≤3, correction ≤1)
  are typed in A+B; runtime enforcement is deferred to a later slice. The router must
  not pretend to enforce them.
- **Five-axis vocabulary.** Router status/maturity must map to the canonical five-axis
  vocabulary (`status-and-evidence.md`); never mark a capability complete from docs or
  mocks alone (charter §6).
- **BigInt / no free-text authority.** Materiality value is BigInt cents; route decision
  must never derive authority from free text (charter/authority-model §4.3).

---

## 8. Suggested proposal/spec anchors for the next phases

- Spec source: charter §5 verbatim (three routes + eight criteria + "smallest safe
  route"); authority-model §4 + §5.3/§5.4 (tiers R0–R3, capacity ceilings as policy,
  not constants).
- Design decisions the proposal/design must fix:
  1. Exact `RouteRequest` axis input types (offline, deterministic).
  2. The precedence/decision table mapping axes → route (direct vs specialized vs
     durable), fail-closed defaults.
  3. Whether `specialized-agent` and `durable-mission` build a `WorkUnit` immediately
     or only return a `Route` record for SDD-040 to materialize.
  4. `Route.authority` ceiling per route and the test that enforces it.
  5. Adding `router.ts` to the boundary-test production allowlist.
- Consumers: SDD-040 (RDA freeze/review/gate over routed candidates and WorkResults).
