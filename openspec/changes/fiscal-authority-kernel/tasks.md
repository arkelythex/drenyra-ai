# Tasks — Fiscal Authority Kernel (Program 1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,500–1,800 authored lines across the chain (≈200–420 per apply batch; see batch table) |
| 400-line budget risk | High (program exceeds 400 as one unit) / Low–Medium per batch |
| Chained PRs recommended | Yes |
| Suggested split | tracker `fiscal-authority/kernel` → PR 1A tenant-core → PR 1A2 tenant-isolation → PR 1B evidence → PR 1C journal → PR 1D candidate-ordering → PR 1E policy-cdr |
| Delivery strategy | auto-chain (chain approved; no per-slice ask) |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

**Explicit next apply boundary (rescoped):** Slice 1A ships as two staging units per user approval — `tenant-core` (validation, branded `TenantScope`, deterministic scope key/equality, exports/wiring, and their focused tests; < 300 lines, 295 actual) and `tenant-isolation` (non-disclosing cross-tenant read isolation behavior and the static import-boundary scanner; unstaged until the core candidate passes the bounded review gate). Parent owns branch creation and staging. Follow RED → GREEN → TRIANGULATE → REFACTOR with `bun run test`; finish with `bun run typecheck` and `bun run build`.

**1E split (decided now):** 1E ships as two apply batches on one branch — 1E-1 `policy/**` (≈180 lines) and 1E-2 `cdr/**` (≈290 lines). The split boundary is the `policy/` vs `cdr/` file boundary. If the combined 1E count exceeds 400 authored lines during implementation, promote 1E-2 to its own chained PR `fiscal-authority/cdr`; no size exception is requested.

## Chain and batch plan

| Batch | Branch (targets) | Included files | Budget | Rollback |
| --- | --- | --- | ---: | --- |
| 1A-core | `fiscal-authority/tenant-core` (off tracker base) | `tenant-core/**`, root `index.ts`, `package.json` (`./tenant` → `dist/tenant-core`), `tsconfig.json`, `tsconfig.build.json` | <300 (295 actual) | Remove `tenant-core/` module and its exports |
| 1A-isolation | `fiscal-authority/tenant-isolation` (unstaged until core review passes) | `tenant-isolation/**` (read isolation + scanner) | ≤260 | Remove `tenant-isolation/` and the scanner |
| 1B | `fiscal-authority/evidence` (→ 1A) | `evidence/**`, wiring | ≤350 | Revert `evidence/` only |
| 1C-1 | `fiscal-authority/journal` (→ 1B) | `journal/types.ts`, `journal/validate.ts`, entry `record`/`post` + tests | ≤250 | Revert journal batch 1 only |
| 1C-2 | `fiscal-authority/journal` (same branch) | `journal/journal.ts` `supersede`/`revoke`, status-independence and ledger-boundary tests, `journal/index.ts`, wiring | ≤200 | Revert journal batch 2 only |
| 1D | `fiscal-authority/candidate-ordering` (→ 1C) | `fiscal/**`, wiring | ≤400 | Remove `fiscal/` adapter; `candidates/` untouched |
| 1E-1 | `fiscal-authority/policy-cdr` (→ 1D) | `policy/**`, wiring | ≤220 | Remove `policy/` only |
| 1E-2 | `fiscal-authority/policy-cdr` (same branch) | `cdr/**`, wiring | ≤300 | Remove `cdr/` only |

Conventions for every batch:

- Strict TDD with `bun run test` (vitest) as the authoritative command: RED (one failing behavioral test) → GREEN (minimum behavior) → TRIANGULATE (boundaries/inverse paths) → REFACTOR (behavior unchanged).
- Tests live in the same work unit as the behavior they prove; each commit is one deliverable unit.
- No `agents/`, `cmd/`, or `ingest/` imports; no reverse imports into existing modules; no edits inside `contracts/**` or frozen conformance fixtures.
- Money is `bigint` cents; version/sequence numbers are JSON integers; const-object types; flat interfaces; no `any`.
- `bun run test`, `bun run typecheck`, and `bun run build` must pass after each batch and for the integrated chain.

## Slice 1A — Tenant authority

