# Release Integrity Specification

## Purpose

Release-integrity evidence lets a consumer prove that a packaged release is exactly the set of files its producer intended. For this change, that evidence is the CycloneDX SBOM (`dist/sbom.json`) generated from the built package, whose components and dependency graph MUST faithfully represent the runtime dependency graph actually resolved by the repository's Bun lockfile — exact resolved versions and the complete required-runtime transitive closure — rather than `package.json` declared ranges and a direct-only component list.

This is Slice A of the `resolved-sbom-fidelity` change: a lockfile-resolved required-runtime SBOM fidelity contract. It extends the release-integrity evidence domain established by the completed `release-integrity-evidence` change. The prior slice's SBOM verification claim — that verification covers declared runtime dependencies only and MUST NOT require lockfile-resolved versions — is superseded for SBOM fidelity by this contract; the prior change's artifacts, checksum verification, wiring, and CI requirements remain in force and are not reopened here.

The contract MUST be deterministic (identical inputs produce byte-identical output, no wall-clock data), MUST fail closed on any absent, malformed, ambiguous, or inconsistent input, and MUST be delivered under strict TDD within a hard ceiling of 300 authored changed lines.

## Requirements

### Requirement: Bun Lockfile v1 Parse and Validation

The system MUST read the repository's `bun.lock` text lockfile as the resolution source of truth, resolved from the script location so behavior is independent of the caller's current working directory. The lockfile MUST declare `lockfileVersion: 1`; the `packages` map MUST be an object whose keys are package names and whose values are arrays of records; each record MUST be an array whose first element is a `name@version` string, whose second element is a string path (empty for registry packages), and whose third element, when present, is an object whose `dependencies`, `optionalDependencies`, and `peerDependencies` values are string-to-string maps and whose `optionalPeers` value, when present, is an array of strings. The system MUST fail closed with a non-zero exit code and a clear error naming the input when the lockfile is absent, unreadable, not valid JSON, declares an unsupported `lockfileVersion`, or contains a record that violates these shapes. The system MUST NOT skip, guess, or partially interpret malformed records, and MUST NOT silently omit packages or edges.

#### Scenario: Valid v1 lockfile parses

- GIVEN a `bun.lock` with `lockfileVersion: 1` and well-formed `packages` records
- WHEN the generator or verifier reads it
- THEN parsing succeeds and processing continues with an exact resolved version derivable from every record

#### Scenario: Missing lockfile fails closed

- GIVEN `bun.lock` is absent or unreadable at the resolved repository root
- WHEN resolution runs
- THEN the run exits non-zero with a clear error naming `bun.lock`

#### Scenario: Unsupported lockfile version fails closed

- GIVEN a `bun.lock` declaring a `lockfileVersion` other than 1
- WHEN resolution runs
- THEN the run exits non-zero with a clear error naming the unsupported version

#### Scenario: Malformed package record fails closed

- GIVEN a `packages` record that is not an array, has no `name@version` first element, whose dependency maps are not string-to-string objects, or whose `optionalPeers` is not an array of strings
- WHEN resolution runs
- THEN the run exits non-zero with a clear error and no partial component or edge output is produced

### Requirement: Root Dependency Consistency Guard

The system MUST assert that the set of names under the lockfile root `workspaces[""].dependencies` exactly matches the set of names under `package.json` `dependencies`, with no additions and no omissions. The system MUST fail closed with a clear error naming the drift when the two name sets differ. This guard MUST run in both generation and verification so a lockfile and manifest that have diverged can neither produce nor pass a resolved SBOM.

#### Scenario: Matching root dependency names pass

- GIVEN the lockfile root `workspaces[""].dependencies` names are exactly `ajv`, `ajv-formats`, and `pg`, matching `package.json` `dependencies`
- WHEN resolution runs
- THEN processing continues without error

#### Scenario: Drifted root dependency names fail closed

- GIVEN the lockfile root `workspaces[""].dependencies` contains a name absent from `package.json` `dependencies`, or omits one
- WHEN resolution runs
- THEN the run exits non-zero with a clear error naming the drifted names

### Requirement: Unique Record Resolution

The system MUST resolve every runtime-reachable package name to exactly one lock record and MUST derive that package's exact resolved version from the `name@version` string in that record. Zero records or more than one record for any runtime-reachable name MUST fail closed with a clear non-zero error naming the package; the system MUST NOT guess a resolution, apply semver-based record selection, merge records, or defer the ambiguity. Multi-version resolution is explicitly unsupported in this slice.

#### Scenario: Unique record resolves to exact version

