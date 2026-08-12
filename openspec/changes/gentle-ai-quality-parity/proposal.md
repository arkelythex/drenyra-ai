# Proposal — Declared-Surface Integrity

> **Change:** `gentle-ai-quality-parity`  
> **Slice:** A only  
> **Artifact store:** OpenSpec

## Intent

Make Drenyra AI's declared CLI and MCP surfaces operationally honest and resistant to drift by using one source for runtime version and shared capability facts, and make `doctor` correctly locate packaged contracts regardless of the caller's current working directory.

This proposal addresses three related root causes identified in exploration:

1. MCP runtime versions are hardcoded while CLI commands derive the package version.
2. CLI and MCP duplicate capability declarations and can silently disagree.
3. `doctor` resolves contracts from `process.cwd()`, producing false failures outside the repository root.

The implementation should remove parallel representations of existing truth rather than add new states, flags, commands, or gates.

## Problem

Drenyra AI exposes runtime and capability facts through both CLI and MCP. Those surfaces currently derive overlapping facts differently:

- MCP server metadata and its capabilities tool hardcode a version instead of deriving `package.json.version`.
- CLI and MCP independently declare contracts, jurisdictions, and adapters.
- The two capability shapes already differ, with no drift guard for their common fields.
- `doctor` treats the caller's working directory as the package root, so a valid installation can report all frozen contracts missing when invoked elsewhere.

These failures undermine host negotiation and operator trust. A version bump or capability change can leave one public surface stale, while a health check can report a false negative solely because of invocation location.

## Goals

- Establish one runtime-version helper, backed by `package.json`, for CLI/MCP consumers.
- Establish one declared capability source for the fields shared by CLI and MCP: contracts, jurisdictions, adapters, and version.
- Preserve surface-specific fields where they are intentionally not shared; this change does not force CLI and MCP payloads to become identical.
- Remove runtime-driving hardcoded MCP version literals.
- Make contract checks in `doctor` resolve from the installed package location, not the caller's cwd.
- Add focused regression tests proving version consistency, shared-field parity, and cwd-independent doctor behavior.
- Keep implementation below 300 authored changed lines.

## Scope

### In scope

- A small shared runtime-version helper using the repository's existing `createRequire(import.meta.url)` package-resolution pattern.
- A small shared declaration for contracts, jurisdictions, and adapters, consumed by both CLI capabilities and MCP capabilities.
- MCP server metadata and MCP capabilities-tool version sourcing.
- `doctor` contract-path resolution relative to the package root.
- Targeted updates or additions to the directly affected CLI/MCP tests.
- Existing typecheck and test infrastructure only; no new quality gate or CI job.

### Affected areas

- `cmd/commands/` capability, doctor, MCP-serve, and shared declaration/version code.
- `mcp/` capabilities tooling and server-facing version metadata.
- Directly corresponding tests under `cmd/__tests__/` and `mcp/__tests__/`.

The exact file layout may be selected during design, but must remain within the declared CLI/MCP surface and its focused tests.

## Non-goals

- No lint or formatting tooling, configuration, cleanup, or gate adoption.
- No checksum, SBOM, packaging-hook, CI, or release-pipeline work.
- No sibling-repository ecosystem script changes.
- No frozen-contract content or contract-conformance changes.
- No domain logic, fiscal behavior, agents, ledgers, persistence, or security-policy changes.
- No repair of the three pre-existing failures in `cmd/__tests__/cli.test.ts`.
- No payload-wide unification of CLI and MCP; only common declared facts must share a source and agree.
- No new state, command, flag, configuration switch, gate, or parallel representation of runtime truth.
- No changes to user-owned WIP paths, including:
  - `missions/__tests__/postgres.integration.test.ts`
  - `skills/__tests__/pe-skills.test.ts`
  - `openspec/changes/fiscal-authority-kernel/apply-progress.md`
  - `openspec/programs/drenyra-dominion/capability-matrix.yaml`

## Constraints

- The implementation must remain under 300 authored changed lines, counting additions plus deletions and excluding generated artifacts.
- Strict TDD applies: focused regressions are written or strengthened before behavior changes, then made green without weakening assertions.
- Existing package-resolution patterns must be reused rather than introducing another version or root-discovery mechanism.
- Contract names and contents remain frozen and unchanged; only their shared declaration and lookup location may change.
- Root-cwd behavior must remain valid while non-root cwd behavior becomes valid.
- Tests and behavior must not depend on sibling repositories, network access, or mutable external services.
- Pre-existing WIP must remain untouched.

