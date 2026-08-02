# Drenyra AI — Roadmap

> **Last updated:** 2026-08-01. Status: pre-alpha.

## Phase 0 — Identity (current)

- [x] Repository created with identity scaffolding (README, LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS)
- [x] Contract index drafted (`contracts/`)
- [ ] Contract review and freeze: mission-protocol, candidate, receipt, gate
- [ ] Public roadmap and architecture published

## Phase 1 — Contracts (v0.1)

- [ ] Freeze `mission-protocol` v0.1 (states, commands, events, errors, versioning)
- [ ] Freeze `candidate` v0.1 (identity, materiality, review proportionality)
- [ ] Freeze `receipt` v0.1 (schema, Ed25519 verification, canonical vectors)
- [ ] Freeze `gate` v0.1 (authority, validation, delivery)
- [ ] Contract conformance test suite (golden files)

## Phase 2 — Vertical slices from Drenyra

Extracted via vertical PRs and versioned releases, **not** a bulk move:

- [x] Slice 1: receipt verification + ledger CLI (`drenyra-ai receipt verify`, `drenyra-ai ledger validate`)
- [x] Slice 2: mission protocol + MissionRuntime (`missions/` port + in-process runtime, CLI `mission start|apply|status`)
- [x] Slice 3: candidate identity + review lenses (`candidates/` + `review/`, CLI `candidate inspect|verify`)
- [ ] Slice 2: mission protocol + `MissionRuntime`
- [ ] Slice 3: candidate identity + review lenses
- [ ] Slice 4: recovery contracts + gates
- [ ] Drenyra consumes the first released version instead of its internal implementation

## Phase 3 — Ecosystem maturity (alpha → beta)

- [ ] MCP server
- [ ] Integrations for Codex, Claude Code, OpenCode
- [ ] Multi-jurisdiction policies (Perú → LATAM)
- [ ] External ERP/SaaS adoption documentation
- [ ] v1.0 candidate when three independent consumers run on the released contracts

## Non-goals (for now)

- Marketplace or skill registry (deferred to `arkelythex/drenyra-skills` when >20 skills and independent consumers exist)
- Cloud offering (deferred to `arkelythex/drenyra-cloud`)
