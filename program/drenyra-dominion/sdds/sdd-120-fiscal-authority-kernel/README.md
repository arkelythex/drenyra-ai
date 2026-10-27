# SDD-120 — Deterministic Fiscal Authority Kernel

> Status: lifecycle:planned · Wave: 5 · Depends on: SDD-010, SDD-040 · Feeds: SDD-130, SDD-140, SDD-150

## Capability boundary

Plan the deterministic Peru v1 authority kernel that binds tenant/RUC/period scope, canonical evidence, accounting-journal ownership, policy evaluation, and candidate ordering. The accounting journal owns entries; `ledger/` remains append-only and audit-only. Memory informs but never satisfies evidence or authorization.

## Required outcome

- Deterministic library authority remains below advisory agents and transport adapters.
- Money remains BigInt cents; policy and sequence/version fields fail closed.
- Candidate freeze occurs only after scope, evidence, policy, journal, and reconciliation checks.

## Non-claims

Catalog presence does not claim implementation maturity, alter frozen contracts, settle the ledger governance decision, or transfer fiscal/business decisions from humans.
