# Design — SDD-020 Slice C: Program-Lock-Aware Install

> Change: `sdd-020-slice-c` · Phase: design · Store: OpenSpec

## 1. Design Summary

Slice C adds a release-derived package resource, an offline configurator reader, and thin install/doctor presentation. The source of truth remains `openspec/programs/drenyra-dominion/program-lock.json`; the package ships only five allowlisted, non-carrying facts in `dist/promoted-composition.json`.

The dependency direction remains:

```text
program-lock.json
  -> scripts/promoted-composition.mjs
  -> dist/promoted-composition.json
  -> configurator/promoted-composition.ts
  -> cmd/commands/install.ts + cmd/commands/doctor.ts
  -> JSON CLI reports
```

No runtime path reads the program lock, invokes Git, uses `process.cwd()`, accesses the network, or infers promotion from `package.json`. The bundled resource is evidence, not a second lock, managed state, or a replacement for `PINNED_AI_COMPOSITION`.

## 2. Decisions

| ID | Decision | Rationale and code alignment |
| --- | --- | --- |
| D1 | Name the resource `dist/promoted-composition.json`. | `package.json` publishes the whole `dist` directory, so the resource ships without widening the npm `files` boundary. “Promoted composition” describes a derived checkpoint without calling it a second program lock. `scripts/checksums.mjs` already walks all of `dist`, so the file is automatically covered by `dist/checksums.txt`. |
| D2 | The manifest has exactly five fields: `version`, `verifiedRevision`, `hostArtifactSha256`, `setSha256`, and `attestationTag`. | These map directly to `currentVerified.host.version`, the mutually consistent verified revision, the host entry in `checksums.entries`, `checksums.setSha256`, and `attestation.tag`. No schema, timestamps, branch names, carrying SHA, sibling state, notes, or package version are copied. Strict readers reject any extra field. |
| D3 | Add `scripts/promoted-composition.mjs` as the first `release:generate` operation. | It mirrors `scripts/checksum-lock.mjs`: root from `import.meta.url`, bounded arguments, prefixed diagnostics, deterministic JSON, no Git/network/HEAD. It must run before `scripts/sbom.mjs` and `scripts/checksums.mjs`, allowing the checksum manifest to cover the new resource. `scripts/build.mjs` remains TypeScript compilation/shebang patching only. |
| D4 | Generation validates the complete source and reconciles the checksum set before writing. | The current lock uses `checksums.algorithm: "sha256"`, `canonicalization: "json-entries-v1"`, and hashes compact `JSON.stringify(entries)`, matching `checksum-lock.mjs`. The generator recomputes that digest, requires exactly one host checksum entry, and cross-checks the host repository/revision, attestation revision/digest, and carrying fields. This prevents a syntactically valid but internally inconsistent snapshot from shipping. |
| D5 | A failed generation leaves the selected output absent. | Before validation, the generator removes only its exact output and fixed sibling staging path. It validates in memory, writes deterministic bytes to a fixed staging file, then renames it to the output; every failure cleans both. A stale manifest from a prior build therefore cannot survive a failed release generation. No random or timestamp value enters the file or staging name. |
| D6 | Move package-root and package-metadata ownership to `configurator/package-metadata.ts`; keep `cmd/adapters/package-metadata.ts` as a compatibility re-export. | The proven `findPackageRoot()`/`getPackageRoot()` implementation currently lives under `cmd/adapters`, while `configurator/` must not reverse-import from `cmd/`. Relocation makes the primitive library-safe. Existing imports in `doctor.ts`, `upgrade.ts`, `declared-surface.ts`, `schema-loader.ts`, and tests remain stable through the adapter re-export, minimizing blast radius. Injection alone was rejected because it would leave the canonical package-root authority owned by the wrong layer and require every library caller to supply it correctly. |
| D7 | Add a separate `configurator/promoted-composition.ts`; do not place this logic in `managed-config.ts`. | `managed-config.ts` owns user-home managed state and transitions. The promoted composition is immutable package evidence with no home-directory dependency. Separation preserves the unchanged `managed.json` schema and avoids coupling install/doctor evidence to transition logic. |
| D8 | `readPromotedComposition()` returns a strict discriminated union: `valid`, `absent`, or `invalid`. | This follows the classification style already used by `readManagedState()`, but keeps package evidence independent. Missing means not shipped; malformed, unreadable, non-regular, symlinked, or root-resolution failures are invalid/unverifiable. Neither state receives inferred facts. |
| D9 | Production package-root resolution is the default; a package-root override exists only as an explicit test seam. | `readPromotedComposition()` calls relocated `getPackageRoot()` unless `deps.packageRoot` is supplied. Commands never supply the override. Tests can build isolated package fixtures without changing cwd or mutating the real `dist`. There is no cwd fallback in either path. |
| D10 | Install adds a `promotedComposition` report object but does not change `installIntegrations()` or `InstallManifest`. | `installIntegrations()` currently writes `managed.json`; changing its return/persisted shape would violate scope. `installCommand()` reads package evidence only for output. It retains existing `version` and adds explicit package/evidence identities. Absent or invalid evidence is reported unavailable while installation still returns 0. |
| D11 | Version relationship is `matches` or `differs`, not an ordering gate. | The required `0.4.1` package versus promoted `0.4.0` case is truthfully recorded as `differs`. The slice does not create compatibility policy or claim that the package is promoted. Avoiding `ahead`/`behind` also avoids introducing prerelease precedence policy unrelated to observability. |
| D12 | Doctor appends a dedicated rich `program-lock-awareness` check to `{status, checks, readonly}`. | `doctor.ts` already aggregates generic checks and derives overall status from `ok`. A valid manifest is `ok: true` even when versions differ; absent is `ok: true`, `applicability: "not-applicable"`; invalid is `ok: false`, `applicability: "unverifiable"`. This preserves the clean-checkout invariant while failing malformed evidence closed. |
| D13 | Update the existing integrations claim, not the MCP common-field schema. | `cmd/commands/capabilities.ts` owns the `integrations` array, while `capabilities-doctor.test.ts` explicitly establishes that integrations are CLI-owned and absent from MCP common fields. The host claim becomes “managed marker/skills/pin configuration with program-lock-aware install/doctor reporting.” The `/program-lock/i` negative assertion becomes a positive assertion; the no-host-serving assertion remains. |
| D14 | Deliver as two chained PRs: release production first, runtime consumption second. | The generator/resource pipeline is independently verifiable and has no runtime consumers. The second PR can depend on the exact resource contract while containing the package-root relocation, reader, surfacing, and tests. This keeps each review near 300–450 authored lines rather than one 600–900-line review. |

