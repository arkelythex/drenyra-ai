# Releasing — Drenyra AI

← [Back to README](README.md)

A successful source build is not enough: consumers need the same verified bytes from npm and the release assets. Use this checklist to prepare a candidate; publishing remains an explicit maintainer action.

> Documentation tracks `main`; consult the tagged source for the exact release candidate.

<!-- -->

> [!NOTE]
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## At a glance

- [Version policy](#version-policy)
- [Release checklist](#release-checklist)
- [Release provenance](#release-provenance)
- [Commit and release discipline](#commit-and-release-discipline)

## Version policy

- Before the first frozen contract, releases used **`0.0.1-prealpha.x`** (x increments per release).
- The first release that froze a contract (`mission-protocol`, `candidate`, `receipt`, `gate` — per the [ROADMAP](ROADMAP.md)'s Phase 1) was **`0.1.0`**.
- After `0.1.0`, **Semantic Versioning** applies: MAJOR = breaking contract change, MINOR = backward-compatible addition, PATCH = backward-compatible fix. Contract changes are public surface changes.

## Release checklist

Every release must pass, in order:

1. **Typecheck** — `bun run typecheck` (or the repo's configured command) is clean.
2. **Tests** — full test suite passes (`bun run test`).
3. **Conformance vectors** — canonical vectors for receipt verification, ledger hashing, and any other deterministic behavior pass against the exact release candidate. Vectors are updated in lockstep with contract changes.
4. **Package build + pack verification** — build the package and verify the packed artifact contains exactly the intended files (`package.json` `files` list).
5. **Packed-install test** — install the packed tarball in a clean consumer and run a smoke command (e.g. `drenyra-ai receipt verify` on a canonical vector) to prove the release works outside the checkout.
6. **Publish gates** — `npm publish` runs `prepack` (`verify:package`) and `prepublishOnly` (typecheck + `verify:package` + `verify-packed-install`) automatically, so the protection does not depend on CI alone.

## Release provenance

For a fiscal runtime, distribution provenance matters at least as much as the code. A release should ship (or link) each of:

| Artifact | Purpose |
| --- | --- |
| **GitHub Release** | tag `v<version>` (signed tag) with release notes from the CHANGELOG |
| **npm provenance** | `npm publish --provenance` when the registry + CI support it |
| **SHA-256 manifest** | checksums of every published artifact (tarball, SBOM) so consumers can verify what they installed |
| **SBOM** | software bill of materials (`scripts/sbom.mjs`, shipped as `dist/sbom.json` and as a Release asset) |
| **Changelog + migration note** | what changed and how consumers migrate |
| **Contract compatibility report** | which contracts are unchanged vs. bumped (major = breaking), so consumers know their compatibility window |

### What the release workflow does

A `v<version>` tag push runs `.github/workflows/release.yml`:

1. **`publish`** — a clean build (`verify:package` runs `scripts/build.mjs --clean`, which removes `dist/` first, so no stale file can be packed), the full `prepublishOnly` gates, then `npm publish --provenance` through **trusted publishing (OIDC)** with an exactly pinned npm 11, and `npm audit signatures` on the installed artifact.
2. **`github-release`** — downloads the tarball npm now serves for that version, checks it against the registry `dist.integrity`, refuses to continue if a tarball is nested inside `dist/`, writes `checksums.txt` (SHA-256 of every `package/dist` file, the tarball, and `sbom.json`), and creates the GitHub Release with those three assets and the version's CHANGELOG section.

The Release, its `checksums.txt`, and the npm artifact are therefore the same bytes. Consumers that pin the GitHub Release tarball (Drenyra Shell's `runtime-dependency` contract) and consumers that install from npm get the same artifact.

### Prerequisite — npm trusted publisher (owner action)

Trusted publishing also needs a setting that lives on npmjs.com, not in this repository: the `drenyra-ai` package must list **GitHub Actions → `arkelythex/drenyra-ai` → `release.yml`** as a trusted publisher. Without it, the publish step fails with `E404` on the `PUT` even after npm signs the provenance statement, as it did for `v0.5.0`. Confirm this setting before pushing a release tag.

> [!NOTE]
> **`v0.5.0` predates this pipeline.** It was published manually from a development tree, without provenance and with stale `dist/` files (#126). Its GitHub Release attaches the npm-served tarball byte for byte and discloses this. Run against `v0.5.0`, the `github-release` job refuses that tarball because of the nested `dist/drenyra-ai-0.4.0.tgz`.

## Commit and release discipline

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with scope when useful.
- **No AI attribution** in commit messages or release notes — no "Generated with" or "Co-Authored-By" AI markers.
- Contracts are high-materiality: a release touching contracts gets proportional risk review before publish.
- Consumers (Drenyra, Drenyra Shell) upgrade on their own cadence; a release never forces them.

## Next steps

- See what shipped in each version → [CHANGELOG.md](CHANGELOG.md)
- See what is planned → [ROADMAP.md](ROADMAP.md)
- Learn how to contribute → [CONTRIBUTING.md](CONTRIBUTING.md)
