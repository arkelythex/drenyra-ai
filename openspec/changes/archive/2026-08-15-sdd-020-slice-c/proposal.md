# Proposal — SDD-020 Slice C: Program-Lock-Aware Install

> Change: `sdd-020-slice-c` · Phase: proposal · Store: OpenSpec

## Intent

Make the promoted Drenyra Dominion composition visible to installed `drenyra-ai` packages without reading a branch or requiring network access. The release process will derive a bundled manifest from the promoted program lock, and package-level install and doctor flows will read and report that manifest as offline evidence of the promoted composition.

This completes the deferred SDD-020 slice C boundary: every configured host can identify the promoted artifact rather than treating the package version and `PINNED_AI_COMPOSITION` constants as the complete composition authority.

## Context

SDD-020 defines a universal agent configurator whose install, doctor, sync, upgrade, and rollback workflows keep hosts on a verified composition. Runtime program-lock consumption was intentionally deferred until SDD-010 promoted the Drenyra Dominion program lock through the release train. That promotion is now complete, so slice C is unblocked.

The promoted lock remains a program document at `openspec/programs/drenyra-dominion/program-lock.json`. It is not included by the npm package's published `files` boundary. The package therefore needs a release-generated, package-shipped representation of the lock's promotable facts rather than direct runtime access to the program document.

## Roadmap and Architecture Alignment

This change advances the 16-program Peru v1 roadmap through the Drenyra Dominion foundation: verified agent-host composition is infrastructure for later program capabilities, not a fiscal decision surface. It remains within the approved architecture boundaries:

- Drenyra AI reports and configures advisory runtime composition; it does not make deterministic accounting, authorization, journal, evidence, or SUNAT decisions.
- The audit ledger and accounting journal are unchanged.
- The bundled manifest is release evidence, not memory and not a new normative contract.
- The configurator remains a library below `cmd/`; command adapters may consume it, but the library must not reverse-import from `cmd/` or `agents/`.
- No dependency on Drenyra Core, Drenyra Pi, Drenyra Engram, or a remote service is introduced.

## Current-State Gap

Install, sync, upgrade, rollback, and doctor currently have zero program-lock awareness:

- `install` derives the package version from `package.json` and records package-owned managed assets.
- Per-host runtime/model/tool choices come from `PINNED_AI_COMPOSITION` constants.
- `upgrade` gates requested versions against the packaged version.
- `doctor` compares the recorded composition version with the packaged version.
- The promoted program lock is not shipped in the npm package and cannot be read by an installed package.
- The capabilities boundary currently asserts that the integration claim does not mention `program-lock`.

These mechanisms answer which bytes and pins the current package manages, but not which host artifact and revision were verified and promoted by the program release train. As a result, an installed package cannot report offline evidence that its composition comes from a promoted artifact rather than ambient branch state.

## Proposed First Slice

### 1. Release-generated bundled composition manifest

Add a deterministic release-process step that reads the promoted program lock and emits a JSON resource under `dist/`, where it is automatically included in the npm tarball. The emitted manifest will contain only the lock's non-carrying promotable subset:

- promoted host version;
- verified revision;
- host artifact SHA-256 digest;
- promoted checksum-set SHA-256;
- attestation tag.

The generator will follow the discipline established by `scripts/checksum-lock.mjs`: no network access, no branch or `HEAD` lookup, no carrying-commit SHA, and deterministic output derived only from the supplied promoted lock. It will reject missing, malformed, non-promoted, inconsistent, or carrying-commit-bearing source data rather than inventing fallback evidence.

The generated file is a package resource, not a second program lock. The source lock remains authoritative, and its schema is unchanged.

### 2. Library-level manifest reader

Add a reader under `configurator/` that locates and strictly parses the bundled manifest offline using the established package-root resolution semantics of `getPackageMetadata()`. The package-root primitive must be reused, injected, or moved to a library-safe location without creating a reverse import from `configurator/` into `cmd/`.

The reader will distinguish valid evidence from absent or invalid evidence and will not fall back to `process.cwd()`, network retrieval, package-version inference, branch state, or hardcoded promoted facts.