- GIVEN a runtime-reachable name with exactly one `packages` record whose first element is `pg@8.23.0`
- WHEN resolution runs
- THEN the package resolves to the exact version `8.23.0`

#### Scenario: Missing record fails closed

- GIVEN a runtime-reachable name that has no entry in the lockfile `packages` map
- WHEN resolution runs
- THEN the run exits non-zero with a clear error naming the unresolvable package

#### Scenario: Ambiguous multiple records fail closed

- GIVEN a runtime-reachable name with more than one lock record
- WHEN resolution runs
- THEN the run exits non-zero with a clear unsupported-ambiguity error naming the package and no version is chosen

### Requirement: Required-Runtime Closure over Dependencies Edges

The system MUST compute the required-runtime dependency closure starting from exactly the names declared under `package.json` `dependencies` and following only the `dependencies` edges of lockfile records. Optional dependencies, peer dependencies, optional-peer dependencies, platform-conditional dependencies, and development dependencies MUST NOT be traversed and MUST NOT appear in the closure. The closure MUST be complete and deduplicated: every package reachable through required `dependencies` edges MUST be included exactly once, and a package reached through multiple paths MUST NOT be duplicated.

#### Scenario: Direct and transitive runtime closure is complete

- GIVEN `package.json` declares `ajv`, `ajv-formats`, and `pg` as runtime dependencies and the lockfile's `dependencies` edges resolve the full pg runtime tree
- WHEN the closure is computed
- THEN it contains the three direct packages and every required transitive runtime package (including `pg-connection-string`, `pg-pool`, `pg-protocol`, `pg-types`, `pgpass`, `pg-int8`, `postgres-array`, `postgres-bytea`, `postgres-date`, `postgres-interval`, `split2`, `xtend`, `fast-deep-equal`, `fast-uri`, `json-schema-traverse`, `require-from-string`) exactly once, for a total of 19 components

#### Scenario: Optional and peer dependencies are excluded

- GIVEN the `pg` record declares `optionalDependencies` `pg-cloudflare` and `peerDependencies` `pg-native`
- WHEN the closure is computed
- THEN neither `pg-cloudflare` nor `pg-native` appears in the closure

#### Scenario: Development dependencies are excluded

- GIVEN `devDependencies` (`@biomejs/biome`, `@types/node`, `@types/pg`, `typescript`, `vitest`) and their transitive records are present in the lockfile
- WHEN the closure is computed
- THEN none of the dev-only packages or their transitive records appear in the closure

#### Scenario: Shared transitive package is deduplicated

- GIVEN two direct dependencies whose required edges both reach the same transitive package
- WHEN the closure is computed
- THEN the shared package appears exactly once

### Requirement: Exact Resolved Component Emission

The system MUST emit one CycloneDX component for every closure member and MUST NOT emit components for anything else. Each component MUST have `type: "library"`, `scope: "required"`, and a `version` equal to the exact resolved version from its lock record. Declared range strings MUST NOT appear as component versions. The output MUST remain valid CycloneDX 1.5 JSON with `bomFormat: "CycloneDX"`, `specVersion: "1.5"`, and a metadata root component whose `ref` is the `package.json` name and whose `version` is the `package.json` version.

#### Scenario: Exact resolved version replaces the declared range

- GIVEN `package.json` declares `"ajv": "^8.17.1"` and the lockfile resolves `ajv@8.20.0`
- WHEN the generator runs
- THEN the `ajv` component version is `"8.20.0"` and the string `"^8.17.1"` appears nowhere in the SBOM

#### Scenario: Every closure member is emitted exactly once

- GIVEN a required-runtime closure of 19 packages
- WHEN the generator runs
- THEN the SBOM contains exactly 19 components, one per closure member, with no duplicates and no absentees

#### Scenario: All components carry required scope

- GIVEN the generated SBOM for any valid input
- WHEN each component is inspected
- THEN every component has `scope: "required"`

### Requirement: Direct/Transitive Classification

The system MUST classify every emitted component deterministically: a component whose name is declared in `package.json` `dependencies` MUST be classified `direct`; every other emitted component MUST be classified `transitive`. Each component MUST carry exactly one classification property named `drenyra:resolution` whose value is exactly `direct` or `transitive`; no other classification value is permitted and no component MAY be tagged with more than one classification.

#### Scenario: Direct dependency classified direct

- GIVEN `ajv` is declared in `package.json` `dependencies`
- WHEN the generator runs
- THEN the `ajv` component has property `drenyra:resolution` equal to `direct`

#### Scenario: Transitive package classified transitive

- GIVEN `fast-deep-equal` is reached only through required `dependencies` edges
- WHEN the generator runs
- THEN the `fast-deep-equal` component has property `drenyra:resolution` equal to `transitive`

