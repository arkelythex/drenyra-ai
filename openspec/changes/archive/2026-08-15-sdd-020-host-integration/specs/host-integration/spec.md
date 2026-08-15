# Host-Integration Specification

## Purpose

The host-integration domain is the Drenyra AI per-host configuration surface for recognized AI runtime hosts. Slice 1 delivered package-level composition, install/sync delegation, upgrade/rollback transitions, and doctor diagnostics. This slice (slice A of SDD-020 slice 2) adds a deterministic per-host pinned AI runtime record (`pinned-ai-runtime`) containing the runtime, model, and tool pins each present host is expected to use, renders it as a Drenyra-managed host asset during install and sync, records it in the managed composition snapshot so upgrade and rollback stay reproducible, and surfaces per-host pin state through the read-only `doctor` command.

The recognized host set for this slice is the existing fixed set (`codex`, `claude-code`, `opencode`). Adding `drenyra-pi` to the host union and choosing its canonical config directory are slice B concerns and are not specified here. Program-lock-aware installation of a genuinely promoted artifact is slice C and is not specified here. Both are forward references only.

The Drenyra AI host configurator stays on the advisory side of the approved architecture: it configures runtime hosts, never makes fiscal decisions, never authorizes operations, never installs or replaces host binaries, and never overwrites foreign configuration bytes.

## Requirements

### Requirement: Per-Host Pin Record

The managed-config library MUST define a per-host pin record type holding a runtime pin, a model pin, and a tool pin, and MUST attach one such record per recognized host to the managed install manifest and to the managed composition snapshot so that the managed state can prove which runtime, model, and tool composition each host is expected to use.

Every version value in the pin record MUST be a JSON integer or a semantic-version string and MUST NOT be a JSON floating-point number.

A managed manifest created before this slice that lacks per-host pin records MUST remain readable by `install`, `sync`, `doctor`, `upgrade`, and `rollback`. Such a manifest MUST NOT have pin bytes invented for it: when a transition requires prior pin bytes that the manifest cannot supply, the transition MUST fail closed rather than fabricate rollback or pin state.

A pin asset present in a host config directory that was never rendered by Drenyra (user-authored) MUST be treated as a foreign pin record: it MUST be preserved byte-for-byte, MUST NOT be adopted as managed, MUST NOT be overwritten by any command, and MUST be classified distinctly from managed pin state by `doctor`.

#### Scenario: Managed pin record creation for a present host

- GIVEN a recognized host whose config directory exists and a managed manifest recording that host as present
- WHEN `install` renders the per-host pin record for that host
- THEN the managed manifest and composition snapshot contain a per-host pin record with a runtime pin, a model pin, and a tool pin for that host, and every pin version is a JSON integer or a semantic-version string

#### Scenario: Pin version fields never use floats

- GIVEN a per-host pin record produced by the managed-config library
- WHEN the record is validated against the managed manifest schema
- THEN no pin version field is a JSON floating-point number: each field is a JSON integer or a semantic-version string

#### Scenario: A pre-pin manifest is not assigned invented pin bytes

- GIVEN a valid managed manifest created before this slice that records hosts but no per-host pin records
- WHEN a transition that needs prior pin bytes attempts to run
- THEN the transition fails closed with a machine-readable error and no pin bytes are fabricated, adopted, or written

### Requirement: Deterministic Pin Rendering Through Install and Sync

The `install` command MUST render the per-host pin record as a Drenyra-managed host asset in each present recognized host's config directory, alongside the existing managed marker and skills assets, and MUST apply the same exact-byte ownership rules: the pin asset MAY be created only when absent, and a pin asset whose bytes differ from the recorded Drenyra-managed bytes MUST be preserved byte-for-byte and reported rather than overwritten.

The `sync` command MUST reconcile the managed pin asset with the same ownership contract it applies to the managed marker: it MUST create a missing managed pin asset with the expected managed bytes, MUST preserve and report a pin asset whose bytes differ from the expected managed bytes, and MUST report the resulting action per host.

The rendered pin values MUST come from a deterministic package-owned source: package-local pinned-composition constants defined in the library layer, versioned with the Drenyra AI package, and documented. The pin values MUST NOT be derived from `program-lock`, network discovery, host introspection, user input, or the `main` branch state. For a given packaged version, every render MUST produce identical pin bytes across `install`, `sync`, `upgrade`, and `rollback`. This package-owned source remains authoritative until promoted `program-lock` resolution (slice C) replaces it.

