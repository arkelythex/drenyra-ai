# Native Go Runtime Migration Program

This register governs the ordered migration to a deterministic native Go runtime. Frozen fiscal contracts and observable behavior—not TypeScript module layout—define compatibility.

## Program identity

| Field | Value |
| --- | --- |
| `program_id` | `drenyra-ai-native-go` |
| `master_issue` | `#80` |
| `constitution_work_unit` | `GO-000/#81` |
| `harness_work_unit` | `GO-010/#82` |
| `contract_surface` | Frozen `contracts/**`, conformance evidence, and deterministic observable behavior |
| `target` | Deterministic native Go executable with a transport-independent fiscal core and explicit adapters |
| `oracle` | TS 0.5.0, temporary and evidence-only; never a production Go dependency |
| `execution_mode` | `automatic` |
| `delivery_strategy` | `auto-chain` |
| `chain_strategy` | `feature-branch-chain` |
| `review_budget_lines` | 300 authored additions plus deletions per candidate |
| `strict_tdd` | `true` for implementation-bearing work |

## Constitutional boundary

- Contracts govern implementations and remain read-only without a separate approved contract-change SDD.
- Canonicalization stays shallow and top-level; exact bytes govern serialization, hashing, identity, and receipts.
- Exact integer cents, complete bound scope, receipt-before-material-action, fail-closed gates and approvals, and append-only audit evidence remain mandatory.
- Harnesses and adapters are non-authoritative. Production Go cannot import or execute TS/Node or use PATH, global, alias, or ambient discovery.
- Current JavaScript exports and the TS 0.5.0 CLI remain temporary compatibility surfaces.
- Drenyra AI remains independent of Pi. Only GO-090 may establish exact, verified, package-local Pi consumption.

## Work-unit register

All work units inherit Master issue #80. Completion evidence starts as `pending` and advances only through the applicable independent gate.

| work_unit | scope_and_exit | depends_on | issue_binding | initial_state | completion_evidence |
| --- | --- | --- | --- | --- | --- |
| GO-000 | Constitution, config, and register; no runtime change | — | #81 | `complete` | `verified_and_archived` |
| GO-010 | Harness plus one sentinel/reference mechanism proof | GO-000 | #82 | `ready` | pending |
| GO-020 | Native Go skeleton and transport-independent shape | GO-010 | unassigned | `blocked_predecessor` | pending |
| GO-030 | Receipt and crypto parity | GO-020 | unassigned | `blocked_predecessor` | pending |
| GO-040 | Candidate, materiality, scope, and gate parity | GO-030 | unassigned | `blocked_predecessor` | pending |
| GO-050 | Mission and recovery parity | GO-040 | unassigned | `blocked_predecessor` | pending |
| GO-060 | Ledger and persistence parity | GO-050 | unassigned | `blocked_predecessor` | pending |
| GO-070 | CLI and MCP parity | GO-060 | unassigned | `blocked_predecessor` | pending |
| GO-080 | Native release boundary and evidence | applicable GO-030..GO-070 gates | unassigned | `blocked_predecessor` | pending |
| GO-090 | Exact verified package-local Pi consumption | GO-080 | unassigned | `blocked_predecessor` | pending |
| GO-100 | Approved compatibility retirement | GO-090 plus migration/rollback approval | unassigned | `blocked_predecessor` | pending |

## Command evidence

| Command class | Command | Status |
| --- | --- | --- |
| Legacy TS-oracle test | `bun run test` | available; not Go evidence |
| Legacy TS-oracle typecheck | `bun run typecheck` | available; not Go evidence |
| Legacy TS-oracle build | `bun run build` | available; not Go evidence |
| Native Go test/typecheck/build | unavailable/not established | requires an approved Go-bearing work unit |

## Evidence register

| work_unit | config_readback | document_readback | changed_lines | delivery_ref | status |
| --- | --- | --- | --- | --- | --- |
| GO-000 | verified in `verify-report.md` | verified in `verify-report.md` | 154 authored lines | feature-branch-chain Slice 4 | `verified_and_archived` |
| GO-010 | pending | pending | pending | predecessor-dependent | `ready` |

## Rollback and advancement

Rollback restores only the prior architecture paragraph, delivery strategy, and design rules in `openspec/config.yaml`, then removes this program record and GO-000 apply bookkeeping. It must preserve contracts, roadmap/testing/style context, commands, runtimes, exports, Dominion, unrelated OpenSpec state, and Pi.

GO-000 independent verification is complete and archived. GO-010 issue #82 is unblocked and ready for planning. GO-010 does not implement a production Go runtime or claim full parity; its scope is limited to the test harness, shared fixtures, TS-oracle runner, comparison protocol, deterministic diagnostics, and sentinel test.