## 3. Bundled Manifest Contract

### 3.1 Filename and exact JSON shape

Path in a built/release-generated package:

```text
<package-root>/dist/promoted-composition.json
```

Canonical content for the current promoted lock:

```json
{
  "version": "0.4.0",
  "verifiedRevision": "d440203183e24b2a0ecf773915888bb6072fc015",
  "hostArtifactSha256": "2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36",
  "setSha256": "62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea",
  "attestationTag": "drenyra-dominion-v0.4.0"
}
```

Serialization is `JSON.stringify(manifest, null, 2) + "\n"` with the property order shown. The file has no optional fields. Reader validity is independent of property order, but its key set must equal these five names exactly.

### 3.2 Source mapping and consistency rules

| Manifest field | Source | Required consistency |
| --- | --- | --- |
| `version` | `currentVerified.host.version` | Strict semantic-version string; host repository is a non-empty string. |
| `verifiedRevision` | `currentVerified.inspectedRevision` | Lowercase 40-hex; equals `attestation.verifiedRevision` and the host checksum entry’s `revision`. |
| `hostArtifactSha256` | The sole `checksums.entries[]` item whose `repository` equals `currentVerified.host.repository` | Lowercase 64-hex; entry artifact is a stable non-empty basename; duplicate/missing host entries fail. |
| `setSha256` | `checksums.setSha256` | Lowercase 64-hex; equals SHA-256 of compact UTF-8 `JSON.stringify(checksums.entries)` and equals `attestation.checksumSetSha256`. |
| `attestationTag` | `attestation.tag` | Non-empty, trimmed string. |

Generation additionally requires:

- root object, `status === "promoted"`, and the expected object/array structure;
- `checksums.algorithm === "sha256"` and `checksums.canonicalization === "json-entries-v1"`;
- every checksum entry has exactly valid repository, revision, artifact, and digest facts before set reconciliation;
- `currentVerified.host.commitSha === null` and `attestation.carryingCommitSha === null`; a non-null/malformed carrying field fails;
- no value is taken from historical `repositories`, `host.programBaseCommit`, branch state, `HEAD`, environment variables, package metadata, or network responses;
- the source lock is read-only and never rewritten.

### 3.3 Generator interface and execution

```text
node scripts/promoted-composition.mjs \
  [--lock <repo-root-relative-or-absolute-path>] \
  [--output <repo-root-relative-or-absolute-path>]
```

Defaults are the promoted Drenyra Dominion lock and `dist/promoted-composition.json`. Relative arguments resolve against the repository root derived from `import.meta.url`, never against cwd. Unknown/duplicate flags or missing values fail. Diagnostics use the stable prefix `promoted-composition:` and exit 1 without output.

`package.json` wiring becomes conceptually:

```json
{
  "release:generate": "node scripts/promoted-composition.mjs && node scripts/sbom.mjs && node scripts/checksums.mjs",
  "verify:package": "node scripts/build.mjs && bun run test && bun run release:generate && node scripts/verify-package-files.mjs && bun run verify:release-integrity"
}
```

Generation precedes package-file verification so `verify-package-files.mjs` can require the manifest. `prepack` and `prepublishOnly` retain their existing gates; `verify-packed-install.mjs` adds an installed-tarball assertion for `node_modules/drenyra-ai/dist/promoted-composition.json` and its strict reader result.

## 4. Package-Root Boundary Resolution

The current implementation in `cmd/adapters/package-metadata.ts` is moved without semantic change:

```text
configurator/package-metadata.ts
  exports PackageMetadata, getPackageRoot(), getPackageMetadata()

cmd/adapters/package-metadata.ts
  export * from "../../configurator/package-metadata.js"
```

`findPackageRoot()` stays private and continues walking upward from `dirname(fileURLToPath(import.meta.url))`, caching only successful package-root/metadata reads and never using cwd. `configurator/promoted-composition.ts` imports `getPackageRoot` from `./package-metadata.js`. Therefore no `configurator/` source imports `cmd/` or `agents/`, while existing command adapter imports remain source-compatible.

`configurator/index.ts` exports the promoted-composition types/reader/diagnostic builder. It does not need to export the lower-level package metadata module as new public API; command compatibility remains through `cmd/adapters/package-metadata.ts`.

## 5. Reader and Diagnostic Contracts

### 5.1 Exact TypeScript contracts

```ts
export interface PromotedComposition {
  version: string;
  verifiedRevision: string;
  hostArtifactSha256: string;
  setSha256: string;
  attestationTag: string;
}

export type PromotedCompositionRead =
  | { state: "valid"; composition: PromotedComposition }
  | { state: "absent" }
  | { state: "invalid"; invalidReason: string };

export interface PromotedCompositionReaderDeps {
  /** Test seam only; production callers omit this. */
  packageRoot?: string;
}

export function readPromotedComposition(
  deps?: PromotedCompositionReaderDeps,
): PromotedCompositionRead;

export type VersionRelationship = "matches" | "differs";

export interface ProgramLockAwarenessDiagnostic {
  name: "program-lock-awareness";
  ok: boolean;
  detail: string;
  applicability: "applicable" | "not-applicable" | "unverifiable";
  manifestState: "valid" | "absent" | "invalid";
  packageVersion: string;
  versionRelationship?: VersionRelationship;
  promotedComposition?: PromotedComposition;
}

export function programLockAwarenessDiagnostic(
  read: PromotedCompositionRead,
  packageVersion: string,
): ProgramLockAwarenessDiagnostic;
```

### 5.2 Read algorithm

1. Resolve package root from `deps.packageRoot ?? getPackageRoot()`; a resolution exception is `invalid`.
2. Join only `<packageRoot>/dist/promoted-composition.json`.
3. If the path does not exist, return `absent`.
4. Reject a symlink or non-regular file as `invalid`; read errors are `invalid`.
5. Parse UTF-8 JSON. Require a non-array object and exactly the five allowed keys.
6. Validate strict semver, lowercase 40-hex revision, two lowercase 64-hex digests, and a non-empty trimmed attestation tag.
7. Reject any occurrence of a carrying-commit field in the manifest through the exact-key check; return no partial facts on any error.
8. Return a fresh `composition` object only after all checks pass.

