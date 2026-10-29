# Intended Usage — Drenyra AI

← [Back to README](../README.md)

An accounting proposal is useful only if a professional can inspect its evidence,
understand its risk, and verify what happened. Drenyra AI supplies that control
plane without making the agent the fiscal authority.

> [!IMPORTANT]
> **AI proposes. The system validates. The professional decides. Evidence remains.**
> Neither a model response nor institutional memory is approval or fiscal proof.

## Quick path

1. [Run the Quickstart](quickstart.md) — inspect the core and create a draft in an isolated store.
2. [Read the Trust Model](architecture/trust-model.md) — separate execution proof from fiscal authority.
3. [Choose an integration](sdk.md) — consume a released library, CLI, or MCP surface.

## Definition

Drenyra AI is a **configurator, runtime, and deterministic control plane** for
accounting and fiscal agents. It can be consumed standalone by ERPs, SaaS,
professional interfaces, and agent hosts.

| Surface | Responsibility |
| --- | --- |
| Configurator | Configure existing hosts with managed assets using `install run`, `doctor run`, `sync run`, `upgrade run`, and `rollback run` |
| Runtime | Run scoped missions with a frozen 15-state lifecycle, deterministic intent handlers, idempotency, and recovery |
| Control plane | Identify candidates, derive review depth, enforce gates, verify signed receipts, and maintain the append-only audit ledger |

## The philosophy, translated

Gentle-AI is the engineering reference, not a codebase to copy into a fiscal
system. The shared principle is **verify the work rather than trust a narrative**.
The accounting translation imposes stricter authority and evidence boundaries.

| Principle | Accounting translation |
| --- | --- |
| Adapt the tools people already use | Agent hosts, professional interfaces, and external ERPs consume the same core |
| Keep small work direct | R0/R1 work follows its controls without pretending every query is a fiscal close |
| Make material work recoverable | Missions preserve scope, decisions, events, and explicit waits |
| Bind review to the exact candidate | Subject bytes determine identity; a correction requires re-inspection |
| Retain useful context | Engram informs; memory never supplies authority |
| Separate proof from delivery decisions | A receipt proves its recorded action; it does not invent the next approval |

## The golden rule

The professional should not need to learn agent orchestration to obtain an
accounting result. The intended experience is reviewable candidates, evidence,
explicit decisions, and verifiable receipts behind their normal interface.
That target is not a claim that every planned integration is released.

## Stricter than Gentle-AI — the additional controls

- **Memory never authorizes.** A remembered observation is not permission.
- **Agents never approve themselves.** Human approval is explicit and recorded.
- **External effects require external evidence.** Signed XML is not proof of an accepted CPE; a story about SUNAT, an ERP, or a bank is not execution proof.
- **Review depth is derived.** Value in BigInt cents, reversibility, and jurisdiction determine materiality.
- **Recovery reads persisted events.** Neither a transcript nor process memory proves completion.
- **Missing authority fails closed.** Surface the missing input instead of guessing.

## The conceptual architecture

![Advice and memory inform; tenant-scoped deterministic gates enforce; professionals retain authority and external systems provide evidence.](assets/diagrams/authority-boundary.light.svg#gh-light-mode-only)
![Advice and memory inform; tenant-scoped deterministic gates enforce; professionals retain authority and external systems provide evidence.](assets/diagrams/authority-boundary.dark.svg#gh-dark-mode-only)

The [runtime map](../README.md#architecture-maps) shows the technical modules.
Concept illustrations explain responsibilities; contracts remain normative.

## The delivery architecture (frozen for v1.0)

The v1.0 design chooses a **headless independent core**, consumed by Drenyra
Desktop through a released library, CLI, or MCP interface. The flagship vertical
is the monthly accounting and tax close. Drenyra AI does not ship its own UI.

| Option | Design decision | Reason |
| --- | --- | --- |
| Headless core + professional interface | Chosen | Keeps the core integrable and hides orchestration from accountants |
| Agent configurator as the primary experience | Not chosen | Useful to developers, but does not make accountants' normal workflow the center |
| Put every layer inside Drenyra AI | Not chosen | Couples interface, fiscal domain, and runtime; duplicates responsibilities |

Consumers upgrade released artifacts on their own cadence. Frozen contracts are
the compatibility surface, not a checkout or a dependency on Desktop/Shell.

## What Drenyra AI is not

| Not this | Boundary |
| --- | --- |
| An autonomous accountant | Agents propose; the core enforces policy; professionals decide |
| An ERP or journal of record | Transactional books and posting belong to accounting systems |
| The primary professional interface | Desktop consumes the core; the core remains headless |
| A privileged SUNAT/bank gateway | Adapters and external evidence preserve the boundary |
| The fiscal authority | Human business and legal judgment is never delegated to a model |

## The responsibility split

| Component | Role |
| --- | --- |
| Drenyra AI | Missions, candidates, gates, receipts, audit ledger, and deterministic enforcement |
| Drenyra Console | Professional interface consuming released artifacts |
| Drenyra Shell | Pi-native harness consuming a pinned package-local runtime |
| Drenyra Engram | Institutional memory; informs, never authorizes |
| Drenyra Skills | Versioned accounting, tax, and operational knowledge |
| Drenyra Guardian Angel | Independent read-only adversarial verification |
| ERP / SUNAT / banks | External systems connected through adapters and evidence |

## The target experience

A professional asks for a close, reconciliation, or review and receives an
inspectable outcome. The [design series](design/design-01-ecosystem-frontier-and-authority.md)
describes that target. The [Quickstart](quickstart.md) shows what can be exercised
through the current CLI, including actual JSON inputs rather than aspirational
commands such as `mission start monthly-close`.

## Equivalence with Gentle-AI

The parallel is structural: workflow, candidates, review, evidence, and durable
context. Drenyra's RDA is not a renamed software-delivery gate. Fiscal receipts
are signed, monetary values are BigInt cents, RUC/period scope is mandatory,
and professional approval remains explicit.

## Frontier rules

1. Agents stage; they never claim fiscal approval or external execution.
2. Nothing material happens without a receipt.
3. Gates validate authority, scope, and evidence before a transition.
4. Memory informs, never authorizes.
5. Review follows materiality, not an agent claim.
6. The fiscal lifecycle order is fixed; money is BigInt cents.

## Next steps

- [Architecture](architecture.md) — understand ownership and dependency direction.
- [Contracts](../contracts/README.md) — integrate the frozen surface.
- [ROADMAP](../ROADMAP.md) — distinguish released capabilities from planned work.
- [Usage](usage.md) — inspect the current CLI rather than infer commands from the target experience.
