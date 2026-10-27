# Feature: ecosystem-coherence

**Objective:** make every repository state the same facts as the Drenyra Dominion program master (license, Engram status, publication evidence, the human-decision/deterministic-execution boundary), and hold the four governance decisions until the owner decides them.
**Origin:** migrated verbatim from `openspec/changes/ecosystem-coherence/tasks.md` by `odd/tasks/sdd-to-odd-migration.md`. The program record is `program/drenyra-dominion/ecosystem-coherence.md`.

## Specs

- Requirements of record: [`specs/ecosystem-coherence/spec.md`](../../specs/ecosystem-coherence/spec.md).

## Tasks

Open items carried over verbatim (the original numbering and `sdd-owner` markers are kept as provenance). The checked items stay in git history at `b8964e9`.

- [ ] Correct documentation that claims MIT or misstates Engram as private, so stated license matches the repository's authoritative `LICENSE` and Engram is described per its Apache-2.0/open declarations, keeping software openness and data privacy as distinct claims and preserving any separately documented data-privacy guarantees. <!-- sdd-owner: implementation -->
  - **Allowed paths:** README and policy/architecture docs only; narrow discovery target `README.md`, `docs/` (confirm exact policy doc that describes Engram before editing; do not broaden scope). Never touch `LICENSE`.
  - **Evidence:** the repo's authoritative `LICENSE` file; Engram's license and the consistent Apache-2.0/open declarations in `drenyra-engram`, `drenyra-ai` README, and `capability-matrix.yaml`.
  - **Rollback boundary:** revert only the corrected wording; `LICENSE` unchanged.
  - **Expected authored lines:** 20–80.
- [ ] Update the stale roadmap publication checkbox only where verifiable release/publication evidence exists; leave unverifiable items unchecked and unresolved. <!-- sdd-owner: implementation -->
  - **Allowed paths:** `ROADMAP.md` (publication marker only).
  - **Evidence:** verifiable release/publication record; if none exists, do not mark published.
  - **Rollback boundary:** revert only the marker.
  - **Expected authored lines:** 5–30.
- [ ] Update the stale roadmap publication checkbox only where verifiable release/publication evidence exists; leave unverifiable items unchecked and unresolved. <!-- sdd-owner: implementation -->
  - **Allowed paths:** `ROADMAP.md` (publication marker only).
  - **Evidence:** verifiable release/publication record; if none exists, do not mark published.
  - **Rollback boundary:** revert only the marker.
  - **Expected authored lines:** 5–30.
- [ ] Apply the same human-decision/deterministic-execution boundary wording in each owning repository (`drenyra-command-center`, `drenyra-pi`, `drenyra-engram`) only where public wording currently conflates authority; one repository per work unit, narrow allowed paths, each under its effective budget. <!-- sdd-owner: implementation -->
  - **Allowed paths:** per-repository README/policy docs only; confirm each before editing.
  - **Evidence:** the same fiscal-authority domain source.
  - **Rollback boundary:** revert wording in each repository independently.
  - **Expected authored lines:** 10–40 per repository.
- [ ] **FEOS relationship:** record and hold the neutral question, owner, and next decision point; accept an approval only when the exact declaration, owner, scope, and durable approval evidence are recorded. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] **Ledger boundary model:** record and hold the business/fiscal ledger of record, append-only audit ledger/receipts, and Engram memory boundaries as unresolved; block any settled wording or propagation. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] **Canonical membership roster:** record and hold the project roster as unresolved; do not propagate any membership label. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] **Canonical maturity vocabulary/labels:** record and hold the maturity vocabulary and current labels as unresolved; do not propagate any maturity label. Blocked until owner approves. <!-- sdd-owner: parent -->
- [ ] For each approved governance decision (FEOS, ledger, membership, maturity), plan one repository-scoped propagation work unit per affected repository in the program record's propagation/readback log, each referencing its decision ID, its narrow allowed-path allowlist, its source/decision reference, and its independent rollback boundary. Mark all `blocked` pending approval. <!-- sdd-owner: parent -->
  - **Rollback boundary:** revert the repository projection while retaining the approved decision record; supersede (never delete) a changed decision.
- [ ] For every implemented correction (W2, W3a–W3c, W4): reopen each changed file, record the resulting statement and target paths in the program record, confirm the authoritative source itself was not changed, and confirm changed paths match the allowlist and the diff is documentation-only within the effective budget. <!-- sdd-owner: implementation -->
- [ ] Cross-repository comparison: compare each propagated/corrected statement to the same frozen source or exact approved declaration and record agreement (meaning, not mere file presence) in the program record. <!-- sdd-owner: implementation -->
- [ ] Update the Dominion record for each delivered unit with its delivery reference, changed-line count, local readback, and comparison evidence. Mark an inventory item `complete` only after every required target has readback evidence; otherwise keep it in `readback_pending` or `in_progress`. <!-- sdd-owner: implementation -->
- [ ] Confirm no license file, product code, runtime contract, schema, migration, ledger content, archived change, historical record, or excluded active-change artifact (including the unrelated `fiscal-authority-kernel` verification report) was changed. <!-- sdd-owner: implementation -->
- [ ] Start or reuse bounded review per delivered PR; confirm each PR stays within its effective budget (300 in `drenyra-ai`, else `min(400, local)`), and record the receipt. <!-- sdd-owner: parent -->
- [ ] Confirm no owner-decision-gated item (Group 3) or blocked propagation (Group 4) was marked ready or delivered before owner approval is recorded in the decision register. <!-- sdd-owner: parent -->

## Log

### L1 — 2026-10-27 — migration

Moved from OpenSpec to ODD. Under ODD the `sdd-owner: parent` review and receipt items mean bounded review on each delivered PR, and the owner-gated decisions (FEOS, ledger boundary model, membership roster, maturity vocabulary) stay blocked until the owner records each one.
