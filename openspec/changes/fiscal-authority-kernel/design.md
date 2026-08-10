# Technical Design — Fiscal Authority Kernel

## Decision summary

Program 1 is implemented as five additive, library-level slices. Each slice introduces one authority boundary and its tests without changing frozen mission, candidate, receipt, gate, ledger, or recovery contracts. `TenantScope` is an explicit authority input to every fiscal operation. Evidence is canonical and provenance-bearing; memory is excluded. The journal alone owns accounting entries. Candidate inspection receives the exact subject built after validation and reconciliation. CDR validation composes existing primitives into a successor operation that authorizes the intended candidate-B subject, issues and verifies its separate signed receipt, and only then materializes candidate B and applies its distinct approval decision.

The implementation adds no persistent backend, ingest surface, agent dependency, CLI workflow, or external SUNAT transport.

## Architectural boundaries

```text
receipts/   missions/   candidates/   gates/   ledger/   recovery/
    ^           ^            ^           ^
    |           |            |           |
evidence/    cdr/ <------- fiscal/ ---- policy/
    ^                        ^
    |                        |
tenant/ <---------------- journal/
```

Allowed imports are left-to-right or upward toward existing primitives. Existing modules never import the new modules. `agents/`, `cmd/`, `ingest/`, and transport code are outside this graph.

### No-reverse-import rules

1. `tenant/` imports no project module.
2. `evidence/` imports only `tenant/` and `receipts/`.
3. `journal/` imports only `tenant/`, `evidence/`, and `receipts/`.
4. `policy/` may import candidate materiality types, accepted evidence types, and journal outcome types; none of those modules may import `policy/`.
5. `fiscal/` is an additive application-composition library and may import `tenant/`, `evidence/`, `journal/`, and `candidates/`.
6. `cdr/` is the outermost library composition and may import `tenant/`, `evidence/`, `policy/`, `fiscal/`, `missions/`, `candidates/`, `gates/`, and `receipts/`.
7. No new module imports `agents/`, `cmd/`, `ingest/`, or external transport code.
8. `ledger/` remains unchanged and imports no fiscal module. Journal actions expose `SignedReceipt`; existing ledger callers may record only the receipt hash and receipt metadata under the frozen ledger contract.
9. `contracts/` and frozen conformance fixtures remain untouched.

A static import-boundary test scans relative imports in the new directories and fails on any forbidden edge.

## Shared type conventions

New runtime categories use const objects followed by extracted types. Interfaces remain flat; nested structures receive named interfaces. Unknown external input is narrowed through guards, and `any` is prohibited.

```ts
export const FISCAL_JURISDICTION = { PE: "PE" } as const;
export type FiscalJurisdiction =
  (typeof FISCAL_JURISDICTION)[keyof typeof FISCAL_JURISDICTION];

export interface TenantScope {
  companyId: string;
  ruc: string;
  period: string;
}
```

`TenantScope` is not ambient context and is never reconstructed from memory, candidate metadata, or a journal record. Callers pass it explicitly. Every artifact also carries the validated scope to which it was bound.

## Slice 1A — Tenant authority

### Exact module boundary

| Path | Responsibility |
| --- | --- |
| `tenant/types.ts` | `TenantScope`, branded `ValidatedTenantScope`, `TenantScopeError`, and the non-disclosing read result. |
| `tenant/scope.ts` | `validateTenantScope`, `tenantScopeKey`, `sameTenantScope`, and `assertTenantReadScope`. |
| `tenant/index.ts` | Public exports only. |
| `tenant/__tests__/scope.test.ts` | Boundary, deterministic identity, and cross-scope non-disclosure tests. |
| `index.ts`, `package.json` | Additive root and `./tenant` exports. |

### Contract and flow

`validateTenantScope(input: unknown): ValidatedTenantScope` validates all three fields atomically:

- `companyId.trim()` is non-empty; the original normalized identifier is retained.
- `ruc` matches exactly eleven ASCII digits.
- `period` matches six digits and month `01` through `12`.

