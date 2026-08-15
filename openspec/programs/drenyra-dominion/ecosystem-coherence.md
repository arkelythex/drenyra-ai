# Ecosystem Coherence — Drenyra Dominion Program Record

> Program-master record for the Drenyra ecosystem coherence remediation. It
> coordinates the cross-repository inconsistency inventory, evidence, owners,
> blocked governance decisions, work units, propagation, and readback.
>
> This record is the **program master, not the source of truth** for product-local
> facts. Product repositories remain authoritative for their own licenses,
> released artifacts, and implemented behavior; only explicit owner-approved
> declarations govern cross-product governance claims. Existing Dominion prose is
> a claim to reconcile, never an approval.

## Record metadata

| Field | Value |
| --- | --- |
| `record_id` | `dominion-ecosystem-coherence` |
| `scope` | Drenyra ecosystem repositories and audited documentation surfaces: `drenyra-ai`, `drenyra-command-center`, `drenyra-pi`, `drenyra-engram`, plus shared program documents (`capability-matrix.yaml`, Dominion docs). |
| `record_owner` | Drenyra Dominion program maintainer (role) |
| `last_reviewed` | 2026-08-14 |
| `status` | `open` — derived from item states below; this is not an independent claim of approval and must not be read as one. |
| `non_goals` | No product code, runtime behavior, APIs, contracts, data schemas, persistence, migrations, ledger contents, licenses, historical artifacts, or new cross-repository automation is in scope. This record coordinates remediation workflow state only. |

## Issue inventory

> One stable row per audited inconsistency. **Fail-closed:** no row is `complete` —
> no remediation readback has been performed yet. Governance rows are
> `blocked_owner_decision` until a named owner approves an exact declaration.
> Fields follow the ecosystem-coherence design ("Issue inventory fields").

