# Tasks — Dominion Program Status Reconciliation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 480–630 total across all units; each W-unit < 300 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (W1) → PR 2 (W2) → PR 3 (W3) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low
```

**Forecast notes (read before apply):**

- Every W-unit is an independent, separately reviewable candidate with **fewer than 300 changed lines** (insertions + deletions), measured before review. The total across the change exceeds 400 lines, so units MUST be delivered as three chained PRs, never combined into one candidate. A single combined PR is prohibited.
- W-units depend in order W1 → W2 → W3 because composition and amendments consume the vocabulary established in W1. Each PR builds on the previous.
- **Chain strategy is `pending`**: the session delivery strategy is `auto-forecast` but no chain strategy was selected. Before `sdd-apply` runs, the orchestrator MUST resolve `stacked-to-main` vs `feature-branch-chain`. Do not start apply until this is resolved.
- This is a **docs-only administrative reconciliation**. No source code, tests, runtime behavior, frozen contract, product capability, `ecosystem-coherence` record, or protected path is edited.

---

## How to read this task list

- **Ownership markers**: every checkbox ends with exactly one terminal `<!-- sdd-owner: ... -->`. `implementation` covers evidence capture, documentation edits, readback/validation, and apply-owned verification. `parent` covers only explicit post-apply bounded review and lifecycle-gate decisions. No other owner values exist.
- **Unit rule**: each W-unit MUST stay below 300 changed lines. If measuring shows 300 or above before review, split within the unit by claim group and rerun integrity checks. Never combine units.
- **Evidence rule**: no documentation edit asserts a current-state claim without attributable evidence (source + revision/freshness). Missing evidence produces `unknown`, `unverified`, or a blocked decision — never inferred success.
- **Protected paths** are byte-for-byte read-only throughout. See the protected-path manifest below.
- **STRICT TDD MODE IS ACTIVE** per project context, but this change has no test surface; the applicable verification is the structural readback and evidence/integrity validation contract in each unit and in the final integration validation. `bun run test` and `bun run typecheck` MUST still run unchanged and green at final integration validation to prove no runtime artifact changed.

---

## Protected-path manifest (read-only, MUST remain byte-for-byte unchanged)

Baseline hashes for every path below MUST be captured before W1 and re-verified after every unit and at final validation:

- `openspec/programs/drenyra-dominion/README.md`
- `openspec/programs/drenyra-dominion/ecosystem-coherence.md`
- `openspec/changes/ecosystem-coherence/**`
- `openspec/changes/fiscal-authority-kernel/verify-report.md`
- all frozen contracts, source code, tests, generated runtime artifacts, and every path outside the three W-unit allowlists below.

A deterministic path/hash manifest for each protected directory MUST be produced before W1. Fail the unit if `git diff --name-only` contains any non-allowlisted path.

`ecosystem-coherence` MAY receive only a boundary-level pointer from an allowlisted document; its inventory, decisions, propagation units, and readback log are never copied, modified, superseded, or marked complete.

---

## Work-unit edit allowlists (exact)

Only the paths below may be edited, and only in the named unit with the named restriction. Any newly discovered target (including another roadmap mirror) requires a design/tasks amendment before apply; it MUST NOT be added opportunistically.

### W1 — vocabulary and gate

| Path | Allowed edit |
| --- | --- |
| `openspec/programs/drenyra-dominion/status-and-evidence.md` | **New file (W1-owned; not edited in any later unit)**: canonical five-axis vocabulary, evidence register, precedence, freshness, and historical/current index. |
| `openspec/programs/drenyra-dominion/gate-0.md` | Full Gate 0 reconciliation, active-change inventory, approval-evidence state, SDD-020 decision. |
| `openspec/programs/drenyra-dominion/charter.md` | Section 7 Gate 0 summary/link only. |
| `openspec/programs/drenyra-dominion/dependency-graph.md` | Section 9 Gate 0 pointer/status wording only. |
| `openspec/programs/drenyra-dominion/sdds/sdd-000-dominion/README.md` | Status/progress and evidence references only. |
| `openspec/programs/drenyra-dominion/sdds/sdd-010-contracts/README.md` | Status/progress, evidence contract, and governance amendment only. |

### W2 — composition and visibility

| Path | Allowed edit |
| --- | --- |
| `openspec/programs/drenyra-dominion/capability-matrix.yaml` | Evidence/freshness metadata and evidence-backed repository/capability snapshot values only. |
| `openspec/programs/drenyra-dominion/program-lock.json` | Historical/current composition metadata, attributable facts, bootstrap-safe references only. |
| `openspec/programs/drenyra-dominion/program-lock.schema.json` | Schema changes strictly required by added evidence/composition metadata. |
| `openspec/programs/drenyra-dominion/delivery-sequence.md` | Lock freshness, promotion, and bootstrap/readback wording only. |
| `ROADMAP.md` | Current visibility/status sentence and Dominion checkpoint references only. |

### W3 — governance allocation (non-implementation governance only)

| Path | Allowed edit |
| --- | --- |
| `openspec/programs/drenyra-dominion/sdds/sdd-060-multi-operator/README.md` | Tenant-scoped least-authority and segregation amendment only. |
| `openspec/programs/drenyra-dominion/sdds/sdd-070-skills/README.md` | Provenance, vigencia, pinning, and rollback amendment only. |
| `openspec/programs/drenyra-dominion/sdds/sdd-080-engram/README.md` | Non-authorizing context and separation-of-authority amendment only. |
| `openspec/programs/drenyra-dominion/sdds/sdd-090-guardian/README.md` | Independent adversarial findings and non-approval amendment only. |
| `openspec/programs/drenyra-dominion/sdds/sdd-110-production/README.md` | Restricted authority, credentials, observability, incident evidence, and production acceptance amendment only. |

> W3 is governance allocation, not capability implementation. Every amendment records future acceptance/governance wording and MUST explicitly state the capability is not claimed to exist. No amendment may claim RBAC/ABAC, KMS, connectors, or any product capability is implemented.

---

## Phase 0 — Freeze inspection context and capture baseline evidence

These steps are shared and MUST complete before W1. They edit nothing.

- [x] Freeze inspection context: record repository identity, inspected commit/tree, branch (context only), UTC timestamp, working-tree state, and the exact active-change inventory. <!-- sdd-owner: implementation -->
- [x] Capture SHA-256/blob hashes for every protected path and a deterministic path/hash manifest for each protected directory. Verify against the protected-path manifest above. <!-- sdd-owner: implementation -->
- [x] Resolve the exact local remote `owner/name` without treating the remote URL as visibility evidence. <!-- sdd-owner: implementation -->
- [x] Query authenticated GitHub repository metadata for that exact identity, capturing `nameWithOwner`, `visibility`/`private`, URL, default branch, and observation time (`gh repo view ... --json` or equivalent API). If authentication, authorization, identity matching, or response integrity is unavailable, record visibility as `unverified`. <!-- sdd-owner: implementation -->
- [x] Run or locate fresh or revision-bound test evidence for the inspected revision (see `config.yaml`: `bun run test`, `bun run typecheck`). Capture the exact command, result, and revision; record `unknown` if no fresh/revision-bound evidence exists. Do not promote the 640-test or 774/774 values to current without a binding revision or fresh run. <!-- sdd-owner: implementation -->
- [x] Read the persisted fiscal-authority verification report `openspec/changes/fiscal-authority-kernel/verify-report.md` as read-only, revision-bound evidence only. Do not edit it. <!-- sdd-owner: implementation -->
- [x] Build the evidence register: every claim gets a stable `claimId`, axis/value, temporal class, sourceKind, sourceLocator (repo-relative path or API resource; no credentials/absolute paths), repositoryIdentity, revision, capturedAt/verifiedAt, verificationMethod, freshness, supersedes, and notes. Record the three Gate 0 business inputs as `approved-pending-evidence` user-provided approvals pending durable capture. <!-- sdd-owner: implementation -->

---

## Phase 1 — W1: vocabulary and gate

**Allowlist:** the six W1 paths above. Target outcome: one non-contradictory story establishing the five-axis vocabulary, reconciling SDD-000/SDD-010 and Gate 0, and publishing an explicit SDD-020 decision.

- [x] Create `openspec/programs/drenyra-dominion/status-and-evidence.md`: canonical five-axis vocabulary table (lifecycle; implementation maturity; evidence; gate decision; temporal class) with explicit term mappings for `DRAFT`, `PLANNED`, `IN PROGRESS`, `COMPLETE`, `implemented`, `partial`, `planned`, `candidate`, `passing`; the evidence-register schema; source-precedence list; freshness rules; and a historical/current index. This file and its index are W1-owned and are NOT modified in any later unit; W2-promoted current-state claims are recorded inside their own W2 artifacts (each citing evidence IDs) rather than appended here. <!-- sdd-owner: implementation -->
- [x] Reconcile `openspec/programs/drenyra-dominion/sdds/sdd-000-dominion/README.md` status/progress and evidence references using the five-axis vocabulary. Never derive lifecycle from capability maturity; land existing foundations under maturity axis without promoting the SDD to `complete` unless gate/evidence obligations are reconciled. <!-- sdd-owner: implementation -->
- [x] Reconcile `openspec/programs/drenyra-dominion/sdds/sdd-010-contracts/README.md` status/progress, evidence contract, and the evidence-precedence/freshness/reproducible-cross-repo governance amendment (performed here in W1 only; it is NOT made in W3). <!-- sdd-owner: implementation -->
- [x] Reconcile `openspec/programs/drenyra-dominion/gate-0.md`: re-evaluate every checklist row against current repository evidence; refresh the active-change inventory without absorbing, renaming, or altering any active change; label each row `satisfied`, `pending`, `blocked`, or a valid `waived` (owner + rationale + scope + durable approval reference); record the three business inputs as `approved-pending-evidence`; keep genuinely unresolved owner decisions unresolved. <!-- sdd-owner: implementation -->
- [x] In `openspec/programs/drenyra-dominion/gate-0.md`, publish an explicit SDD-020 decision: blocked unless all required rows permit it; no implicit waiver. Add a boundary-level pointer to `ecosystem-coherence` as related but non-duplicative (pointer only, no copied content). <!-- sdd-owner: implementation -->
- [x] Update `openspec/programs/drenyra-dominion/charter.md` Section 7 and `openspec/programs/drenyra-dominion/dependency-graph.md` Section 9 only: Gate 0 summary/link/status wording consistent with the reconciled `gate-0.md`. Do not touch other sections. <!-- sdd-owner: implementation -->
- [x] W1 readback and integrity: parse every edited file, resolve all evidence IDs, confirm every current-state claim has source+freshness, confirm exactly one axis/value per term, verify the 12-SDD catalog is unchanged, re-verify protected-path hashes, and measure changed lines < 300. <!-- sdd-owner: implementation -->
- [x] W1 delivery verification: confirm the PR/commit file list matches the W1 allowlist and protected manifest; rendered GitHub text preserves evidence IDs and historical/current labels. <!-- sdd-owner: implementation -->

**W1 rollback:** revert all six W1 paths together to the prior program snapshot; preserve captured historical entries; if gate evidence disappears, SDD-020 returns to `blocked`.

---

## Phase 2 — W2: composition and visibility

**Allowlist:** the five W2 paths above. Consumes W1 vocabulary and evidence register.

- [ ] Reconcile `openspec/programs/drenyra-dominion/capability-matrix.yaml`: refresh from current repository contents and attributable verification records; add evidence/freshness metadata; keep the 640-test checkpoint historical; set current test total only if fresh or revision-bound green evidence exists, else `unverified`. Record unavailable sibling-repository facts as `unknown`. <!-- sdd-owner: implementation -->
- [ ] Reconcile `openspec/programs/drenyra-dominion/program-lock.json`: distinguish historical lock snapshot from current verified composition; mark stale SHAs/versions/test totals/conformance as historical or awaiting evidence; do not present them as current; never self-reference the commit that contains the host lock. <!-- sdd-owner: implementation -->
- [ ] Update `openspec/programs/drenyra-dominion/program-lock.schema.json` only with schema changes strictly required by the added evidence/composition metadata; keep the file valid against itself. <!-- sdd-owner: implementation -->
- [ ] Update `openspec/programs/drenyra-dominion/delivery-sequence.md` only for lock freshness, promotion, and bootstrap/readback wording. <!-- sdd-owner: implementation -->
- [ ] Update `ROADMAP.md` current visibility/status sentence and Dominion checkpoint references only: set repository visibility from the directly verified GitHub metadata with timestamp, or state `unverified`; keep `license`, `productStage`, `sourceAvailability`, and `githubVisibility` as independent fields. <!-- sdd-owner: implementation -->
- [ ] W2 readback and integrity: JSON validates against the lock schema, YAML parses, all evidence IDs resolve against the W1 evidence register, 640-test and CLI-failure checkpoints remain historical, visibility is metadata-backed or `unverified`, exactly 12 canonical SDDs remain, `status-and-evidence.md` remains byte-for-byte as W1 produced it (W1-owned, not edited here), protected hashes match, and changed lines < 300. <!-- sdd-owner: implementation -->
- [ ] W2 delivery verification: PR/commit file list matches the W2 allowlist and protected manifest; rendered text preserves evidence IDs and historical/current labels. <!-- sdd-owner: implementation -->

**W2 rollback:** revert only the W2 paths to the prior snapshot; retain the prior lock as historical; never introduce a self-reference.

---

## Phase 3 — W3: governance allocation (non-implementation governance only)

**Allowlist:** the five W3 SDD README paths (060/070/080/090/110). This is governance allocation only — future acceptance wording, never capability claims. Each amendment MUST state the capability is not claimed to exist. The SDD-010 evidence-precedence amendment is W1-owned and MUST NOT be made here.

- [ ] Amendment 1 — add tenant-scoped least-authority and segregation wording to `openspec/programs/drenyra-dominion/sdds/sdd-060-multi-operator/README.md`. Do not claim RBAC/ABAC implementation. <!-- sdd-owner: implementation -->
- [ ] Amendment 2 — add normative-source provenance, vigencia, pinning, and rollback wording to `openspec/programs/drenyra-dominion/sdds/sdd-070-skills/README.md`. Do not claim policy/skill capabilities exist. <!-- sdd-owner: implementation -->
- [ ] Amendment 3 — add non-authorizing-context wording to `openspec/programs/drenyra-dominion/sdds/sdd-080-engram/README.md` and independent-adversarial-findings/non-approval wording to `openspec/programs/drenyra-dominion/sdds/sdd-090-guardian/README.md`. Both remain non-authoritative; no new capability claim. <!-- sdd-owner: implementation -->
- [ ] Amendment 4 — add restricted-authority, credentials, observability, incident-evidence, and production-acceptance wording to `openspec/programs/drenyra-dominion/sdds/sdd-110-production/README.md`. Do not claim connectors/KMS exist. <!-- sdd-owner: implementation -->
- [ ] W3 readback and integrity: each W3 amendment (060/070/080/090/110) appears only in its owning SDD(s) and nowhere else, and no W3 amendment touches `sdd-010-contracts/README.md` (its evidence-precedence amendment landed in W1 only); no capability is described as implemented; protected hashes match; changed lines < 300; exactly 12 canonical SDDs remain. <!-- sdd-owner: implementation -->
- [ ] W3 delivery verification: PR/commit file list matches the W3 allowlist and protected manifest; rendered text preserves evidence IDs and historical/current labels. <!-- sdd-owner: implementation -->

**W3 rollback:** revert only amendment paragraphs; no runtime or authority state exists to migrate.

---

## Phase 4 — Final integration validation

Run after W3 lands and all three PRs are merged/verified.

- [ ] Enumerate the canonical catalog and confirm exactly 12 SDDs (SDD-000 through SDD-110 by tens); any other count blocks completion. <!-- sdd-owner: implementation -->
- [ ] Re-run protected-path hashes and `git diff --name-only` across the merged candidate: every protected path byte-for-byte identical; no non-allowlisted path changed. Fail if any `ecosystem-coherence` or fiscal verify-report path differs. <!-- sdd-owner: implementation -->
- [ ] Run `bun run test` and `bun run typecheck` unchanged and green to prove no runtime artifact changed. Record exact results and revision. <!-- sdd-owner: implementation -->
- [ ] Verify each RFC requirement from `specs/dominion-program-record/spec.md` is satisfied and record a pass/fail per requirement (completion criteria below). <!-- sdd-owner: implementation -->
- [ ] Confirm Gate 0 explicitly records whether SDD-020 is blocked or permitted, with evidence and valid waiver semantics; the three business inputs remain `approved-pending-evidence` unless durable attributable approval evidence was captured and cited. <!-- sdd-owner: implementation -->

---

## Completion criteria (mapped to every spec requirement)

Each requirement below MUST be met before the change is acceptable. Evidence is recorded in Phase 4.

| # | Spec requirement | Completion evidence |
| --- | --- | --- |
| R1 | Canonical 12-SDD Program Invariant | Catalog enumerates exactly SDD-000…SDD-110 by tens; change documented outside the count. |
| R2 | One Status Vocabulary Across Five Axes | `status-and-evidence.md` defines 5 axes and maps every ambiguous term to one axis+meaning; cross-axis uses qualified. |
| R3 | Lifecycle and Maturity Axes Independent | No SDD lifecycle derived from capability maturity; implemented foundations visible without forcing `complete`. |
| R4 | Documentary Presence Alone Does Not Complete a Gate | No gate row marked complete on presence alone; unresolved rows stay unresolved. |
| R5 | Attributed Evidence-Source Precedence | All claims reconciled via the 5-level precedence; higher source prevails only for its revision. |
| R6 | Every Current-State Claim Carries Source and Freshness | Every current claim cites evidence ID + freshness/revision; unsupported → `unknown`/`unverified`/blocked. |
| R7 | Historical Records Remain Historical | 640-test and CLI-failure checkpoints remain present and labeled historical; not falsified. |
| R8 | Gate 0 Reconciles to Current Repository Evidence | Every row re-evaluated; inventory refreshed without altering active changes; unresolved decisions stay unresolved. |
| R9 | User-Provided Approvals Pending Evidence Capture | Three inputs labeled `approved-pending-evidence`; decision not reopened; not evidence-backed without durable citation. |
| R10 | SDD-020 Blocked Until Gate 0 Permits | Gate 0 explicitly blocks/permits SDD-020 with evidence; no implicit waiver; exceptions name owner/rationale/scope/approval ref. |
| R11 | GitHub Visibility Requires Direct Verification | Visibility from direct metadata w/ timestamp, or `unverified`; license/stage/source/visibility kept independent. |
| R12 | Test-Count and CLI-Failure History Reconciliation | 640 stays historical; CLI-failure baseline superseded by green evidence; promoted totals bound to revision/fresh run. |
| R13 | Capability Matrix, Program Lock, Roadmap Coherence | Matrix refreshed; lock distinguishes historical/current; no stale SHAs as current; bootstrap rule preserved; unknown external facts recorded. |
| R14 | Governance Amendment Allocation | The SDD-010 evidence-precedence amendment lands in W1 only; the 4 W3 amendments land in their owning SDDs only (060/070/080/090/110); no amendment in any unit claims a capability is implemented. |
| R15 | Protected-Path Isolation | All protected paths byte-for-byte identical; no non-allowlisted path changed. |
| R16 | Ecosystem-Coherence Boundary | Referenced only at boundary level; no record copied/modified/superseded/completed. |
| R17 | No Product Capability Implementation | Every deliverable is a documentation/administrative-metadata edit within the allowlist. |
| R18 | Bounded Evidence-Backed Documentation Edits | Every edit cites evidence source+freshness; unsupported claims recorded `unknown`/`unverified`/blocked; each unit < 300 lines. |

---

## Governance and lifecycle gates (parent-owned, post-apply)

These run only after implementation and verification complete; they are NOT implementation tasks.

- [ ] Post-apply bounded review of the merged candidate per native review contract. <!-- sdd-owner: parent -->
- [ ] Resolve `chain_strategy` (`stacked-to-main` vs `feature-branch-chain`) and open the three chained PRs in order W1 → W2 → W3 before any apply of later units. <!-- sdd-owner: parent -->
- [ ] Record SDD-020 as blocked or permitted in the authoritative Gate 0 record and confirm no later canonical SDD was started by this change. <!-- sdd-owner: parent -->
