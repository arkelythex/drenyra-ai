# Feature: bun-lock-alert-mirror

**Objective:** make `package-lock.json`, the only manifest GitHub's dependency graph reads here, an exact mirror of `bun.lock`, the tree CI actually installs. The mirror is generated from `bun.lock` and checked in CI, so Dependabot alerts describe the installed tree: no false negatives and no false positives.
**Branch:** `ci/bun-lock-alert-mirror`
**Gates:** `bun run typecheck`, `bun run lint`, `bun run test`, `bun run verify:package`, `npm ls --all --package-lock-only`, `npm audit --package-lock-only`.

## Specs

- **S1** — Owner: "te autorizo todo y avanza de forma autonoma", after the proposal: "Que el espejo de alertas no se vuelva a desincronizar … Con eso se arregla la causa, no solo el síntoma."
- **S2** — `node scripts/sync-alert-mirror.mjs` writes `package-lock.json` (lockfileVersion 3) from `bun.lock` and `package.json`. Every package path and exact version in `bun.lock` appears in the mirror with the same version and integrity, and nothing else does.
- **S3** — Each entry carries npm's scope flags derived from reachability over the declared edges: `dev`, `optional`, or `devOptional`, plus `os`/`cpu`, `bin`, `peerDependencies`, and optional-peer metadata.
- **S4** — `--check` regenerates in memory and exits 1 when the committed mirror differs, without writing. Its message names the command that fixes it. An identical mirror exits 0. Output is deterministic: two runs produce byte-identical files.
- **S5** — Fail closed. A `bun.lock` entry the script cannot represent faithfully (a non-registry source such as git, `file:`, or a tarball URL, or an unparseable identity) aborts with a non-zero exit, and nothing is written.
- **S6** — CI runs `--check`. `bun run deps:mirror` is the documented refresh. `.github/dependabot.yml` and the contributor docs describe it, replacing the old `npm install --package-lock-only` instruction, which resolved its own tree.
- **S7** — The real repository's mirror is regenerated. `npm ls --all --package-lock-only` accepts it, and the `name@version` sets of `bun.lock` and the mirror are identical.

- **S8** — Drenyra Shell depends on `drenyra-ai` as `file:./vendored/drenyra-ai-<v>.tgz`; bun records it as a 3-tuple `["name@./path.tgz", meta, integrity]` with no version. The mirror represents it as `resolved: "file:<path>"`, with the version read from the tarball's `package/package.json` and the file's SHA-512 checked against bun's integrity (a mismatch fails closed), so the vendored runtime's registry dependencies (`ajv`, `pg`) are visible to alerts.

## Tasks

- [x] **T1** — RED: `scripts/__tests__/sync-alert-mirror.test.ts` (fixture round-trip, nested scoped paths, flags, `--check` both ways, determinism, fail-closed sources). *(S2–S5)* — `eea0f90`
- [x] **T2** — GREEN: `scripts/sync-alert-mirror.mjs` and the `deps:mirror` script. *(S2–S5)* — `eea0f90`
- [x] **T3** — Regenerate the real mirror; validate it with npm; compare the sets. *(S7)* — `eea0f90`, `ef10800`
- [x] **T4** — CI step, `dependabot.yml` comment, docs, CHANGELOG; gates; PR; merge. *(S6)* — #165 merge `2b0396c`

- [x] **T5** — Local tarball dependencies (`file:` .tgz), needed by Drenyra Shell's vendored runtime: read the version from the tarball and verify its integrity against bun.lock; directories stay refused. *(S2, S5, S8)* — `47aae58`, PR #167 merge `7ebea0a`

## Log

### L1 — 2026-10-29 — request (verbatim)

> te autorizo todo y avanza de forma autonoma

### L2 — 2026-10-29 — evidence

- GitHub's dependency graph for this repository lists `package-lock.json` and `package.json` (plus workflows), and no `bun.lock`.
- Right after the #160 refresh, the two lockfiles still disagree on about 20 resolutions: `bun.lock` has 128 `name@version` entries and the mirror 125; 23 appear only in bun and 20 only in npm. Examples: `vite` 8.2.1 vs 8.3.5, `postcss` 8.5.25 vs 8.5.32, `nanoid` 3.3.18 vs 3.3.20, `rolldown` 1.2.3 vs 1.2.15. Cause: `npm install --package-lock-only` resolves its own tree instead of copying bun's. An advisory on a version only bun installs would never alert.
- Drenyra Shell has no `package-lock.json` at all, so GitHub sees none of its transitive tree. That is a follow-up in the Shell.

### L3 — 2026-10-29 — T1 RED, T2 GREEN, T3 real mirror

