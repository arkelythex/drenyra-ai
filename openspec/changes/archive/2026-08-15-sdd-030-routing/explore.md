# SDD-030 — Organic Routing: Current-State Exploration

> Phase: Exploration · Status: COMPLETE · Change: `sdd-030-routing` · Program: `drenyra-dominion`
> Repository: `drenyra-ai` · Backend: OpenSpec (file-backed)

## 1. Verdict vs. reality (TL;DR)

The SDD-030 declared scope — **formalize `WorkUnit` and `WorkResult` over the
existing mission handlers and missions** — maps to reality as follows:

- ✅ **Handlers exist and are formalized**: `IntentHandler` contract +
  `IntentRegistryImpl`, five deterministic `PlanIntentHandler` instances
  (`agents/handlers.ts`, `agents/registry.ts`).
- ✅ **Missions exist and are formalized**: `MissionRuntime`, 15-state lifecycle,
  commands, events, stores (`missions/*`), consumed by `cdr/`, `gates/`,
  `recovery/`, `flow/`, and the CLI.
- ❌ **`WorkUnit` and `WorkResult` are entirely ABSENT as code.** No `WorkUnit`,
  `WorkResult`, `nextTransition`, `proposedCandidates`, `costAndAttempts`,
  `policyVersions`, or `toolProvenance` symbol exists anywhere in the tree.
  Every "work unit" match in the repo is an SDD process term (apply-progress /
  ecosystem-coherence planning), not a runtime type.
- ❌ **There is no routing/preflight layer.** The three routes (direct analysis /
  specialized agent / durable mission) and the §5 selection criteria exist only as
  prose in `charter.md` §5 and `authority-model.md` §4. No route discriminant, no
  route-selection function, no preflight module.

**Gap:** the mission/handler machinery is the *durable-mission* leg of routing,
fully built. What SDD-030 adds is (a) the `WorkUnit` request envelope with bounded
attempts / pinned skills / authorized tools / typed stop reasons, (b) the
structured `WorkResult` schema, and (c) a deterministic preflight router that
picks the smallest safe route. (a) and (b) are new pure-type surfaces; (c) is new
logic over the §5 criteria.

---

## 2. Current-state inventory (exact citations)

### 2.1 Mission model

Public API — `missions/index.ts`. Re-exports the full subsystem and declares the
zero-runtime-dependency posture (node:crypto only).

**Snapshot & supporting types** — `missions/types.ts`:

- `MissionSnapshot` (fields: `id`, `companyId`, `fiscalPeriod`, `intent`,
  `status`, `version`, `progress`, `steps`, `currentStep`, `blockers`,
  `proposal`, `rejection`, `receiptId`, `receiptHash`, `lastEventSequence`,
  `createdAt`, `updatedAt`).
- `MissionStep` (`PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED`).
- `MissionProposal` (id, missionId, version, `evidence: EvidenceItem[]`,
  `evidenceHash`, `summary`, `riskLevel`, generatedAt, expiresAt).
- `MissionBlocker`, `MissionRejection`, `AccountingException`, `ReadinessGateResult`.
- `EvidenceItem` and `ReceiptType` are **re-exported** from `receipts/types.ts`
  (single definitions, no duplicate).

**Status** — `missions/status.ts` (`AccountingMissionStatus`), transition rules in
`missions/transitions.ts` (`transition`, `validateTransition`, `guardTerminal`,
`reconcileTransition`, `isValidRecoveryPath`). 15-state lifecycle is normative
(`authority-model.md` §4.1).

**Commands** — `missions/commands.ts`:

- `MissionIntent` union: `"monthly-close" | "correction" | "reconciliation" |
  "invoice-review" | "compliance-check"`.
- `CreateMissionCommand` (`companyId`, `fiscalPeriod`, `intent`, `input.instruction`).
- `ExecuteMissionCommand` (`expectedMissionVersion`), `ApproveMissionCommand`,
  `RejectMissionCommand`, `ReconcileMissionCommand`.
- `MissionCommand` aggregate union (`create | execute | approve | reject | reconcile`).

**Runtime** — `missions/runtime.ts`:

- `MissionRuntime` class (durable state machine): `start()`, `apply()`,
  `recoverIncomplete()`, `reconcile()`; `MissionApplyResult`,
  `BoundMissionCommand`, `canonicalHash`, `IdempotencyConflict`.
- Idempotency replay + optimistic concurrency (expected version) + fencing.

**Stores** — `missions/store.ts`: `MissionStore`, `MissionEventStore`,
`IdempotencyStore` interfaces + in-memory impls (`InMemoryMissionStore`,
`InMemoryMissionEventStore`, `InMemoryIdempotencyStore`). File adapter in
`cmd/adapters/file-mission-store.ts` (`MissionFileStore`); Postgres impls exist
under `missions/__tests__/store.postgres.test.ts`.

