# SDD-100 — drenyra-ai Command Center Projection Surface · Exploration

> Lifecycle: planned · Wave 3 · Scope of THIS exploration: size the FIRST SLICE of
> the drenyra-ai-side contribution (the projection surface the Command Center UI
> renders). Read-only; no code, tests, or commits were produced.
> Status source: `openspec/programs/drenyra-dominion/sdds/sdd-100-command-center/README.md`.

## Purpose

SDD-100 is a professional Command Center **Web UI** owned by the sibling repo
`drenyra-command-center`. The drenyra-ai contribution is the **projection surface**
the UI renders: status/`nextTransition` data, receipts, Guardian findings, and close
data. The UI is **never a second authority and never reconstructs the state machine**.
The drenyra-ai side must therefore expose a deterministic, transport-agnostic
projection that renders only `status`, `eligibleTransitions`, and `nextAction` —
denying with code, cause, and continuation — while keeping the 15-state machine as
the single authority.

This exploration (a) inventories what the Core already exposes that is projectable,
(b) skims the command-center changes to confirm they are UI-side and whether they
consume or re-derive state, (c) gaps the missing projection surface, and (d) sizes
2–3 first-slice options against the 300-line review budget.

**Verified facts (not re-derived here):** repo `drenyra-ai` v0.4.1, HEAD `c54bcde`,
clean. Program catalog at `openspec/programs/drenyra-dominion/`. SDD-100 is
`lifecycle:planned`. Review budget = 300 lines
(`openspec/config.yaml`: `review_budget_lines: 300`).

---

## Current-state inventory (per-module projection surface)

All paths relative to the repo root. Every claim cites a symbol actually read.

### 1. Mission lifecycle — the eligibility authority

- `missions/status.ts`
  - `AccountingMissionStatus` enum: 15 canonical states (DRAFT, QUEUED, RUNNING,
    BLOCKED, AWAITING_APPROVAL, APPROVED, REJECTED, REVISION_REQUESTED, COMPLETED,
    FAILED, UNKNOWN + M4: RECOVERING, WAITING_FOR_EVIDENCE, BLOCKED_BY_GATE, RETRYING).
  - `VALID_TRANSITIONS: Map<status, Set<status>>` — the canonical eligibility matrix.
    **This is the single source from which `eligibleTransitions` must be projected.**
  - `TERMINAL_STATES`, `STATUS_LABELS` (Spanish display labels), `WaitReason`,
    `waitReasonFor()`, and classification helpers `isExecutionState/isWaitState/
    isTerminal/isRecoverable/isRunnable/isResumable/isAwaitingApproval/
    isWaitingForHuman`.
  - **Gap:** there is no exported `eligibleTransitions(status)` helper; the UI-facing
    list must be projected from `VALID_TRANSITIONS` by a new library function.
- `missions/transitions.ts`
  - `transition()`, `validateTransition()`, `guardTerminal()`, `reconcileTransition()`,
    `isValidRecoveryPath()`. These THROW `MissionError(INVALID_TRANSITION)` — they are
    state-machine guards, not projection reads. A projection must NOT call these to
    enumerate eligibility (they are checked, not read-only queries).

### 2. Routing — advisory envelope with a deny-with-code vocabulary

- `routing/types.ts`
  - `WorkUnit`, `WorkResult` (with `nextTransition: NextTransition`, `outcome`),
    `NextTransition { from; to }` (a **single** pair, not a list).
  - `WorkOutcome = SUCCEEDED | STOPPED | FAILED`; `WorkStopReason` closed union with
    typed codes: MISSING_EVIDENCE, POLICY_BLOCKED, APPROVAL_REQUIRED, BUDGET_EXHAUSTED,
    SCOPE_MISMATCH, INVALID_TRANSITION, EXTERNAL_SYSTEM_UNAVAILABLE, AMBIGUOUS_INPUT,
    UNSUPPORTED_WORK. This is the closest existing "deny with code + cause" model and
    is a good prototype for the projection's denial shape.
  - `RouteRequest`, `Route` (`direct-analysis | specialized-agent | durable-mission`),
    `AuthorityCeiling` (`no-mutation | proposes-only | through-core`).
- `routing/router.ts` — `route()` deterministic offline classifier (propose-only,
  no transition knowledge). Projectable as "how work routes" but out of first-slice scope.
