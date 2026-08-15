# Proposal — Ecosystem Coherence

## Decision

Drenyra Dominion will serve as the ecosystem program master: the reviewable program record that identifies cross-repository inconsistencies, assigns their remediation work units, records owner decisions, and tracks evidence that every affected repository agrees.

This change separates evidence-backed documentation corrections from governance questions that require explicit owner confirmation. It does **not** silently choose the FEOS relationship or the ledger-of-record, audit-ledger, and memory authority model.

## Intent

Restore a coherent public and maintainer-facing description of the Drenyra ecosystem without changing product behavior or fiscal authority. Readers should be able to determine, without reconciling conflicting repositories themselves:

- which projects belong to the ecosystem and their maturity;
- each project's license and publication status;
- the boundary between human fiscal decisions and Drenyra AI execution authority;
- which governance relationships are confirmed and which remain explicitly unresolved;
- where the approved ecosystem declaration and remediation evidence are tracked.

## Current-state gap

The read-only ecosystem audit found these inconsistencies:

- Drenyra Command Center's README claims MIT while its `LICENSE` is proprietary.
- Command Center policy describes Engram as private while Engram, Drenyra AI, and the capability matrix describe it as Apache-2.0/open.
- The program authority and FEOS relationship are undocumented.
- Ecosystem membership and maturity labels differ across repositories.
- Drenyra AI 0.2.1 package metadata drifts from its changelog, README, and capability matrix.
- Drenyra Pi and Engram roadmap publication checkboxes are stale.
- Public wording can conflate Drenyra AI execution authority with human fiscal decision authority.
- Command Center, Drenyra AI, and Engram do not share one approved declaration of ledger-of-record, audit-ledger, and memory boundaries.

These conflicts increase onboarding and review cost, weaken license clarity, and make authority claims difficult to audit.

## Scope

### A. Immediate evidence-backed documentation corrections

These corrections may proceed independently when the repository's authoritative local evidence already determines the answer:

1. **Command Center license correction** — align README and policy wording with the repository's proprietary `LICENSE`; do not alter license terms.
2. **Engram publication correction** — align Command Center wording with Engram's authoritative license and the consistent Apache-2.0/open declarations; preserve any separately documented data-privacy guarantees.
3. **Drenyra AI release metadata correction** — reconcile 0.2.1 metadata across package metadata, changelog, README, and capability matrix using the released artifact as evidence.
4. **Roadmap publication correction** — update stale publication checkboxes in Drenyra Pi and Engram only where release/publication evidence is verifiable.
5. **Fiscal-authority wording correction** — state consistently that humans retain fiscal decision authority while Drenyra AI executes deterministic, policy-constrained operations and records evidence; avoid implying autonomous business or legal judgment.

Each correction is a separate reviewable work unit in its owning repository, includes links to the evidence used, and can be rolled back without reverting another correction.

### B. Governance decisions requiring explicit owner confirmation

Drenyra Dominion will record these as unresolved decision items until the accountable owners approve a declaration:

1. **Program authority and FEOS relationship** — define whether FEOS is a product, operating model, governing program, peer system, or another relationship, and identify which source is authoritative.
2. **Ledger boundary model** — define, without overloaded terminology:
   - which system is the business or fiscal ledger of record;
   - which component owns the append-only audit ledger and receipts;
   - what Engram memory may retain;
   - what memory must never authorize, evidence, or replace.
3. **Canonical ecosystem membership and maturity** — approve the project roster, maturity vocabulary, and current label for every member before propagating it across repositories.

No downstream document may present one of these decisions as settled before owner confirmation is recorded. Temporary wording must label the matter as unresolved and avoid inventing an authority hierarchy.

### C. Program-master record

Drenyra Dominion will maintain the ecosystem remediation record containing:

- the canonical issue inventory and affected repositories;
- the accountable owner and status for each work unit;
- evidence links and the approved wording or decision reference;
- dependency and rollback boundaries;
- completion evidence showing that propagated declarations agree.

Dominion is the **program master**, not automatically the source of truth for every product fact. Product repositories remain authoritative for their own licenses, released artifacts, and implemented behavior; approved governance decisions determine cross-product authority boundaries.

## Reviewable work units

| Work unit | Outcome | Dependency | Rollback boundary |
| --- | --- | --- | --- |
| W1 — Program inventory | Dominion records discrepancies, owners, evidence, and decision status | None | Remove the new program record only |
| W2 — License and publication facts | Command Center license/Engram status wording matches authoritative repository evidence | W1 | Revert only affected documentation wording |
| W3 — Release and roadmap facts | Drenyra AI 0.2.1 metadata and Pi/Engram publication markers agree with release evidence | W1 | Revert each repository correction independently |
| W4 — Human authority wording | Public descriptions distinguish human fiscal decisions from deterministic execution | W1 | Revert wording without changing runtime behavior |
| W5 — Governance decisions | Owners approve FEOS, ledger boundaries, membership, and maturity declarations | W1 | Withdraw or supersede the decision record; do not rewrite history |
| W6 — Declaration propagation | Approved governance declarations are propagated and cross-checked | W5 | Revert propagation while retaining the decision record |

