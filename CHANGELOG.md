# Changelog

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

All notable changes to Drenyra AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the version policy in [RELEASING.md](RELEASING.md).

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