Branch `fiscal-authority/tenant`. Files: `tenant/types.ts`, `tenant/scope.ts`, `tenant/index.ts`, `tenant/__tests__/scope.test.ts`, `tenant/__tests__/import-boundaries.test.ts`, root `index.ts`, `package.json`, `tsconfig.json`.

### 1A-1 Scope validation fails closed (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — in `tenant/__tests__/scope.test.ts`, write a failing test: `validateTenantScope` accepts `{ companyId: "ACME", ruc: "20123456789", period: "202603" }` and rejects non-numeric RUC `"2012345678X"` with no partial scope; run `bun run test` and record the failing assertion. <!-- sdd-owner: implementation -->
- [x] GREEN — implement `tenant/types.ts` (`TenantScope`, branded `ValidatedTenantScope`, `TenantScopeError`) and `tenant/scope.ts` `validateTenantScope(input: unknown): ValidatedTenantScope` validating all three fields atomically (trimmed non-empty company, exactly 11 ASCII digits RUC, `YYYYMM` period with month 01–12); run `bun run test` until the RED test passes. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — extend `tenant/__tests__/scope.test.ts` with boundary cases required by the spec: RUC lengths 9, 10, 11, 12 and non-numeric; periods `"202613"` (month 13), `"20261"` (five chars); empty and whitespace-only company; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — extract shared validation helpers in `tenant/scope.ts` without changing behavior; run `bun run test` again. <!-- sdd-owner: implementation -->

### 1A-2 Deterministic scope identity (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — in `tenant/__tests__/scope.test.ts`, write failing tests: two scopes with identical components compare equal via `sameTenantScope` and produce the same `tenantScopeKey`; two scopes differing only in period are distinct; equality is deterministic across evaluations. <!-- sdd-owner: implementation -->
- [x] GREEN — implement `tenantScopeKey(scope)` using a length-delimited canonical encoding of company/RUC/period and `sameTenantScope(a, b)` comparing the three normalized components; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — add component-difference cases (differing company, differing RUC) asserting distinctness; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — keep helpers small and documented; run `bun run test`. <!-- sdd-owner: implementation -->

### 1A-3 Cross-tenant read isolation (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — in `tenant/__tests__/scope.test.ts`, write failing tests using an in-memory scoped map: a read bound to scope S for an artifact present only in scope T returns the same non-disclosing `NOT_FOUND_OR_OUT_OF_SCOPE` result (identical public detail) as a read for an artifact absent everywhere; no existence signal leaks. <!-- sdd-owner: implementation -->
- [x] GREEN — implement the non-disclosing read result in `tenant/types.ts` and `assertTenantReadScope` plus a `readArtifact(scope, artifactId)`-shaped helper in `tenant/scope.ts` that selects by `tenantScopeKey` and artifact ID, returning the identical failure result for missing and foreign artifacts without probing other scopes; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — assert deterministic retry (same valid scope, same result, no side effect) and that foreign-scope reads never return the artifact; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — run `bun run test`. <!-- sdd-owner: implementation -->

### 1A-4 Exports and wiring

- [x] Add `tenant/index.ts` exporting only the public surface (`validateTenantScope`, `tenantScopeKey`, `sameTenantScope`, `assertTenantReadScope`, types); add `export * from "./tenant/index.js";` to root `index.ts`; add `"./tenant": "./dist/tenant/index.js"` to `package.json` `exports`; add `"tenant"` to `tsconfig.json` `include`; run `bun run test`, `bun run typecheck`, `bun run build`. <!-- sdd-owner: implementation -->
- [x] Add `tenant/__tests__/import-boundaries.test.ts`: a static scan of relative imports in the new-module directories asserting `tenant/` imports no project module and no `agents/`, `cmd/`, or `ingest/` path; run `bun run test`. This scanner is extended by later slices. <!-- sdd-owner: implementation -->
- [x] Run the full suite `bun run test` (existing 463 tests plus the new tenant suite), then `bun run typecheck` and `bun run build`; all green. <!-- sdd-owner: implementation -->

### 1A rescope — tenant-core / tenant-isolation staging split (user-approved)

