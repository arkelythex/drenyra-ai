# Drenyra AI — Agent Guide

← [Back to README](README.md)

This file is for AI agents and their humans working in this repository. It answers: *what are the non-negotiable rules, what should I read first, and where do changes belong?*

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); sequence/index/version fields are JSON integers, never floats. Violations are product defects, not style choices.

## Non-Negotiable Rules

Every change — code, docs, tests, or CI — must respect these. They are also enforced by the review gate.

1. **No floats for money.** Money is whole-number cents (BigInt) or the Drenyra `Money` model. No monetary amount is ever a JavaScript `Number`.
2. **RUC scope is mandatory.** Every query and mutation verifies company/RUC/period isolation. Never access data across RUCs without explicit context.
3. **Nothing material happens without a receipt.** Every material action produces an immutable receipt. No receipt, no mutation.
4. **Contracts are frozen public surface.** `contracts/` is versioned, conformance-pinned, and consumed by external systems. Changing one requires a version bump, migration path, and explicit approval.
5. **Fiscal lifecycle order.** Follow the FSD discipline: captura → clasificacion → conciliacion → cierre → declaracion → auditoria. Phase transitions require gate validation.
6. **Audit trail.** Every material action is logged with RUC, period, timestamp, actor, and reason. Ledger entries are append-only.
7. **No `any`, no secrets.** Use precise types; never commit credentials, tokens, or customer data.
8. **No AI attribution.** Conventional Commits only. No `Co-Authored-By` or "Generated with" markers.

## Read Before Working

| Goal | Start here |
| --- | --- |
| Understand what the project is and is not | [Intended Usage](docs/intended-usage.md) |
| The frozen public surface | [Contracts](contracts/README.md) |
| Trust model and boundaries | [Trust Model](docs/architecture/trust-model.md) |
| Codebase layout and conventions | [Codebase Guide](docs/CODEBASE-GUIDE.md) |
| Testing strategy (deterministic, canonical vectors) | [Deterministic Testing](docs/testing-deterministic.md) |
| Contribution workflow | [CONTRIBUTING](CONTRIBUTING.md) |
| Contribution rules with AI assistance | [AI Policy](AI_POLICY.md) |

## Where Changes Belong

```text
contracts/          Normative public contracts — FROZEN, conformance-pinned
cmd/                CLI dispatcher and command adapters
agents/             Deterministic intent handlers (stage work only — never execute)
missions/           Mission protocol + MissionRuntime (lifecycle, idempotency, events)
candidates/         Candidate identity and materiality
review/             Proportional review lenses and workload forecasting
receipts/           Receipt schemas and verification
ledger/             Audit ledger core
gates/              Lifecycle gates
recovery/           Crash recovery and resumption
tenant-core/        RUC/company/period scope primitives
tenant-isolation/   Tenant isolation enforcement
docs/               Architecture, trust-model, and dependency documentation
program/            The Drenyra Dominion program master (charter, program SDDs, program-lock)
specs/              Requirements of record, one spec per capability
odd/tasks/          ODD feature documents (specs, tasks, log per feature)
```

- A **behavioral** change goes with its subsystem module, its tests, its conformance vectors (if crypto/contracts), and its docs — in the same PR (docs-as-code).
- A **contract** change goes through the [contract regime](contracts/README.md) first.
- A **mission or fiscal** change follows the [fiscal lifecycle](docs/design/design-01-ecosystem-frontier-and-authority.md) and is tracked as an ODD feature document under [`odd/tasks/`](odd/tasks/).
- A **cross-repository** change is recorded against the [Drenyra Dominion program](program/drenyra-dominion/README.md), and each repository tracks its own part in `odd/tasks/`.

## Delivery Workflow — ODD

Organic Driven Development is the only delivery workflow; it replaced SDD/OpenSpec ([`odd/tasks/sdd-to-odd-migration.md`](odd/tasks/sdd-to-odd-migration.md)).

1. **Authorize.** Investigate, explain, review, and plan are read-only; only explicit change intent authorizes writes.
2. **Explore** the code and the relevant [`specs/`](specs/) requirement first.
3. **Size.** Small work (understood, contained risk, resumable from the diff) runs inline. Large work, or any change to a frozen contract, the fiscal lifecycle order, a Ground Rule invariant, or a cross-repository surface, creates `odd/tasks/<feature>.md` before the first source write.
4. **Track.** A feature document has a header, `## Specs` (numbered `S#` quoting the request verbatim, with RFC 2119 keywords and Given/When/Then where behavior is specified), `## Tasks` (ID, linked `S#`, status, commit), and `## Log` (`L1` = the original request verbatim).
5. **Implement strict TDD**, task by task: RED, GREEN, refactor. Stay inside the 300 changed-line review budget, and chain PRs when a forecast exceeds it.
6. **Close** with the verified outcome, every failed or skipped check, and the next step.

Design rules carried over from the former OpenSpec config: respect the layer model (contracts → library modules → agents → cmd; no reverse imports; library modules stay `node:crypto`-only); money is BigInt cents and version/sequence numbers are JSON integers; make fail-closed behavior explicit and document decisions with rationale; map product changes to the 16-program Peru v1 roadmap and the approved architecture sections (AI advisory vs deterministic authority; audit ledger vs accounting journal; evidence vs memory).

Checks: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun x markdownlint-cli2 <changed-file>`.

## Skills

This project participates in the Drenyra Skills ecosystem: versioned, jurisdiction-scoped accounting and tax knowledge (PE). The runtime skills module lives in `skills/` (registry, pinning, signature, `pe.ts` base skills); the authoring source of truth is the [drenyra-skills](https://github.com/arkelythex/drenyra-skills) repository, pinned by the `skills:conformance` CI gate.

When working in this repository, load the relevant skill **before** writing code. The Drenyra-specific skills (fiscal compliance, fiscal review lenses, RUC scope, evidence citation, chain operation) are published through the Drenyra ecosystem and indexed in the local skill registry (`.atl/skill-registry.md` — auto-generated, run `/skill-registry:refresh` to regenerate). A code agent should resolve matching skills by task context and read the exact `SKILL.md` paths before work.

## Read next

- [Documentation standard](docs/documentation-standard.md) — reader-first writing and paired Dreamcoder visuals.
- [Codebase Guide](docs/CODEBASE-GUIDE.md) — subsystem ownership and verification.
