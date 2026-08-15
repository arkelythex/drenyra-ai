# Exploration — Constitutional Closure (SDD-000 & SDD-010)

> Status: exploration · Change: `constitutional-closure` · Store: openspec
> Owner: Drenyra Dominion Program · Inspected: current working tree on
> branch `docs/sdd040-closure` (program records reflect the merged
> `dominion-program-status-reconciliation` state + 2026-08-15 Gate 0 landing).
> Scope: determine the closure scope for the two constitutional SDD records
> (`lifecycle:active` since 2026-08-14, Gate 0 now FULLY satisfied).

## 1. Purpose

Gate 0 is now fully satisfied (all 6 rows; rows 3–4 landed 2026-08-15 — see
`openspec/programs/drenyra-dominion/gate-0.md` §4). Both constitutional records
(`sdd-000-dominion/README.md` and `sdd-010-contracts/README.md`) were set
`lifecycle:active` by the 2026-08-14 reconciliation, explicitly NOT `complete`
because Gate 0 obligations (rows 3–4) and each record's content-contract phases
remained unreconciled. This exploration determines, with evidence, whether each
SDD can now close (`lifecycle:complete`) or must remain `active`.

**Headline finding:** only SDD-000 is *plausibly* closeable as a docs-only
reconciliation, and even that requires an explicit content-contract closure
decision (R3/R4 forbid completing on documentary presence alone). **SDD-010 is
NOT closeable**: its core declared obligation — the federated release train and a
*promoted* `program-lock` checkpoint — remains entirely unrealized. Recommended:
keep both `lifecycle:active`, and land only a small docs freshness fix.

---

## 2. SDD-000 — Drenyra Dominion Program

### 2.1 Declared scope vs. what exists

Declared scope (`sdds/sdd-000-dominion/README.md` §Scope) and the artifacts that
satisfy it:

| Scope item | Evidence artifact | Verifiable? |
| --- | --- | --- |
| North Star + first conquest (Peruvian monthly close) | `charter.md` §1 | ✓ present |
| Frontiers, ecosystem map, repository ownership | `charter.md` §2, `README.md` (program) | ✓ present |
| Constitutional rules 1–10 + mandatory authority chain | `charter.md` §3, `authority-model.md` §2–§3 | ✓ present |
| Verifiable invariants (0 self-authorization, 0 floats, 0 blind retries, 0 alt state machines, memory never evidence, 0 retroactive skills) | `authority-model.md` §5.8, `charter.md` §4 | ✓ present |
| Taxonomy + domain criteria (organic work routing) | `charter.md` §5, `authority-model.md` §4 | ✓ present |
| SDD contract + per-SDD content contract; program gates §6.2; Gate 0; wave sequencing; repo ownership | `charter.md` §6, `dependency-graph.md` §4/§6/§8/§9, `gate-0.md`, `README.md` | ✓ present |

