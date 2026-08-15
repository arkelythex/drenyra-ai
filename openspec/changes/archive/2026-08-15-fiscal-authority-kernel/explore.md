# Exploration — Fiscal Authority Kernel (Program 1, 16-program Peru v1 roadmap)

> **Change:** `fiscal-authority-kernel` · **Phase:** explore · **Scope:** read-only investigation; no product code, tests, docs, or worktree slice were modified.
>
> Fiscal convention (repo-wide): monetary values are BigInt cents; no float is ever used for money; sequence/version numbers are JSON integers.

## Lead

**Program 1 establishes the deterministic fiscal-authority core for Peru v1: journal owns accounting entries, evidence demonstrates, tenant isolates scope, policy restricts, and candidates freeze only after core validation + reconciliation. The ledger stays audit-only; memory stays advisory and never becomes evidence.** Everything in this program builds on the six frozen contracts (mission-protocol, candidate, receipt, gate, ledger, recovery) without mutating their normative surfaces, and every implementation slice stays inside the 400-line review budget.

The 16-program roadmap document lives outside this repository; Sections 1 (program scope/gap) and 2 (architecture/invariants) were supplied by the orchestrator context and are mapped to repository evidence below. Where repo evidence and roadmap invariants meet, the invariant wins; where the roadmap is silent, repo conventions apply.

## Current-state gap

### What exists today (evidence)

| Surface | Evidence | State |
| --- | --- | --- |
| Contracts | `contracts/` — mission-protocol, candidate, receipt, gate, ledger, recovery | All **FROZEN v0.1** (release 0.2.0); conformance suites in `contracts/__tests__/` run in CI and fail on drift |
| Receipts | `receipts/` — canonical hash, Ed25519 sign/verify, trusted-key lifecycle, `computeEvidenceHash` | Implemented + frozen vectors |
| Ledger | `ledger/` — append-only validation, chain continuity, first-divergence reporting | Implemented; **explicitly audit-only** (`contracts/ledger.md`, `docs/architecture/receipt-ledger-model.md`) |
| Missions | `missions/` — 14-state protocol, `MissionRuntime`, idempotency, events, versioning | Implemented; terminal states guarded; `RECONCILED` event exists |
| Candidates | `candidates/` — identity (byte-based subject hash), materiality R0–R3, immutable lifecycle with one-scoped correction | Implemented; subject freezes at `inspect` (`candidates/lifecycle.ts`) |
| Review | `review/` — 4R lens selection + workload forecast (`LINE_THRESHOLD = 400`, critical subsystems include `fiscal`/`sunat`) | Implemented |
| Gates | `gates/` — fail-closed `GateRunner`; verdicts `allowed | blocked | needs_input` | Implemented |
| Recovery | `recovery/` — crash-safe resumption/replay | Implemented |
| Agents | `agents/` — deterministic intent handlers + registry (staging only, never fiscal authority) | Implemented; **part of the dirty slice, out of scope here** (see non-goals) |
| CLI | `cmd/` — receipt verify, ledger validate, mission start/apply/status/recover, candidate inspect/verify, gate check | Implemented; thin adapters |
| Storage | `cmd/adapters/file-mission-store.ts` | **Development adapter only**; canonical storage is future (`docs/architecture/storage-model.md`) |

Test baseline: **463 tests across 25 files** (Vitest), typecheck `tsc --noEmit`, build via `scripts/build.mjs`, packed-artifact + install verification (`bun run test` is the strict-TDD runner).

### What is missing (the gap Program 1 closes)

1. **No `journal/` module.** Nothing owns accounting entries. Today `missions/` tracks lifecycle state and `ledger/` chains receipted events, but no module records, validates, or owns the accounting entries themselves (debits/credits, BigInt cents, entry lifecycle). The ledger must NOT absorb this — it is audit-only.
2. **No `evidence/` module.** `EvidenceItem` exists as a type in `receipts/types.ts` and `computeEvidenceHash` exists, but there is no evidence collection/validation surface with a lifecycle, provenance, and fail-closed acceptance.
3. **No `tenant/` module.** Scope is ad hoc (`companyId`, RUC/period strings); canonical storage requires structural scope enforcement on read (RUC/company/period) per `docs/architecture/storage-model.md`.
4. **No `policy/` module.** Materiality policy and jurisdiction rules are hardcoded (PE-escalation in `candidates/materiality.ts`); the authority model says *"policy restricts"* (`docs/architecture/authority-model.md`) but there is no policy surface.
5. **No candidate freeze after core validation + reconciliation.** `inspect` freezes the subject hash, but nothing binds a candidate to reconciliation evidence before accept; the roadmap invariant requires the freeze point to be *after core validation + reconciliation*.
6. **No CDR validation path.** The roadmap defines CDR validation as a **successor mission** operating on a **candidate**; nothing in the current mission lifecycle models successor missions (mission → successor mission) or a CDR-specific validation flow.
7. **No SUNAT-facing flow scaffolding.** The approved target explicitly puts SUNAT-facing capabilities in scope per slice; no `ingest/` or submission surface exists.