#### Scenario: Classification is deterministic and exclusive

- GIVEN the same inputs
- WHEN the generator runs twice
- THEN each component's classification property is identical across runs and each component carries exactly one classification property

### Requirement: Deterministic Closed Dependency Graph

The system MUST emit a `dependencies` array that is closed over the resolved closure: it MUST contain a root-to-direct edge from the metadata root component to every direct dependency, and MUST contain one entry per closure component listing every closure neighbor reachable through that component's required `dependencies` edges, with an empty list when the component has none. Every `ref` and every `dependsOn` entry MUST resolve to an emitted component; the graph MUST contain no missing required edge, no extra edge to an excluded package, and no dangling reference. Ordering MUST be deterministic: components sorted by name, dependency entries sorted by `ref`, and each `dependsOn` list sorted, so identical inputs produce identical graphs.

#### Scenario: Root-to-direct edge is present and sorted

- GIVEN the generated SBOM
- WHEN the `dependencies` array is inspected
- THEN the metadata root's entry lists exactly the sorted names of the direct dependencies

#### Scenario: All required closure edges are represented

- GIVEN a closure component whose record declares a `dependencies` edge to another closure member
- WHEN the `dependencies` array is inspected
- THEN the component's entry contains that neighbor, and no entry references `pg-cloudflare`, `pg-native`, or any dev-only package

#### Scenario: No dangling references

- GIVEN the generated SBOM
- WHEN every `ref` and `dependsOn` entry is resolved against the component set
- THEN every reference resolves to an emitted component

#### Scenario: Graph ordering is deterministic

- GIVEN identical inputs
- WHEN the generator runs twice
- THEN both `dependencies` arrays are byte-identical, including entry and list ordering

### Requirement: Deterministic Output

The system MUST produce byte-identical `dist/sbom.json` for identical inputs regardless of when generation runs or how object iteration is ordered. The SBOM MUST NOT contain wall-clock-derived content in any field that contributes to its bytes.

#### Scenario: Identical inputs produce identical bytes

- GIVEN the same repository state and lockfile
- WHEN the generator runs twice
- THEN both runs produce byte-identical `dist/sbom.json`

#### Scenario: Wall-clock time does not affect output

- GIVEN two generations of the same inputs at different wall-clock times
- WHEN the outputs are compared
- THEN they are byte-identical

### Requirement: Verifier Parity by Independent Recompute

The system MUST verify that the serialized SBOM exactly matches a fresh, independent recomputation of the expected resolved contract from `bun.lock` and `package.json` — component set, exact versions, `scope`, direct/transitive classification, and dependency-edge set — using the same deterministic resolution rules. The verifier MUST NOT trust SBOM claims, MUST NOT accept a declared range string as a component version, and MUST fail closed with a clear non-zero error naming the drift when the SBOM and the recomputed expectation disagree in any of the following ways: missing component, extra component, wrong exact version, wrong scope, wrong classification, missing required edge, extra edge, dangling reference, duplicate component, or malformed SBOM.

#### Scenario: Matching recomputed expectation passes

- GIVEN a `dist/sbom.json` whose components and dependency graph exactly match the closure recomputed from `bun.lock` and `package.json`
- WHEN the verifier runs
- THEN verification succeeds and exits zero

#### Scenario: Wrong resolved version fails verification

- GIVEN a `dist/sbom.json` whose `ajv` component version differs from the lockfile-resolved version
- WHEN the verifier runs
- THEN verification exits non-zero with a clear error naming the component and the expected version

#### Scenario: Omitted transitive component fails verification

- GIVEN a `dist/sbom.json` that omits one required transitive runtime package
- WHEN the verifier runs
- THEN verification exits non-zero with a clear error naming the missing component

#### Scenario: Extra component fails verification

- GIVEN a `dist/sbom.json` that includes a component absent from the recomputed closure, such as a dev-only or optional package
- WHEN the verifier runs
- THEN verification exits non-zero with a clear error naming the extra component

#### Scenario: Wrong classification fails verification

- GIVEN a `dist/sbom.json` whose `drenyra:resolution` value for one component disagrees with the recomputed direct/transitive classification
- WHEN the verifier runs
- THEN verification exits non-zero with a clear error naming the component

#### Scenario: Missing or dangling edge fails verification

- GIVEN a `dist/sbom.json` whose dependency graph omits a required edge or references a component not present in the SBOM
- WHEN the verifier runs
- THEN verification exits non-zero with a clear error naming the edge or dangling reference

#### Scenario: Declared-range SBOM fails verification

