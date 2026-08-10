# Runbook 04 — Recovery

> [!IMPORTANT]
> **Recovery consults persisted state, idempotency keys, and evidence — it never re-executes an operation because the agent transcript says an earlier attempt failed.** A mission is resumed from its event log, and an unknown external outcome is reconciled before any retry.

<!-- -->

> **Part of:** [Runbooks](README.md) · **Last updated:** 2026-08-10

## When to use

- A mission is interrupted or in `RECOVERING → UNKNOWN`.
- An external call may have reached a system but the response was lost.
- A worker failed and another must take over safely (fencing).

## Recovery matrix

| Situation | Response |
| --- | --- |
| A file is missing | `WAITING_FOR_EVIDENCE` — absence is never zero |
| A gate rejects the transition | `BLOCKED_BY_GATE` — surface the decision envelope |
| An adapter fails temporarily | `RETRYING` — bounded, idempotent retry |
| The process is interrupted | `RECOVERING → UNKNOWN` — decide from persisted state |
| Execution evidence exists | Reconcile without repeating (record the outcome) |
| It cannot be determined what happened | Request human intervention |
| The professional rejects | `REJECTED → REVISION_REQUESTED` |

## Recovery steps

1. **Identify the state** via mission status; never guess from a transcript.
2. **Reconcile unknown external outcomes** with `reconcileExternalCall` (Design 04 §10): executed requires verifiable evidence, not-executed permits an idempotent retry, indeterminate requires human intervention.
3. **Replay the event log** from the last persisted event; idempotency keys deduplicate any repeated command.
4. **Fencing:** a stale worker token is rejected — acquire a fresh token before resuming writes (`missions/fencing.ts`).
5. **Confirm execution before repeating a mutation:** external confirmation gates the retry (outbox dedupe by aggregate + payload hash).
6. **Verify:** mission status, event continuity, and `drenyra-ai ledger validate`.

## Rules

- No blind retries after unknown outcomes.
- No re-execution because an agent "remembers" failing.
- Every resumed mutation is idempotent and receipted.

---

**Read next:** [Runbooks index](README.md) · [Architecture](../architecture.md)
