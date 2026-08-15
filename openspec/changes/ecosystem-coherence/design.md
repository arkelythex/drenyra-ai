# Ecosystem Coherence Design

## Decision summary

The remediation will use one documentation-only ecosystem coherence record under Drenyra Dominion to coordinate discrepancies, evidence, owners, blocked decisions, repository-scoped work units, propagation, readback, and rollback. Dominion coordinates the program but does not replace product-local authorities: legal artifacts govern licenses, released artifacts and verified publication records govern release facts, implemented behavior remains owned by its product repository, and only explicit owner-approved declarations govern cross-product governance claims.

The record must keep evidence-backed corrections separate from four blocked governance decisions: FEOS relationship, ledger boundaries, ecosystem membership, and maturity. No downstream propagation may begin for one of those matters until its approval is recorded.

## Scope and constraints

This design covers governance and documentation remediation only. It introduces no product behavior, runtime automation, API, contract, license, schema, persistence, migration, ledger mutation, or authority transfer.

The existing Dominion material remains context, not permission to settle an audited contradiction. In particular, existing authority or ledger language must be treated as a claim to reconcile against the new record, not as implicit approval of FEOS, ledger, membership, or maturity decisions.

Related historical ecosystem cleanup is review context only. It must not be edited, folded into this change, or used to claim that this remediation is complete. Historical changelogs, archived changes, and decision records remain immutable.

## Planned documentation surface

| Repository / area | Planned responsibility | Boundary |
| --- | --- | --- |
| Drenyra Dominion in `drenyra-ai` | Add one ecosystem coherence program-master record and link it from the Dominion index | Coordinates evidence and delivery; does not become authority for product-local facts |
| Drenyra Command Center | Correct evidence-backed license and Engram publication wording; later propagate only approved governance declarations | Its `LICENSE` remains authoritative for license terms |
| Drenyra AI | Reconcile 0.2.1 narrative metadata and human-fiscal-authority wording; later propagate only approved declarations | Released artifacts and implemented behavior remain product-local authority |
| Drenyra Pi | Correct publication markers where evidence exists; later propagate approved membership/maturity wording | Unverifiable publication or maturity claims remain unresolved |
| Engram | Correct publication markers where evidence exists; later propagate approved memory-boundary wording | Software openness and data privacy remain separate claims |
| Capability matrix and shared ecosystem documents | Reflect verified product facts and approved cross-product declarations | They are projections, never the originating authority |

The intended Dominion record path is `openspec/programs/drenyra-dominion/ecosystem-coherence.md`, linked from `openspec/programs/drenyra-dominion/README.md`. Tasks may refine a product-local documentation path only after confirming that repository's existing structure; they must not broaden the content scope.

## Program-master record shape

The program record is a reviewable Markdown document with compact tables and append-only decision history. It contains four sections: record metadata, issue inventory, decision register, and propagation/readback log.

### Record metadata

| Field | Meaning |
| --- | --- |
| `record_id` | Stable identifier for this remediation program |
| `scope` | Ecosystem repositories and audited documentation surfaces covered |
| `record_owner` | Accountable maintainer for keeping the program record current |
| `last_reviewed` | Date on which record state and evidence links were read back |
| `status` | Overall derived state: open, blocked, propagating, complete, or superseded |
| `non_goals` | Explicit reminder that code, contracts, licenses, runtime behavior, and historical artifacts are excluded |

Overall status is derived from item states; it is not an independent claim of approval. `complete` is allowed only when every inventory item is either completed with readback evidence or intentionally superseded by a retained later record.

### Issue inventory fields

Each audited inconsistency receives one stable row. Multi-repository delivery is represented by linked repository-specific work units rather than one cross-repository edit unit.

| Field | Required content |
| --- | --- |
| `issue_id` | Stable, human-readable identifier |
| `claim_class` | `product_fact` or `governance_decision` |
| `observed_conflict` | Neutral description of the contradictory statements; no inferred resolution |
| `affected_repositories` | Every repository or shared document known to contain the claim |
| `authoritative_domain` | License, release/publication, implemented behavior, fiscal-authority wording, FEOS, ledger, membership, or maturity |
| `authoritative_source` | Link to the governing local evidence or approved decision; `pending` when no decision exists |
| `evidence_refs` | Links sufficient for a reviewer to reproduce the classification |
| `accountable_owner` | Named person or role responsible for evidence confirmation or decision |
| `status` | Inventory lifecycle state defined below |
| `decision_state` | `not_required`, `unresolved`, `approved`, or `superseded` |
| `decision_ref` | Approval or superseding decision reference; blank while unresolved |
| `next_decision_point` | Concrete owner action needed before an unresolved item can advance |
| `dependency_ids` | Items or decisions that must complete first |
| `work_unit_ids` | Repository-scoped remediation units generated from the item |
| `rollback_boundary` | Exact documentation declaration that can be reverted independently |
| `completion_evidence` | Repository-specific readback references; blank until verified |

