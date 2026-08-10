# Ecosystem Integration

> [!IMPORTANT]
> **Consumers integrate released, versioned artifacts — never a source checkout.** Drenyra Pi additionally pins an exact verified version package-locally and never resolves `drenyra-ai` from `PATH`.

<!-- -->

> **Last updated:** 2026-08-02. Status: pre-alpha. — Part of: [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version numbers are JSON integers, never floats.

## Who consumes what

```text
                    ┌───────────────────┐
                    │ Drenyra-Engram    │  Institutional Accounting Memory
                    └─────────▲─────────┘  (independent; memory never authorizes)
                              │
                ┌─────────────┴─────────────┐
                │                           │
       ┌────────┴────────┐        ┌─────────┴─────────┐
       │ Drenyra-AI      │        │ Drenyra-Pi       │  Pi-native harness
       │ Agent Ecosystem │◄───────│ Pi-native Harness│  (installs + pins drenyra-ai)
       └────────▲────────┘        └───────────────────┘
                │
       ┌────────┴────────┐
       │ Drenyra         │  Accounting Command Center (consumes released drenyra-ai)
       └─────────────────┘
```

## Integration rules

1. **Drenyra** and **Drenyra Pi** consume **released, versioned** artifacts of `drenyra-ai` — never a source checkout.
2. **Drenyra Pi** additionally pins an exact version, verifies its checksum, keeps it package-local, and **never resolves `drenyra-ai` from `PATH`** (see `arkelythex/drenyra-pi` `runtime/`).
3. **Drenyra AI never depends on Drenyra or Drenyra Pi**, and never knows Drenyra Pi exists.
4. **Drenyra Engram** is independent; Drenyra and Drenyra Pi read memory for context, but **memory never authorizes** — approvals route through gates and human professionals.
5. **Once Drenyra consumes a released version**, its internal copy of the extracted capability is removed or turned into an adapter — never a second authority.

## Contract stability

- Contracts are the public surface: versioned, transport-agnostic, with canonical vectors and migration paths.
- `0.1.0` is reserved for the first frozen contract; until then versions are `0.0.1-prealpha.x`.
- A release only ships after: typecheck, full test suite, conformance vectors, package build, packed-install verification, and the packed-artifact CI job.

---

## Read next

- [Dependency Direction](dependency-direction.md) — the MAY/NEVER dependency graph behind these rules
- [Architecture](../architecture.md) — back to the index
