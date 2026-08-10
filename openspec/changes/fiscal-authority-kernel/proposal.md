# Proposal — Fiscal Authority Kernel

## Decision

Program 1 of the Peru v1 roadmap will establish a deterministic fiscal-authority kernel through five reviewable vertical slices: tenant scope, evidence, journal, candidate ordering, and PE policy/CDR composition. The implementation will preserve the frozen contracts shipped with release 0.2.0 and compose their existing primitives at the application layer rather than changing normative lifecycle semantics.

The authority boundary is explicit: the journal owns accounting entries, evidence proves fiscal facts, tenant scope isolates fiscal data, policy restricts permitted outcomes, and the audit ledger records receipts without becoming an accounting system. Memory remains advisory and cannot satisfy evidence requirements.

## Intent

Create the minimum deterministic foundation needed for later Peru fiscal workflows while preventing authority from leaking into the audit ledger, memory, staging agents, or future integration surfaces.

This change addresses the repository gaps documented in `explore.md`:

- there is no canonical tenant scope module;
- evidence exists only as receipt-level types and hashing primitives, not as a validated lifecycle;
- no module owns accounting entries;
- policy restrictions are not represented as a dedicated surface;
- candidate construction is not ordered after core validation and reconciliation;
- CDR validation is not composed as a successor mission over a candidate.

The change maps to the approved architecture as follows:

| Architecture boundary | Program 1 outcome |
| --- | --- |
| AI advisory vs. deterministic authority | New fiscal decisions remain in deterministic library modules; agents and memory gain no authority. |
| Audit ledger vs. accounting journal | `journal/` owns entries and transitions; `ledger/` remains append-only and audit-only. |
| Evidence vs. memory | `evidence/` accepts canonical provenance-bearing artifacts; memory output is never evidence. |
| Contracts → libraries → agents → CLI | New capabilities are library-level compositions with no reverse imports and no dependency on the dirty `agents/` slice. |
| Peru v1 roadmap | Program 1 supplies the authority kernel required before later ingestion, submission, and broader SUNAT-facing programs. |

## Proposed outcome

After Program 1:

1. Fiscal artifacts can be bound to a validated tenant scope consisting of company, RUC, and period.
2. Evidence can be validated, canonically hashed through the existing receipt primitive, and rejected fail-closed when provenance is missing or invalid.
3. Accounting entries have a dedicated journal lifecycle using BigInt cents, explicit transitions, evidence binding, and receipt production for material actions.
4. The exact subject that has passed core validation and reconciliation is constructed before the existing candidate inspection/freezing operation. Existing candidate lifecycle and correction semantics remain unchanged.
5. PE policy can restrict journal and CDR outcomes without introducing a multi-jurisdiction engine.
6. CDR fiscal validation is an application-level successor composition: candidate A is the validated input, a new successor mission uses existing mission primitives, and its result produces candidate B with a distinct approval and receipt boundary.

## Scope

### 1A — Tenant scope core

Introduce tenant scope identity and validation for:

- an 11-digit RUC;
- a `YYYYMM` fiscal period;
- a company identifier;
- structural, fail-closed scope checks for fiscal reads.

This is the first product slice and establishes the isolation boundary used by all later slices.

### 1B — Evidence authority

Introduce a provenance-bearing evidence lifecycle that:

- reuses `EvidenceItem` and `computeEvidenceHash` from `receipts/`;
- validates identity and provenance before acceptance;
- rejects missing, malformed, or memory-shaped evidence;
- exposes evidence suitable for journal and candidate composition without changing receipt contracts.

### 1C — Accounting journal

Introduce the module that exclusively owns accounting entries:

- monetary values use BigInt cents only;
- entries bind tenant scope and accepted evidence;
- material transitions require signed receipts;
- correction is represented by explicit superseding or revoking actions, never in-place mutation;
- journal status remains independent from mission, submission, or other fiscal statuses.

The ledger may chain receipts produced by these actions, but it does not own or mutate journal entries.

### 1D — Candidate ordering adapter

Introduce an application-level adapter that:

1. performs deterministic core validation;
2. obtains and binds reconciliation evidence;
3. constructs the exact validated and reconciled subject;
4. invokes the existing candidate inspection/freezing behavior on that subject.

This changes application ordering, not candidate lifecycle semantics. The existing subject identity, inspection freeze point, immutable lifecycle, and at-most-one-correction rule remain intact. No candidate contract addendum or major version bump is part of Program 1.

### 1E — PE policy and CDR successor composition

Introduce:

- a PE-only policy surface that restricts journal and CDR outcomes;
- fail-closed handling for unsupported jurisdictions or insufficient evidence;
- CDR validation as a successor mission composed from existing mission commands, gates, idempotency, and receipt primitives;
- an explicit link from candidate A to the successor operation and candidate B;
- a separate approval/receipt boundary for candidate B, so candidate A's authority is neither reused nor mutated.

No successor relation is added to the frozen mission protocol. Linking data is carried through application input and evidence supported by existing mission primitives.

## Business and domain rules

- The deterministic Core remains the fiscal authority; AI, agents, and memory are advisory only.
- The ledger is audit-only and MUST NOT become the journal.
- The journal is the sole owner of accounting entries.
- Evidence MUST have canonical identity and provenance; memory MUST NOT satisfy an evidence requirement.
- Fiscal reads MUST fail closed on tenant scope mismatch.
- Money MUST be represented as BigInt cents; floating-point money is prohibited.
- Journal status and fiscal workflow status MUST transition independently and explicitly.
- Candidate inspection/freezing MUST receive the exact subject produced after core validation and reconciliation.
- CDR validation MUST consume candidate A through a successor mission composition and MUST produce candidate B with a distinct approval and receipt boundary.
- Existing frozen contract surfaces and conformance vectors MUST remain unchanged in Program 1.

## Non-goals

- No normative amendment, addendum, conformance-vector change, or major version bump for mission, candidate, receipt, gate, ledger, or recovery contracts.
- No change to candidate lifecycle semantics or its correction budget.
- No mission-protocol successor primitive; successor behavior is application-level composition.
- No ledger mutation, journal-in-ledger model, or accounting-entry ownership by the ledger.
- No memory-backed evidence or authorization.
- No dependency on or modification of the dirty `agents/` slice.
- No `ingest/` module, SUNAT submission transport, web integration, UI, or product workflow.
- No new canonical persistence backend; in-memory or existing development adapters are sufficient for this program.
- No multi-jurisdiction policy engine; only PE policy is in scope.
- No implicit coupling between journal and fiscal statuses.

These exclusions defer integration and broader product capabilities to later roadmap programs; they do not prohibit them permanently.

## Affected areas

| Area | Expected effect |
| --- | --- |
| `tenant/` | New library module for fiscal scope identity and checks. |
| `evidence/` | New library module using existing receipt evidence primitives. |
| `journal/` | New library module owning accounting entries and transitions. |
| Candidate application integration | New pre-inspection ordering adapter; existing `candidates/` contract behavior stays unchanged. |
| `policy/` | New PE restriction surface. |
| Mission/gate application composition | Existing primitives compose CDR successor validation; normative mission and gate contracts stay unchanged. |
| Tests | Strict-TDD unit and integration coverage per slice, plus full regression checks. |
| `ledger/`, `receipts/`, `missions/`, `candidates/`, `gates/` | Reused as existing authority primitives; frozen normative surfaces remain unchanged. |

`agents/`, `ingest/`, product UI, external SUNAT transport, and canonical storage are unaffected.

## Acceptance outcome

The proposal is successful when the eventual implementation demonstrates all of the following:

- Tenant scope accepts exactly valid company/RUC/period identities and blocks mismatched reads.
- Evidence with valid provenance hashes to the existing canonical receipt result; incomplete or memory-shaped evidence fails closed.
- Journal entries accept only BigInt-cent amounts, require evidence, produce receipts for material actions, and transition without implicitly changing fiscal workflow status.
- The ledger remains audit-only and receives only receipt-level audit records rather than accounting-entry ownership.
- Candidate inspection is unreachable through the new fiscal flow until core validation and reconciliation evidence have formed the exact subject; existing freeze and correction behavior still passes its frozen conformance tests.
- CDR validation consumes candidate A through an existing-primitives successor mission composition and creates candidate B with an independent approval and receipt boundary.
- PE policy restricts automatic outcomes; unknown jurisdiction or insufficient authority fails closed.
- Frozen contract files and vectors have no normative delta.
- `bun run test`, `bun run typecheck`, and `bun run build` pass after each applicable slice and for the integrated chain.

Detailed behavioral requirements will be expressed as RFC 2119 Given/When/Then scenarios in the specification phase.

## Delivery and review workload forecast

The complete program is expected to exceed the 400-line review budget, so it will be delivered as a `feature-branch-chain` of five vertical slices. The tracker branch accumulates the integrated result; each child PR targets the immediately preceding slice branch so its review diff remains focused. Every slice includes its behavior, tests, and relevant documentation and MUST remain at or below 400 authored changed lines.

