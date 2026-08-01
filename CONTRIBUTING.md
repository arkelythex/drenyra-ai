# Contributing to Drenyra AI

**Status: pre-alpha.** Drenyra AI is extracted from `arkelythex/Drenyra` through vertical slices. The maintainer (Arkelythex) drives the extraction; external contributions are welcome only after the contracts in `contracts/` stabilize.

## Ground rules

- **Fiscal correctness is a product safety requirement.** Never break receipts, ledger integrity, gates, or audit trails.
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
