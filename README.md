# Drenyra AI

> **Verifiable Accounting Agent Ecosystem** — the agent runtime behind Drenyra's evidence-driven financial operations.

> **Status: pre-alpha.** Contracts are being stabilized; the runtime is extracted from `arkelythex/Drenyra` through vertical slices. Nothing here is production-ready yet.

Drenyra AI is the direct counterpart of `gentle-ai` for the accounting domain: a runtime and CLI that makes AI execution **verifiable, receipted, and risk-proportional** for fiscal work. It works standalone — no Drenyra dependency — so ERPs, other accounting SaaS, and agent hosts (Codex, Claude Code, OpenCode) can adopt it.

## What it provides

- **Receipt-Driven Accounting (RED)** — every material action produces an immutable receipt; nothing material happens without one.
- **Accounting Candidates** — agent proposals as first-class, reviewable artifacts with identity and materiality.
- **Proportional review** — review depth scales with risk (R0 high autonomy → R3 explicit dual approval).
- **Missions** — protocol-driven, resumable work units with lifecycle, commands, and events.
- **Ledger** — audit ledger core: append-only, verifiable, Ed25519-signed.
- **Gates** — lifecycle gates that validate authority, scope, and receipts before commit/push/PR/release.
- **Approvals** — human approval as an explicit, recorded event, never implied.
- **Recovery** — crash-safe resumption of missions and candidates.
- **CLI + MCP** — `drenyra-ai` command surface and MCP server for multi-agent configuration.

## Layout

```text
cmd/drenyra-ai      CLI entrypoint
contracts/          Canonical contracts (protocol, candidate, receipt, gate, ledger)
agents/             Specialized accounting agents
skills/             Packaged skills (extracted to arkelythex/drenyra-skills when they outgrow this repo)
policies/           Risk and review policies
runtime/            Core runtime (missions, routing, execution)
review/             Proportional review lenses and evidence
candidate/          Candidate identity and lifecycle
receipts/           Receipt schemas and verification
ledger/             Audit ledger core
gates/              Lifecycle gates
recovery/           Crash recovery and resumption
integrations/       MCP, external ERPs, agent hosts
```

## Quick start

```bash
drenyra-ai install
drenyra-ai doctor
drenyra-ai mission start
drenyra-ai candidate inspect
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
