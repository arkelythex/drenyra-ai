# Ecosystem Integration

← [Architecture index](../architecture.md) · [README](../../README.md)

Consumers need one released enforcement surface, not copies of its internal rules. Integrate through versioned artifacts and preserve the core's authority boundaries.

> [!IMPORTANT]
> **Consumers integrate released, versioned artifacts — never a source checkout.** Drenyra Shell additionally pins an exact verified version package-locally and never resolves `drenyra-ai` from `PATH`.

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version numbers are JSON integers, never floats.

## Who consumes what

```text
Drenyra Desktop ────► Drenyra AI ◄──── Drenyra Shell
                          │                 │
                          └───────┬─────────┘
                                  ▼
                           Drenyra Engram
                     optional context, not authority
```

## Integration rules

1. **Drenyra** and **Drenyra Shell** consume **released, versioned** artifacts of `drenyra-ai` — never a source checkout.
2. **Drenyra Shell** additionally pins an exact version, verifies its checksum, keeps it package-local, and **never resolves `drenyra-ai` from `PATH`** (see `arkelythex/drenyra-shell` `runtime/`).
3. **Drenyra AI never depends on Drenyra or Drenyra Shell**, and never knows Drenyra Shell exists.
4. **Drenyra Engram** is independent; Drenyra and Drenyra Shell read memory for context, but **memory never authorizes** — approvals route through gates and human professionals.
5. **Once Drenyra consumes a released version**, its internal copy of the extracted capability is removed or turned into an adapter — never a second authority.

## Contract stability

- Contracts are the public surface: versioned, transport-agnostic, with canonical vectors and migration paths.
- Six core contracts are frozen at v0.1. Package and contract versions are distinct; see [RELEASING](../../RELEASING.md) for the package policy.
- A release only ships after: typecheck, full test suite, conformance vectors, package build, packed-install verification, and the packed-artifact CI job.

---

## Read next

- [Dependency Direction](dependency-direction.md) — the MAY/NEVER dependency graph behind these rules
- [Architecture](../architecture.md) — back to the index
