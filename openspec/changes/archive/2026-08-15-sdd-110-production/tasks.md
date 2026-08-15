# Tasks — sdd-110-production (Option A: Connector-Adapter Conformance, first slice)

> Phase: tasks · Store: openspec · Scope: new `adapters/connector.ts` mutation surface + in-memory
> mock conformance + `contracts/connector-adapter.md` DRAFT v0.1, first slice.
> Contract target: `connector-adapter` v0.1, status **DRAFT** — NOT frozen.
> Protected (do NOT touch): `missions/`, `tenant-core/`, `receipts/`, `flow/close.ts`,
> `adapters/registry.ts`, `adapters/local.ts`, `cmd/declared-surface.ts`, `DECLARED_ADAPTERS`,
> capability-matrix rows, CI workflow files, or any sibling-repository file. Existing Core
> primitives are consumed, never modified.
> Test runner: `bun run test` (Vitest) · Typecheck: `bun run typecheck` · Build: `bun run build`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 318–370 (design estimate: connector.ts 90–105, conformance test 145–165, contract doc 80–95, contracts/README 2–4, adapters/index 1) |
| 400-line budget risk | Medium — upper bound 370 is under the 400-line hard cap but ~18% over the 300-line repo review budget; near the threshold |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | exception-ok (forecast exceeds the 300-line budget; follow the SDD-100 slice-A precedent of documenting actual vs forecast at close) |
| Chain strategy | size-exception (318–370 vs 300-line repo review budget; no 400-line exception required) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium
```

Notes:

- **Single cohesive PR.** The forecast (318–370) exceeds the 300-line repo review budget
  (`review_budget_lines: 300`) because the DRAFT contract document + conformance vectors are
  integral to the deliverable. Do NOT weaken conformance or trim safety vectors to fit; stay as
  close to the estimate as possible, and STOP-AND-REPORT if implementation crosses 400 lines.
- **SDD-100 precedent.** Slice A shipped 425 changed lines vs the 300 cap and documented the size
  exception at close (SDD-020 slices set the 768–788 precedent). This change does the same:
  record actual `additions + deletions` against the 300 forecast in the change record at close.
- **No silent additions.** Any scope addition beyond the design file map is a STOP; do not expand
  files, exports, or vectors without recording it.
- **`Chain strategy: size-exception`** because no stack applies to a single independent PR; the
  label records that the 300-line budget is intentionally exceeded under the exception-ok delivery
  strategy. `Decision needed before apply: No` (370 < 400, risk Medium; auto-apply may proceed).
- Follows the established repo slice pattern: implementation + tests + contract doc + exports in one
  focused PR, orchestrator commits.

## Task ownership

`implementation` = authoring code/tests/docs + running verification. `parent` = post-apply bounded
review and lifecycle gates (grouped separately at the end). Every checkbox carries exactly one
terminal owner marker.

---

## Phase 0 — Preflight evidence capture (no commit)

- [x] Capture `git status --porcelain` and `git diff --name-only` BEFORE any edit, to serve as the
  integrity baseline. Confirm the protected paths (`missions/`, `tenant-core/`, `receipts/`,
  `flow/close.ts`, `adapters/registry.ts`, `adapters/local.ts`, `cmd/declared-surface.ts`,
  `.github/workflows/`) are clean at baseline. <!-- sdd-owner: implementation -->
- [x] Run `bun run test` to record the suite baseline (expect 981 passing, 0 failures at `main`
  `27dfd03`). Report any pre-existing failure separately, never as a new connector regression. <!-- sdd-owner: implementation -->
- [x] Run `bun run typecheck` and `bun run build` to confirm a green baseline before any edit. <!-- sdd-owner: implementation -->

---

## Phase 1 — RED/GREEN units (Strict TDD)

Each unit: write the focused RED test first, confirm it fails, then implement to GREEN, then
TRIANGULATE/REFACTOR, recording evidence for each stage. Units 1–7 define behavior; unit 8 is the
conformance suite that closes the loop. All RED/GREEN tests live under
`adapters/__tests__/connector-conformance.test.ts`; library code lives in `adapters/connector.ts`.

### T-CONN-001 — Type surface + validators (RED/GREEN 1)

**Files:** `adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`, `adapters/index.ts`
**Satisfies:** REQ-CONN-001/002/004/006

- [x] RED: Import the intended public API from `adapters/index.ts`. Assert: (a) `validateConnectorExecuteRequest` rejects a non-empty-mission-ID violation and an invalid idempotency key with `ConnectorValidationError` code `INVALID_IDEMPOTENCY_KEY`; (b) it validates the raw scope through `validateTenantScope` and returns a branded `ConnectorExecuteInput` whose `tenantScope` is a `ValidatedTenantScope`; (c) a malformed RUC/period/company propagates the existing `TenantScopeError` (fail-closed, no partial execution). Confirm RED (module and guards do not exist yet). <!-- sdd-owner: implementation -->
- [x] GREEN: In `adapters/connector.ts` add the closed public types from design D1 (`ConnectorExecuteResult` = `SUCCESS` with `evidence` | `UNKNOWN` with `stableIdentifier`, no `FAILED`/`REFUSED` branch), `ConnectorCapability`, `ConnectorTarget`, `ConnectorExecuteRequest`/`ConnectorExecuteInput`, `ConnectorAdapter`, `ConnectorAdapterDependencies`, `ConnectorAdapterFactory`, and `ConnectorValidationError` with the D7 code union. Implement `validateConnectorExecuteRequest` (mission ID + `isValidIdempotencyKey` + `validateTenantScope` → branded input) and the `assertConnectorAuthority`, `assertSameConnectorScope`, `assertConnectorResult` guards. Export `export * from "./connector.js";` from `adapters/index.ts`. Run `bun run test -- adapters/__tests__/connector-conformance.test.ts` until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm `validateConnectorExecuteRequest` never accepts a raw `TenantScope` into the mutation port (design D2 — adapter receives only branded scope) and that every D7 error code is reachable and closed. Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-002 — Idempotent execute semantics (RED/GREEN 2)

**Files:** `adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`
**Satisfies:** REQ-CONN-001, SC-CONN-001/002/003

- [x] RED: Drive the mock adapter: (a) same key + same payload hash replays the recorded result and the mock mutation counter stays at exactly one (SC-CONN-001); (b) same key + different payload hash throws the existing `IdempotencyConflict` carrying both hashes and performs no mutation (SC-CONN-002); (c) a deferred first call leaves `EXECUTING` visible, a concurrent same-key call fails closed with `ALREADY_EXECUTING`, and exactly zero-or-one mutation reaches the hook (SC-CONN-003); (d) a recorded terminal local error replays without another mutation. Confirm RED (no idempotency driver yet). <!-- sdd-owner: implementation -->
- [x] GREEN: In `adapters/connector.ts` build the immutable execution envelope (mission ID, target, validated scope components, command — excluding the key) and bind it with `canonicalHash` (design D3). Read the injected `IdempotencyStore` by key; on different hash throw the existing `IdempotencyConflict`; on a matching terminal record replay the recorded result/error without mutation; on matching `EXECUTING` throw `ALREADY_EXECUTING`; otherwise claim `EXECUTING`, invoke the mutation hook exactly once, persist a terminal envelope, and return. Import `canonicalHash`, `IdempotencyConflict`, `IdempotencyStore`, and the in-memory store through `../missions/index.js` only — never copy the hash/conflict/record/store implementation. Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm replay returns the recorded result regardless of success or failure and never re-attempts a terminal outcome; confirm the key binds to the complete envelope so replay never crosses tenant or authority boundaries (REQ-CONN-001). Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-003 — UNKNOWN outcome + reconciliation mapping (RED/GREEN 3)

**Files:** `adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`
**Satisfies:** REQ-CONN-002/003, SC-CONN-004/005/006/007/008/009

- [x] RED: Assert (a) an interrupted call returns `UNKNOWN` with a stable identifier and no verdict (SC-CONN-004/005); (b) `executed` + verifiable evidence maps through `reconcileExternalCall` to `record` (SC-CONN-006); (c) `executed` without verifiable evidence throws `EXECUTED_WITHOUT_EVIDENCE` (SC-CONN-007); (d) `not-executed` maps to `retry` demonstrated with the original idempotency key (SC-CONN-008); (e) `indeterminate` maps to `human-intervention` without retry or record (SC-CONN-009); (f) a missing resolver throws `NO_RESOLVER`. Confirm RED (no UNKNOWN driver / mapping yet). <!-- sdd-owner: implementation -->
- [x] GREEN: In `adapters/connector.ts`, for an `UNKNOWN` result carry a non-empty `stableIdentifier`, make no verdict, and build the existing `ExternalCall` from the identifier, target `system`, and input `missionId`, delegating to `reconcileExternalCall` unchanged (design D6 — no parallel resolver or decision vocabulary). Persist the UNKNOWN as `COMPLETED`. Map outcomes/decisions exactly as the existing primitive defines them (`executed|not-executed|indeterminate` → `record|retry|human-intervention`); a retry reuses the original key and envelope; no helper auto-retries. Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm no `UNKNOWN` ever claims executed or not-executed without verifiable evidence (REQ-CONN-002) and that `EXECUTED_WITHOUT_EVIDENCE` / `NO_RESOLVER` fail closed through `reconcileExternalCall` — never guessed. Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-004 — Scope isolation (RED/GREEN 4)

**Files:** `adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`
**Satisfies:** REQ-CONN-004, SC-CONN-010/011

- [x] RED: Assert (a) an execution bound to scope A with a response/evidence belonging to scope B fails closed before mutation and before evidence acceptance, and `assertSameConnectorScope(A, B)` surfaces the rejection (SC-CONN-010); (b) an invalid scope (malformed RUC/period, or missing company) fails closed with `TenantScopeError` and its specific code with no mutation and no evidence acceptance (SC-CONN-011). Confirm RED (scope guards not wired yet). <!-- sdd-owner: implementation -->
- [x] GREEN: In `adapters/connector.ts` make `assertSameConnectorScope(expected, actual)` delegate to the existing `sameTenantScope` and throw `ConnectorValidationError` code `SCOPE_MISMATCH` on mismatch. Call it before any response-associated evidence is accepted (design D2). Enforce `TenantScopeError` propagation for invalid input scopes before adapter invocation. Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm no read or write crosses tenants and mismatch is rejected before both mutation and evidence acceptance (REQ-CONN-004). Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-005 — Evidence-bound success + EXTERNAL_SUBMISSION assertion (RED/GREEN 5)

**Files:** `adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`
**Satisfies:** REQ-CONN-005, SC-CONN-012/013

- [x] RED: Assert (a) a success carrying complete verifiable evidence (stable identifier, external state, provenance, moment, lowercase 64-hex response hash) passes `isVerifiableEvidence` (SC-CONN-012); (b) `assertConnectorResult` accepts `SUCCESS` only when `isVerifiableEvidence` passes and throws `UNVERIFIABLE_EVIDENCE` otherwise, and accepts `UNKNOWN` only with a non-empty stable identifier; (c) the success vector asserts compatibility with `ReceiptType.EXTERNAL_SUBMISSION` and the complete absence of receipt/signature/issuance fields (SC-CONN-013, design D4). Confirm RED (result guard not implemented). <!-- sdd-owner: implementation -->
- [x] GREEN: In `adapters/connector.ts` implement `assertConnectorResult` to reject unverifiable success and empty/unknown UNKNOWN identifiers at runtime despite the static union. Ensure `SUCCESS.evidence` satisfies `isVerifiableEvidence` (inherits the `/^[0-9a-f]{64}$/` response-hash constraint). Core owns receipt construction; the adapter never mints, signs, or issues a receipt — the conformance vector asserts receipt-kind compatibility without constructing one (design D4). Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm only a `SUCCESS`-shaped result MAY claim external execution and it MUST carry verifiable evidence (REQ-CONN-005); confirm the mock contains no receipt, signature, or issuance fields. Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-006 — Restricted authority + node:crypto-only proof (RED/GREEN 6)

**Files:** `adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`
**Satisfies:** REQ-CONN-006/007, SC-CONN-014/015/016

- [x] RED: Assert (a) an adapter declared `["submit"]`/`sunat-sire`/`PE` rejects operation `settle` before mutation (SC-CONN-014); (b) it rejects system `bank`/`PE` or `sunat-sire`/`CL` before mutation and does not reinterpret its declaration (SC-CONN-015); (c) a structural inspection proves the loaded module and conformance suite import no built-in other than permitted `node:crypto` through existing Core — no `http`, `net`, `pg`, or `fs` (SC-CONN-016). Confirm RED (authority guard + structural probe absent). <!-- sdd-owner: implementation -->
- [x] GREEN: In `adapters/connector.ts` implement `assertConnectorAuthority` comparing declared system, jurisdiction, and operation as exact, case-sensitive strings before any idempotency claim or mutation; an empty operations list grants no authority; undeclared system/jurisdiction/operation each throw the D7 code (`UNDECLARED_SYSTEM`/`UNDECLARED_JURISDICTION`/`UNDECLARED_OPERATION`). Add the import-surface structural vector asserting no forbidden built-in. Run until GREEN. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm the declared operation list is the mechanical, conformance-testable enforcement of restricted authority and the adapter never decides materiality, changes policy, bypasses gates, or expands its own authority (REQ-CONN-006). Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-007 — DRAFT contract document + index row (doc)

**Files:** `contracts/connector-adapter.md`, `contracts/README.md`
**Satisfies:** REQ-CONN-008, SC-CONN-017/018

- [x] Author `contracts/connector-adapter.md` following the `brand-system.md` convention and the design §"Contract document outline": DRAFT header (name, v0.1, status, transport-agnostic), important notice that CI pins drift and freeze requires adoption + explicit approval, purpose and distinction from the fetch-only `EvidenceAdapter`, normative surface, invariants (replay, UNKNOWN honesty, scope isolation, restricted authority, evidence-bound success, Core-owned receipts, no I/O/credentials), fail-closed behavior + inherited error identities, conformance statement (mock vectors in the existing Vitest `test` job), DRAFT compatibility, freeze criteria, and explicit non-claims (no live connector, registration, flow wiring, capability promotion, production store, KMS, network, receipt issuance, or policy authority). <!-- sdd-owner: implementation -->
- [x] Add one DRAFT index row to `contracts/README.md` (2–4 lines) summarizing `connector-adapter` v0.1 as DRAFT, plus the status summary line. Do NOT touch any other contract file or promote any capability-matrix row; `DECLARED_ADAPTERS` stays empty. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm the document labels the contract DRAFT v0.1 and makes no statement claiming a live ERP, SUNAT/SIRE, bank, e-invoicing, or document connector exists (SC-CONN-017/018). Record evidence. <!-- sdd-owner: implementation -->

### T-CONN-008 — Conformance suite completes; CI drift coupling noted (RED/GREEN 7)

**Files:** `adapters/__tests__/connector-conformance.test.ts`
**Satisfies:** REQ-CONN-009, SC-CONN-019/020

- [x] RED/GREEN: With the mock passing all normative vectors (replay, `IDEMPOTENCY_CONFLICT`, UNKNOWN reconciliation record/retry/human-intervention, scope rejection, authority rejection, evidence-bound success), run the focused suite and confirm every vector passes (SC-CONN-019). Add one negative fixture that proves contract drift fails the suite (e.g. replay re-executing, or success without evidence) WITHOUT committing a failing test — assert it rejects inside the test body (SC-CONN-020). <!-- sdd-owner: implementation -->
- [x] Confirm the existing `bun run test` discovers the new Vitest file under `adapters/__tests__/` with NO CI workflow edit; the `test` job runs it automatically (REQ-CONN-009). Record the drift-coupling note: a violating vector MUST fail the suite and the CI job. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE/REFACTOR: Confirm all driver behavior is in-memory and deterministic (no live network, filesystem, database, cloud, or vendor call; `node:crypto` only through Core) and no capability-matrix row or `DECLARED_ADAPTERS` was touched. Record evidence. <!-- sdd-owner: implementation -->

---

## Phase 2 — Gates (full verification, no commit)

- [x] Run `bun run typecheck` (strict, `tsc --noEmit`) — expect zero errors. <!-- sdd-owner: implementation -->
- [x] Run `bun run build` — expect success. <!-- sdd-owner: implementation -->
- [x] Run full `bun run test` — expect 0 new failures (981 baseline + new conformance tests all pass). Report any pre-existing failure separately; it never converts a new connector regression into a pass. <!-- sdd-owner: implementation -->
- [x] Count authored `additions + deletions` across the five allowed paths (`adapters/connector.ts`, `adapters/__tests__/connector-conformance.test.ts`, `adapters/index.ts`, `contracts/connector-adapter.md`, `contracts/README.md`). Record the measured count and compare to the 318–370 forecast. If it would exceed 400, STOP and re-scope — do not weaken safety vectors to recover budget. <!-- sdd-owner: implementation -->
- [x] Run `git status --porcelain` and audit every changed path against the design file map. Confirm no `missions/`, `tenant-core/`, `receipts/`, `flow/close.ts`, `adapters/registry.ts`, `adapters/local.ts`, `cmd/declared-surface.ts`, capability-matrix row, CI workflow, or out-of-scope path changed. <!-- sdd-owner: implementation -->

---

## Phase 3 — Close (orchestrator)

- [x] Update the change record (spec/design/tasks) with the final changed-line count and any verification evidence, following the SDD-100 slice-A precedent of documenting actual vs forecast; confirm no protected path changed vs the Phase 0 baseline. <!-- sdd-owner: implementation -->
- [x] Orchestrator commits the single PR (implementation + tests + contract doc + exports in one focused PR) and opens/delivers it per repository policy. <!-- sdd-owner: parent -->

---

## Acceptance mapping (REQ-CONN → proving tasks)

| Requirement | Proving task(s) |
| --- | --- |
| REQ-CONN-001 — Idempotent execute | T-CONN-001 (surface) + T-CONN-002 (SC-CONN-001/002/003) |
| REQ-CONN-002 — UNKNOWN outcome | T-CONN-003 (SC-CONN-004/005) |
| REQ-CONN-003 — Reconciliation mapping | T-CONN-003 (SC-CONN-006/007/008/009) |
| REQ-CONN-004 — Scope isolation | T-CONN-004 (SC-CONN-010/011) |
| REQ-CONN-005 — Evidence-bound success / EXTERNAL_SUBMISSION | T-CONN-005 (SC-CONN-012/013) |
| REQ-CONN-006 — Restricted authority | T-CONN-001 (guards) + T-CONN-006 (SC-CONN-014/015) |
| REQ-CONN-007 — No credentials or network | T-CONN-006 structural (SC-CONN-016) + T-CONN-008 |
| REQ-CONN-008 — DRAFT status; no capability claims | T-CONN-007 (SC-CONN-017/018) |
| REQ-CONN-009 — CI drift gate | T-CONN-008 (SC-CONN-019/020) |

---

## Parent-owned lifecycle gates (post-apply)

- [x] Run bounded review on the single PR against the spec acceptance criteria (REQ-CONN-001..009), the protected/excluded file integrity (`missions/`, `tenant-core/`, `receipts/`, `flow/close.ts`, `adapters/registry.ts`, `adapters/local.ts`, `cmd/declared-surface.ts`, CI), and closed error-vocabulary conformance, then gate apply/verify per the lifecycle. <!-- sdd-owner: parent -->
- [x] Run `sdd-verify` for the change and confirm CRITICAL/WARNING state before archive. <!-- sdd-owner: parent -->

## Risks

- **Line budget (design risk 5):** forecast 318–370 exceeds the 300-line repo review budget; a single cohesive PR is still under the 400 hard cap. Use table-driven tests and shared fixtures to reduce duplication without collapsing distinct fail-closed assertions (never weaken safety vectors). Document the actual-vs-forecast count at close (SDD-100 precedent).
- **Atomic claim gap (design risk 1):** `IdempotencyStore` has `get`/`put`, not compare-and-set. The in-memory mock proves single-process behavior only by making `EXECUTING` visible before async mutation. A distributed production adapter needs transactional serialization or fencing — outside Option A, must be resolved before any live connector.
- **ExternalCall context gap (design risk 2):** `ExternalCall` lacks tenant scope and idempotency key; the caller retains original context, reuses the key on retry, and enforces scope before reconciliation. v0.1 does not create a parallel call type.
- **Runtime vs static validation (design risk 3):** branding protects typed callers, but transport inputs remain untrusted; the raw-request guard and result guard are mandatory at composition boundaries.
- **Premature availability claim (design risk 4):** the mock, export, and CI gate could be misread as production. DRAFT wording, unchanged `DECLARED_ADAPTERS`, and no capability promotion control this (REQ-CONN-008).
