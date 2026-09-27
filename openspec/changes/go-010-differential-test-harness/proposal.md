# Proposal — GO-010 Differential Test Harness & TS Oracle

> Change: `go-010-differential-test-harness` · Phase: propose · Store: openspec
> Issue binding: Master #80, GO-010 #82. Delivery: auto-chain, review budget 300 lines.

## Context & Motivation

Drenyra AI is transitioning from TypeScript 0.5.0 to a deterministic native Go runtime. The constitution established in GO-000 (#81) dictates that compatibility is defined strictly by frozen public contracts (`contracts/**`), shallow canonicalization, and deterministic observable behavior.

To ensure that subsequent domain implementation verticals (GO-020 through GO-070) maintain exact behavioral parity without regressions, we must construct a differential testing harness and TS 0.5.0 oracle runner before writing any Go business logic.

## Proposed Changes

GO-010 introduces the differential test infrastructure:

1. **Shared Fixtures Ingestion:**
   - Unified loader for contract fixtures under `contracts/**` (conformance vectors, schema definitions, test keys).
   - Structured fixture definition schema for cross-language test cases.

2. **TypeScript 0.5.0 Oracle Invocation Engine:**
   - Deterministic sub-process executor that runs the TS oracle (`dist/cmd/cli.js`) under explicit environment isolation (no ambient `PATH`, no shell aliases, controlled environment variables).
   - Captures stdout, stderr, process exit code, and parsed JSON outputs.

3. **Differential Comparison Engine:**
   - Shallow key-sorted canonical JSON comparator matching `sortedStringify`.
   - Exact byte-level comparison for signed receipts, cryptographic hashes, and serialized representations.
   - Fail-closed error classification.

4. **Deterministic Mismatch Diagnostics:**
   - Structured diagnostic reports when candidate and oracle outputs diverge:
     - Specific field path differences.
     - Side-by-side hex dump for byte serialization discrepancies.
     - Process exit code and error message diffs.

5. **Sentinel Proof-of-Concept Test:**
   - An end-to-end sentinel test executing the differential harness against the TS oracle with known baseline inputs.
   - Verifies that exact matches pass, and deliberately corrupted inputs produce accurate diagnostic reports.

## Non-Goals

- Implementing Go production business logic (receipt signing, ledger persistence, mission runner, candidate evaluation, gate checks).
- Modifying `contracts/**` schemas, markdown documents, or frozen conformance vectors.
- Implementing Drenyra Pi package-local integration (reserved exclusively for GO-090).
- Retiring or modifying the existing TypeScript 0.5.0 codebase.

## Rollback Boundary

Rollback is strictly non-destructive: removing the Go harness packages under `internal/testutil/differential/` (or `test/harness/`) and test files restores the repository to the baseline GO-000 state.
