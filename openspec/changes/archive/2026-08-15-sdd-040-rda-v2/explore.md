# Exploration — SDD-040 (RDA v2) Closure Scope

> Change: `sdd-040-rda-v2` · Phase: explore · Store: openspec
> Scope: establish what SDD-040 needs to formally close the RDA v2 capability record.
> Source program: `openspec/programs/drenyra-dominion/` (gate-0.md, authority-model.md §5).

## 1. SDD-040 record (declared scope)

`openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2/README.md` — Status **PLANNED**, all
progress checkboxes **unchecked** (Exploration through Archive). Depends on SDD-030; feeds
SDD-090 (Guardian) and SDD-050 (monthly close).

Declared scope surface (normative targets):

- Candidate freeze with **canonical identity**: `schemaVersion, tenantId, ruc, companyId,
  fiscalPeriodId, intent, subjectHash, evidenceSetHash, policySetHash, skillSetHash,
  materiality, currency, canonicalPayload`.
- Tier derivation **R0–R3** with proportional review (automatic / one approval / two distinct
  approvers).
- Receipt types: **Analysis, Review, Approval, Authorization, Execution, Reconciliation,
  Close package** — shared signed envelope, different claims.
- Autonomy policy A + C: `A_effective = A_org ∩ A_jurisdiction ∩ A_skill ∩ A_connector ∩
  A_materiality ∩ A_actor`; R3 never lowered; integrity gates have no kill switch.
- Capacity ceilings as versioned policies.
- Bounded correction (one correction, independent validation, then escalation).
- Review lenses: scope, evidence, accounting, tax, materiality, execution, fraud/adversarial,
  explainability.
- Mandatory pre-execution gates that **recalculate** their decision.
- UNKNOWN reconciliation (uncertain external result queried/reconciled before retry).
- RDA v2 invariants (receipts never over-claim; approval ≠ execution; Guardian never in quorum;
  ledger is history, not the journal).

## 2. Implemented RDA v2 surface (current-state inventory)

