# Tasks — Ecosystem Coherence

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–850 across all repositories |
| 400-line budget risk | High (aggregate), Low (per repository/PR) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Dominion record) → PR 2 (Command Center) → PR 3 (Drenyra AI release facts) → PR 4 (Pi roadmap) → PR 5 (Engram roadmap) → PR 6 (fiscal-authority wording) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low
```

**Budget note (binding):** `openspec/config.yaml` sets `review_budget_lines: 300`. The design mandates the stricter applicable limit: within `drenyra-ai`, stop and split before 300 authored additions plus deletions; in another repository use `min(400, that repository's local configured limit)`. W1, W3a, and W6-drenyra-ai units each live in `drenyra-ai` and are budgeted to stay under 300. Every other unit is a separate repository PR and stays under 400. The aggregate exceeds any single PR; do **not** combine repositories into one PR.

**Owner-decision gate:** The four governance decisions (FEOS, ledger, membership, maturity) and all W6 propagation units depend on explicit owner approval. They are **blocked** and must **not** be marked ready or implemented in this change. Only their blocked record entries (created in W1) are in scope. No downstream propagation may begin until the matching approval is recorded.

---

## Group 1 — Dominion program record (W1) in `drenyra-ai`

> Repository: `drenyra-ai` (path: `openspec/programs/drenyra-dominion/`). Budget: keep under 300 authored lines; split into two commits if W1 approaches 300.

### W1.1 — Create the ecosystem coherence program-master record
- [x] Create `openspec/programs/drenyra-dominion/ecosystem-coherence.md` containing the four required sections (record metadata, issue inventory, decision register, propagation/readback log). <!-- sdd-owner: implementation -->
  - **Allowed paths:** `openspec/programs/drenyra-dominion/ecosystem-coherence.md` (new file only).
  - **Evidence:** the audit inconsistencies enumerated in the proposal; `openspec/programs/drenyra-dominion/capability-matrix.yaml` for per-repo status; `openspec/programs/drenyra-dominion/gate-0.md` for program state. Treat all existing Dominion prose as claims to reconcile, not approval.
  - **Record metadata:** `record_id`, `scope`, `record_owner`, `last_reviewed`, derived `status` (`open`, not `complete`), and `non_goals` reminder.
  - **Issue inventory:** one stable row per audited inconsistency (`product_fact` or `governance_decision`). Required fields per design: `issue_id`, `claim_class`, `observed_conflict`, `affected_repositories`, `authoritative_domain`, `authoritative_source`, `evidence_refs`, `accountable_owner`, `status`, `decision_state`, `decision_ref`, `next_decision_point`, `dependency_ids`, `work_unit_ids`, `rollback_boundary`, `completion_evidence`. Fail-closed: no row may be `complete` (readback not yet performed).
  - **Rollback boundary:** remove only this new file.
  - **Expected authored lines:** 150–240.

### W1.2 — Add the four blocked decision-register entries
- [x] In the same `ecosystem-coherence.md` decision register, add four independent entries — FEOS relationship, ledger boundary model, canonical membership, canonical maturity — each with `question` (no proposed answer), `owner`, `state: unresolved`, `next_decision_point`, blank `candidate_declaration`, blank `approval_ref`. <!-- sdd-owner: implementation -->
  - **Allowed paths:** same file as W1.1 only.
  - **Evidence:** design "Blocked-decision workflow"; the four questions start `unresolved`/`blocked_owner_decision` unless a verified approval reference already exists.
  - **Rollback boundary:** remove the four decision rows (all part of W1).
  - **Expected authored lines:** 40–80.
  - **Note:** these entries are records of blocked decisions. They are NOT ready-to-propagate; no declaration is authored.

### W1.3 — Link the record from the Dominion index
- [x] Add one index link row/entry to `openspec/programs/drenyra-dominion/README.md` pointing to `ecosystem-coherence.md`. <!-- sdd-owner: implementation -->
  - **Allowed paths:** `openspec/programs/drenyra-dominion/README.md` (index link only; do not rewrite program prose).
  - **Evidence:** design "Planned documentation surface" — record linked from Dominion index.
  - **Rollback boundary:** revert only the added link row.
  - **Expected authored lines:** 2–5.

### W1.4 — W1 verification (structural readback)
- [x] Verify the W1 record contains every audited inconsistency and all required inventory/decision fields; confirm FEOS, ledger, membership, and maturity are independent blocked entries; confirm no row is `complete` and no unresolved matter is presented as settled. Confirm only the two allowed `drenyra-ai` paths changed. <!-- sdd-owner: implementation -->
  - **Evidence:** re-read the created file and README index row; `git diff --name-only` shows only the two allowed paths; authored additions + deletions < 300.
  - **Rollback boundary:** revert W1.1–W1.3 together (single work unit).
  - **Expected authored lines:** 0 (verification only).

---

## Group 2 — Evidence-backed documentation corrections (W2, W3a–W3c, W4)

> Each is a separate repository PR, independent and rollback-isolated. No unit touches license/legal files, product code, runtime contracts, schemas, migrations, archived changes, or the unrelated `fiscal-authority-kernel` verification report.

### W2 — Command Center license + Engram publication wording (repo: `drenyra-command-center`)
- [ ] Correct documentation that claims MIT or misstates Engram as private, so stated license matches the repository's authoritative `LICENSE` and Engram is described per its Apache-2.0/open declarations, keeping software openness and data privacy as distinct claims and preserving any separately documented data-privacy guarantees. <!-- sdd-owner: implementation -->
  - **Allowed paths:** README and policy/architecture docs only; narrow discovery target `README.md`, `docs/` (confirm exact policy doc that describes Engram before editing; do not broaden scope). Never touch `LICENSE`.
  - **Evidence:** the repo's authoritative `LICENSE` file; Engram's license and the consistent Apache-2.0/open declarations in `drenyra-engram`, `drenyra-ai` README, and `capability-matrix.yaml`.
  - **Rollback boundary:** revert only the corrected wording; `LICENSE` unchanged.
  - **Expected authored lines:** 20–80.

### W3a — Drenyra AI 0.2.1 release metadata narrative (repo: `drenyra-ai`, budget < 300)
- [ ] Reconcile 0.2.1 package metadata, changelog, README, and capability-matrix entry so they agree with the released artifact, citing it as evidence; do not rewrite historical changelog entries. <!-- sdd-owner: implementation -->
  - **Allowed paths:** `package.json` (version/metadata fields only), `CHANGELOG.md` (current 0.2.1 section narrative only, historical entries intact), `README.md` (release facts only), `openspec/programs/drenyra-dominion/capability-matrix.yaml` (drenyra-ai version/entry only).
  - **Evidence:** the released 0.2.1 artifact (packed/installed artifact or registry record) is authoritative.
  - **Rollback boundary:** revert the metadata narrative changes independently of any other unit.
  - **Expected authored lines:** 20–80.
  - **Note:** distinct PR from W1 (same repo, different allowlist and budget pool); do not combine with W1.

### W3b — Pi roadmap publication marker (repo: `drenyra-pi`)
- [ ] Update the stale roadmap publication checkbox only where verifiable release/publication evidence exists; leave unverifiable items unchecked and unresolved. <!-- sdd-owner: implementation -->
  - **Allowed paths:** `ROADMAP.md` (publication marker only).
  - **Evidence:** verifiable release/publication record; if none exists, do not mark published.
  - **Rollback boundary:** revert only the marker.
  - **Expected authored lines:** 5–30.

### W3c — Engram roadmap publication marker (repo: `drenyra-engram`)
- [ ] Update the stale roadmap publication checkbox only where verifiable release/publication evidence exists; leave unverifiable items unchecked and unresolved. <!-- sdd-owner: implementation -->
  - **Allowed paths:** `ROADMAP.md` (publication marker only).
  - **Evidence:** verifiable release/publication record; if none exists, do not mark published.
  - **Rollback boundary:** revert only the marker.
  - **Expected authored lines:** 5–30.

### W4 — Human fiscal-authority wording (one unit per owning repository)
- [ ] In `drenyra-ai` (`README.md`, `docs/governance.md` or equivalent governance/authority docs), state consistently that humans retain fiscal and business decision authority while Drenyra AI executes deterministic, policy-constrained operations and records evidence; remove any implication of autonomous business or legal judgment; do not promote advisory AI or memory into fiscal evidence or authorization. <!-- sdd-owner: implementation -->
  - **Allowed paths:** README + governance/authority documentation only; narrow discovery target before editing.
  - **Evidence:** design "Authoritative-source precedence" (fiscal-authority wording domain) and proposal business rules.
  - **Rollback boundary:** revert wording only; runtime and authority mechanisms untouched.
  - **Expected authored lines:** 20–80 (in `drenyra-ai` keep under the 300 budget combined with W1/W3a if delivered separately).

### W4b — Human fiscal-authority wording in Command Center, Pi, Engram (conditional)
- [ ] Apply the same human-decision/deterministic-execution boundary wording in each owning repository (`drenyra-command-center`, `drenyra-pi`, `drenyra-engram`) only where public wording currently conflates authority; one repository per work unit, narrow allowed paths, each under its effective budget. <!-- sdd-owner: implementation -->
  - **Allowed paths:** per-repository README/policy docs only; confirm each before editing.
  - **Evidence:** the same fiscal-authority domain source.
  - **Rollback boundary:** revert wording in each repository independently.
  - **Expected authored lines:** 10–40 per repository.

---

## Group 3 — Owner-decision gates (W5a–W5d) — BLOCKED, not ready

> These are governance decisions requiring explicit owner approval. The blocked record entries were created in W1.2. No implementation may proceed; no declaration may be authored by inference. These items are parent-gated and MUST NOT be marked ready or implemented.

- [ ] **FEOS relationship:** record and hold the neutral question, owner, and next decision point; accept an approval only when the exact declaration, owner, scope, and durable approval evidence are recorded. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] **Ledger boundary model:** record and hold the business/fiscal ledger of record, append-only audit ledger/receipts, and Engram memory boundaries as unresolved; block any settled wording or propagation. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] **Canonical membership roster:** record and hold the project roster as unresolved; do not propagate any membership label. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] **Canonical maturity vocabulary/labels:** record and hold the maturity vocabulary and current labels as unresolved; do not propagate any maturity label. Blocked until owner approves. <!-- sdd-owner: parent -->

