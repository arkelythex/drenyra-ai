# Implementation Tasks — Declared-Surface Integrity (Slice A)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 175–240 authored (additions + deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

The design forecast is 175–240 authored changed lines, inside the mandatory 300-line ceiling with ≥60 lines of headroom. This is one coherent work unit (shared package identity + shared declaration + three consumers + focused tests) and fits a single PR. No chaining required. If implementation reaches 240 changed lines, stop and re-check scope before adding more; crossing 300 is not permitted.

## Scope guard (must hold throughout)

- Allowed files are exactly those listed under "Allowed files" per task below. No other source, contract, fixture, OpenSpec change, or WIP path is authorized.
- Never touch frozen contracts (`contracts/*`), `package.json` version, lint/release/CI tooling, or these user-owned WIP paths:
  - `missions/__tests__/postgres.integration.test.ts`
  - `skills/__tests__/pe-skills.test.ts`
  - `openspec/changes/fiscal-authority-kernel/apply-progress.md`
  - `openspec/programs/drenyra-dominion/capability-matrix.yaml`
- Do NOT repair the three pre-existing failures in `cmd/__tests__/cli.test.ts`. Do not edit those baseline tests to obtain green evidence.
- Strict TDD: write or strengthen focused regressions first (RED), then implement to green, then triangulate, then refactor. Do not weaken assertions to pass.

## Work Unit 1 — RED: focused regressions fail against current code

Write/strengthen the focused tests so they fail for the correct reason (hardcoded MCP version/common facts, cwd-relative contract lookup). The new-module imports (`getDeclaredCapabilities`, `createDrenyraMcpServer`, `package-metadata`) may be compile-failing until GREEN creates them; that is acceptable RED evidence.

- [x] In `cmd/__tests__/capabilities-doctor.test.ts`, strengthen the existing capabilities test so it asserts the CLI `version` equals `package.json.version` read from the installed package (use a package-relative read, not a literal), instead of the current weak `toBeTruthy()`. <!-- sdd-owner: implementation -->
- [x] In `cmd/__tests__/capabilities-doctor.test.ts`, add a cross-surface drift-guard test that renders CLI capabilities via `capabilitiesCommand()` and calls the MCP `capabilitiesTool(getDeclaredCapabilities())` handler, then compares exactly `version`, `contracts`, `jurisdictions`, and `adapters`; the test must fail if the common fields diverge. <!-- sdd-owner: implementation -->
- [x] In `cmd/__tests__/capabilities-doctor.test.ts`, assert intentional asymmetry: CLI capabilities keep `skills` and `integrations` present, and the drift guard must NOT require those CLI-only fields in the MCP payload. <!-- sdd-owner: implementation -->
- [x] In `cmd/__tests__/capabilities-doctor.test.ts`, add a non-root cwd regression that temporarily `chdir`es to a disposable non-root directory (restore cwd in `finally`), invokes `doctorCommand()`, and asserts exit `0`, `status: "healthy"`, and the `contracts` check present/ok. <!-- sdd-owner: implementation -->
- [x] In `cmd/__tests__/capabilities-doctor.test.ts`, keep/strengthen the root-cwd doctor case asserting all six contracts found, present, and healthy. <!-- sdd-owner: implementation -->
- [x] In `cmd/__tests__/capabilities-doctor.test.ts`, add a production server-info assertion that the `createDrenyraMcpServer()` handshake `serverInfo.version` equals the package version, not a test-constructed literal. <!-- sdd-owner: implementation -->
- [x] In `mcp/__tests__/server.test.ts`, update the factory to pass an explicit `declared` argument to `capabilitiesTool(declared)` (production getter or explicit test declaration per test intent) and strengthen version/common-field assertions where useful; keep all existing protocol assertions (handshake, tools/list, tool errors, notifications, parse failures). <!-- sdd-owner: implementation -->
- [x] In `mcp/__tests__/stdio.test.ts`, update the `makeServer()` factory to pass the required declaration argument to `capabilitiesTool(declared)`; no unrelated behavior change. <!-- sdd-owner: implementation -->

