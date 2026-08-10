# Dependency Rules

> [!IMPORTANT]
> **Contracts are normative; library modules are dependency-free; `agents/` stages work and never becomes fiscal authority.**

<!-- -->

> **Last updated:** 2026-08-02. Status: pre-alpha. — Part of: [Architecture](../architecture.md)

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
2. **Library modules are dependency-free.** `receipts/`, `ledger/`, `missions/`, `candidates/`, `review/` use only `node:crypto` built-ins. No cross-module coupling beyond the documented single-definition re-exports (`ReceiptType`, `EvidenceItem` live in `receipts/`).
3. **`agents/` is orchestration, not Core.** It imports `missions/` only; the
   Core library modules never import `agents/`. Handlers stage work and pause
   at gates; Core transitions, idempotency, receipts, and human approval stay
   authoritative. `cmd/` composes agents into the CLI.
4. **`cmd/` is an adapter layer.** Parsing, validation (ajv against the canonical schemas), output formatting, and file persistence live in `cmd/`; business policy never lives in the CLI.
5. **No reverse imports.** `cmd/` imports library modules; library modules never import `cmd/`.
6. **`contracts/` is read-only at runtime.** Schemas load from the package-root `contracts/` directory (see `cmd/adapters/schema-loader.ts`); nothing writes to `contracts/`.
7. **Ecosystem direction:** this package never depends on Drenyra, Drenyra Pi, or Drenyra Engram. It may integrate Drenyra Engram later as an optional memory read — memory never authorizes.

---

## Read next

- [Storage Model](storage-model.md) — where state persists today and what canonical storage must guarantee
- [Architecture](../architecture.md) — back to the index
