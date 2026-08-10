# Drenyra AI — Roadmap

> [!NOTE]
> **Last updated:** 2026-08-10. Status: released (all six contracts frozen), repository public.

<!-- -->

> [!IMPORTANT]
> **The frontier:** Drenyra AI is not "an agent that does accounting." It is the infrastructure that lets any agent participate in accounting processes without becoming the fiscal authority. See [Intended Usage](docs/intended-usage.md).

## At a glance

| Phase | Focus | Status |
| --- | --- | --- |
| Phase 0 — Identity | Repository identity scaffolding + contract draft | COMPLETE |
| Phase 1 — Contracts (v0.1) | Freeze all six contracts | COMPLETE |
| Phase 2 — Vertical slices from Drenyra | Slice-by-slice extraction via vertical PRs | COMPLETE |
| Phase 2b — Release hardening | Package integrity, CLI boundaries, CI | COMPLETE |
| Phase 2c — Hybrid orchestration layer | Deterministic agent orchestration (`agents/`) | Current |
| Phase 3 — Ecosystem maturity | Configurator, runtime, and control plane | In progress |
| Phase 4 — v1.0 | Three independent consumers on the released contracts | Not started |

## Phase 0 — Identity — COMPLETE

- [x] Repository created with identity scaffolding (README, LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS)
- [x] Contract index drafted (`contracts/`)
- [x] Contract review and freeze: mission-protocol, candidate, receipt, gate
- [x] Public roadmap and architecture published (repository public as of 2026-08-10)

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

## Phase 2 — Vertical slices from Drenyra — COMPLETE

> [!NOTE]
> Extracted via vertical PRs and versioned releases — **not** a bulk move.

- [x] Slice 1: receipt verification + ledger CLI (`drenyra-ai receipt verify`, `drenyra-ai ledger validate`)
- [x] Slice 2: mission protocol + MissionRuntime (`missions/` port + in-process runtime, CLI `mission start|apply|status`)
- [x] Slice 3: candidate identity + review lenses (`candidates/` + `review/`, CLI `candidate inspect|verify`)
- [x] Slice 4: recovery contracts + gates

## Phase 2b — Release hardening — COMPLETE

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

## Phase 3 — Ecosystem maturity (current)

The gap between a released RDA core and a distributable ecosystem. Gentle-AI is distributable; Drenyra AI reaches the same position when a professional can run:

```bash
drenyra-ai install
drenyra-ai doctor
drenyra-ai mission start monthly-close
drenyra-ai candidate inspect correction.json
drenyra-ai gate check posting.json
drenyra-ai receipt verify receipt.json
drenyra-ai ledger validate ledger.json
```

- [ ] **Adoption:** Drenyra consumes the first released version instead of its internal implementation
- [ ] **Public API:** expose `agents/` as a package subpath (moved from Phase 2c)
- [ ] **MCP server** — agents reach missions, candidates, receipts, and gates over MCP
- [ ] **Agent integrations** — Codex, Claude Code, OpenCode
- [ ] **Configurator experience** — `drenyra-ai install`, `doctor`, `sync`, `upgrade`, rollback
- [ ] **Drenyra Skills** — versioned accounting, tax, and operational knowledge
- [ ] **Drenyra Guardian Angel** — independent, adversarial, continuous verification
- [ ] Multi-jurisdiction policies (Perú → LATAM)
- [ ] External ERP/SaaS adoption documentation

## Phase 4 — v1.0

- [ ] **Flagship flow:** monthly accounting and tax close as the v1.0 headline workflow (mission → candidates → gates → receipts → ledger) — see [Design 02 — Monthly Close](docs/design/design-02-monthly-close.md)
- [ ] **Delivery architecture:** headless core consumed by Drenyra Command Center (library / CLI / MCP) — see [Intended Usage](docs/intended-usage.md)
- [ ] v1.0 candidate when **three independent consumers** run on the released contracts — full gate: [Design 05 — Testing, Releases, v1.0](docs/design/design-05-testing-releases-v1.md)
- [ ] Community and contributory roadmap

## Frontier (what Drenyra AI is not)

- Not an agent that does accounting — infrastructure that lets agents participate without becoming the fiscal authority
- Not the ERP, the UI, the ledger of record, or the primary interface
- No privileged access to SUNAT, banks, or ERPs — adapters and evidence only
- No marketplace or skill registry until `drenyra-skills` has >20 skills and independent consumers (deferred)
- No cloud offering (deferred to `arkelythex/drenyra-cloud`)

## Next steps

- Understand the frontier and responsibility split → [Intended Usage](docs/intended-usage.md)
- See what shipped in each release → [CHANGELOG.md](CHANGELOG.md)
- Understand the release process → [RELEASING.md](RELEASING.md)
- Contribute → [CONTRIBUTING.md](CONTRIBUTING.md)
- Read the full project overview → [README.md](README.md)