`tenantScopeKey(scope)` uses a length-delimited canonical encoding of company, RUC, and period. Equality compares the three normalized components rather than object identity.

Every fiscal read has this shape:

```ts
readArtifact(scope: ValidatedTenantScope, artifactId: string): ScopedReadResult<T>
```

The lookup first selects by `tenantScopeKey(scope)` and artifact ID. A missing artifact and an artifact owned by another scope both return the same `NOT_FOUND_OR_OUT_OF_SCOPE` result with identical public detail. No cross-scope probe occurs after the scoped lookup fails.

### Failure and recovery

Invalid input produces no validated scope. Read mismatch produces no artifact and no existence signal. Retrying with the same valid scope is deterministic and has no side effect.

## Slice 1B — Evidence authority

### Exact module boundary

| Path | Responsibility |
| --- | --- |
| `evidence/types.ts` | `EvidenceProvenance`, `EvidenceSubmission`, immutable `AcceptedEvidence`, origin constants, and rejection codes. |
| `evidence/accept.ts` | Unknown-input narrowing, provenance checks, memory exclusion, scope binding, and canonical acceptance. |
| `evidence/index.ts` | Public exports only. |
| `evidence/__tests__/accept.test.ts` | Hash equality, provenance, memory rejection, immutability, and tenant binding tests. |
| `index.ts`, `package.json` | Additive root and `./evidence` exports. |

### Canonical and provenance boundary

`EvidenceSubmission` contains a `ValidatedTenantScope`, the existing `EvidenceItem`, and provenance with a stable source identifier, observed timestamp, source kind, and content reference. Accepted source kinds are defined by a const object; advisory and memory kinds are absent from the accepted type and explicitly rejected during unknown-input narrowing.

Acceptance order is fixed:

1. Narrow unknown input and reject advisory or memory-shaped markers.
2. Validate the explicit `TenantScope` authority input.
3. Validate every `EvidenceItem` field and provenance field as non-empty and structurally valid.
4. Compute `identity = computeEvidenceHash([item])` through `receipts/`.
5. Return a deeply immutable `AcceptedEvidence` containing the canonical identity, copied item, copied provenance, and scope.

The receipt primitive remains the single source of canonical evidence identity. Provenance is mandatory authority metadata but does not alter the frozen receipt hash algorithm. A changed `EvidenceItem` is a new acceptance and therefore a new identity. Provenance cannot be modified on an accepted artifact; changed provenance requires a new acceptance record even when the receipt identity remains the same.

Memory can supply suggestions to a caller before this boundary, but no memory object, memory reference, advisory claim, or conversation output can satisfy `AcceptedEvidence` at compile time or runtime.

### Failure and recovery

Any failed check returns no accepted artifact and no downstream-capable partial object. Acceptance is pure, so the same canonical input can be retried. No evidence repository or durable store is introduced.

## Slice 1C — Journal authority

### Exact module boundary

| Path | Responsibility |
| --- | --- |
| `journal/types.ts` | Entry, line, debit/credit side, journal status, correction link, transition request/result, and receipt issuer port. |
| `journal/validate.ts` | BigInt-cent, balance, scope, evidence, and transition validation. |
| `journal/journal.ts` | Pure immutable `record`, `post`, `supersede`, and `revoke` operations. |
| `journal/index.ts` | Public journal API; no ledger export. |
| `journal/__tests__/journal.test.ts` | Amount, balance, receipt atomicity, correction, ownership, and status-axis tests. |
| `index.ts`, `package.json` | Additive root and `./journal` exports. |

### Entry and money model

```ts
export const JOURNAL_SIDE = { DEBIT: "debit", CREDIT: "credit" } as const;
export const JOURNAL_STATUS = {
  RECORDED: "recorded",
  POSTED: "posted",
  SUPERSEDED: "superseded",
  REVOKED: "revoked",
} as const;

export interface JournalLine {
  accountCode: string;
  side: JournalSide;
  amountCents: bigint;
}

export interface JournalEntry {
  id: string;
  scope: ValidatedTenantScope;
  lines: readonly JournalLine[];
  evidence: readonly AcceptedEvidence[];
  status: JournalStatus;
  supersedesEntryId?: string;
}
```

