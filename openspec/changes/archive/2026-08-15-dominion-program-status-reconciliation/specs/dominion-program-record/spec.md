# Dominion Program Record Specification

## Purpose

The Dominion program record is the authoritative administrative state of the Drenyra Dominion program. After this change, maintainers can answer, from one consistent evidence model, which canonical SDDs exist, what has landed, what remains gated, which claims are historical, and which downstream SDD owns each unresolved governance requirement — before SDD-020 begins. This change reconciles status, evidence references, and governance ownership across the existing 12-SDD program; it neither creates a thirteenth SDD nor implements product capability.

## Requirements

### Requirement: Canonical 12-SDD Program Invariant

The reconciliation MUST preserve a canonical Dominion catalog of exactly 12 SDDs: SDD-000 through SDD-110 in increments of 10. The record MUST NOT create a thirteenth SDD, nor rename, merge, or remove any canonical SDD, and MUST treat this OpenSpec change as an administrative reconciliation outside the canonical count.

#### Scenario: Catalog remains exactly twelve

- GIVEN the canonical Dominion catalog after reconciliation
- WHEN the catalog is enumerated
- THEN it MUST contain exactly the twelve SDDs SDD-000, SDD-010, SDD-020, SDD-030, SDD-040, SDD-050, SDD-060, SDD-070, SDD-080, SDD-090, SDD-100, and SDD-110
- AND no other SDD is added to the canonical count
- AND the reconciliation change itself is documented as outside that count

### Requirement: One Status Vocabulary Across Five Axes

The record MUST define and apply one explicit status vocabulary that separates at least five axes: (a) program and SDD lifecycle status; (b) implementation maturity (`absent`, `planned`, `partial`, `implemented`); (c) evidence freshness and verification status; (d) Gate 0 decision state; and (e) historical snapshot versus current claim. A term MUST NOT be used across axes without an explicit mapping, and the record MUST document that mapping wherever these statuses appear.

#### Scenario: Ambiguous term is resolved to an axis

- GIVEN a document that uses a status term such as `DRAFT`, `PLANNED`, `IN PROGRESS`, `COMPLETE`, `implemented`, `partial`, `planned`, `candidate`, or `passing`
- WHEN the record is reconciled
- THEN the record MUST map that term to exactly one axis and one meaning under the vocabulary
- AND any use of the term in a different axis MUST be qualified by its axis

### Requirement: Lifecycle and Maturity Axes Remain Independent

The record MUST treat SDD lifecycle status and product implementation maturity as separate axes, and MUST NOT derive one from the other. An `implemented` capability MUST NOT automatically imply that its parent SDD lifecycle is complete, and a `planned` SDD label MUST NOT hide already-landed foundations.

#### Scenario: Implemented capability with incomplete SDD

- GIVEN an SDD whose lifecycle status is not complete
- AND a capability under that SDD whose maturity is `implemented`
- WHEN the program record is generated or read
- THEN the SDD lifecycle status MUST remain not complete unless its gate and evidence obligations are reconciled
- AND the `implemented` capability MUST remain visible in the capability records

### Requirement: Documentary Presence Alone Does Not Complete a Gate

The record MUST NOT mark a product gate complete on the basis of documentary presence alone. A gate that still requires owner approval or runtime evidence MUST remain unresolved regardless of completed documentation.

#### Scenario: Documented but unapproved gate row

- GIVEN a Gate 0 row with documentary artifacts present
- AND no attributable owner approval or runtime evidence for that row
- WHEN the gate is re-evaluated
- THEN the row MUST be recorded as unresolved, not complete

### Requirement: Attributed Evidence-Source Precedence

The record MUST reconcile every claim against the following evidence-source precedence, strongest first:

1. current repository contents and executable verification over the inspected revision;
2. current GitHub repository metadata or release/PR records when directly verifiable;
3. persisted verification reports tied to an identifiable revision;
4. apply-progress and archived implementation records;
5. roadmap, capability matrix, program lock, and narrative planning documents.