The unreviewed Slice 1A surface (~592 lines) exceeds the 400-line review max as one candidate. Per explicit user authorization, it is repartitioned by staging into two physically separate units: `tenant-core` (staged core candidate, < 300 lines) and `tenant-isolation` (unstaged until core review passes). Behavior is preserved; no unrelated files touched.

- [x] Repartition `tenant/` into `tenant-core/` (validation, branded `TenantScope`, deterministic `tenantScopeKey`/`sameTenantScope`, exports/wiring, and only their focused tests) and `tenant-isolation/` (non-disclosing cross-tenant read isolation behavior + static import-boundary scanner), preserving behavior; run focused tests RED → GREEN. <!-- sdd-owner: implementation -->
- [x] Keep the core candidate under 300 authored lines (295 actual); keep the isolation unit unstaged and not exported from the core candidate. <!-- sdd-owner: implementation -->
- [x] Update wiring: root `index.ts` re-exports `tenant-core`, `package.json` `./tenant` export points at `dist/tenant-core`, `tsconfig.json` and `tsconfig.build.json` includes updated; remove the stale `tenant/` directory. <!-- sdd-owner: implementation -->
- [x] Full regression: 488 tests passed (463 baseline + 25 rescoped tenant tests), `bun run typecheck` clean, `bun run build` clean with `dist/tenant-core/` emitted. <!-- sdd-owner: implementation -->

## Slice 1B — Evidence authority

Branch `fiscal-authority/evidence`. Depends on 1A. Files: `evidence/types.ts`, `evidence/accept.ts`, `evidence/index.ts`, `evidence/__tests__/accept.test.ts`, wiring (root `index.ts`, `package.json`, `tsconfig.json`, extend `import-boundaries.test.ts`).

### 1B-1 Provenance requirement (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — in `evidence/__tests__/accept.test.ts`, write failing tests: acceptance of a submission with missing provenance is rejected, malformed provenance is rejected, and rejection produces no artifact and no downstream-capable partial object. <!-- sdd-owner: implementation -->
- [x] GREEN — implement the accepted-evidence surface: `evidence/accept.ts` (`AcceptedEvidence` preserving existing `id`/`evidenceHash` + canonical `identity`) delegating narrowing + provenance validation to the existing `registerEvidence` authority; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — add provenance field-boundary cases (empty source id, structurally invalid timestamp, unknown source kind) asserting fail-closed rejection; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — run `bun run test`. <!-- sdd-owner: implementation -->

### 1B-2 Memory is never evidence (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — write failing tests: advisory/memory-shaped input (memory reference, advisory claim, conversation-shaped object) is rejected during unknown-input narrowing and cannot satisfy an evidence requirement. <!-- sdd-owner: implementation -->
- [x] GREEN — memory exclusion flows through the `evidence/accept.ts` delegation to the existing authority narrowing before any other check; memory kinds stay absent from the accepted const-object types; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — add a compile-time/runtime shape test proving no accepted type carries a memory marker; run `bun run test`. <!-- sdd-owner: implementation -->

### 1B-3 Canonical evidence identity (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — write failing tests: `AcceptedEvidence.identity` equals `computeEvidenceHash([item])` from `receipts/` for the same `EvidenceItem`; two items with identical content and provenance have equal identities. <!-- sdd-owner: implementation -->
- [x] GREEN — compute identity in `evidence/accept.ts` via `computeEvidenceHash([...items])` from `receipts/verify.ts` as the single source of canonical identity; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — change the `EvidenceItem` content and assert the re-accepted identity differs (H2 ≠ H1); assert the original accepted artifact is unchanged (deep immutability, no in-place mutation); run `bun run test`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — run `bun run test`; run the frozen receipt conformance suite (`contracts/__tests__/receipt-conformance.test.ts`) unchanged and green. <!-- sdd-owner: implementation -->

### 1B-4 Tenant binding and composition

- [x] RED — write failing tests: acceptance requires an explicit validated tenant scope; evidence bound to a different scope is rejected by the binding check; accepted evidence can bind a journal-style consumer using only existing receipt primitives. <!-- sdd-owner: implementation -->
- [x] GREEN — require and retain the `ValidatedTenantScope` on every `AcceptedEvidence`; expose the immutable accepted surface from `evidence/index.ts`; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — prove the receipt contract and its conformance vectors are unchanged after binding (no receipt field additions); run `bun run test`. <!-- sdd-owner: implementation -->