The rendered pin bytes MUST be recorded in the managed composition snapshot with their exact content and SHA-256 hash, and MUST participate in the same transition rules as the existing managed assets: when a recorded managed pin asset exactly matches the recorded current bytes, upgrade and rollback restore the recorded previous pin bytes together with the existing managed assets; when the pin asset is foreign-modified, its bytes MUST remain untouched and the preservation MUST be reported.

#### Scenario: Install renders the managed pin asset for every present host

- GIVEN a machine with recognized host config directories present and no managed pin asset in them
- WHEN `install` runs
- THEN each present host's config directory contains a Drenyra-managed pin asset whose bytes equal the package-owned deterministic pin rendering for the packaged version, the rendered bytes are hashed into the managed composition snapshot, and no host binary is installed or invoked

#### Scenario: Sync recreates a missing managed pin asset

- GIVEN a managed installation whose recorded composition includes per-host pin records
- WHEN the managed pin asset for a present host is deleted and `sync` runs
- THEN the managed pin asset is recreated with the expected managed bytes and the sync report records the recreation action

#### Scenario: Renderings are byte-identical across commands

- GIVEN the same packaged version and the same recorded composition
- WHEN the managed pin bytes are rendered by `install` and again by `sync`
- THEN the two renderings are byte-for-byte identical, and they also equal the bytes recorded in the composition snapshot

#### Scenario: Upgrade and rollback preserve foreign pin bytes

- GIVEN a managed installation whose current composition records managed pin bytes and a host whose pin asset has been replaced by user-authored content
- WHEN `upgrade` and then `rollback` run
- THEN the user-authored pin bytes are never modified or deleted, each command reports the preservation, and the managed manifest and composition state remain consistent

### Requirement: Doctor Pin Surfacing

The `doctor` command MUST report a `pinned-ai-runtime` diagnostic consistent with the existing report shape `{ status, checks, readonly }` and MUST remain strictly read-only: it MUST NOT create, modify, or delete any pin asset while reporting.

For each host recorded as present in the managed manifest, the diagnostic MUST classify the per-host pin state into exactly one of the following states:

- `managed`: the pin asset exists on disk and its bytes equal the expected managed pin bytes recorded for the host;
- `drift`: the manifest records a managed pin for the host, the pin asset exists, and its bytes differ from the recorded expected bytes;
- `foreign`: a pin asset exists on disk for a host for which the manifest records no managed pin (user-authored, never rendered by Drenyra), reported as a distinct unmanaged/unverifiable state and preserved byte-for-byte;
- `absent`: the manifest records a managed pin for the host but no pin asset exists in the host's config directory.

The diagnostic MUST be healthy only when every recorded-present host is in the `managed` state. A `drift`, `foreign`, or `absent` state MUST be reported as a failing diagnostic that names the host; a `foreign` state MUST also state that the pin is user-authored, unmanaged, and preserved rather than adopted. The diagnostic MUST NOT report a pre-pin manifest (one with no per-host pin records) as unhealthy: it MUST report the pin state as not applicable without inventing pin bytes, mirroring the existing clean-checkout not-applicable convention. When no managed manifest exists, the diagnostic MUST pass as not applicable; when the managed manifest is invalid, the diagnostic MUST fail closed as unable to evaluate.

The exit code MUST follow the existing doctor convention: 0 when all checks pass; 1 with the JSON report when any check, including any failing `pinned-ai-runtime` state, fails.

#### Scenario: Doctor reports a managed pin

- GIVEN a managed installation whose per-host pin assets match the recorded managed bytes
- WHEN `doctor` runs
- THEN the JSON report includes a `pinned-ai-runtime` diagnostic whose per-host state is `managed` for each recorded-present host, the diagnostic is healthy, and the command exits 0

#### Scenario: Doctor reports managed pin drift

- GIVEN a managed installation whose composition records a managed pin for a host and whose on-disk pin asset bytes differ from the recorded bytes
- WHEN `doctor` runs
- THEN the JSON report includes a failing `pinned-ai-runtime` diagnostic naming the host with state `drift`, the on-disk pin bytes remain unchanged, and the command exits 1

#### Scenario: Doctor reports a foreign pin distinctly and preserves it