- **Gap:** routing models a single `NextTransition` and typed stop reasons, but NOT the
  `status + eligibleTransitions + nextAction` read shape the UI requires.

### 3. Close package — a ready projectable summary

- `flow/close.ts`
  - `ClosePackage { status: CloseStatus; scope; sourcesUsed; sourcesMissing; candidates;
    guardianReports; receipts; ledgerValid; risks }` from `runMonthlyClose()`.
  - `CloseStatus = preflight-failed | waiting-for-evidence | complete`.
  - **Already a compact, UI-projectable shape** (close data + guardian reports + receipts
    - ledger validity). A projection can lift this largely as-is.

### 4. Guardian — findings only, verdict always "none"

- `guardian/guardian.ts`
  - `GuardianReport { candidateHash; findings; verdict: "none"; reviewedAt }`,
    `GuardianFinding { id; severity: blocker|concern|info; category; description }`.
  - `runGuardianReview()` produces findings only — never approves/rejects.
  - **Projectable as-is.** The UI must render findings without implying authority.

### 5. Receipts — taxonomy matters (SDD-100 fidelity threat)

- `receipts/types.ts`
  - `SignedReceipt { protocolVersion; receiptType; algorithm; content; receiptHash;
    signerKeyId; signerPublicKey; signature; issuedAt }`.
  - `ReceiptType = APPROVAL | EXECUTION | COMPLETION | EXTERNAL_SUBMISSION`.
  - `ReceiptVerificationStatus = CONTENT_VALID | SIGNATURE_VALID | SIGNER_TRUSTED |
    KEY_EXPIRED | KEY_REVOKED | UNKNOWN_SIGNER | PAYLOAD_TAMPERED`.
  - `ReceiptVerificationSteps { hashValid; signatureValid; signerRecognized;
    keyCurrent; keyRevoked }`.
- `receipts/verify.ts` — `verifySignedReceipt()`, `verifySignedReceiptTrusted()`
  (returns `{ status; steps }`). `receipts/sign.ts` — `buildSignedReceipt()`, `signReceipt()`.
- **Critical distinction for the projection:** a verification `status` of
  `SIGNATURE_VALID`/`SIGNER_TRUSTED` proves receipt **integrity/authenticity**, not a
  governed operation. Only a drenyra-ai operation receipt (`ReceiptType` APPROVAL/
  EXECUTION/etc.) claims the authoritative result. The projection must carry this
  distinction and **never render "verified" from a mere integrity check**. Engram
  `SignedReceipt`s (Engram-side) are out of scope here.

### 6. Candidates — review/approval state that is projectable

- `candidates/types.ts`
  - `Candidate { id; subjectHash; scope; materiality; status; reviews; corrections;
    createdAt; version }`, `CandidateStatus = proposed | inspected | reviewing |
    accepted | corrected | rejected`, `Materiality = R0|R1|R2|R3`,
    `CandidateReview`, `CandidateReviewVerdict = accept | reject`.
  - **Projectable as review-queue / decision-queue state.** Candidate `reviews`
    carry approval events; materiality drives depth.

### 7. Review lenses, gates, recovery — infrastructure, not projection

- `review/lenses.ts` — `ReviewLens`, `ALL_4R_LENSES`, `selectReviewLenses()`; this is
  diff-size review selection, not UI projection. `review/index.ts` exports lenses + workload.
- `gates/index.ts` — `ApprovalGate`, `distinctApprovers`, `ReceiptGate`,
  `MissionStateGate`, `GateRunner`; fail-closed gate enforcement, not projection reads.
- `recovery/` — UNKNOWN-state reconciliation (already modeled in `transitions.ts`).
  Projectable as a `recoverable` boolean via `missions/status.ts:isRecoverable()`.

### 8. CLI / MCP — what already renders status-like output (lift candidates)

- `cmd/declared-surface.ts` — `DECLARED_CONTRACTS` (six frozen identities),
  `getDeclaredCapabilities()`, `DECLARED_CONTRACT_FILES`.
- `cmd/commands/mission-status.ts` — `missionStatusCommand()` emits
  `{ snapshot, events }` via `emitJson()`; exit codes 0/1/2. **CLI already renders
  mission status as JSON** — a strong precedent for a projection dump.