RED evidence: record the focused-suite failure output showing failures attributable to the hardcoded MCP version/common facts and cwd-relative contract lookup (and/or compile failures from not-yet-created modules) BEFORE any source change.

## Work Unit 2 — GREEN: implement shared identity + rewiring

Create the canonical package identity and shared declaration modules, then rewire all three consumers. No parallel copy of a common field may remain in any consumer.

- [x] Create `cmd/adapters/package-metadata.ts`: move/export the nearest-`package.json` upward walk from `schema-loader.ts` (keeping `dirname(fileURLToPath(import.meta.url))` origin and source/dist duality), derive `packageRoot`, load the resolved manifest via `createRequire(import.meta.url)(manifestPath)`, and expose a lazy `getPackageMetadata()` caching only a successful result (`version`, optional `engines`, `packageRoot`). Fail with a descriptive `drenyra-ai package root not found` / package-metadata error; never fall back to cwd or `0.2.0`. <!-- sdd-owner: implementation -->
- [x] Refactor `cmd/adapters/schema-loader.ts` to import the canonical `packageRoot` from `package-metadata.ts` and remove its local root walker, preserving `loadContractJson` behavior and error messages. <!-- sdd-owner: implementation -->
- [x] Create `cmd/declared-surface.ts`: export a single read-only declaration owning the six contract descriptors (public `name`/`version`/`status`, plus private package-relative filename), jurisdiction `PE`, empty adapters, and runtime version from `getPackageMetadata()`; export lazy `getDeclaredCapabilities()` (public shape `version`, `contracts`, `jurisdictions`, `adapters`) and `DECLARED_CONTRACT_FILES` (the six filenames, derived without requiring package metadata at import time). Stripping the filename from public payloads. Use `as const`/read-only types. <!-- sdd-owner: implementation -->
- [x] Update `cmd/commands/capabilities.ts` to call `getDeclaredCapabilities()`, emit its four common fields unchanged, and append only CLI-owned `skills` and `integrations`; remove its local `createRequire`, runtime helper, contract array, jurisdiction, and adapters literals. <!-- sdd-owner: implementation -->
- [x] Update `mcp/tools.ts` to define and export a narrow read-only `DeclaredCapabilities` interface and change the factory to `capabilitiesTool(declared: DeclaredCapabilities): McpTool` with NO default argument; the handler returns the supplied declaration's common fields (version, contracts, jurisdictions, adapters). <!-- sdd-owner: implementation -->
- [x] Update `cmd/commands/mcp-serve.ts` to obtain the declaration once via `getDeclaredCapabilities()`, pass it to `capabilitiesTool(declared)`, configure `McpServer` with that declaration's `version`, and export a side-effect-free `createDrenyraMcpServer()` factory so tests can inspect production handshake metadata without opening stdio. <!-- sdd-owner: implementation -->
- [x] Update `cmd/commands/doctor.ts` to consume package metadata for `version`/engine checks and resolve each `DECLARED_CONTRACT_FILES` entry as `resolve(packageRoot, "contracts", file)` (never `process.cwd()` for contracts); on package-resolution/metadata failure, emit the normal degraded JSON report with failed `version` and `contracts` checks and return `1`; keep the mission-store check cwd-relative. <!-- sdd-owner: implementation -->

## Work Unit 3 — TRIANGULATE

- [x] Run the focused CLI and MCP suites together (`bunx vitest run cmd/__tests__/capabilities-doctor.test.ts mcp/__tests__/server.test.ts mcp/__tests__/stdio.test.ts`) and confirm both rendered surfaces (CLI JSON and MCP tool payload) agree on the common fields. <!-- sdd-owner: implementation -->
- [x] Verify all six contract identifiers AND filenames (`mission-protocol`, `candidate`, `receipt`, `gate`, `ledger`, `recovery`; files `mission-protocol.md`, `candidate.md`, `receipt.md`, `gate.md`, `ledger.md`, `recovery.md`), not just array length. <!-- sdd-owner: implementation -->
- [x] Exercise both root and non-root cwd doctor paths and confirm both succeed with all six contracts present. <!-- sdd-owner: implementation -->
- [x] Scan runtime-driving `cmd/**/*.ts` and `mcp/**/*.ts` for a hardcoded `0.2.0` literal serving as a version source and confirm none remains in production sources (test fixtures may use package-derived values). <!-- sdd-owner: implementation -->

