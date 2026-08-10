<div align="center">

<h1>Drenyra AI</h1>

<p><strong>Verifiable Accounting Agent Ecosystem</strong> — the agent runtime behind Drenyra's evidence-driven financial operations.</p>

<p>
<a href="https://github.com/arkelythex/drenyra-ai/releases"><img src="https://img.shields.io/github/v/release/arkelythex/drenyra-ai" alt="Release"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
<img src="https://img.shields.io/badge/tests-454-green" alt="Tests">
</p>

</div>

---

> [!IMPORTANT]
> **Private commercial product** — this repository is **private**; distribution
> is contractual, never public. See the Drenyra
> [Private Product Policy](https://github.com/arkelythex/Drenyra/blob/main/docs/products/private-product-policy.md).

> [!IMPORTANT]
> **v0.2.0 released** (2026-08-02) — all six contracts frozen (memory, scope, lifecycle, provenance, ledger, recovery). The frozen surface is normative: changes to a frozen contract require a major version bump. See the [release](https://github.com/arkelythex/drenyra-ai/releases/tag/v0.2.0) and the [CHANGELOG](CHANGELOG.md).

Drenyra AI is the direct counterpart of `gentle-ai` for the accounting domain: a runtime and CLI that makes AI execution **verifiable, receipted, and risk-proportional** for fiscal work. It works standalone — no Drenyra dependency — so ERPs, other accounting SaaS, and agent hosts (Codex, Claude Code, OpenCode) can adopt it.

## What it provides

- **Receipt-Driven Accounting (RDA)** — every material action produces an immutable receipt; nothing material happens without one.
- **Accounting Candidates** — agent proposals as first-class, reviewable artifacts with identity and materiality.
- **Proportional review** — review depth scales with risk (R0 high autonomy → R3 explicit dual approval).
- **Missions** — protocol-driven, resumable work units with lifecycle, commands, and events.
- **Ledger** — audit ledger core: append-only, verifiable, Ed25519-signed.
- **Gates** — lifecycle gates that validate authority, scope, and receipts before commit/push/PR/release.
- **Approvals** — human approval as an explicit, recorded event, never implied.
- **Recovery** — crash-safe resumption of missions and candidates.
- **CLI** — `drenyra-ai` command surface for mission, receipt, ledger, candidate, and gate operations.

## Layout

```text
cmd/                CLI dispatcher and command adapters
contracts/          Canonical contracts (protocol, candidate, receipt, gate, ledger)
agents/             Agent orchestration layer: deterministic intent handlers + registry (stages work only)
missions/           Mission protocol + MissionRuntime (lifecycle, idempotency, events)
candidates/         Candidate identity and materiality
review/             Proportional review lenses and evidence
receipts/           Receipt schemas and verification
ledger/             Audit ledger core
gates/              Lifecycle gates
recovery/           Crash recovery and resumption
docs/               Architecture, trust-model, and dependency documentation
```

## Hybrid orchestration vs. Drenyra Core

Drenyra AI orchestrates specialized accounting/fiscal agents through `agents/`:
deterministic `IntentHandler` implementations for every mission intent
(monthly-close, correction, reconciliation, invoice-review, compliance-check)
stage work, request evidence, and pause at the evidence or approval gate. The
deterministic Core — `missions/` (lifecycle, idempotency, rules), `gates/`,
`receipts/`, and explicit human approval — remains the authority for what may
actually change. Agents never claim SUNAT, bank, or ERP execution and never
perform fiscal approval; they only propose and stage work.

## Quick start

```bash
drenyra-ai mission start
drenyra-ai receipt verify
drenyra-ai ledger validate
```

## Consumers

| Consumer          | How it uses Drenyra AI                          |
| ----------------- | ---------------------------------------------- |
| Drenyra           | Fiscal workflows, reviews, approvals           |
| Drenyra Pi        | Pinned package-local runtime (never `PATH`)    |
| CLI               | Direct `drenyra-ai` commands                   |
| External ERPs     | Receipt verification, ledger validation        |
| Other SaaS        | Candidates and gates via contracts             |
| Agent hosts       | Codex, Claude Code, OpenCode integrations      |

## Ecosystem

| Project                                                        | Role                                   |
| -------------------------------------------------------------- | -------------------------------------- |
| [Drenyra](https://github.com/arkelythex/Drenyra)               | Accounting Command Center (consumes)   |
| [Drenyra Pi](https://github.com/arkelythex/drenyra-pi)         | Pi-native harness (consumes, pinned)   |
| [Drenyra Engram](https://github.com/arkelythex/drenyra-engram) | Institutional accounting memory (used) |

**Direction rule:** Drenyra AI may integrate Drenyra Engram and is consumed by Drenyra and Drenyra Pi. It never depends on Drenyra or Drenyra Pi, and Drenyra Pi never leaks into Drenyra AI's contracts.

## License

Proprietary. © 2026 Arkelythex. All rights reserved. See [LICENSE](LICENSE).
