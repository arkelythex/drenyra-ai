# Proposal — SDD-040 RDA v2 Closure

> Change: `sdd-040-rda-v2` · Phase: proposal · Store: OpenSpec
> Change type: documentation-only reconciliation and lifecycle closure

## Intent

Formally close the SDD-040 Receipt-Driven Accounting v2 record against the RDA v2 capability that already exists in the repository. The fiscal-authority kernel, archived through PR #32, and the later routed-candidate work provide the deterministic accounting authority surface required by SDD-040. This change makes the lifecycle record truthful without changing runtime behavior or expanding frozen contracts.

SDD-040 is a permitted Wave 1 capability. Closure planning treats SDD-010 as the prerequisite authority foundation; the current SDD-040 program record names SDD-030 as its direct routed-candidate dependency. SDD-040 feeds the SDD-050 monthly-close journey, while SDD-090 consumes its frozen candidates for read-only Guardian review. This proposal closes only SDD-040; SDD-050 and SDD-090 remain `PLANNED`.

## Context and current-state gap

The RDA v2 machinery is implemented, exported, tested, and substantially covered by the archived fiscal-authority kernel. Its archive evidence reports 41/41 requirements, 61/61 scenarios, 774/774 tests, green typecheck, and no frozen-contract delta. Subsequent program slices raised the repository baseline to 843/843.

The remaining gap is documentary: `openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2/README.md` still says `PLANNED`, and every lifecycle checkbox remains unchecked. That record no longer reflects the implemented capability. Leaving it open obscures what SDD-050 may safely consume and makes the program status harder to explain or audit.

## Roadmap and architecture alignment

This closure reconciles SDD-040 with the 16-program Peru v1 roadmap and the approved deterministic-authority architecture:

- AI and Guardian components remain advisory; they cannot authorize or join approval quorum.
- Candidate identity, materiality, gates, receipts, recovery, policy, and journal behavior remain under deterministic library authority.
- The ledger remains append-only audit history and is not reclassified as the accounting journal.
- Evidence remains provenance-bound authority input and is not treated as agent memory.
- Tenant, fiscal, policy, CDR, and monthly-close composition remain layered consumers of frozen contracts rather than contract replacements.

## Scope

This is a documentation-only closure. It will:

1. Map the implemented RDA v2 surface to the SDD-040 declared scope and invariants:
   - candidate lifecycle and R0–R3 materiality through `CandidateLifecycle`, `candidateIdentity`, and `deriveMateriality`;
   - Ed25519 signed receipts through `SignedReceipt`, `buildSignedReceipt`, and `verifySignedReceipt`;
   - append-only audit validation through `validateLedger`;
   - fail-closed gate recalculation and distinct approval through `GateRunner` and the approval/receipt/mission gates;
   - uncertain-result handling through mission `UNKNOWN` state, `reconcileMission`, `recoveryAction`, and `decideUnknownRecovery`;
   - bounded correction and proportional review through candidate correction records, the 4R review workload, and judgment-day review;
   - journal, evidence, fiscal ordering, PE policy, CDR successor composition, tenant-core/isolation, and `runMonthlyClose` as the end-to-end deterministic authority composition.
2. Record the five known differences as explicit deferred vocabulary/model non-goals rather than silently treating them as missing implementation:
   - the implemented receipt union has four claim types rather than the seven names in the original SDD declaration;
   - the implemented review vocabulary is 4R plus judgment-day rather than eight fiscal-domain lens symbols;
   - canonical candidate identity is represented compactly rather than as one 13-field identity structure;
   - capacity ceilings are enforced compositionally but are not exposed as one dedicated versioned ceiling matrix;
   - execution and reconciliation semantics exist across receipts, missions, and recovery without separate `EXECUTION` and `RECONCILIATION` receipt symbols matching the declared vocabulary.
3. Record acceptance evidence for candidate immutability, recalculated gates, receipts that do not over-claim, approval distinct from execution, Guardian exclusion from quorum, append-only ledger history, and zero blind retries after `UNKNOWN`.
4. Close the SDD-040 lifecycle record and archive the completed closure change.

