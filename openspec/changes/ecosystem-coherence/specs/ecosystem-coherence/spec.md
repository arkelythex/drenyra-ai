# Ecosystem Coherence Specification

## Purpose

Restore a coherent, evidence-backed public and maintainer-facing description of the Drenyra ecosystem without changing product behavior, licenses, or fiscal authority. Drenyra Dominion acts as the ecosystem program master: it records the cross-repository inconsistency inventory, tracks accountable owners, decision status, evidence, and completion, and separates evidence-backed documentation corrections from governance decisions that require explicit owner approval. Product repositories remain authoritative for their own licenses, released artifacts, and implemented behavior; FEOS, ledger boundaries, membership, and maturity remain owner-approved decision gates, never inferred facts.

## Requirements

### Requirement: Program Inventory and Decision Tracking

The ecosystem program master MUST maintain a single reviewable program record that lists every audited cross-repository inconsistency, its affected repositories, accountable owner, status, evidence source, dependency boundary, rollback boundary, and decision state, and MUST record completion evidence showing that propagated declarations agree across affected repositories.

#### Scenario: Complete inventory covers every audited inconsistency

- GIVEN the read-only ecosystem audit identified inconsistencies across Drenyra Command Center, Drenyra AI, Engram, and Drenyra Pi
- WHEN the program record is created
- THEN every audited inconsistency appears with its affected repositories, an accountable owner, a current status, and a link to the evidence used

#### Scenario: Unresolved decision state is visible in the record

- GIVEN a governance matter (FEOS relationship, ledger boundaries, membership, or maturity) has no recorded owner approval
- WHEN the program record lists that matter
- THEN it is marked as unresolved with a named owner and a next decision point, and is never presented as settled

### Requirement: Evidence-Backed License Correction

Documentation in Drenyra Command Center MUST state the license declared by the repository's authoritative `LICENSE` file, MUST NOT claim a license the repository does not hold, and MUST NOT alter license terms.

#### Scenario: MIT claim removed in favor of the authoritative license

- GIVEN Drenyra Command Center's `LICENSE` declares a proprietary license while its README claims MIT
- WHEN the README and policy wording are corrected
- THEN no MIT claim remains, the stated license matches the `LICENSE` file, and the `LICENSE` file content is unchanged

#### Scenario: Correction cites the repository-local evidence

- GIVEN a reviewer requests justification for the license wording
- WHEN the corrected documentation is inspected
- THEN the wording links to the authoritative `LICENSE` file as its evidence source

### Requirement: Engram Publication Correction

Documentation describing Engram MUST agree with Engram's authoritative license and the consistent Apache-2.0/open declarations across Drenyra Command Center, Engram, Drenyra AI, and the capability matrix, and MUST distinguish software openness from data-privacy guarantees; separately documented data-privacy guarantees MUST be preserved.

#### Scenario: Private description corrected to open

- GIVEN Drenyra Command Center policy describes Engram as private while Engram's authoritative license and the other ecosystem declarations describe it as Apache-2.0/open
- WHEN the Command Center wording is corrected
- THEN the wording matches the Apache-2.0/open declarations and does not state privacy properties that are not separately documented

#### Scenario: Openness and privacy stay separate

- GIVEN Engram has separately documented data-privacy guarantees
- WHEN publication wording is corrected
- THEN software license status and data-privacy guarantees are described as distinct concerns, and the existing privacy guarantees are preserved

### Requirement: Release Metadata Reconciliation

Drenyra AI current `0.5.0` package metadata, changelog, README, and capability matrix MUST agree with the npm release artifact, using the immutable registry tarball and integrity metadata as authoritative evidence; historical changelog entries MUST NOT be rewritten. This current-state requirement supersedes the stale `0.2.1` reconciliation target.

#### Scenario: Current 0.5.0 metadata reconciled

- GIVEN npm `latest`, the registry artifact, package metadata, changelog, and README identify `0.5.0`, while the capability matrix retains a `0.4.0` checkpoint
- WHEN the current-release metadata correction is applied
- THEN package metadata, changelog, README, and capability matrix all identify `0.5.0`, and the program evidence links to the immutable npm tarball and integrity metadata

#### Scenario: History is preserved

- GIVEN the live changelog already records `0.5.0` and earlier releases
- WHEN the current-release correction is applied
- THEN earlier changelog entries remain intact and no historical entry is rewritten

### Requirement: Roadmap Publication Correction

Roadmap publication checkboxes in Drenyra Pi and Engram MUST match verifiable release/publication evidence and MUST only be marked published when such evidence exists.

#### Scenario: Stale checkbox updated from evidence

- GIVEN a roadmap publication checkbox is stale and verifiable release/publication evidence exists
- WHEN the roadmap is corrected
- THEN the checkbox matches the evidence and the correction links to that evidence

#### Scenario: Unverifiable claim is not marked published

- GIVEN no verifiable release/publication evidence exists for a roadmap item
- WHEN the roadmap is reviewed for correction
- THEN the item is not marked published and the lack of evidence is not filled in by assumption

### Requirement: Human Fiscal Authority Wording

Public descriptions of the ecosystem MUST state that humans retain fiscal and business decision authority while Drenyra AI executes deterministic, policy-constrained operations and records evidence, MUST NOT imply autonomous business or legal judgment by Drenyra AI, agents, or Engram, and MUST NOT promote advisory AI or memory into fiscal evidence or authorization.

#### Scenario: Boundary stated consistently across public wording

