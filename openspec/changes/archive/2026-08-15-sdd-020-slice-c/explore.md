# Exploration — SDD-020 Slice C: Program-Lock-Aware Install

> Change: `sdd-020-slice-c` · Phase: explore · Store: openspec
> Scope: how `drenyra-ai install` (and its composition library) consumes the now-PROMOTED
> `program-lock.json` so every host consumes the promoted artifact, never a copy of `main`.

## Context

The Drenyra Dominion program lock is **promoted** (SDD-010 release-train, PRs #52/#53).
It is a *program document* living at
`openspec/programs/drenyra-dominion/program-lock.json`; the package `files` list is
`[dist, contracts, fixtures, README, LICENSE]`, so the lock **does not ship in the npm
package**. Runtime consumption of the lock was explicitly deferred to SDD-020 slice C by
SDD-010 (spec R6: "The promotion change MUST NOT add any runtime or install-time code
that consumes `program-lock.json` ... Runtime consumption ... remains SDD-020 slice C").

## 1. The lock now — promotable facts install could consume

Source: `openspec/programs/drenyra-dominion/program-lock.json` (read at exploration time).

- `status: "promoted"`; `lockVersion: 1`; `stage: "private"`.
- `currentVerified.host`: `{ repository: "drenyra-ai", role: "authority-core", version: "0.4.0", testTotal: 915, testPassed: 915, typecheck: "clean", conformance: "passing", githubVisibility: "PUBLIC", commitSha: null }`.
  - Note `commitSha: null` + note: "the carrying commit is pinned only by the external Phase B5 attestation." **Bootstrap rule honored in the document itself.**
- `currentVerified.inspectedRevision: "d440203183e24b2a0ecf773915888bb6072fc015"` — this is the *verification input* (ancestor of the lock commit), NOT the carrying commit.
- `currentVerified.siblingRepositories`: `drenyra-engram` and `drenyra-pi` are `current-claim` (SHA + visibility); three siblings are `unknown`/`awaiting-evidence`.
- `attestation`: `{ scheme: "signed-git-tag+github-release-asset-v1", tag: "drenyra-dominion-v0.4.0", asset: "drenyra-dominion-v0.4.0.attestation.json", verifiedRevision: "d440203…", checksumSetSha256: "62f1aaa…", carryingCommitSha: null }`.
- `checksums`: `{ algorithm: "sha256", canonicalization: "json-entries-v1", entries: [ { repository: "drenyra-ai", revision: "d440203…", artifact: "drenyra-ai-0.4.0.tgz", sha256: "2e3bd07…" } ], setSha256: "62f1aaa…" }`.

**Install-consumable promotable facts (all offline-safe, none is the carrying commit):**

1. Promoted host version (`0.4.0`).
2. Verified revision SHA (`d440203…`) — the concrete artifact/commit the composition was verified against.
3. Host artifact checksum (`sha256` of `drenyra-ai-0.4.0.tgz`) and the `setSha256` covering the promoted composition.
4. Attestation tag/asset name for audit reporting.

**Version-skew caveat (key finding):** the lock pins promoted host `0.4.0`, but
`package.json` is currently **`0.4.1`**. A program-lock-aware install that hard-validates
"installed package version == promoted host version" would fail today. Slice C must
decide whether the bundled manifest carries promoted facts for the *shipping* package
version (which may be ahead of the last promoted checkpoint) vs. hard-gating equality.

## 2. The package boundary — how a bundled manifest reaches the installed package

- `package.json` `files`: `[dist, contracts, fixtures, README, LICENSE]`. Everything under
  `dist/` ships; the lock (`openspec/…`) and `configurator/` sources do **not** ship.
- `configurator/index.ts` + `managed-config.ts` compile to `dist/configurator/` (pulled in
  transitively via `cmd/` imports; `tsconfig.build.json` rootDir `.`, outDir `dist`).
- Release pipeline today:
  - `build` → `scripts/build.mjs` (tsc → `dist/`, shebang patch).
  - `release:generate` → `scripts/sbom.mjs` (writes `dist/sbom.json`) + `scripts/checksums.mjs` (writes `dist/checksums.txt`).
  - `scripts/checksum-lock.mjs` produces/validates the lock's checksums (a **program** tool, invoked with `--lock … --artifact repo=path`, optionally `--output`). It is not wired into `release:generate`.
- `verify:package`/`verify:release-integrity` gate the published artifact but assert only fixed paths (`dist/cmd/cli.js`, `dist/index.js`, `dist/configurator`-adjacent entry points, contracts/fixtures). There is **no** emitted "promoted composition" resource today.

**Conclusion:** a bundled manifest reaches the installed package by being written under
`dist/` during the release build (generated from the promoted lock), so it is included in
the tarball automatically. The cleanest fit is a generated resource the configurator
reads offline at runtime (no network, no `main`).

## 3. The configurator's current install path

- `configurator/managed-config.ts`:
  - `PINNED_AI_COMPOSITION` — hardcoded, deep-frozen, package-versioned per-host
    runtime/model/tool pin constants. Comment explicitly: values are "never derived from
    program-lock, network, host introspection, user input, or branch state." This is the
    current notion of "the pinned composition."
  - `COMPOSITION_SCHEMA_VERSION = 2`; `ManagedCompositionSnapshot` records
    `packageVersion`, `sequence`, `activatedAt`, `managedAssets`, `pinnedComposition`.
  - `package-pin` doctor diagnostic compares the *recorded* composition `packageVersion`
    against the packaged version.
- `cmd/commands/install.ts` `installIntegrations`: reads package version via
  `require("../../package.json").version`, renders marker/skills/pin bytes, persists the
  composition. Uses `getPackageMetadata()` only in doctor/capabilities/upgrade.
- `cmd/adapters/package-metadata.ts` `getPackageMetadata()`: resolves the installed
  package root + version from module URL (never cwd). **This is the established pattern
  for reading package-relative resources at runtime** — a bundled manifest read should use
  the same root resolution.
- `cmd/commands/sync.ts`: reconciles markers/pins against the recorded composition; does
  not consult any promoted artifact.
- `cmd/commands/upgrade.ts`: `planUpgrade(home, requested, packaged)` — the
  `COMPOSITION_NOT_PACKAGED` guard already ties requested → packaged version.

**Current state:** install/sync/upgrade/rollback/doctor are entirely package-version and
constant-driven. There is **zero** program-lock awareness in the configurator. The
`capabilities-doctor.test.ts` (line ~91) explicitly asserts the integration claim does
**not** match `/program-lock/i` — a boundary test that slice C must update.

## 4. The bootstrap rule and delivery options

The lock must never self-reference the carrying commit, and runtime must not read `main`.
How does install know the promoted artifact?

- **(a) Bundled manifest in `dist/` generated by the release process (RECOMMENDED).**
  A release step reads the promoted lock and emits a package-shipped resource (e.g.
  `dist/configurator/promoted-composition.json` or a compiled `.ts` constant) carrying the
  offline promotable facts (version, verifiedRevision, host artifact digest, setSha256,
  attestation tag). The configurator reads it via the established
  `getPackageMetadata()`-style root resolution.
  - **Fits architecture:** offline (no network), deterministic, ships with the package,
    respects the bootstrap rule (embeds `verifiedRevision`/digests — *not* the carrying
    commit), reuses the existing package-root resolution pattern, and mirrors the existing
    "release data in the library constant" style of `PINNED_AI_COMPOSITION`.
  - **Caution:** `checksum-lock.mjs` currently rejects lock self-inclusion and emits no
    carrying-commit SHA; the new bundling step must likewise emit only non-carrying facts.
- **(b) Reading the release asset at runtime (network) — REJECTED.** Requires network at
  install time, violates the no-network/offline design and the never-install-host
  invariants; also depends on GitHub availability.
- **(c) `package.json` metadata (version + a composition field) — PARTIAL.** Carries a
  version but would require hand-maintaining lock facts in `package.json` (drift risk) and
  adds no digest/verified-revision evidence. Could be used as a thin `version` cross-check
  but is not a full promoted-artifact carrier.

**Recommendation: (a)**, with the manifest produced by a dedicated release script wired
into the publish path (alongside `sbom.mjs`/`checksums.mjs`), and consumed by a new
configurator reader that resolves from the installed package root.

## 5. What "promoted artifact" means for install

- The current **host pin** (`PINNED_AI_COMPOSITION`) answers "which runtime/model/tool
  versions to pin per host." It is package-versioned and orthogonal to the promoted lock.
- The **program-lock host version** answers "which drenyra-ai package/commit was verified
  as the promoted composition." These are different axes.
- The "never-a-copy-of-main" rule: install must be able to attest that the configured
  composition corresponds to a **promoted, verified** artifact — not whatever happens to
  be on `main`. The bundled manifest makes that assertion possible offline: install/doctor
  compare the installed package version (and, where recorded, the promoted verified
  revision/digest carried by the manifest) to conclude "this install is (or is not) the
  promoted composition."
- **Design decision to resolve in design phase:** given the 0.4.0 vs 0.4.1 skew, the first
  slice should treat the promoted facts as *recorded, reported, and doctor-checked*
  evidence rather than a hard equality gate that blocks install on any package ahead of the
  last promoted checkpoint. Hard-gating is the safe long-term contract but must be
  sequenced with the release train that promotes 0.4.1.

## 6. Existing test coverage (slice C impact)

- `cmd/__tests__/install-sync.test.ts`: install detection/foreign-preservation, sync
  not-installed/synced/preserved, `PINNED_AI_COMPOSITION` exhaustive keys, pin rendering.
  **No promoted-artifact coverage.**
- `cmd/__tests__/capabilities-doctor.test.ts`: capabilities/doctor regressions;
  `package-pin` mismatch (exit 1); **line ~91 asserts integration does not match
  `/program-lock/i`** — must be rewritten once slice C adds the claim.
- `scripts/__tests__/checksum-lock.test.ts`: pins checksum determinism, lock self-inclusion
  rejection, no carrying-commit SHA in output. A new bundling script needs its own focused
  tests (fixture lock → emitted manifest, offline read, non-carrying facts only).
- `scripts/__tests__/release-integrity.test.ts`: runs the real release scripts; a new
  generated-manifest step would join this verification surface.

## Recommended first-slice scope + size estimate

**Scope (suggested):**

1. New release script `scripts/emit-promoted-composition.mjs` (or extend `build.mjs`) that
   reads the promoted lock and writes `dist/configurator/promoted-composition.json`
   (version, verifiedRevision, host artifact digest, setSha256, attestation tag) — never
   the carrying commit.
2. Wire into `release:generate` (and `verify:package`/`verify:release-integrity`).
3. Configurator reader: resolve the installed package root (reuse/extend
   `getPackageMetadata()` pattern) and read the bundled manifest; add strict parse
   (absent | invalid | valid) that fails closed.
4. New doctor diagnostic `promoted-composition` (recorded promoted version/revision/digest
   vs packaged) and a `program-lock` awareness claim in `capabilities`.
5. Update `capabilities-doctor.test.ts` boundary assertion; add focused tests for the new
   script + reader + diagnostic.

**Non-goals (first slice):** hard equality gate blocking install on package > promoted;
sibling-repository federation; Drenyra Pi host-serving.

**Size estimate:** ~1 new script (~120–180 lines), ~1 new configurator reader + type
(~150–250 lines), doctor/diagnostic additions (~60–120 lines), test additions (~250–400
lines). **~600–900 authored lines** → split into **2 chained PRs** (release-side manifest
generator + package verify; configurator consumption + doctor/capabilities + tests) to stay
under the 400-line review budget.

## Risks

| Risk | Assessment | Mitigation |
| --- | --- | --- |
| **Bootstrap / carrying-commit leak** | High if the bundler emits the lock commit or reads HEAD | Bundler must emit only `verifiedRevision` + digests + version (all non-carrying), mirroring `checksum-lock.mjs`'s existing discipline; add a test asserting no carrying SHA in output. |
| **Version skew (promoted 0.4.0 vs package 0.4.1)** | High — hard equality gate fails today | First slice records/reports/doctor-checks; hard-gate sequenced with a promotion of 0.4.1. |
| **Checksum verification surface** | Medium — the lock's checksums cover the `.tgz`; bundled manifest must reference the same digest set consistently | Derive manifest digest from the lock's `checksums` block; validate `setSha256` recompute; document canonicalization. |
| **No-network / offline invariant** | Medium — install must never phone home | Manifest is shipped in `dist/`; read via package-root resolution, never network. |
| **Layer model / bootstrap order** | Medium — reader must be library-level (`configurator/`) and import only node:* + package-root adapter; no reverse imports from `cmd/` | Follow existing layer contract in `managed-config.ts`; keep the package-root resolution in `cmd/adapters` injected-in or a library-safe helper. |
| **Declared-surface drift (CLI vs MCP)** | Low-Medium | Add the program-lock awareness claim through the shared `declared-surface.ts`/`DeclaredCapabilities` path, not parallel copies. |

## Forward references

- SDD-010 `changes/archive/2026-08-15-sdd-010-release-train/` (promotion contract, R6 no-runtime boundary, checksum-lock producer).
- SDD-020 configurator + host-integration archive reports (slice C explicitly deferred).

## Deliverable boundary

This is exploration only. No files outside `openspec/changes/sdd-020-slice-c/` were modified.
