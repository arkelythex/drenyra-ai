# Drenyra AI — Architecture

> **Last updated:** 2026-08-01.

## Position in the ecosystem

```text
                    ┌───────────────────┐
                    │ Drenyra-Engram    │
                    │ Accounting Memory │
                    └─────────▲─────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
       ┌────────┴────────┐        ┌─────────┴─────────┐
       │ Drenyra-AI      │        │ Drenyra-Pi       │
       │ Agent Ecosystem │◄───────│ Pi-native Harness│
       └────────▲────────┘        └───────────────────┘
                │
       ┌────────┴────────┐
       │ Drenyra         │
       │ Command Center  │
       └─────────────────┘
```

Drenyra AI may integrate Drenyra Engram. It is consumed by Drenyra and Drenyra Pi. It **never** depends on Drenyra or Drenyra Pi.

## Core invariants

1. **RED (Receipt-Driven Accounting):** every material action produces an immutable receipt. Receipts are Ed25519-signed and verifiable from canonical vectors.
2. **Risk-proportional review:** R0 (read, high autonomy) → R3 (irreversible, explicit dual approval). Review depth is derived from materiality, never chosen ad hoc.
3. **Candidates are first-class artifacts:** agent proposals carry identity, scope, and materiality; they are inspected, reviewed, and either accepted or corrected within a bounded budget.
4. **Ledger-as-Git:** commits = atomic accounting changes, diffs = explained differences, PRs = accounting review packages.
5. **Gates, not faith:** lifecycle transitions validate authority, scope, and receipts before commit/push/PR/release.

## Layer model

```text
integrations/        MCP, agent hosts, external ERPs
   │
contracts/           Canonical, versioned contracts (transport-agnostic)
   │
runtime/             Missions, routing (direct/delegated/formal), execution
   │
domain services      candidates, receipts, ledger, gates, review, recovery
   │
policies/            Risk tiers and review policies per jurisdiction
```

- **Contracts are transport-agnostic.** Types, schemas, states, commands, events, and errors live without transport bindings.
- **Adapters are entry points, not architecture.** CLI, MCP, and integrations map onto the same domain services.
- **Everything deterministic is tested with canonical vectors.** Receipt verification and ledger hashing never rely on ambient state.

## Routing model

| Route       | Use case                                   |
| ----------- | ------------------------------------------ |
| Direct      | Small, mechanical, full-context work       |
| Delegated   | Exploration, multi-file writes, verification |
| Formal      | High materiality: SDD/FSD artifacts + gates |

Materiality escalates the route; the route never demotes materiality.

## Consumer contract

Drenyra and Drenyra Pi consume **released, versioned** artifacts — never a checkout of this repo. Drenyra Pi additionally pins an exact verified version package-locally.

## Repository scope

This repo is the agent ecosystem. It does **not** contain the product UI, tenants, documents, accounts, or SUNAT flows (those live in `arkelythex/Drenyra`), nor a Pi harness (that is `arkelythex/drenyra-pi`), nor a memory engine (that is `arkelythex/drenyra-engram`).
