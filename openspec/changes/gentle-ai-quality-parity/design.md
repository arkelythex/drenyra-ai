# Technical Design — Declared-Surface Integrity (Slice A)

## Scope and design intent

This design implements only the bounded CLI/MCP operational-integrity slice defined by the proposal and `specs/declared-surface/spec.md`. It removes duplicated version and common-capability truth, and makes `doctor` resolve frozen contracts from the installed package root. It does not change frozen contracts, fiscal/domain behavior, agents, persistence, release tooling, quality gates, baseline CLI failures, or user-owned WIP.

## Architectural decision

Use dependency injection at the MCP library boundary and keep package/filesystem concerns in `cmd/`, the adapter/composition layer.

```text
package.json + frozen contract filenames
                │
                ▼
cmd/adapters/package-metadata.ts   (package resolution; adapter concern)
                │
                ▼
cmd/declared-surface.ts            (single owned declaration)
          ┌─────┴─────────┐
          ▼               ▼
cmd commands        mcp/tools.ts consumer port
(capabilities,      (pure tool factory; receives declaration)
 doctor, mcp-serve)
```

Dependency direction remains `contracts -> library modules -> agents -> cmd`:

- `mcp/tools.ts` defines the small input contract it needs and never imports `cmd/`.
- `cmd/declared-surface.ts` imports that contract as a type and supplies the data at composition time.
- Core/library modules gain no filesystem, package-resolution, or new runtime dependency; their existing `node:crypto`-only rule is unchanged.
- No agent imports or changes are required.

A lower-level shared module imported by both `mcp/` and `cmd/` was rejected because package lookup requires `node:module`; placing that concern in the exported library graph would weaken the library dependency rule. Duplicating a default MCP declaration was also rejected because it would preserve the drift defect.

## Module boundaries and ownership

### `cmd/adapters/package-metadata.ts` — installed-package identity

This new adapter owns the only declared-surface package lookup.

- Create one `require` with `createRequire(import.meta.url)`.
- Locate the nearest enclosing `package.json` from the module URL, reusing the source/dist-safe upward walk currently in `schema-loader.ts`.
- Derive `packageRoot` with `dirname(resolvedManifestPath)`; never use `process.cwd()` for package assets.
- Read and validate that absolute manifest path through the `require` instance.
- Expose `getPackageMetadata()`, a lazy function that caches a successful read-only result containing `version`, optional `engines`, and `packageRoot`. Failures are not converted into ambient fallback values.

The relative depth is not stable across layouts:

- source: `cmd/adapters/package-metadata.ts -> ../../package.json`
- built: `dist/cmd/adapters/package-metadata.js -> ../../../package.json` is **not** the same depth.

Therefore the implementation must not hardcode one relative path for both layouts. It must use the existing nearest-package resolution behavior already proven by `cmd/adapters/schema-loader.ts`, factored into this adapter, and then use `createRequire(import.meta.url)` to load the resolved manifest. `schema-loader.ts` should import the factored `packageRoot` instead of retaining a second root finder. This yields one package-root mechanism for source and packaged output and one package-manifest reader.

Concretely, move/export the existing upward walk (`dirname(fileURLToPath(import.meta.url))` to nearest `package.json`) into `package-metadata.ts`; after locating the manifest, load it with `createRequire(import.meta.url)(manifestPath)`. `schema-loader.ts` becomes a consumer of `packageRoot`. No package export or public API is added.

### `cmd/declared-surface.ts` — common declared facts

This new composition-layer module owns exactly these facts:

- six contract descriptors: public `name`, `version`, `status`, plus private package-relative filename;
- jurisdiction `PE`;
- adapters (currently the empty list);
- runtime version, obtained only from `package-metadata.ts`.

It exports:

- `getDeclaredCapabilities()`: a lazy getter for the read-only public common shape (`version`, `contracts`, `jurisdictions`, `adapters`), sourcing version from `getPackageMetadata()`;
- `DECLARED_CONTRACT_FILES`: filenames derived from the same six descriptors for `doctor` without requiring package metadata at module-import time.