### 1B-5 Exports and wiring

- [x] Add `evidence/index.ts` public exports; add root `index.ts` re-export, `package.json` `"./evidence"` export, `tsconfig.json` `"evidence"` include; extend `tenant/__tests__/import-boundaries.test.ts` asserting `evidence/` imports only `tenant/` and `receipts/`; run `bun run test`, `bun run typecheck`, `bun run build`. <!-- sdd-owner: implementation -->

## Slice 1C — Accounting journal

Branch `fiscal-authority/journal`. Depends on 1A–1B. Files: `journal/types.ts`, `journal/validate.ts`, `journal/journal.ts`, `journal/index.ts`, `journal/__tests__/journal.test.ts`, wiring. Two apply batches on the same branch.

### 1C-1 Amount, balance, and binding (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — in `journal/__tests__/journal.test.ts`, write failing tests: a line with fractional-cent amount `0.01` (number) is rejected while `100n` BigInt cents is accepted; an entry with debits `500n` / credits `400n` is rejected with no entry state; a balanced `500n`/`500n` entry is recorded. <!-- sdd-owner: implementation -->
- [x] GREEN — implement `journal/types.ts` (`JOURNAL_SIDE`, `JOURNAL_STATUS` const objects + extracted types, `JournalLine`, `JournalEntry` with `scope`, `lines`, `evidence`, `status`, `supersedesEntryId?`) and `journal/validate.ts` (BigInt-cent guard rejecting `number`/decimal strings/negatives, balance check, empty-lines check); implement `record` in `journal/journal.ts` returning a frozen `RECORDED` entry; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — add amount boundary cases (negative, `0n`, decimal string) and multi-line balance sums; assert rejected input creates no entry; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — run `bun run test`. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: a balanced BigInt-cents entry with no bound evidence is rejected; evidence bound to a different tenant scope is rejected; an invalid scope is rejected. <!-- sdd-owner: implementation -->
- [x] GREEN — enforce entry binding in `journal/validate.ts` (≥1 accepted evidence artifact, evidence scope equals entry scope); run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->

### 1C-2 Receipts, corrections, status axes, ledger boundary (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — write failing tests: `post` issues a signed receipt (deterministic fake `JournalReceiptIssuer`) and returns a `POSTED` snapshot; when receipt issuance fails, the transition fails and journal state is unchanged (atomic at the function boundary). <!-- sdd-owner: implementation -->
- [x] GREEN — implement `JournalReceiptIssuer` port in `journal/types.ts` and `post` in `journal/journal.ts` issuing the signed receipt before returning the `POSTED` snapshot; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — assert no material journal change occurs without a receipt (receipt-failure path leaves the prior snapshot untouched); run `bun run test`. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests: `supersede` creates a new balanced entry E2 linked to E1, leaves E1 unchanged, and produces a signed receipt; direct in-place mutation of a recorded entry is impossible (no update operation on `JournalEntry`); `revoke` creates an explicit reversal entry with a signed receipt and never edits historical lines. <!-- sdd-owner: implementation -->
- [x] GREEN — implement `supersede` (new entry + unchanged old snapshot in a separate transition result + receipt) and `revoke` (explicit reversal entry + receipt) in `journal/journal.ts`; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — assert append-only semantics: supersede/revoke never mutate prior lines or status of historical entries; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for status independence in both directions: journal status transitions while a held fiscal-workflow snapshot stays constant; the held fiscal-workflow snapshot changes while journal status stays constant; the journal functions accept and return no fiscal-state transition. <!-- sdd-owner: implementation -->
- [x] GREEN — keep `JournalEntry` carrying only `JournalStatus`; no journal function accepts or returns a fiscal status; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->
- [x] RED — write failing tests for the audit-only boundary: a journal action produces a `SignedReceipt`; the audit ledger (`ledger/`) accepts only receipt-shaped records and rejects an entry-shaped payload (a `JournalEntry`-shaped object is not a valid `LedgerEntry` and fails ledger structural validation). <!-- sdd-owner: implementation -->
- [x] GREEN — expose journal actions returning `SignedReceipt` without exporting any ledger-write API from `journal/index.ts`; prove the ledger-boundary rejection using the existing `ledger/` types and validation; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — run `bun run test`; run the frozen receipt and ledger conformance suites unchanged and green. <!-- sdd-owner: implementation -->
- [x] REFACTOR — run `bun run test`. <!-- sdd-owner: implementation -->

