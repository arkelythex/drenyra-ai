# Tasks — Resolved SBOM Fidelity, Slice A

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–290 (resolver ≤80, sbom ≤35, verifier ≤65, tests ≤110; hard cap 300, no exception) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

## Context and ground truth

This slice makes `dist/sbom.json` (CycloneDX 1.5) represent the runtime graph **actually resolved by `bun.lock`** instead of `package.json` declared ranges and a direct-only list. Exact resolved versions replace range strings, the complete required-runtime transitive closure is included, every component is `scope: "required"` with a `drenyra:resolution = direct|transitive` property, and the `dependencies` graph closes over root-to-direct plus all required package-to-package edges. The verifier independently recomputes the expected closure and fails closed on any drift.

Verified ground truth (do not re-litigate):

- `bun.lock` is `lockfileVersion: 1`; `packages` is `name → array<record>`; each record is `[name@version, path, {dependencies?, optionalDependencies?, peerDependencies?, optionalPeers?, …}, integrityHash?]`.
- **`optionalPeers` is `string[]`** (e.g. `pg.optionalPeers = ["pg-native"]`), as corrected in the spec. The resolver validates this shape and never traverses it. `dependencies`, `optionalDependencies`, `peerDependencies` are string-to-string maps.
- The `pg` record has `dependencies` (5 required edges), `optionalDependencies: { pg-cloudflare }`, `peerDependencies: { pg-native }`, `optionalPeers: ["pg-native"]`. Closure via `dependencies` only yields 19 required-runtime components; `pg-cloudflare`, `pg-native`, and all dev-only packages are excluded.

## Hard constraints (non-negotiable)

- **Four-file allowlist only:** new `scripts/lib/bun-lockfile.mjs`, `scripts/sbom.mjs`, `scripts/verify-release-integrity.mjs`, `scripts/__tests__/release-integrity.test.ts`. No package.json, bun.lock, CI, `dist/`, checksum, signature, usage-graph, or prior-change edits.
- **Strict TDD:** focused RED tests authored before the production changes that make them pass; then GREEN → TRIANGULATE → REFACTOR.
- **Deterministic + fail closed:** identical inputs → byte-identical output, no wall clock. Missing/unreadable/invalid lockfile, unsupported version, root-name drift, malformed records/maps, unresolved names, zero-or-multi-record ambiguity, malformed SBOM, coverage/property/version/scope/edge drift, and output failures all exit non-zero naming the input — never partial or silent.
- **≤300 authored changed lines (additions + deletions), no size exception.** Count after every step; stop for re-scoping before crossing 300 total or a per-file cap.
- **Shared resolver reused** by generator and verifier; the verifier still recomputes expectations independently and never trusts SBOM claims.

## File budget tracking (update after each step)

| File | Cap | Accumulated |
|------|-----|-------------|
| `scripts/lib/bun-lockfile.mjs` (new) | 80 | 80 |
| `scripts/sbom.mjs` | 35 | 35 |
| `scripts/verify-release-integrity.mjs` | 65 | 50 |
| `scripts/__tests__/release-integrity.test.ts` | 110 | 109 |
| **Total** | **≤300** | **274** |

## Tasks

### Task 1 — RED: focused tests demonstrate the missing behavior (write-first)