A lower-precedence document MUST be treated as a claim to reconcile, not as authority to overwrite stronger evidence. A higher-precedence source MUST prevail when it conflicts with a lower-precedence claim.

#### Scenario: Persisted verification outranks planning snapshot

- GIVEN a persisted verification report bound to an identifiable revision reporting 774/774 green
- AND a capability-matrix or program-lock snapshot claiming a 640-test checkpoint
- WHEN the current-state claim is reconciled
- THEN the current-state claim MUST be bound to that revision or to a fresh run of the higher-precedence evidence
- AND the 640-test snapshot MUST be retained as a historical checkpoint, not rewritten

### Requirement: Every Current-State Claim Carries Source and Freshness

Every updated current-state claim in the record MUST identify its evidence source and freshness or revision marker. A claim without attributable evidence MUST be recorded as `unknown`, `unverified`, or a blocked decision — never as inferred success.

#### Scenario: Claim without evidence

- GIVEN a current-state claim with no attributable evidence source
- WHEN the record is reconciled
- THEN the claim MUST be recorded as `unknown` or `unverified` with no success inference
- AND no downstream gate MAY treat the claim as satisfied

### Requirement: Historical Records Remain Historical

The record MUST preserve historical checkpoints as history. Reconciliation MUST add or update current truth without falsifying, deleting, or rewriting prior checkpoints.

#### Scenario: Historical checkpoint survives reconciliation

- GIVEN a historical checkpoint such as the 640-test program snapshot or the three-failure CLI baseline
- WHEN current truth is updated
- THEN the historical checkpoint MUST remain present and identifiable as historical
- AND the updated current claim MUST NOT be written as though the historical checkpoint never occurred

### Requirement: Gate 0 Reconciles to Current Repository Evidence

Every Gate 0 checklist row MUST be re-evaluated against current repository evidence. The active-change inventory MUST be refreshed without absorbing, renaming, or altering any active change, and genuinely unresolved product-owner decisions MUST remain unresolved.

#### Scenario: Stale gate row re-evaluated

- GIVEN a Gate 0 row describing a dated active-change inventory and pending actions
- WHEN Gate 0 is reconciled
- THEN each row MUST be re-evaluated against current repository evidence
- AND the refreshed inventory MUST NOT absorb, rename, or alter any active change
- AND rows whose owner decisions remain unresolved MUST stay unresolved

### Requirement: User-Provided Approvals Pending Evidence Capture

The Gate 0 business inputs — professional accounting firms, internal accounting teams, and the Peruvian monthly close as the first journey — MUST be recorded as user-provided approvals pending durable evidence capture until attributable, durable approval evidence exists in the authoritative record. The record MUST NOT treat them as unresolved decisions, MUST NOT reopen the business decision, and MUST NOT present them as evidence-backed authoritative claims before such evidence is captured. Capturing that evidence MUST NOT become a new product-decision gate.

#### Scenario: No repository approval evidence yet

- GIVEN the three approved Gate 0 business inputs
- AND no durable, attributable approval record in the authoritative record
- WHEN the record is written
- THEN the inputs MUST be labeled user-provided approval pending evidence capture
- AND the decision MUST NOT be reopened or presented as evidence-backed

#### Scenario: Durable approval evidence exists

- GIVEN a durable, attributable approval reference for the three business inputs in the authoritative record
- WHEN the record is written
- THEN the inputs MAY be promoted to evidence-backed authoritative documentation
- AND the promotion MUST cite the durable approval reference

### Requirement: SDD-020 Remains Blocked Until Gate 0 Permits

The record MUST keep SDD-020 blocked until the reconciled Gate 0 explicitly records that its prerequisites are satisfied. Documentary presence alone MUST NOT unblock SDD-020, and there MUST be no implicit waiver: any exception MUST name an owner, a rationale, a scope, and a durable approval reference.

#### Scenario: Incomplete gate blocks start

