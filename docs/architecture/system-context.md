# System Context

> [!IMPORTANT]
> **`drenyra-ai` is the standalone Verifiable Accounting Agent Ecosystem runtime** — the executable core that Drenyra, Drenyra Pi, ERPs, and other SaaS consume for receipt-driven accounting, mission lifecycle, candidate review, and proportional review. It is the direct accounting-domain counterpart of `gentle-ai`.

<!-- -->

> **Last updated:** 2026-08-02. Status: pre-alpha (0.0.1-prealpha.1). — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## What this package is

`drenyra-ai` is the standalone **Verifiable Accounting Agent Ecosystem** runtime: the executable core that Drenyra, Drenyra Pi, ERPs, and other SaaS consume for receipt-driven accounting, mission lifecycle, candidate review, and proportional review planning. It is the direct counterpart of `gentle-ai` for the accounting domain.

## Components

| Component | Responsibility |
| --- | --- |
| `receipts/` | RDA receipt core: canonical serialization, SHA-256, Ed25519 sign/verify, trusted signer lifecycle |
| `ledger/` | Append-only audit ledger validation (chain continuity, first-divergence reporting) |
| `missions/` | Mission protocol (15 states, commands, events, errors, versioning, idempotency) + `MissionRuntime` |
| `agents/` | Orchestration layer: deterministic per-intent `IntentHandler`s + registry (stages work only; Core gates and approval stay authoritative) |
| `candidates/` | Candidate identity (byte-based subject hash), materiality R0–R3, immutable lifecycle with one-scoped correction |
| `review/` | Proportional review lens selection + review workload forecast |
| `cmd/` | Thin CLI adapters (receipt verify, ledger validate, mission start/apply/status, candidate inspect/verify) |
| `contracts/` | Normative contracts: JSON schemas + frozen conformance vectors + contract docs |

## Entry points

- **CLI** (`drenyra-ai ...`) — the operational surface; thin adapters over the library.
- **Library** (`drenyra-ai/receipts`, `/missions`, ...) — programmatic consumers.
- **Contracts** (`contracts/`) — the public surface for ERPs, auditors, and other SaaS.

## What this package is NOT

- Not the product UI/tenants/documents (that is `arkelythex/drenyra-app-web`).
- Not a Pi harness (that is `arkelythex/drenyra-pi`).
- Not a memory engine (that is `arkelythex/drenyra-engram`).
- Not an authorization system on its own: gates + human approval are where authority lives.

---

## Read next

- [Ecosystem Boundaries](ecosystem-boundaries.md) — what this package is and is not within the ecosystem
- [Architecture](../architecture.md) — back to the index
