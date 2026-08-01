# Contract: mission-protocol

> Version: 0.1-draft · Status: draft · Transport-agnostic.

The mission protocol defines the lifecycle of a **mission**: a scoped, resumable unit of accounting work (capture, classification, reconciliation, close, declaration, audit). It mirrors the canonical fiscal lifecycle — captura → clasificacion → conciliacion → cierre → declaracion → auditoria.

## Purpose

Any actor (agent, human, integration) that starts, advances, or completes accounting work speaks this protocol. Missions give work an identity, a state machine, explicit commands and events, and crash-safe recovery.

## Mission

A mission has:

| Field      | Description                                              |
| ---------- | -------------------------------------------------------- |
| `id`       | Canonical identifier (branded, opaque, unique)           |
| `scope`    | RUC/company/period — mandatory fiscal context            |
| `kind`     | Type of work (fiscal phase, job, approval, audit, …)     |
| `state`    | Current lifecycle state (see below)                      |
| `owner`    | Actor accountable for the mission                        |
| `materiality` | Risk tier driving review and approval depth           |
| `version`  | Protocol version                                         |

## States

```text
draft → planned → in_progress → blocked
                          │          │
                          ▼          ▼
                     review ←─── unblocked
                          │
                          ▼
                     approved → completed
                          │
                          ▼
                     rejected → abandoned
```

Transitions are validated by gates — a transition that violates policy is rejected, not ignored.

## Commands

| Command        | Valid from        | Effect                     |
| -------------- | ----------------- | -------------------------- |
| `mission.start`| draft, planned    | Moves to `in_progress`     |
| `mission.advance` | in_progress    | Progresses fiscal phase    |
| `mission.block`  | in_progress     | Moves to `blocked`         |
| `mission.unblock`| blocked         | Returns to `in_progress`   |
| `mission.review` | in_progress, blocked | Opens review          |
| `mission.approve`| review          | Moves to `approved`        |
| `mission.reject` | review          | Moves to `rejected`        |
| `mission.abandon`| any non-terminal | Moves to `abandoned`     |

## Events

Every state change emits an event: `mission.started`, `mission.advanced`, `mission.blocked`, `mission.unblocked`, `mission.reviewed`, `mission.approved`, `mission.rejected`, `mission.abandoned`, `mission.completed`. Events are append-only and carry `mission_id`, `actor`, `scope`, and `timestamp`.

## Errors

Errors are structured: `code` (machine), `message` (human), `retryable`, `scope` (if the failure is scope-related), `cause` (optional). Unknown codes fail closed.

## Versioning

- `mission-protocol` uses semver. Major = breaking state/command/event change.
- Consumers must declare the protocol version they speak and reject unknown majors.
- Recovery: missions resume from their last persisted event; never from agent transcript.

## Conformance

Conformance vectors cover: legal state transitions, illegal transitions (must reject), command validation, event ordering, and recovery-after-crash. These vectors ship with the reference implementation.
