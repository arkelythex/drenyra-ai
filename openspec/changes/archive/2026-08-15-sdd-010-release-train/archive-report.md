# Archive Report — sdd-010-release-train

> Change: `sdd-010-release-train` · Phase: archive · Store: openspec
> Archive status: **PASS**
> Archived to: `openspec/changes/archive/2026-08-15-sdd-010-release-train/`

## What was delivered

The Dominion program-lock checkpoint promoted (candidate → promoted) with fresh revision-bound facts, verified public sibling SHAs, deterministic self-excluding checksums, and the B5 release attestation. New `scripts/checksum-lock.mjs` (13 strict-TDD tests). Schema amended (draft-07 valid). Honesty rules honored: bootstrap `commitSha: null`, private trio `unknown` (E-010), stale W2 facts replaced.

## Delivery

- Chained PRs #52 (tooling) → #53 (promotion), both merged 2026-08-15. Bounded review N/A (RDD-off precedent).
- Suite 928/928 (915 + 13), typecheck/build clean, protected paths zero delta.

## Follow-ups (parent-owned, NOT part of this change)

1. **External B5 attestation readback** over the carrying commit (commit B) once merged — closes §7 item 4 fully.
2. **SDD-020 slice C** (program-lock-aware install) can now consume the promoted lock.

## Final verdict

**PASS** — release train executed; 7/7 requirements, 13/13 scenarios; suite 928/928; no blockers. SDD-010 is complete.