Constitution artifacts that exist (all under `openspec/programs/drenyra-dominion/`):
`charter.md`, `authority-model.md`, `dependency-graph.md`, `capability-matrix.yaml`,
`gate-0.md`, `status-and-evidence.md`, `program-lock.json`, `program-lock.schema.json`,
`delivery-sequence.md`, `release-train.md`, `acceptance-matrix.md`,
`ecosystem-coherence.md`. (The task's stated artifact set is confirmed present.)

### 2.2 Gate 0 status

`gate-0.md` §Checklist: **all 6 rows satisfied**.

- Row 1 (active-change inventory incl. `fiscal-authority-kernel`): satisfied, E-001/E-008.
- Row 2 (overlaps/dependencies): satisfied.
- Row 3 (README/license/visibility/commercial alignment): satisfied 2026-08-15 (E-010/E-011/E-012; pi #36, engram #25, command-center #180).
- Row 4 (provisional freeze ICP/operators/first journey): satisfied 2026-08-15 (E-009, §3 durable approval).
- Row 5 (open-core intention): satisfied (charter §9).
- Row 6 (first capability matrix): satisfied (`capability-matrix.yaml`).
`gate-0.md` §4: **SDD-020 PERMITTED** (unblocked 2026-08-15). `fiscal-authority-kernel`
archived (PR #32) and `dominion-program-status-reconciliation` merged (#27/#28/#29),
both under `openspec/changes/archive/2026-08-15-*`.

### 2.3 Remaining obligations beyond Gate 0

**1. Content-contract phases (the binding blocker).** Per `charter.md` §6 and
`dependency-graph.md` §4, every SDD MUST contain 8 phases: Exploration, Proposal,
Specification, Design, Tasks, Apply, Verification, Archive. The SDD-000 Progress
checklist has **all 8 items unchecked**. The 2026-08-14 reconciliation explicitly
held SDD-000 back because "this SDD's content-contract phases remain unreconciled",
and rule R4 (status-and-evidence.md §1) forbids marking a phase complete on
documentary presence alone. The landed constitution artifacts evidence phases
1–4 (Exploration→Design) but were never reconciled/checked; phases 5–8
(Tasks/Apply/Verify/Archive as TDD implementation) do not map to a pure-constitution
record and have no code surface.

**2. Stale status claims (docs drift).** `status-and-evidence.md` §5
"Historical/current index" still records: *"SDD-000 / SDD-010 lifecycle →
`lifecycle:active` — … Gate 0 obligations (rows 3–4) unreconciled"* and
*"Gate 0 rows 3–4 → pending / approved-pending-evidence; SDD-020 blocked"*. Both
rows predate the 2026-08-15 satisfaction and are now **stale**. The
`sdd-000-dominion/README.md` reconciliation note similarly still says "Gate 0
obligations (rows 3–4) … remain unreconciled" and is now outdated.

**3. Program terminal metric.** SDD-000's "Tests and metrics" names
`charter.md §8` success definition (v1) as the program's terminal metric. §8 v1
requires the full product (monthly close from Command Center, 3 independent
contract consumers, production infra, KMS, pilots, etc.) — none of which is
achieved. This is a downstream/program outcome, not a constitutional-scope item,
but it means marking the master SDD `complete` today would contradict its own
terminal success definition.

### 2.4 Closure recommendation — `lifecycle:active` (keep active)

**Recommendation: SDD-000 stays `lifecycle:active`.** Rationale:

- All *constitutional* scope obligations are met and Gate 0 is fully satisfied.
- But the content-contract phases are formally unreconciled; per R3/R4 lifecycle
  must not be derived from capability maturity and presence alone never completes
  a phase. Closing requires an explicit, evidence-cited content-contract
  reconciliation — a deliberate governance decision, not an automatic promotion.
- SDD-000 is the persistent program master feeding SDD-010 and, through it,
  SDD-020…SDD-110 across waves 0–4. Its governing role is ongoing; its terminal
  metric (§8 v1) is unmet.

**Closure path (if the owner later decides to close the constitutional record):**
a docs-only content-contract reconciliation that (a) records each of phases 1–4
satisfied against named constitution artifacts + evidence IDs, (b) records phases
5–8 as not-applicable-with-decision for a pure-documentation master SDD, (c)
refreshes the stale `status-and-evidence.md` §5 rows and the SDD-000 README note,
and (d) documents that SDD-000 remains the governing program record. This is a
possible docs-only follow-up, not part of this change's recommended closure.

---

## 3. SDD-010 — Ecosystem Contracts and Release Train

### 3.1 Declared scope vs. what exists

| Scope item | Evidence artifact | Verifiable? |
| --- | --- | --- |
| Six frozen v0.1 contracts + protection rule | `contracts/` (6 FROZEN at v0.1; `brand-system` DRAFT v0.2), `contracts/README.md` | ✓ present |
| Capability manifests per repository | `capability-matrix.yaml` | ✓ present |
| Versioning rules + compatibility policy | `contracts/README.md`, `program-lock.json` (`compatibility`) | ✓ present |
| **Federated release train** (immutable candidate → conformance CI → federated integration → multi-repo journeys → signed manifest promotion) | `release-train.md` (**DRAFT v0.1**), `delivery-sequence.md` (**DRAFT v0.1**) | ✗ NOT executed |
| **`program-lock.json` reproducible composition** | `program-lock.json` | ✗ `status: candidate` — never promoted |
| **Conformance test suite enforced across contract consumers** | per-repo drenyra-ai suites only | ✗ federated/cross-repo NOT published |

### 3.2 Release-train analysis — was a federated checkpoint ever published?

**No federated checkpoint was ever published or promoted.** Evidence:

- `program-lock.json` `status: "candidate"` (never `promoted`); `waves.wave-0-constitution`
  = `"in-progress"`.
- `siblingRepositories.temporalClass = "unknown"` — the five sibling SHAs/versions/
  conformance are **not verifiable from this clone** and are recorded as awaiting
  evidence (R13). Every `repositories[].commitSha` is `temporalClass:
  historical-snapshot`.
- `checksums` block is empty: *"Computed at promotion time by the federated
  integration runner; baseline lock records SHAs only."*
- No signed ecosystem manifest and no release-manifest/attestation workflow exist.
  `delivery-sequence.md` §7 open item 4: *"Add the release-manifest attestation
  workflow (B5) to the federated CI when the release train lands (SDD-010)"*.
- `release-train.md` and `delivery-sequence.md` are both `Status: DRAFT (v0.1)`.
  Phase A (documentary commits across the six repos) and Phase B (lock update +
  federated verification + promotion) were never executed as a promoted checkpoint.

**The `ce2c447` "ecosystem checkpoint" commits are NOT a published checkpoint.**
Git history (`.git/logs`) shows `ce2c4473…` is the commit *"chore(program):
resolve program-lock merge to origin/main state"* — a merge-resolution commit
that brought `program-lock.json` to the origin/main state. It performed no
conformance CI run, no multi-repo journey, computed no checksums, and produced no
signed manifest or external attestation. It is a Git bookkeeping commit, not a
release-train promotion.

### 3.3 Remaining items for SDD-010 to close (future, NOT docs-only)

1. **Publish and promote a real federated checkpoint**: execute `delivery-sequence.md`
   Phase A (documentary commits across the six repos) then Phase B (lock update with
   the five external SHAs + `host.programBaseCommit`; re-run federated conformance CI +
   multi-repo journeys over those exact SHAs; compute checksums; produce the signed
   release manifest / attestation (B5); set lock `status: candidate → promoted`).
2. **Add the release-manifest attestation workflow (B5)** to federated CI
   (`delivery-sequence.md` §7 item 4).
3. **Reconcile content-contract phases**: all 8 checklist items are unchecked
   (`sdd-010-contracts/README.md` §Progress).
4. **Refresh stale status claims**: `status-and-evidence.md` §5 and the SDD-010
   README note still frame rows 3–4 as unreconciled/SDD-020 blocked.

### 3.4 Closure recommendation — `lifecycle:active` (keep active)

**Recommendation: SDD-010 stays `lifecycle:active`; it CANNOT close now.** The
federated release train — a core declared obligation — is entirely unrealized.
Promoting it to `complete` would fabricate a conformance/promotion state that does
not exist, violating R6 (every current-state claim needs evidence) and R13
(lock values are historical until corroborated). Closing SDD-010 is a substantive
future work unit (cross-repo coordination + CI + signing), not a docs-only edit.

---

## 4. Combined closure scope

**There is no combined both-can-close docs-only scope.** SDD-010 is not closeable.
The only defensible shared work is a small docs **freshness fix** (not a closure):

| File (under `openspec/programs/drenyra-dominion/`) | Change | Est. lines |
| --- | --- | --- |
| `status-and-evidence.md` §5 "Historical/current index" | Correct the two stale rows: SDD-000/SDD-010 lifecycle row and "Gate 0 rows 3–4 pending / SDD-020 blocked" → record rows 3–4 satisfied 2026-08-15, SDD-020 permitted, both SDDs remain `active` for the reasons in §2/§3 | ~6–10 |
| `sdds/sdd-000-dominion/README.md` | Refresh reconciliation note: rows 3–4 satisfied 2026-08-15 (E-009/E-010/E-011/E-012); still `active` because content-contract phases unreconciled + §8 v1 terminal metric unmet | ~4–6 |
| `sdds/sdd-010-contracts/README.md` | Refresh reconciliation note: rows 3–4 satisfied; still `active` because release-train obligations + lock promotion unreconciled | ~4–6 |
| `gate-0.md` | Already current (rows 3–4 satisfied, §4 SDD-020 permitted). Optional: one line confirming it is the current gate record | ~0–2 |

Total **~15–25 authored lines, docs-only** — far under the 400-line review limit,
no tests, no protected-path risk. **Not a closure**, just removing stale claims.

**Conditional SDD-000 closure (optional, separate decision):** if the owner wants
to close the SDD-000 constitutional record specifically, add a content-contract
reconciliation (phases 1–4 evidenced by the constitution artifacts; phases 5–8
recorded not-applicable for a pure-documentation master) plus the status refresh.
This is a deliberate governance decision (R3/R4), not an automatic consequence of
Gate 0 satisfaction. **SDD-010 is out of scope for any closure in this change.**

---

## 5. Risks and boundaries

- **R3/R4 (status-and-evidence.md §1):** lifecycle is never derived from maturity;
  documentary presence alone never completes a phase or gate. Any closure must cite
  evidence (artifact + evidence ID + freshness), not presence.
- **Premature SDD-000 completion** would contradict the master's own terminal
  success definition (`charter.md §8` v1, unmet) and leave the 8 unchecked
  content-contract phases unexplained.
- **Fabricating SDD-010 conformance/promotion** would violate R6/R13. The lock is
  `candidate`, sibling facts `unknown`, checksums absent, no signed manifest. Do not
  present 640 (historical) or 774 (revision-bound to `4975f4f`) as current; the only
  current suite figure in this tree is **843/843 at `9b8aa1c`** (per
  `sdd-040-rda-v2/README.md`).
- **W1 ownership conflict:** `status-and-evidence.md` is W1-owned and the 2026-08-14
  reconciliation declared it "NOT modified by later work units." Refreshing its §5
  stale rows for closure needs an explicit governance exception note, not a silent
  edit.
- **`ecosystem-coherence` boundary (R16):** this closure must not copy, modify,
  supersede, or mark complete anything in `ecosystem-coherence.md`; reference at the
  boundary only.
- **Scope:** any real SDD-010 release-train work is a large future change, explicitly
  excluded from this docs-only exploration.

## 6. Recommended next step

A docs-only `constitutional-closure` change that: (1) refreshes the three stale
status locations (status-and-evidence §5, both SDD README notes) to record Gate 0
fully satisfied and both SDDs remaining `lifecycle:active`; (2) records an explicit
governance note that SDD-010 is not closeable (release-train obligations unmet) and
that SDD-000 closure, if ever pursued, requires a separate content-contract
reconciliation decision; (3) leaves `gate-0.md` as the current gate record. No
lifecycle is promoted to `complete`.
