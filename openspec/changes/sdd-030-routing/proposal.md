# SDD-030 — Organic Accounting Work Routing Proposal

> Phase: Proposal · Status: PROPOSED · Change: `sdd-030-routing` · Program: `drenyra-dominion`
> Roadmap: Peru v1, Wave 1 · Dependency: SDD-010 · Feeds: SDD-040

## 1. Intent

Establish the typed request and result boundary required for organic accounting-work routing without changing the authority Core. The first reviewable slice will introduce additive `WorkUnit` and `WorkResult` surfaces that preserve scope, evidence provenance, pinned policy and skill versions, bounded attempts, candidate identity, and deterministic transition compatibility.

This prepares Drenyra AI to route each professional request through the smallest safe path—direct analysis, specialized agent, or durable mission—while keeping all accounting authority in the Core and all external execution behind authorized adapters.

## 2. Context and roadmap alignment

SDD-030 is **permitted**, belongs to **Wave 1**, depends on the contract surface from **SDD-010**, and will provide routed candidates and structured results consumed by **SDD-040**.

The change supports the 16-program Peru v1 roadmap by creating a common, transport-independent envelope for work entering the accounting authority layer. It aligns with the approved architecture as follows:

- **AI advisory versus deterministic authority:** agents and routing surfaces observe, interpret, and propose; only the Core determines allowed transitions.
- **Evidence versus memory:** evidence is referenced by verifiable hash; Engram or other memory cannot satisfy an evidence requirement.
- **Audit ledger versus accounting journal:** this layer writes neither. The audit ledger remains historical evidence and does not become the accounting journal.
- **Layering:** the routing surface is additive and may import only mission and candidate types. The mission Core must not import routing, agents, commands, or adapters.

## 3. Current-state gap

The durable-mission leg already exists and is well developed:

- `IntentHandler` and `IntentRegistryImpl` formalize deterministic intent handling.
- Five plan-backed handlers cover the frozen mission intents.
- `MissionRuntime` implements the normative 15-state lifecycle with transitions, events, stores, idempotency, recovery, and fencing.

However, the routing contract itself is absent:

- There is **no `WorkUnit` code** for exact objective, complete tenant/company/period scope, evidence-by-hash, pinned skills and policies, authorized tools and destinations, output schema, budgets, success conditions, or typed stop reasons.
- There is **no `WorkResult` code** for structured outcomes, evidence references, proposed candidate identities, unresolved exceptions, policy versions, tool provenance, cost and attempt accounting, or the next transition.
- There is **no preflight router** and no route discriminant for direct analysis, specialized agent, or durable mission.
- The three routes and the §5 selection criteria—materiality, reversibility, external-evidence need, duration and interruptibility, systems involved, segregation of duties, regulatory obligations, and approval need—exist only as prose in the charter and authority model.

The result is a complete durable mission engine without the typed boundary needed to trace, constrain, and route professional work into it.

## 4. Proposed first slice

### 4.1 Included: WorkUnit and WorkResult type surfaces

The first reviewable unit combines exploration slices **A + B** as a low-risk, additive change, estimated at approximately **190–340 authored lines total** and kept within the applicable review budget.

It includes:

1. A `WorkUnit` contract covering:
   - mission identity and exact objective;
   - tenant, RUC, company, and fiscal-period scope;
   - evidence allowed by hash;
   - skills and policies pinned by version;
   - authorized tools and destinations;
   - mandatory output schema;
   - time, token, cost, research-attempt, and correction budgets;
   - a verifiable success condition;
   - typed stop reasons.
2. A `WorkResult` contract covering:
   - structured outcome;
   - evidence references by hash;
   - proposed candidates identified by `subjectHash`;
   - unresolved exceptions;
   - policy versions and tool provenance;
   - cost and attempt accounting;
   - a next-transition value compatible with the existing deterministic mission transition model.
3. Public exports and focused conformance tests for the new pure-type boundary.

### 4.2 Explicitly excluded from the first slice

The first slice does **not** include:

- the deterministic preflight router or §5 route-selection case table;
- execution paths for direct analysis or specialized agents;
- wiring into `IntentRegistryImpl`, CLI, MCP, SDK, Command Center, or external hosts;
- runtime enforcement of budgets;
- a new negotiated-status implementation;
- adapter, ledger, receipt, journal, or mission-runtime behavior changes.

Exploration slice **C**, the deterministic preflight router, remains a separate medium-risk review unit. It will consume the typed boundary and apply the §5 criteria with fail-closed handling for ambiguous or unknown inputs.

## 5. Design principles and invariants

