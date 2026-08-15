# Reconcile the Dominion Program Record Before SDD-020

## Intent

Reconcile the authoritative administrative truth of the existing Drenyra Dominion program before downstream work begins at SDD-020. This change corrects program status, evidence references, and governance ownership across the already-canonical 12-SDD program; it does not create a thirteenth SDD or a replacement program.

The result should let maintainers answer, from one consistent evidence model, what has landed, what remains gated, which claims are historical, and which downstream SDD owns each unresolved governance requirement.

## Why this change is needed

The Dominion program documents were created at different checkpoints and now mix planning state, implemented repository state, historical verification evidence, and current operational claims. Examples visible in the repository include:

- SDD-000 and SDD-010 are labeled `PLANNED` even though the program tree, frozen-contract record, capability snapshot, and release-train artifacts exist.
- Gate 0 still describes an August 2026 active-change inventory and several pending/in-progress actions that require current reconciliation.
- `capability-matrix.yaml` and `program-lock.json` retain a 640-test Drenyra AI checkpoint, while later persisted verification records report a fully green 774-test suite.
- Several changes preserve the historical three-failure CLI baseline, but later persisted evidence records that the failures cleared and the full suite became green before subsequent growth.
- `ROADMAP.md` states that the repository is private, while repository records link to publicly accessible GitHub pull-request history. Current repository visibility must be checked directly rather than inferred from either statement.
- Status terms such as `DRAFT`, `PLANNED`, `IN PROGRESS`, `COMPLETE`, `implemented`, `partial`, `planned`, `candidate`, and `passing` are used across different artifact types without an explicit mapping.

Without reconciliation, SDD-020 could begin against stale gates or implied capabilities, and future maintainers could mistake historical evidence for current truth.

## Scope

### 1. Reconcile SDD-000, SDD-010, and Gate 0

- Update SDD-000 and SDD-010 administrative status and progress markers to reflect evidence that is actually present and verifiable.
- Re-evaluate every Gate 0 checklist row against current repository evidence.
- Refresh the active-change inventory without absorbing, renaming, or altering any active change.
- Preserve genuinely unresolved product-owner decisions as unresolved; documentary presence alone must not mark a gate complete.
- Treat the approved Gate 0 business inputs—professional accounting firms, internal accounting teams, and the Peruvian monthly close as the first journey—as user-provided approvals pending durable evidence capture, not as unresolved decisions. Promote them into authoritative documentation only when their approval evidence is attributable and durable.
- Keep SDD-020 blocked until the reconciled Gate 0 criteria explicitly permit it; evidence capture for these already-approved inputs must not become a new product-decision gate.

### 2. Reconcile capability and release composition records

- Refresh `capability-matrix.yaml` from current repository contents and attributable verification records.
- Reconcile `program-lock.json` and its roadmap/release-train references without presenting stale SHAs, versions, test totals, or conformance outcomes as current.
- Distinguish a historical lock snapshot from a current verified composition.
- Preserve the lock bootstrap rule: the host lock cannot self-reference the commit that contains it.
- Record unavailable or unverifiable external-repository facts as unknown or awaiting evidence rather than guessing.

### 3. Establish one status vocabulary

Define an explicit vocabulary and mapping for:

- program and SDD lifecycle status;
- implementation maturity (`absent`, `planned`, `partial`, `implemented`);
- evidence freshness and verification status;
- Gate 0 decision state;
- historical snapshots versus current claims.

The vocabulary must prevent an implemented capability from automatically implying that its parent SDD is complete, and prevent a planned SDD label from hiding already-landed foundations.

### 4. Define evidence-source precedence

Reconcile claims using this precedence, subject to later specification:

1. current repository contents and executable verification over the inspected revision;
2. current GitHub repository metadata or release/PR records when directly verifiable;
3. persisted verification reports tied to an identifiable revision;
4. apply-progress and archived implementation records;
5. roadmap, capability matrix, program lock, and narrative planning documents.

Lower-precedence documents are claims to reconcile, not authority to overwrite stronger evidence. Every updated current-state claim must identify its evidence source and freshness. Unverifiable GitHub visibility, release, or sibling-repository facts must remain explicitly unresolved.

### 5. Reconcile test-count and CLI-failure history

