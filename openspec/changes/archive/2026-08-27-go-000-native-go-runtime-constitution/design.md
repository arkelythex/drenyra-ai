# Design — Chained GO-000 Governance Constitution

## Decision

GO-000 remains governance-only, but its complete authored candidate is already too large for one 300-line review. Delivery MUST use `auto-chain` with `feature-branch-chain`; no `size:exception` is authorized. APPLY is limited to the exact allowlist below and MUST NOT rewrite approved planning artifacts. Any planning compaction belongs to that artifact's owning planning phase before its slice is frozen.

The implementation outcome is one bounded projection into `openspec/config.yaml` plus one auditable program record at `openspec/programs/native-go-runtime/README.md`. It introduces no Go or TypeScript runtime behavior, contract change, export retirement, or Pi change.

## Authority and data flow

Authority order is Master **#80** → GO-000 **#81** → proposal/specification/design → read-only `contracts/**`. GO-010 is already approved as issue **#82**, depends on GO-000, and remains `blocked_predecessor` until GO-000 readback passes. GO-020..GO-100 have no approved issue numbers in this workspace; the program record MUST leave their issue bindings unassigned.

```text
#80 / #81 + proposal/spec/design -> chained review slices -> bounded config projection
                                                     \-> native-Go program register
#82 GO-010 <- blocked until GO-000 config + register + preservation readback pass
```

A mismatch fails closed; it does not widen scope or permit edits to frozen inputs.

## File and configuration contract

| Path | Authorized change | Preservation rule |
| --- | --- | --- |
| `openspec/config.yaml` | Replace obsolete architecture meaning in `context`; set `session.delivery_strategy: auto-chain`; replace only `rules.design` entries | Preserve all unrelated context, keys, values, order, testing capability fields, and commands |
| `openspec/programs/native-go-runtime/README.md` | Create the minimal program identity, boundaries, register, evidence, and rollback record | Do not modify Dominion program files |
| Current GO-000 change directory | Lifecycle-required tasks/apply-progress bookkeeping only | APPLY MUST NOT rewrite `explore.md`, `proposal.md`, specification, or `design.md` |

`context` MUST retain the existing Stack, 16-program Peru v1 roadmap/SUNAT slice context, Testing evidence, and Style text. Replace only the obsolete `Architecture:` paragraph with this meaning:

```yaml
Architecture: Drenyra AI compatibility is defined by frozen, transport-independent fiscal contracts under contracts/**, conformance evidence, and deterministic observable behavior—not TypeScript module layout or broad JavaScript export shape. The target is a deterministic native Go executable with a transport-independent fiscal core and explicit adapters. Contracts govern implementation; canonicalization remains shallow/top-level; exact bytes govern serialization, hashing, candidate identity, and receipts. Fiscal authority preserves exact integer cents, complete bound scope, receipt-before-material-action, fail-closed gates/approvals, and append-only audit evidence. TS 0.5.0 is a temporary oracle and compatibility surface only; production Go may not import or execute it or use PATH/global/ambient discovery. Existing testing/apply/verify commands are legacy TS-oracle commands; native Go verification remains unavailable until an approved Go-bearing work unit establishes it. Drenyra AI remains independent of Pi; exact verified package-local Pi consumption belongs only to GO-090.
```

The unchanged `Testing:` context line remains the sole init-time test-count evidence; the new architecture text MUST NOT duplicate its counts or failure totals. Preserve `session.execution_mode: automatic`, `session.review_budget_lines: 300`, `strict_tdd: true`, every `testing` field, and every `rules.apply`/`rules.verify` command string.

Replace only `rules.design` with rules requiring: (1) frozen contracts and deterministic behavior as the language-independent surface, native Go core plus explicit adapters, and TS 0.5.0 as oracle only; (2) shallow exact bytes, integer cents, complete scope, receipt-before-action, fail-closed gates/approvals, and append-only audit; (3) non-authoritative harnesses/adapters, no production TS/Node or ambient executable discovery, and explicit dependencies/evidence/rollback. No chain-strategy YAML key is invented.

## Program record contract

The program identity MUST record: `program_id=drenyra-ai-native-go`, `master_issue=#80`, `constitution_work_unit=GO-000/#81`, `harness_work_unit=GO-010/#82`, frozen contract surface, deterministic native Go target, TS 0.5.0 oracle-only status, `execution_mode=automatic`, `delivery_strategy=auto-chain`, `chain_strategy=feature-branch-chain`, `review_budget_lines=300 authored additions plus deletions per candidate`, and `strict_tdd=true` for implementation-bearing work.

The register columns are `work_unit`, `scope_and_exit`, `depends_on`, `issue_binding`, `initial_state`, and `completion_evidence`:

| Unit | Scope/exit | Depends on | Issue | Initial state |
| --- | --- | --- | --- | --- |
| GO-000 | Constitution, config, register; no runtime change | — | #81 | `readback_pending` |
| GO-010 | Harness plus one sentinel/reference mechanism proof | GO-000 | #82 | `blocked_predecessor` |
| GO-020 | Native Go skeleton and transport-independent shape | GO-010 | unassigned | `blocked_predecessor` |
| GO-030 | Receipt/crypto parity | GO-020 | unassigned | `blocked_predecessor` |
| GO-040 | Candidate/materiality/scope/gate parity | GO-030 | unassigned | `blocked_predecessor` |
| GO-050 | Mission/recovery parity | GO-040 | unassigned | `blocked_predecessor` |
| GO-060 | Ledger/persistence parity | GO-050 | unassigned | `blocked_predecessor` |
| GO-070 | CLI/MCP parity | GO-060 | unassigned | `blocked_predecessor` |
| GO-080 | Native release boundary/evidence | applicable GO-030..GO-070 gates | unassigned | `blocked_predecessor` |
| GO-090 | Exact verified package-local Pi consumption | GO-080 | unassigned | `blocked_predecessor` |
| GO-100 | Approved compatibility retirement | GO-090 + migration/rollback approval | unassigned | `blocked_predecessor` |