Runtime validation rejects `number`, decimal strings, negative amounts, empty lines, unbalanced debit and credit totals, absent evidence, and evidence from another scope. Sums use BigInt exclusively. Hash material encodes cents as canonical base-10 strings only at the receipt payload boundary; the domain amount remains `bigint`.

### Ownership and transitions

Only functions exported by `journal/` create or transition `JournalEntry`. Recorded entries are copied and frozen. There is no update operation.

- `record` validates and returns a `RECORDED` entry without a material receipt.
- `post` issues a signed receipt first and returns the `POSTED` snapshot only after receipt issuance succeeds.
- `supersede` validates a new balanced entry linked to the old entry, issues a signed receipt, returns an unchanged old snapshot marked by a separate transition result, and returns the new entry.
- `revoke` creates an explicit reversal entry, issues a signed receipt, and never edits historical lines.

`JournalReceiptIssuer` is an injected adapter over existing receipt signing primitives. Tests use a deterministic fake. Production composition may wrap `buildSignedReceipt`; no signing algorithm or receipt contract changes.

Material operations are atomic at the function boundary: receipt failure throws before a new journal snapshot is returned. The caller persists neither result because this program defines no persistence transaction.

### Independent status axes

`JournalEntry` contains only `JournalStatus`. Mission, submission, CDR, and other fiscal states stay in their owning modules. Journal functions neither accept nor return a fiscal-state transition. Integration tests hold a separate fiscal snapshot constant while journal status changes, then hold the journal snapshot constant while fiscal status changes. This prevents implicit coupling in either direction.

The ledger receives only the resulting `SignedReceipt` through existing audit integration. It never receives lines, balances, correction commands, or journal snapshots. No journal store, ledger writer, or ledger contract change is added.

### Failure and recovery

Validation failure produces no entry. Receipt failure produces no material transition result. A retry uses the unchanged prior snapshot and caller-supplied operation key or receipt context. Supersede and revoke are append-only domain actions; rollback is another explicit action, never mutation or ledger deletion.

## Slice 1D — Candidate ordering adapter

### Exact module boundary

| Path | Responsibility |
| --- | --- |
| `fiscal/types.ts` | Core validator, reconciler, subject builder, inspection port, and fiscal-flow input/output interfaces. |
| `fiscal/candidate-ordering.ts` | `FiscalCandidateOrderingAdapter` orchestration only. |
| `fiscal/index.ts` | Public exports only. |
| `fiscal/__tests__/candidate-ordering.test.ts` | Call-order, unreachable freeze, exact-byte identity, scope, and frozen-regression tests. |
| `index.ts`, `package.json` | Additive root and `./fiscal` exports. |

### Additive adapter contract

The adapter receives explicit ports so ordering is testable without editing `candidates/`:

```ts
export interface CoreValidator<TInput, TValidated> {
  validate(scope: ValidatedTenantScope, input: TInput): TValidated;
}

export interface Reconciler<TValidated> {
  reconcile(
    scope: ValidatedTenantScope,
    input: TValidated,
  ): readonly AcceptedEvidence[];
}

export interface FiscalSubjectBuilder<TValidated> {
  build(
    scope: ValidatedTenantScope,
    input: TValidated,
    evidence: readonly AcceptedEvidence[],
  ): Uint8Array;
}
```

The concrete candidate port is a thin wrapper around the existing `CandidateLifecycle.propose` and `CandidateLifecycle.inspect` methods. The adapter never subclasses or modifies that lifecycle.

### Transition flow