- GIVEN a host config directory containing a user-authored pin asset and a managed manifest that records no managed pin for that host
- WHEN `doctor` runs
- THEN the JSON report classifies the pin state as `foreign`, states that the user-authored bytes are preserved and not adopted, the pin bytes on disk are unchanged, and the command exits 1

#### Scenario: Doctor reports an absent managed pin

- GIVEN a managed installation whose composition records a managed pin for a recorded-present host and whose host config directory contains no pin asset
- WHEN `doctor` runs
- THEN the JSON report includes a failing `pinned-ai-runtime` diagnostic naming the host with state `absent`, no pin asset is created, and the command exits 1

#### Scenario: Doctor stays healthy for a pre-pin manifest

- GIVEN a valid managed manifest created before this slice that records hosts but no per-host pin records
- WHEN `doctor` runs
- THEN the `pinned-ai-runtime` diagnostic is healthy and reports the pin state as not applicable, and no pin bytes are invented or written

### Requirement: Boundary and Invariant Compliance

The per-host pin record, the package-owned deterministic pin constants, pin rendering, composition-snapshot participation, and the `pinned-ai-runtime` diagnostic MUST live in library modules below `cmd/`, and `cmd/` command adapters MUST remain thin argument-resolution and exit-code adapters that delegate to the library. Library modules MUST NOT import from `cmd/` or `agents/` (no reverse imports) and MUST limit cryptographic operations to `node:crypto`.

Pin rendering and diagnostics MUST NOT install, upgrade, remove, or replace any host binary, MUST NOT invoke any host executable or package manager, and MUST NOT make or report any authorization or fiscal decision. Pin writes MUST NOT mutate frozen contracts under `contracts/`, program-root documents, or any monetary value, and MUST NOT import, invoke, or couple to Drenyra Pi or the `drenyra-pi` repository.

Every pin write target MUST be re-derived from the injected home directory and the fixed host map; a recorded host path that redirects a write outside the re-derived managed host directory MUST fail closed and MUST NOT be used as write authority. Foreign pin bytes MUST be preserved byte-for-byte across `install`, `sync`, `upgrade`, `rollback`, and `doctor`: they MUST NOT be created over, modified, moved, or deleted.

#### Scenario: Pin operations never install a host and never touch foreign bytes

- GIVEN a managed installation with present hosts whose pin assets are user-authored
- WHEN `install`, `sync`, `upgrade`, and `rollback` run in sequence
- THEN no host binary or package manager is invoked, no authorization or fiscal decision is made or reported, no frozen contract or program-root document changes, and the user-authored pin bytes remain byte-for-byte identical throughout

#### Scenario: Pin writes target only re-derived managed paths

- GIVEN a managed manifest whose recorded host path does not match the re-derived managed host directory for that host
- WHEN a pin write is attempted
- THEN the write fails closed with a machine-readable error and no file is created or modified outside the re-derived managed host directory

### Requirement: Testability

The per-host pin logic MUST be executable against an isolated, injected home directory (the existing `--home` mechanism or an equivalent test seam) without network access and without any real host binary present.

Focused tests MUST cover, at minimum: per-host pin record creation with integer/semver version fields and no floats; deterministic rendering of the managed pin asset into `install` and `sync` for every present host; byte-for-byte preservation of a foreign pin asset across `install`, `sync`, `upgrade`, and `rollback`; `doctor` classification of `managed`, `drift`, `foreign`, and `absent` states including the distinct foreign classification and the pre-pin not-applicable state; and boundary compliance (no host binary invocation, no reverse imports, allowlisted re-derived paths). Tests MUST assert exit codes and the JSON report shape and MUST NOT require a real Codex, Claude Code, or OpenCode installation.

#### Scenario: The pin suite runs in isolation

- GIVEN a test harness with an isolated home directory and an injected packaged version
- WHEN the pin record, rendering, preservation, doctor-classification, and boundary-compliance tests run
- THEN every render is deterministic and byte-comparable, every classification scenario asserts its exit code and JSON output shape, and no test touches a real host installation, the real user home, or the network

#### Scenario: Doctor classification matrix is fully covered

- GIVEN tests for the four per-host pin states plus the pre-pin manifest state
- WHEN the classification tests run against an isolated home
- THEN `managed`, `drift`, `foreign`, `absent`, and pre-pin not-applicable states each have a passing test that asserts the diagnostic name, per-host classification, and exit code
