# Dependency Direction — Drenyra AI (Verifiable Accounting Agent Ecosystem)

> [!IMPORTANT]
> **Drenyra AI is the ecosystem's keystone:** consumed by Drenyra and Drenyra Pi, integrating memory, and depending on nothing product-shaped.

<!-- -->

> **Last updated:** 2026-08-01. — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## In this document

- [Ecosystem dependency graph](#ecosystem-dependency-graph)
- [Direction rules applied to Drenyra AI](#direction-rules-applied-to-drenyra-ai)
- [Rules in practice](#rules-in-practice)
- [Why this matters](#why-this-matters)

## Ecosystem dependency graph

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

Arrows point toward the dependency. Drenyra AI is the ecosystem's keystone: consumed by Drenyra and Drenyra Pi, integrating memory, and depending on nothing product-shaped.

## Direction rules applied to Drenyra AI

### Drenyra AI MAY depend on

| Repo | How | Constraint |
| --- | --- | --- |
| `drenyra-engram` | memory reads/context through its surfaces | memory never authorizes; authority stays in gates + humans |

### Drenyra AI must NEVER depend on

- **Drenyra** — never. No Drenyra types, UI, or SUNAT flows in contracts or runtime.
- **`drenyra-pi`** — never. Drenyra AI must not know the harness exists; Pi specifics never leak into its contracts.

### Who must never depend on Drenyra AI

Nobody — Drenyra AI is *meant* to be depended on, via released versions. The dependency rules that protect it are the reverse ones above.

## Rules in practice

1. Drenyra AI's contracts are the **public surface**: transport-agnostic, versioned, consumed by Drenyra, Drenyra Pi, ERPs, SaaS, and agent hosts.
2. Consumers integrate released, versioned artifacts — never a checkout.
3. Drenyra Pi pins an exact verified version package-locally; Drenyra AI never adapts to Pi's pinning strategy.
4. Changing a contract is a public change: bump the version, document the migration, get explicit approval.
5. Drenyra AI may integrate `drenyra-engram`; the integration is optional and memory never authorizes.

## Why this matters

Drenyra AI is standalone by design so the ecosystem cannot collapse back into a monolith. If Drenyra or Drenyra Pi leak into it, ERPs and external agent hosts lose their adoption path.

---

## Read next

- [Dependency Rules](dependency-rules.md) — the in-repo layer model and import rules
- [Architecture](../architecture.md) — back to the index
