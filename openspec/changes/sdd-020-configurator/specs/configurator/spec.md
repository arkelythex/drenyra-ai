# Configurator Specification

## Purpose

The configurator is the Drenyra AI managed agent-host configuration surface. It detects existing agent hosts (Codex, Claude Code, OpenCode), configures them with Drenyra-managed markers and assets, never installs host binaries, never overwrites foreign configuration, and never makes authorization decisions.

This first slice adds deterministic, idempotent `upgrade` and `rollback` transitions between recorded package-level compositions and deepens the read-only `doctor` diagnostics to cover managed-marker drift, recorded package-pin mismatch, and missing host prerequisites.

Host integration beyond existing detection and managed markers, per-host runtime/model/tool pinning (`pinned-ai-runtime`), and program-lock-aware installation are explicitly out of scope for this slice and are not specified here.

## Requirements

### Requirement: Upgrade Command Surface

The CLI MUST register an `upgrade` command in the same command dispatcher that registers `install`, `sync`, and `doctor`, and MUST list it in the CLI help output.

The `upgrade` command MUST transition the recorded package-level composition from its current composition to a requested composition by recording the current composition as the previous composition and applying the requested composition to Drenyra-managed state. When the requested composition equals the recorded current composition, `upgrade` MUST be idempotent: it MUST NOT modify managed state, MUST NOT re-record a redundant previous composition, MUST NOT alter any foreign file, and MUST exit 0 with a deterministic JSON report to stdout.

The `upgrade` command MUST preserve foreign (non-Drenyra) configuration files byte-for-byte: it MUST NOT create, modify, move, or delete any file outside the Drenyra-managed assets (the managed manifest, managed host markers, and managed skills asset), and it MUST NOT install, upgrade, remove, or replace any host binary. When a managed host marker has been foreign-modified, `upgrade` MUST NOT overwrite it; it MUST preserve the marker bytes and report the preservation, mirroring the existing `sync` behavior.

When the current managed state is unknown (the managed manifest is missing, unreadable, or malformed), `upgrade` MUST fail closed: it MUST exit 1 with a machine-readable JSON error following the CLI business-error convention (`cmd/output/errors.ts`), MUST NOT mutate any state, and MUST NOT leave mixed managed state.

The `upgrade` command MUST resolve the managed-state location with the same rule used by `install` and `sync` (`--home` override, else `$HOME`) so that it operates on the same managed state those commands read and write.

#### Scenario: Upgrade on a clean current state

- GIVEN a managed installation whose recorded current composition is `1.2.3` and a request to upgrade to `1.4.0`
- WHEN the `upgrade` command runs
- THEN the recorded current composition becomes `1.4.0`, the previous composition is recorded as `1.2.3`, managed assets reflect the requested composition, no foreign file is changed, and the command exits 0

#### Scenario: Upgrade is idempotent for the active composition

- GIVEN a managed installation whose recorded current composition is already `1.4.0`
- WHEN the `upgrade` command runs with a request for `1.4.0`
- THEN the managed state is unchanged, no previous composition is re-recorded, no foreign file is changed, and the command exits 0

#### Scenario: Upgrade fails closed on unknown current state

- GIVEN no readable Drenyra AI managed manifest
- WHEN the `upgrade` command runs
- THEN the command exits 1 with a machine-readable JSON error, and no managed state is created or modified

### Requirement: Rollback Command Surface

The CLI MUST register a `rollback` command in the same command dispatcher that registers `install`, `sync`, and `doctor`, and MUST list it in the CLI help output.

The `rollback` command MUST restore the recorded previous composition as the current composition. When the previous composition equals the current composition (the previous composition is already restored), `rollback` MUST be idempotent: it MUST NOT modify managed state and MUST exit 0 with a deterministic JSON report to stdout.

When no previous composition exists, `rollback` MUST fail closed: it MUST exit 1 with a machine-readable JSON error following the CLI business-error convention, MUST NOT mutate any state, and MUST NOT leave mixed managed state.

The `rollback` command MUST preserve foreign (non-Drenyra) configuration files byte-for-byte, MUST NOT overwrite foreign-modified managed markers, and MUST NOT install, upgrade, remove, or replace any host binary.

The `rollback` command MUST resolve the managed-state location with the same rule used by `install` and `sync` (`--home` override, else `$HOME`).

#### Scenario: Rollback restores the previous composition

- GIVEN a managed installation whose recorded current composition is `1.4.0` and whose recorded previous composition is `1.2.3`
- WHEN the `rollback` command runs
- THEN the recorded current composition becomes `1.2.3`, no foreign file is changed, and the command exits 0
- AND a subsequent `rollback` invocation exits 0 with the managed state unchanged

#### Scenario: Rollback fails closed when no previous composition exists

- GIVEN a managed installation with a recorded current composition and no recorded previous composition
- WHEN the `rollback` command runs
- THEN the command exits 1 with a machine-readable JSON error and the recorded current composition is unchanged

### Requirement: Doctor Diagnostics Depth

The `doctor` command MUST remain strictly read-only: it MUST NOT create, modify, or delete any file, marker, manifest, or host asset while performing the configuration diagnostics.

The `doctor` command MUST report managed configuration drift as a diagnostic: when a managed host marker or managed skills asset is present but its content differs from the content recorded in the managed manifest, the report MUST name the host and the affected asset and MUST NOT modify it.

