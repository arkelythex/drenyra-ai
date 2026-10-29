# Drenyra AI — Contracts

← [Back to README](../README.md)

Integrators need a surface that does not change when a transport or host changes.
These versioned contracts define that surface; conformance evidence pins behavior
and explicit approval controls incompatible changes.

> [!IMPORTANT]
> **Status: six contracts are FROZEN at v0.1 (release 0.2.0); `brand-system` is DRAFT at v0.4, `connector-adapter` is DRAFT at v0.1, and `projection` is DRAFT at v0.1.** Freezing means the normative surface of each frozen contract is pinned by a conformance suite that runs in CI and fails on drift. `brand-system` ships its conformance suite now and freezes when the ecosystem adopts it (see the [contract](brand-system.md)); `connector-adapter` ships its mock conformance suite now and freezes after adoption plus explicit approval (see the [contract](connector-adapter.md)); `projection` delegates conformance to the existing slice-A suite at `projection/__tests__/` and freezes after documented adoption plus explicit approval (see the [contract](projection.md)).

<!-- -->

> [!NOTE]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents
> (no float is ever used for money); sequence and version values are JSON
> integers, never floats.

Contracts are the **public surface** of Drenyra AI. They are transport-agnostic, versioned, and consumed by Drenyra, Drenyra Shell, ERPs, other SaaS, and agent hosts. Changing a contract is a public contract change: bump the version, document the migration path, and get explicit approval.

## Quick path

1. Pick the contract below and read its version, status, and conformance section.
2. Use the [SDK](../docs/sdk.md) or [CLI](../docs/usage.md), preserving scope and authority.
3. In a repository checkout, run the frozen conformance tests:

   ```bash
   bun x vitest run contracts
   ```

A draft is not frozen or adopted merely because its tests pass. The specific
freeze criteria remain in its contract; do not infer live connector capability
or consumer adoption from a declaration.

## Index

| Contract | Version | Status | Consumed by |
| --- | --- | --- | --- |
| [mission-protocol](mission-protocol.md) | 0.1 | FROZEN | Drenyra, Drenyra Shell, CLI |
| [candidate](candidate.md) | 0.1 | FROZEN | Drenyra, Drenyra Shell, review tooling |
| [receipt](receipt.md) | 0.1 | FROZEN | All consumers, ERPs, auditors |
| [gate](gate.md) | 0.1 | FROZEN | Drenyra, Drenyra Shell, CI/CD |
| [ledger](ledger.md) | 0.1 | FROZEN | Auditors, ERPs, Drenyra Shell |
| [recovery](recovery.md) | 0.1 | FROZEN | Drenyra Shell, CLI |
| [brand-system](brand-system.md) | 0.4 | DRAFT | Drenyra Console, Drenyra Shell, Drenyra Engram, Guardian Angel, docs |
| [connector-adapter](connector-adapter.md) | 0.1 | DRAFT | Future restricted ERP, SUNAT/SIRE, bank, e-invoicing, and document connectors (no live connector yet) |
| [projection](projection.md) | 0.1 | DRAFT | Drenyra Console, Drenyra Shell, CLI |

The receipt contract's normative shape — the JSON schemas and the frozen conformance vectors — lives in [receipt-schema](receipt-schema/README.md).

## Contract requirements

1. **Versioned.** Every contract declares `version` and a compatibility policy (major = breaking).
2. **Verifiable.** Anything cryptographic ships with canonical vectors and a conformance test suite.
3. **Scope-safe.** Every artifact carries RUC/company/period scope where fiscal context applies.
4. **Transport-agnostic.** No HTTP, CLI, or framework bindings inside contract types.
5. **Backward-compatible by default.** Breaking changes require a major bump and a migration path.

## How to change a contract

1. Open a change proposal against the affected contract doc.
2. Update the doc, bump the version, and add the migration section.
3. Update conformance vectors in lockstep.
4. Review with proportional risk review (contracts are high-materiality).
5. Publish a release; consumers upgrade on their own cadence.

---

**Read next:** [Drenyra AI README](../README.md) — the ecosystem overview with the full contract table.
