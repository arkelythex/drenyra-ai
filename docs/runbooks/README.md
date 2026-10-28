# Runbooks — Drenyra AI

← [Architecture index](../architecture.md) · [Usage reference](../usage.md)

A stopped authority surface needs evidence and an accountable operator, not a guessed retry.
Choose the procedure below and preserve the original artifacts before acting.

> [!IMPORTANT]
> **Operator procedures for runtime deployments.** These runbooks cover incident response, key rotation, schema migration, and recovery. They are a v1.0 acceptance criterion (Design 05 §14.13): *incident, key-rotation, migration, and recovery runbooks exist*.

<!-- -->

> **Part of:** [Architecture](../architecture.md) · **Last updated:** 2026-08-10

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Quick path

1. Identify the deployment, affected company/RUC, fiscal period, and mission ID.
2. From the installed CLI, run `drenyra-ai --help` to confirm available diagnostics.
3. Use [Incidents](01-incidents.md) for an integrity failure or [Recovery](04-recovery.md)
   for an uncertain external outcome; never turn a rejected gate into success.

These are operator procedures, not proof of a production deployment. Managed-vault
rotation and database migration require deployment-specific tooling and approval;
there is no generic CLI command here that performs them. PostgreSQL adapter tests
are not evidence of a certified live database or connector.

## Index

| Runbook | When to use |
| --- | --- |
| [01 — Incidents](01-incidents.md) | A gate, receipt, or ledger check fails, or an authority surface is stopped |
| [02 — Key rotation](02-key-rotation.md) | A signer key is revoked, rotated, or suspected compromised |
| [03 — Schema migration](03-migration.md) | A storage schema changes while missions are active |
| [04 — Recovery](04-recovery.md) | A mission is interrupted, UNKNOWN, or an external outcome is ambiguous |

## Guiding principles

1. **Fail closed, preserve evidence.** An unclear state is never guessed through; evidence and receipts are preserved before any corrective action.
2. **Recovery from persisted state, never transcript.** Missions resume from events, idempotency keys, and evidence — not from what an agent "remembers".
3. **No consumer converts a rejection into approval.** A Core rejection stays a rejection until a professional and the gates decide otherwise.
4. **Every corrective action is receipted.** Nothing material happens without a receipt.

---

**Read next:** [01 — Incidents](01-incidents.md) · [Architecture](../architecture.md) — back to the index
