# Contract: mission-protocol

> Version: 0.1 · Status: FROZEN · Transport-agnostic.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
> (no float is ever used for money); sequence and version values are JSON
> integers, never floats.

The mission protocol defines the lifecycle of a **mission**: a scoped, resumable unit of accounting work (capture, classification, reconciliation, close, declaration, audit). It mirrors the canonical fiscal lifecycle — captura → clasificacion → conciliacion → cierre → declaracion → auditoria.

## Purpose

Any actor (agent, human, integration) that starts, advances, or completes accounting work speaks this protocol. Missions give work an identity, a state machine, explicit commands and events, and crash-safe recovery.

## Mission

A mission is a `MissionSnapshot`:

| Field               | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `id`                | Canonical identifier (branded, opaque, unique)           |
| `companyId`         | Company scope — mandatory fiscal context                 |
| `fiscalPeriod`      | Fiscal period (`YYYYMM`)                                 |
| `intent`            | Type of accounting work (see intents)                    |
| `status`            | Current lifecycle state (15 canonical states)            |
| `version`           | Monotonic optimistic-concurrency version                 |
| `progress`          | Progress in basis points (0–10000)                       |
| `steps` / `currentStep` | Executed steps and the active one                    |
| `blockers`          | Blockers, each with a reason and resolution              |
| `proposal` / `rejection` | Approval proposal and any rejection                  |
| `receiptId` / `receiptHash` | Linked execution receipt                         |
| `lastEventSequence` | Sequence of the last appended event                      |
| `createdAt` / `updatedAt` | Lifecycle timestamps                                |

## Intents

A mission performs one of five intents:

```text
monthly-close | correction | reconciliation | invoice-review | compliance-check
```

## States

The 15 canonical states (`AccountingMissionStatus`):

```text
DRAFT → QUEUED → RUNNING → AWAITING_APPROVAL → APPROVED → COMPLETED
                     │  │        │                │
                     │  └── BLOCKED ──┐          └── FAILED
                     │               ▼
                     │        WAITING_FOR_EVIDENCE
                     │        BLOCKED_BY_GATE
                     │        RETRYING
                     │        RECOVERING
                     └── UNKNOWN (recovery evidence decides)
REJECTED → REVISION_REQUESTED → QUEUED
```

`COMPLETED` and `FAILED` are terminal. `WAITING_FOR_EVIDENCE` and `BLOCKED_BY_GATE` are human-wait states that a restart must never auto-recover. The legal transition table (`VALID_TRANSITIONS`) is the authority: a transition not listed is rejected with `INVALID_TRANSITION`, and transitions on terminal states are rejected with `TERMINAL_STATE_GUARD`.

## Commands

The discriminated `MissionCommand` union (`create | execute | approve | reject | reconcile`):

| Command    | Target state        | Notes                                   |
| ---------- | ------------------- | --------------------------------------- |
| `create`   | `DRAFT`             | Handled by `MissionRuntime.start()`     |
| `execute`  | intent-driven       | Dispatched to the registered intent handler; without a handler the runtime keeps `RUNNING` |
| `approve`  | `APPROVED`          | Carries `proposalId`/`proposalVersion`/`evidenceHash` |
| `reject`   | `REJECTED`          | Requires a reason                        |
| `reconcile`| `RUNNING`/`FAILED`/`COMPLETED` | Only from `UNKNOWN` (recovery evidence) |

Commands carry `expectedMissionVersion` for optimistic concurrency; a stale version is rejected with `VERSION_CONFLICT`.

## Events

Every state change and progress update appends an immutable `MissionEvent` (`MissionEventType` — 12 values):

```text
STATE_TRANSITION | PROGRESS_UPDATE | BLOCKER_ADDED | BLOCKER_RESOLVED
PROPOSAL_CREATED | APPROVAL_DECIDED | COMPLETED | FAILED | TIMEOUT
UNKNOWN | RECONCILED | KEEPALIVE
```