The filename is stripped from public CLI/MCP payloads. This avoids replacing two duplicated public arrays with a separate duplicated doctor list.

`package.json` remains the sole owner of package version and Node engine requirements. `cmd/declared-surface.ts` owns only the mapping from package metadata and frozen contract identities into the public declaration. CLI-only `skills` and `integrations` remain owned by `capabilities.ts`.

### `mcp/tools.ts` — consumer port

Define and export a narrow read-only `DeclaredCapabilities` interface next to `capabilitiesTool`. Change the factory contract to:

```ts
capabilitiesTool(declared: DeclaredCapabilities): McpTool
```

The handler returns the supplied common declaration. There is no default argument: omission must fail at compile time rather than silently restore a stale MCP-local truth. The MCP library remains deterministic and does not read package files or import `cmd/`.

This is an internal factory-signature adjustment for current package composition. If a downstream direct `./mcp` caller exists, it must explicitly supply its declaration; no compatibility shim may embed a duplicate default.

## Consumer behavior and data flow

### CLI capabilities

`capabilitiesCommand` calls `getDeclaredCapabilities()`, emits its four common fields unchanged, and appends only CLI-owned `skills` and `integrations`. It removes its local `createRequire`, runtime helper, contract array, jurisdiction, and adapters literals.

### MCP capabilities tool

`mcpServeCommand` obtains the declaration once from `getDeclaredCapabilities()` and passes that same value to `capabilitiesTool`. The tool emits only the existing MCP shape; CLI-only fields are not added. MCP unit fixtures pass an explicit test declaration or the production getter result according to test intent.

### MCP server metadata

`mcp-serve.ts` configures `McpServer` with the same declaration instance's `version`. Export a side-effect-free `createDrenyraMcpServer()` factory so a focused test can inspect the production handshake metadata without opening stdio; avoid an eager module-level constant that would prevent `doctor` from reporting metadata failures cleanly.

### Doctor

`doctorCommand` consumes package metadata for version/engine checks and resolves each `DECLARED_CONTRACT_FILES` entry as `resolve(packageRoot, "contracts", file)`. It must not use `process.cwd()` for contracts.

The mission-store check remains cwd-relative because it describes the caller-selected dev adapter location; changing that behavior is outside Slice A.

### Data flow summary

1. On first consumer call, the package metadata adapter finds the installed package root and loads `package.json`, caching only a successful result.
2. The declared-surface getter combines that version with the single contract/jurisdiction/adapter declaration.
3. CLI capabilities serializes the declaration plus CLI-only fields.
4. MCP serve uses the declaration for both handshake metadata and the injected capabilities tool.
5. Doctor uses the same package root and contract descriptors for package-asset checks.

No consumer may copy a common field into a local literal.

## Failure behavior

- If no enclosing `package.json` can be found, package metadata resolution fails with a descriptive `drenyra-ai package root not found` error. It must not fall back to cwd.
- If the manifest cannot be loaded or has no non-empty string `version`, the adapter fails with a descriptive package-metadata error. It must not advertise a stale literal or silently substitute `0.2.0`.
- `doctor` should convert package-resolution/metadata failure into failed `version` and `contracts` checks, emit its normal degraded JSON report, and return `1`; it must remain read-only.
- MCP serve must fail before accepting stdio requests if trustworthy package metadata is unavailable. Advertising `unknown` as a valid server version is not acceptable.
- Missing contract files remain ordinary doctor failures: list the missing filenames, emit degraded status, and return `1`.
- Capability consumers do not mutate the shared declaration. Read-only types and `as const` declarations provide compile-time protection; runtime deep-freezing is unnecessary for this bounded serialization path.

## File change plan