### 3. Install and doctor surfacing

`install` will report the promoted composition carried by the bundled manifest alongside the installed package identity. Doctor will add a program-lock-awareness diagnostic that surfaces the promoted version, verified revision, artifact digest, checksum-set digest, and attestation tag, including whether the manifest is valid and how its promoted version relates to the packaged version.

The known version skew is intentional evidence, not an installation blocker in this slice: the promoted host is `0.4.0` while the current package is `0.4.1`. Install and doctor will record and report that distinction clearly. They will not claim that `0.4.1` itself is promoted and will not fail solely because the packaged version is ahead of the latest promoted checkpoint.

### 4. Declared capability boundary

Update the shared install/doctor capability claim to state program-lock awareness. The existing `/program-lock/i` negative boundary assertion in `cmd/__tests__/capabilities-doctor.test.ts` must be replaced with an assertion for the new, accurate claim.

## Design Decisions

1. **Bundle rather than fetch.** The promoted subset ships under `dist/`; runtime access is deterministic and offline. A GitHub release asset or program-lock fetch at install time is rejected.
2. **Emit only non-carrying facts.** The manifest includes the verified revision and promoted digests, never the commit that carries the lock. This preserves the bootstrap rule and avoids self-reference.
3. **Keep the manifest minimal.** Its shape mirrors only the lock fields needed to identify and audit the promoted host artifact. It excludes sibling-repository state, test counts, visibility metadata, notes, and other lock content not consumed by this slice.
4. **Keep consumption in the library layer.** Parsing and validation belong in `configurator/`; `cmd/` remains a thin presentation adapter. Package-root resolution must be shared without reversing the dependency direction.
5. **Report skew; do not hard-gate it yet.** Promoted and packaged versions are separate facts. Equality enforcement is deferred until the release train promotes the shipping package version and the product policy for ahead-of-promotion packages is explicit.
6. **Add a dedicated doctor diagnostic.** Program-lock awareness is independently visible rather than being folded ambiguously into the existing `package-pin` diagnostic, which continues to compare managed-state and packaged versions.

## Scope

### In scope

- A no-network release script that generates the bundled manifest from the promoted lock.
- Release/build/package-integrity wiring required to ensure the manifest ships under `dist/`.
- Strict manifest typing, parsing, validation, and package-relative reading at the configurator library level.
- Install output that reports the bundled promoted composition.
- A doctor diagnostic and declared capability claim for program-lock awareness.
- Tests for deterministic generation, carrying-commit exclusion, malformed/absent manifest handling, package-root resolution, install reporting, doctor reporting, version skew, and package inclusion.
- Updating `cmd/__tests__/capabilities-doctor.test.ts` so its `/program-lock/i` boundary assertion reflects the new claim.

### Affected areas

- Release generation and packed-artifact integrity under `scripts/` and `dist/`.
- Configurator composition evidence reading and diagnostics.
- Install command output.
- Doctor and shared declared-capability output.
- Focused script, configurator, install, doctor, and release-integrity tests.

## Non-Goals

- No runtime or install-time network fetch of the program lock or release assets.
- No hard equality gate between promoted version `0.4.0` and packaged version `0.4.1`.
- No change to the program-lock schema, promotion process, bootstrap rule, or attestation format.
- No carrying-commit SHA in the bundled manifest.
- No sibling-repository federation or cross-repository runtime verification.
- No new consumption by sync, upgrade, rollback, host pin generation, or managed-state transition logic beyond what is necessary to surface the manifest through install and doctor.
- No replacement of `PINNED_AI_COMPOSITION`; host runtime/model/tool pins remain a separate package-owned axis.
- No host installation, fiscal authorization, accounting, journal, evidence, memory, or SUNAT behavior.

## Product Tradeoffs

Bundling creates a release-time snapshot that can lag behind the package version, but it preserves offline operation and makes that lag explicit. Hard-gating version equality now would make the current `0.4.1` package unusable against the promoted `0.4.0` checkpoint; silently treating `0.4.1` as promoted would be a false claim. This slice therefore favors truthful observability over premature enforcement. A later slice may introduce an equality or compatibility policy once release-train sequencing guarantees an appropriate promoted checkpoint.

