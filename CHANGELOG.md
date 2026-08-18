# Changelog

<!-- markdownlint-disable MD024 -->

> [!NOTE]
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

All notable changes to Drenyra AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the version policy in [RELEASING.md](RELEASING.md).

## [Unreleased]

## [0.5.0] - 2026-08-17

### Added — SDD-CON-001/002 engines + vertical wiring + authorization enforcement (PR #64)

- **`bank-reconciliation/`** (SDD-CON-001): deterministic bank-vs-ledger reconciliation engine — canonical normalization, reference-first matching with bounded amount+same-day fallback, fail-closed adjustment drafts, executive report with reconciled identity check. Skill `pe.conciliacion-bancaria`. 65 tests.
- **`close-calculations/`** (SDD-CON-002): deterministic monthly-close calculation engine — fixed-asset depreciation (LIR-validated policy rates), provisions, provisional ISR (LIR Art. 85 coefficient vs 1.5% floor), closing entries to PCGE 59, post-close report with trial-balance identity. Skills `pe.depreciacion-activo-fijo`, `pe.provision-cartera`, `pe.isr-mensual`, `pe.cierre-resultados`. 63 tests.
- **`flow/close-wiring.ts`**: wires both engines into the monthly-close vertical — `MonthlyCloseInput` gains optional `bankRows`/`ledgerRows`/`closeInputs`; the vertical now generates candidates FROM engine output (external-first merge, wiring risks surfaced). 30 tests.
- **`gates/authorization.ts`** (SDD-060): `AuthorizationGate` wires the standalone `authorize()` RBAC engine into the approval pipeline — ApprovalGate quantity passthrough + per-approver `close:approve` at exact tenant scope; fail-closed `needs_input` on missing evidence. `GateName` includes `"authorization"`. 27 tests.
- **PE skills registry** grows 7 → 11; sibling `drenyra-skills/skills/registry.json` synced; `skills:conformance` PASS.
- **Program records reconciled**: SDD-050 and SDD-060 records now reflect the implemented surface; Dominion capability matrix refreshed (drenyra-ai rows + `tests.current` 1390).

### Added — audit coverage gate + structured audit log + release provenance

- **`cmd/output/audit.ts`**: zero-dependency structured audit log (JSONL to stderr or `DRENYRA_AUDIT_LOG=<path>`, level filter `DRENYRA_AUDIT_LEVEL`) with mandatory fail-closed tenant fields `mission_id`/`ruc`/`period`/`user_id`; `ruc` derived from an eleven-digit `company_id` (`inferRuc`). Wired into `mission start/apply/status` (`mission.started`, `mission.applied`, `mission.apply_failed`, `mission.status_read`, `mission.status_not_found`). 11 tests.
- **Coverage gate**: `@vitest/coverage-v8` (v4) with global thresholds statements 80 / branches 75 / functions 80 / lines 80; CI job `coverage` fails on any miss. Baseline measured at commit `0066847`: 85.4/79.1/89/86.9.
- **Release provenance**: `.github/workflows/release.yml` publishes tags with npm Sigstore provenance (`npm publish --provenance`, OIDC `id-token: write`); `repository` + `publishConfig.provenance` added to `package.json`. Consumers verify with `npm audit signatures`.

### Fixed — review follow-ups + program record sync

- **`cmd/output/audit.ts` + `cmd/output/__tests__/audit.test.ts`**: converted tab indentation to the repository's 2-space convention (whitespace-only); audit suite now 12 tests (incl. fail-open sink regression).
- **`.github/workflows/release.yml`**: re-indented to 2-space YAML matching `ci.yml`; `workflow_dispatch` now guarded — manual dispatch publishes only from `main` with an explicit confirmation input, never arbitrary branch state.
- **Dominion capability matrix**: `tests.current` synced to 1483 (fresh run at `948f1a2`, 111 files, exit 0; coverage gate green 85.44/79.07/89.2/86.92).

## [0.4.1] - 2026-08-15

### Fixed

- `routing/` and `configurator/` modules were shipped in `dist/` but NOT reachable via the package exports map or the root barrel (deep imports failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`). Added the `./routing` and `./configurator` subpaths, re-exported both from the root entry, and added `configurator/index.ts`. Verified CJS + ESM deep imports resolve `route()` and `runConfigDiagnostics`/`PINNED_AI_COMPOSITION`.

## [0.4.0] - 2026-08-15

### Added — configurator host integration (SDD-020 slice 2)

- Per-host pinned runtime/model/tool (`PinnedComposition` on the managed manifest, package-local `PINNED_AI_COMPOSITION` constants); `install`/`sync` render the per-host pin asset (`.drenyra-pinned-ai-runtime.json`) with exact-byte ownership; foreign pin files preserved byte-for-byte and classified as a distinct unmanaged state.
- Doctor `pinned-ai-runtime` diagnostic (managed/foreign/drift/absent); pre-pin manifests fail closed.
- `drenyra-pi` host added (canonical dir `~/.drenyra`); the four-host E2E (`install → doctor → sync → upgrade → rollback`) across codex, claude-code, opencode, drenyra-pi.

### Added — routing preflight router (SDD-030 slice C)

- `routing/router.ts`: deterministic `route(request)` over the §5 criteria — closed `RouteRequest` (fiscal scope + eight axes), fail-closed `AMBIGUOUS_INPUT`, escalation-only precedence (durable-mission → specialized-agent → direct-analysis), literal authority ceilings (no-mutation / proposes-only / through-core). Propose-only; no execution/materialization/persistence.

### Verification

- Suite 915/915; typecheck and build clean; SBOM + checksums attached.

## [0.3.0] - 2026-08-15

### Added — configurator (SDD-020 slice 1)

- `upgrade run <version>` and `rollback run` commands with idempotent, fail-closed managed-composition transitions (`configurator/managed-config.ts`); never installs host binaries; preserves foreign configuration byte-for-byte.
- Doctor diagnostics depth: managed-config drift, package-pin mismatch, missing host prerequisites, malformed manifests (`{status, checks, readonly}` report).
- `install`/`sync` delegate to the managed-config library; composition record added on new installs; legacy manifests remain readable.

### Added — routing (SDD-030 slice A+B)

- `routing/` module: immutable `WorkUnit`/`WorkResult` typed surfaces with fail-closed helpers — type-only Core boundaries, branded `JsonInteger`/`Sha256Hash`, 9-kind typed stop reasons, injected canonical transition validation, candidate refs by subjectHash, BigInt cents.
- `routing/` added to the tsconfig include lists.

### Added — program (Ola 0-1)

- Dominion program record reconciled (five-axis status vocabulary, evidence register, Gate 0 completed with SDD-020 permitted); RDA v2 core and monthly-close core closed; fiscal-authority kernel archived.

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