## Affected areas

- `openspec/changes/sdd-040-rda-v2/`: closure artifacts and archive evidence.
- The SDD-040 program record: status and lifecycle checklist reconciliation during the closure workflow.
- Program status documentation that derives SDD lifecycle state, if required to preserve the 12-SDD invariant.

No production modules, exported contracts, conformance vectors, tests, or build configuration are affected.

## Non-goals

- No changes under `contracts/`; frozen contract surfaces and conformance vectors remain unchanged.
- No production-code changes, export renames, receipt-union expansion, new review-lens symbols, identity redesign, capacity-policy module, or runtime behavior changes.
- No closure of SDD-050 or SDD-090; both remain `PLANNED`.
- No test additions, removals, or expectation changes. The suite baseline remains 843/843.
- No reinterpretation of approval as execution, Guardian findings as quorum approval, the audit ledger as the journal, or agent memory as evidence.
- No external execution or connector implementation.

## Product tradeoffs

The closure favors a truthful, auditable lifecycle record over expanding SDD-040 to recreate every vocabulary named in its original declaration. This keeps the implemented and verified authority model stable, protects frozen surfaces, and allows downstream planning to rely on the capability that actually exists.

The tradeoff is explicit: consumers must understand that some declared concepts are satisfied compositionally rather than by one-to-one exported symbols. Recording those five differences as non-goals is preferable to either leaving them implicit or introducing unnecessary compatibility risk through renaming and contract expansion.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Documentation overstates parity with the original declaration | Preserve a traceable scope-to-symbol map and list all five differences explicitly. |
| Scope creep turns closure into vocabulary or contract redesign | Enforce docs-only scope; any runtime or frozen-surface delta blocks acceptance. |
| Closing SDD-040 is misread as closing downstream journeys | State that SDD-050 and SDD-090 remain `PLANNED` and require their own lifecycle evidence. |
| Dependency history becomes ambiguous | Record both the SDD-010 prerequisite authority context and the SDD-030 direct routed-candidate dependency currently declared by the program record. |
| Program counts or status drift | Verify the 12-SDD invariant after lifecycle reconciliation. |
| Baseline evidence is accidentally changed | Require the suite to remain 843/843 and protected paths to remain unchanged. |

## Rollback

Rollback is documentary: revert the SDD-040 closure and status-reconciliation documentation, restoring the prior `PLANNED` record. No receipts, ledger entries, journal entries, runtime state, schemas, or external effects require reversal because this change creates none. Archived implementation evidence remains untouched.

## Success criteria

The closure succeeds when:

- the implemented surface is mapped to every SDD-040 scope area and invariant with concrete module or symbol evidence;
- all five vocabulary/cardinality differences are documented as explicit non-goals or deferred model refinements;
- SDD-040 is marked complete through its lifecycle and archived with a verifiable closure record;
- SDD-050 and SDD-090 remain `PLANNED`;
- `contracts/` and all other protected runtime paths are unchanged;
- the test suite remains exactly 843/843, with no suite delta caused by this change;
- the program continues to satisfy the 12-SDD invariant;
- no new code, behavior, export, or normative contract is introduced.

## Proposal question round

This delegated proposal could not pause for an interactive product-question round. It proceeds with these review assumptions:

- “Depends on SDD-010” describes prerequisite permission/foundation, while SDD-030 remains the direct dependency recorded for routed candidates.
- The five differences are intentionally accepted as closure non-goals, not commitments to implement them in this change.
- Downstream SDDs may consume the documented RDA v2 surface but do not inherit closure status.

Questions for parent/user review before advancing beyond proposal:

1. Should the final SDD-040 record preserve both dependency meanings explicitly, or should one dependency become the sole program-level source of truth?
2. Are the five differences accepted as indefinitely documented composition choices, or should any be assigned to a named future SDD?
3. Should SDD-090 remain listed as a consumer alongside SDD-050 even though this closure must not change SDD-090 status?
4. Is evidence from the archived fiscal kernel plus the unchanged 843/843 baseline sufficient for closure, or is a separate program-status reconciliation citation required?
