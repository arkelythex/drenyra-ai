# Storage Model

> **Last updated:** 2026-08-02. Status: pre-alpha.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; store schema version numbers are JSON integers, never floats.

## Development adapters vs canonical storage

Today the only concrete store is the **JSON file mission store** used by the CLI (`cmd/adapters/file-mission-store.ts`). It is explicitly a **development adapter** — fine for demos and smoke tests, never canonical storage for a fiscal runtime.

## Development adapter contract

- **Atomic writes:** serialize → write temp file in the same directory → `fsync` temp → `rename` over the target → best-effort `fsync` of the parent directory. A crash mid-write leaves the previous store intact, never a truncated file.
- **Versioned shape:** the persisted document carries `storeSchemaVersion` (currently 1) so future migrations are explicit.
- **Load tolerance:** legacy files without the schema version load leniently (migration path, not silent corruption).

## Canonical storage (future)

The runtime interfaces (`MissionStore`, `MissionEventStore`, `IdempotencyStore`) are persistence-agnostic. Canonical storage — when it lands — must satisfy:

1. **Append-only event log** with sequence ordering.
2. **Crash-safe writes** (same atomicity discipline as the dev adapter, or a real journal).
3. **Idempotency records** with expiry and payload fingerprints (never full payloads).
4. **Scope enforcement on read** (company/RUC/period) — tenant isolation is structural.
5. **Verifiable provenance** — every mutation traces to an actor and a receipt.

Until then, the JSON store is the only implementation, and it is clearly labeled as non-canonical in both code and docs.