1. Validate the explicit tenant scope.
2. Run deterministic core validation. A thrown or rejected result stops the flow.
3. Reconcile and require at least one accepted reconciliation artifact bound to the same scope.
4. Build the exact canonical subject bytes from validated input, scope, and accepted reconciliation evidence.
5. Call existing `propose` with those bytes, the frozen `{ ruc, period }` candidate scope projection, and the existing materiality input.
6. Call existing `inspect` with the same byte array reference produced in step 4.
7. Return the inspected candidate, exact subject bytes, and bound evidence.

No public method exposes steps 4–6 independently through the fiscal adapter. Tests use spies that fail if construction, proposal, or inspection occurs early. Company identity remains authoritative because it is embedded in the exact subject and supplied to every preceding port; only the frozen candidate scope projection omits it. Existing candidate identity, freeze point, immutable transitions, and one-correction limit remain unchanged.

### Failure and recovery

Validation or reconciliation failure creates no candidate. Subject construction failure creates no candidate. Inspection mismatch leaves only the local proposed snapshot, which is not returned as a successful fiscal result. The operation is pure apart from injected ports, so retry starts from the original input. No candidate persistence is added.

## Slice 1E — PE policy and CDR successor composition

### Exact module boundary

| Path | Responsibility |
| --- | --- |
| `policy/types.ts` | PE jurisdiction, policy subject, restricted outcome, and decision constants. |
| `policy/pe-policy.ts` | Restriction-only journal and CDR policy evaluation. |
| `policy/index.ts` | Public exports only. |
| `cdr/types.ts` | Candidate-A authority input, successor link, mission/candidate/receipt ports, and candidate-B result. |
| `cdr/successor.ts` | Ordered successor composition using existing primitives. |
| `cdr/index.ts` | Public exports only. |
| `policy/__tests__/pe-policy.test.ts` | PE, unsupported jurisdiction, materiality, and insufficient-evidence tests. |
| `cdr/__tests__/successor.test.ts` | A-to-B composition, idempotency, gates, second approval, receipt separation, and failure tests. |
| `index.ts`, `package.json` | Additive root plus `./policy` and `./cdr` exports. |

### Restriction-only PE policy

Policy returns `ALLOW`, `BLOCK`, or `ESCALATE` from a const-backed decision type. `ALLOW` means policy found no restriction; it does not grant fiscal authority. Unsupported jurisdiction, missing accepted evidence, scope mismatch, or unknown input returns `BLOCK` or `ESCALATE`, never automatic acceptance. Journal materiality uses existing BigInt-cent thresholds where applicable.

Policy-governed composition has one mandatory order for both journal and CDR paths:

1. Validate the explicit scope, accepted evidence, authority input, and proposed action.
2. Derive a proposed journal outcome or fiscal transition as immutable policy input without applying, returning, or persisting it.
3. Evaluate PE policy over that proposed outcome or transition.
4. On `BLOCK` or `ESCALATE`, stop before any journal snapshot, fiscal transition, candidate, approval decision, or receipt is produced.
5. Only on `ALLOW`, invoke the owning journal or fiscal authority primitive, which still performs its own validation, receipt checks, and transition rules.

The composition layer cannot call a journal transition method, mission transition command, candidate lifecycle method, or outcome-producing receipt issuer before step 3 succeeds. Tests assert these ports remain untouched on policy block or escalation. This makes policy a restriction precondition rather than post-outcome validation and does not let `ALLOW` grant authority.

### Successor composition

`CdrSuccessorComposer` receives adapters around the existing `MissionRuntime`, `GateRunner`, `CandidateLifecycle`, and receipt signing/verification primitives. Adapters are additive test seams, not replacement protocols.

Input includes:

- explicit `ValidatedTenantScope`;
- accepted candidate A;
- candidate A's approval record and signed receipt;
- accepted CDR evidence;
- deterministic successor operation ID and idempotency key;
- candidate-B reviewer identity and materiality input.

Ordered flow:

1. Verify tenant scope, candidate A identity/status, candidate A receipt, and evidence scope.
2. Derive the proposed CDR transition without executing it, then evaluate PE policy. Stop on block or escalation before mission creation or any fiscal transition.
3. Build application-level successor-link data containing candidate A ID, subject hash, approval receipt hash, operation ID, and evidence identities.
4. Create a new existing-protocol mission with intent `compliance-check`; encode the link deterministically in the existing mission input instruction. No mission field is added.
5. Execute existing mission commands with the supplied idempotency key and expected versions.
6. Reconcile the successor mission through existing reconciliation primitives and verify the expected terminal snapshot, operation binding, and idempotent result. Any mismatch or conflict stops the composition.
7. Run existing gates in order over the reconciled successor result. Any non-allowed verdict stops the composition.
8. Bind the existing `computeEvidenceHash` result during mission approval and verify the resulting mission receipt. Missing evidence, mission failure, or an invalid mission receipt stops the composition.
9. Build canonical candidate-B subject bytes and derive the intended fresh subject identity from the reconciled successor result and explicit A-to-operation link. This is authorization material only: no candidate lifecycle method has been called and candidate B does not yet exist.
10. Re-run PE policy over the proposed candidate-B outcome. Stop on block or escalation with no candidate B.
11. Create a distinct candidate-B approval decision for the intended subject identity, then build, sign, and verify its separate approval receipt. The receipt uses the successor mission ID, the intended candidate-B subject hash as payload hash, and the successor evidence hash. Receipt issuance or verification failure stops the composition with no candidate B.
12. Only after steps 6–11 succeed, call the existing candidate lifecycle to propose, inspect, and submit candidate B from the exact authorized subject bytes. Verify that the resulting identity and subject hash equal the values bound by the approval decision and receipt; any mismatch fails closed and is not returned as candidate B.
13. Apply the already distinct candidate-B approval decision through the existing candidate lifecycle and return candidate B, its approval, its verified signed receipt, the successor mission snapshot, and the explicit A-to-B link.

Candidate A is treated as immutable input. Its review records, receipt, status, version, and subject hash are copied before execution and compared after completion in tests. Candidate-B authorization and receipt issuance form a distinct pre-materialization boundary: neither record reuses candidate A authority, and candidate B is not created until evidence binding, reconciliation, gates, mission receipt checks, the second approval decision, and the separate candidate-B receipt have all succeeded. The candidate-B receipt hash, mission ID, payload hash, and signature boundary must differ from candidate A's receipt. Candidate A authority is never promoted, reused, or mutated.

### Failure and recovery

- Scope, evidence, policy, reconciliation, gate, idempotency, mission, receipt issuance, receipt verification, or candidate failure returns no candidate B.
- If failure occurs before mission creation, no successor mission exists.
- If failure occurs after mission creation, the mission and its append-only events remain valid existing-protocol audit facts; they are not deleted or rewritten.
- Retry uses the same operation ID and idempotency key. Existing mission idempotency determines replay or conflict. A different payload with the same key fails closed.
- Candidate B is not proposed, inspected, submitted, approved, returned, or otherwise materialized until successful mission completion, evidence binding, reconciliation, gate passage, mission receipt verification, candidate-B approval authorization, and candidate-B receipt issuance and verification have completed.
- If candidate-B receipt issuance or verification fails, no candidate lifecycle method is called and no candidate B exists; retry resumes from the immutable reconciled successor result and does not alter candidate A.
- If candidate materialization or identity verification fails after receipt success, no candidate B is returned or approved; the immutable receipt remains an audit fact for the failed materialization attempt and cannot authorize a different subject.
- Recovery uses only existing mission reconciliation and recovery primitives. This design adds no recovery state, persistence schema, reset behavior, or transport retry.

## Frozen-contract preservation

The following are reuse-only surfaces: `contracts/**`, `receipts/**`, `ledger/**`, `missions/**`, `candidates/**`, `gates/**`, and `recovery/**`, except additive package exports outside those directories. New adapters call their current public APIs. They do not add statuses, commands, gate names, receipt fields, ledger entry kinds, successor fields, candidate states, or correction capacity.

