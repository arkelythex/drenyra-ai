# Runbook 03 — Schema Migration

> [!IMPORTANT]
> **Storage schemas are versioned migrations (Design 05 "Versioning"); a migration runs with active missions in flight.** Migration is backward-compatible by default and never loses evidence, receipts, or in-flight mission state.

<!-- -->

> **Part of:** [Runbooks](README.md) · **Last updated:** 2026-08-10

## When to use

- A storage schema changes while missions are active.
- The production PostgreSQL adapter's DDL evolves (see `POSTGRES_SCHEMA_DDL` in `missions/store.postgres.ts`).

## Migration steps

1. **Freeze a release boundary.** Capture the current schema version; the release and its checksums are the rollback point.
2. **Write a versioned migration** (forward + rollback) that is additive first: new columns/tables with defaults, no destructive changes in the same step.
3. **Back up** the ledger, events, and idempotency records (evidence and receipts are immutable — they must survive any migration).
4. **Apply in staging** with active-mission fixtures (Design 05 scenario 12: *schema migration with active missions*).
5. **Apply in production** with the mission runtime paused at safe boundaries; in-flight missions resume from persisted state (see [Recovery](04-recovery.md)).
6. **Verify:** `drenyra-ai ledger validate`, mission status of the in-flight set, and the checksums of the released artifact.
7. **Rollback plan:** revert the migration and restore from the frozen backup; never migrate forward on corrupted state.

## Rules

- No destructive schema change ships without a major version bump and a migration path.
- Receipts preserve their original schema versions for reproducibility.
- Active missions are never lost: recovery is from events and evidence, not transcript.

---

**Read next:** [04 — Recovery](04-recovery.md) · [Runbooks index](README.md)