### 2.2 Handler model

**Contract** — `missions/intents.ts`:

- `interface IntentHandler { intent: MissionIntent; execute(mission: MissionSnapshot, command: ExecuteMissionCommand): Promise<MissionSnapshot | null> }`. Returns the next snapshot (a single legal state change) or `null` ("no change").
- `interface IntentRegistry { register(handler): void; resolve(intent): IntentHandler | undefined }`, with `IntentRegistryImpl` (in-memory `Map`).

**Plans** — `agents/plans.ts`: `IntentPlan` (`intent`, `title`, `steps:
AgentPlanStep[]`, `proposalSummary`, `riskLevel`), `INTENT_PLANS` (5 frozen plans),
`AGENT_INTENTS` (5 intents).

**Handlers** — `agents/handlers.ts`: `PlanIntentHandler` (stateless, pure
snapshot→snapshot), one per frozen intent:
`monthlyCloseHandler`, `correctionHandler`, `reconciliationHandler`,
`invoiceReviewHandler`, `complianceCheckHandler`. Deterministic staged lifecycle:
stage → activate → evidence gate → approval gate → human approve → finalize.
Never claims side effects or approval.

**Registry composition** — `agents/registry.ts`: `AGENT_HANDLERS` +
`createAgentRegistry()` (fresh `IntentRegistryImpl`, every handler registered).
`agents/index.ts` is the public API of the orchestration layer.

### 2.3 WorkUnit / WorkResult — ABSENT

Repo-wide search for `WorkUnit`, `WorkResult`, `work unit`, `work result`,
`nextTransition`, `proposedCandidates`, `costAndAttempts`, `policyVersions`,
`toolProvenance`:

- **Zero code symbols.** No type, class, interface, or constant.
- The only "work unit" matches are **SDD process terminology**: apply-progress
  "work units" (`openspec/changes/**/apply-progress.md`), and the
  ecosystem-coherence *planning* docs (`openspec/changes/ecosystem-coherence/*`).
  These are governance/planning records, not runtime types.

The closest existing analog to a "structured result" is `MissionProposal`
(`missions/types.ts`) and the flow-level `ClosePackage` (`flow/close.ts`) — but
neither has `evidenceRefs`, `policyVersions`, `toolProvenance`, `costAndAttempts`,
or `nextTransition`.

### 2.4 Routing — procedural, not declarative

- **Registry**: `IntentRegistryImpl` (`missions/intents.ts`) resolves a handler by
  intent via `Map`. `createAgentRegistry()` (`agents/registry.ts`) populates it.
- **No dispatcher/switch over routes**: the `durable-mission` leg routes intent→handler
  through the registry. The "direct analysis" and "specialized agent" routes have **no
  code**. Route selection per `authority-model.md` §4 and `charter.md` §5 is prose only.
- **CLI dispatch** — `cmd/cli.ts` (lines 32–59): a static command map
  `{ start, apply, status, recover }` to `missionStartCommand`,
  `missionApplyCommand`, `missionStatusCommand`, `missionRecoverCommand`.
- **Result return/reporting** — `MissionApplyResult` (`{ snapshot, event,
  replayed }`); CLI emits JSON to stdout and stores snapshots/events via the file
  store. No structured "result" envelope.

### 2.5 Tests

`missions/__tests__/` (runtime, transitions, status, idempotency, events, fencing,
outbox, reconciliation, store.*, e2e-monthly-close, postgres.*) — thorough
coverage of the Core lifecycle, transitions, stores, recovery, fencing, idempotency.
`agents/__tests__/handlers.test.ts` — registry composition (one handler per
intent), full staged lifecycle per intent, determinism, "no claimed side effects".
`cmd/__tests__/cli.test.ts` — mission start/apply/status/recover exit codes,
real-handler end-to-end lifecycle (DRAFT→…→COMPLETED), `MissionFileStore` hydrate.
`cdr/__tests__/successor.test.ts` — successor mission composition over the real
`MissionRuntime`.

### 2.6 Related fiscal-kernel & boundaries

- **candidates** (`candidates/types.ts`): `Candidate` (id, `subjectHash`, scope,
  materiality R0–R3, status, reviews, corrections), `CandidateScope`,
  `MaterialityInput`. This is the natural shape for `WorkResult.proposedCandidates`.
- **cdr** (`cdr/types.ts`, `cdr/successor.ts`): `CdrSuccessorComposer` wraps the
  mission runtime via `CdrMissionPort` / `MissionRuntimePort` — a **consumer** of
  missions, feeds candidates/receipts into freeze/review (SDD-040 trajectory).