| `issue_id` | `claim_class` | `authoritative_domain` | `observed_conflict` | `affected_repositories` | `authoritative_source` | `evidence_refs` | `accountable_owner` | `status` | `decision_state` | `decision_ref` | `next_decision_point` | `dependency_ids` | `work_unit_ids` | `rollback_boundary` | `completion_evidence` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EC-001 | product_fact | license | Drenyra Command Center README claims MIT while its `LICENSE` is proprietary | `drenyra-command-center` | `drenyra-command-center/LICENSE` (proprietary) | proposal.md §Current-state gap; capability-matrix.yaml (command-center license) | Drenyra Dominion program maintainer | evidence_ready | not_required | N/A | Deliver W2 license wording correction and record readback | W1 | W2 | Revert only W2 wording; `LICENSE` untouched |  |
| EC-002 | product_fact | release/publication | Command Center policy describes Engram as private while Engram, Drenyra AI, and the capability matrix describe it as Apache-2.0/open | `drenyra-command-center` (wording); `drenyra-engram`, `drenyra-ai`, capability-matrix (declarations) | `drenyra-engram/LICENSE` (Apache-2.0) | proposal.md §Current-state gap; capability-matrix.yaml (engram license) | Drenyra Dominion program maintainer | evidence_ready | not_required | N/A | Deliver W2 Engram publication wording correction, keep openness/privacy distinct, record readback | W1 | W2 | Revert only W2 wording; separately documented privacy guarantees preserved |  |
| EC-003 | governance_decision | FEOS | Program authority and the FEOS relationship are undocumented; no owner-approved declaration exists | `drenyra-ai` (Dominion docs); any ecosystem doc mentioning FEOS | pending — no approved declaration exists | proposal.md §Scope B.1; design.md §Blocked-decision workflow; gate-0.md | Drenyra product owner (role) | blocked_owner_decision | unresolved |  | Owner approval of exact FEOS declaration, owner, scope, and durable approval reference (DEC-FEOS) | DEC-FEOS | W6-FEOS propagation (blocked; not created until approval) | Supersede or withdraw via retained later record; no propagation started |  |
| EC-004 | governance_decision | ledger | Command Center, Drenyra AI, and Engram do not share one approved declaration of ledger-of-record, append-only audit ledger/receipts, and Engram memory boundaries | `drenyra-ai`, `drenyra-command-center`, `drenyra-engram` | pending — no approved declaration exists | proposal.md §Scope B.2; design.md §Blocked-decision workflow | Drenyra product owner (role) | blocked_owner_decision | unresolved |  | Owner approval of exact ledger boundary declaration (DEC-LEDGER) | DEC-LEDGER | W6-LEDGER propagation (blocked; not created until approval) | Supersede or withdraw via retained later record; no propagation started |  |
| EC-005 | governance_decision | membership | Canonical ecosystem membership roster and labels differ across repositories | `drenyra-ai`, `drenyra-command-center`, `drenyra-pi`, `drenyra-engram`, `drenyra-skills`, `drenyra-guardian-angel` | pending — no approved declaration exists | proposal.md §Scope B.3; design.md §Blocked-decision workflow | Drenyra product owner (role) | blocked_owner_decision | unresolved |  | Owner approval of exact membership roster and labels (DEC-MEMBERSHIP) | DEC-MEMBERSHIP | W6-MEMBERSHIP propagation (blocked; not created until approval) | Supersede or withdraw via retained later record; no propagation started |  |
| EC-006 | governance_decision | maturity | Canonical maturity vocabulary and current labels differ across repositories | all ecosystem repositories + capability matrix | pending — no approved declaration exists | proposal.md §Scope B.3; design.md §Blocked-decision workflow | Drenyra product owner (role) | blocked_owner_decision | unresolved |  | Owner approval of exact maturity vocabulary and labels (DEC-MATURITY) | DEC-MATURITY | W6-MATURITY propagation (blocked; not created until approval) | Supersede or withdraw via retained later record; no propagation started |  |
| EC-007 | product_fact | release/publication | Drenyra AI 0.2.1 package metadata drifts from its changelog, README, and capability matrix | `drenyra-ai` (`package.json`, `CHANGELOG.md`, `README.md`, capability-matrix.yaml) | released 0.2.1 artifact (packed/installed artifact or registry record) | proposal.md §Scope A.3; capability-matrix.yaml (drenyra-ai entry) | Drenyra Dominion program maintainer | evidence_ready | not_required | N/A | Reconcile 0.2.1 metadata narrative against the released artifact and record readback | W1 | W3a | Revert W3a narrative correction; historical changelog entries intact |  |
| EC-008 | product_fact | release/publication | Drenyra Pi and Engram roadmap publication checkboxes are stale; verifiable publication evidence not yet confirmed | `drenyra-pi` (`ROADMAP.md`), `drenyra-engram` (`ROADMAP.md`) | verifiable release/publication record per repository (to be confirmed) | proposal.md §Scope A.4; gate-0.md §4 | Drenyra Dominion program maintainer | identified | not_required | N/A | Verify publication evidence per repository; mark published only where evidence exists; record readback | W1 | W3b (pi), W3c (engram) | Revert only the publication markers, independently per repository |  |
| EC-009 | product_fact | fiscal-authority wording | Public wording can conflate Drenyra AI execution authority with human fiscal decision authority | `drenyra-ai`, `drenyra-command-center`, `drenyra-pi`, `drenyra-engram` | business rule: humans retain fiscal and business decision authority; Drenyra AI executes deterministic, policy-constrained operations and records evidence | proposal.md §Business and governance rules; design.md §Authoritative-source precedence | Drenyra Dominion program maintainer | evidence_ready | not_required | N/A | Deliver W4/W4b wording corrections and record readback | W1 | W4 (drenyra-ai), W4b-cc, W4b-pi, W4b-engram (conditional) | Revert wording only; runtime and authority mechanisms untouched |  |

## Decision register

> Four independent governance questions. Each stays `unresolved` until a named
> owner approves an exact declaration with durable evidence; approval of one
> decision does not unblock another. `candidate_declaration` and `approval_ref`
> are intentionally blank — no declaration is authored by inference from existing
> prose, repetition, or historical cleanup. An approval is valid for propagation
> only when owner, exact declaration, scope, and durable approval reference are
> all present.

