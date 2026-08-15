```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:779bac754580f4a633dbf9d73875b83dccb5339ac803b4bc8c3db916ba4032a7
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 13/13
test_command: bun run test
test_exit_code: 0
test_output_hash: sha256:d5cd9f47274aa3d8fea08578dd0e4d1720aef231496a9cb1b41ae09b438cb07d
build_command: bun run typecheck
build_exit_code: 0
build_output_hash: sha256:1383d3b3e514b0940d50f6b0e77596f839420a9680372de8c536ec57c0ce6e98
```

# Verify Report — SDD-010 Release Train (program-lock promotion)

## Status: PASS

Final SDD verification for change `sdd-010-release-train` at the merged candidate `HEAD 3e275aa` (main, after PRs #52/#53). All final gates are green: all tasks complete, 7/7 spec requirements and 13/13 scenarios satisfied, suite **928/928** (915 baseline + 13 new), typecheck/build clean. **No blockers.**

## Structured status and actionContext

```yaml
schemaName: spec-driven
changeName: sdd-010-release-train
artifactStore: openspec
changeRoot: openspec/changes/sdd-010-release-train (archived)
artifacts:
  exploration: done
  proposal: done
  specs: done (specs/release-train/spec.md — 7 requirements, 13 scenarios)
  design: done
  tasks: done
  applyProgress: done
  verifyReport: done (this file, created by this phase)
  archiveReport: done (archived with this change)
applyState: complete
verifyState: complete
archiveState: complete
```

## Closure verification evidence

- **R1 revision-bound freshness:** promoted lock cites the corroborated revision `d440203` (host 0.4.0, tests 915/915 at R; current suite 928/928 at `3e275aa`); stale 0.2.1/774/`549ed64` facts replaced.
- **R2 honest sibling facts:** engram `f997abc9…` / pi `42607035…` (PUBLIC, gh api 2026-08-15T07:38Z) verified; private trio stays `unknown`/`awaiting-evidence` (E-010) — no fabricated SHAs.
- **R3 promotion status:** candidate → promoted; schema valid draft-07; lock validates against the amended schema.
- **R4 checksums:** `scripts/checksum-lock.mjs` (13 tests) — deterministic, self-excluding (lock file excluded), no carrying-commit reference; artifact digest matches the published v0.4.0 release asset.
- **R5 attestation:** B5/§7 item 4 recorded (signed v0.4.0 tag pins `d440203`); external readback over the carrying commit remains parent-owned.
- **R6 no runtime consumption:** docs + tooling only; no program-lock consumption code (SDD-020 slice C).
- **R7 testable gates:** all gate facets pass.

## Issues Found

**CRITICAL**: None
**WARNING**: None
**SUGGESTION**: None

## Verdict

PASS — the program-lock checkpoint is promoted and the release train executed at `3e275aa`: 7/7 requirements, 13/13 scenarios, suite 928/928; no blockers. SDD-010 (contracts frozen + release-train executed) is complete; the parent-owned external B5 readback over the carrying commit remains the single open follow-up.
