# SDD-100 — Command Center Core Projection Surface

## Intent

Create the first drenyra-ai-side slice for SDD-100: a read-only, deterministic mission projection library that `drenyra-command-center` can consume without reconstructing Core lifecycle rules.

The new `projection/` module will center on:

```ts
projectMission(snapshot) => {
  status,
  eligibleTransitions,
  nextAction,
  deny?,
}
```

It will derive eligibility from `missions/status.ts:VALID_TRANSITIONS`. It will not create a second state machine, mutate state, execute approvals, or claim authority.

## Current state and gap

Drenyra-ai already has the authoritative source data:

- `missions/status.ts` defines the 15 canonical mission states and `VALID_TRANSITIONS`.
- Mission transition guards enforce lifecycle mutations and fail closed.
- `routing/types.ts:WorkStopReason` provides a typed denial precedent.
- Guardian reports, candidates, signed receipts, and close packages expose other product-relevant data.
- The CLI can emit mission snapshots as JSON, and MCP already exposes read-only capabilities and ledger surfaces.

There is no transport-neutral projection answering the Command Center's basic questions:

- What is the canonical status?
- Which transitions are eligible now?
- What should the operator do next?
- If a continuation is unavailable, what code, cause, and continuation should be shown?

The sibling UI has precedent for re-deriving mission and gate state. That duplicated interpretation can drift from Core and become an accidental second authority. The missing boundary is a read-only Core projection, not another workflow engine.

## Proposed change

### First-slice scope — Option A

Add a `projection/` library module and package subpath that:

1. Accepts a typed mission snapshot with canonical status and only the minimal request context needed for denial projection.
2. Returns canonical `status` unchanged.
3. Derives `eligibleTransitions` directly from `VALID_TRANSITIONS`.
4. Produces one deterministic, typed `nextAction` for each lifecycle status.
5. Optionally returns a denial with stable `code`, `cause`, and actionable `continuation` when a requested path is unavailable.
6. Fails closed for malformed or unsupported input.
7. Performs no mutation, gate execution, approval, receipt creation, or fiscal decision.
8. Includes focused unit and conformance tests for all 15 states.

The denial vocabulary will follow the discipline of `WorkStopReason` without coupling projection to routing execution. The specification will decide exact codes, preferring existing terms such as `INVALID_TRANSITION`, `APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, and `POLICY_BLOCKED` where semantics match.

`nextAction` is machine-readable guidance for later UI localization. It is not authorization and must never imply that a transition was approved or executed.

### Why Option A

Option A is recommended because it:

- fixes the authority-boundary problem with the smallest useful slice;
- gives the Command Center one Core-owned lifecycle projection;
- fits the 300 changed-line review budget in one PR;
- proves the shape before a public contract is frozen; and
- avoids CLI or MCP adapters before consumer adoption.

Estimated implementation size, including tests: **200–260 changed lines**.

### Follow-up slices

**Option B** should follow after adoption coordination. It adds a DRAFT transport-neutral `contracts/projection.md` and a thin `drenyra-ai project` JSON dump command. At 350–500 changed lines, it needs a separate slice or chained PR.

**Option C** should be considered only after the shape is proven. It adds a frozen contract, conformance vectors and CI drift protection, the CLI dump, and a read-only MCP tool. At 600+ changed lines, it requires multiple PRs and public-contract freeze ceremony.

## Architecture mapping

### 16-program Peru v1 roadmap

This is the drenyra-ai contribution to **SDD-100 Professional Command Center**, a Wave 3 surface in the approved 16-program Peru v1 roadmap.

- **SDD-020 provides:** configured, pinned hosts running projected missions.
- **SDD-060 provides:** organization-scoped views and approval-chain context.
- **SDD-090 provides:** Guardian findings for later display.
- **SDD-110 consumes:** the production and commercial product surface built on these projections.

This slice projects only mission lifecycle state. It establishes a boundary on which later tenant, evidence, policy, ingest, journal, and SUNAT-facing roadmap slices can add projections without moving authority into the UI. Those are phased roadmap capabilities, not permanent exclusions.

### Approved layer model

```text
contracts/ (normative, versioned)
  -> library modules, including projection/
    -> agents/
      -> cmd/