- **gates** (`gates/mission.ts`, `gates/types.ts`): evaluate against `MissionSnapshot`.
- **recovery** (`recovery/policy.ts`, `recovery/replay.ts`): replay over mission events.
- **flow** (`flow/close.ts`): `runMonthlyClose` — deterministic close vertical
  (preflight → evidence via adapters → candidates → guardian → receipts → ledger →
  `ClosePackage`). It uses `missionId` in evidence fetches and imports `candidates/`,
  `guardian/`, `receipts/`, `ledger/`, `adapters/` — but does **not** import the
  mission runtime (it is a parallel durable flow; the successor/cdr path does wire
  missions).
- **Direction of imports (layer model):** `missions/` is the Core. Consumers
  (`agents/`, `cdr/`, `gates/`, `recovery/`, `flow/` via cdr, `cmd/`) import
  `missions/index.js`. **No reverse imports** — `missions/` never imports
  `agents/` or any consumer.

---

## 3. The gap

| SDD-030 declared scope | Current state |
| --- | --- |
| Deterministic **preflight** (scope, permissions, risk, evidence) | Absent. `flow/close.ts` does a scope preflight for *its* vertical only; there is no request-level router. |
| **Route selection** (materiality, reversibility, external-evidence need, duration, systems, segregation, regulatory, approval) | Prose only (`charter.md` §5, `authority-model.md` §4). No discriminant, no function, no tests. |
| **Three routes** (direct analysis / specialized agent / durable mission) | Only "durable mission" exists (missions Core + handlers). Direct/specialized have no code. |
| **WorkUnit contract** (missionId, objective, full scope, evidence-by-hash, skills/policies pinned by version, authorized tools/destinations, mandatory output schema, budgets, verifiable success condition, typed stop reasons) | **Absent.** `CreateMissionCommand` carries only `companyId/fiscalPeriod/intent/instruction`. No budgets, no skill pinning, no authorized-tool list, no success condition, no typed stop reasons. |
| **Two budgets** (research/technical attempts ≤3; frozen-candidate correction ≤1) | **Absent.** No attempt counter exists. `runtime.apply()` is command-driven, not budget-governed. |
| **WorkResult schema** (outcome, evidenceRefs, proposedCandidates, unresolvedExceptions, policyVersions, toolProvenance, costAndAttempts, nextTransition; amounts as BigInt cents; no free-text authority) | **Absent.** `MissionProposal` and `ClosePackage` are the nearest structured shapes but omit the WorkResult fields. |
| **Mission lifecycle + negotiated transitions** (`status` / `eligibleTransitions` / `nextAction`, denial codes + continuations) | Lifecycle ✅ (`missions/status.ts`, `transitions.ts`). Negotiated `status/eligibleTransitions/nextAction` envelope with denial codes: **partial** — the Core has transitions and error codes, but no published `status`/`eligibleTransitions`/`nextAction` view consumed by surfaces. |

**Core gap statement:** the durable-mission engine (lifecycle, handlers, registry,
stores) is implemented and battle-tested; the **routing envelope** (`WorkUnit`),
the **structured result** (`WorkResult`), and the **preflight router** (route
selection over the §5 criteria) are entirely unimplemented. SDD-030 should land
these as new pure-type surfaces + a deterministic router, layered over the existing
missions types (intent, snapshot) and candidate types, without touching the frozen
Core state machine.

---

## 4. First-slice candidates

> All slices respect the 400-authored-line review cap (charter §6.1). They are
> independently rollback-safe. Each ships with strict-TDD RED→GREEN→TRIANGULATE→REFACTOR.

### Slice A — `WorkUnit` type (pure types, low risk)

New `WorkUnit` request envelope: `missionId`, `objective`, full scope (tenant,
RUC, company, period), `evidenceAllowedByHash[]`, pinned `skills`/`policies`
(by version), `authorizedTools`/`destinations`, `outputSchema`, budgets
(`researchAttemptsMax`, `correctionMax = 1`), `successCondition`,
`stopReasons` (typed). Placed in a new `routing/` (or `missions/work-unit.ts`)
module **importing only missions/candidates types**. Zero side effects.

- **Estimate:** ~90–160 authored lines + ~60–110 test lines.
- **Risk:** LOW (pure type surface; no behavior change to the Core).

### Slice B — `WorkResult` schema (pure types, low risk)

