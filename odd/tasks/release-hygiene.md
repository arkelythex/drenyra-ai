# Feature: release-hygiene

**Objective:** make every published `drenyra-ai` tarball the clean build of its tag, publish it through the release workflow with Sigstore provenance, and attach a GitHub Release whose `checksums.txt` describes that same tarball. Closes #126.
**Branch:** `fix/release-hygiene`
**Gates:** `bun run typecheck`, `bun run lint`, `bun run test`, `actionlint`, `zizmor`, markdownlint on touched files.

## Specs

- **S1 — "Published tarballs ship stale dist/ files" (#126).** `scripts/build.mjs --clean` removes `dist/` before compiling, and `verify:package` (run by `prepack`) uses it, so every pack starts from an empty output tree. The plain build used by `prepare` stays additive, because npm runs `prepare` after `prepack`. Stale files planted in `dist/` (a nested `.tgz`, a directory with no source) are gone after a build.
- **S2 — "v0.5.0 has no Sigstore provenance" (#126).** The release workflow publishes with an npm CLI that supports OIDC trusted publishing (npm ≥ 11.5.1), pinned exactly. Node 22's bundled npm 10 does not support it: the `v0.5.0` runs failed with `ENEEDAUTH`, then `E404` on the `PUT` after a signed provenance statement.
- **S3 — "The Release `checksums.txt` covers the artifact of that same version" (#126).** On a tag push, after publish and `npm audit signatures`, the workflow downloads the tarball npm now serves for that version, computes SHA-256 for every file under its `package/dist` plus the tarball and `sbom.json`, and creates the GitHub Release `v<version>` with those three assets and the version's CHANGELOG section.
- **S4 — Owner prerequisite, not code.** Trusted publishing also needs the npm package `drenyra-ai` to list `arkelythex/drenyra-ai` → `release.yml` as a trusted publisher on npmjs.com. That setting is not visible from the repository, and it is documented in `RELEASING.md` as a release prerequisite.
- **S5 — Docs.** `RELEASING.md` "Release provenance" describes what the workflow now does and drops the "tooling lands with the first real release" note. CHANGELOG records the fix.

## Tasks

- [x] **T1** — RED/GREEN: `scripts/__tests__/build-clean.test.ts` (a fixture root plants stale `dist/` files; the build removes them and still patches the CLI shebang). *(S1)* — `0ef0599`
- [x] **T2** — `release.yml`: pinned npm for OIDC, and a tag-only GitHub Release step built from the npm-served tarball. Checked with `actionlint` and `zizmor`. *(S2, S3)* — `b136c25`
- [x] **T3** — `RELEASING.md` prerequisite and provenance section; CHANGELOG. *(S4, S5)* — docs commit
- [x] **T4** — Gates, PR linked to #126. *(all)* — PR closes #126

## Log

### L1 — 2026-10-27 — request (verbatim)

Previous turn: "El que más mueve la aguja es #126 en drenyra-ai: arreglar el empaquetado y la publicación con provenance para que la 0.6.0 salga limpia y firmada. Si querés, arranco por ahí." Answer:

> yes te autorizo y continue

### L2 — 2026-10-27 — root cause evidence

- Release run 32095952409 (`v0.5.0`): the CI pack was clean (695 files, `sha512-haeXrezKy…`, the same bytes a clean local rebuild of the tag produces), then `ENEEDAUTH`.
- Release run 32180929917: `npm notice publish Signed provenance statement…`, then `E404 PUT https://registry.npmjs.org/drenyra-ai`.
- The npm-served `0.5.0` has 708 files, including `dist/drenyra-ai-0.4.0.tgz` and an unexported `dist/tenant/`. That is a manual publish from a development tree: `build.mjs` compiles into an existing `dist/` and never removes stale files.
- No test covers `scripts/build.mjs` or `.github/workflows/release.yml`.

### L3 — 2026-10-27 — verification

- T1 RED: the fixture build compiled but left `dist/drenyra-ai-0.4.0.tgz` behind; the shebang test already passed. GREEN after `rmSync(dist)`: 2/2.
- T2: `actionlint` OK. `zizmor --offline` flagged workflow-level `id-token: write` once a second job existed; with the permission moved to `publish`, the result was "No findings". The asset step was run locally against the published `v0.5.0`. It computed the same `checksums.txt` that the manual v0.5.0 Release carries (678 lines; tarball `3188ea01…`, SBOM `d79d9b7a…`), then refused with "a tarball is nested inside dist/". Against `v0.4.1`, never published to npm, `npm pack` failed and the step stopped before creating anything.
- Gates: typecheck, lint, and build exit 0 (`build: removed dist/`); `bun run test` 112 files / 1490 passed; `verify:package` OK, including release integrity; `npm pack --dry-run` 692 files with no nested tarball; markdownlint 0 issues in 96 files.
- Not verifiable from the repository: the npm-side trusted publisher setting (S4, owner action).

### L4 — 2026-10-27 — CI regression found and fixed

- CI `package` on PR #128 failed: `verify-packed-install: FAILED — installed dist/promoted-composition.json is missing or invalid`. Locally I had run `verify:package` and `npm pack --dry-run`, but not `verify-packed-install`.
- Cause: the npm pack lifecycle runs `prepack` → `prepare` → pack, and `prepare` is `node scripts/build.mjs`. With an unconditional clean, `prepare` deleted the `release:generate` outputs `prepack` had just written to `dist/`. Reproduced locally: a second "build: removed dist/" appears after release integrity verified.
- Fix: cleaning is opt-in (`--clean`), used by `verify:package`. A new RED case ("keeps existing dist/ files without --clean, so prepare cannot erase prepack outputs") failed before the fix; 3/3 after.
- End to end: with `dist/drenyra-ai-0.4.0.tgz` and `dist/tenant/` planted, `npm pack --dry-run` packed 695 files, and neither stale file was listed or remained on disk. `verify-packed-install` OK, with `promoted-composition.json` present and five-key.
