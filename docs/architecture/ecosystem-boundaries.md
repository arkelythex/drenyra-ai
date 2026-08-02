# Ecosystem Boundaries — Drenyra AI (Verifiable Accounting Agent Ecosystem)

> **Last updated:** 2026-08-01.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

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
- **CLI + MCP** — `drenyra-ai` command surface and MCP server for multi-agent configuration.

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

- Pre-alpha: contracts are draft; slices 1–3 (receipts/ledger, missions, candidates/review) are implemented; recovery and gates are planned.
- Consumers must wait for released versions — a checkout is never a dependency.

## Ownership and accountability

- Runtime contracts, receipts, ledger, gates, and review lenses: this repo.
- Product behavior: Drenyra. Pi behavior: `drenyra-pi`. Memory: `drenyra-engram`.
- A defect in a consumed memory surface is filed in `drenyra-engram`; a defect in a runtime contract belongs here.

## Boundary enforcement

- Direction violations are caught in review: a PR that imports Drenyra or Drenyra Pi types into Drenyra AI is rejected.
- Consumers use **released, versioned** artifacts — never a checkout of this repo (see `dependency-direction.md` and `RELEASING.md`).