The reader imports only Node filesystem/path primitives and its same-layer package-root module. It has no HTTP, child-process, Git, environment, cwd, or program-lock dependency.

## 6. Surfacing

### 6.1 Install report

`installIntegrations()` and the persisted `InstallManifest` remain unchanged. `installCommand()` reads promoted evidence after installation and adds this output for a valid skew:

```json
{
  "status": "installed",
  "version": "0.4.1",
  "packageVersion": "0.4.1",
  "promotedComposition": {
    "state": "valid",
    "availability": "available",
    "versionRelationship": "differs",
    "composition": {
      "version": "0.4.0",
      "verifiedRevision": "d440203183e24b2a0ecf773915888bb6072fc015",
      "hostArtifactSha256": "2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36",
      "setSha256": "62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea",
      "attestationTag": "drenyra-dominion-v0.4.0"
    }
  }
}
```

Existing `detectedHosts`, `configured`, and `note` fields remain. For absent/invalid evidence:

```json
{
  "promotedComposition": {
    "state": "absent",
    "availability": "unavailable"
  }
}
```

or

```json
{
  "promotedComposition": {
    "state": "invalid",
    "availability": "unavailable",
    "reason": "bounded non-sensitive diagnostic"
  }
}
```

Neither form includes `composition`, and both keep install exit 0. `InstallCommandDeps` receives an optional `readPromotedComposition` function for command tests; production uses the real reader. Nothing is added to `managed.json`.

### 6.2 Doctor report

`doctorCommand()` obtains package metadata once, reads promoted evidence once, converts it with `programLockAwarenessDiagnostic()`, and appends the check without mutating disk.

| Reader state | Doctor check | Outer effect |
| --- | --- | --- |
| Valid, versions equal | `ok: true`, `applicability: "applicable"`, `versionRelationship: "matches"`, all five facts present | Healthy unless another check fails. |
| Valid, `0.4.0` promoted / `0.4.1` packaged | `ok: true`, `applicability: "applicable"`, `versionRelationship: "differs"`, detail names both versions, all five facts present | Skew is informational; exit/status unchanged. |
| Absent | `ok: true`, `applicability: "not-applicable"`, `manifestState: "absent"`, no promoted facts | Clean checkout remains healthy. |
| Invalid | `ok: false`, `applicability: "unverifiable"`, `manifestState: "invalid"`, no promoted facts | Outer status is `degraded`, exit 1. |
| Package metadata unavailable | Reader can still classify by its own root resolution; diagnostic uses `packageVersion: "unknown"`. A valid manifest is reported but relationship is omitted; existing version/contracts checks already fail. | No false comparison is made. |

The rich extra fields fit the existing structural `{name, ok, detail}` check contract; top-level `{status, checks, readonly: true}` is unchanged.

### 6.3 Capability claim

Change the host integration string in `cmd/commands/capabilities.ts` to include the literal, accurate phrase `program-lock-aware install/doctor reporting`. In `cmd/__tests__/capabilities-doctor.test.ts`, rename the test accordingly and replace:

```ts
expect(hostIntegration).not.toMatch(/program-lock/i);
```

with:

```ts
expect(hostIntegration).toMatch(/program-lock-aware install\/doctor reporting/i);
```

The negative `host-serving` assertion and MCP planned claim remain.

## 7. File-by-File Change Plan and PR Boundary

Estimates are authored additions/meaningful edits, excluding generated `dist` bytes and lockfiles.

### PR 1 — Generator and package resource pipeline

