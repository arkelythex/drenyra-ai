# Dependency Rules

← [Architecture index](../architecture.md) · [README](../../README.md)

Put policy in the core and transport concerns in adapters. These rules show which layers may compose others without reversing the dependency direction.

> [!IMPORTANT]
> **Contracts are normative; library modules are dependency-free; `agents/` stages work and never becomes fiscal authority.**

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Layer model (who may import whom)

```text
contracts/            normative, versioned, transport-agnostic
    │  (types and rules are the source of truth)
    ▼
receipts/  ledger/  missions/  candidates/  review/  gates/  recovery/
    │  library modules — zero runtime dependencies (node:crypto only)
    ▼
agents/               orchestration over missions/: deterministic intent
    │                 handlers + registry; staging only, never fiscal authority
    ▼
cmd/                  thin adapters: parsing, output, file stores
```

## Rules

1. **Contracts are normative.** Library modules implement `contracts/*.md` + `contracts/*.schema.json`; the frozen conformance vectors are the source of truth for correctness (tests must pass byte-for-byte).
2. **Keep deterministic policy separate from infrastructure.** Receipt/candidate
   cryptography uses `node:crypto`; transport and persistence dependencies belong
   in adapters. `missions/store.postgres.ts` accepts a `pg` pool as a persistence
   adapter. Do not claim the whole package has zero dependencies: `package.json`
   declares `ajv`, `ajv-formats`, and `pg`. Canonical types have single definitions
   (`ReceiptType` and `EvidenceItem` live in `receipts/`).
3. **`agents/` is orchestration, not Core.** It imports `missions/` only; the
   Core library modules never import `agents/`. Handlers stage work and pause
   at gates; Core transitions, idempotency, receipts, and human approval stay
   authoritative. `cmd/` composes agents into the CLI.
4. **`cmd/` is an adapter layer.** Parsing, validation (ajv against the canonical schemas), output formatting, and file persistence live in `cmd/`; business policy never lives in the CLI.
5. **No reverse imports.** `cmd/` imports library modules; library modules never import `cmd/`.
6. **`contracts/` is read-only at runtime.** Schemas load from the package-root `contracts/` directory (see `cmd/adapters/schema-loader.ts`); nothing writes to `contracts/`.
7. **Ecosystem direction:** this package never depends on Drenyra, Drenyra Shell, or Drenyra Engram. It may integrate Drenyra Engram later as an optional memory read — memory never authorizes.

---

## Read next

- [Storage Model](storage-model.md) — where state persists today and what canonical storage must guarantee
- [Architecture](../architecture.md) — back to the index