- [x] Extend the existing temporary mini-repo harness in `scripts/__tests__/release-integrity.test.ts`: add a compact `bun.lock` fixture helper (text JSON v1, `workspaces[""].dependencies` mirroring manifest deps, `packages` map with valid `[name@version, "", {dependencies, optionalDependencies, peerDependencies, optionalPeers}, hash]` records), and copy the new `scripts/lib/bun-lockfile.mjs` into the fixture's `scripts/lib/` alongside the existing scripts so the generator/verifier resolve from the copied repo root. <!-- sdd-owner: implementation -->
- [x] RED — exact resolved versions + complete transitive closure: with a branched lockfile (two direct deps sharing a transitive) assert the SBOM components carry exact locked versions (e.g. `ajv` → `8.20.0`, not `^8.17.1`) and every required transitive package appears exactly once (deduplicated), while `pg-cloudflare` (optional), `pg-native` (peer/optional-peer), and dev-only packages are absent. <!-- sdd-owner: implementation -->
- [x] RED — classification + scope: assert every component has `scope: "required"` and exactly one `drenyra:resolution` property, `direct` for manifest-declared names and `transitive` otherwise. <!-- sdd-owner: implementation -->
- [x] RED — root-to-direct + full edge closure: assert the metadata root's `dependsOn` lists the sorted direct deps and each closure component's entry lists every required `dependencies` neighbor, with no reference to excluded packages and no dangling refs; two generations from identical inputs are byte-identical (no wall clock). <!-- sdd-owner: implementation -->
- [x] RED — verifier drift rejection (table-driven): assert `verify-release-integrity.mjs` exits non-zero, naming the drift, for a missing component, extra component, wrong exact version, wrong scope, wrong `drenyra:resolution`, missing/extra/duplicate/dangling edge, duplicate component, and malformed SBOM. <!-- sdd-owner: implementation -->
- [x] RED — resolver fail-closed (table-driven lock mutations): assert non-zero, input-naming errors for missing/unreadable `bun.lock`, unsupported `lockfileVersion`, malformed record tuples/maps, `optionalPeers` not an array of strings, root-name drift between `workspaces[""].dependencies` and `package.json` `dependencies`, a reachable name with zero records, and a reachable name with >1 records (unsupported ambiguity). <!-- sdd-owner: implementation -->
- [x] Record baseline: run `bunx vitest run scripts/__tests__/release-integrity.test.ts` and capture the RED failures; confirm the new cases fail for the missing behavior and existing checksum/cwd-independence/no-partial-output cases are still active (to be made to pass with the fixture lockfile). <!-- sdd-owner: implementation -->

### Task 2 — GREEN: create the shared resolver `scripts/lib/bun-lockfile.mjs` (new)

- [x] Create `scripts/lib/bun-lockfile.mjs` exporting `resolveRuntimeGraph(root)` → `{ root: {name,version}, direct: string[], nodes: Array<{name,version,direct,dependsOn:string[]}> }`. It synchronously reads `package.json` and `bun.lock` from `root`; validates manifest name/version/dependencies strings, `lockfileVersion: 1`, the `workspaces[""]` root workspace, package-record tuple shape, `path` string (empty for registry), `dependencies`/`optionalDependencies`/`peerDependencies` string-to-string maps, and `optionalPeers` (when present) as an array of strings. <!-- sdd-owner: implementation -->
- [x] Implement unique-record resolution + root consistency: assert root `workspaces[""].dependencies` names exactly equal `package.json` `dependencies` names; derive each package's exact version by removing the `${name}@` prefix from its record's first element (no `@`-split, so scoped names stay safe); fail closed on zero or >1 records for any reachable name (no semver selection, no merge). <!-- sdd-owner: implementation -->
- [x] Implement required-runtime closure: start from sorted `package.json` `dependencies` names; follow only record `dependencies` keys; mark `direct` by membership in the manifest-name set; deduplicate via a `seen` set (cycles terminate, shared transitives emitted once); sort nodes by name and every `dependsOn` list. Return only sorted plain data — no output, logging, process exit, or range-satisfaction hardening in this module. <!-- sdd-owner: implementation -->
- [x] Keep the module ≤80 changed lines and free of any non-allowlisted import/path. <!-- sdd-owner: implementation -->

### Task 3 — GREEN: resolved generator `scripts/sbom.mjs`

- [x] Have `scripts/sbom.mjs` import `resolveRuntimeGraph` and compute the complete graph before touching `dist/sbom.json`; map each node to `{ type: "library", "bom-ref": name, name, version, scope: "required", properties: [{ name: "drenyra:resolution", value: direct ? "direct" : "transitive" }] }`; metadata root `bom-ref` = package name and `version` = manifest version. Declared ranges must not appear as component versions. <!-- sdd-owner: implementation -->
- [x] Emit the closed `dependencies` array (root `ref` with sorted direct `dependsOn`, then one entry per node including leaves, sorted by `ref`); keep pretty JSON + trailing newline, no timestamp. <!-- sdd-owner: implementation -->
- [x] Fail-closed atomic write: validate `dist/` exists/writable; serialize fully first, write a sibling temp file, then rename over `sbom.json`; on any failure remove the temp and never replace the prior valid SBOM with partial bytes. Keep the existing `sbom:`-prefixed catch that exits non-zero without a stack trace. <!-- sdd-owner: implementation -->
- [x] Keep `scripts/sbom.mjs` ≤35 changed lines. <!-- sdd-owner: implementation -->

