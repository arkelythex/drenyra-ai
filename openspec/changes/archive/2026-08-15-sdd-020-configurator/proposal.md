# SDD-020 — Universal Agent Configurator Proposal

> Change: `sdd-020-configurator` · Lifecycle: `planned` · Wave: 1  
> Gate decision: Gate 0 `satisfied` (`gate-0.md` §4, R10); SDD-020 is permitted  
> Depends on: SDD-010 · Feeds: SDD-100

## Intent

Establish the first reliable transition and diagnostic foundation for a universal agent configurator. The change will extend the existing Design-03-depth `install`, `doctor`, and `sync` surface with bounded `upgrade` and `rollback` behavior and deeper configuration diagnostics, while preserving the rule that Drenyra AI configures existing hosts but never installs host binaries.

This is a Wave 1 platform capability. It consumes the release and composition direction established by SDD-010 and prepares configured hosts for later Command Center use in SDD-100.

## Context and current-state gap

SDD-020 is permitted because Gate 0 is `satisfied`; this is a gate decision, not evidence that the SDD lifecycle is complete. SDD-020 remains `lifecycle:planned`.

The repository has partial implementation maturity:

- `install`, `doctor`, and `sync` are `maturity:implemented` only at Design 03 depth.
- `install` detects existing Codex, Claude Code, and OpenCode configuration directories and writes Drenyra-managed markers and a skills asset without overwriting foreign configuration.
- `sync` refreshes managed markers while preserving foreign modifications.
- `doctor` checks package health only: Node compatibility, package version, contract presence, declared CLI surface, and mission-store reachability.
- `upgrade` and `rollback` are `maturity:absent`.
- Installation is not aware of SDD-010 `program-lock`; there is no promoted-composition resolution or verification.
- There is no per-host runtime, model, or tool pinning.
- Doctor does not detect managed configuration drift, recorded pin mismatch, or missing host prerequisites.

These are current claims derived from repository exploration. Existing tests are revision-bound evidence for the inspected tree; they do not make SDD-020 `lifecycle:complete`.

## Roadmap and architecture alignment

The configurator is shared infrastructure for the 16-program Peru v1 roadmap rather than a vertical accounting capability. It makes the AI execution environment reproducible across programs, reducing agent-host divergence during phased delivery of tenant, evidence, ingest, policy, journal, and SUNAT-facing capabilities. It does not implement any of those domain capabilities in this slice.

The proposal respects the approved architecture boundaries:

- **AI advisory vs deterministic authority:** configurator commands manage agent runtime state only. They do not authorize accounting, fiscal, payment, or other business decisions; Drenyra Core retains deterministic authority.
- **Audit ledger vs accounting journal:** this change affects neither. The audit ledger remains audit-only, and no accounting journal entries or fiscal postings are created.
- **Evidence vs memory:** doctor output is operational diagnostic evidence about configuration state, not durable business evidence and not agent memory.
- **Layer model:** deterministic transition and diagnostic behavior belongs below thin `cmd/` adapters, following `contracts -> library modules -> agents -> cmd` without reverse imports. Exact module placement is deferred to design, but command adapters must not become the source of business rules.

## Ownership boundary decision

**Proposal position:** `drenyra-ai` owns and ships the implementations of `install`, `doctor`, `sync`, `upgrade`, and `rollback` for the Drenyra AI package and its managed agent-host configuration.

This keeps deterministic composition transitions and diagnostics with the package whose artifacts and managed state they describe, and it matches the repository layer model. `drenyra-pi` remains a released-artifact consumer and will provide host-serving integration later. Drenyra Pi orchestration, Command Center exposure, and cross-host serving belong to later host-integration work and SDD-100 territory; they are not prerequisites for this first slice.

## First-slice scope

The recommended first slice combines the bounded exploration candidates A and B. It targets approximately 200–350 authored changed lines and must remain reviewable as one unit within the SDD-020 review limit.

### Included

1. **Upgrade foundation**
   - Add and register an `upgrade` command.
   - Read the existing Drenyra-managed manifest.
   - Record the current packaged Drenyra AI composition as the previous state and apply a requested packaged-version transition to managed state.
   - Produce deterministic results when the requested composition is already active.

2. **Rollback foundation**
   - Add and register a `rollback` command.
   - Restore the immediately previous recorded managed composition.
   - Produce deterministic results when the previous composition is already restored.
   - Fail closed when no valid managed installation or rollback state exists, without leaving mixed managed state.

3. **Doctor diagnostic depth**
   - Compare the install manifest with managed host markers and report configuration drift.
   - Compare the packaged Drenyra AI version with the recorded package-level pin and report mismatch.
   - Report missing prerequisites for already-detected host configurations without installing those prerequisites.
   - Remain read-only.

4. **Preserved invariants**
   - Reuse the existing managed-state boundary.
   - Preserve foreign files and foreign-modified markers.
   - Never install Codex, Claude Code, OpenCode, Drenyra Pi, or any other host binary.

### Explicitly deferred to later slices