```

For Option A:

- `projection/` may import canonical mission types and transition data.
- Lower-level domain modules must not import `projection/`.
- `projection/` must not import agents, CLI adapters, UI code, or sibling repositories.
- The library remains compatible with the node:crypto-only constraint.
- A future contract may normatively describe the payload; this slice neither freezes nor claims a public transport contract.

### AI advisory versus deterministic authority

Drenyra-ai is the AI advisory orchestration layer; deterministic Core rules retain authority over accounting decisions and transitions.

- `status` and `eligibleTransitions` are deterministic readings of Core state.
- `nextAction` is guidance, not approval or mutation.
- `deny` explains an unavailable continuation but cannot override a gate.
- Agents and UI may consume the result but cannot treat it as proof an operation occurred.
- Actions return through Core, which recalculates current state and gates instead of trusting client state.

### Audit ledger versus accounting journal

The existing `ledger/` is audit-only; it is not the accounting journal planned by the Peru v1 roadmap.

This slice does not add or reinterpret ledger entries, create journal postings, present audit integrity as accounting finality, or introduce money fields. Any later monetary projection must use BigInt cents internally and decimal strings in JSON, never floats.

### Evidence versus memory

Evidence and professional memory are distinct from governed operational authority. This slice projects neither, but establishes the invariant future slices must preserve:

- an Engram `EvidenceObject` is a copy whose authoritative origin remains external;
- `AccountingMemory` and `approveMemory` remain professional memory workflows;
- Engram `SignedReceipt`s prove Engram integrity, not fiscal authorization; and
- only a drenyra-ai operation receipt may claim an authoritative operational result, within its exact scope.

A projection must never render or imply “verified” from a hash, signature, signer trust, review receipt, or integrity check alone.

## Requirements preview

The specification will add RFC 2119 language and Given/When/Then scenarios. Expected requirement families are:

- **REQ-PROJ-001 — Canonical status:** The projection MUST return canonical status without reinterpretation.
- **REQ-PROJ-002 — Canonical eligibility:** Eligibility MUST derive from `VALID_TRANSITIONS` for every state, including approved UNKNOWN recovery behavior.
- **REQ-PROJ-003 — Determinism:** Equal valid inputs MUST produce deeply equal outputs with no I/O, mutation, clock, randomness, or network use.
- **REQ-PROJ-004 — Next action:** Every state MUST map to one closed `nextAction`; terminal states MUST map to `none`.
- **REQ-PROJ-005 — Guidance ceiling:** `nextAction` MUST NOT represent approval, execution, verification, or completion unless canonical state establishes it.
- **REQ-PROJ-006 — Typed denial:** An ineligible requested continuation MUST return stable code, cause, and continuation rather than throw or guess.
- **REQ-PROJ-007 — Fail closed:** Unsupported status or malformed context MUST NOT yield an invented transition.
- **REQ-PROJ-008 — Read-only:** Projection MUST NOT invoke transition guards, execute gates, mutate state, or emit receipts.
- **REQ-PROJ-009 — Ordering:** Eligibility MUST have deterministic ordering independent of mutable Set behavior.
- **REQ-PROJ-010 — Immutability:** Output MUST NOT expose mutable references to `VALID_TRANSITIONS`.
- **REQ-PROJ-011 — Receipt fidelity:** This slice MUST NOT expose a generic `verified` claim.
- **REQ-PROJ-012 — Consumer neutrality:** Action and denial codes MUST remain transport- and locale-neutral; professional Spanish belongs to the UI.
- **REQ-PROJ-013 — Public export:** The package SHOULD expose a dedicated `./projection` subpath without widening unrelated APIs.

## Non-goals

- UI components, layouts, professional Spanish copy, or changes in `drenyra-command-center`.
- A second lifecycle machine or copied transition matrix.
- New states, transitions, gates, approvals, receipts, or authority.
- Client-trusted `approved: true` behavior or mutation endpoints.
- A DRAFT or frozen public projection contract.
- A CLI project command or JSON dump.
- An MCP projection tool.
- Close, portfolio, tenant, candidate, Guardian, reconciliation, receipt, evidence, policy, journal, ingest, or SUNAT projections.
- Engram memory or evidence rendered as authority.
- Receipt verification, signer trust evaluation, or a generic “verified” state.
- Monetary fields or accounting-journal behavior.
- Changes to canonical transition behavior.

## Product tradeoffs

### Option A — minimal library only

**Benefits:** smallest credible correction to duplicated UI lifecycle logic; lowest regression surface; one PR; semantics proven before freeze.

**Costs:** no schema, CLI dump, or MCP access; product value depends on coordinated Command Center adoption.

### Option B — library, DRAFT contract, and CLI

**Benefits:** easier manual validation and integration; begins documenting a transport-neutral contract.

**Costs:** exceeds 300 lines; mixes semantic and adapter work; may stabilize the payload before consumer feedback.

### Option C — frozen contract, CLI, and MCP

**Benefits:** complete external surface with conformance and drift protection.

**Costs:** largest review burden; freeze governance and multiple PRs; early mistakes become expensive; overbuilds before adoption.

The chosen tradeoff optimizes first for authority correctness and learning, not surface completeness.

## Affected areas

Expected touchpoints are limited to:

- a new `projection/` module and types;
- focused projection tests;
- the package export map for `./projection`; and
- only if existing conventions require it, a narrow root export.

No UI, command, MCP, contract, ledger, journal, evidence, memory, receipt, Guardian, candidate, gate, or agent implementation should change.

## Impact and risks

### 1. `nextAction` semantic drift

New authored guidance could become a de facto second machine. Mitigate by deriving eligibility from `VALID_TRANSITIONS`, exhaustively mapping all statuses, failing tests or typechecking when states are added, and keeping action codes descriptive rather than executable.

### 2. Command Center adoption

If the sibling UI keeps reconstructing lifecycle state, this module becomes orphaned. Mitigate by agreeing on the consumer boundary before Option B, providing a stable package subpath, and tracking UI replacement in the sibling repository.

### 3. Receipt-fidelity conflation

Consumers may collapse integrity, signer trust, review, and governed completion into “verified.” Mitigate by exposing no generic verification claim and requiring future receipt projections to carry receipt type and verification status separately.

### 4. Stale snapshots

A displayed action may become stale before interaction. Treat projections as guidance only and require all mutations to return through Core for current-state and gate recalculation.

### 5. Mutable aliasing

Returning the canonical transition `Set` could let a consumer mutate authority data. Return a fresh readonly representation and test mutation isolation.

## Success criteria and test hints

The slice succeeds when:

- all 15 statuses produce deterministic projections;
- `status` exactly matches canonical input;
- eligibility conforms to `VALID_TRANSITIONS`, including approved UNKNOWN recovery behavior;
- terminal states produce `nextAction: "none"`;
- every non-terminal state has an explicit typed action;
- an ineligible request returns code, cause, and continuation;
- malformed input fails closed without an invented transition;
- output makes no generic verification or fiscal-authorization claim;
- returned collections cannot mutate the canonical matrix; and
- consumers can import `./projection`.

Suggested tests:

- table-driven conformance over every state;
- deterministic output and ordering;
- terminal, wait-state, and UNKNOWN recovery cases;
- typed denial and malformed-input cases;
- mutation isolation; and
- focused tests plus `bun run test`, typecheck, and build, accounting for documented baseline failures.

A later cross-repository metric should confirm that the Command Center renders Core `status` and `nextAction` exactly and removes duplicated lifecycle derivation.

## Delivery shape

Deliver Option A as one focused PR under the **300 changed-line review budget**, targeting **200–260 changed lines** including tests.

Follow the established slice pattern: add the smallest typed library boundary, prove canonical conformance under strict TDD, export the package subpath, and defer adapters and contract freeze.

If forecasting exceeds 300 lines, reduce the slice rather than silently absorbing Option B. Contract, CLI, and MCP work retain separate review and rollback boundaries.

## Rollback

Rollback is additive and low risk: remove the `./projection` export and module, and independently pin any consumer to its previous package version. Mission state, receipts, ledger records, and accounting data remain untouched. Rollback must never rewrite canonical lifecycle state or historical receipts.

## Open questions

1. Which snapshot fields beyond canonical `status` are minimally required to explain denials without coupling projection to persistence or transport?
2. Should Option A accept an optional requested transition, or should denial projection be a separate pure function?
3. Should deterministic eligibility ordering follow canonical declaration order or an explicit future product order?
4. Which team and milestone own replacing duplicated lifecycle derivation in `drenyra-command-center`?
5. What adoption evidence triggers Option B: an integration branch, agreed payload example, or released consumer?
6. Should UNKNOWN recovery targets appear in ordinary eligibility or a separately labeled recovery continuation?

These questions do not block the scope decision. Resolve them in specification and design, with adoption coordination completed before Option B or C.