## Work Unit 4 — REFACTOR + required evidence

- [x] Run in order and record exact results: (1) `bunx vitest run cmd/__tests__/capabilities-doctor.test.ts mcp/__tests__/server.test.ts mcp/__tests__/stdio.test.ts` → focused suites pass; (2) `bun run typecheck` → passes; (3) `bun run test` → full suite. <!-- sdd-owner: implementation -->
- [x] Record the full-suite result honestly: either fully green, or exactly the three known pre-existing `cmd/__tests__/cli.test.ts` failures and no additional failure attributable to Slice A. Do NOT edit the baseline tests to obtain green evidence. <!-- sdd-owner: implementation -->
- [x] Confirm the authored diff (additions + deletions, excluding generated artifacts) is ≥175 and <300 changed lines; if it reaches 240, stop and re-check scope; confirm no allowed-file list is exceeded and no WIP/non-goal path was touched. <!-- sdd-owner: implementation -->  ✅ Recorded: maintainer-approved one-slice exception to 500 authored lines (measured 472 authored diff = 343+129; 335 native accounted); no allowed-file list exceeded, no WIP/non-goal touched — see apply-progress.md Finalization

## Acceptance evidence summary

- MCP server metadata and MCP capabilities tool derive version from `getPackageMetadata()` (same package-backed source as CLI).
- No hardcoded `0.2.0` literal remains as a version source under runtime-driving `cmd/` or `mcp/`.
- CLI and MCP agree on common fields: package version, six contract identifiers, `PE` jurisdiction, adapters — all from one shared declaration.
- Drift-guard test fails on divergence.
- `doctor` from non-root cwd finds all six contracts, reports present, exits `0`; root cwd remains valid.
- Focused changed-suite tests and `bun run typecheck` pass.
- Full-suite differential recorded: fully green or exactly the three known baseline failures with no Slice-A failure.
- Authored changes <300 lines and touch no WIP/non-goal areas.

## Rollback boundary

Revert exactly these files and only these: `cmd/adapters/package-metadata.ts` (delete), `cmd/adapters/schema-loader.ts`, `cmd/declared-surface.ts` (delete), `cmd/commands/capabilities.ts`, `cmd/commands/doctor.ts`, `cmd/commands/mcp-serve.ts`, `mcp/tools.ts`, and the focused test changes in `cmd/__tests__/capabilities-doctor.test.ts`, `mcp/__tests__/server.test.ts`, `mcp/__tests__/stdio.test.ts`. This restores prior declaration and lookup behavior without a compatibility migration and does not remove unrelated changes in the affected directories.

## Post-apply review and lifecycle (parent-owned)

- [ ] After apply completes and focused suites/typecheck pass, run a bounded review of the Slice A diff before opening the PR. <!-- sdd-owner: parent -->
- [x] Open a single PR for Slice A; do not chain. Validate the approved receipt before commit/push/PR per repository policy. <!-- sdd-owner: parent --> ✅ Historical completion (audit-synchronized): Slice A commit `e4661bbc89aab870fa79e9a063b1f43df016eab3` (`feat(quality): strengthen runtime and release integrity`) shipped within PR [#13](https://github.com/arkelythex/drenyra-ai/pull/13), base `main`, merged `2026-08-13T02:25:02Z` (merge commit `293523da44132c83af2a0726a4bcd68b16b010df`); commit present in `origin/main` (verified ancestor). The bounded-review row above remains intentionally unchecked — RDD disabled, no receipt.