- GIVEN a `dist/sbom.json` generated by the prior direct-only/declared-range behavior
- WHEN the verifier runs
- THEN verification exits non-zero, and the failure is resolved by regenerating `dist/sbom.json`, not by a compatibility mode

### Requirement: Fail-Closed Generation

The system MUST NOT report success, write a partial SBOM, or overwrite an existing valid `dist/sbom.json` with partial content when any input fails validation. If `dist/` is missing or unwritable, generation MUST fail closed with a clear error naming the directory. Generation MUST exit zero only when the complete resolved SBOM was written successfully.

#### Scenario: No partial output on failure

- GIVEN a malformed or ambiguous lockfile input
- WHEN the generator runs
- THEN it exits non-zero and does not write or replace `dist/sbom.json` with partial content

#### Scenario: Missing output directory fails closed

- GIVEN `dist/` does not exist
- WHEN the generator runs
- THEN it exits non-zero with a clear error naming the missing `dist/` directory

### Requirement: Optional Range-Satisfaction Hardening

The system MAY additionally fail closed when a direct dependency's exact resolved version does not satisfy its declared range, using a minimal satisfier for exact, caret, tilde, and star ranges. This guard is defensive hardening only and MAY be omitted when the changed-line budget binds; it MUST NOT weaken any other fail-closed behavior.

#### Scenario: Non-satisfying resolved version fails closed when enforced

- GIVEN `package.json` declares `"ajv": "^8.17.1"`, the lockfile resolves `ajv@7.0.0`, and the guard is implemented
- WHEN resolution runs
- THEN the run exits non-zero with a clear error naming the package and version

### Requirement: TDD, Budget, Path-Audit, and Rollback Boundaries

The system MUST deliver this contract under strict TDD: focused tests demonstrating the missing behavior MUST be authored before the minimum production changes, covering valid, incomplete, inconsistent, and ambiguous graphs, at least one branched or shared transitive graph, one malformed or partial graph, exclusion of optional/peer/dev dependencies, determinism, and each verifier drift class. The total authored changed-line count (additions plus deletions) MUST NOT exceed 300, with no size exception; if the contract cannot fit, implementation MUST stop for re-scoping. Two generations from identical inputs MUST be byte-identical. Applicable full tests, type checks, and package verification MUST pass except only explicitly evidenced pre-existing failures, which MUST remain unchanged and be attributed as pre-existing. A final path audit MUST confine changes to the SBOM generator, the release-integrity verifier, at most one compact shared Bun-lockfile resolver under `scripts/`, and focused release-integrity tests and their fixtures; `package.json`, `bun.lock`, CI, generated `dist/` artifacts, signature surfaces, and unrelated paths MUST remain untouched. Rollback MUST be a single independent reversal: remove the shared resolver if introduced, revert the generator and verifier to their pre-slice behavior, and revert the focused tests and fixtures; regenerated `dist/sbom.json` is not a rollback surface.

#### Scenario: RED tests precede production changes

- GIVEN the implemented change
- WHEN the recorded evidence is inspected
- THEN focused tests demonstrating the missing behavior (exact locked versions, transitive closure, classification, scope, edge closure, exclusions, ambiguity fail-closed, verifier drift rejection) were authored before the production changes that make them pass

#### Scenario: Changed-line budget is respected

- GIVEN the implemented change is complete
- WHEN authored additions plus deletions are counted
- THEN the count is less than or equal to 300 lines, with no size exception

#### Scenario: Path audit confines the change

- GIVEN the implemented change is complete
- WHEN a path audit compares changed files against the declared scope
- THEN every changed path falls within the SBOM generator, the release-integrity verifier, at most one shared resolver under `scripts/`, and focused release-integrity tests and fixtures, and no excluded path (manifest, lockfile, CI, generated artifact, signature surface, unrelated module) is modified

#### Scenario: Determinism is evidenced

- GIVEN the implemented change is complete
- WHEN two generations from identical inputs are run
- THEN the two outputs are byte-identical

#### Scenario: Baseline failures stay unchanged and attributed

- GIVEN pre-existing baseline failures exist outside this change's scope
- WHEN the change's verification evidence is inspected
- THEN those failures remain unchanged, are documented as pre-existing and unrelated, and were neither fixed nor hidden by this change

#### Scenario: Rollback is a single independent reversal

- GIVEN the implemented change is complete
- WHEN rollback is performed
- THEN removing the shared resolver (if introduced), reverting the generator and verifier to their pre-slice behavior, and reverting the focused tests and fixtures fully restores the prior state without touching the manifest, lockfile, CI, or committed artifacts