- `cmd/output/json.ts` — `readJsonFile()`, `emitJson()`, `emitSummary()`; reusable
  render helpers (CLI-side).
- `mcp/tools.ts` — `DeclaredCapabilities { version; contracts; jurisdictions;
  adapters }` + `capabilitiesTool()`. MCP already exposes a read-only external
  projection mechanism (currently only capabilities + ledger). **This is the natural
  consumer-boundary for a projection tool** (read-only, no blind mutations).
- `package.json` exports — 22 subpaths (`./routing`, `./missions`, `./flow`,
  `./guardian`, `./receipts`, `./candidates`, `./review`, `./gates`, `./recovery`,
  `./mcp`, `./cmd`, etc.). **No `./projection` subpath exists.** Confirmed: no
  `projection`/`eligibleTransitions`/`nextAction` symbol anywhere in the codebase.

---

## Command-center overlap skim (UI-side only, read-only)

Skimmed `drenyra-command-center/openspec/changes/` via targeted grep (no deep dive,
no files touched). Confirmed changes are UI-side features: `drenyra-studio-platform`,
`drenyra-treasury-core`, `drenyra-organization-lifecycle`,
`drenyra-invoice-entity-unification`, `drenyra-x2-fiscal-property-testing`,
`drenyra-p4-ci-cd`, `drenyra-p5-code-quality`, `sdd-wb-011`,
`drenyra-three-panel-layout`, `drenyra-am4-sidebar-reduction`, and the archived
`archive/2026-07-30-m2-real-monthly-close`.

**Key skim observation:** the archived `m2-real-monthly-close` spec/design
re-derives mission and gate state directly (`AccountingMissionStatus.QUEUED/RUNNING/
APPROVED/REJECTED/COMPLETED/FAILED`, `GateStatus`) — i.e. the UI-side currently
reconstructs the state machine rather than consuming a Core projection. This is
exactly the behavior SDD-100 forbids, so a drenyra-ai projection surface closes a real
gap. I did not individually verify the `proposal/status` of every one of the 11 named
changes; the confirmed set above is representative and sufficient for sizing.

**No duplication on the drenyra-ai side:** the projection module belongs in drenyra-ai
(a library + contract); the command-center consumes it. Nothing here duplicates UI work.

---

## Gap analysis

What drenyra-ai must ADD so the UI can project without re-deriving the state machine:

1. **A library projection module** exposing per-context (mission/tenant) a read-only,
   deterministic `status + eligibleTransitions + nextAction` shape, with deny-with-code
   continuation. Concrete sub-shapes:
   - `eligibleTransitions` — projected from `missions/status.ts:VALID_TRANSITIONS.get(status)`
     (plus UNKNOWN recovery targets from `transitions.ts:UNKNOWN_RECOVERY_TRANSITIONS`).
     Must be a read-only query, NOT `transition()`/`validateTransition()` (those throw).
   - `nextAction` — a NEW deterministic mapping status → action label/code
     (e.g. `AWAITING_APPROVAL → "review"`, `WAITING_FOR_EVIDENCE → "provide-evidence"`,
     `BLOCKED_BY_GATE → "resolve-gate"`, terminal → `"none"`). This is authored logic
     that must stay in lockstep with the canonical matrix; it is a projection of the
     machine, not a second machine.
   - deny-with-code continuation — model on the existing `WorkStopReason` union
     (code + cause + continuation) so an ineligible action returns a typed denial.
2. **JSON-schema projection contracts** under `contracts/` for the payloads. Per
   `contracts/README.md` a public contract is transport-agnostic, versioned, and frozen
   only with a conformance suite + CI drift check. A new `projection` contract should be
   authored **DRAFT first**; freezing it is a heavier, later step.
3. **A `cmd` subcommand** (`drenyra-ai project ...`) to render/dump projections as JSON
   for manual verification — lifting the `mission-status`/`emitJson` pattern.

**Not required for the first slice:** MCP tool exposure (already has a capabilities
pattern, but wiring a projection tool is additive); contract freeze; close-package
projection; candidate decision-queue projection; Guardian/`nextAction` internationalization.

---

## First-slice options (sized against the 300-line budget)