W2, W3, and W4 may proceed in parallel. W6 is blocked until W5 is explicitly approved. Every repository change should remain below the 400 authored-line review budget; split by repository or decision if necessary rather than combining unrelated corrections.

## Affected areas

| Area | Expected effect |
| --- | --- |
| Drenyra Dominion | Ecosystem program master, decision register, ownership, and completion evidence |
| Drenyra Command Center | License, Engram publication status, and later approved ledger wording |
| Drenyra AI | Release metadata, fiscal-authority wording, and later approved ledger wording |
| Engram | Roadmap publication state and later approved memory boundary wording |
| Drenyra Pi | Roadmap publication state and ecosystem maturity wording after approval |
| Capability matrix and shared ecosystem docs | Consistent release, membership, maturity, and authority declarations |

## Business and governance rules

- Repository-local legal artifacts remain authoritative for license terms.
- Released artifacts and verified publication records take precedence over stale narrative checkboxes or matrices.
- Human operators retain fiscal and business decision authority.
- Documentation must not promote advisory AI or memory into fiscal evidence or authorization.
- Cross-repository governance claims require a named owner and explicit approval.
- Unresolved decisions remain visibly unresolved; absence of a decision is not permission to infer one.
- Corrections must preserve historical changelogs and decision history rather than rewriting past states.

## Non-goals

- No product code, runtime behavior, API, contract, data schema, persistence, or migration changes.
- No license change; only correction of documentation that misstates an existing license.
- No silent selection of the FEOS relationship or ledger boundary model.
- No transfer of fiscal decision authority from humans to Drenyra AI, agents, or Engram.
- No declaration that Dominion owns product-local facts already governed by legal files, releases, or implemented behavior.
- No cleanup of unrelated documentation, historical artifacts, or repository-wide wording.
- No implementation of a new business ledger, audit ledger, memory store, synchronization layer, or cross-repository automation.

## Acceptance outcomes

The remediation is complete when:

- Dominion contains one reviewable program record covering every audited inconsistency, owner, status, evidence source, and affected repository.
- Command Center no longer claims MIT when its proprietary license is authoritative.
- Engram's publication/license wording agrees across Command Center, Engram, Drenyra AI, and the capability matrix without conflating software openness with data privacy.
- Drenyra AI 0.2.1 metadata agrees with the released artifact, changelog, README, and capability matrix.
- Drenyra Pi and Engram publication checkboxes match verifiable publication evidence.
- Public wording consistently distinguishes human fiscal decisions from Drenyra AI's deterministic execution authority.
- FEOS, ledger boundaries, ecosystem membership, and maturity are either explicitly owner-approved and consistently propagated or clearly marked unresolved everywhere they are mentioned.
- No product/code diff, normative contract change, historical rewrite, or unapproved governance conclusion is included.
- Each work unit has repository-specific readback evidence and an independent rollback boundary.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| A wording correction accidentally changes governance | High | Separate evidence-backed corrections from owner-approved decisions; block propagation of unresolved claims |
| Ledger terminology creates a false authority model | High | Require explicit definitions and owner approval; prohibit inferred or overloaded ledger wording |
| Public text implies autonomous fiscal decisions | High | Use the human-decision/deterministic-execution boundary consistently and review it as its own work unit |
| License or openness wording creates legal/privacy confusion | High | Cite authoritative licenses and distinguish software licensing from data handling and deployment privacy |
| Dominion becomes an unbounded source of truth | Medium | Limit it to program coordination; preserve product-local legal, release, and behavior authorities |
| Cross-repository changes become hard to review or roll back | Medium | Deliver independent repository-scoped work units under the 400-line budget with explicit evidence and rollback |
| Maturity labels become stale again | Medium | Require one approved vocabulary and evidence date/source in the program record |

## Rollback

Rollback occurs per work unit and per repository. Evidence-backed wording corrections can be reverted independently. Governance propagation can be reverted without deleting the approved decision record; incorrect decisions must be superseded with a new dated decision rather than rewritten. No rollback requires product code changes, data migration, ledger mutation, or deletion of historical release evidence.

## Success criteria

- Reviewers can trace every corrected statement to authoritative evidence or an explicit owner-approved decision.
- All audited contradictions are corrected or visibly tracked as unresolved with an owner and next decision point.
- The FEOS and ledger models remain undecided until owners confirm them.
- The final ecosystem wording is coherent across repositories while preserving human fiscal authority and product-local sources of truth.
- Work remains divided into independent, reversible review units within the 400-line review budget.
