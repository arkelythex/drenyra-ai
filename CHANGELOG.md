# Changelog

<!-- markdownlint-disable MD024 -->

> [!NOTE]
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

All notable changes to Drenyra AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the version policy in [RELEASING.md](RELEASING.md).

## [Unreleased]

### Added — design series (docs)

- **Design 01 — Ecosystem Frontier and Authority** (`docs/design/design-01-ecosystem-frontier-and-authority.md`) — approved frontier: per-component responsibilities with explicit never-musts, the 8-step chain of authority, and the dependency rule (consumers use published versions; no consumer turns a Core rejection into an approval).
- **Design 02 — Monthly Accounting and Tax Close** (`docs/design/design-02-monthly-close.md`) — the v1.0 flagship flow: preflight → evidence → reconciliation → candidates → proportional review → external confirmation → close package, plus the safe-recovery table.
- **Design 03 — Agents, Skills, and Integrations** (`docs/design/design-03-agents-skills-integrations.md`) — AI proposes, deterministic code decides; the 7 initial agents, the 3 skill layers, the v1.0 integration order, and provider-agnostic model selection.
- **Design 04 — Persistence, Security, and Recovery** (`docs/design/design-04-persistence-security-recovery.md`) — the 6-store model, the authoritative data model, evidence as untrusted input, idempotency/concurrency, the UNKNOWN-state reconciliation flow, the 9-class error taxonomy, and the security controls.
- **Design 05 — Testing, Releases, and the v1.0 Definition** (`docs/design/design-05-testing-releases-v1.md`) — the 10-layer test strategy, the 13 mandatory scenarios, the immutable-artifact release pipeline, the maturity stages, the 14 mandatory v1.0 criteria, and the 7 measurable invariants.
- **Intended Usage** (`docs/intended-usage.md`) — the frozen frontier: definition, institutional thesis, golden rule, the philosophy translation table, the stricter fiscal controls, and the frozen delivery architecture (headless core + Command Center as interface).
- README, ROADMAP, and CONTRIBUTING updated to reflect the frontier and current state (2026-08-10).

### Added — brand-system contract (DRAFT)

- **Brand-system contract** (`contracts/brand-system.md`, `contracts/brand-system/tokens.json`) — the single source of truth for the Drenyra ecosystem visual identity, mirroring the apps/web DTCG token pipeline exactly: dark + light themes and the cyan/violet accent system, typography (Space Grotesk / Inter / Geist Mono), vector-vs-AI asset rules, and the AI image generation rules (palette-only, no critical text, C2PA provenance).
- **Conformance checker** (`scripts/brand-conformance.mjs`) — zero-dependency verification: palette shape (both themes + both accents), SVG zero-tolerance scan that resolves `var(--…)` declarations from `<style>` blocks (dual-theme banners), built-in PNG decoder with even-spread sampling and palette-coverage gating. Wired into CI (`brand-conformance` job) and `bun run brand:conformance`.
- **Conformance suite** (`contracts/__tests__/brand-conformance.test.ts`) — 8 tests pinning palette shape, the dual-theme banner, banned-legacy rejection, off-palette `var()` rejection, structural SVG values, and PNG coverage.
- **Banner migrated** — `docs/assets/brand/drenyra-ai-banner.svg` rebuilt on the canonical cyan/violet palette with dual-theme rendering via `@media (prefers-color-scheme: light)` (the v0.1 blue palette is banned).

## 0.2.0 — 2026-08-02

### Added — all six contracts FROZEN

| Contract | Pinned by | Coverage |
| --- | --- | --- |
| `ledger` frozen at v0.1 | `contracts/__tests__/ledger-conformance.test.ts` (29 tests) | all 9 validation rules (positive + negative), validation-result shape with first-divergence, manifest shape, append-only guarantee, and fail-closed on missing signer material (undefined signature now yields a violation, never a TypeError) |
| `recovery` frozen at v0.1 | `contracts/__tests__/recovery-conformance.test.ts` (26 tests) | per-state recovery actions, decide-by-evidence, event-log replay, idempotent recovery. Doc scoped: human-wait states are never auto-recovered **by the default policy** (`DEFAULT_RECOVERABLE = [RUNNING]`); explicit caller policies may include other states |

### Notes

- `0.2.0` is a backward-compatible MINOR: the frozen surface grows (ledger + recovery become normative); nothing existing breaks. Changes to a frozen contract now require a major version bump.
- `dist/cmd/cli.js` checksum unchanged from 0.1.0 (`e4e81914…`) — deterministic build.

## 0.1.0 — 2026-08-02

