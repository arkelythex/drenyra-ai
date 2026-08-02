# Contract: recovery

> Version: 0.1 · Status: FROZEN · Transport-agnostic.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
> no float is ever used for money; version/sequence/verdict values are JSON
> integers or strings, never floats.

Mission recovery defines how the runtime resumes accounting work after a crash
or restart. Recovery is **crash-safe resumption**: a mission resumes from the
LAST PERSISTED EVENT, never from the agent transcript or from in-memory state.
The event log is the single source of truth for what actually happened.

## Purpose

- Guarantee that an interrupted mission can be resumed without re-executing
  work whose effects were already persisted.
- Prevent a restart from silently losing a human-wait state.
- Make recovery deterministic, idempotent, and testable.

## Source of truth

1. The append-only event log (`MissionEvent[]`) is the source of truth.
2. Every event carries the canonical `MissionSnapshot` that existed AFTER that
   event was applied.
3. Replaying a log applies those embedded snapshots in sequence order; the
   LAST PERSISTED EVENT's snapshot is the authoritative mission state.
4. The agent transcript, process memory, and any derived cache are never
   authoritative for recovery decisions.

## Per-state recovery semantics

| State                  | Action               | Rationale                                                   |
| ---------------------- | -------------------- | ----------------------------------------------------------- |
| `RUNNING`              | recover-to-unknown   | In-flight when the crash hit; must be marked UNKNOWN first  |
| `RETRYING`             | recover-to-unknown   | In-flight (automatic retry); same handling as RUNNING       |
| `UNKNOWN`              | decide-by-evidence   | Resolve from the event log, never by guessing               |
| `WAITING_FOR_EVIDENCE` | leave                | Human-wait state; NEVER auto-recovered by the default policy (`DEFAULT_RECOVERABLE = [RUNNING]`) |
| `BLOCKED_BY_GATE`      | leave                | Human-wait state; NEVER auto-recovered by the default policy |
| `FAILED`               | terminal             | Terminal; never touched                                     |
| `COMPLETED`            | terminal             | Terminal; never touched                                     |
| any other state        | leave                | Not in-flight; nothing to resume                            |

### decide-by-evidence (`UNKNOWN`)

If a `COMPLETED` or `FAILED` event exists in the log AFTER the last `UNKNOWN`
marker, the external operation actually terminated and the mission resolves to
that terminal outcome. Otherwise there is no evidence of effects and the
mission reconciles to `RUNNING` for retry. Evidence is read from the event log
only; a missing terminal event is "no evidence", never "assumed completed".

## Idempotent recovery

Re-running recovery is a no-op for already-handled missions:

- Missions already marked `UNKNOWN` are returned unchanged; no new event is
  appended.
- Missions in human-wait or terminal states are never touched, so re-running
  recovery cannot double-process them.
- A recovery pass appends at most one STATE_TRANSITION event per in-flight
  mission (the RUNNING/RETRYING → UNKNOWN marker).

## Fencing note

Multi-instance leases (claiming a mission so only one runtime owns it) are an
infrastructure concern outside this contract. The standalone runtime assumes a
single owner: recovery is safe and idempotent for one process. Deployments with
concurrent runtimes MUST add fencing (e.g. a lease service) before recovery, so
two processes never recover the same mission.

## Conformance

Vectors cover: per-state action mapping, decide-by-evidence on the last UNKNOWN
marker, replay reconstruction of a full lifecycle (start + execute x3 + approve
→ APPROVED v5), and idempotent recovery (a second pass changes nothing).

## Freeze record

- **Freeze date:** 2026-08-02
- **Frozen by release:** **0.2.0** — the release that freezes this contract.
- **Normative surface pinned by:** [`contracts/__tests__/recovery-conformance.test.ts`](./__tests__/recovery-conformance.test.ts) — runs in CI (`bun run test`) and fails on drift: the per-state recovery-action table (RUNNING/RETRYING → recover-to-unknown, UNKNOWN → decide-by-evidence, human-wait → leave, terminal → terminal), decide-by-evidence on the last UNKNOWN marker, event-log replay where the last persisted event wins (with empty, malformed, and cross-mission logs rejected), and idempotent recovery via `recoverIncomplete` (a second pass yields no new events).
- **Migration note:** any change to the normative surface (per-state actions, decide-by-evidence semantics, replay semantics, idempotency guarantees) requires a **major** version bump of the recovery contract. The migration path for a future major is documented in the release notes of that major.
