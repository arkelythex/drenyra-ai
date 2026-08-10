# Drenyra AI — Architecture

> **Last updated:** 2026-08-01.

## Documentation index

| Doc | What it covers | Read when |
| --- | --- | --- |
| [Trust Model](architecture/trust-model.md) | What the runtime can prove and where authority lives | Starting out — read this first |
| [Authority Model](architecture/authority-model.md) | Chain of authority, risk tiers R0–R3, gates, approvals | Understanding who may authorize what |
| [Receipt vs. Ledger Entry](architecture/receipt-ledger-model.md) | Receipts as atomic proof vs. the ledger as chained order | Understanding the two audit artifacts |
| [System Context](architecture/system-context.md) | Package scope, components, entry points, non-goals | Scoping what this repo contains |
| [Trust Boundaries](architecture/trust-boundaries.md) | Where trust lives and fail-closed behavior per boundary | Reasoning about failure modes |
| [Ecosystem Boundaries](architecture/ecosystem-boundaries.md) | In-scope vs. non-goals vs. long-term exclusions | Separating this repo from the ecosystem |
| [Ecosystem Integration](architecture/ecosystem-integration.md) | Who consumes what, integration rules, contract stability | Integrating Drenyra, Drenyra Pi, or Engram |
| [Dependency Direction](architecture/dependency-direction.md) | Ecosystem MAY/NEVER dependency graph | Enforcing direction between repos |
| [Dependency Rules](architecture/dependency-rules.md) | In-repo layer model and import rules | Reviewing imports and layering |
| [Storage Model](architecture/storage-model.md) | Dev adapter vs. canonical storage requirements | Persistence and recovery questions |
| [Design 01 — Ecosystem Frontier](design/design-01-ecosystem-frontier-and-authority.md) | Approved frontier: responsibilities, never-musts, chain of authority | Understanding who owns what and how authority flows |
| [Design 02 — Monthly Close](design/design-02-monthly-close.md) | The v1.0 flagship flow: preflight → evidence → reconciliation → candidates → review → external confirmation → close package | Building the monthly accounting and tax close |
| [Design 03 — Agents, Skills, Integrations](design/design-03-agents-skills-integrations.md) | AI proposes, deterministic code decides: orchestrator, initial agents, skill layers, integration order, provider agnosticism | Building the agent and integration layer |

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
agents/              Orchestration: deterministic intent handlers + registry (staging only)
   │
cmd/                 Thin CLI adapters
   │
missions/            Mission protocol + MissionRuntime (lifecycle, idempotency, rules)
   │
domain services      candidates, receipts, ledger, gates, review, recovery
   │
contracts/           Canonical, versioned contracts (transport-agnostic)
```

- **Contracts are transport-agnostic.** Types, schemas, states, commands, events, and errors live without transport bindings.
- **Adapters are entry points, not architecture.** CLI, MCP, and integrations map onto the same domain services.
- **Everything deterministic is tested with canonical vectors.** Receipt verification and ledger hashing never rely on ambient state.

**Hybrid orchestration vs. Core:** `agents/` is the orchestration layer —
deterministic, per-intent `IntentHandler`s that stage work and pause at the
evidence/approval gate. The deterministic Core (MissionRuntime transitions,
idempotency, gates, receipts, explicit human approval) stays authoritative:
agents propose and stage, Core gates and humans decide. No agent claims
SUNAT, bank, or ERP execution, and no agent performs fiscal approval.

## Routing model

| Route | Use case |
| --- | --- |
| Direct | Small, mechanical, full-context work |
| Delegated | Exploration, multi-file writes, verification |
| Formal | High materiality: SDD/FSD artifacts + gates |

Materiality escalates the route; the route never demotes materiality.

## Consumer contract

Drenyra and Drenyra Pi consume **released, versioned** artifacts — never a checkout of this repo. Drenyra Pi additionally pins an exact verified version package-locally.

## Repository scope

This repo is the agent ecosystem. It does **not** contain the product UI, tenants, documents, accounts, or SUNAT flows (those live in `arkelythex/Drenyra`), nor a Pi harness (that is `arkelythex/drenyra-pi`), nor a memory engine (that is `arkelythex/drenyra-engram`).