Events carry `missionId`, `sequence` (strictly increasing), the resulting `snapshot`, and `createdAt`. Recovery resumes from the last persisted event — never from an agent transcript.

## Errors

Errors are structured `MissionError`s: `code` (machine), `statusCode` (default per the canonical map), `message` (human), `details` (optional), plus `family` and `isRetryable` derived from the code. The canonical taxonomy has **30 codes** across 9 families (auth, tenant, validation, concurrency, idempotency, mission-state, evidence, approval, external-system). Unknown codes fail closed; `isMissionError` narrows structurally.

## Versioning

- `mission-protocol` uses semver. Major = breaking state/command/event change.
- Consumers must declare the protocol version they speak and reject unknown majors.
- `PROTOCOL_VERSION` and `MINIMUM_CLIENT_VERSION` are `"1.0"`; capability negotiation via `SUPPORTED_FEATURES`.

## Conformance

The normative surface is pinned by [`contracts/__tests__/mission-protocol-conformance.test.ts`](./__tests__/mission-protocol-conformance.test.ts): the 15 canonical states, the full `VALID_TRANSITIONS` table (every listed edge legal, every non-listed edge rejected), terminal guards, the command union, the 5 intents, the 12 `MissionEventType` values, versioning constants, idempotency key shape/validation, and the 30-code error taxonomy with its retryable set. Runs in CI (`bun run test`); drift fails the build.

## Reference implementation

The TypeScript reference implementation of this contract lives in `missions/` in this repository (a port of `@drenyra/mission-protocol` plus the state-machine enforcement from `@drenyra/mission-domain`), with zero runtime dependencies (node:crypto built-in only):

| Module | Contents |
| ------ | -------- |
| `missions/status.ts` | 15-state `AccountingMissionStatus`, `VALID_TRANSITIONS`, terminal/extended state sets, predicates, `STATUS_LABELS` |
| `missions/commands.ts` | Command payloads and the `MissionCommand` discriminated union |
| `missions/events.ts` | `MissionEvent`, SSE parse/keepalive/format helpers |
| `missions/errors.ts` | 30 canonical `MissionErrorCode`s, `MissionError`, `isMissionError` |
| `missions/versioning.ts` | `PROTOCOL_VERSION`, capability list, compatibility negotiation |
| `missions/idempotency.ts` | Idempotency key factory and validation |
| `missions/types.ts` | Snapshot/proposal/evidence/blocker types (`ReceiptType` re-exported from `receipts/types.ts` — single definition) |
| `missions/transitions.ts` | `transition`, `validateTransition`, `guardTerminal`, `reconcileTransition`, `isValidRecoveryPath` |
| `missions/store.ts` | Store ports plus in-memory implementations |
| `missions/intents.ts` | `IntentHandler` and `IntentRegistry` |
| `missions/runtime.ts` | `MissionRuntime` — durable state machine with idempotency replay, optimistic concurrency, recovery |

The protocol modules are ported verbatim (byte-identical except the fiscal header comment); `types.ts` adapts `ReceiptType` to the single definition in `receipts/types.ts`. The CLI (`cmd/cli.ts`) exposes `mission start|apply|status` as an executable reference surface over a JSON store file.

## Freeze record

- **Freeze date:** 2026-08-02
- **Frozen by release:** **0.1.0** — the first release that freezes this contract.
- **Normative surface pinned by:** [`contracts/__tests__/mission-protocol-conformance.test.ts`](./__tests__/mission-protocol-conformance.test.ts) — runs in CI (`bun run test`) and fails on drift.
- **Migration note:** any change to the normative surface (states, transitions, commands, events, error codes, versioning, idempotency) requires a **major** version bump of `mission-protocol`. Consumers must declare the protocol version they speak and reject unknown majors; the migration path for a future major is documented in the release notes of that major, per the versioning section above.
