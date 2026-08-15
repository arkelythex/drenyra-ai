# Tasks — SDD-100 Option B Projection Surface

> Change: `sdd-100-projection-surface` · Phase: tasks · Strict TDD: `bun run test`
> Scope: DRAFT projection contract (`contracts/projection.md`) + read-only CLI dump (`drenyra-ai project`).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~499 (design estimate 413–585, midpoint) |
| 400-line budget risk | High (over 400) |
| Chained PRs recommended | No (single cohesive PR with documented size exception; split fallback if rejected) |
| Suggested split | Single PR, or PR 1 → PR 2 on exception rejection |
| Delivery strategy | exception-ok |
| Chain strategy | feature-branch-chain (split fallback only) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: High
```

## Scope recap and delivery shape

- **Single PR, documented size exception.** Design estimates ~499 changed lines (413–585),
  exceeding both the 300-line budget and the 400-line chaining threshold. Precedent exists:
  slice A delivered 425, SDD-110 delivered 1043. Record the exception before apply.
- **Split fallback (only if the exception is rejected):**
  - PR 1 — contract + index (`contracts/projection.md`, `contracts/README.md`): ~130–165 lines.
  - PR 2 — command + tests + CLI/doctor wiring: ~290–397 lines.
- **No `--continue-to` flag (approved non-goal, carried verbatim).** The approved proposal
  states "this CLI slice does not add a requested-continuation flag" and excludes "requested
  continuation" among non-goals. The CLI accepts only `project <missionId> [--store <file>]`
  and passes any library-returned `deny` through unchanged. This overrides the tentative
  `--continue-to` recommendation from the parent delegation.
- **`cmd/declared-surface.ts` untouched.** Exactly six FROZEN declared contracts remain;
  `projection` must NOT appear in `DECLARED_CONTRACTS` or `DECLARED_CONTRACT_FILES`.
- **No new conformance suite.** The DRAFT contract delegates conformance to the existing
  slice-A suite at `projection/__tests__/`. No `contracts/__tests__/` projection tests.
- **Command-layer tests only.** No re-testing of projection semantics (transition/action/denial
  matrices, determinism, immutability, fail-closed) — those stay owned by `projection/__tests__/`.

## Phase 0 — Preflight

- [x] Verify the working tree is clean and note the current commit (baseline: 1010 passing /
  0 failures at `7049fe2`). <!-- sdd-owner: implementation -->
- [x] Run `bun run test` and confirm the pre-change baseline (1010 passing / 0 failures). <!-- sdd-owner: implementation -->
- [x] Run `bun run typecheck` and `bun run build` and confirm both pass before any change. <!-- sdd-owner: implementation -->

## Phase 1 — RED/GREEN units (T-PB-001..005)

### T-PB-001 — Command skeleton + happy path (REQ-PB-006/007, SC-PB-011/012)

Files: `cmd/commands/project.ts` (new), `cmd/__tests__/project.test.ts` (new).

- [x] **RED:** add one `QUEUED` test proving exit `0`, `missionId` wrapper, JSON emission, and
  deep equality between emitted `projection` and the `projectMission` result; confirm it fails. <!-- sdd-owner: implementation -->
- [x] **GREEN:** implement `projectCommand(args)` in `cmd/commands/project.ts` — parse via
  `parseMissionFlags`, reject `flags.demo`, reject flag-shaped leftovers in `flags.rest`, require
  exactly one positional mission ID; hydrate `MissionFileStore`, `findById(missionId)`, call
  `projectMission({ status: snapshot.status })` through `../../projection/index.js`, and
  `emitJson({ missionId, projection })`; optional `emitSummary` to stderr without altering stdout. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE/REFACTOR:** confirm `projection` is emitted unchanged (no translation,
  re-derivation, or reshaping); split any non-obvious branches into small helpers. <!-- sdd-owner: implementation -->

### T-PB-002 — Error paths and exit codes (REQ-PB-008/009, SC-PB-015/016/017)

Files: `cmd/__tests__/project.test.ts` (extend), `cmd/commands/project.ts` (extend).

- [x] **RED:** table-drive missing mission (exit `1` + structured JSON `code: "MISSION_NOT_FOUND"`)
  and usage/store failures (exit `2`): no mission ID, extra positional, `--demo`, unknown flag,
  missing `--store` value, malformed store data, store I/O failure; assert no projection JSON on exit `2`. <!-- sdd-owner: implementation -->
- [x] **GREEN:** implement fail-closed mapping — `MISSION_NOT_FOUND` returns `1`; every parse,
  argument, flag, and store I/O/parse failure returns `2` with error text and no partial projection. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** assert the command is read-only — no mutation, guards, gates,
  reconciliation, receipts, or network; only stdout JSON, optional stderr summary, and exit code. <!-- sdd-owner: implementation -->

### T-PB-003 — UNKNOWN recovery + 15-state shape table (REQ-PB-007, SC-PB-013/014/020)

Files: `cmd/__tests__/project.test.ts` (extend). Command-layer shape only — no projection-semantics re-testing.

- [x] **RED:** table-drive all 15 canonical states with thin checks only — exit `0`, `status`
  passthrough, `eligibleTransitions` is an array, `nextAction` exists; add a focused `UNKNOWN`
  shape check asserting `recoveryTransitions` equals `["RUNNING","FAILED","COMPLETED"]` and is
  not presented as ordinary `eligibleTransitions`; add a no-denial-without-request assertion. <!-- sdd-owner: implementation -->
- [x] **GREEN:** make the table pass against the implemented command; add a one-off projector
  mock returning a typed `deny` to prove the command preserves it unchanged (adapter pass-through
  only, not denial semantics). <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE/REFACTOR:** confirm no row re-asserts the full transition, action, or denial
  matrices that slice-A conformance pins. <!-- sdd-owner: implementation -->

### T-PB-004 — Wiring smoke: dispatch, help, doctor (REQ-PB-010/012, SC-PB-018/019/021/022)

Files: `cmd/cli.ts`, `cmd/commands/doctor.ts`, `cmd/__tests__/project.test.ts` (extend).

- [x] **RED:** add a wiring smoke asserting `project` resolves through `COMMANDS`, appears in
  `helpText()` and the usage-error expected-commands string with the exact syntax
  `project <missionId> [--store <file>]` (never `project run`), and appears in the doctor
  `cliCommands` inventory; confirm it fails before wiring. <!-- sdd-owner: implementation -->
- [x] **GREEN:** register `project: { run: projectCommand }` in `COMMANDS` and add a narrow
  one-level dispatch branch in `main()` when `argv[0] === "project"`; update header list,
  `helpText()`, and unknown-command usage text; add `project` to the doctor CLI inventory via a
  shared module-level exported constant (test seam only, not a package export). <!-- sdd-owner: implementation -->
- [x] **VERIFY:** confirm `cmd/declared-surface.ts` is byte-for-byte unchanged and the six FROZEN
  declared contracts are intact; confirm all new/edited user-facing strings, docs, and tests are
  English and non-monetary (no money/fiscal/SUNAT semantics). <!-- sdd-owner: implementation -->

### T-PB-005 — DRAFT contract document + index (REQ-PB-001..005/011, SC-PB-001..010/005/006)

Files: `contracts/projection.md` (new), `contracts/README.md` (modify).

- [x] Write `contracts/projection.md` following the 11-section DRAFT structure of
  `connector-adapter.md`: `# Contract: projection`; header `Version: 0.1 · Status: DRAFT ·
  Transport-agnostic`; transport-neutral read-only boundary; IMPORTANT DRAFT callout naming
  conformance delegation, non-adoption warning, and freeze criteria; `## Purpose`; `## Normative
  surface` (15 states, closed 12-code `nextAction`, closed 5-code denial vocabulary, UNKNOWN
  `recoveryTransitions` separation); `## Invariants` (canonical passthrough, canonical
  eligibility, UNKNOWN separation, determinism, immutability, fail-closed, never-second-authority,
  receipt fidelity); `## Fail-closed behavior`; `## Conformance` (delegates only to
  `projection/__tests__/`, states no second suite is added); `## Compatibility` + `## Freeze
  criteria`; `## Non-claims`. Document MUST NOT invent, rename, add, or omit any field/state/
  transition/action code/denial code/cause/continuation vs the slice-A surface. <!-- sdd-owner: implementation -->