The RDA machinery is **implemented and largely archived**. The fiscal-authority-kernel was
archived 2026-08-15 (PR #32) and gate-0.md row 1 names it "the implementation seed for SDD-040
(RDA v2) and SDD-050 (monthly close)". Module exports are wired through `index.ts` (L13–32) and
`package.json` `exports`.

| Surface | Files | Key symbols |
| --- | --- | --- |
| Candidates | `candidates/` (`types.ts`, `identity.ts`, `materiality.ts`, `lifecycle.ts`, `index.ts`) | `Candidate`, `CandidateLifecycle` (`propose/inspect/submitForReview/accept/reject/correct`), `deriveMateriality`, `candidateIdentity`, `Materiality = R0\|R1\|R2\|R3`, `CorrectionRecord` (at-most-once budget) |
| Receipts | `receipts/` (`types.ts`, `sign.ts`, `verify.ts`, `canonical.ts`) | `SignedReceipt`, `ReceiptType` (APPROVAL/EXECUTION/COMPLETION/EXTERNAL_SUBMISSION), `buildSignedReceipt`, `verifySignedReceipt`, `generateReceiptKeyPair` |
| Ledger | `ledger/` (`types.ts`, `validate.ts`) | `validateLedger`, `GENESIS_EMPTY_HASH`, `LedgerManifest`, `LedgerEntry` (append-only audit) |
| Gates | `gates/` (`approval.ts`, `receipt.ts`, `mission.ts`, `runner.ts`) | `GateRunner.run` (fail-closed, first non-`allowed` stops), `ApprovalGate`, `distinctApprovers`, `ReceiptGate`, `MissionStateGate` |
| Missions | `missions/` (`runtime.ts`, `commands.ts`, `status.ts`, `reconciliation.ts`, `idempotency.ts`, `fencing.ts`, `outbox.ts`, `versioning.ts`) | `MissionRuntime`, `canonicalHash`, `IdempotencyConflict`, `AccountingMissionStatus` (incl. UNKNOWN), `reconcileMission` |
| Recovery | `recovery/` (`policy.ts`, `replay.ts`) | `recoveryAction`, `decideUnknownRecovery`, `replayMission`, `UnknownRecoveryOutcome` (completed/failed/running) |
| Review | `review/` (`lenses.ts`, `workload.ts`) | `ReviewLens`, `ALL_4R_LENSES`, `selectReviewLenses`, `forecastReviewWorkload`, `getWorkflowInstructions` |
| Guardian | `guardian/` | `runGuardianReview`, `GuardianReport` (findings-only; never in quorum) |
| Journal | `journal/` (`journal.ts`) | `record`, `post`, `supersede`, `revoke` — BigInt cents, balanced, signed receipts, never in-place |
| Evidence | `evidence/` (`accept.ts`, `identity/`, `authority/`) | `acceptEvidence`, `AcceptedEvidence`, `registerEvidence`, `assertEvidenceInScope` |
| Fiscal | `fiscal/` (`candidate-ordering.ts`, `types.ts`) | `FiscalCandidateOrderingAdapter` (candidate A → successor → candidate B) |
| Policy | `policy/` (`pe-policy.ts`, `types.ts`) | `evaluatePePolicy`, `govern` (PE restriction; restrict not grant) |
| CDR | `cdr/` (`successor.ts`, `types.ts`) | `CdrSuccessorComposer` (candidate A → candidate B via successor mission) |
| Tenant | `tenant-core/`, `tenant-isolation/` | `ValidatedTenantScope` (company, 11-digit RUC, `YYYYMM`), cross-tenant fail-closed reads |
| Flow | `flow/` (`close.ts`) | `runMonthlyClose` — flagship close vertical |
| CLI | `cmd/cli.ts` | `receipt verify`, `ledger validate`, `mission start|apply|status|recover`,`candidate inspect|verify`,`gate check` |

## 3. End-to-end receipt-driven flow today

Two concrete flow realizations exist and are tested.

**Monthly-close vertical** (`flow/close.ts` `runMonthlyClose`): preflight (checksummed RUC +
`YYYYMM` period) → evidence fetch via `AdapterRegistry.resolve(system, "PE")` (absence →
`waiting-for-evidence`, never zero) → `CandidateLifecycle.propose` per reconciliation proposal →
`runGuardianReview` (findings; blockers surfaced, not hidden) → `buildSignedReceipt`
(`approve-candidate`, Ed25519) → `validateLedger` (existing chain must validate; pending append).
Deterministic, never mutates external state. Tests: `flow/__tests__/close.test.ts` (preflight
failures, waiting-for-evidence, receipt issuance, ledger validity).

**Candidate lifecycle + gates** (`candidates/lifecycle.ts`, `gates/runner.ts`): proposed →
inspected → reviewing → accepted|corrected|rejected; identity is content-derived (`subjectHash`
= SHA-256 over exact bytes); materiality derived from BigInt cents + reversibility + jurisdiction,
never agent claims; correction budget at-most-one; `GateRunner` evaluates gates in order and fails
closed on the first non-`allowed` (including `needs_input` carrying a decision envelope).

**UNKNOWN reconciliation** (`recovery/policy.ts`): `recoveryAction` maps status → action
(RUNNING/RETRYING → recover-to-unknown; UNKNOWN → decide-by-evidence; human-wait → leave, never
auto; terminal → untouched). `decideUnknownRecovery` decides by the event log: a COMPLETED/FAILED
event after the last UNKNOWN marker proves termination; otherwise reconciles to `running` for
retry — never classified as blind terminal success/failure. Event log is the source of truth.

## 4. Gap vs the SDD-040 declared scope

Most of the normative scope is implemented. The **gaps are naming/vocabulary and completeness
deliberations**, not missing subsystems:

1. **Receipt type vocabulary.** SDD-040 declares 7 claim types (Analysis, Review, Approval,
   Authorization, Execution, Reconciliation, Close package). Implemented `ReceiptType` in
   `receipts/types.ts` has **4** (`APPROVAL`, `EXECUTION`, `COMPLETION`, `EXTERNAL_SUBMISSION`).
   The shared-envelope concept (different claims, same signed envelope) is implemented; the
   vocabulary is not expanded to the 7 SDD-040 names, and there is no distinct
   Analysis/Reconciliation/Close receipt type symbol.
2. **Review lenses vocabulary.** SDD-040 declares 8 fiscal-domain lenses (scope, evidence,
   accounting, tax, materiality, execution, fraud/adversarial, explainability). Implemented
   `review/lenses.ts` ships the **4R code-review lens set** (risk/resilience/readability/
   reliability) plus judgment-day. The fiscal-domain lens vocabulary is not represented as a
   symbol.
3. **Canonical identity cardinality.** The SDD-040 identity lists 13 fields. The implemented
   `candidateIdentity` (`candidates/identity.ts`) is a compact 3-element key
   (`subjectHash:scope.ruc:scope.period`); the broader tenant/company/fiscalPeriod/intent/
   evidenceSet/policySet/skillSet/materiality/currency/payload envelope is present across
   modules (tenant-core, evidence, policy, skills) but not collapsed into one canonical identity
   structure with all 13 fields.
4. **Capacity ceilings as versioned policies** are described in authority-model §5.4 but no
   dedicated versioned-policy module symbol enumerates the 10 ceilings (R1..R3 / Forbidden).
   `policy/pe-policy.ts` restricts outcomes (PE only) but the capacity-ceiling matrix is not a
   first-class artifact.
5. **The standalone execution receipt / UNKNOWN boundary** is realized via missions + recovery,
   not as a distinct `EXECUTION` vs `RECONCILIATION` claim pair; the semantics are enforced but
   the claim vocabulary is not surfaced.

**No missing subsystem / no new core behavior is required to close.** The RDA v2 machinery
(candidate freeze, tier + proportional review, gates, receipts, ledger, UNKNOWN reconciliation,
bounded correction, autonomy-restricting policy) is implemented, tested, and in part archived.

## 5. Closure recommendation: reconciliation/formalization, not new code

This is a **documentation/reconciliation/formalization change** in the same shape as the archived
`fiscal-authority-kernel` and `dominion-program-status-reconciliation` closures — **not a new-code
change**. It should:

- Map the implemented surface (§2) to each SDD-040 scope item and each RDA v2 invariant
  (authority-model §5.8), citing exact files/symbols as evidence.
- Record the gap deliberations (§4) as explicit **non-goals / deferred** notes rather than silent
  omissions (e.g., "receipt-type vocabulary stays at the implemented 4-union; the 7-claim mapping
  is satisfied compositionally by missions + recovery + flow", "fiscal-domain review lenses remain
  documented in authority-model §5.6; implemented lens set is the 4R code set").
- Add per-invariant acceptance mappings (candidate immutability, gate recalculation, 0 blind
  retries, receipts-never-over-claim, approval≠execution) that the existing tests already prove.
- Close the SDD record (check off the Progress checklist) and archive the change.

**Size estimate:** docs-only; ~4–8 files (proposal/spec/design/tasks/apply-progress/verify/archive
- README progress update). Well under the 400-line review budget; single PR, `single-pr`
delivery strategy, no chained PRs. No runtime artifact touched; suite expected to stay green
unchanged.

## 6. Evidence references

- **Fiscal kernel archive**: `openspec/changes/archive/2026-08-15-fiscal-authority-kernel/`
  (PR #32). Archive report: 100/100 tasks, **41/41 requirements**, **61/61 scenarios**, suite
  **774/774** + typecheck green; verify envelope `gentle-ai.verify-result/v1`, verdict pass,
  0 blockers, at HEAD `4975f4f`.
- **Fiscal kernel verify envelope**: `.../fiscal-authority-kernel/verify-report.md` — suite
  `60 files, 774 passed`; frozen contracts untouched (`git diff 42bd1d0^ HEAD -- contracts/` empty);
  test_output_hash `sha256:f0313438…`; RED/GREEN/REFACTOR evidence per batch.
- **RDA v2 modules** are covered by that suite and by the later archived slices:
  `sdd-020-configurator` (798/798), `sdd-030-routing` (843/843) — each recorded at
  `openspec/changes/archive/…/verify-report.md`.
- **Program ground truth**: `authority-model.md` §5 (RDA v2 — identity, receipt types, autonomy
  A+C, capacity ceilings, bounded correction, lenses, gates, invariants); `gate-0.md` row 1 and
  §6 item 2 (fiscal-authority-kernel archived; "implementation seed for SDD-040 and SDD-050").

## 7. Risks / boundaries

- **Scope creep.** The review-lens and receipt-type vocabulary gaps (§4) must be recorded as
  documented non-goals, not silently "fixed" by renaming frozen exports — `receipts/types.ts` is
  a frozen/ported contract, and `git diff` guardrails show contracts/ must stay untouched.
- **Frozen contracts.** Do not alter `contracts/`, `receipts/types.ts` receipt vocabulary, or
  the candidate/gate/ledger conformance vectors; the closure must be additive documentation.
- **No new behavior.** A verify gate should confirm suite count is unchanged (843/843 baseline)
  and typecheck/build stay green; any test delta would signal accidental code change.
- **Dependency boundary.** SDD-040 depends on SDD-030 (routed candidates) and feeds SDD-050
  (close) and SDD-090 (Guardian). Closure of SDD-040 does not close SDD-050/090 — those remain
  PLANNED and depend on this record's documented contract surface.
- **Cross-store discipline.** This exploration is persisted to `openspec` (per the change root);
  no `openspec/changes/sdd-040-rda-v2/` artifacts existed before this file, and nothing outside
  that directory was modified.

## Bottom line

**SDD-040 needs a reconciliation/formalization closure change (docs-only), not new code.** The
RDA v2 capability — candidates, gates, receipts, ledger, review, recovery, policy/CDR, journal,
evidence, tenant — is implemented, tested (774/774 fiscal kernel suite, later 843/843), and
partially archived via the fiscal-authority-kernel. The closure should map surface to scope,
document the 5 vocabulary/cardinality gaps as non-goals, close the SDD record, and archive.
