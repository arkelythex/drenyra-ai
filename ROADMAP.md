# Drenyra AI — Roadmap

> [!NOTE]
> **Last updated:** 2026-08-08. Status: released (all contracts frozen).

## At a glance

| Phase | Focus | Status |
| --- | --- | --- |
| Phase 0 — Identity | Repository identity scaffolding + contract draft | Current |
| Phase 1 — Contracts (v0.1) | Freeze all six contracts | COMPLETE |
| Phase 2 — Vertical slices from Drenyra | Slice-by-slice extraction via vertical PRs | In progress |
| Phase 2b — Release hardening | Package integrity, CLI boundaries, CI | Completed |
| Phase 2c — Hybrid orchestration layer | Deterministic agent orchestration (`agents/`) | Current |
| Phase 3 — Ecosystem maturity | Alpha → beta | Not started |

## Phase 0 — Identity (current)

- [x] Repository created with identity scaffolding (README, LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS)
- [x] Contract index drafted (`contracts/`)
- [ ] Contract review and freeze: mission-protocol, candidate, receipt, gate
- [ ] Public roadmap and architecture published

## Phase 1 — Contracts (v0.1) — COMPLETE

- [x] Freeze `mission-protocol` v0.1 (states, commands, events, errors, versioning) — conformance suite `contracts/__tests__/mission-protocol-conformance.test.ts`
- [x] Freeze `candidate` v0.1 (identity, materiality, review proportionality) — `candidate-conformance.test.ts`
- [x] Freeze `receipt` v0.1 (schema, Ed25519 verification, canonical vectors) — frozen vectors + `receipt-conformance.test.ts`
- [x] Freeze `gate` v0.1 (authority, validation, delivery) — `gate-conformance.test.ts`
- [x] Contract conformance test suite (golden files) — 77 conformance tests, run in CI, fail on drift
- [x] Released as **0.1.0** (first frozen-contract release)
- [x] Freeze `ledger` v0.1 — `ledger-conformance.test.ts` (29 tests)
- [x] Freeze `recovery` v0.1 — `recovery-conformance.test.ts` (26 tests)
- [x] Released as **0.2.0** — **all six contracts FROZEN** (Phase 1 COMPLETE)

## Phase 2 — Vertical slices from Drenyra

> [!NOTE]
> Extracted via vertical PRs and versioned releases — **not** a bulk move.

- [x] Slice 1: receipt verification + ledger CLI (`drenyra-ai receipt verify`, `drenyra-ai ledger validate`)
- [x] Slice 2: mission protocol + MissionRuntime (`missions/` port + in-process runtime, CLI `mission start|apply|status`)
- [x] Slice 3: candidate identity + review lenses (`candidates/` + `review/`, CLI `candidate inspect|verify`)
- [x] Slice 4: recovery contracts + gates
- [ ] Drenyra consumes the first released version instead of its internal implementation

## Phase 2b — Release hardening (completed)

- [x] Package integrity: build to `dist/`, Node >= 22 ESM artifact, complete `files` manifest, subpath `exports`, `prepack` verification
- [x] Packed-artifact test: npm pack → install .tgz → run bin under plain Node → resolve library entry
- [x] CLI boundaries: split commands/output/adapters, ajv schema validation, atomic JSON-file store (development adapter)
- [x] Intent-handler policy: real deterministic agent handlers registered by default (agents/); `--demo` retained as a compatibility no-op
- [x] RDA terminology unified; roadmap deduplicated; version policy `0.0.1-prealpha.x`
- [x] CI (typecheck + test + packed-package) and governance docs in all three technical repos

## Phase 2c — Hybrid orchestration layer (current)

- [x] `agents/` orchestration: deterministic `IntentHandler` per mission intent (monthly-close, correction, reconciliation, invoice-review, compliance-check) — stages work only
- [x] Agent registry composition (`createAgentRegistry`) wired into `mission apply`; demo-only handler gate removed
- [x] Focused tests for handlers, registry, and the CLI gated lifecycle
- [ ] Expose `agents/` as a package subpath (next slice, version bump)
- [ ] Multi-jurisdiction policy integration (Perú → LATAM)

## Phase 3 — Ecosystem maturity (alpha → beta)

- [ ] MCP server
- [ ] Integrations for Codex, Claude Code, OpenCode
- [ ] Multi-jurisdiction policies (Perú → LATAM)
- [ ] External ERP/SaaS adoption documentation
- [ ] v1.0 candidate when three independent consumers run on the released contracts

## Non-goals (for now)

- Marketplace or skill registry (deferred to `arkelythex/drenyra-skills` when >20 skills and independent consumers exist)
- Cloud offering (deferred to `arkelythex/drenyra-cloud`)

## Next steps

- See what shipped in each release → [CHANGELOG.md](CHANGELOG.md)
- Understand the release process → [RELEASING.md](RELEASING.md)
- Contribute → [CONTRIBUTING.md](CONTRIBUTING.md)
- Read the full project overview → [README.md](README.md)