### 1C-3 Exports and wiring

- [x] Add `journal/index.ts` exposing only the journal API (no ledger export); add root `index.ts` re-export, `package.json` `"./journal"` export, `tsconfig.json` `"journal"` include; extend `tenant/__tests__/import-boundaries.test.ts` asserting `journal/` imports only `tenant/`, `evidence/`, and `receipts/`; run `bun run test`, `bun run typecheck`, `bun run build`. <!-- sdd-owner: implementation -->

## Slice 1D — Candidate ordering adapter

Branch `fiscal-authority/candidate-ordering`. Depends on 1A–1C. Files: `fiscal/types.ts`, `fiscal/candidate-ordering.ts`, `fiscal/index.ts`, `fiscal/__tests__/candidate-ordering.test.ts`, wiring.

### 1D-1 Validation before subject construction (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — in `fiscal/__tests__/candidate-ordering.test.ts`, write failing tests with spies: unvalidated fiscal input cannot form a subject (no construction, flow fails closed); validated input constructs the subject with exactly that input; `CoreValidator` throwing stops the flow before any candidate call. <!-- sdd-owner: implementation -->
- [x] GREEN — implement `fiscal/types.ts` (`CoreValidator`, `Reconciler`, `FiscalSubjectBuilder` ports, fiscal-flow input/output interfaces) and `fiscal/candidate-ordering.ts` `FiscalCandidateOrderingAdapter` running deterministic core validation first; run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->

### 1D-2 Reconciliation before freeze (RED → GREEN → TRIANGULATE → REFACTOR)

- [x] RED — write failing tests: the freeze point is unreachable without bound reconciliation evidence; with reconciliation evidence bound to the same scope, inspection proceeds only after the evidence is bound; at least one accepted reconciliation artifact bound to the same scope is required. <!-- sdd-owner: implementation -->
- [x] GREEN — implement reconciliation step in the adapter (require ≥1 accepted evidence artifact bound to the same validated scope before subject construction); run `bun run test`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — assert reconciliation evidence from another scope fails closed; run `bun run test`. <!-- sdd-owner: implementation -->

### 1D-3 Exact subject and unreachable premature inspection (RED → GREEN → TRIANGULATE → REFACTOR)

- [ ] RED — write failing tests: the candidate inspection/freeze receives the exact reconciled subject bytes (spies capture byte identity; a stale/different byte array is never passed); no public adapter method exposes construction/propose/inspect independently; an ordering test proves premature inspection is unreachable. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement the ordered flow: validate scope → core validate → reconcile → build exact subject bytes → existing `CandidateLifecycle.propose` with those bytes and the frozen `{ ruc, period }` candidate scope projection and materiality input → existing `CandidateLifecycle.inspect` with the same byte reference; return the inspected candidate, exact bytes, and bound evidence; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — assert `inspect` mismatch (SUBJECT_MUTATED) leaves only a local snapshot that is not returned as a successful fiscal result; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] REFACTOR — run `bun run test`. <!-- sdd-owner: implementation -->

### 1D-4 Frozen lifecycle preserved

- [ ] Add a test proving a candidate created through the fiscal flow follows the existing correction path with the at-most-one-correction rule unchanged; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] Run the frozen candidate conformance suite (`contracts/__tests__/candidate-conformance.test.ts`) unchanged and green; assert no candidate contract addendum or version bump exists. <!-- sdd-owner: implementation -->
- [ ] Add a test proving the flow completes within the library layer with no ingest module or SUNAT transport dependency. <!-- sdd-owner: implementation -->

### 1D-5 Exports and wiring