- GIVEN reconciled Gate 0 criteria that do not yet permit SDD-020
- WHEN the record is consulted
- THEN SDD-020 MUST be recorded as blocked
- AND no documentation MAY represent SDD-020 as started

#### Scenario: Explicit waiver

- GIVEN a Gate 0 row that is not complete
- AND a documented exception
- WHEN the exception is recorded
- THEN the exception MUST name an owner, a rationale, a scope, and a durable approval reference
- AND absent such an exception, SDD-020 MUST remain blocked

### Requirement: GitHub Visibility Requires Direct Verification

The record MUST change a current GitHub repository-visibility statement only from directly verifiable current repository metadata. Software-license status, product stage, source availability, and GitHub repository visibility MUST remain independent declarations, and none MAY be inferred from another. If direct visibility evidence is unavailable, the record MUST state `unverified` instead of declaring the repository public or private from roadmap prose or public PR links.

#### Scenario: Direct metadata available

- GIVEN current GitHub repository metadata directly queried for the inspected repository identity
- WHEN the visibility statement is reconciled
- THEN the statement MUST be set from that metadata and cite it as the evidence source with its freshness

#### Scenario: Direct metadata unavailable

- GIVEN no directly verifiable GitHub metadata
- AND roadmap prose or public PR links suggesting visibility
- WHEN the visibility statement is reconciled
- THEN the record MUST state visibility as `unverified`
- AND MUST NOT infer public or private from the prose or links

### Requirement: Test-Count and CLI-Failure History Reconciliation

The record MUST NOT replace the stale 640-test current-state claim until fresh or revision-bound verification supports the replacement. The 640-test checkpoint MUST remain historical. The three `cmd/__tests__/cli.test.ts` failures MUST be recorded as a historical baseline superseded by later fully green evidence, and MUST NOT be described as current when fresh verification remains green. The persisted 774/774 fiscal-authority verification is stronger and newer than the 640-test snapshot, but any promoted program claim MUST be bound to its exact revision or to a fresh run.

#### Scenario: Fresh verification green

- GIVEN a fresh or revision-bound green verification for the inspected revision
- WHEN the test-count claim is reconciled
- THEN the current-state claim MUST be bound to that revision or run
- AND the 640-test checkpoint and the three-failure baseline MUST remain as historical records
- AND no current wording MAY describe the three CLI failures as current while green evidence holds

#### Scenario: Only stale snapshot available

- GIVEN no fresh or revision-bound verification
- AND only the 640-test snapshot as evidence
- WHEN the test-count claim is reconciled
- THEN the current-state claim MUST NOT be replaced
- AND the absence of supporting verification MUST be recorded rather than guessed

### Requirement: Capability Matrix, Program Lock, and Roadmap Coherence

`capability-matrix.yaml` MUST be refreshed from current repository contents and attributable verification records. `program-lock.json` and its roadmap/release-train references MUST NOT present stale SHAs, versions, test totals, or conformance outcomes as current. A historical lock snapshot MUST be distinguishable from a current verified composition. The lock bootstrap rule MUST be preserved: the host lock MUST NOT self-reference the commit that contains it. Unavailable or unverifiable external-repository facts MUST be recorded as unknown or awaiting evidence.

#### Scenario: Stale lock reference

- GIVEN a program-lock or roadmap reference carrying a stale SHA, version, test total, or conformance outcome
- WHEN the composition records are reconciled
- THEN the stale reference MUST NOT be presented as current
- AND it MUST be marked as historical or as awaiting refreshed evidence

#### Scenario: Lock bootstrap rule

- GIVEN the commit that contains the host lock
- WHEN the lock's snapshot references are validated
- THEN the host lock MUST NOT self-reference that commit

### Requirement: Governance Amendment Allocation