**Gate rule:** an approval is valid for propagation only when owner, exact declaration, scope, and a durable approval reference are all present. Missing response, informal discussion, stale documents, or majority of existing wording is not approval. A later decision is appended as a superseding entry; prior text and evidence are retained (append-only).

---

## Group 4 — Declaration propagation (W6) — BLOCKED until matching approval

> These units are created as `blocked` references to the matching decision ID and are NOT ready to implement. Do not create W6 delivery until the corresponding W5 decision is approved.

- [ ] For each approved governance decision (FEOS, ledger, membership, maturity), plan one repository-scoped propagation work unit per affected repository in the program record's propagation/readback log, each referencing its decision ID, its narrow allowed-path allowlist, its source/decision reference, and its independent rollback boundary. Mark all `blocked` pending approval. <!-- sdd-owner: parent -->
  - **Rollback boundary:** revert the repository projection while retaining the approved decision record; supersede (never delete) a changed decision.

---

## Group 5 — Readback and verification (per work unit)

- [ ] For every implemented correction (W2, W3a–W3c, W4): reopen each changed file, record the resulting statement and target paths in the program record, confirm the authoritative source itself was not changed, and confirm changed paths match the allowlist and the diff is documentation-only within the effective budget. <!-- sdd-owner: implementation -->
- [ ] Cross-repository comparison: compare each propagated/corrected statement to the same frozen source or exact approved declaration and record agreement (meaning, not mere file presence) in the program record. <!-- sdd-owner: implementation -->
- [ ] Update the Dominion record for each delivered unit with its delivery reference, changed-line count, local readback, and comparison evidence. Mark an inventory item `complete` only after every required target has readback evidence; otherwise keep it in `readback_pending` or `in_progress`. <!-- sdd-owner: implementation -->
- [ ] Confirm no license file, product code, runtime contract, schema, migration, ledger content, archived change, historical record, or excluded active-change artifact (including the unrelated `fiscal-authority-kernel` verification report) was changed. <!-- sdd-owner: implementation -->

---

## Post-apply lifecycle gates (parent)

- [ ] Start or reuse bounded review per delivered PR; confirm each PR stays within its effective budget (300 in `drenyra-ai`, else `min(400, local)`), and record the receipt. <!-- sdd-owner: parent -->
- [ ] Confirm no owner-decision-gated item (Group 3) or blocked propagation (Group 4) was marked ready or delivered before owner approval is recorded in the decision register. <!-- sdd-owner: parent -->
