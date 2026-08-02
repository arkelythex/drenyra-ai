# Releasing — Drenyra AI

> **Last updated:** 2026-08-01.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Version policy

- Until the first contract is frozen, releases use **`0.0.1-prealpha.x`** (x increments per release).
- The first release that freezes a contract (`mission-protocol`, `candidate`, `receipt`, `gate` — per the ROADMAP's Phase 1) is **`0.1.0`**.
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

- **GitHub Release** — tag `v<version>` (signed tag) with release notes from the CHANGELOG.
- **npm provenance** — `npm publish --provenance` when the registry + CI support it.
- **SHA-256 manifest** — checksums of every published artifact (tarball, SBOM) so consumers can verify what they installed.
- **SBOM** — software bill of materials (generated at release; tooling to be wired into CI).
- **Changelog + migration note** — what changed and how consumers migrate.
- **Contract compatibility report** — which contracts are unchanged vs. bumped (major = breaking), so consumers know their compatibility window.

Pre-alpha note: provenance items beyond the signed tag and changelog are documented as the target; the SBOM/manifest tooling lands with the first real release.

## Commit and release discipline

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with scope when useful.
- **No AI attribution** in commit messages or release notes — no "Generated with" or "Co-Authored-By" AI markers.
- Contracts are high-materiality: a release touching contracts gets proportional risk review before publish.
- Consumers (Drenyra, Drenyra Pi) upgrade on their own cadence; a release never forces them.
