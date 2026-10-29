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

## Tasks

- [x] **T1** — RED: `scripts/__tests__/sync-alert-mirror.test.ts` (fixture round-trip, nested scoped paths, flags, `--check` both ways, determinism, fail-closed sources). *(S2–S5)*
- [x] **T2** — GREEN: `scripts/sync-alert-mirror.mjs` and the `deps:mirror` script. *(S2–S5)*
- [x] **T3** — Regenerate the real mirror; validate it with npm; compare the sets. *(S7)*
- [ ] **T4** — CI step, `dependabot.yml` comment, docs, CHANGELOG; gates; PR; merge. *(S6)*

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
