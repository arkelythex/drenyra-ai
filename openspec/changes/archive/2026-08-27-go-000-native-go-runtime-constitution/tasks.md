# Tasks — GO-000 Native Go Runtime Constitution

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 833–923 authored lines total; each child candidate strictly below 300 |
| 400-line budget risk | High (the actual approved limit is stricter at 300 authored additions + deletions) |
| Chained PRs recommended | Yes |
| Suggested split | Draft tracker → Slice 0 → Slice 1 → Slice 2 → Slice 3 → Slice 4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

Measured planning baseline: 653 authored lines: explore 65, proposal 259, specification 223, design 106. Count tasks, config, program documentation, and lifecycle/readback evidence; exclude generated goldens from authored totals but retain them in snapshot identity. Remeasure additions plus deletions against the immediate parent before freezing each slice; split before 300. Keep this tasks file within 70–110 lines so Slice 3 remains below 300.

## Slice 0 — Migration evidence baseline

- [x] Freeze and preserve `openspec/changes/go-000-native-go-runtime-constitution/explore.md`; record 65 authored lines and the exact parent/child boundary. <!-- sdd-owner: implementation -->
- [x] Verify structural readback and rollback removes only Slice 0 evidence; preserve config, contracts, runtime files, and unrelated OpenSpec changes. <!-- sdd-owner: implementation -->

Target: 65 authored lines. Issue boundary: Master #80 and GO-000 #81; first child in the feature-branch chain.

## Slice 1 — Approved constitutional decision

- [x] Preserve `proposal.md` as the approved #80/#81 decision and remeasure its 259-line authored delta against Slice 0 before freezing. <!-- sdd-owner: implementation -->
- [x] Verify scope, non-goals, frozen-contract, fiscal-authority, oracle, compatibility, Pi, dependency, rollout, rollback, and acceptance boundaries; rollback returns to evidence-only state. <!-- sdd-owner: implementation -->

Target: 259 authored lines. Immediate parent: Slice 0. No runtime, contract, export, Pi, or unrelated OpenSpec edits.

## Slice 2 — Testable constitutional requirements

- [x] Preserve `specs/native-go-runtime-constitution/spec.md`; remeasure its 223-line authored delta against Slice 1 before freezing. <!-- sdd-owner: implementation -->
- [x] Verify every requirement has Given/When/Then evidence for byte behavior, fiscal authority, oracle isolation, ordered units, GO-090, controls, rollback, and non-completion; rollback removes only the acceptance contract. <!-- sdd-owner: implementation -->

Target: 223 authored lines. Immediate parent: Slice 1. GO-010 remains predecessor-dependent.

## Slice 3 — Executable governance design and task plan

- [x] Preserve `design.md` at 106 authored lines and this tasks file at 70–110 lines; remeasure the combined delta against Slice 2 and split before 300. <!-- sdd-owner: implementation -->
- [x] Verify allowlist, forbidden paths, five-slice topology, immediate-parent chain, #80/#81/#82 handling, 16-program roadmap, testing/style/command preservation, and bounded APPLY; rollback removes only the execution plan. <!-- sdd-owner: implementation -->

Target: 176–216 authored lines. Immediate parent: Slice 2. GO-010 #82 remains `blocked_predecessor`; GO-010 is not implemented here.

## Slice 4 — Bounded governance application and readback

- [x] Capture structural RED assertions before editing for stale TS/Node architecture guidance, unsupported `auto-forecast`, and the missing native-Go register in `openspec/config.yaml` and the program README. <!-- sdd-owner: implementation -->
- [x] Apply only targeted config architecture, `session.delivery_strategy`, and `rules.design` mutations; create `openspec/programs/native-go-runtime/README.md`; update current-change lifecycle bookkeeping only. <!-- sdd-owner: implementation -->
- [x] Preserve automatic execution, `strict_tdd: true`, the 300-line budget, testing fields, legacy Bun/Vitest/typecheck/build commands, Stack/16-program Peru v1/SUNAT and Style context, unrelated config, Dominion, and active changes. <!-- sdd-owner: implementation -->
- [x] Record identity, register, evidence columns, GO-010 `#82` as `blocked_predecessor`, GO-020–GO-100 as unassigned/predecessor-blocked, and Go commands as unavailable/not established. <!-- sdd-owner: implementation -->
- [x] Remeasure config, program record, bookkeeping, and total additions plus deletions against Slice 3; keep the 110–160 target strictly below 300. <!-- sdd-owner: implementation -->
- [x] Perform structural readback through the existing OpenSpec loader: assert `auto-chain`/automatic/strict-TDD/300, register evidence, and no Go success or migration completion claim. <!-- sdd-owner: implementation -->
- [x] Perform diff, whitespace, changed-path, and preservation checks against the pre-edit snapshot; every path must be allowlisted and forbidden paths unchanged. <!-- sdd-owner: implementation -->

Target: 110–160 authored lines. Immediate parent: Slice 3. No runtime tests for ceremony; legacy commands are optional evidence only, never Go proof. Evidence must record exact line counts, `git diff --check`, changed names/status, config-loader assertions, register fields, and preservation comparisons.

## Boundaries and delivery record

Allowlist: targeted `openspec/config.yaml`; `openspec/programs/native-go-runtime/README.md`; lifecycle bookkeeping under `openspec/changes/go-000-native-go-runtime-constitution/`. Forbidden: `contracts/**`, all Go/toolchain files, TS/JS runtime or test files, lockfiles, runtime/build/CLI/MCP/adapter/agent/ledger/mission/candidate/gate/receipt/recovery files, exports, every Pi path, Dominion, unrelated OpenSpec changes, and any path outside the allowlist. No Go, contract, TS runtime, or Pi changes.

Rollback restores only prior targeted config values and removes the new program record/bookkeeping delta; rerun preservation checks. APPLY executes no commit, push, or PR; feature-branch-chain tracker/child topology is planning only unless separately authorized.

## Delivery note

Commit, push, PR, and review actions are outside GO-000 APPLY and require separate explicit authorization. If receipt-driven review is enabled or discovered later, delivery validates the exact existing candidate authority; SDD does not start review automatically. Otherwise, ordinary repository policy applies. GO-010 #82 remains predecessor-blocked by GO-000 structural completion, not by an invented review lifecycle; its later SDD starts only after GO-000 verification/closure and separate execution routing.
