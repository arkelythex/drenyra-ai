# Tasks — GO-010 Differential Test Harness & TS Oracle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–700 authored lines total; each child candidate strictly below 300 |
| 400-line budget risk | High (the actual approved limit is stricter at 300 authored additions + deletions) |
| Chained PRs recommended | Yes |
| Suggested split | Slice 0 (Fixtures) → Slice 1 (Oracle) → Slice 2 (Comparator) → Slice 3 (Sentinel) → Slice 4 (Readback) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

Measured planning baseline: explore, proposal, specification, and design. Keep each child candidate within the 300-line limit.

## Slice 0 — Go Module & Shared Fixture Loader

- [ ] Initialize `go.mod` for `github.com/arkelythex/drenyra-ai` using standard library only. <!-- sdd-owner: implementation -->
- [ ] Implement `internal/testutil/differential/fixtures.go` to parse `contracts/receipt-schema/fixtures/conformance-vectors.v1.json` and dev keys. <!-- sdd-owner: implementation -->
- [ ] Add fixture loading unit tests asserting proper parsing and fail-closed handling on corrupt paths. <!-- sdd-owner: implementation -->

## Slice 1 — TS Oracle Subprocess Runner

- [ ] Implement `internal/testutil/differential/oracle.go` executing the TS oracle under isolated environment without ambient PATH. <!-- sdd-owner: implementation -->
- [ ] Enforce bounded execution timeout, context cancellation, and complete stdout/stderr/exit code capture. <!-- sdd-owner: implementation -->
- [ ] Add oracle runner tests verifying execution, environment isolation, and timeout error handling. <!-- sdd-owner: implementation -->

## Slice 2 — Differential Canonical Comparator & Diagnostics

- [ ] Implement `internal/testutil/differential/comparator.go` enforcing shallow key-sorted JSON equality and exact BigInt integer cents. <!-- sdd-owner: implementation -->
- [ ] Implement `internal/testutil/differential/diagnostics.go` formatting property-path diffs and hex dumps for binary mismatches. <!-- sdd-owner: implementation -->
- [ ] Add comparator unit tests verifying shallow ordering reconciliation, integer cent precision, and diagnostic reports. <!-- sdd-owner: implementation -->

## Slice 3 — Sentinel Differential Test & Mechanism Proof

- [ ] Implement `internal/testutil/differential/sentinel_test.go` executing the full differential loop against the TS oracle. <!-- sdd-owner: implementation -->
- [ ] Verify both passing parity on valid contract vectors and diagnostic failure emission on mutated inputs. <!-- sdd-owner: implementation -->
- [ ] Execute `go test ./internal/testutil/differential/...` and record deterministic test evidence. <!-- sdd-owner: implementation -->

## Slice 4 — Verification, Readback & Program Register Update

- [ ] Record complete TDD cycle and line budget accounting in `apply-progress.md`. <!-- sdd-owner: implementation -->
- [ ] Update `openspec/programs/native-go-runtime/README.md` recording GO-010 completion and unblocking GO-020. <!-- sdd-owner: implementation -->
- [ ] Generate `verify-report.md` via `gentle-ai sdd-verify-validate` confirming all requirements and scenarios pass. <!-- sdd-owner: implementation -->
