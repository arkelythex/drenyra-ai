# Proposal — Resolved SBOM Fidelity, Slice A

## Intent

Make the generated CycloneDX runtime SBOM faithfully represent the deterministic dependency graph resolved by the repository's Bun lockfile. Slice A replaces declared-range component versions with exact resolved versions, includes the complete required runtime transitive closure, distinguishes direct from transitive components, and emits/verifies dependency edges for that closure.

This is an independent follow-up to `release-integrity-evidence`. That change correctly limited its claim to declared dependency coverage; this proposal adds a new lockfile-resolved fidelity contract without correcting, reopening, or rewriting the prior evidence.

## Problem

The current SBOM reports only direct `package.json` runtime dependencies and uses declared ranges such as `^8.17.1` as CycloneDX component versions. The verifier enforces that representation and does not inspect `bun.lock`.

Consequently, release consumers cannot reliably determine:

- the exact direct versions installed;
- which transitive runtime packages are present;
- whether a component is direct or transitive;
- whether the SBOM dependency graph closes over the required runtime dependency edges.

This weakens vulnerability matching and supply-chain inspection because declared ranges and a direct-only component list do not identify the resolved runtime graph.

## Goals

1. Resolve every direct runtime dependency from `bun.lock` to one exact version.
2. Follow only required `dependencies` edges to compute the complete direct and transitive runtime closure.
3. Emit every resolved runtime component with `scope: "required"` and an explicit direct/transitive classification.
4. Emit deterministic CycloneDX dependency relationships covering the root-to-direct edges and all required component-to-component edges in the resolved closure.
5. Update verification to independently recompute the expected closure and reject version, classification, scope, component-coverage, or dependency-edge drift.
6. Preserve deterministic output and clear fail-closed behavior for missing, malformed, ambiguous, incomplete, or inconsistent inputs.
7. Deliver under strict TDD with a hard ceiling of 300 authored changed lines, counted as additions plus deletions.

## Proposed Slice A

Implement one bounded work unit: **deterministic Bun-lockfile-resolved required-runtime SBOM fidelity**.

The slice will:

- parse the existing text Bun lockfile as the resolution source of truth;
- require each runtime-reachable package name to map to exactly one lock record;
- start from `package.json` runtime dependencies and traverse only lockfile `dependencies` edges;
- emit exact resolved versions for direct and transitive components;
- mark all included components `scope: "required"`;
- classify each component as `direct` or `transitive` using one deterministic CycloneDX property;
- emit a sorted, closed dependency graph containing root-to-direct and required package-to-package edges;
- make the verifier recompute and compare the complete expected component and edge sets;
- add focused strict-TDD coverage for valid, incomplete, inconsistent, and ambiguous graphs.

The implementation must reuse one small shared resolver between generation and verification while ensuring the verifier compares generated output against independently recomputed lockfile expectations rather than trusting SBOM claims.

## Business and Operational Rules

- The SBOM must describe lockfile-resolved required runtime dependencies, not source-import usage or declared semver intent.
- Exact lockfile versions are authoritative for included components.
- Direct dependencies are the names declared under `package.json` `dependencies`; packages reached only through required lockfile edges are transitive.
- Every included component must have `scope: "required"`.
- Closure follows `dependencies` edges only. Optional, peer, optional-peer, and development dependencies must not enter components or dependency edges.
- Every required edge whose endpoints are in the runtime closure must be represented, with deterministic ordering and no dangling references.
- The manifest and lockfile root runtime dependency names must agree exactly.
- Zero or multiple lock records for any runtime-reachable package name is unsupported and must fail closed; Slice A must not guess a resolution.
- Missing or unreadable files, malformed lockfile data, unresolved reachable dependencies, inconsistent root dependencies, duplicate/ambiguous records, incomplete SBOM coverage, wrong versions, wrong classifications/scopes, or edge mismatch must produce a clear non-zero failure.
- Existing deterministic output guarantees remain in force: identical inputs produce byte-identical output without wall-clock data.
- The authored diff must remain at or below 300 changed lines. If the required contract cannot fit, implementation stops for re-scoping; no size exception is permitted.

## Scope

### In Scope

- A compact resolver for the existing Bun text lockfile format.
- Exact resolved versions for direct and transitive required runtime components.
- Complete required-runtime closure by following lockfile `dependencies` edges.
- Deterministic direct/transitive component classification.
- Required CycloneDX component scope.
- Deterministic root-to-direct and package-to-package dependency-edge closure.
- Generator updates for the resolved component and dependency graph.
- Verifier updates for exact versions, complete component coverage, classification, scope, edge coverage, no extras, and no dangling edges.
- Focused strict-TDD tests, including fail-closed malformed, missing, ambiguous, and partial graph cases.

### Non-Goals

- Changes to `package.json`, `bun.lock`, package scripts, package contents, or package metadata.
- CI workflow, job, runner, or release-pipeline changes.
- Artifact signatures, signing, provenance attestations, keys, or trust-policy work.
- Static import, bundle, or runtime usage-graph analysis.
- Optional, peer, optional-peer, platform-conditional, or development dependencies.
- Multi-version resolution, semver-based record selection, or nested-version support; ambiguous names fail closed.
- Changes to checksum behavior or other release-integrity surfaces.
- Editing prior `release-integrity-evidence` artifacts or folding this work into that completed change.
- Committing generated `dist/sbom.json` or any other generated release artifact.