- [ ] Add `fiscal/index.ts` public exports; add root `index.ts` re-export, `package.json` `"./fiscal"` export, `tsconfig.json` `"fiscal"` include; extend `tenant/__tests__/import-boundaries.test.ts` asserting `fiscal/` imports only `tenant/`, `evidence/`, `journal/`, and `candidates/`; run `bun run test`, `bun run typecheck`, `bun run build`. <!-- sdd-owner: implementation -->

## Slice 1E — PE policy and CDR successor composition

Branch `fiscal-authority/policy-cdr`. Depends on 1A–1D. Two apply batches: 1E-1 `policy/**` (≤220), 1E-2 `cdr/**` (≤300). Split boundary is the `policy/` vs `cdr/` file boundary; promote 1E-2 to its own chained PR if the combined count exceeds 400.

### 1E-1 Policy — PE restriction surface

Files: `policy/types.ts`, `policy/pe-policy.ts`, `policy/index.ts`, `policy/__tests__/pe-policy.test.ts`, wiring.

- [ ] RED — in `policy/__tests__/pe-policy.test.ts`, write failing tests: `FiscalJurisdiction` PE is evaluated; a non-PE jurisdiction is not auto-accepted and fails closed; an unknown/unsupported jurisdiction fails closed and is never treated as PE by default. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement `policy/types.ts` (PE jurisdiction const object, policy subject, restricted outcome, `ALLOW`/`BLOCK`/`ESCALATE` const-backed decision type) and `policy/pe-policy.ts` restriction-only evaluation (no ALLOW grants authority); run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — add unknown-jurisdiction and non-PE boundary cases; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] RED — write failing tests: a journal transition whose materiality exceeds the PE threshold is blocked or escalated, never silently permitted (reuse existing BigInt-cent thresholds, e.g. `HIGH_VALUE_CENTS` from `candidates/materiality.ts`); a CDR outcome policy restricts is blocked before any approval or receipt is produced; insufficient bound evidence blocks or escalates with no auto-accept. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement policy evaluation over journal and CDR outcomes with fail-closed defaults; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] RED — write failing tests proving policy is a precondition: on `BLOCK` or `ESCALATE`, journal transition ports, mission command ports, candidate lifecycle ports, and outcome-producing receipt issuer ports are never invoked (spy assertions). <!-- sdd-owner: implementation -->
- [ ] GREEN — enforce the mandatory composition order in `policy/pe-policy.ts`: derive the proposed outcome as immutable input, evaluate policy, stop before any snapshot/transition/candidate/receipt on block or escalation, and only on `ALLOW` delegate to the owning authority primitive which still performs its own validation; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] Add `policy/index.ts` public exports; add root `index.ts` re-export, `package.json` `"./policy"` export, `tsconfig.json` `"policy"` include; extend `tenant/__tests__/import-boundaries.test.ts` asserting `policy/` imports only candidate materiality types, accepted evidence types, and journal outcome types; run `bun run test`, `bun run typecheck`, `bun run build`. <!-- sdd-owner: implementation -->

### 1E-2 CDR — successor mission composition

Files: `cdr/types.ts`, `cdr/successor.ts`, `cdr/index.ts`, `cdr/__tests__/successor.test.ts`, wiring.