- Replace the stale 640-test current-state claim only after a fresh or revision-bound verification supports the replacement.
- Preserve historical checkpoints rather than rewriting them as if they never occurred.
- Record that the three `cmd/__tests__/cli.test.ts` failures were a historical baseline, then were superseded by later fully green evidence; do not continue describing them as current if fresh verification remains green.
- Treat the persisted 774/774 fiscal-authority verification as stronger and newer than the 640-test program snapshot, but still bind any promoted program claim to its exact revision or a fresh run.

### 6. Reconcile repository visibility wording

- Verify current GitHub visibility through direct repository metadata before changing the current visibility statement.
- Distinguish software-license status, product stage, source availability, and GitHub repository visibility; none implies the others.
- If direct visibility evidence is unavailable, retain an explicit `unverified` statement instead of declaring the repository public or private from roadmap prose or public PR links alone.

### 7. Allocate five cross-cutting governance amendments

Record the amendments in the existing SDDs that own their eventual implementation. These are governance clarifications, not implementation work in this change.

| Amendment | Owning SDD(s) | Administrative outcome in this change |
| --- | --- | --- |
| Evidence precedence, freshness, and reproducible cross-repository claims | SDD-010 | Define how manifests, locks, tests, releases, and repository metadata become attributable program evidence. |
| Tenant-scoped least authority and segregation | SDD-060 | Make tenant/org scope, distinct-actor duties, and fail-closed boundary evidence explicit without implementing RBAC/ABAC. |
| Normative-source provenance, vigencia, pinning, and rollback | SDD-070 | Require every fiscal skill/policy claim to identify jurisdiction, source, effective period, immutable mission pin, and reversible version. |
| Non-authorizing context and independent adversarial findings | SDD-080 and SDD-090 | Preserve the separation between memory/context, evidence, review findings, approval, and execution; both memory and Guardian remain non-authoritative. |
| Restricted external authority, credentials, and accountable operations | SDD-110 | Assign connector manifests, destination restrictions, KMS/key lifecycle, observability, incident evidence, and production acceptance to the production SDD. |

These amendments may tighten future acceptance criteria, but must not claim that the corresponding product capabilities already exist.

### 8. Preserve program identity and related-change boundaries

- Keep the canonical Dominion catalog at exactly 12 SDDs: SDD-000 through SDD-110 in increments of 10.
- Treat this OpenSpec change as administrative reconciliation outside that canonical count.
- Identify `ecosystem-coherence` as related but non-duplicative. It owns its EC inconsistency inventory, governance-decision register, propagation units, and readback log.
- Do not modify, copy, supersede, or mark complete any `ecosystem-coherence` record from this change.

## Affected areas

Expected later implementation work is limited to authoritative program documentation and administrative metadata, principally:

- SDD-000 and SDD-010 records;
- Gate 0;
- capability matrix;
- program lock and release/roadmap references;
- the six SDD records receiving the five governance amendments;
- status and evidence-source documentation needed to keep those records coherent.

The exact edit allowlist must be fixed in tasks before apply. Protected user-owned paths and the separate `ecosystem-coherence` change remain outside this proposal's write set.

## Non-goals

This change does **not**:

- implement any product capability;
- implement external connectors or adapters;
- implement RBAC or ABAC;
- implement KMS or credential infrastructure;
- implement or modify Command Center;
- perform production rollout, pilots, or commercial launch;
- start SDD-020 or any later canonical SDD;
- change frozen contract semantics;
- change the canonical count of 12 Dominion SDDs;
- modify `openspec/programs/drenyra-dominion/README.md`;
- modify `openspec/programs/drenyra-dominion/ecosystem-coherence.md`;
- modify any path under `openspec/changes/ecosystem-coherence/`;
- modify `openspec/changes/fiscal-authority-kernel/verify-report.md`.

## Business and governance rules