## Affected Areas

Expected implementation is limited to:

- the SBOM generator under `scripts/`;
- the release-integrity verifier under `scripts/`;
- at most one compact shared Bun-lockfile resolver under `scripts/`;
- focused release-integrity tests and their local fixtures/helpers.

No package manifest, lockfile, CI, generated artifact, domain module, signature surface, or unrelated active-change path may be modified.

## Strict TDD Acceptance Evidence

Implementation must follow RED → GREEN → TRIANGULATE → REFACTOR and record exact commands and results in later apply/verification artifacts.

### RED

Focused tests must first demonstrate that current behavior fails to provide:

1. exact locked versions for all direct runtime dependencies;
2. complete required transitive component closure;
3. correct direct/transitive classification and required scope;
4. root-to-direct and complete required package-edge closure;
5. rejection of omitted/extra components, wrong versions, wrong classifications/scopes, missing/extra/dangling edges, and ambiguous lock records;
6. exclusion of optional, peer, optional-peer, and development dependencies.

### GREEN, TRIANGULATE, and REFACTOR

- The minimum resolver, generator, and verifier changes make the focused tests pass.
- Triangulation includes at least one branched or shared transitive graph and one malformed or partial graph, preventing a fixture-specific linear traversal.
- Two generations from identical inputs are byte-identical.
- Applicable full tests, type checks, and existing package verification pass, except only explicitly evidenced pre-existing failures unchanged by this slice.
- A final path audit confirms that package, lock, CI, signature, usage-graph, generated, and unrelated files are untouched.
- Final authored additions plus deletions are no more than 300 lines.

## Success Criteria

The proposal succeeds when:

- each direct runtime dependency is represented with its exact `bun.lock` version;
- every package reachable through required `dependencies` edges is represented exactly once;
- direct and transitive components are unambiguously classified and all included components use required scope;
- the CycloneDX dependency graph contains deterministic root-to-direct edges and all required edges within the resolved closure, with no missing, extra, or dangling references;
- optional, peer, optional-peer, and development dependencies are absent;
- verification recomputes the expected lockfile graph and fails closed on any fidelity mismatch or unsupported ambiguity;
- output remains deterministic and generated artifacts remain uncommitted;
- strict-TDD evidence is recorded and the authored diff is at most 300 lines;
- no excluded path or concern is modified.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Full dependency-edge closure pushes the slice above 300 authored lines. | High | Keep one compact graph representation and shared resolver; stop and re-scope before implementation rather than dropping fidelity checks or taking an exception. |
| A future lockfile resolves multiple versions of the same runtime package name. | Medium | Fail closed with a clear unsupported-ambiguity error; defer multi-version resolution to a separately designed slice. |
| Generator and verifier share resolver defects. | Medium | Verify serialized SBOM claims against a freshly recomputed expected graph and triangulate fixtures with branching, shared transitives, exclusions, and corruption. |
| Lockfile format assumptions drift after a Bun upgrade. | Medium | Validate the required record shapes and lockfile version explicitly; reject unknown or malformed structures rather than silently omitting packages or edges. |
| Existing generated SBOMs contain ranges and direct-only graphs. | Low | Treat regeneration as required; `dist/` is generated and uncommitted, so no repository migration is needed. |
| Scope expands into optional dependencies, usage analysis, signing, package wiring, or CI. | High | Enforce explicit non-goals and final path audit; any such requirement needs a separate proposal. |

## Rollback

Rollback is one independent release-layer reversal:

1. remove the shared Bun-lockfile resolver if introduced;
2. revert the SBOM generator to declared direct-dependency output;
3. revert the verifier to its prior declared-dependency contract;
4. remove only the focused tests and fixtures added for Slice A.

No package manifest, lockfile, CI, signature, or committed artifact migration is involved. Regenerated `dist/sbom.json` remains outside version control and is not a rollback surface.

## Proposal Question Round

Automatic execution prevented an interactive question round. The proposal therefore proceeds with these product assumptions for later review:

1. **Primary outcome:** supply-chain consumers and vulnerability scanners need an exact, graph-complete required-runtime inventory rather than declared intent.
2. **Failure tradeoff:** blocking release verification on unsupported or ambiguous lockfile data is preferable to emitting a partial SBOM.
3. **Compatibility:** previously generated direct-only/range-based SBOMs may fail the updated verifier and should be regenerated, not accepted through a compatibility mode.
4. **Graph meaning:** dependency-edge closure means every required `dependencies` edge among runtime-closure components, in addition to root-to-direct edges; it does not include usage, optional, peer, or development relationships.

These assumptions should be corrected before specification if they do not match product or release-policy expectations; a second question round is unnecessary unless one of them changes.

## Next Recommended Phase

Proceed to `spec` for Slice A only. The specification must preserve exact versions, complete required component and dependency-edge closure, direct/transitive classification, required scope, deterministic fail-closed behavior, strict TDD, explicit exclusions, and the hard 300 authored-line ceiling.
