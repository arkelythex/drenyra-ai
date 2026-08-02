# Dependency Rules

> **Last updated:** 2026-08-02. Status: pre-alpha.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Layer model (who may import whom)

```text
contracts/            normative, versioned, transport-agnostic
    │  (types and rules are the source of truth)
    ▼
receipts/  ledger/  missions/  candidates/  review/
    │  library modules — zero runtime dependencies (node:crypto only)
    ▼
cmd/                  thin adapters: parsing, output, file stores
```

## Rules

1. **Contracts are normative.** Library modules implement `contracts/*.md` + `contracts/*.schema.json`; the frozen conformance vectors are the source of truth for correctness (tests must pass byte-for-byte).
2. **Library modules are dependency-free.** `receipts/`, `ledger/`, `missions/`, `candidates/`, `review/` use only `node:crypto` built-ins. No cross-module coupling beyond the documented single-definition re-exports (`ReceiptType`, `EvidenceItem` live in `receipts/`).
3. **`cmd/` is an adapter layer.** Parsing, validation (ajv against the canonical schemas), output formatting, and file persistence live in `cmd/`; business policy never lives in the CLI.
4. **No reverse imports.** `cmd/` imports library modules; library modules never import `cmd/`.
5. **`contracts/` is read-only at runtime.** Schemas load from the package-root `contracts/` directory (see `cmd/adapters/schema-loader.ts`); nothing writes to `contracts/`.
6. **Ecosystem direction:** this package never depends on Drenyra, Drenyra Pi, or Drenyra Engram. It may integrate Drenyra Engram later as an optional memory read — memory never authorizes.