- [x] Read back the document and assert: no frozen/adopted/consumed claims; `Freeze criteria`
  states freeze requires documented adoption plus explicit approval; denial mappings carry the
  slice-A cause/continuation semantics; no generic `verified` field, receipt, hash, signature,
  signer-trust, or integrity-verification authority; `nextAction` is guidance and `deny` is
  explanation, never approval/execution/verification/completion. <!-- sdd-owner: implementation -->
- [x] Update `contracts/README.md`: add the DRAFT index row `projection | 0.1 | DRAFT |
  Drenyra Command Center, Drenyra Pi, CLI` and update the status banner to mention the DRAFT
  without changing the statement that exactly six contracts are FROZEN. <!-- sdd-owner: implementation -->
- [x] Confirm `projection` is NOT added to `DECLARED_CONTRACTS` or `DECLARED_CONTRACT_FILES`;
  confirm no contract-side test suite is created under `contracts/__tests__/`. <!-- sdd-owner: implementation -->

## Phase 2 — Gates

- [x] Run `bun run typecheck` and `bun run build`; both must pass. <!-- sdd-owner: implementation -->
- [x] Run `bun run test`; expect 0 new failures (1010 existing passing preserved). <!-- sdd-owner: implementation -->

## Phase 3 — Close

- [x] Update the change record with the applied state, size-exception note, and the six-frozen
  declaration confirmation. <!-- sdd-owner: implementation -->
- [x] Orchestrator commits and opens the PR (single PR with documented size exception; split
  fallback per PR 1 → PR 2 only if the exception is rejected). <!-- sdd-owner: parent -->

## Acceptance mapping

| Requirement | Tasks |
| --- | --- |
| REQ-PB-001 (DRAFT doc) | T-PB-005, SC-PB-001/002 |
| REQ-PB-002 (normative alignment) | T-PB-005, SC-PB-003/004 |
| REQ-PB-003 (conformance delegation) | T-PB-005, SC-PB-005/006 |
| REQ-PB-004 (authority invariants) | T-PB-005, SC-PB-007/008 |
| REQ-PB-005 (no freeze/declared untouched) | T-PB-005 + Phase 3, SC-PB-009/010 |
| REQ-PB-006 (load + emit projection) | T-PB-001, SC-PB-011/012 |
| REQ-PB-007 (15 states, UNKNOWN, deny, no `--continue-to`) | T-PB-001 + T-PB-003, SC-PB-013/014/020 |
| REQ-PB-008 (exit codes, fail-closed) | T-PB-002, SC-PB-015/016 |
| REQ-PB-009 (read-only) | T-PB-002, SC-PB-017 |
| REQ-PB-010 (registration consistency) | T-PB-004, SC-PB-018/019 |
| REQ-PB-011 (command-layer tests only) | T-PB-001..004, SC-PB-020/021 |
| REQ-PB-012 (English, non-monetary) | T-PB-004/005, SC-PB-022 |