1. **No reverse imports.** The routing surface imports only mission and candidate types. `missions/` remains the frozen Core and never imports routing or downstream consumers.
2. **One frozen state machine.** `WorkUnit` stages work through the existing 15 mission states; it creates no parallel lifecycle. `WorkResult.nextTransition` must reuse or remain directly compatible with the deterministic transition function used by Core status and apply behavior so surfaces cannot contradict authority.
3. **Evidence and candidate identity are structural.** `evidenceRefs` use hashes, and proposed candidates use `Candidate.subjectHash`. Memory and free text are not evidence.
4. **Fiscal values are exact.** Monetary amounts use `BigInt` in minimum monetary units (cents); attempts, versions, sequences, and indexes are integers, never floating-point values.
5. **No free-text authority.** Explanations may accompany results, but free text cannot establish authoritative amounts, states, permissions, approvals, or transitions.
6. **Routing proposes only.** The routing layer may recommend a route or transition. Only the Core determines allowed transitions, and only an authorized adapter executes an approved operation.
7. **Budgets remain distinct.** Research/technical attempts and frozen-candidate correction are separate concepts. The initial research maximum is up to three; frozen-candidate correction remains capped at one before professional escalation.

## 6. Affected areas

The first slice is limited to a new additive routing type surface, its public exports, and focused tests. Existing mission, agent, candidate, gate, recovery, flow, command, receipt, ledger, and adapter behavior remains unchanged.

Future consumers include the preflight router, SDD-040 candidate freeze/review/gate flow, and transport surfaces that need a common WorkUnit/WorkResult contract.

## 7. Non-goals

- No new mission states or alternative state machine.
- No execution-layer or adapter changes.
- No ledger, receipt, or accounting-journal writes.
- No authorization, materiality, approval, or segregation-of-duties changes.
- No implementation of the full preflight router in the first slice.
- No direct-analysis or specialized-agent runtime.
- No use of memory as evidence.
- No changes to frozen v0.1 contracts.

## 8. Product outcome and tradeoffs

### Enables now

- A typed unit of work that can be traced to exact scope, evidence, pinned policy/skills, permitted tools, budgets, and a verifiable success condition.
- A structured result that downstream authority can inspect without interpreting free text.
- A stable foundation for deterministic preflight routing and for SDD-040 to consume proposed candidate identities.
- Early enforcement of architectural boundaries before routing logic or adapters increase the blast radius.

### Defers deliberately

- The complete route-selection policy and its fail-closed decision table.
- Runtime budget enforcement and negotiated transition projections.
- Direct-analysis and specialized-agent adapters or executors.
- CLI, MCP, SDK, Command Center, and external-host integration.

The tradeoff is that the first slice creates no user-visible routing behavior by itself. In return, it establishes the smallest independently reviewable contract boundary and avoids coupling medium-risk route policy to foundational types in one change.

## 9. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A surface invents a second mission lifecycle | Reuse the existing mission status/transition vocabulary and prohibit new states. |
| Reverse imports destabilize the Core | Keep routing additive and type-only toward missions/candidates; prohibit imports from missions back to routing. |
| Free text smuggles authority | Keep authoritative values in structured fields and treat explanation as non-authoritative. |
| Evidence or candidates lose verifiable identity | Require hash references for evidence and `subjectHash` for proposed candidates. |
| Monetary precision is weakened | Require `BigInt` minimum units and integer counters. |
| Type design prematurely fixes router policy | Keep §5 route-selection logic in the separate Slice C unit. |
| A+B exceeds the review budget during implementation | Re-forecast before apply and split at the WorkUnit/WorkResult boundary rather than widening the review unit. |

## 10. Rollback

The first slice is additive and introduces no persisted runtime state or migration. Rollback removes the routing exports, type modules, and their tests. Existing and running missions retain their current state, pinned configuration, handlers, events, and budgets because this slice does not alter mission execution.

Later versioned routing policy must preserve the declared rule that running missions keep their pinned route and budgets; no receipts are created by this layer.

## 11. Success criteria and acceptance direction

The proposal is successful when the first slice can be specified and implemented such that:

- `WorkUnit` represents every mandatory field declared by SDD-030, including both distinct budgets and typed stop reasons.
- `WorkResult` represents every mandatory structured field without relying on free text for authority.
- Evidence references and candidate proposals preserve hash identity.
- Monetary values are type-checked as `BigInt` minimum units, and counters are integers.
- Transition output is compatible with the existing deterministic Core transition model and introduces no new state.
- Import-boundary checks show no reverse dependency into the mission Core.
- Focused Vitest conformance tests and TypeScript typechecking pass under strict TDD, while existing mission and handler behavior remains unchanged.
- The preflight router remains separately scoped for route-selection tests against the charter §5 criteria.
