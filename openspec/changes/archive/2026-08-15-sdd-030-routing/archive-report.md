# Archive Report — sdd-030-routing (slice A+B)

> Change: `sdd-030-routing` · Phase: archive · Store: openspec
> Archive status: **PASS** (slice A+B archived; slice C documented, NOT complete)
> Archived to: `openspec/changes/archive/2026-08-15-sdd-030-routing/`

## Structured status (consumed)

```yaml
schemaName: spec-driven
changeName: sdd-030-routing
artifactStore: openspec
changeRoot: openspec/changes/sdd-030-routing (archived)
artifacts:
  exploration: done
  proposal: done
  specs: done (specs/routing/spec.md — 4 requirements, 15 scenarios)
  design: done
  tasks: done (38/38 complete)
  applyProgress: done
  verifyReport: done (gentle-ai.verify-result/v1 envelope; verdict pass, 0 blockers)
  archiveReport: done (this file)
applyState: complete
verifyState: complete
archiveState: complete
```

## What was delivered (slice A+B)

SDD-030 (Organic Accounting Work Routing) first slice — the typed work-unit/work-result surface:

- **`routing/types.ts`:** immutable `WorkUnit`/`WorkResult` type surface — type-only imports from `missions/`/`candidates/`, branded `JsonInteger`/`Sha256Hash`, literal attempt limits (research ≤3, correction =1), the 9-kind `WorkStopReason` discriminated union, `CanonicalTransitionValidator = typeof validateTransition`.
- **`routing/helpers.ts`:** deterministic construction/validation — mission-derived `createWorkUnit` (DRAFT entry, stages through the canonical 15-state lifecycle), injected-validator stage advance (never a duplicated transition matrix), `createWorkResult` with candidate refs by subjectHash, evidence refs by hash, BigInt cents, fail-closed results, no free-text authority.
- **`routing/index.ts` + root `index.ts`:** module + root exports.
- **tsconfig include extension:** `routing/` added to `tsconfig.json` and `tsconfig.build.json` (official typecheck coverage).

## Delivery

- **Two chained PRs**: **#39 module** (surface + helpers + exports) → **#40 tests** (45 cases), both merged 2026-08-15.
- Post-apply bounded review: **not applicable** — RDD off clone-local (immutable review transport unsupported); Git-normal policy precedent.
- Changed lines: runtime accounting within budget (settle completed without budget-exceeded block); authored additions ≈1,810 including the 1,046-line test suite.

## Final state

- 38/38 tasks complete; 4/4 requirements and 15/15 scenarios satisfied; suite **843/843** (798 baseline + 45 new) and typecheck/build clean at `57ea56a` (output hashes bound in the verify envelope).
- Invariants proven by tests: type-only Core boundaries, no reverse imports, no duplicated transition matrix, BigInt cents, typed fail-closed stop reasons, no free-text authority.
- SDD-030 record updated to `lifecycle:in-progress` (maturity `partial`).

## Follow-ups (documented, NOT part of this change)

1. **Slice C — preflight router** over the §5 criteria (fail-closed on ambiguous input), medium risk.
2. **Authorized adapter execution** integration (router proposes only; Core determines transitions).

## Final verdict

**PASS** — slice A+B complete and archived; 38/38 tasks, 4/4 requirements, 15/15 scenarios; suite 843/843 and typecheck/build green; no blockers.
