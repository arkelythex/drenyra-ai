# Contributing to Drenyra AI

> **Status: released core, ecosystem in progress.** Drenyra AI is extracted from `arkelythex/Drenyra` through vertical slices and the repository hosts a released RDA core with **all six contracts frozen** (`contracts/`, v0.1, pinned by CI conformance suites). External contributions are welcome; contract changes follow the frozen-contract regime below (major bump required). See the [frontier](docs/intended-usage.md) before contributing.

<!-- -->

> [!IMPORTANT]
> **Fiscal correctness is a product safety requirement.** Never break receipts, ledger integrity, gates, or audit trails — and never use floats for money.

## At a glance

- [Ground rules](#ground-rules)
- [Workflow](#workflow)
- [Contract changes](#contract-changes)
- [Getting help](#getting-help)

## Ground rules

- **No floats for money.** Money is whole-number cents (BigInt) or the Drenyra `Money` model.
- **Tenant/RUC scope is mandatory.** Every query and mutation verifies company/RUC isolation.
- **Every material action produces a receipt.** No receipt, no mutation.
- **No `any`.** Use precise types, `unknown`, or justified generics.
- **No secrets.** No credentials, tokens, or customer data in code, docs, or tests.

## Workflow

1. Create a dedicated branch (or isolated worktree for medium/large changes).
2. Keep `main` clean.
3. Prefer small, verifiable, reversible changes. Split changes over 400 lines into chained PRs.
4. Update docs in the same PR as code (docs-as-code). Stale docs are a bug.
5. Add tests for changed business logic — canonical vectors for anything receipt/ledger related.
6. Conventional commits only (no AI attribution).
7. The review gate rejects: silent error handling, production `console.log`, missing scope checks, missing tests for business logic, contract changes without docs.

## Contract changes

Any change to `contracts/` is a **public contract change**:

- Bump the affected contract version explicitly.
- Document the migration path.
- Keep verification and canonical vectors in lockstep.
- Get explicit approval — contracts are consumed by Drenyra, Drenyra Pi, ERPs, and other SaaS.

## Getting help

Open an issue with a clear description. For security issues, use Private Vulnerability Reporting — see [SECURITY.md](SECURITY.md).

## Next steps

- Report a vulnerability → [SECURITY.md](SECURITY.md)
- Read the release process → [RELEASING.md](RELEASING.md)
- See what is planned and what shipped → [ROADMAP.md](ROADMAP.md) and [CHANGELOG.md](CHANGELOG.md)
- Follow the ecosystem's conduct rules → [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