| `decision_id` | `question` | `owner` | `state` | `next_decision_point` | `candidate_declaration` | `approval_ref` | `approval_scope` | `approved_at` | `supersedes` | `propagation_work_units` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-FEOS | What is FEOS within the Drenyra ecosystem — product, operating model, governing program, peer system, or another relationship — and which source is authoritative for that determination? | Drenyra product owner (role) | unresolved | Owner review and explicit approval with exact declaration, scope, and durable approval reference; no fabricated date or outcome | — | — | — | — | — | none created; W6-FEOS blocked until approval |
| DEC-LEDGER | Which system is the business or fiscal ledger of record; which component owns the append-only audit ledger and receipts; and what may Engram memory retain — and what must it never authorize, evidence, or replace? | Drenyra product owner (role) | unresolved | Owner review and explicit approval with exact declaration, scope, and durable approval reference; no fabricated date or outcome | — | — | — | — | — | none created; W6-LEDGER blocked until approval |
| DEC-MEMBERSHIP | What is the canonical Drenyra ecosystem project roster, and which repositories are members? | Drenyra product owner (role) | unresolved | Owner review and explicit approval with exact declaration, scope, and durable approval reference; no fabricated date or outcome | — | — | — | — | — | none created; W6-MEMBERSHIP blocked until approval |
| DEC-MATURITY | What is the canonical maturity vocabulary and the current label for every ecosystem member? | Drenyra product owner (role) | unresolved | Owner review and explicit approval with exact declaration, scope, and durable approval reference; no fabricated date or outcome | — | — | — | — | — | none created; W6-MATURITY blocked until approval |

A later owner decision is appended as a superseding entry naming the superseded
decision; prior text and evidence are retained (append-only). A missing response,
informal discussion, stale document, or majority of existing wording is **not**
approval.

## Propagation and readback log

> Work units are repository-scoped: no unit spans repositories. Readback is
> evidence, not automation. No work unit is `complete` until every affected
> target has repository-specific readback evidence recorded below.

### Work-unit plan

| `work_unit_id` | `owning_repository` | `objective` | `dependency_ids` | `status` | `delivery_ref` | `changed_lines` | `rollback_boundary` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | `drenyra-ai` | Create this program record, its index link, and perform structural readback | — | readback_pending |  |  | Remove only this new record and its index link |
| W2 | `drenyra-command-center` | Correct license wording (EC-001) and Engram publication wording (EC-002) | W1 | planned |  |  | Revert only corrected wording; never touch `LICENSE` or privacy guarantees |
| W3a | `drenyra-ai` | Reconcile 0.2.1 release metadata narrative (EC-007) | W1 | planned |  |  | Revert current narrative correction; historical changelog entries intact |
| W3b | `drenyra-pi` | Update roadmap publication marker only where verifiable evidence exists (EC-008) | W1 | planned |  |  | Revert only the publication marker |
| W3c | `drenyra-engram` | Update roadmap publication marker only where verifiable evidence exists (EC-008) | W1 | planned |  |  | Revert only the publication marker |
| W4 | `drenyra-ai` | Human fiscal-authority wording boundary (EC-009) | W1 | planned |  |  | Revert wording only; runtime and authority mechanisms untouched |
| W4b-cc / W4b-pi / W4b-engram | per owning repository | Same fiscal-authority boundary wording where conflation exists (EC-009, conditional) | W1 | planned |  |  | Revert wording in each repository independently |
| W5a–W5d | `drenyra-ai` (Dominion) | Recorded blocked decision entries DEC-FEOS / DEC-LEDGER / DEC-MEMBERSHIP / DEC-MATURITY | W1 | blocked — pending owner approval |  |  | Supersede or withdraw via retained later record; never rewrite history |
| W6 | per approved decision × per affected repository | Propagate one approved governance declaration and cross-check readback | matching W5 approval | blocked — not created until approval |  |  | Revert the repository projection while retaining the approved decision record |

### Readback log

| Work unit | Status | Readback evidence | Delivery reference |
| --- | --- | --- | --- |
| W1 | readback in progress (W1.4) | Structural readback performed as part of W1.4: four sections present, all inventory/decision fields present, four independent blocked decisions, no `complete` row, diff restricted to the two allowed paths |  |
| W2, W3a, W3b, W3c, W4, W4b | pending | No readback recorded yet; recorded here after each unit's delivery and local/cross-repository comparison |  |
| W5a–W5d, W6 | pending | No readback recorded yet; gated on owner approval |  |