New structured result: `outcome`, `evidenceRefs[]` (by hash), `proposedCandidates[]`
(shaped like `Candidate` / referenced by `subjectHash`), `unresolvedExceptions[]`,
`policyVersions[]`, `toolProvenance[]`, `costAndAttempts` (BigInt cents, integer
attempt counts), `nextTransition`. BigInt convention, no free-text authority.

- **Estimate:** ~100–180 authored lines + ~60–120 test lines.
- **Risk:** LOW. Could ship with Slice A as one unit if kept under 400 lines.

### Slice C — preflight router (logic, medium risk)

Deterministic `route(request) → Route` where `Route` discriminates
`direct-analysis | specialized-agent | durable-mission`, computed from the §5
criteria (materiality, reversibility, external-evidence need, duration/
interruptibility, systems involved, segregation of duties, regulatory, approval
need) — never file/agent counts. Maps the `durable-mission` leg onto the existing
`IntentRegistryImpl`; `direct`/`specialized` become typed route records for future
consumers (SDD-040).

- **Estimate:** ~130–220 authored lines + ~100–150 test lines (route-selection
  case table per charter §5).
- **Risk:** MEDIUM (selection logic; must fail closed on ambiguous/unknown input).

**Dependency order:** A→B independent of C; C consumes A/B route records. If A+B
stay under the line cap they ship together; C is a separate reviewable unit.

---

## 5. Risks & boundaries

- **Layer model / no reverse imports.** `missions/` is the frozen Core. The new
  routing surface (`WorkUnit`/`WorkResult`/router) MUST be a new layer or additive
  module importing only `missions` and `candidates` types. It must never be
  imported by `missions/`, and never import `agents/` (which is already a consumer
  of missions). `cdr/`, `gates/`, `recovery/`, `cmd/` remain downstream consumers.
- **Frozen state machine.** SDD-030 must not introduce alternative mission states.
  `WorkUnit` is a request envelope that stages *through* the existing 15 frozen
  states; `WorkResult.nextTransition` must be consistent with the same
  deterministic transition function that feeds `status` and `apply` (charter §4.4),
  or they can contradict each other.
- **Ledger/evidence boundaries.** `evidenceRefs` are allowed **by hash**, never
  free text. `proposedCandidates` reference `Candidate.subjectHash`. Amounts are
  **BigInt cents** (fiscal convention, `missions/types.ts` header); sequence/
  version/index are JSON integers, never floats. No free text may introduce
  authoritative amounts, states, permissions, or approvals (`authority-model.md` §4.3).
- **Budget enforcement.** The two-budget scheme (research/technical ≤3,
  frozen-candidate correction ≤1) is a hard guard against infinite loops and a
  "second review" silently rewriting a candidate. Slices A/B define the budget
  *types*; enforcement may be a later slice so the Core runtime is not destabilized.
- **Five-axis vocabulary.** WorkUnit/WorkResult statuses must map to the canonical
  five-axis vocabulary (`openspec/programs/drenyra-dominion/status-and-evidence.md`:
  lifecycle; implementation maturity; evidence; gate decision; temporal class).
  Never derive lifecycle from capability maturity; never mark a capability complete
  from docs or mocks alone (charter §6, §6.2).
- **No execution authority.** Routing proposes; only the Core determines the
  allowed transition and only an authorized adapter executes (`authority-model.md`
  §4). The router is a *proposal* surface, not an executor.

---

## 6. Evidence references

- `openspec/programs/drenyra-dominion/sdds/sdd-030-routing/README.md` — declared scope.
- `openspec/programs/drenyra-dominion/authority-model.md` §4 (organic routing,
  WorkUnit budgets, WorkResult shape, negotiated transitions).
- `openspec/programs/drenyra-dominion/charter.md` §5 (route taxonomy + §5 criteria),
  §6.1 (400-line cap, strict TDD).
- `openspec/programs/drenyra-dominion/status-and-evidence.md` — five-axis vocabulary.
- `openspec/programs/drenyra-dominion/sdds/sdd-010-contracts/README.md` — SDD-030
  consumes this contract surface; SDD-040 consumes routed candidates/WorkResults.
- Code: `missions/{index,types,commands,status,transitions,runtime,intents,store}.ts`,
  `agents/{plans,handlers,registry,index}.ts`, `cmd/cli.ts`,
  `cmd/commands/mission-{start,apply,status,recover,demo-handler}.ts`,
  `candidates/types.ts`, `cdr/{types,successor}.ts`, `flow/close.ts`,
  `gates/mission.ts`, `recovery/{policy,replay}.ts`.
- Tests: `missions/__tests__/*`, `agents/__tests__/handlers.test.ts`,
  `cmd/__tests__/cli.test.ts`, `cmd/__tests__/file-mission-store.test.ts`,
  `cdr/__tests__/successor.test.ts`.