- GIVEN public documentation describes Drenyra AI operations
- WHEN a reader inspects the wording
- THEN it distinguishes human fiscal decision authority from deterministic, policy-constrained execution and evidence recording

#### Scenario: No autonomy implication in any description

- GIVEN any public description of Drenyra AI or Engram
- WHEN it is reviewed
- THEN it contains no implication of autonomous fiscal or legal judgment, and neither advisory AI nor memory is described as fiscal evidence or authorization

### Requirement: Governance Decision Blocking

The FEOS relationship, the ledger boundary model, and canonical ecosystem membership and maturity MUST remain visibly unresolved and MUST NOT be presented as settled in any downstream document until a named owner explicitly approves a declaration; absence of a decision MUST NOT be treated as permission to infer one.

#### Scenario: Unapproved matter stays labeled unresolved

- GIVEN no owner has approved the FEOS relationship
- WHEN any ecosystem document mentions FEOS
- THEN the mention labels the relationship as unresolved and does not invent an authority hierarchy

#### Scenario: Unapproved declaration blocks propagation

- GIVEN a ledger boundary model has not been owner-approved
- WHEN a work unit would state a ledger boundary in any repository
- THEN that work unit is blocked until owner approval is recorded, and temporary wording keeps the matter marked unresolved

### Requirement: Governance Decision Propagation

An owner-approved governance declaration MUST be propagated to the affected repositories and cross-checked for agreement, MUST be revertible without deleting the decision record, and MUST preserve decision history by superseding prior decisions rather than rewriting them.

#### Scenario: Approved declaration propagates and is cross-checked

- GIVEN owners approved a canonical membership and maturity declaration
- WHEN the propagation work unit completes
- THEN every affected repository states the approved labels, and the program record links the approval and the cross-check evidence showing the declarations agree

#### Scenario: Replaced decision is superseded, not rewritten

- GIVEN a previously approved decision is replaced by a later owner decision
- WHEN the later decision is recorded
- THEN the later decision supersedes the earlier one with its own date and reference, and the earlier decision record remains intact

### Requirement: Repository-Local Authority

Product repositories MUST remain authoritative for their own licenses, released artifacts, and implemented behavior; the ecosystem program master MUST NOT restate product-local facts as its own authority; repository-local legal artifacts MUST remain authoritative for license terms.

#### Scenario: Product repository evidence governs

- GIVEN a conflict between program-record wording and a product repository's authoritative `LICENSE`
- WHEN facts are corrected
- THEN the product repository's `LICENSE` governs and the program record points to it as the evidence source

#### Scenario: Program record coordinates without overriding

- GIVEN a product fact that is governed by a released artifact
- WHEN the program record describes that fact
- THEN the record cites the released artifact as authoritative and does not substitute its own determination

### Requirement: Coherent Dominion Capability Catalog Extension

The existing Dominion program master MUST catalog SDD-120 Deterministic Fiscal Authority Kernel, SDD-130 Evidence Ingestion and Provenance, SDD-140 SUNAT Declaration and CDR Reconciliation, and SDD-150 Continuous Fiscal Audit and Assurance as four separate `lifecycle:planned` records, MUST link their dependency order from the existing master catalog, and MUST NOT treat catalog presence as implementation evidence, external-execution approval, or a second program master.

#### Scenario: Four planned capabilities extend the existing master

- GIVEN the Dominion master currently catalogs SDD-000 through SDD-110
- WHEN the authorized catalog amendment is applied
- THEN SDD-120, SDD-130, SDD-140, and SDD-150 each have a resolvable catalog record, remain `lifecycle:planned`, and are linked from the same Dominion master

#### Scenario: Catalog amendment creates no authority or implementation claim

- GIVEN the four records describe deterministic authority, evidence ingestion, SUNAT reconciliation, and fiscal assurance boundaries
- WHEN a reviewer inspects the catalog and dependency graph
- THEN no record claims runtime implementation, privileged external access, autonomous fiscal judgment, or settlement of an unresolved FEOS, ledger, membership, or maturity decision

### Requirement: No Implementation, Code, or Contract Change

This change MUST NOT alter product code, runtime behavior, APIs, contracts, data schemas, persistence, migrations, ledger contents, or create new cross-repository automation; all corrections MUST be documentation-only.

#### Scenario: Correction diff is documentation-only

- GIVEN an evidence-backed correction work unit
- WHEN its diff is reviewed
- THEN it contains only documentation or declarative content changes and no code, contract, schema, persistence, migration, or ledger mutation

#### Scenario: No new automation is introduced

- GIVEN a remediation work unit completes
- WHEN its delivered artifacts are inspected
- THEN no new synchronization layer, business ledger, audit ledger, memory store, or cross-repository automation was created

### Requirement: Independent Work Units Under Review Budget

Each correction MUST be an independent, repository-scoped work unit with its own evidence links, repository-specific readback evidence, and rollback boundary, MUST stay within the 400 authored-line review budget per PR, and MUST NOT combine unrelated corrections.

#### Scenario: Independent rollback between repositories

- GIVEN two corrections are delivered in different owning repositories
- WHEN one correction is reverted
- THEN the other correction remains intact and functional

#### Scenario: Oversized work is split rather than combined

- GIVEN a work unit's authored diff would exceed 400 changed lines
- WHEN the work unit is planned for delivery
- THEN it is split by repository or by decision into smaller independent units instead of combining unrelated corrections

#### Scenario: Evidence and readback accompany each unit

- GIVEN a work unit is delivered
- WHEN its completion evidence is reviewed
- THEN it includes evidence links and repository-specific readback evidence demonstrating the corrected state