Frozen conformance suites run unchanged after slices 1D and 1E. Any required normative delta stops Program 1 and requires a separate major-version proposal.

## Strict-TDD plan

Every slice follows RED → GREEN → TRIANGULATE → REFACTOR with `bun run test` as the authoritative test command.

| Slice | First RED proof | Triangulation | Required regression proof |
| --- | --- | --- | --- |
| 1A | Invalid RUC/period and cross-scope read fail | 9–12 digit boundaries, month boundaries, absent vs foreign artifact | Full tenant suite, then all tests |
| 1B | Missing provenance and memory-shaped input fail | Canonical equality, content change, scope mismatch | Receipt conformance plus all tests |
| 1C | `number` amount, unbalanced entry, or missing receipt fails | Both status directions, supersede/revoke immutability | Receipt and ledger conformance plus all tests |
| 1D | Inspection spy proves early freeze unreachable | Same byte identity, stale-byte rejection, one-correction preservation | Candidate conformance plus all tests |
| 1E | Gate/policy failure produces no B | Idempotent replay, A unchanged, receipt distinction, unsupported jurisdiction | Mission, candidate, gate, receipt, ledger, recovery conformance plus all tests |

For each work unit:

1. Add one failing behavioral test and run `bun run test` to record RED.
2. Implement the minimum behavior and rerun `bun run test` for GREEN.
3. Add boundary and inverse-path cases, then rerun.
4. Refactor without changing behavior and rerun.
5. Run `bun run typecheck` and `bun run build` before freezing the slice candidate.

Deterministic seams inject clocks, ID factories, receipt issuers, mission ports, gate runners, and inspection spies. Production defaults may use current random UUID and time behavior only at existing primitive boundaries.

## Feature-branch chain and line budget

The tracker branch accumulates the chain. Each child branch targets its immediate predecessor and stays at or below 400 authored changed lines, including tests and export wiring.

| Order | Branch boundary | Included modules | Dependency | Rollback |
| --- | --- | --- | --- | --- |
| 1A | `fiscal-authority/tenant` | `tenant/**`, tenant exports | Tracker base | Remove tenant module and exports |
| 1B | `fiscal-authority/evidence` | `evidence/**`, evidence exports | 1A | Revert evidence only |
| 1C | `fiscal-authority/journal` | `journal/**`, journal exports | 1B | Revert journal only |
| 1D | `fiscal-authority/candidate-ordering` | `fiscal/**`, fiscal exports | 1C | Remove adapter; frozen candidate code is untouched |
| 1E | `fiscal-authority/policy-cdr` | `policy/**`, `cdr/**`, exports | 1D | Remove policy/CDR composition |

Before implementation of each branch, count the planned source, tests, documentation, and export edits. If forecast exceeds 400 authored changed lines, split within that slice at a vertical behavior boundary; do not request an exception. No later branch may bypass an earlier authority module through a direct reverse import.

## Traceability

| Specification | Design owner |
| --- | --- |
| Tenant scope | Slice 1A explicit authority input, validation, scoped-read non-disclosure |
| Evidence | Slice 1B canonical receipt hash, immutable provenance, memory exclusion |
| Journal | Slice 1C BigInt cents, balanced immutable entries, signed material transitions, independent axes, ledger audit-only boundary |
| Candidate ordering | Slice 1D additive adapter and exact validate → reconcile → build → propose → inspect order |
| Policy | Slice 1E PE restriction-only decision before journal/CDR outcome |
| CDR validation | Slice 1E existing-primitives successor mission, candidate B, second approval, separate receipt, explicit A-to-B application link |

## Out of scope

No persistent journal/evidence/tenant backend, schema migration, external SUNAT call, ingest module, UI, CLI command, agent change, memory authority, multi-country engine, ledger rewrite, frozen contract amendment, or candidate/mission protocol extension is part of this change.