### Task 4 — GREEN: resolved verifier `scripts/verify-release-integrity.mjs`

- [x] Have `scripts/verify-release-integrity.mjs` import `resolveRuntimeGraph(root)` and recompute the expected contract at verification time; index SBOM components by name, reject duplicates, and compare the actual name set against resolved nodes. Never trust SBOM claims and never accept a declared range as a component version. <!-- sdd-owner: implementation -->
- [x] For each expected node assert exact version, `type: "library"`, `scope: "required"`, matching `bom-ref`, and exactly one `drenyra:resolution` property with the expected value; reject missing/extra/wrong-version/wrong-scope/wrong-classification components, naming the drift. <!-- sdd-owner: implementation -->
- [x] Index dependency entries (reject duplicate refs), require exactly the root plus every node, compare each sorted/deduplicated `dependsOn` set with the recomputed set, and reject dangling refs. Run this SBOM graph validation before the existing checksum verification, preserving the current checksum behavior. Keep the `verify-release-integrity:`-prefixed catch that exits non-zero without a stack trace. <!-- sdd-owner: implementation -->
- [x] Keep `scripts/verify-release-integrity.mjs` ≤65 changed lines. <!-- sdd-owner: implementation -->

### Task 5 — GREEN: make the focused suite green and count the budget

- [x] Run `bunx vitest run scripts/__tests__/release-integrity.test.ts`; confirm the RED cases now pass and the existing checksum/cwd-independence/no-partial-output cases still pass. Confirm two generations from identical inputs are byte-identical. <!-- sdd-owner: implementation -->
- [x] Count authored additions + deletions across the four files and confirm total ≤300 and each file ≤ its cap; record the count. If the contract cannot fit, stop and re-scope — do not take a size exception. <!-- sdd-owner: implementation -->

### Task 6 — TRIANGULATE: hardening beyond the linear fixture

- [x] Add at least one branched/shared transitive graph case (two directs sharing a transitive, deduplicated) and one malformed/partial graph case; add `optionalPeers` as a `string[]` validation case to prove exclusion without traversal. Confirm exclusion of optional/peer/optional-peer/dev packages in at least one fixture. <!-- sdd-owner: implementation -->

### Task 7 — REFACTOR and full evidence

- [x] Refactor for clarity without changing behavior or growing the line budget; re-run `bunx vitest run scripts/__tests__/release-integrity.test.ts` to confirm still green. <!-- sdd-owner: implementation -->
- [x] Run the applicable full tests, typecheck, and package verification (`bun run typecheck`, `bun run test`, `bun run verify:package` where configured); record exact commands/results; any pre-existing baseline failures stay unchanged and are attributed as pre-existing/unrelated. <!-- sdd-owner: implementation -->
- [x] Final evidence: run two generations from identical inputs and confirm byte-identical `dist/sbom.json`; re-run the changed-line count; run a path audit confirming only the four allowlisted paths changed and `package.json`, `bun.lock`, CI, `dist/` generated artifacts, checksum, signature, and unrelated paths are untouched. Record rollback boundary (revert these four paths as one unit). <!-- sdd-owner: implementation -->

### Task 8 — Post-apply bounded review and lifecycle gate

- [x] Start or reuse a bounded review of the four allowlisted paths against the corrected release-integrity spec, confirming strict TDD order, the `optionalPeers` string-array shape, determinism, fail-closed behavior, and the ≤300-line budget; record the review result. <!-- sdd-owner: parent -->
- [x] Apply the resolved review/delivery gate (single PR, no chaining, size-exception) and confirm the change is ready to archive only after the review allows it. <!-- sdd-owner: parent -->
