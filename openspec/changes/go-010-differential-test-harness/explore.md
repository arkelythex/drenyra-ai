# Exploration — GO-010 Differential Test Harness & TS Oracle

> Change: `go-010-differential-test-harness` · Phase: explore · Store: openspec
> Issue binding: Master #80, GO-010 #82. Delivery: auto-chain, 300 line review budget.

## Executive finding

GO-010 builds the verification bedrock for the entire native Go migration: a differential test harness, shared fixtures infrastructure, deterministic TS 0.5.0 oracle runner, byte-exact comparison protocol, structured mismatch diagnostics, and a working sentinel test. 

GO-010 implements **no production Go business runtime** (receipts, ledger, missions, gates, candidates, recovery). Its sole deliverable is the verification bank that will prevent contractual and behavioral regressions during the progressive migration in GO-020 through GO-070.

## Current state and discovery

1. **Frozen public contracts (`contracts/**`):**
   - Normative schemas, markdown specifications, and frozen conformance vectors (`receipt-schema/fixtures/conformance-vectors.v1.json`, dev-keys, brand-system).
   - Contracts are strictly read-only; no modification is permitted in GO-010.

2. **TypeScript 0.5.0 Oracle:**
   - Available in the repository via `dist/cmd/cli.js` / TypeScript build artifacts.
   - Must be invoked deterministically without relying on ambient `PATH`, global Node installations, or shell aliases.
   - The harness must handle stdout, stderr, process exit codes, and JSON serialization consistently.

3. **Comparison Protocol & Invariants:**
   - **Shallow canonicalization:** key-sorted top-level serialization matching `sortedStringify`.
   - **Exact integer cents:** monetary amounts are BigInt whole cents, never floats.
   - **Deterministic diagnostic output:** when a differential test fails, it must emit structured diagnostic reports detailing: field path, expected (TS oracle) vs actual (Go candidate), byte hex dump on serialized outputs, and exit code differences.

4. **Sentinel Test Mechanism:**
   - A self-contained reference test proving the differential harness works end-to-end:
     - Feeds a known input to the TS oracle.
     - Feeds the same input to a minimal reference Go mock/fixture runner.
     - Asserts byte-for-byte and structured parity.
     - Demonstrates intentional mismatch detection and failure reporting.

## Boundaries and dependencies

- **Depends on:** GO-000 (Archived, constitution active).
- **Enables:** GO-020 (Go Skeleton & transport-independent core).
- **Prohibited in GO-010:** Production domain implementations (receipt signing, ledger persistence, mission state machine, gate evaluations), package-local Pi consumption (reserved for GO-090), contract schema changes.

## Next phase

Proceed to `proposal` and `specs` for `go-010-differential-test-harness`.