| Slice | Review boundary | Forecast | Dependency | Rollback boundary |
| --- | --- | ---: | --- | --- |
| **1A — tenant** | Tenant identity, validation, scope checks, tests | 200–300 | None | Remove tenant module and its tests before dependent slices land. |
| **1B — evidence** | Evidence lifecycle, canonical hash reuse, fail-closed provenance, tests | 250–350 | 1A | Revert evidence module and its tenant bindings without affecting 1A. |
| **1C — journal** | Entry model/lifecycle, BigInt cents, evidence and receipt binding, tests | 350–400 | 1A–1B | Revert journal module while preserving tenant and evidence capabilities. |
| **1D — candidate ordering adapter** | Validated/reconciled subject construction before existing inspection, tests | 300–400 | 1A–1C | Remove adapter and integration tests; existing candidate lifecycle remains untouched. |
| **1E — policy/CDR composition** | PE policy, gates, successor mission composition, A→B receipt boundary, tests | 350–400 | 1A–1D | Revert policy and CDR composition without changing earlier authority modules. |

If any slice forecasts more than 400 authored changed lines before implementation, that slice must be split into smaller vertical work units rather than receiving a size exception. Generated artifacts, if any, remain part of snapshot identity even when excluded from authored-line accounting.

Because the work concerns fiscal authority and CDR/SUNAT-adjacent behavior, each slice is high risk even below 400 lines and requires the repository's applicable bounded review plan. Strict TDD uses `bun run test`; tests stay in the same work unit as the behavior they prove.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Ledger absorbs journal behavior | High | Keep entry types and transitions in `journal/`; test that audit integration uses receipts rather than journal ownership. |
| Frozen contract drift | High | Treat candidate ordering and mission succession as application composition; require frozen conformance suites to remain unchanged and green. |
| Candidate freezes before reconciliation | High | Construct the exact validated/reconciled subject before calling existing inspection; add ordering tests that make premature inspection unreachable through the fiscal adapter. |
| Candidate A authority leaks into candidate B | High | Give candidate B a distinct identity, approval decision, receipt, and lifecycle boundary; preserve an explicit evidence link to A. |
| Journal and fiscal states become implicitly coupled | High | Use independent state models and paired tests proving either status can remain unchanged while the other transitions. |
| BigInt and floating-point money mix | High | Type amounts as BigInt cents and reject fractional/number-shaped fixtures fail closed. |
| Memory enters the evidence path | Medium | Accept only canonical evidence artifacts with provenance; reject advisory/memory-shaped inputs. |
| Application composition becomes an accidental contract extension | Medium | Keep linking metadata outside normative contract surfaces and document the later-major-bump option if roadmap needs native successor semantics. |
| Dirty `agents/` work contaminates Program 1 | Medium | Prohibit imports from `agents/`; compose library modules and existing mission primitives directly. |
| A slice exceeds reviewer capacity | Medium | Forecast before apply, cap each PR at 400 authored changed lines, and split vertically when needed. |

## Rollback strategy

Rollback follows the feature-branch chain in reverse dependency order: 1E → 1D → 1C → 1B → 1A. Each slice is independently removable with its tests because no slice mutates a frozen contract or existing candidate lifecycle semantics.

If an integrated fiscal flow must be disabled without removing foundational modules, remove or disable the 1E CDR composition first, then the 1D ordering adapter. Existing mission, candidate, receipt, gate, ledger, and recovery behavior remains available because Program 1 only composes those primitives. No ledger rewrite, receipt deletion, contract migration, or in-place journal correction is permitted as rollback.

## Product tradeoffs

- **Composition now, native protocol later:** application-level candidate ordering and successor missions avoid destabilizing frozen contracts, at the cost of keeping relationship semantics outside the normative protocol until a future major version is justified.
- **Authority before integration:** deferring ingestion, SUNAT transport, UI, and canonical storage limits immediate user-facing capability but prevents those integrations from defining fiscal authority accidentally.
- **Five focused PRs instead of one program PR:** the chain increases coordination overhead while preserving review quality, rollback isolation, and the 400-line budget.
- **PE-only policy:** a narrow jurisdiction surface avoids premature abstraction; later LATAM expansion will require an explicit policy evolution rather than hidden generic behavior now.

## Success criteria

- All five chain slices land in order, each at or below 400 authored changed lines.
- Every slice follows strict TDD and records focused test evidence; the completed chain passes test, typecheck, and build commands.
- The acceptance outcomes above are covered by deterministic tests.
- No frozen normative contract or conformance vector changes.
- No source dependency on `agents/` and no `ingest/` module is introduced.
- Reviewers can verify journal ownership, evidence provenance, tenant isolation, candidate ordering, and candidate A→B authority separation without reconstructing cross-slice intent.
