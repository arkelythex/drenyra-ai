---

# SDD-020 — Universal Agent Configurator

> Status: lifecycle:complete (configurator core: install/doctor/sync/upgrade/rollback + per-host pinning + four-host integration + program-lock-aware install) · Maturity: implemented · Wave: 1 · Depends on: SDD-010 · Feeds: SDD-100
>
> **Slices 1-3 delivered 2026-08-15** (changes `sdd-020-configurator`, `sdd-020-host-integration`, `sdd-020-slice-c`; PRs #34/#35/#46/#47/#55/#56):
> `configurator/managed-config.ts` library (manifest classification, legacy
> hydration, SHA-256 assets, atomic plan/commit/rollback, diagnostics) + `upgrade
> run`/`rollback run` commands + doctor diagnostics depth (drift/pin/prereq) +
> install/sync delegation. Suite 798/798 green. Remaining (later slices): host
> integration (Codex/Claude/OpenCode/Pi), per-host pinned runtime/model/tool, and
> program-lock-aware install.

## Purpose

Configures and keeps every agent host on a verified, pinned ecosystem
composition. Delivers `install`, `doctor`, `sync`, `upgrade`, and `rollback`
commands plus host integration for Codex, Claude Code, OpenCode, and Drenyra Pi,
served primarily by `drenyra-pi` (capability `configurator-install-doctor-sync`
currently planned in the capability matrix).

## Scope

- CLI surface: `install`, `doctor`, `sync`, `upgrade`, `rollback`.
- Host integration: Codex, Claude Code, OpenCode, and Drenyra Pi.
- Pinned agent runtime, model, and tool versions per host (pinned-ai-runtime).
- Program-lock-aware installation — every host consumes the promoted artifact,
  never a copy of `main`.
- Doctor diagnostics: configuration drift, pin mismatch, missing prerequisites.
- Idempotent upgrade and rollback between pinned compositions.

## Non-goals

- No authorization decisions — Pi executes agents and tools but never authorizes
  fiscal operations (charter §2.2).
- No packaging of vertical capabilities; this is runtime configuration only.
- Does not modify program root documents or frozen contracts.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | provides — published candidates and `program-lock` to pin, release-train cadence |
| SDD-100 | consumes — configured, pinned hosts run the missions Command Center projects |

## Input/output contract

- Inputs: published candidates and `program-lock`; per-host manifests.
- Outputs: verified, pinned host configurations; doctor reports; reproducible
  host state through sync/upgrade/rollback.

## Threats

- Configuration drift across hosts producing divergent behavior.
- Unverifiable or un-pinned installs; hosts running a copy of `main`.
- Broken rollback leaving a mixed-version host.
- Host vendor changes (Codex/Claude/OpenCode) breaking the integration.

## Tests and metrics

- End-to-end install → doctor → sync → upgrade → rollback on all four hosts.
- Pin verification against `program-lock` after every operation.
- Idempotency tests: re-running a command produces no drift.
- Gate 0 must close before implementation begins (wave-1 readiness currently
  `pending` in the capability matrix).

## Rollback

- Revert to the previous pinned composition; a host never holds state outside
  the pinned `program-lock`.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