Allowed inventory lifecycle states are `identified`, `evidence_ready`, `blocked_owner_decision`, `ready_to_propagate`, `in_progress`, `readback_pending`, `complete`, and `superseded`.

State semantics are fail-closed:

- `evidence_ready` requires a resolvable authoritative source.
- `blocked_owner_decision` prohibits settled wording and propagation.
- `ready_to_propagate` requires a valid approved decision reference for governance claims.
- `complete` requires all planned target repositories to have readback evidence.
- Missing owner, evidence, approval, target, or readback keeps the item out of `complete`.

### Decision register fields

Each governance question is a separate decision item so approval of one cannot accidentally unblock another.

| Field | Required content |
| --- | --- |
| `decision_id` | Stable identifier, separately assigned to FEOS, ledger, membership, and maturity |
| `question` | The exact unresolved governance question without a proposed answer |
| `owner` | Accountable owner authorized to approve the declaration |
| `state` | `unresolved`, `approved`, or `superseded` |
| `next_decision_point` | Required review, meeting, or owner action; no fabricated date or outcome |
| `candidate_declaration` | Blank until supplied by the owner; never authored by inference |
| `approval_ref` | Durable evidence of explicit owner approval |
| `approval_scope` | Repositories and declarations the approval governs |
| `approved_at` | Recorded approval date when evidence provides one |
| `supersedes` | Prior decision reference, if any |
| `propagation_work_units` | Repository-scoped units created only after approval |

An approval is valid for propagation only when owner, exact declaration, scope, and durable approval reference are all present. A later decision creates a new entry that names the superseded entry; prior text and evidence are retained.

### Work-unit and propagation fields

| Field | Required content |
| --- | --- |
| `work_unit_id` | Stable unit linked to one issue or one approved decision |
| `owning_repository` | Exactly one repository |
| `objective` | One evidence-backed correction or one approved declaration propagation |
| `allowed_paths` | Small documentation-only allowlist confirmed in that repository |
| `source_refs` | Product-local evidence or approved decision reference |
| `start_state` | Exact contradictory or unresolved wording before the edit |
| `finished_state` | Observable corrected wording expected after the edit |
| `dependency_ids` | Program items that must already be ready |
| `status` | `planned`, `blocked`, `in_progress`, `readback_pending`, `complete`, or `reverted` |
| `readback` | File/section references and observed post-change statement |
| `rollback_boundary` | Exact files and wording removable without reverting another work unit |
| `delivery_ref` | PR or commit reference after delivery |
| `changed_lines` | Authored additions plus deletions for budget enforcement |

No work unit spans repositories. If one repository contains unrelated claims, use separate work units when independent review or rollback would be clearer. Documentation evidence travels with the work unit that depends on it.

## Authoritative-source precedence

Precedence is domain-specific; Dominion does not create a universal hierarchy that overrides local authority.

1. **License terms:** the repository-local legal artifact, normally `LICENSE`, governs. README, policy, matrices, and Dominion must point to it and must not reinterpret it.
2. **Release and publication facts:** immutable released artifacts and verifiable publication records govern. Current package metadata may describe the current package, but it cannot rewrite historical release evidence.
3. **Implemented behavior:** the owning repository's shipped implementation and its authoritative local contracts/tests govern factual behavior descriptions. This change does not modify or adjudicate that behavior.
4. **Cross-product governance:** an explicit owner-approved declaration with scope and approval evidence governs FEOS, ledger boundaries, membership, and maturity. Existing narrative repetition is not approval.
5. **Dominion program record:** coordinates conflicts, references the governing source, and tracks propagation/readback. It is authoritative only for remediation workflow state, not for the underlying product fact.
6. **Narrative projections:** READMEs, roadmaps, policies, capability matrices, and shared ecosystem summaries follow the applicable source above. Conflicting narrative text is corrected; it never wins by repetition or recency alone.

If two candidate sources in the same domain conflict or their authority is unclear, the item remains blocked and names the owner and next decision point. No maintainer may resolve that ambiguity through wording alone.

## Data flow

```text
Read-only audit finding
  -> Dominion issue inventory
  -> classify as product fact or governance decision
  -> resolve applicable authoritative source
     -> product fact with sufficient evidence
        -> repository-scoped correction work unit
     -> governance claim or ambiguous evidence
        -> blocked decision item + unresolved temporary wording
        -> explicit owner approval
        -> repository-scoped propagation work units
  -> per-repository documentation edit
  -> repository-local structural readback
  -> cross-repository comparison against source/decision
  -> completion evidence in Dominion
```

