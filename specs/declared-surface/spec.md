# Declared-Surface Specification

## Purpose

Make Drenyra AI's declared CLI and MCP surfaces operationally honest and resistant to drift: one package-backed runtime-version source, one shared declaration for the capability facts the two surfaces have in common, no hardcoded runtime MCP version, and `doctor` contract discovery that resolves from the installed package location regardless of the caller's working directory. The change removes parallel representations of existing truth; it does not add new states, flags, commands, or gates, and it does not force CLI and MCP payloads to become identical beyond their common declared facts.

## Requirements

### Requirement: Package-Derived Runtime Version

The system MUST expose exactly one runtime-version source for the declared surface, and that source MUST derive the runtime version from the installed package's `package.json` version field. MCP server metadata, the MCP capabilities tool, and the CLI declared surface MUST report their runtime version from that single package-backed source. The versions reported by these surfaces MUST equal the package version.

#### Scenario: All surfaces report the package version

- GIVEN an installed package whose `package.json` declares version `0.2.0`
- WHEN MCP server metadata, the MCP capabilities tool, and the CLI declared surface report their runtime version
- THEN all three MUST report `0.2.0` and MUST derive it from the single package-backed source

#### Scenario: Version bump propagates without surface edits

- GIVEN the package version in `package.json` is changed from `0.2.0` to `0.3.0`
- WHEN the same surfaces report their runtime version
- THEN all three MUST report `0.3.0` without any change to the surface code

### Requirement: Single Shared Capability Declaration

The common capability facts shared by CLI and MCP — the package version, the six frozen contract identifiers, the `PE` jurisdiction, and the adapters — MUST originate from one shared declaration. CLI capabilities and MCP capabilities MUST both consume that shared declaration and MUST NOT maintain parallel literal copies of these common fields. Surface-specific fields that are intentionally not shared MUST remain in their owning surface and MUST NOT be forced into the other surface's payload. The six frozen contract identifiers and their contents MUST remain exactly the same; only their declaration location MAY change.

#### Scenario: Common fields agree across surfaces

- GIVEN the single shared capability declaration
- WHEN CLI capabilities and MCP capabilities render their payloads
- THEN the package version, the six contract identifiers, the `PE` jurisdiction, and the adapters MUST be identical in both payloads

#### Scenario: Drift guard detects divergence

- GIVEN CLI and MCP common capability fields that differ, for example because one consumer stops consuming the shared declaration
- WHEN the drift-guard test runs
- THEN the drift-guard test MUST fail

#### Scenario: Surface-specific fields are preserved

- GIVEN a field that is intentionally CLI-only or MCP-only
- WHEN the shared declaration is introduced
- THEN that field MUST remain present in its owning surface and MUST NOT be required to appear in the other surface

### Requirement: No Hardcoded Runtime MCP Version

Runtime-driving code under `cmd/` and `mcp/` MUST NOT use a hardcoded `0.2.0` literal as a version source. All runtime version reporting MUST resolve from the package-backed runtime-version source.

#### Scenario: No hardcoded literal remains as a version source

- GIVEN the runtime-driving source under `cmd/` and `mcp/`
- WHEN it is scanned for hardcoded `0.2.0` literals serving as a version source
- THEN none MUST be found

#### Scenario: Capabilities tool reports the package-derived version

- GIVEN an installed package with a known `package.json` version
- WHEN the MCP capabilities tool reports its version
- THEN the reported version MUST equal the package version and MUST NOT originate from a hardcoded literal

### Requirement: Cwd-Independent Doctor Contract Discovery

`doctor` MUST locate the six packaged frozen contracts relative to the installed package location, independent of the caller's current working directory. Invoked from the package root, `doctor` MUST continue to locate all six packaged contracts and succeed. Invoked from any non-root working directory, `doctor` MUST locate all six packaged contracts, report them present, and succeed.

#### Scenario: Non-root invocation succeeds

- GIVEN an installed package and `doctor` invoked from a working directory that is not the package root
- WHEN `doctor` runs its contract checks
- THEN all six packaged contracts MUST be found and reported present, and `doctor` MUST succeed

#### Scenario: Root invocation remains valid

- GIVEN `doctor` invoked from the package root
- WHEN `doctor` runs its contract checks
- THEN all six packaged contracts MUST be found and reported present, and `doctor` MUST succeed

### Requirement: Baseline-Attributed Differential Evidence

The change MUST be verifiable with attributable evidence that distinguishes Slice A results from the three known pre-existing failures in `cmd/__tests__/cli.test.ts`. The focused changed-suite tests covering CLI/MCP capability parity, MCP version reporting, and cwd-independent doctor behavior MUST pass, and `bun run typecheck` MUST pass. A full-suite run MUST be recorded: if the baseline still fails, the full-suite result MUST contain exactly the same three pre-existing `cmd/__tests__/cli.test.ts` failures and no failure attributable to Slice A; if the baseline independently clears, the full suite MUST pass and MUST NOT preserve or recreate the old failures.

#### Scenario: Baseline retained

- GIVEN the full suite still contains the three pre-existing `cmd/__tests__/cli.test.ts` failures
- WHEN Slice A verification runs the focused changed suites and `bun run typecheck`
- THEN the focused changed suites MUST pass, typecheck MUST pass, and the recorded full-suite result MUST contain no failure beyond the known three

#### Scenario: Baseline cleared

- GIVEN the three pre-existing failures have independently cleared
- WHEN the full suite runs after Slice A
- THEN the full suite MUST pass in full and MUST NOT recreate any of the old failures
