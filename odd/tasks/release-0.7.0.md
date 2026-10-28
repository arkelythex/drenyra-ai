# Release 0.7.0 and Shell propagation

Publish the merged journal validation fixes with verifiable provenance, then propagate the exact release artifact to Drenyra Shell. No additional fiscal behavior is introduced.

## Specs

- **S1** — User authorization: "yes continue"; review confirmation: "yes confirmo". Publish 0.7.0 through the existing release workflow after release-preparation gates pass.
- **S2** — Preserve the merged validation changes and document their migration effects. Keep RUC checksum and reference-clock decisions deferred.
- **S3** — Propagate the published artifact to Shell with checksums, packed-install checks, and the existing mutation corpus; expected result is 23/25 rejected, 0/3 false alarms.

## Tasks

- [x] T1 | S1–S2 | inline | Prepare version and changelog; run gates | commit: release preparation commit containing this document
- [ ] T2 | S1 | workflow | Publish tag, verify npm provenance and GitHub artifacts | commit: pending
- [ ] T3 | S3 | inline, Shell repository | Update pin and verify consumer behavior | commit: pending

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
