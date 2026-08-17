# Drenyra AI — Codebase Guide

Maintainer-oriented map of this repository: where things live, how the layers relate, what is frozen, and how to verify a change. For the conceptual architecture, read [Architecture](architecture.md) and the [Trust Model](architecture/trust-model.md) first.

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); sequence/index/version fields are JSON integers, never floats. Violations are product defects, not style choices.

---

## Repository map

```text
contracts/          Normative public surface — versioned, FROZEN, conformance-pinned
  ├─ *.md                    contract definitions (mission-protocol, candidate, receipt,
  │                          gate, ledger, recovery, brand-system, connector-adapter, projection)
  ├─ receipt-schema/         JSON schemas + canonical vectors for receipts
  └─ __tests__/              conformance suites that fail CI on drift

cmd/                Thin CLI adapters: parsing, ajv validation, output, file stores
agents/             Deterministic intent handlers + registry — stages work only,
                    never executes and never performs fiscal approval
missions/           Mission protocol + MissionRuntime (15-state lifecycle, idempotency,
                    events, error taxonomy)
candidates/         Candidate identity and materiality (content-derived)
review/             Proportional review lenses + workload forecasting (R0–R3)
receipts/           Receipt schemas, canonicalization, Ed25519 verification
ledger/             Append-only audit ledger core (hash chain)
gates/              Lifecycle gates (mission-state, receipt, approval) — fail closed
recovery/           Crash-safe recovery: decide-by-evidence, idempotent replay
tenant-core/        RUC/company/period scope primitives
tenant-isolation/   Tenant isolation enforcement for queries and mutations

mcp/                MCP server surface (capabilities, tools)
configurator/       Installer/configurator surface (drenyra-ai install / doctor / sync)
skills/             Runtime skills module: registry, pinning, signature, PE base skills

fiscal/  journal/  ledger/  cdr/  bank-reconciliation/  close-calculations/
annual-declaration/  authorization/  evidence/  flow/  guardian/  policy/
projection/  routing/  security/  adapters/
                    Domain service modules consumed through library subpaths

scripts/            Build, conformance, and release tooling (build.mjs, sbom.mjs,
                    checksums.mjs, verify-*.mjs, brand-*.mjs, skills-conformance.mjs)
docs/               Architecture series, design series, runbooks, sdds
openspec/           OpenSpec changes + the Drenyra Dominion program (master SDD)
```

Each library subsystem ships a `package.json` subpath export (`./missions`, `./receipts`, …) through `dist/` — the package is ESM, Node >= 22, `node:crypto` only in library modules.

---

## Layering (who may import whom)

The normative [Dependency Rules](architecture/dependency-rules.md) document this in full; the short version:

```text
contracts/            normative, versioned, transport-agnostic
    ▼
receipts/ ledger/ missions/ candidates/ review/ gates/ recovery/
    │                 library modules — zero runtime dependencies (node:crypto only)
    ▼
agents/               orchestration over missions/ — staging only
    ▼
cmd/                  thin adapters: parsing, output, file stores
```

Rules that matter every day:

1. **Contracts are normative.** Library modules implement `contracts/*.md` + schemas; frozen conformance vectors are the source of truth for correctness.
2. **Library modules are dependency-free.** `receipts/`, `ledger/`, `missions/`, `candidates/`, `review/` use only `node:crypto`. No cross-module coupling beyond the documented re-exports (`ReceiptType`, `EvidenceItem` live in `receipts/`).
3. **`agents/` never becomes authority.** It imports `missions/` only; the Core never imports `agents/`.
4. **`cmd/` is an adapter layer.** Business policy never lives in the CLI.
5. **No reverse imports.** `cmd/` imports library modules; library modules never import `cmd/`.
6. **`contracts/` is read-only at runtime.** Schemas load from the package root; nothing writes there.
7. **Ecosystem direction.** This package never depends on Drenyra, Drenyra Pi, or Drenyra Engram. Memory informs; it never authorizes.

---

## Where a change goes

| Kind of change | Lands in | Also update |
| --- | --- | --- |
| Behavioral (receipts, ledger, missions, gates, recovery) | the subsystem module + its `__tests__/` | docs-as-code, CHANGELOG |
| Crypto / deterministic behavior | the subsystem module + `contracts/` conformance vectors | vectors in lockstep, contract doc if the shape changed |
| Contract surface | `contracts/*.md` + schemas | version bump, migration path, explicit approval ([contract regime](../contracts/README.md)) |
| CLI surface | `cmd/` + `cmd/__tests__/` | `docs/usage.md`, CHANGELOG |
| MCP surface | `mcp/` + `mcp/__tests__/` | shared capability declarations (`cmd/` + `mcp/` must agree) |
| Docs | `docs/` | the documentation index in README |
| CI / release tooling | `.github/workflows/ci.yml`, `scripts/` | `RELEASING.md` if the release pipeline changed |

Frozen `openspec/changes/*` paths are user-owned WIP — never edit them without explicit authorization.

---

## Money, scope, and safety invariants

These are checked by the review gate and by the [fiscal review lenses](../AGENTS.md#skills). A change is **not done** until all hold:

- **Money is BigInt cents.** No `Number`, no float arithmetic, no implicit rounding. `Money` model or whole-number cents.
- **RUC/period scope on every query and mutation.** `tenant-core/` primitives are the only sanctioned way to scope. Cross-RUC access is a defect (`CROSS_RUC_ACCESS`).
- **Every material action produces a receipt.** No receipt, no mutation. Receipt verification is fail-closed on missing signer material.
- **Ledger is append-only.** Commits are atomic accounting changes; `ledger validate` must pass with a first-divergence report on corruption.
- **Gates fail closed.** `GateRunner` returns `needs_input` envelopes; approval tiers R2 single / R3 dual; terminal states are guarded.
- **Recovery decides by evidence, never transcript.** Human-wait states are never auto-recovered by the default policy.

---

## Testing and verification

Full strategy: [Deterministic Testing](testing-deterministic.md). The short checklist:

```bash
bun run typecheck            # tsc --noEmit
bun run lint                 # biome lint
bun run test                 # vitest full suite
bun run brand:conformance    # brand contract drift → fail
bun run skills:conformance   # skills registry drift → fail (needs drenyra-skills manifest)
bun run verify:package       # build + tests + release artifacts + file manifest
node scripts/verify-packed-install.mjs   # prove the packed artifact works
```

Markdown: `npx markdownlint-cli2 <changed-file>` (project config in `.markdownlint-cli2.jsonc`; line length, inline HTML, banners, and table-pipe style are project conventions, the rest of the rules are enforced).

Known debt: the repository does not yet pass a full-repo markdownlint run (mostly `openspec/` historical files). Fix only the files you touch; keep the config minimal and honest.

---

## Conventions

- **Conventional Commits**, no AI attribution. `feat|fix|docs|refactor|test|chore|ci|build|style|perf|revert(scope): message`.
- **Errors are typed.** The mission protocol defines a 30-code error taxonomy; surface errors as `MissionError`-style typed failures, never silent `console.log`.
- **JSON over stdout, human summary over stderr** in the CLI. Exit codes: `0` success, `1` business error (JSON to stdout), `2` usage/IO.
- **Fail closed on ambiguity.** Missing evidence, scope, or authority is surfaced, never guessed through.

---

## Read next

- [Deterministic Testing](testing-deterministic.md) — canonical vectors, conformance, TDD
- [Architecture](architecture.md) — full index of the architecture series
- [Intended Usage](intended-usage.md) — the frontier and the responsibility split
- [CONTRIBUTING](../CONTRIBUTING.md) — the contribution workflow