- [ ] RED — in `cdr/__tests__/successor.test.ts`, write failing tests: candidate A (accepted, with approval record and signed receipt) drives a successor mission created with existing `MissionRuntime` (InMemory stores) using intent `compliance-check`; candidate A's identity/status, approval, receipt, version, and subject hash are copied before execution and compared unchanged after completion. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement `cdr/types.ts` (candidate-A authority input, successor link, mission/candidate/receipt ports, candidate-B result) and `cdr/successor.ts` `CdrSuccessorComposer` steps 1–5: verify scope/A identity/A receipt/evidence scope, derive and evaluate PE policy, build application-level successor-link data (A id, subject hash, approval receipt hash, operation id, evidence identities), start the `compliance-check` mission with the link encoded in the existing mission input instruction (no mission field added), execute existing mission commands with the supplied idempotency key and expected versions; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] RED — write failing tests: a gate that blocks the outcome stops the composition with no candidate B; gates run in order over the reconciled successor result and any non-allowed verdict stops the flow; reconciliation mismatch or idempotency conflict stops the flow. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement steps 6–7: reconcile the successor mission through existing reconciliation primitives, verify the expected terminal snapshot/operation binding/idempotent result, then run existing gates (`GateRunner`) in order; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — assert idempotent replay returns the same result and a different payload with the same key fails closed; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] RED — write failing tests: successful validation produces candidate B with its own identity derived from the reconciled successor result; candidate B exists only with its own approval decision and signed receipt; candidate A's approval and receipt are unchanged and differ from B's (receipt hash, mission id, payload hash, and signature boundary differ); the explicit A→B link is expressible through application input and evidence without any normative protocol extension. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement steps 8–13: bind `computeEvidenceHash` during mission approval and verify the mission receipt; build canonical candidate-B subject bytes and derive the intended fresh subject identity (authorization material only, no candidate lifecycle call yet); re-run PE policy over the proposed candidate-B outcome; create a distinct candidate-B approval decision and build/sign/verify a separate approval receipt (mission id + intended subject hash as payload hash + successor evidence hash); only then propose, inspect, and submit candidate B from the exact authorized bytes; verify the resulting identity and subject hash equal the bound values; apply the distinct approval decision and return B, its approval, verified receipt, successor mission snapshot, and the explicit A-to-B link; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — assert candidate-B materialization never occurs before evidence binding, reconciliation, gates, mission receipt checks, the second approval decision, and candidate-B receipt issuance and verification have all succeeded; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] RED — write failing tests for fail-closed paths: blocked gate, insufficient evidence, mission receipt verification failure, candidate-B receipt issuance/verification failure, and candidate materialization/identity mismatch each return no candidate B; failure before mission creation leaves no successor mission; failure after mission creation leaves the mission and its append-only events as valid existing-protocol audit facts (not deleted or rewritten); retry resumes from the immutable reconciled successor result without altering candidate A. <!-- sdd-owner: implementation -->
- [ ] GREEN — implement fail-closed recovery paths in `cdr/successor.ts` using only existing mission reconciliation and recovery primitives; no candidate B is returned or approved on any failure, and an immutable receipt from a failed materialization attempt cannot authorize a different subject; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] Add `cdr/index.ts` public exports; add root `index.ts` re-export, `package.json` `"./cdr"` export, `tsconfig.json` `"cdr"` include; extend `tenant/__tests__/import-boundaries.test.ts` asserting `cdr/` imports only `tenant/`, `evidence/`, `policy/`, `fiscal/`, `missions/`, `candidates/`, `gates/`, and `receipts/`; run `bun run test`. <!-- sdd-owner: implementation -->
- [ ] Run the full regression: `bun run test` (all new suites plus frozen mission-protocol, candidate, gate, receipt, ledger, and recovery conformance suites unchanged), then `bun run typecheck` and `bun run build`. <!-- sdd-owner: implementation -->

## Chain lifecycle gates (parent-owned)

Run after each slice's implementation work and per-batch verification; parent executes these after the apply batch is frozen.

- [ ] Start or reuse bounded review for the slice 1A candidate on branch `fiscal-authority/tenant`; apply findings within the single correction budget, then validate the terminal receipt. <!-- sdd-owner: parent -->
- [ ] Create the chained PR for slice 1A targeting the tracker base and open the 1B branch off 1A. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for the slice 1B candidate on branch `fiscal-authority/evidence`; then create its chained PR targeting 1A and open the 1C branch. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for the slice 1C candidate on branch `fiscal-authority/journal` (both batches); then create its chained PR targeting 1B and open the 1D branch. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for the slice 1D candidate on branch `fiscal-authority/candidate-ordering`; then create its chained PR targeting 1C and open the 1E branch. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for the slice 1E candidate on branch `fiscal-authority/policy-cdr` (both batches; or separate 1E-2 PR if split was promoted); then create its chained PR targeting 1D. <!-- sdd-owner: parent -->
- [ ] Validate the tracker integration: full chain merged into `fiscal-authority/kernel`, integrated test/typecheck/build green, no frozen contract or conformance delta, then merge the tracker to main per the feature-branch-chain strategy. <!-- sdd-owner: parent -->
