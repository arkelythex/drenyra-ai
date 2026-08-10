# Ecosystem Boundaries — Drenyra AI (Verifiable Accounting Agent Ecosystem)

> [!IMPORTANT]
> **Drenyra AI is the agent runtime, standalone by design** — no Drenyra dependency — so ERPs, other accounting SaaS, and agent hosts (Codex, Claude Code, OpenCode) can adopt it.

<!-- -->

> **Last updated:** 2026-08-01. — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## In this document

- [Role in the ecosystem](#role-in-the-ecosystem)
- [What Drenyra AI is (in scope)](#what-drenyra-ai-is-in-scope)
- [Explicit non-goals](#explicit-non-goals)
- [What Drenyra AI must NOT contain long-term](#what-drenyra-ai-must-not-contain-long-term)
- [Consumers and producers](#consumers-and-producers)
- [Current state and maturity](#current-state-and-maturity)
- [Ownership and accountability](#ownership-and-accountability)
- [Boundary enforcement](#boundary-enforcement)

## Role in the ecosystem

Drenyra AI is the **agent runtime**: a standalone, verifiable, receipted execution core for fiscal work. It is the direct accounting-domain counterpart of `gentle-ai` — the framework, runtime, agents, skills, receipts, and accounting authority that Drenyra and Drenyra Pi consume.

Drenyra AI works **standalone** — no Drenyra dependency — so ERPs, other accounting SaaS, and agent hosts (Codex, Claude Code, OpenCode) can adopt it.

## What Drenyra AI is (in scope)

- **Receipt-Driven Accounting (RDA)** — every material action produces an immutable receipt; nothing material happens without one.
- **Candidates** — agent proposals as first-class, reviewable artifacts with identity, scope, and materiality.
- **Proportional review** — review depth scales with risk (R0 high autonomy → R3 explicit dual approval).
- **Missions** — protocol-driven, resumable work units with lifecycle, commands, and events.
- **Ledger** — append-only, verifiable, Ed25519-signed audit ledger core.
- **Gates** — lifecycle gates validating authority, scope, and receipts before commit/push/PR/release.
- **Approvals** — human approval as an explicit, recorded event, never implied.
- **CLI** — `drenyra-ai` command surface for mission, receipt, ledger, candidate, and gate operations. (MCP server is roadmap, not implemented.)

## Explicit non-goals

Drenyra AI is **not**:

- The product: no UI, tenants, documents, accounts, or SUNAT flows (that is `arkelythex/Drenyra`).
- A Pi harness: no extension registration, startup panels, or Pi-native commands (that is `arkelythex/drenyra-pi`).
- A memory engine: no observations, scope-first search, relations, or vigencia (that is `arkelythex/drenyra-engram`).

## What Drenyra AI must NOT contain long-term

- **Drenyra product logic** — UI, fiscal app flows, country-pack product surfaces. Extracted and consumed, never re-implemented.
- **Pi harness logic** — Drenyra AI must not even know `drenyra-pi` exists.
- **Memory storage and search** — integrated from `drenyra-engram` when used; memory never authorizes here either.
- **Skill marketplace / registry** — deferred to `arkelythex/drenyra-skills` when it outgrows this repo.

## Consumers and producers

| Direction | Party | Relation |
| --------- | ----- | -------- |
| Consumed by | Drenyra | released, versioned runtime (fiscal workflows, reviews, approvals) |
| Consumed by | Drenyra Pi | pinned, package-local, checksum-verified runtime (never `PATH`) |
| Consumed by | CLI | direct `drenyra-ai` commands |
| Consumed by | External ERPs | receipt verification, ledger validation |
| Consumed by | Other SaaS / agent hosts | candidates and gates via contracts; Codex, Claude Code, OpenCode |
| Integrates | `drenyra-engram` | memory reads/context (optional, memory never authorizes) |

## Current state and maturity

- All six contracts frozen and released; mission runtime, candidates/review, recovery, and gates implemented.
- Hybrid orchestration added: `agents/` stages deterministic intent work; the Core lifecycle, gates, receipts, and human approval remain authoritative.
- MCP server and external ERP/integration surfaces are roadmap, not implemented.
- Consumers must wait for released versions — a checkout is never a dependency.

## Ownership and accountability

- Runtime contracts, receipts, ledger, gates, and review lenses: this repo.
- Product behavior: Drenyra. Pi behavior: `drenyra-pi`. Memory: `drenyra-engram`.
- A defect in a consumed memory surface is filed in `drenyra-engram`; a defect in a runtime contract belongs here.

## Boundary enforcement

- Direction violations are caught in review: a PR that imports Drenyra or Drenyra Pi types into Drenyra AI is rejected.
- Consumers use **released, versioned** artifacts — never a checkout of this repo (see [dependency-direction.md](dependency-direction.md) and [RELEASING.md](../../RELEASING.md)).

---

## Read next

- [Ecosystem Integration](ecosystem-integration.md) — who consumes what and the integration rules
- [Architecture](../architecture.md) — back to the index