All options ship pure-library code under `contracts → library → agents/cmd`, no reverse
imports, node:crypto only, BigInt cents for money (serialize as string), English artifacts,
fail-closed. Estimated changed lines are added+deleted (module + tests).

### Option A — Minimal library projection (RECOMMENDED)

New `projection/` library subpath exposing one read-only function, e.g.
`projectMission(snapshot)` returning `{ status, eligibleTransitions, nextAction,
deny? }`, projected from `VALID_TRANSITIONS` + a small `nextAction` map + typed denial.
Includes unit tests. No contract file, no cmd change, no MCP.

- Estimated: **~200–260 changed lines** (types ~70, module ~90, tests ~100). Fits the
  300-line budget as a single slice; no chained-PR overhead.
- Tradeoffs: delivers the core "render only status/eligibleTransitions/nextAction" contract;
  no JSON schema yet; no manual dump; command-center must adopt it before it is useful.

### Option B — Option A + DRAFT projection contract + cmd dump subcommand

Adds a DRAFT `contracts/projection.md` (not frozen) and a `drenyra-ai project` JSON dump
command reusing `emitJson()`.

- Estimated: **~350–500 changed lines** → exceeds the 300 budget; needs a chained PR or a
  maintainer reset for overage (the established SDD-020/030 pattern).
- Tradeoffs: immediately consumable/manually verifiable; higher review surface; contract
  stays DRAFT so no freeze ceremony.

### Option C — Option A + frozen contract + cmd + MCP projection tool

Full vertical: frozen `projection` contract (conformance vectors + CI), cmd dump, and an
MCP read-only projection tool.

- Estimated: **~600+ changed lines**, multiple PRs, contract-freeze ceremony (public contract
  change per `contracts/README.md`). Heaviest.
- Tradeoffs: most complete and "real"; overkill and high-risk for a first slice; blocks on
  a public contract decision before any value is proven.

### Recommendation

**Option A.** It directly satisfies the SDD-100 core requirement (render only
`status/eligibleTransitions/nextAction`, deny with code/cause/continuation) with a single
300-line-budget slice, no contract-freeze risk, and no orphaned tooling. Follow with Option B
(a DRAFT contract + dump command) in a second slice after the command-center confirms it will
consume the projection, then Option C (freeze + MCP) once adopted.

---

## Non-goals (first slice)

- No UI code, no Spanish copy/terminology authoring (UI-side concern).
- No new state machine, states, receipts, or authority; no invented transitions.
- No gate/approval execution; projections are read-only.
- No Engram artifact rendered as authority (`AccountingMemory`, `EvidenceObject` copies,
  `approveMemory`, Engram `SignedReceipt`s).
- No money as float; any monetary projection serializes as string cents.
- No MCP tool, no frozen contract, no close/candidate projections in the first slice.

## Risks

1. **`nextAction` semantic drift.** It is newly authored logic; if it falls out of lockstep
   with `VALID_TRANSITIONS`/`STATUS_LABELS` it becomes a de-facto second state machine — the
   exact SDD-100 threat. Mitigate: project strictly from the canonical matrix; add a
   conformance test asserting `eligibleTransitions` equals `VALID_TRANSITIONS` for every state.
2. **Command-center adoption.** The UI currently re-derives state (archived `m2-real-monthly-close`).
   If it does not adopt the projection, the slice is orphaned. Mitigate: coordinate adoption
   before Option B/C; Option A is cheap enough to ship regardless.
3. **Receipt-fidelity conflation.** A projection that renders "verified" from a mere
   `SIGNATURE_VALID`/`SIGNER_TRUSTED` integrity check would violate SDD-100. Mitigate: carry
   the `ReceiptVerificationStatus` distinction and an explicit operation-vs-review taxonomy in
   the projection shape from the start.

## Test / metric hints

- Strict TDD (vitest, `bun run test`).
- Conformance: for each of the 15 states, `projectMission().eligibleTransitions` equals
  `VALID_TRANSITIONS.get(status)` (plus UNKNOWN recovery targets).
- `nextAction` maps only for non-terminal states; terminal → `"none"`.
- Denial: an ineligible requested transition returns a typed deny (code + cause + continuation),
  never a guessed route.
- Projection conformance metric from SDD-100 README: rendered `status`/`nextAction` match the
  Core exactly.
- Money serialization: any monetary field is a string of cents, never a JSON float.
