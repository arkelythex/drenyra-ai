# Design — GO-010 Differential Test Harness & TS Oracle

## Architecture

GO-010 establishes the cross-language differential verification framework. It allows Go test suites to invoke the TypeScript 0.5.0 oracle, load frozen contract vectors from `contracts/**`, and compare candidate Go outputs against the oracle with shallow canonicalization and exact byte diagnostics.

```text
contracts/fixtures/ <---------------+
                                    |
                                    v
                            +---------------+
                            | FixtureLoader |
                            +---------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
            +---------------+               +---------------+
            |  TSOracle     |               | Candidate Go  |
            |  (Subprocess) |               | Mock/Adapter  |
            +---------------+               +---------------+
                    |                               |
                    +---------------+---------------+
                                    |
                                    v
                            +---------------+
                            | Comparator    |
                            | & Diagnostics |
                            +---------------+
                                    |
                                    v
                            PASS / Mismatch Report
```

## Component Breakdown

### 1. Fixture Loader (`internal/testutil/differential/fixtures.go`)
- Discovers and parses frozen JSON vectors under `contracts/receipt-schema/fixtures/conformance-vectors.v1.json`.
- Exposes typed Go data structures for receipt contents, signatures, keys, and expected hashes.
- Read-only: never modifies files under `contracts/**`.

### 2. TS Oracle Runner (`internal/testutil/differential/oracle.go`)
- Executes the built TypeScript CLI (`dist/cmd/cli.js`) or Node script using `os/exec.CommandContext`.
- Enforces strict isolation: explicit environment variables, working directory pinning, no ambient `PATH` fallback.
- Returns structured `OracleResult` containing stdout, stderr, exit code, execution duration, and parsed JSON payload.

### 3. Canonical Comparator (`internal/testutil/differential/comparator.go`)
- Implements shallow top-level key sorting for JSON objects (`sortedStringify` equivalence).
- Asserts monetary integer cent equality (no floating-point tolerance).
- Compares byte slices directly (e.g. SHA-256 digests, Ed25519 signatures).

### 4. Deterministic Diagnostics (`internal/testutil/differential/diagnostics.go`)
- Formats structured failure reports when candidate and oracle outputs diverge.
- Emits property path diffs, expected vs actual values, and side-by-side hex dumps for binary mismatches.

### 5. Sentinel Test (`internal/testutil/differential/sentinel_test.go`)
- Exercises the complete differential loop against a known contract fixture vector.
- Asserts that matching inputs return a clean PASS.
- Mutates input bytes intentionally and asserts that the harness catches the discrepancy and produces a structured diagnostic report.

## Review Workload Forecast

Estimated changed lines: ~650 lines total.
Split into reviewable chained slices under the 300-line review budget:
- Slice 0: Exploration & Proposal
- Slice 1: Specification & Design
- Slice 2: Tasks plan
- Slice 3: Test harness implementation (`go.mod`, `fixtures.go`, `oracle.go`, `comparator.go`, `diagnostics.go`, `sentinel_test.go`)
- Slice 4: Apply progress, verification report, and program register update