| File | Change |
| --- | --- |
| `cmd/adapters/package-metadata.ts` | New canonical package-root and manifest resolver. |
| `cmd/adapters/schema-loader.ts` | Reuse canonical `packageRoot`; remove local root walk. |
| `cmd/declared-surface.ts` | New single owner for common public facts, lazy public declaration getter, and derived contract filenames. |
| `cmd/commands/capabilities.ts` | Consume shared declaration; retain CLI-only fields. |
| `cmd/commands/doctor.ts` | Consume package metadata/root and shared contract filenames; preserve cwd-relative mission store. |
| `cmd/commands/mcp-serve.ts` | Use shared version for server info and inject declaration into MCP tool. |
| `mcp/tools.ts` | Replace hardcoded declaration with required consumer-port argument. |
| `cmd/__tests__/capabilities-doctor.test.ts` | Add package-version, cross-surface parity, root/non-root doctor regressions, and production server-info assertion. |
| `mcp/__tests__/server.test.ts` | Pass declaration explicitly and strengthen version/common-field assertions where useful. |
| `mcp/__tests__/stdio.test.ts` | Update factory setup for the required declaration argument; no unrelated behavior change. |

No other source, contract, fixture, OpenSpec change, or WIP path is authorized by this design.

## Strict-TDD testing plan

### RED

1. Strengthen `capabilities-doctor.test.ts` to assert CLI version equals `package.json.version`.
2. Add a drift guard that renders CLI capabilities and calls the MCP capabilities tool with `getDeclaredCapabilities()`, then compares exactly `version`, `contracts`, `jurisdictions`, and `adapters`.
3. Assert intentional asymmetry: CLI `skills`/`integrations` remain present while MCP is not required to expose them.
4. Add a doctor regression that temporarily changes cwd to a disposable non-root directory, invokes `doctorCommand`, and asserts exit `0`, healthy status, and the contracts check present/true. Restore cwd in `finally`.
5. Keep/strengthen the root-cwd doctor case.
6. Assert production MCP server info uses the package version, not a test-constructed literal.

The RED evidence must show failures attributable to hardcoded MCP version/common facts and cwd-relative contract lookup before source changes.

### GREEN

Implement only the modules and consumer rewiring above. Update existing MCP test factories to pass the declaration without weakening unrelated protocol assertions.

### TRIANGULATE

- Run the focused CLI and MCP suites together to prove both rendered surfaces.
- Verify all six contract identifiers and filenames, not only array length.
- Exercise both root and non-root cwd paths.
- Scan runtime-driving `cmd/**/*.ts` and `mcp/**/*.ts` for `0.2.0`; test fixtures may use package-derived values, but production sources must contain no version-source literal.

### REFACTOR and required evidence

Run, in order:

```bash
bunx vitest run cmd/__tests__/capabilities-doctor.test.ts mcp/__tests__/server.test.ts mcp/__tests__/stdio.test.ts
bun run typecheck
bun run test
```

Record focused-suite and typecheck success. Record the full-suite result honestly: either fully green, or exactly the three known pre-existing `cmd/__tests__/cli.test.ts` failures and no additional failure. Do not edit those baseline tests to obtain green evidence.

A packed-build check is useful if already cheap, but this slice must not add a packaging gate or script. The source/dist package-root duality is covered structurally by the shared upward resolver and existing schema-loader usage.

## Line-budget forecast

Estimated authored churn (additions plus deletions):

| Area | Estimate |
| --- | ---: |
| Package metadata/root extraction and schema-loader reuse | 35–50 |
| Shared declaration and MCP consumer port | 40–55 |
| CLI/MCP/doctor rewiring | 35–50 |
| Focused tests and fixture updates | 65–85 |
| **Total** | **175–240** |

The forecast remains below the mandatory 300-line ceiling with 60 lines of minimum headroom. If implementation reaches 240 changed lines, stop and re-check scope before adding more. Crossing 300 is not permitted; adjacent cleanup, API redesign, docs expansion, or baseline repair must move to a separate change.

## Rollout and rollback

This is one cohesive work unit: shared declaration/package identity, all three consumers, and focused regressions ship together. There is no migration or persisted-state rollout.

Rollback reverts only the files listed above, restoring prior declaration and lookup behavior. Frozen contracts, package data, user data, and WIP are untouched. Tests remain in the same work unit as behavior, and the rollback boundary does not include unrelated changes in affected directories.