| File | Change | Est. lines |
| --- | --- | ---: |
| `scripts/promoted-composition.mjs` | New deterministic fail-closed generator, strict lock reconciliation, exact output staging/cleanup. | 150–190 |
| `scripts/__tests__/promoted-composition.test.ts` | Subprocess fixtures for valid generation, determinism across cwd, source rejection, checksum reconciliation, carrying exclusion, output cleanup. | 150–190 |
| `package.json` | Prepend generator to `release:generate`; reorder `verify:package` so generation precedes package-file checks. | 4–8 |
| `scripts/verify-package-files.mjs` | Require and minimally parse `dist/promoted-composition.json`; assert exact key set. | 15–25 |
| `scripts/verify-packed-install.mjs` | Assert resource exists in installed tarball; optional Node probe imports configurator and reads it validly. | 20–35 |
| `scripts/__tests__/release-integrity.test.ts` | Extend release fixture/script list and prove checksums cover `promoted-composition.json`. | 20–35 |
| `dist/promoted-composition.json` | Generated release output only; ignored by Git and not hand-maintained. | 0 authored |

**Forecast:** approximately 360–480 lines. Merge/land this PR first. Its contract is the exact filename and five-field JSON shape; it introduces no command behavior.

### PR 2 — Library reader, package-root boundary, surfacing, and command tests

| File | Change | Est. lines |
| --- | --- | ---: |
| `configurator/package-metadata.ts` | Relocate the existing package-root/metadata implementation without semantic changes. | 65–80 moved |
| `cmd/adapters/package-metadata.ts` | Replace implementation with compatibility re-export. | 5–10 |
| `configurator/promoted-composition.ts` | New strict reader, classifier, types, relationship and doctor diagnostic builder. | 120–155 |
| `configurator/index.ts` | Export promoted-composition API. | 2–5 |
| `cmd/commands/install.ts` | Add dependency seam and report-only promoted composition output; leave managed manifest unchanged. | 30–45 |
| `cmd/commands/doctor.ts` | Read once and append dedicated diagnostic; preserve outer contract. | 15–25 |
| `cmd/commands/capabilities.ts` | Update integration claim. | 1–3 |
| `configurator/__tests__/promoted-composition.test.ts` | Valid/absent/invalid fixture matrix, strict fields, no cwd fallback, package-root behavior, diagnostic matrix. | 130–170 |
| `cmd/__tests__/install-sync.test.ts` | Install command valid/skew/absent/invalid output and unchanged managed schema assertions. | 55–80 |
| `cmd/__tests__/capabilities-doctor.test.ts` | Positive capability boundary plus doctor valid/skew/absent/invalid/readonly assertions. | 70–100 |
| Boundary/import test (prefer the existing configurator boundary test if present; otherwise add to `configurator/__tests__/promoted-composition.test.ts`) | Assert no `configurator/` import resolves into `cmd/` or `agents/`; adapter re-export remains usable. | 15–25 |

**Forecast:** approximately 440–600 additions/edits, with roughly 70 moved lines. If the review tool counts moves as delete+add, keep the package-root relocation and adapter re-export as the first commit in PR 2 so the semantic reader/surfacing diff remains reviewable. PR 2 depends on PR 1 and must not duplicate generator changes.

## 8. Test Plan

Strict TDD applies: each PR begins with focused failing tests, then implementation, triangulation, and the standard suite/typecheck/build gates.

### 8.1 Generator scenarios

1. **Valid deterministic lock:** run twice from different cwd values; bytes are identical and equal the exact five-field fixture.
2. **Promoted status:** missing or non-`promoted` status fails with `promoted-composition:` and leaves no output.
3. **Carrying commit:** non-null `currentVerified.host.commitSha` or `attestation.carryingCommitSha` fails and leaves no output.
4. **Revision consistency:** mismatch among inspected revision, attestation revision, and host checksum revision fails.
5. **Host entry consistency:** missing, duplicate, malformed, or wrong-repository host checksum entry fails.
6. **Checksum set reconciliation:** reordered/changed entries without corresponding canonical `setSha256`, wrong algorithm/canonicalization, or attestation digest mismatch fails.
7. **Field validation:** malformed semver, uppercase/wrong-length revision/digest, unstable artifact basename, empty tag, malformed JSON, and missing lock fail.
8. **No carrying output:** successful JSON contains neither `commitSha`, `carryingCommitSha`, branch, `HEAD`, historical repository facts, nor extra keys.
9. **Stale-output cleanup:** pre-create output, then run invalid generation; assert both output and staging file are absent.
10. **Package coverage:** release checksums name the manifest; package-file verifier requires it; packed install contains it.

### 8.2 Reader scenarios

