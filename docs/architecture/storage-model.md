# Storage Model

← [Architecture index](../architecture.md) · [README](../../README.md)

Persisted state is part of the trust model, not an implementation detail. Choose an adapter deliberately and verify durability, tenant isolation, and recovery before relying on it.

> [!IMPORTANT]
> **The JSON file mission store is a development adapter** — fine for demos and smoke tests, never canonical storage for a fiscal runtime.

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; store schema version numbers are JSON integers, never floats.

## Development adapters vs canonical storage

The CLI uses the **JSON file mission store** (`cmd/adapters/file-mission-store.ts`).
It is a development adapter for demos and isolated smoke tests, not production
fiscal storage. The repository also provides [PostgreSQL adapters](../../missions/store.postgres.ts)
for missions, events, idempotency, fencing, and outbox storage. Their existence is
not proof that a deployment satisfies every durability or isolation requirement.

## Development adapter contract

- **Atomic writes:** serialize → write temp file in the same directory → `fsync` temp → `rename` over the target → best-effort `fsync` of the parent directory. A crash mid-write leaves the previous store intact, never a truncated file.
- **Versioned shape:** the persisted document carries `storeSchemaVersion` (currently 1) so future migrations are explicit.
- **Load tolerance:** legacy files without the schema version load leniently (migration path, not silent corruption).

<a id="canonical-storage-future"></a>

## Canonical storage requirements

The runtime interfaces (`MissionStore`, `MissionEventStore`, `IdempotencyStore`) are persistence-agnostic. Every production storage composition must satisfy:

1. **Append-only event log** with sequence ordering.
2. **Crash-safe writes** (same atomicity discipline as the dev adapter, or a real journal).
3. **Idempotency records** with expiry and payload fingerprints (never full payloads).
4. **Scope enforcement on read** (company/RUC/period) — tenant isolation is structural.
5. **Verifiable provenance** — every mutation traces to an actor and a receipt.

The PostgreSQL adapter accepts an explicit pool. Real integration tests require
`DATABASE_URL`; fake-pool unit tests verify SQL/parameter mapping but do not
establish live database behavior. Operators must verify migrations, access
control, transaction boundaries, backups, and recovery for their deployment.

---

## Read next

- [Receipt vs. Ledger Entry](receipt-ledger-model.md) — the artifact pair this store must persist
- [Architecture](../architecture.md) — back to the index