The five cross-cutting governance amendments MUST be recorded in the SDDs that own their eventual implementation, and nowhere else: evidence precedence, freshness, and reproducible cross-repository claims in SDD-010; tenant-scoped least authority and segregation in SDD-060; normative-source provenance, vigencia, pinning, and rollback in SDD-070; non-authorizing context and independent adversarial findings in SDD-080 and SDD-090; restricted external authority, credentials, and accountable operations in SDD-110. The amendments are governance clarifications: the record MUST NOT claim that the corresponding product capabilities already exist, and MUST NOT implement them in this change.

#### Scenario: Each amendment is assigned to its owning SDD

- GIVEN the five governance amendments
- WHEN the owning SDD records are inspected
- THEN each amendment MUST appear only in the owning SDD or SDDs named above
- AND no amendment MAY be allocated to any other SDD

#### Scenario: No capability claim

- GIVEN an amendment concerning a capability not yet implemented, such as RBAC/ABAC or KMS
- WHEN the amendment is recorded
- THEN the record MUST state that the capability is not claimed to exist
- AND MUST NOT describe the capability as implemented

### Requirement: Protected-Path Isolation

This change MUST NOT modify, copy, supersede, or mark complete any of: `openspec/programs/drenyra-dominion/README.md`, `openspec/programs/drenyra-dominion/ecosystem-coherence.md`, any path under `openspec/changes/ecosystem-coherence/`, or `openspec/changes/fiscal-authority-kernel/verify-report.md`. Those paths MUST remain byte-for-byte unchanged by this change.

#### Scenario: Protected paths verified unchanged

- GIVEN the protected paths before the change
- WHEN the change is complete
- THEN each protected path MUST be byte-for-byte identical to its prior content

### Requirement: Ecosystem-Coherence Boundary

The record MUST identify `ecosystem-coherence` as related but non-duplicative, with exclusive ownership of its EC inconsistency inventory, governance-decision register, propagation units, and readback log. This change MUST NOT modify, copy, supersede, or mark complete any `ecosystem-coherence` record, and MAY reference it only at the boundary level.

#### Scenario: Boundary-level reference only

- GIVEN a need to reference ecosystem coherence from the reconciled record
- WHEN the reference is written
- THEN the reference MUST be a boundary-level pointer that does not copy content
- AND no `ecosystem-coherence` record MAY be modified, superseded, or marked complete

### Requirement: No Product Capability Implementation

This change MUST NOT implement any product capability or change runtime behavior: no external connectors or adapters, no RBAC or ABAC, no KMS or credential infrastructure, no Command Center modification, no production rollout, no start of SDD-020 or any later canonical SDD, and no change to frozen contract semantics. Its write surface MUST be limited to authoritative program documentation and administrative metadata within the fixed edit allowlist.

#### Scenario: Change surface is administrative only

- GIVEN the change's deliverables
- WHEN they are inspected
- THEN every deliverable MUST be a documentation or administrative-metadata edit within the allowlist
- AND no deliverable MAY implement, enable, or claim a product capability

### Requirement: Bounded Evidence-Backed Documentation Edits

The change MUST fix the exact edit allowlist before implementation, and every documentation edit MUST be backed by evidence per the precedence rule, with source and freshness identified. A documentation edit MUST NOT assert a current-state claim that the evidence does not support, and MUST record `unknown` or `unverified` when evidence is absent. The allowlist MUST be limited to: SDD-000 and SDD-010 records; Gate 0; the capability matrix; the program lock and release/roadmap references; the six SDD records receiving the five governance amendments; and the status and evidence-source documentation needed to keep those records coherent.

#### Scenario: Edit within the allowlist with evidence

- GIVEN an edit to a record inside the fixed allowlist
- AND attributable evidence with source and freshness
- WHEN the edit is applied
- THEN the edit MUST cite the evidence source and freshness
- AND the claim MUST be consistent with the evidence

#### Scenario: Claim without supporting evidence

- GIVEN a proposed documentation edit asserting a current-state claim
- AND no attributable evidence supporting it
- WHEN the edit is considered
- THEN the edit MUST NOT assert the claim as current
- AND the claim MUST be recorded as `unknown`, `unverified`, or blocked instead