1. **Valid:** return `state: "valid"` and exact facts from a package-root fixture.
2. **Absent:** no file returns only `{state: "absent"}`.
3. **Invalid JSON/read:** malformed JSON, directory, symlink, and unreadable file return invalid with no composition.
4. **Strict key set:** missing and extra fields, including any carrying-like field, return invalid.
5. **Strict values:** malformed semver, uppercase/wrong-length hashes, empty/whitespace tag return invalid.
6. **No cwd fallback:** place a valid-looking file under cwd while the injected/real package root is absent; result remains absent.
7. **Package-root resolution:** call the default production path from a non-root cwd and prove it resolves relative to module/package location.
8. **No network/Git:** static source/import assertion and subprocess execution with no network fixtures; no child-process/http imports exist.

### 8.3 Install scenarios

1. **Valid skew:** package `0.4.1`, promoted `0.4.0`; report includes both identities, all five facts, `differs`, and returns 0.
2. **Valid match:** both versions equal; report says `matches` without claiming more than the manifest.
3. **Absent:** installation succeeds; output says unavailable/absent and contains no promoted facts.
4. **Invalid:** installation succeeds; output says unavailable/invalid, includes only a bounded reason, and contains no promoted facts.
5. **Persistence invariant:** compare `managed.json` shape before/after feature; no promoted-composition field is persisted and transition behavior is unchanged.
6. **No false promotion:** assert no output labels package `0.4.1` as promoted when manifest version is `0.4.0`.

### 8.4 Doctor scenarios

1. **Valid skew:** dedicated check is applicable/ok, names both versions and all five facts, outer report remains healthy/readonly when all other checks pass.
2. **Valid match:** dedicated check is applicable/ok with `matches`.
3. **Absent:** check is not-applicable/ok, has no promoted facts, clean checkout stays healthy.
4. **Invalid:** check is unverifiable/not-ok, has no promoted facts, outer report is degraded/readonly and exits 1.
5. **Other failures compose:** a healthy program-lock check does not mask managed-state/package-pin failures; an invalid program-lock check does not suppress the rest of the report.
6. **Unknown package metadata:** omit relationship rather than fabricating one; existing metadata checks still fail closed.

### 8.5 Boundary and capability scenarios

1. `configurator/` contains no import from `cmd/` or `agents/`.
2. Existing adapter imports of `getPackageMetadata()` and `getPackageRoot()` continue to work through the re-export.
3. Capabilities host integration matches the exact positive program-lock-aware install/doctor claim.
4. Host-serving remains unclaimed and MCP remains planned; CLI/MCP common-field drift assertions remain unchanged.

### 8.6 Verification gates per PR

- Focused Vitest files for the PR.
- `bun run test` (with known pre-existing failures handled according to repository policy, not silently ignored).
- `bun run typecheck`.
- `bun run build`.
- PR 1 additionally: `bun run release:generate`, `bun run verify:release-integrity`, package-file verification, and packed-install verification.
- PR 2 additionally: command output snapshots/assertions from a non-root cwd and the configurator import-boundary check.

## 9. Failure, Rollout, and Rollback

- **Generation failure:** release/package verification stops and the manifest is absent; no stale evidence is packaged.
- **Runtime absence:** install remains successful and doctor remains healthy/not-applicable. This supports source/clean-checkout and older package states.
- **Runtime invalidity:** install reports unavailable without a promotion claim; doctor degrades as unverifiable.
- **Version skew:** both versions are visible and `differs` is informational only. No install, sync, upgrade, rollback, or managed-state gate changes.
- **Rollout:** land PR 1, verify generated and packed bytes, then land PR 2 against that frozen resource contract.
- **Rollback:** revert PR 2 to remove consumption/surfacing, then PR 1 to remove generation. No user-state migration is needed because `managed.json` never changes.

## 10. Requirements Traceability

| Specification requirement | Design coverage |
| --- | --- |
| Bundled Composition Manifest | D1–D5; Sections 3, 7 PR 1, 8.1 |
| Offline Reader | D6–D9; Sections 4–5, 8.2 |
| Install Surfacing | D10–D11; Section 6.1, 8.3 |
| Doctor Surfacing | D11–D12; Section 6.2, 8.4 |
| Boundary Compliance | D6, D13; Sections 4, 6.3, 8.5 |
| Testability | Sections 7–8 |
