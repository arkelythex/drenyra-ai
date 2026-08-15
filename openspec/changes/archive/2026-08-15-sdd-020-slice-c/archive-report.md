# Archive Report — sdd-020-slice-c

> Change: `sdd-020-slice-c` · Phase: archive · Store: openspec
> Archive status: **PASS**
> Archived to: `openspec/changes/archive/2026-08-15-sdd-020-slice-c/`

## What was delivered

SDD-020 slice C (program-lock-aware install):

- **PR 1 (#55):** `scripts/promoted-composition.mjs` generator — emits the promoted lock's five non-carrying facts to `dist/promoted-composition.json` (deterministic, bootstrap-safe, fail-closed), wired into `release:generate` + verifiers.
- **PR 2 (#56):** `configurator/promoted-composition.ts` offline reader (valid/absent/invalid, no cwd/network) + `programLockAwarenessDiagnostic`; `getPackageMetadata` relocated library-safe (cmd re-exports); install reports the promoted composition (skew never gated); doctor appends the program-lock-awareness check; capabilities claim + boundary assertion updated.

## Delivery

- Chained PRs #55 → #56, both merged 2026-08-15. Bounded review N/A (RDD-off precedent).
- Suite 967/967 (947 + 20), typecheck/build/release-gates green, protected paths zero delta.

## Follow-ups (documented, NOT part of this change)

1. **External B5 attestation readback** over the carrying commit (parent-owned, SDD-010 follow-up).
2. **Pi host-serving integration** consuming the program-lock-aware install (pi session side).

## Final verdict

**PASS** — SDD-020 slice C complete and archived; 6/6 requirements, 20/20 scenarios; suite 967/967; no blockers. SDD-020 is fully implemented.