- RED: 16 subprocess tests failed on the missing `scripts/sync-alert-mirror.mjs`.
- GREEN: the fixture cases pass 15/15. They cover nested scoped paths, all four scope flags (including `devOptional`), `os`/`cpu`, `bin`, optional peers, determinism, `--check` both ways, and fail-closed sources (git, tarball URL, `file:`, custom registry, missing `bun.lock`, orphan). The repository case stayed RED until T3, as expected.
- T3: `bun run deps:mirror` wrote 129 packages. The `name@version` sets of `bun.lock` and the mirror are identical (128 = 128 before the vite fix, 129 = 129 after), and `npm ls --all --package-lock-only` exits 0.
- **Hidden advisories found.** On the exact mirror, `npm audit` reported `vite@8.2.1` (the version bun actually installed) with six advisories in `>=8.2.0 <=8.2.3`: GHSA-587h-7wmj-h5pm (high) and five moderate or low. The old npm-resolved mirror listed `vite@8.3.5`, so GitHub never alerted. The 0.8.0 CHANGELOG claim that vite was "outside the vulnerable range" held only for alerts 11–16; `[Unreleased]` records the correction. `bun update vite` moved it to 8.3.5 (development-only, through vitest). After regenerating, `npm audit --package-lock-only` reports `found 0 vulnerabilities`.
- T4 (in progress): a CI `--check` step in the `lint` job, the `.github/dependabot.yml` comment, a CONTRIBUTING "Change a Dependency" section, and CHANGELOG.

### L4 — 2026-10-29 — slice boundary and gates

- `eea0f90` (the tool) is ~600 authored lines: a ~260-line script, ~250 lines of tests, and the rest CI, docs, and this document. That is past the ~400-line guide, but it stays one commit because it is one behavior unit; the script without its tests or its CI check is not reviewable alone. Its mirror is generated from `main`'s `bun.lock`, so the commit passes `--check` on its own. The dependency fix is its own commit: `vite` 8.3.5, the regenerated mirror, and the CHANGELOG correction.
- Gates on the final tree: `bun install --frozen-lockfile`; typecheck clean; lint 189 files (the 2 Biome infos already existed); `--check` reports the mirror current (129 packages); `verify:package` 1535 tests (1519 + 16), release integrity OK; `verify-packed-install` OK; `git diff --check` clean.

### L5 — 2026-10-29 — T4 merged; T5 opened for the Shell

- PR #165 passed 9/9 checks and merged as `2b0396c`. On `main`, CI, Docs, and the Dependabot `bun` update run succeeded. Open alerts: 0, and that is now a true zero, because the mirror is the installed tree.
- Drenyra Shell has no `package-lock.json`, so GitHub sees none of its transitive tree; its open-alert count of 0 means nothing. Its runtime dependency is `drenyra-ai@file:./vendored/drenyra-ai-0.8.0.tgz`, which bun records as a 3-tuple without a version. That opens S8/T5 here, before the script is carried to the Shell.

### L6 — 2026-10-29 — T5 RED / GREEN

- RED: two of the three new local-tarball cases failed: mirroring the vendored tarball, and refusing an integrity mismatch. The missing-tarball case already passed, because a local source was refused outright.
- GREEN: 19/19. The fixture builds a real ustar `.tgz`. The version comes from the archive, `resolved` is `file:vendored/<name>.tgz`, a mismatched SHA-512 or a missing file fails closed with nothing written, and the registry dependency behind the tarball is mirrored with the right scope.
- This repository's mirror is unchanged (129 packages, `--check` OK). Against Drenyra Shell's real tree (`--root ../drenyra-pi --check`), the script parsed `bun.lock`, verified the vendored `drenyra-ai-0.8.0.tgz` against bun's integrity, and found no orphans or unrepresentable sources. It exits 1 only because the Shell has no mirror yet.

### L7 — 2026-10-29 — T5 merged; adopted by Drenyra Shell

- PR #167 passed CI and merged as `7ebea0a`.
- arkelythex/drenyra-shell#103 (merge `89bed5b`) carries the script byte-for-byte, generates the Shell's first `package-lock.json` (106 packages, the vendored `drenyra-ai-0.8.0.tgz` included and integrity-verified), checks it in CI, and moves its Dependabot config from `npm` to `bun`. The exact mirror revealed and fixed advisories that had never alerted there: `fast-uri` 3.1.5 (10, 5 high), `vite` 8.3.0 (6, 1 high), `source-map-js` 1.2.1 (1 high), and `vitest`/`@vitest/mocker` 5.0.1 (2 moderate). After the merge, GitHub's dependency graph lists the Shell's `package-lock.json`, and open alerts are 0.
- Risk: item 5 (CI and dependency pipeline). There was no separate independent verifier. The evidence is RED and GREEN, the full gates, the PR and `main` CI, `npm ls`, `npm audit`, and the dependency-graph manifest listing.