## Approved architecture map (Section 2 → implementation map)

Layer model (must be respected; `docs/architecture/dependency-rules.md`):

```text
contracts/            normative, versioned, transport-agnostic (FROZEN surfaces)
   ▼
receipts/  ledger/  missions/  candidates/  review/  gates/  recovery/
   + NEW: tenant/  evidence/  journal/  policy/  (ingest/ later programs)
   │  library modules — node:crypto only, zero runtime deps
   ▼
agents/               orchestration, staging only (imports missions/ only)
   ▼
cmd/                  thin adapters (parsing, ajv, output, file stores)
```

### Program 1 module placement

| Module | Layer | Responsibility | Imports (allowed) |
| --- | --- | --- | --- |
| `tenant/` | library | Scope identity + validation (RUC 11 digits, period YYYYMM, companyId); structural scope enforcement for reads | `node:crypto` only; re-export conventions from `receipts/` like existing single-definition re-exports |
| `evidence/` | library | Evidence item lifecycle, canonical evidence hash, fail-closed acceptance; **never** memory-backed | `receipts/` (EvidenceItem, computeEvidenceHash) |
| `journal/` | library | **Owns accounting entries**: BigInt-cents entries, entry lifecycle, journal status | `tenant/` (scope), `receipts/`, `evidence/` |
| `policy/` | library | Jurisdiction (PE) + materiality policy surface; restriction rules (authority model: *policy restricts*) | `candidates/` (Materiality) |
| CDR validation | mission-level | Successor mission bound to a candidate; reuses `missions/` lifecycle + `gates/` | `missions/`, `candidates/`, `journal/`, `policy/` |

### Mandatory invariants (preserved verbatim by this program)

1. **Ledger is audit-only.** The ledger chains receipted events and proves order/integrity; it never becomes the journal, never owns accounting entries, never mutates. Corrections are new entries (`ENTRY_SUPERSEDED`/`ENTRY_REVOKED`), never in-place edits (`contracts/ledger.md`).
2. **Journal owns accounting entries.** `journal/` is the single module that records, validates, and transitions accounting entries. Ledger records receipts of those actions; journal owns the entries.
3. **Memory is advisory and not evidence.** Drenyra Engram integration may exist for context reads, but memory has no authorization surface and never satisfies an evidence requirement (`docs/architecture/authority-model.md`, `trust-boundaries.md`). Evidence comes from `evidence/` + receipts.
4. **Candidate freezes after core validation + reconciliation.** The candidate's subject and scope freeze only once core validation and reconciliation have produced evidence; the freeze point in the candidate lifecycle must reflect this ordering, preserving the existing at-most-one-correction budget.
5. **Journal and fiscal statuses are independent.** A journal entry's status (e.g., posted/pending) is tracked independently of fiscal lifecycle statuses (mission status, SUNAT submission status). Neither drives the other implicitly; transitions must be explicit.
6. **CDR validation uses a successor mission and candidate.** CDR validation is not a bespoke parallel flow: it is a successor mission in the mission lifecycle whose input is a candidate (and its bound evidence), validated through the deterministic Core (mission transitions, idempotency, gates, receipts).

## Frozen contracts affected

| Contract | Version | Impact of Program 1 | Handling |
| --- | --- | --- | --- |
| `mission-protocol` | 0.1 FROZEN | Successor-mission modeling may touch lifecycle semantics | **No normative change in this program** unless proposal explicitly scopes it; otherwise model successor missions as an application-level composition (a successor mission is created via existing `create` command, linked by fields carried in `input`/evidence), and propose a contract addendum for a later major |
| `candidate` | 0.1 FROZEN | Freeze-after-reconciliation ordering | Must not silently alter the frozen lifecycle; the proposal must decide: (a) interpret `inspect` as the freeze point with reconciliation evidence bound into the subject, or (b) propose a contract addendum (major bump + migration) |
| `receipt` | 0.1 FROZEN | Evidence hashing reuses `computeEvidenceHash`; no change to canonical payload | Unchanged |
| `gate` | 0.1 FROZEN | New gates (evidence gate, journal-entry gate) must follow the existing `Gate` interface and fail-closed `GateRunner` | Additive; no contract change |
| `ledger` | 0.1 FROZEN | Journal actions produce receipts that the ledger chains | Unchanged; ledger stays audit-only |
| `recovery` | 0.1 FROZEN | Journal/evidence recovery may reuse recovery patterns | Unchanged unless proposal scopes a new recovery surface |