The flow is manual and review-driven. The design creates no synchronization service, bot, schema, or cross-repository runtime dependency.

## Blocked-decision workflow

The following four questions start independently in `unresolved` / `blocked_owner_decision` unless an explicit approval reference is already supplied and verified:

- FEOS relationship and its authoritative source.
- Business/fiscal ledger of record, append-only audit ledger/receipts, and Engram memory boundaries.
- Canonical ecosystem membership roster.
- Canonical maturity vocabulary and current labels.

For each question:

1. Record the neutral question, affected repositories, owner, and next decision point.
2. Keep candidate declaration and approval reference blank. Do not derive an answer from existing Dominion prose, repeated README language, architecture aspirations, or historical cleanup.
3. Mark every dependent propagation work unit `blocked` and reference the decision ID.
4. Where a touched document must mention the topic before approval, use explicit unresolved wording and avoid asserting hierarchy, ownership, ledger-of-record, membership, or maturity.
5. Accept an approval only when the exact declaration, owner, approval scope, and durable approval evidence are recorded.
6. Move only that decision's dependent units to `ready_to_propagate`; other blocked decisions remain blocked.
7. After propagation, compare every target statement with the approved declaration and record repository-specific readback.
8. If owners replace the decision, append a superseding decision and create new propagation units. Never overwrite the prior decision or its delivery evidence.

A missing response, informal discussion, stale document, or majority of existing wording is not approval.

## Work-unit and rollback design

| Unit | Delivery shape | Dependency | Rollback |
| --- | --- | --- | --- |
| W1 — Program inventory | Dominion record plus index link in `drenyra-ai` | None | Remove the new record and its index link only |
| W2 — License/publication facts | One Command Center documentation PR, split further if path review shows unrelated declarations | W1 | Revert only corrected wording; never touch legal artifacts |
| W3a — Drenyra AI release facts | One Drenyra AI documentation PR | W1 | Revert current narrative correction without rewriting historical changelog entries |
| W3b — Pi publication fact | One Drenyra Pi documentation PR, only with verified evidence | W1 | Revert only the publication marker |
| W3c — Engram publication fact | One Engram documentation PR, only with verified evidence | W1 | Revert only the publication marker |
| W4 — Human fiscal-authority wording | One work unit per owning repository and coherent statement | W1 | Revert wording only; runtime and authority mechanisms remain untouched |
| W5a–W5d — Owner decisions | Four independent Dominion decision entries: FEOS, ledger, membership, maturity | W1 | Supersede or withdraw by a retained later record; never rewrite history |
| W6 — Declaration propagation | One approved decision × one repository per work unit | Matching W5 decision approved | Revert the repository projection while retaining the approved decision record |

W2, W3a–W3c, and W4 may proceed independently when their local evidence is sufficient. W6 cannot start from draft, inferred, or partial approval.

## Propagation and readback procedure

1. **Freeze the source reference:** record the product-local evidence hash/reference or approved decision reference before editing a projection.
2. **Confirm the target allowlist:** list only the documentation files necessary for that repository-specific statement. Exclude code, contracts, licenses, generated artifacts, archives, unrelated active changes, and the unrelated fiscal-authority-kernel verification report.
3. **Apply one coherent wording unit:** update only the claim covered by the evidence or approval. Preserve history and adjacent privacy, legal, and authority qualifications.
4. **Local readback:** reopen every changed file, quote or reference the resulting statement, confirm links resolve in repository context, and verify the authoritative source itself was not changed.
5. **Diff readback:** confirm changed paths match the allowlist, the diff is documentation/declarative content only, and authored additions plus deletions stay within the effective budget.
6. **Cross-repository comparison:** compare each propagated statement to the same frozen source or exact approved declaration. Record agreement, not merely file presence.
7. **Update Dominion:** attach delivery reference, changed-line count, local readback, and comparison evidence. Mark `complete` only after every required target has passed readback.
8. **Handle mismatch:** return the affected work unit to `in_progress` or `blocked`; do not weaken the source declaration or mark partial propagation complete.

Readback is evidence, not automation. Links, exact statements, target paths, and delivery references provide reviewer-verifiable recognition rather than requiring reconstruction from memory.

## Verification strategy

Because the remediation is passive documentation, proportional verification is structural and evidentiary:

- Confirm the Dominion record contains every audited inconsistency and all required fields.
- Confirm FEOS, ledger, membership, and maturity each have an independent blocked decision entry until approved.
- Confirm every changed claim cites its applicable product-local evidence or approved decision.
- Confirm license files, product code, runtime contracts, schemas, migrations, ledger contents, archived changes, historical records, and excluded active-change artifacts are unchanged.
- Confirm openness wording does not imply undocumented privacy properties.
- Confirm fiscal-authority wording preserves human business/fiscal decisions and describes Drenyra AI only as deterministic, policy-constrained execution and evidence recording.
- Confirm each repository work unit has its own changed-path allowlist, readback, changed-line count, delivery reference, and rollback boundary.
- Confirm cross-repository wording agrees exactly in meaning with the frozen source or approved declaration.
- Confirm no unresolved claim is represented as settled and no incomplete propagation is marked complete.

No runtime test, build, typecheck, or migration is required for documentation-only units unless a touched repository's ordinary policy mandates one. Such a command is repository verification evidence, not justification to expand scope.

## Review workload forecast

| Work unit | Estimated authored changed lines per PR | 400-line risk | Delivery note |
| --- | ---: | --- | --- |
| W1 program record and index | 180–280 | Low | One cohesive coordination unit; split supporting material if it approaches the effective limit |
| W2 Command Center facts | 20–80 | Low | Keep legal/license and publication evidence together only if rollback remains coherent |
| W3a release metadata narrative | 20–80 | Low | Preserve historical entries |
| W3b/W3c roadmap markers | 5–30 each | Low | Separate repository PRs |
| W4 fiscal-authority wording | 20–80 per repository | Low | One repository per work unit |
| W5 decision entries | 15–40 per decision | Low | Independent entries; no invented declaration |
| W6 propagation | 10–60 per decision per repository | Low | Split by decision and repository |

The complete ecosystem effort is expected to exceed 400 lines across repositories, so it must not be delivered as one PR. Each PR remains repository-scoped and independently reversible.

The SDD proposal/spec use a 400 authored-line per-PR review budget, while `openspec/config.yaml` currently sets `review_budget_lines: 300` and instructs tasks to stay within 300. Until that policy discrepancy is explicitly reconciled, apply the stricter applicable limit:

- In `drenyra-ai`, stop and split before exceeding 300 authored additions plus deletions.
- In another repository, use `min(400, that repository's local configured limit)`.
- Never treat the 400-line forecast as permission to exceed a stricter local limit.
- Reconciliation of the config is outside this change and must not be bundled into remediation work.

## Rollout

1. Deliver W1 in Dominion and verify the complete inventory and four blocked decisions.
2. Deliver evidence-backed W2, W3a–W3c, and W4 units independently as evidence becomes sufficient.
3. Keep W5 decision items blocked until accountable owners provide exact declarations and approval evidence.
4. Create and deliver W6 units only for approved decisions, one decision and repository at a time.
5. Perform local and cross-repository readback, then update Dominion completion evidence.
6. Close the remediation only when every finding is corrected with evidence or remains visibly unresolved with an owner and next decision point.

Rollback follows the work-unit table. Governance propagation can be reverted without deleting its decision record; changed decisions are superseded rather than rewritten.

## Design decisions and rationale

| Decision | Rationale |
| --- | --- |
| One Dominion coherence record | Gives reviewers one inventory and evidence trail without copying product-local authority |
| Domain-specific source precedence | Avoids turning Dominion or narrative recency into an accidental universal source of truth |
| Separate inventory, decisions, work units, and readback | Prevents an issue being mistaken for approval or an edit being mistaken for verified completion |
| Four independent blocked decisions | Prevents approval of one governance matter from unblocking unrelated claims |
| One repository per work unit | Preserves ownership, reviewability, and independent rollback |
| Manual propagation with explicit readback | Meets coherence needs without inventing cross-repository automation |
| Append-only supersession | Preserves governance and historical auditability |
| Stricter budget wins | Resolves the current 400/300 discrepancy safely without changing repository policy in this change |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Existing Dominion prose is mistaken for owner approval | Treat it as a claim to reconcile; require exact approval evidence in the decision register |
| Dominion displaces product-local authority | Record source links and limit Dominion authority to remediation workflow state |
| Ledger terminology silently chooses a model | Keep the ledger decision blank and blocked until owners approve exact boundaries |
| Membership and maturity propagate from stale matrices | Require separate approvals and dated source/readback evidence |
| Historical ecosystem cleanup is accidentally modified | Keep it review-only and outside every changed-path allowlist |
| A repository correction exceeds review capacity | Enforce the stricter local/400 limit and split by repository or decision |
| Partial propagation appears complete | Require target-level readback for every affected repository before completion |
| Rollback erases governance history | Revert projections independently; supersede decision records instead of deleting them |