1. Current-state claims require current or revision-bound evidence.
2. Missing evidence produces `unknown`, `unverified`, or a blocked decision—not an inferred success.
3. Historical records remain historical; reconciliation adds or updates current truth without falsifying prior checkpoints.
4. Product implementation status and SDD lifecycle status are separate axes.
5. A completed documentary artifact does not complete a product gate that still requires owner approval or runtime evidence.
6. Repository visibility, license, product stage, and open-core intent are independent declarations.
7. SDD-020 may proceed only after the reconciled Gate 0 explicitly records that its prerequisites are satisfied.
8. `ecosystem-coherence` retains exclusive ownership of its EC inventory and propagation workflow.
9. The Gate 0 target users and first journey are approved: professional accounting firms, internal accounting teams, and the Peruvian monthly close. Until durable, attributable approval evidence is captured in the authoritative record, label this as user-provided approval pending evidence capture; do not infer repository approval, reopen the business decision, or promote the claim as evidence-backed.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Stale evidence is promoted as current | False readiness and premature SDD-020 start | Require source, revision, and freshness for every promoted claim. |
| Administrative status is confused with implementation completion | Overstates delivered product capability | Maintain separate lifecycle and capability axes. |
| GitHub visibility is inferred from a public URL | Incorrect legal or product messaging | Verify direct repository metadata or mark visibility unverified. |
| Test totals become another quickly stale headline | Repeated drift | Bind totals to a revision/checkpoint and document how they are refreshed. |
| Governance amendments expand into implementation | Scope and review budget blowout | Limit this change to allocation and acceptance wording; defer code to owning SDDs. |
| Related `ecosystem-coherence` work is duplicated or damaged | Competing sources of truth | Keep its records read-only and cross-reference only at the boundary level. |
| Program identity changes accidentally | Breaks the accepted 12-SDD roadmap | State and verify the invariant that the canonical count remains 12. |

## Rollback

Rollback is documentary and atomic by affected record:

- revert reconciliation wording and metadata to the prior program snapshot;
- restore the previous lock/matrix snapshot if refreshed evidence is later found invalid;
- retain historical verification and decision records unchanged;
- never roll back by deleting or rewriting `ecosystem-coherence` records;
- keep SDD-020 blocked if rollback removes evidence required by Gate 0.

## Success criteria

The change succeeds when:

- SDD-000, SDD-010, Gate 0, capability matrix, program lock, and roadmap/status references tell one non-contradictory story;
- every current-state claim has an attributable evidence source and freshness/revision marker;
- the test-count discrepancy is resolved without erasing the 640-test historical checkpoint, and stale CLI-failure wording is clearly superseded where current evidence is green;
- repository visibility is stated only from directly verifiable current GitHub metadata, or explicitly marked unverified;
- one documented status vocabulary separates lifecycle, capability maturity, gate state, and evidence freshness;
- all five governance amendments are assigned to SDD-010/060/070/080/090/110 without implementing them;
- Gate 0 records professional accounting firms, internal accounting teams, and the Peruvian monthly close as already-approved business inputs, with durable and attributable approval evidence before presenting them as evidence-backed authoritative claims;
- absent that repository evidence, the approval is recorded as user-provided pending evidence capture without reopening the decision or creating a new gate;
- Gate 0 has an explicit, evidence-backed decision on whether SDD-020 may begin;
- `ecosystem-coherence` remains unchanged and is documented as related but non-duplicative;
- all protected user-owned paths remain byte-for-byte unchanged;
- the canonical Dominion program still contains exactly 12 SDDs.

## Proposal question round

Automatic execution prevents an interactive question round before this artifact is written.

The following Gate 0 business inputs are confirmed, not open questions: professional accounting firms, internal accounting teams, and the Peruvian monthly close as the first journey. Their current status is **user-provided approval pending evidence capture**. Reconciliation must capture a durable, attributable approval reference before authoritative documentation presents them as evidence-backed; missing repository evidence must not reopen the decision or create a new approval gate.

The remaining product questions and working assumptions require review before specification:

1. **Approval evidence capture:** Which durable, attributable record should be referenced for the already-approved Gate 0 business inputs? Assumption: use the authoritative Gate 0 decision record or an equivalent owner-attributable record; this is evidence capture, not a new business decision.
2. **Status semantics:** Should SDD-000/010 become `COMPLETE`, or should the vocabulary support a state such as `FOUNDATION LANDED / RECONCILIATION PENDING`? Assumption: do not mark complete until all declared gate and evidence obligations are reconciled.
3. **Evidence freshness:** How long may GitHub visibility and sibling-repository evidence remain current? Assumption: bind it to the reconciliation timestamp and exact repository identity, then require refresh at each integrated checkpoint.
4. **SDD-020 release gate:** Must every Gate 0 row be complete, or may explicitly waived rows permit SDD-020? Assumption: no implicit waiver; any exception requires a named owner, rationale, scope, and durable approval reference.

Specification should preserve the confirmed inputs and these remaining assumptions unless the user corrects them or requests a second question round.