All rows inherit Master #80. Completion evidence is `pending` initially; GO-000 becomes `complete` only after structural readback. The record also classifies `bun run test`, `bun run typecheck`, and `bun run build` as legacy TS-oracle commands and native Go commands as `unavailable/not established`. Its evidence table uses `work_unit`, `config_readback`, `document_readback`, `changed_lines`, `delivery_ref`, and `status`.

## Exact APPLY boundary

**Allowlist:** (1) `openspec/config.yaml`, only the locations above; (2) new `openspec/programs/native-go-runtime/README.md`; (3) lifecycle-required bookkeeping under `openspec/changes/go-000-native-go-runtime-constitution/`.

**Forbidden:** `contracts/**`; all Go/toolchain files (`**/*.go`, `go.mod`, `go.sum`); all TypeScript/JavaScript runtime or test source, lockfiles, runtime build config, CLI/MCP, adapter, agent, ledger, mission, candidate, gate, receipt, or recovery implementation; package export maps/barrels; every Drenyra Pi path; `openspec/programs/drenyra-dominion/**`; every unrelated active/archived OpenSpec change including `fiscal-authority-kernel`; and every path outside the allowlist, even when suggested by a formatter or check.

## Review chain and honest forecast

Workspace readback before this correction is exactly 770 authored planning lines: `explore.md` 65, `proposal.md` 259, specification 223, and prior `design.md` 223. Generated goldens alone are exempt; SDD artifacts, tasks, config, program documentation, and lifecycle evidence count.

Use one draft/no-merge tracker branch and these immediate-parent child slices:

| Slice | Reviewable outcome | Authored target | Dependency and rollback boundary |
| --- | --- | ---: | --- |
| 0 | Migration evidence baseline | 65 actual | First child; rollback removes only exploration evidence |
| 1 | Approved constitutional decision | 259 actual | Depends on 0; rollback returns to evidence-only state |
| 2 | Testable constitutional requirements | 223 actual | Depends on 1; rollback removes acceptance contract only |
| 3 | Executable governance design and task plan | Design 106 actual + tasks 70–110 target = **176–216** | Depends on 2; tasks MUST budget against final design; rollback removes execution plan only |
| 4 | Bounded governance application and readback | Config + program record + lifecycle evidence, target **110–160** | Depends on 3; rollback restores only bounded config values and removes the new record |

This design-phase correction compacts its own artifact from 223 to 106 lines, making the final measured planning baseline **653 lines** (65 + 259 + 223 + 106). The complete final candidate is forecast at **833–923 authored lines**: planning 653 actual, tasks 70–110, config delta 25–45, program record 65–85, and lifecycle/readback evidence 20–30. Tasks MUST replace estimates with measured additions plus deletions and split a slice again before it reaches 300. Planning compaction may occur only in the owning exploration/proposal/spec/design phase, never during APPLY. There is no size-exception path.

## Verification

1. Measure each child against its immediate parent; reject `>=300` authored additions plus deletions while retaining generated files in snapshot identity.
2. Parse config through the existing OpenSpec loader; read back `automatic`, `auto-chain`, `300`, strict TDD, the architecture replacement, design rules, preserved roadmap/testing/style context, and unchanged command fields.
3. Verify program identity, GO-010 `#82` + `blocked_predecessor`, unassigned GO-020..GO-100 issues, all dependencies, and evidence columns.
4. Compare all unrelated config/context and Dominion/active-change state to the pre-edit snapshot; any drift fails.
5. Compare the complete changed-path list to the allowlist and prove no forbidden-path delta.
6. Record structural diff/whitespace results and exact line counts. Bun/Vitest/typecheck/build are optional legacy TS-oracle regression evidence, not GO proof; no Go command or success may be claimed.

## Rollout and rollback

Roll out slices 0→4 through `feature-branch-chain`; later children target the immediate parent and the tracker stays draft/no-merge. APPLY starts only after planning slices are frozen, performs the bounded config projection and record creation, then records readback. GO-000 completes only when every slice and preservation gate passes; only then may #82/GO-010 leave `blocked_predecessor`.

Rollback stops dependent native-Go work, reverts only GO-000's prior `context` architecture paragraph, `session.delivery_strategy`, and `rules.design`, removes only the new native-Go program record, and re-runs preservation checks. It retains SDD history and leaves roadmap/testing context, Dominion, unrelated changes, contracts, runtimes, exports, and Pi untouched.

## Risks

| Risk | Control |
| --- | --- |
| Existing context is erased | Replace only obsolete architecture meaning; read back roadmap, testing capability, style, and all unrelated fields |
| GO-010 authority is lost or later issues are fabricated | Bind #82 explicitly; leave GO-020..GO-100 unassigned and predecessor-blocked |
| Planning prose bypasses the budget | Count every authored SDD line; require the measured feature-branch chain; no exception |
| APPLY rewrites approved planning | Closed allowlist plus owning-phase-only compaction rule |
| Legacy TS evidence is mistaken for Go readiness | Preserve evidence, classify commands as legacy oracle-only, and keep Go commands unavailable |