- Vendor-specific host integration beyond current detection and managed markers.
- Drenyra Pi host-serving integration.
- Per-host runtime, model, and tool composition records (`pinned-ai-runtime`).
- Program-lock-aware install and resolution of SDD-010 promoted artifacts.
- Full composition sync across hosts.
- End-to-end validation across all four declared hosts.

The first slice therefore verifies and transitions a recorded **package-level managed composition**. It does not claim to deliver the final program-lock-backed, per-host pinned ecosystem composition.

## Affected areas

- CLI command surface and help/dispatch registration for `upgrade` and `rollback`.
- Drenyra-managed manifest schema and transition state.
- Read-only doctor diagnostics and reporting.
- Tests for command transitions, idempotency, fail-closed behavior, and drift detection.

No program-root documents, frozen contracts, accounting modules, authorization components, audit-ledger behavior, journal behavior, evidence stores, or memory systems are changed.

## Product outcome and tradeoffs

### Enabled by the first slice

- Operators can move between recorded packaged Drenyra AI compositions and restore the immediately previous composition through deterministic, idempotent commands.
- Operators can identify managed-marker drift, package-level pin mismatch, and missing host prerequisites through one read-only doctor surface.
- The package gains a testable transition model that later slices can bind to SDD-010 promoted artifacts and per-host runtime/model/tool pins.

### Deferred by the first slice

- A recorded package-level pin is not yet a complete verified ecosystem pin.
- Hosts are not yet configured with vendor-specific runtime, model, or tool versions.
- Install does not yet consume `program-lock`, so the slice does not guarantee that every host consumes the promoted artifact rather than another packaged version.
- Drenyra Pi does not yet serve or orchestrate these commands.

This sequencing favors a small, reviewable transition core and useful diagnostics over attempting program-lock resolution, host adapters, and per-host composition in one high-risk change.

## Non-goals

- No authorization decisions, including fiscal operations (charter §2.2).
- No vertical capability packaging for any Peru v1 program.
- No mutation of program-root documents or frozen contracts.
- No installation, upgrade, removal, or replacement of host binaries on user machines outside the Drenyra AI package; the never-install-host invariant remains mandatory.
- No per-host runtime/model/tool pinning in this slice.
- No program-lock-aware installation in this slice.
- No Drenyra Pi or Command Center integration in this slice.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Partial transition leaves mixed managed state | Stage and validate managed state before replacement; fail closed and retain the prior valid state. |
| Rollback state is missing or corrupt | Refuse mutation and return an actionable diagnostic; never infer an unverified previous composition. |
| Foreign host configuration is overwritten | Restrict writes to Drenyra-managed assets and preserve existing foreign-change behavior. |
| Package-level pin is mistaken for full ecosystem verification | Name the diagnostic and state model explicitly as package-level; reserve `pinned-ai-runtime` and program-lock claims for later slices. |
| Scope expands into host adapters or SDD-010 lock semantics | Keep host integration and program-lock-aware install as explicit follow-up slices. |
| Ownership remains ambiguous across repositories | Adopt the ownership position above: implementations live in `drenyra-ai`; `drenyra-pi` supplies later serving integration. |

## Rollback strategy

For runtime behavior, `rollback` restores the immediately previous valid managed composition and must be idempotent. If a transition cannot be validated, the operation leaves the current valid managed state unchanged.

For delivery rollback, revert the first-slice code and manifest-shape changes together. Existing `install`, `doctor`, and `sync` behavior must remain usable with pre-slice managed manifests, or the implementation must provide an explicit backward-compatible read path. No rollback procedure may install or alter a host binary.

## Success criteria and acceptance direction

The first slice is successful when:

- `upgrade` and `rollback` are registered and operate on Drenyra-managed package composition state.
- Re-running upgrade to the active composition and rollback to the restored composition is idempotent.
- Invalid, missing, or corrupt transition state fails closed without mixed managed state.
- Doctor remains read-only and detects managed-marker drift, package-level pin mismatch, and missing prerequisites.
- Foreign-modified configuration remains preserved.
- Focused tests cover upgrade/rollback transitions and idempotency, rollback failure paths, and doctor drift/pin/prerequisite diagnostics.
- The project test suite, typecheck, and build are green for the candidate revision.

Full program-lock pin verification, per-host pinned runtime/model/tool composition, and four-host end-to-end coverage are acceptance targets for later SDD-020 slices, not for this first slice.

## Proposal question round — assumptions for review

Automatic planning proceeded with the following product assumptions from the approved exploration and delegated direction:

1. Package-level managed composition is sufficient for the first slice, while runtime/model/tool pins remain a later contract.
2. Rollback restores one immediately previous valid composition rather than maintaining an unbounded history.
3. Missing host prerequisites are diagnostic-only and never trigger installation.
4. `drenyra-ai` owns command implementations; `drenyra-pi` provides later host-serving integration.

These assumptions should be corrected before specification if product expectations require multi-version history, automated prerequisite remediation, or a different repository ownership boundary.