## Acceptance outcomes

1. MCP server metadata and the MCP capabilities tool derive their version from the same package-backed runtime-version source used by the declared surface.
2. No hardcoded `0.2.0` literal under runtime-driving `cmd/` or `mcp/` code remains as a version source.
3. CLI capabilities and MCP capabilities agree on their common declared fields: package version, the six contract identifiers, `PE` jurisdiction, and adapters.
4. The common capability fields originate from one shared declaration rather than duplicated arrays or literals in each consumer.
5. A drift-guard test fails if CLI and MCP common capability facts diverge.
6. `doctor` invoked with a non-root `process.cwd()` still finds all six packaged contracts, reports them present, and succeeds.
7. Existing root-cwd doctor behavior remains successful.
8. Focused changed-suite tests for the affected CLI/MCP behavior pass, and `bun run typecheck` passes.
9. Authored implementation changes remain below 300 changed lines and do not touch excluded WIP or non-goal areas.

## Baseline failure handling and attributable proof

The full test suite currently has three known, pre-existing failures in `cmd/__tests__/cli.test.ts`. This proposal does not claim or require their repair.

Acceptance evidence is therefore attributed as follows:

- **Required proof:** the targeted changed-suite tests covering CLI/MCP capability parity, MCP version reporting, and cwd-independent doctor all pass.
- **Required proof:** `bun run typecheck` passes.
- **Diagnostic proof:** run the full suite and record its result. Unless the baseline independently clears, it is expected to retain exactly the same three pre-existing `cmd/__tests__/cli.test.ts` failures, with no new failures attributable to Slice A.
- **If the baseline independently clears:** the full suite must pass; this change must not preserve or recreate the old failures.

A full-suite result containing the known baseline failures is not presented as a green suite. It is accepted only as differential evidence when the focused changed suites and typecheck pass and no additional failure is introduced.

## Success criteria

The change succeeds when public CLI/MCP common declarations cannot drift without a focused test failure, all runtime version reporting follows package metadata, and `doctor` produces the same valid contract result from root and non-root working directories. Success must be demonstrated by the attributable proof above without changing frozen contracts, baseline CLI failures, or user-owned WIP.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Package metadata resolves differently in source and built output. | MCP may report no or incorrect version after packaging. | Reuse the proven `createRequire(import.meta.url)` approach and cover the direct consumers with focused tests; retain existing packed-install infrastructure unchanged. |
| Shared declaration accidentally erases intentional surface-specific fields. | CLI or MCP consumers could lose information. | Share only common facts; preserve CLI-only or MCP-only fields in their existing consumers. |
| Doctor's package-relative path is derived incorrectly. | Root invocation may regress or installed invocation may still fail. | Test both root and mocked non-root cwd behavior against all six expected contracts. |
| Refactoring creates a new parallel source instead of removing duplication. | Drift risk remains under a different module shape. | Designate one declaration module and require both consumers to import it; drift-guard their rendered common fields. |
| Baseline failures obscure regressions. | New failures could be misclassified as pre-existing. | Require focused changed-suite passes, typecheck, and a recorded full-suite differential showing no failures beyond the known three. |
| Scope expands into adjacent quality work. | Review burden and line budget increase. | Enforce explicit non-goals and stop before lint, release, sibling-script, frozen-contract, or baseline-repair work. |

## Rollback

Rollback is a single bounded work unit: revert the shared declaration/version helper, restore the prior CLI/MCP consumers and doctor lookup behavior, and revert only the focused tests introduced or updated for Slice A. No migration, persisted data, frozen contract, external service, or user-owned WIP is involved.

Rollback must not remove unrelated changes in the affected directories. Because this slice changes only declared-surface derivation and health-check path resolution, reverting it restores the previous behavior without a compatibility migration.

## Delivery boundary

Implement and review Slice A as one cohesive work unit with its focused tests. Estimated implementation is approximately 85–110 authored changed lines and must remain below 300. Any need to modify linting, release infrastructure, sibling-repository scripts, frozen contracts, baseline CLI failures, or the listed WIP paths is evidence of scope drift and requires a separate change rather than expansion of this proposal.
