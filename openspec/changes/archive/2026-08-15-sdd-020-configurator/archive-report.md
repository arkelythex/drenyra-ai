# Archive Report — sdd-020-configurator (slice 1)

> Change: `sdd-020-configurator` · Phase: archive · Store: openspec
> Archive status: **PASS** (slice 1 archived; later slices documented, NOT complete)
> Archived to: `openspec/changes/archive/2026-08-15-sdd-020-configurator/`

## Structured status (consumed)

```yaml
schemaName: spec-driven
changeName: sdd-020-configurator
artifactStore: openspec
changeRoot: openspec/changes/sdd-020-configurator (archived)
artifacts:
  exploration: done
  proposal: done
  specs: done (specs/configurator/spec.md — 6 requirements, 14 scenarios)
  design: done
  tasks: done (43/43 complete)
  applyProgress: done
  verifyReport: done (gentle-ai.verify-result/v1 envelope; verdict pass, 0 blockers)
  archiveReport: done (this file)
applyState: complete
verifyState: complete
archiveState: complete
```

## What was delivered (slice 1)

SDD-020 (Universal Agent Configurator) first slice — the reliable transition and diagnostic foundation:

- **`configurator/managed-config.ts` (new library):** strict managed-manifest classification (`absent|invalid|legacy|current-schema`), legacy hydration, SHA-256 asset rendering, safe host-path derivation, `planUpgrade`/`planRollback`/`commitTransition` (atomic, fail-closed, manifest-last), read-only `runConfigDiagnostics`. `node:crypto` only, no reverse imports.
- **`upgrade run <version>` / `rollback run`:** thin adapters registered in the CLI with help text; idempotent; fail-closed (`ROLLBACK_UNAVAILABLE`, `COMPOSITION_NOT_PACKAGED`); never installs host binaries; preserves foreign config byte-for-byte.
- **Doctor diagnostics depth:** four managed-config checks (marker/skills drift, package-pin mismatch, missing config dir/marker, malformed manifest) appended to the `{status, checks, readonly:true}` report with the shared `--home` rule.
- **Install/sync delegation:** composition record added on new installs; legacy manifests remain readable.
- **`ManagedConfigError` recognition** in `cmd/output/errors.ts` (exit 0 success / 1 business error / 2 usage).

## Delivery

- **Two chained PRs** (per the tasks forecast split on the changed-line overage, maintainer-approved reset `sdd020-reset-01`): **#34 foundation** (library + upgrade/rollback) → **#35 integration** (doctor + install/sync), both merged 2026-08-15.
- Post-apply bounded review: **not applicable** — RDD off clone-local (immutable review transport unsupported); Git-normal policy precedent (fiscal chain, reconciliation PRs).
- Changed lines (runtime accounting): 565 vs the 400 budget (+41%); overage accepted by maintainer.

## Final state

- 43/43 tasks complete; 6/6 requirements and 14/14 scenarios satisfied; suite **798/798** (774 baseline + 24 new) and typecheck/build clean at `351bdef` (output hashes bound in the verify envelope).
- Invariants proven by tests: never-install-host, foreign-file preservation, atomic fail-closed transitions, no reverse imports, legacy-manifest compatibility.
- SDD-020 record updated to `lifecycle:in-progress` (maturity `partial`).

## Follow-ups (later SDD-020 slices — documented, NOT part of this change)

1. **Host integration** — Codex, Claude Code, OpenCode, Drenyra Pi host configs (the four-host E2E surface).
2. **Per-host pinned runtime/model/tool** (`pinned-ai-runtime`).
3. **Program-lock-aware install** — every host consumes the promoted artifact, never a copy of `main`.

## Final verdict

**PASS** — slice 1 complete and archived; 43/43 tasks, 6/6 requirements, 14/14 scenarios; suite 798/798 and typecheck/build green; no blockers.
