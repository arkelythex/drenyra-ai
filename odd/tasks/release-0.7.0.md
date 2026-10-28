# Release 0.7.0 and Shell propagation

Publish the merged journal validation fixes with verifiable provenance, then propagate the exact release artifact to Drenyra Shell. No additional fiscal behavior is introduced.

## Specs

- **S1** — User authorization: "yes continue"; review confirmation: "yes confirmo". Publish 0.7.0 through the existing release workflow after release-preparation gates pass.
- **S2** — Preserve the merged validation changes and document their migration effects. Keep RUC checksum and reference-clock decisions deferred.
- **S3** — Propagate the published artifact to Shell with checksums, packed-install checks, and the existing mutation corpus; expected result is 23/25 rejected, 0/3 false alarms.

## Tasks

- [x] T1 | S1–S2 | inline | Prepare version and changelog; run gates | commit: release preparation commit containing this document
- [x] T2 | S1 | workflow | Publish tag, verify npm provenance and GitHub artifacts | commit: #158 merge `2ebd989`, signed tag `v0.7.0`
- [x] T3 | S3 | inline, Shell repository | Update pin and verify consumer behavior | commit: drenyra-shell#101 merge `30ec42f`

## Log

### L1 — Original continuation request

> yes continue

### L2 — Human review confirmation

The owner replied "yes confirmo" after being asked whether they personally reviewed the diff of PR #131 before merging it. This records human review, not execution of an automated independent verifier. PR #131 merged as 7b18a6bc1408fa8a99d299879bb8108eda5c158b.

### L3 — Release preparation

Version 0.7.0 exposes the stricter validation explicitly as a pre-1.0 minor release. Frozen contract files and fiscal authority boundaries remain unchanged. The existing npm package-lock root version was stale at 0.5.0; only its two package-version fields are synchronized here, without dependency resolution. No meaningful RED applies to release metadata; structural checks, full tests and packed-install verification are used instead.

### L4 — Verification and publication boundary

The release-preparation check completed with exit 0 using `set -euo pipefail`: typecheck, lint, verify:package (full test suite and release integrity), packed-install, markdownlint (98 files), metadata assertions and git diff --check. The package contains 695 files and its CLI and library resolve in a clean Node consumer. No tag or artifact has been published.

Human review confirmation above applies to the kernel implementation in #131, not to these new release metadata changes. The release assessment requires independent verification (risk item 5); an automated verifier remains unavailable in this runtime. Issue #123 currently has only the `bug` label, not `status:approved`; protected-label authorization has not been inferred from general delivery authorization.

### L5 — Rebase onto the documentation chain

The owner chose "Release 0.7.0 después de la cadena de docs (recomendado)" and then "esprar y continuar de forma autonma" (Drenyra Shell `odd/tasks/runtime-pin-0.7.0.md`, L3–L4). After tracker #134 merged as `8e0fa28`, the unpublished preparation commit was rebased onto it without conflicts. The `[Unreleased]` entries the chain added (brand-system v0.4, SVG CSS palette declarations, canonical accents, release confirmation race) now ship in 0.7.0, and the migration note names the brand-system v0.4 effect on consumers. The L4 gates are re-run on the rebased tree.

### L6 — Gates on the rebased tree

One `set -euo pipefail` run exited 0: typecheck; lint (188 files, no fixes); `verify:package` (clean build, full test suite, release generation, package files, release integrity: checksums and SBOM verified); `verify-packed-install` (bin, library entry, and promoted composition under Node); `git diff --check`; package version `0.7.0`. The run kept only the tail of `verify:package`, so the test count was not captured; the exit code is the evidence. Markdownlint is not installed in this worktree; the Docs workflow on the PR covers it. No tag or artifact has been published.

### L7 — Publication and Shell propagation

- T2: #158 passed 9/9 checks and merged as `2ebd989`. A GPG-signed annotated tag `v0.7.0` on that commit (`git tag -v`: good signature) ran `release.yml` run 40774240267, where `publish` and `github-release` succeeded. The npm `dist.integrity` matches the GitHub Release tarball byte for byte, npm reports SLSA v1 provenance, and the Release `checksums.txt` verified all 664 entries with zero failures. The entry artifact `dist/cmd/cli.js` is unchanged from 0.6.0.
- T3: Drenyra Shell pinned 0.7.0 in arkelythex/drenyra-shell#101 (merge `30ec42f`; feature document `odd/tasks/runtime-pin-0.7.0.md`). Its control mutation suite measured 23/25 rejected (9200 bps) and 0/3 false alarms, as S3 expected. The remaining survivors are exactly the two deferred cases. Shell gates: 866/866 tests, the packed install verified the runtime, and PR CI passed 4/4.
- #123 stays open for the two deferred decisions (RUC checksum, reference clock).