**Rule:** any normative change to a frozen contract requires a proposal-scoped decision, a major version bump, conformance-vector updates in lockstep, and explicit approval (`contracts/README.md` "How to change a contract"). This program defaults to **no frozen-contract mutation**; new capability ships as new modules + additive gates.

## Dependency chain (tenant → evidence → journal → candidate → CDR)

```text
tenant/scope  ──►  evidence/  ──►  journal/  ──►  candidate freeze  ──►  CDR successor mission
      │                │              │                │                        │
      │                │              │                └── bound evidence ──────┘
      │                │              └── receipts (every material journal action)
      │                └── receipts (computeEvidenceHash)
      └── read-scope enforcement for canonical storage (structural, per storage-model.md)
```

- **tenant → everything:** scope identity (RUC/company/period) validates every artifact where fiscal context applies (contracts/README.md requirement 3).
- **evidence → journal:** journal entries MUST reference evidence; entries without evidence fail closed.
- **receipts → journal:** every material journal mutation produces a signed receipt (`RED` — nothing material happens without one); ledger chains those receipt hashes.
- **journal → candidate freeze:** reconciliation evidence (journal-side) is part of what freezes a candidate after core validation + reconciliation.
- **candidate → CDR:** CDR validation consumes a frozen candidate as its input artifact.
- **policy → CDR and journal:** PE policy restricts what CDR validation may auto-accept and what journal transitions are permitted without human approval.

## First vertical slice boundaries

Each slice must stay **≤ 400 changed lines** (config `review_budget_lines: 400`; `forecastReviewWorkload` marks `fiscal`/`sunat` as critical subsystems, so every slice is high-risk review territory → per-slice 4R or risk+reliability lenses).

| Slice | Scope | Approx. changed lines | Depends on |
| --- | --- | --- | --- |
| **1A — tenant/scope core** | `tenant/` types + validation (RUC 11 digits, period YYYYMM, companyId), scope unit tests; single-definition re-exports | ~200–300 | nothing new |
| **1B — evidence module** | `evidence/` item lifecycle + canonical hash reuse + fail-closed acceptance; tests | ~250–350 | 1A |
| **1C — journal module** | `journal/` accounting-entry types (BigInt cents), entry lifecycle, journal status (independent of fiscal status), receipt binding; tests | ~350–400 | 1A, 1B |
| **1D — candidate freeze ordering** | Reconciliation-evidence binding before freeze; respects at-most-one correction; contract-addendum decision gate | ~300–400 | 1B, 1C |
| **1E — policy + CDR successor mission** | `policy/` PE surface; successor-mission creation for CDR validation over a candidate; gates; tests | ~350–400 | 1A–1D |

Order: 1A → 1B → 1C → 1D → 1E. Each slice is independently reviewable; chained PRs recommended (see review-size forecast). `ingest/` and SUNAT submission flows are **later programs**, not this one.

## Strict non-goals

- **No ledger mutation and no journal-in-ledger.** The ledger stays audit-only; journal entries are never ledger entries.
- **No memory-as-evidence.** Engram or any memory surface never satisfies an evidence requirement; no evidence API accepts memory output.
- **No product logic.** No UI, no SUNAT web submission, no documents/accounts product surface (`docs/architecture/ecosystem-boundaries.md`).
- **No frozen-contract mutation by default.** No silent changes to mission-protocol, candidate, receipt, gate, ledger, or recovery normative surfaces; any change is a proposal-scoped decision with a major bump.
- **No `ingest/` module.** Import/ingestion of external data is a later program; Program 1 defines only the authority core (tenant, evidence, journal, policy, CDR validation).
- **No agents/ coupling.** The dirty agent/CLI/doc slice (passed typecheck + 463 tests) is **out of scope** unless a proposal explicitly declares it a dependency; Program 1 composes library modules directly. Agents remain staging-only and never gain fiscal authority here.
- **No multi-jurisdiction engine.** PE (Perú) only; LATAM expansion is roadmap Phase 3.
- **No new persistence backend.** Canonical storage remains future; tests use in-memory/dev adapters.
- **No float money.** BigInt cents everywhere; journal amounts are BigInt, never Number.

## Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| 1 | **Ledger absorbs journal semantics** (drift from audit-only) | HIGH | Invariant enforced in design/tasks; conformance tests assert ledger rejects entry-type payloads; review lens `review-reliability` per slice |
| 2 | **Frozen contract drift** (candidate freeze, successor missions touching mission-protocol) | HIGH | Proposal must explicitly decide addendum vs. application-level composition BEFORE spec; conformance suites keep drift visible (CI fails) |
| 3 | **Journal/fiscal status coupling** (one implicitly drives the other) | HIGH | Independent status enums + explicit transition tables; tests assert independence (journal can be posted while fiscal submission is pending, and vice versa) |
| 4 | **Memory sneaks into evidence path** | MEDIUM | Evidence API accepts only `evidence/` artifacts; a test asserts memory-shaped input is rejected |
| 5 | **CDR validation reinvented as a bespoke flow** bypassing mission lifecycle | MEDIUM | CDR validation MUST be a successor mission over a candidate; gates + idempotency apply; test asserts lifecycle conformance |
| 6 | **Candidate freeze ordering violated** (freeze before reconciliation) | MEDIUM | Lifecycle ordering tests; freeze state unreachable without bound reconciliation evidence |
| 7 | **Slice overrun > 400 lines** triggering review-workload escalation | MEDIUM | Slice boundaries fixed; any slice forecasting >400 splits before apply |
| 8 | **Dirty-slice contamination** (accidental dependency on un-released agents/ changes) | LOW | Import lint in design/tasks; Program 1 imports only library modules + contracts |
| 9 | **BigInt/float mixing in journal amounts** | HIGH | Type-level BigInt cents; tests with fractional-cent fixtures fail closed |

## Testable acceptance shape

Strict TDD (`bun run test` = `vitest run`) with per-slice RED → GREEN → REFACTOR. Acceptance criteria will be Given/When/Then (per config `specs` rule) and at minimum:

- **Tenant:** RUC validation accepts exactly 11 digits; period is YYYYMM; scope mismatch blocks reads (fail closed).
- **Evidence:** every evidence item has identity + provenance; hash equals `computeEvidenceHash` canonical output; memory-shaped input is rejected.
- **Journal:** entries are BigInt cents (fractional cent fixture throws); every material mutation has a signed receipt; journal status transitions are explicit and independent of fiscal status (asserted by paired state tests).
- **Candidate freeze:** a candidate cannot freeze without core validation + reconciliation evidence; correction budget still at most one; freeze ordering test.
- **Policy/CDR:** PE policy restricts auto-accept; CDR validation runs as a successor mission consuming a candidate; unknown jurisdiction escalates one tier (fail-closed, existing materiality behavior).
- **Regression:** full suite (463 + new) green; typecheck green; build green; packed-artifact verification unaffected.

## Review-size forecast

Per `review/workload.ts` `forecastReviewWorkload`: every slice touches critical subsystems (`fiscal`, `sunat`), so:

- **Per-slice estimate:** ~200–400 changed lines each → below `LINE_THRESHOLD` individually → per-slice strategy **`single-pr`** with **4R review** (critical fiscal surface, fresh reviewer) or at minimum `review-risk` + `review-reliability` (fiscal-change workflow per `getWorkflowInstructions("fiscal-change")`).
- **Whole program:** 5 slices × ~300 lines ≈ 1,400–1,900 total → **`ask-on-risk` / chained PRs recommended (`chainedPRsRecommended: true`)**. Chain strategy: `feature-branch-chain` (tracker branch accumulates integration; per-slice PRs stay focused) — configurable at apply time via `delivery_strategy: auto-forecast`.
- **Decision needed before apply:** Yes — chain strategy + whether any frozen-contract addendum is scoped. Forecast: `decisionNeeded: true`, reason "Exceeds 400 lines AND touches critical subsystems".

## Next steps for the proposal phase

1. Decide the **candidate freeze mechanism**: contract addendum (major bump) vs. application-level ordering over the existing lifecycle.
2. Decide **successor-mission modeling**: application-level composition vs. mission-protocol addendum (deferred by default).
3. Confirm **slice boundaries 1A–1E** and the chain strategy (`feature-branch-chain` recommended).
4. Confirm **no agents/ dependency** and **no ingest/** in Program 1.
5. Map the proposal to the roadmap program definition (Section 1) and the approved architecture sections (Section 2) per config `rules.proposal`.

## Verification checklist

- [x] Read `openspec/config.yaml` (approved target modules, review budget, TDD runner)
- [x] Read ROADMAP + Phase 1–2c state (all six contracts frozen at 0.2.0)
- [x] Read architecture docs: authority-model, storage-model, receipt-ledger-model, trust-boundaries, dependency-rules, ecosystem-boundaries, system-context
- [x] Read module surfaces: receipts, ledger, missions (status/commands/events/types), candidates (lifecycle), review (lenses/workload), gates (runner/types), recovery
- [x] Confirmed 463 tests / 25 files baseline; strict TDD `bun run test`
- [x] Confirmed ledger audit-only contract (`contracts/ledger.md`) and receipt-vs-ledger boundary
- [x] Confirmed all six mandated invariants are preserved and explicit in this artifact
- [x] No product code, tests, existing docs, or worktree slice modified