The manifest duplicates a small subset of program-lock data inside the package. Generation and package-integrity checks are required to control that drift; hand-maintained package metadata is not acceptable.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Carrying-commit or branch-state leakage | Breaks the bootstrap rule and makes evidence self-referential | Generate only from allowlisted non-carrying lock fields; prohibit `HEAD`/network inputs; test that carrying commit data cannot appear. |
| Promoted/package version skew is misrepresented | Users may believe an unpromoted package is promoted, or valid installs may be blocked | Report both versions explicitly; classify skew without hard failure; never synthesize promotion status for the package version. |
| Generated manifest drifts from the source lock | Shipped evidence becomes stale or inconsistent | Deterministic generation from the lock, strict field validation, digest consistency checks, and release/package-integrity verification. |
| Missing or malformed bundled resource | Install or doctor could report fabricated evidence | Strict absent/invalid/valid classification; no ambient fallback; doctor reports unverifiable evidence and install does not claim promotion. |
| Layer reversal through package metadata access | Configurator becomes coupled to command adapters | Share or inject package-root resolution through a library-safe boundary; prohibit `configurator/` imports from `cmd/`. |
| Capability output diverges across CLI/MCP surfaces | Different clients make conflicting claims | Update the shared declared-surface capability path and its boundary tests. |
| Review size exceeds the configured budget | Review quality degrades | Plan release generation/package verification and configurator consumption/surfacing as separable delivery units if task forecasting exceeds the review budget. |

## Rollback

Rollback is additive and package-scoped:

1. Remove the release-generation step and bundled resource from the package build.
2. Remove the configurator reader and install/doctor/capability surfacing.
3. Restore the prior capability boundary assertion and output shape.

Existing managed manifests, host pins, install assets, upgrade/rollback state, and the promoted program lock remain unchanged. Because this slice does not hard-gate installation or mutate the lock schema, rollback requires no user-state migration and returns behavior to package-version and `PINNED_AI_COMPOSITION` awareness only.

## Success Criteria

- The release process deterministically emits a package-shipped manifest from the promoted program lock with exactly the approved promotable facts.
- The bundled manifest contains no carrying-commit SHA and requires no network or branch-state access.
- The configurator reads the resource relative to the installed package root and strictly reports valid, absent, and invalid states without cwd or network fallback.
- `install` reports the promoted composition from the bundled manifest.
- Doctor surfaces a dedicated program-lock-awareness diagnostic with promoted identity and packaged/promoted version relationship.
- The `0.4.0` promoted versus `0.4.1` packaged skew is recorded and reported, not hard-gated or misrepresented.
- The shared capability claim and `capabilities-doctor.test.ts` boundary assertion accurately state program-lock awareness.
- Packed-artifact verification proves the manifest is included in the published package.
- The full test suite, typecheck, build, and release-integrity checks are green.

## Proposal Question Round

The planning context is sufficiently constrained to draft this proposal without blocking, but the following product assumptions should be confirmed before specification:

1. Is the primary user-facing outcome truthful audit visibility of the latest promoted checkpoint, even when the installed package is newer than that checkpoint? **Assumption:** yes; both identities are shown without implying the newer package is promoted.
2. Should a missing or invalid bundled manifest block installation? **Assumption:** no hard installation block in this slice, but install must not claim promotion and doctor must surface the evidence as unavailable or invalid.
3. Which lock facts are necessary for first-slice auditability? **Assumption:** promoted version, verified revision, host artifact digest, checksum-set digest, and attestation tag are sufficient; attestation asset and sibling repository facts are deferred.
4. Does program-lock awareness apply beyond install and doctor in this slice? **Assumption:** no; sync, upgrade, rollback, and pin generation remain behaviorally unchanged.
5. What is the highest-cost wrong outcome? **Assumption:** falsely claiming that ambient or merely packaged code is promoted is worse than reporting an explicit version skew or unavailable evidence.

Corrections to these assumptions, or a second question round, should occur before the specification phase.