### Added — first FROZEN contracts

- **Contracts frozen at v0.1**: `mission-protocol`, `candidate`, `receipt`, `gate` — normative surface pinned by four conformance suites under `contracts/__tests__/` (77 tests) that run in CI and fail on drift.

| Conformance suite | Tests | Coverage |
| --- | --- | --- |
| `mission-protocol-conformance` | 25 | 15 canonical states, full `VALID_TRANSITIONS` table, command union, 5 intents, 12 event types, versioning, idempotency, 30-code error taxonomy |
| `candidate-conformance` | 16 | content-derived identity, full materiality policy matrix (BigInt thresholds, jurisdiction escalation, R3 ceiling), lifecycle + one-correction budget, mutated-subject rejection |
| `receipt-conformance` | 16 | verification status chain precedence, result shape, canonical serialization, tamper detection (complements the frozen-vector drift-guard) |
| `gate-conformance` | 20 | approval tiers (R2 single / R3 dual distinct), receipt fail-closed, mission-state legality, runner fail-closed ordering |

- Corrected the `mission-protocol` contract prose to the real protocol surface (15 states incl. `RECOVERING`, 30 error codes, canonical commands/events/intents).

### Notes

- This is the first release that freezes contracts: `0.1.0`. Changes to the frozen normative surface require a major version bump.
- `ledger` and `recovery` contracts remain `0.1-draft`; they freeze in a future minor.

## 0.0.1-prealpha.1 — 2026-08-01

### Added

- Repository identity scaffolding: README, LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS, architecture and roadmap docs.
- Draft contract index (`contracts/`): mission-protocol, candidate, receipt, gate.
- **Slice 1 — Receipt verification + audit ledger:**
  - Receipt schemas and Ed25519 verification against canonical conformance vectors.
  - Append-only, verifiable audit ledger core.
  - CLI: `drenyra-ai receipt verify`, `drenyra-ai ledger validate`.
- **Slice 2 — Mission protocol:**
  - Mission lifecycle, commands, and events; in-process `MissionRuntime`.
  - CLI: `drenyra-ai mission start|apply|status`.
- **Slice 3 — Candidate identity + review:**
  - Accounting candidates as first-class artifacts with identity, scope, and materiality.
  - Proportional review lenses and evidence.
  - CLI: `drenyra-ai candidate inspect|verify`.
- **Slice 4 — Recovery + gates:**
  - `recovery/` — per-state recovery policy (RUNNING/RETRYING → recover; UNKNOWN → decide-by-evidence; WAITING_FOR_EVIDENCE/BLOCKED_BY_GATE → human-wait, never auto-recovered; terminal untouched) + event-log replay (resume from last persisted event, never transcript) + idempotent recovery.
  - `gates/` — ApprovalGate (R2 single, R3 dual distinct approvers), ReceiptGate (SIGNER_TRUSTED only, fail-closed), MissionStateGate (legal transitions + terminal guard), GateRunner (fail-closed, needs_input envelopes).
  - CLI: `drenyra-ai gate check` + `drenyra-ai mission recover`.
  - Contract: `contracts/recovery.md` (new) + `contracts/gate.md` reference section.
- **Release hardening:**
  - Package integrity: `tsc` build to `dist/`, Node >= 22 ESM artifact, complete `files` manifest (dist + contracts + fixtures), `engines`, subpath `exports`, `prepack` verification.
  - Packed-artifact verification: `verify-package-files.mjs` (dist tree + shebang + declarations) and `verify-packed-install.mjs` (npm pack → install .tgz → run bin under plain Node → resolve library entry).
  - CLI boundaries: split `cmd/cli.ts` into `cmd/commands/*`, `cmd/output/*`, `cmd/adapters/*`; ajv schema validation for `receipt verify` (schemas load from the package-root `contracts/`); atomic JSON-file mission store (temp + fsync + rename, `storeSchemaVersion: 1`, marked as a development adapter).
  - Intent-handler policy: the default CLI registers no handlers; `mission apply` execute without a handler fails with `INTENT_HANDLER_NOT_CONFIGURED`; `--demo` opts into the demo auto-advance handler.
  - Terminology: Receipt-Driven Accounting acronym unified to **RDA**.
  - CI: typecheck + test + packed-package verification on every push/PR.
  - Governance: docs/architecture/*, RELEASING.md, CHANGELOG.md, CODE_OF_CONDUCT.md, PR/issue templates, dependabot.

### Notes

- Pre-alpha: nothing is production-ready; contracts are not frozen.
- Version policy: `0.0.1-prealpha.x` until the first frozen contract, then `0.1.0`.