The `doctor` command MUST report a recorded pin mismatch as a diagnostic: when the packaged Drenyra AI version differs from the package-level composition recorded in the managed state, the report MUST state both versions.

The `doctor` command MUST report missing host prerequisites as a diagnostic: for each host recorded in the managed manifest, when the host's configuration directory or expected managed asset is absent, the report MUST name the missing item and MUST NOT attempt to install it.

All diagnostics MUST be reported as findings in the existing JSON report shape (`{ status, checks, readonly: true }`) without claiming to fix the findings. The exit code MUST follow the existing doctor convention: 0 when all checks pass; 1 with the JSON report when any check, including drift, pin-mismatch, or missing-prerequisite checks, fails.

#### Scenario: Doctor detects managed configuration drift

- GIVEN a managed host whose `.drenyra-managed` marker content differs from the content recorded in the managed manifest
- WHEN the `doctor` command runs
- THEN the JSON report includes a drift diagnostic naming the host, the marker bytes remain unchanged, and the command exits 1

#### Scenario: Doctor detects a recorded pin mismatch

- GIVEN managed state whose recorded package-level composition is `1.2.3` while the packaged Drenyra AI version is `1.4.0`
- WHEN the `doctor` command runs
- THEN the JSON report includes a pin-mismatch diagnostic stating both versions and the command exits 1

#### Scenario: Doctor reports a missing host prerequisite without installing it

- GIVEN a managed manifest recording a host whose configuration directory is absent
- WHEN the `doctor` command runs
- THEN the JSON report includes a missing-prerequisite diagnostic naming the host and no installation or modification occurs

### Requirement: Composition Record

The managed state MUST include a composition record holding the current package-level composition and the previous package-level composition, persisted in or alongside the existing managed manifest (`~/.drenyra/managed.json`). The `upgrade` and `rollback` commands MUST read and write this record; the `doctor` configuration diagnostics MUST read it.

All sequence, index, and ordering numbers in the composition record MUST be JSON integers; no field MUST be a JSON floating-point number. Composition versions are semantic-version strings and MUST NOT be represented as numbers.

The composition record MUST NOT touch the six frozen contracts under `contracts/` and MUST NOT create, modify, or delete any program-root document. Money is never involved: no monetary value MUST be read, written, or computed by composition transitions or configuration diagnostics.

A transition MUST validate the staged managed state before replacing the current record. On any failure, the command MUST fail closed and retain the prior valid managed state; the record MUST never be left in mixed state.

Managed manifests created before this slice, which lack the composition record, MUST remain readable by `install`, `sync`, and `doctor`; the first `upgrade` on such a manifest MUST derive the initial current composition from the existing manifest content without corrupting it.

#### Scenario: Upgrade then rollback restores the recorded composition

- GIVEN managed state whose recorded current composition is `1.2.3`
- WHEN `upgrade` to `1.4.0` runs and then `rollback` runs
- THEN the recorded current composition is `1.2.3` again and every version field in the record is a semantic-version string with no floating-point numbers

#### Scenario: Composition transitions never touch frozen contracts or program-root documents

- GIVEN a managed installation with frozen contracts present under `contracts/` and program-root documents present
- WHEN `upgrade` and then `rollback` run
- THEN the byte content of every frozen contract and program-root document is unchanged

### Requirement: Layer and Boundary Compliance

The deterministic composition-transition and configuration-diagnostic logic MUST live in library modules below `cmd/`; `cmd/` command adapters MUST remain thin argument-resolution and exit-code adapters and MUST NOT become the source of business rules.

Library modules MUST limit cryptographic operations to `node:crypto` and MUST NOT import from `cmd/` (no reverse imports).

The `upgrade`, `rollback`, and `doctor` configuration diagnostics MUST NOT make authorization decisions (charter §2.2): they MUST NOT authorize, approve, or refuse any accounting, fiscal, payment, or other business decision, and MUST NOT package any vertical capability.

The commands MUST NOT install, upgrade, remove, or replace any host binary — Codex, Claude Code, OpenCode, Drenyra Pi, or any other — and MUST NOT mutate program-root documents or frozen contracts.

#### Scenario: Transitions execute without host installation or authorization decisions

- GIVEN a managed installation with recorded current composition `1.2.3`
- WHEN `upgrade` to `1.4.0` and then `rollback` run
- THEN no host binary is invoked, installed, or removed, no authorization or fiscal decision is made or reported, and all state changes are confined to Drenyra-managed assets

### Requirement: Testability

The transition and diagnostic logic MUST be executable against an isolated, injected home directory (the existing `--home` mechanism or an equivalent test seam) without network access and without any real host binary present.

Focused tests MUST cover, at minimum: upgrade on a clean current state; upgrade idempotency; rollback to the prior composition; rollback with no prior composition (fail-closed); foreign-file byte-for-byte preservation; doctor drift detection; and doctor pin-mismatch detection. Tests MUST assert exit codes and the JSON report shape, and MUST NOT require a real Codex, Claude Code, or OpenCode installation.

#### Scenario: The full transition and diagnostic suite runs in isolation

- GIVEN a test harness with an isolated home directory and an injected packaged version
- WHEN the upgrade, rollback, and doctor scenario tests run
- THEN every transition is deterministic, every scenario asserts its exit code and JSON output shape, and no test touches a real host installation or the real user home
