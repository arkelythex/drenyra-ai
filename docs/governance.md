# Drenyra AI — Open-Core Governance

> [!IMPORTANT]
> **Community development is governed, not ad-hoc.** The open surface (contracts, schemas, conformance vectors, SDK, MCP, base policies) evolves through approved issues, RFC review for contracts, ownership boundaries, and compatibility rules. The defensible advantage is trusted integrations and professional quality — not secrecy around receipt verification.

<!-- -->

> **Part of:** [Architecture](architecture.md) · **Last updated:** 2026-08-10

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Community development model

| Mechanism | Purpose |
| --- | --- |
| **Approved issues** | Community work starts from approved issues, never from unsolicited large PRs |
| **`up-for-grabs` label** | Scoped, approved, unclaimed work for contributors |
| **RFC review for contracts** | Any change to a frozen contract surface goes through an RFC before implementation |
| **CODEOWNERS for fiscal-authority surfaces** | `contracts/`, `receipts/`, `ledger/`, `gates/`, `missions/` changes require owner review |
| **DCO or CLA policy** | Every contribution certifies its origin (Developer Certificate of Origin) |
| **Compatibility rules** | Consumers upgrade on their own cadence; breaking changes require a major bump and a migration path |
| **Private security reporting** | Vulnerabilities go through GitHub Private Vulnerability Reporting (see [SECURITY.md](../SECURITY.md)) |
| **Conformance requirements for adapters** | Every adapter must pass the adapter conformance suite to be accepted |
| **Certified-connector program** | Connectors meet verified behavior + SLAs to earn certification |

## Contract change policy

1. Open an RFC against the affected contract doc.
2. Bump the version and document the migration path.
3. Update conformance vectors in lockstep (CI fails on drift).
4. Review with proportional risk review (contracts are high-materiality).
5. Publish a release; consumers upgrade on their own cadence.

A breaking change to a frozen contract requires a **major version** — never a silent mutation.

## Contributor responsibilities

- **Fiscal correctness is a product safety requirement**: never break receipts, ledger integrity, gates, or audit trails.
- **No floats for money.** Money is whole-number cents (BigInt) or the Drenyra `Money` model.
- **Tenant/RUC scope is mandatory** in every query and mutation.
- **Every material action produces a receipt.** No receipt, no mutation.
- **Conventional commits only; no AI attribution.**

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full workflow.

## Open surface vs commercial surface

The open core covers contracts, schemas, conformance suites, canonical vectors, mission protocol, candidates, baseline materiality, receipts, Ed25519 verification, ledger, gates, recovery, SDK, CLI, base MCP server, skills and adapter frameworks, auditable Peruvian base policies, and community connectors.

The commercial surface (Drenyra Command Center, managed cloud, SSO/SCIM, managed KMS/HSM, certified connectors with SLAs, certified policy packs, enterprise analytics, support) stays separate — it never weakens the open core's contracts or authority.

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution workflow
- [SECURITY.md](../SECURITY.md) — vulnerability reporting
- [Contracts](../contracts/README.md) — the frozen public surface
- [Design 01 — Ecosystem Frontier](design/design-01-ecosystem-frontier-and-authority.md)

---

**Read next:** [Architecture](architecture.md) — back to the index · [SDK](sdk.md) — the public library surface
