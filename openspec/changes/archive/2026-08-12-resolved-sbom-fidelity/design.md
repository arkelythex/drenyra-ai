# Technical Design — Resolved SBOM Fidelity, Slice A

## Scope and constraint

Implement one release-layer work unit only: resolve the required runtime graph from Bun lockfile v1, generate an exact CycloneDX 1.5 graph, and verify it from freshly recomputed inputs. No package, lockfile, CI, checksum, signature, import-usage, generated-artifact, or prior-change edits are permitted. Authored additions plus deletions MUST stay at or below 300; there is no exception.

## Required specification correction

The current specification requires `optionalPeers`, when present, to be a string-to-string map. The repository's unchanged `bun.lock` contains `pg.optionalPeers` as `string[]`. Validating the required shape would therefore make the real repository fail every generation. Because changing `bun.lock` is a non-goal, tasks/apply are blocked until the spec describes Bun v1 `optionalPeers` as an array of strings (while `dependencies`, `optionalDependencies`, and `peerDependencies` remain string-to-string maps). The resolver will validate this field but never traverse it.

## Shared resolver contract

Add `scripts/bun-lock-runtime.mjs` with one public function:

```js
export function resolveRuntimeGraph(root)
// => {
//   root: { name: string, version: string },
//   direct: string[],
//   nodes: Array<{ name: string, version: string, direct: boolean, dependsOn: string[] }>
// }
```

`root` is the repository root derived by each caller from its own `import.meta.url`. The function synchronously reads and parses `package.json` and `bun.lock`; validates manifest identity/dependency strings, lockfile version, root workspace, package-record tuples, paths, and dependency-related field shapes; then returns only sorted plain data. It performs no output, logging, process exit, semver selection, or range-satisfaction hardening.

A record is selected by package-map name. Its first tuple value MUST begin with `${name}@`; the non-empty suffix is the exact version. A missing entry fails. Any representation yielding more than one record for a reachable name fails as unsupported ambiguity. Scoped names remain safe because parsing removes the known name prefix rather than splitting on `@`.

## Closure and ordering algorithm

1. Sort manifest `dependencies` names and compare them as an exact set with `workspaces[""] .dependencies` names.
2. Initialize a queue with those direct names and a `seen` set.
3. Pop one name, resolve exactly one validated record, and read only `metadata.dependencies` keys.
4. Sort required child names, store the node, and enqueue unseen children. Cycles terminate through `seen`; shared transitives are emitted once.
5. After traversal, sort nodes by name. Mark `direct` by membership in the manifest-name set. Sort every `dependsOn` list.

Optional, peer, optional-peer, dev, platform, and source-import relationships are validated where required but never enqueued. Resolution of every traversed child is mandatory, so all returned edges are closed over returned nodes.

## Generator wiring

`scripts/sbom.mjs` imports the resolver, computes the complete graph before touching `dist/sbom.json`, and maps each node to:

```js
{ type: "library", "bom-ref": name, name, version, scope: "required",
  properties: [{ name: "drenyra:resolution", value: direct ? "direct" : "transitive" }] }
```

The metadata root uses `bom-ref` equal to the package name. Dependency entries are the root `ref` with sorted direct `dependsOn`, followed by one entry per node (including leaves), sorted by `ref`. Component names are valid refs because multi-version names are rejected.

Generation retains pretty JSON plus one trailing newline and no timestamp. It validates `dist/`, writes a sibling temporary file only after complete serialization, then renames it over `sbom.json`; failures remove the temporary file and never replace the prior valid SBOM with partial bytes.

## Verifier wiring

`scripts/verify-release-integrity.mjs` imports and calls `resolveRuntimeGraph(root)` independently at verification time. It validates CycloneDX/root metadata, indexes components by name, rejects duplicates, and compares the actual name set with resolved nodes. For each expected node it checks exact version, library type, required scope, matching `bom-ref`, and exactly one `drenyra:resolution` property with the expected value.

It separately indexes dependency entries, rejects duplicate refs, requires exactly the root plus every node, compares each sorted/deduplicated `dependsOn` set with the recomputed set, and rejects dangling refs before existing checksum verification runs. Errors identify the component, property, or edge that drifted. The verifier never derives expectations from SBOM claims and does not accept legacy range/direct-only output.

## Error model

The resolver throws `Error` with an input-qualified message (`package.json: ...` or `bun.lock: ...`). Generator and verifier keep their existing single top-level catch and prefixes (`sbom:` / `verify-release-integrity:`), then exit non-zero without stack traces. Missing/unreadable/invalid JSON, unsupported version, root-name drift, malformed records/maps, unresolved names, ambiguity, malformed SBOM, coverage/property/version/scope/edge drift, and output failures all fail closed. No partial graph is returned or written.

## Isolated strict-TDD strategy

Extend the existing temporary mini-repository harness; copy the shared resolver with the scripts and write a compact `bun.lock` fixture helper. Keep fixtures generated in-test, not repository goldens.

RED first, then GREEN/TRIANGULATE/REFACTOR:

- a branched graph with two directs sharing a transitive proves exact versions, direct/transitive properties, leaf entries, sorted closure, deduplication, and byte determinism;
- optional/peer/optional-peer/dev records prove exclusion;
- table-driven lock mutations cover missing file, version/root drift, malformed tuple/maps, missing reachable record, and ambiguous record representation;
- table-driven SBOM mutations cover missing/extra/duplicate component, range/wrong version, wrong type/scope/ref/classification, missing/extra/duplicate/dangling edge, and malformed SBOM;
- existing checksum, cwd-independence, and no-partial-output tests remain active.

Focused command: `bunx vitest run scripts/__tests__/release-integrity.test.ts`. Final evidence also runs the repository's configured full tests/type checks/package verification, two byte comparisons, changed-line count, and path audit.

## File plan, allowlist, and forecast

Only these paths may change:

- `scripts/bun-lock-runtime.mjs` — resolver, maximum 80 changed lines.
- `scripts/sbom.mjs` — resolved generation and atomic replacement, maximum 35 changed lines.
- `scripts/verify-release-integrity.mjs` — exact graph validation while preserving checksums, maximum 65 changed lines.
- `scripts/__tests__/release-integrity.test.ts` — fixture helper and parameterized coverage, maximum 110 changed lines.

Conservative ceiling: 290 authored changed lines, leaving 10 lines of contingency below the hard 300 limit. Apply MUST count additions plus deletions after each RED/GREEN/refactor step and stop for re-scoping before crossing either a per-file cap or 300 total. No extra fixture, helper, manifest, lock, CI, `dist/`, or documentation path may be added.

## Delivery and rollback

One reviewable work unit keeps resolver, generator, verifier, and focused tests together. No generated SBOM is committed. Rollback reverts these four allowlisted paths as one unit, removing the resolver and restoring declared direct-only generation/verification without touching other release-integrity behavior.
