# Exploration — Vertical SDD Closure/Reconciliation (SDD-050/060/070/080/090)

> Purpose: determine, per vertical SDD, the **implemented core** versus the declared
> scope, verify each gap is genuinely absent, and recommend a docs-only closure or
> reconciliation following the **SDD-040 pattern** (record the implemented core;
> mark gaps as non-goals/follow-up slices; never promote lifecycle on documentary
> presence alone per R3/R4). Contracts stay frozen; no code is changed; the suite
> stays 843/843.
>
> Repository scope: `drenyra-ai` only. SDD-080 and SDD-070's supply-chain surface
> span sibling repos (`drenyra-engram`, `drenyra-skills`); sibling facts are
> `historical-snapshot / awaiting evidence` in the capability matrix and are NOT
> verifiable from this clone — that is recorded and respected below.

## Baseline evidence (unchanged contract)

- **Suite:** 843/843 (64 files, `bun run test`) at `main` — the routed-candidate
  baseline `57ea56a` re-confirmed `9b8aa1c` (recorded in the SDD-040 closure).
  This exploration writes **no code**, so the suite stays 843/843.
- **Archived changes** already closed: `fiscal-authority-kernel`
  (2026-08-15, PR #32, 41/41 req / 61/61 scenarios / 774/774), SDD-020 first slice
  (2026-08-15, PASS, 43/43), SDD-040 RDA v2 core (`lifecycle:complete` 2026-08-15),
  `drenyra-ecosystem-cleanup` (archived 2026-08-11).
- **Capability matrix** (`openspec/programs/drenyra-dominion/capability-matrix.yaml`)
  is the authoritative maturity record. Current relevant rows:
  - `tenant-core`/`tenant-isolation`: **implemented**
  - `skills/pe-igv-validate`: **implemented**; `normative-sources` partial;
    `vigencia-versioning`/`checksum-signature`/`rollback`: **planned** (SDD-070)
  - `guardian/posture-docs`: partial; `verification-lenses`/`read-only-frozen-candidates`/
    `refutation-dual-review`/`findings-resolution`: **planned** (SDD-090)
  - `drenyra-engram`: most rows implemented; `cli-http-mcp` partial;
    `audit-register-closure` active change (sibling)
- **Protected paths:** `contracts/**`, `openspec/changes/archive/**`, and
  non-allowlisted program-root docs must remain zero-delta.

---

## SDD-050 — Peruvian Monthly Close

### SDD record

`openspec/programs/drenyra-dominion/sdds/sdd-050-monthly-close/README.md`.
Status **PLANNED**, Wave 3, Depends on SDD-040/070/080, Feeds SDD-060.
Progress checklist: all items `[ ]`. Declared scope = the full vertical: evidence
import (ERP/SIRE/banks), preflight/normalization/reconciliation, candidate
generation via RDA v2, Guardian review, Close Package receipt + audit-ledger, and
PE policy/CDR + pinned skills.

### Implemented surface (real symbols)

The deterministic/local close vertical is implemented and tested:

- `flow/close.ts` — `runMonthlyClose(input): Promise<ClosePackage>`. Deterministic
  E2E: preflight (checksummed RUC + `isValidPeriod`) → evidence collection via
  `AdapterRegistry` over `REQUIRED_EVIDENCE_SYSTEMS`
  (`vouchers/registers/sire/bank-statements`) with **absence never zero** (returns
  `waiting-for-evidence`) → candidate generation through `CandidateLifecycle.propose`
  → `runGuardianReview` per candidate (blockers surfaced as risks, receipt skipped)
  → `buildSignedReceipt` (IGV skill version noted) → `validateLedger`. Returns
  `ClosePackage { status, scope, sourcesUsed, sourcesMissing, candidates,
  guardianReports, receipts, ledgerValid, risks }`.
- `flow/index.ts` exports the close vertical (`export * from "./close.js"`).
- `adapters/` — `AdapterRegistry`, `EvidenceAdapter` interface, `LocalFileAdapter`
  (`adapters/registry.ts`, `adapters/local.ts`), `evidenceItem`, `evidenceManifestHash`,
  `missingTypes`. Local/deterministic evidence only; **no real ERP/SIRE/bank connectors**.
- `missions/__tests__/e2e-monthly-close.test.ts` — E2E drives
  mission → candidates → receipt → ledger with evidence-gated execution.
- `flow/__tests__/close.test.ts` — `runMonthlyClose` unit suite (preflight fail,
  waiting-for-evidence, complete package, guardian blockers as risks, invalid ledger).
- Guardian, candidates, receipts, ledger, gates, missions all consumed (see
  SDD-040 closure surface table — already closed as the RDA v2 core).

### Gaps vs declared scope (verified absent)

- **Real ERP/SIRE/bank connectors:** only `LocalFileAdapter` + registry exist; no
  live adapter. Declared "planned under SDD-110". Genuinely absent.
- **Professional validation surface:** R0–R3 *decisions* are implemented as gates
  (`ApprovalGate`, `distinctApprovers`, `GateRunner`) and Guardian findings, but the
  human professional decision/confirmation UI is a Command Center (SDD-100)
  concern. Genuinely absent as a first-class professional-validation surface here.
- **PE policy/CDR composition:** `pe-policy`/`cdr` exist (partial per matrix,
  slices 1D/1E in progress — active `fiscal-authority-kernel`); not a blocker for
  the deterministic local close core.

### Closure recommendation — **docs-only closure of the deterministic local close core**

- The **declared core** (deterministic local monthly-close vertical: preflight →
  evidence → candidates → Guardian → receipts → Close Package) is verifiably
  implemented, exported, and tested (unit + E2E), and reuses the already-closed
  RDA v2 core.
- Gaps are **true non-goals / follow-up slices**: ERP/SIRE/bank connectors are
  explicitly SDD-110; professional validation is a Command Center (SDD-100)
  surface. Neither belongs to the deterministic local core.
- Per R3/R4: mark **`lifecycle:complete`** for "deterministic local monthly-close
  vertical" with the connectors/professional-validation recorded as non-goals,
  exactly mirroring the SDD-040 closure structure (surface-to-scope table, gap
  list, revision-bound evidence, suite-unchanged confirmation). This does NOT close
  SDD-060/070/080/090 or SDD-100.
- Files to update (docs-only): `sdds/sdd-050-monthly-close/README.md` (status →
  complete + closure section); `openspec/changes/vertical-closures/` proposal/spec/
  tasks/verify/archive.

---

## SDD-060 — Multi-Operator Control Plane

### SDD record

`sdds/sdd-060-multi-operator/README.md`. Status **PLANNED**, Wave 3, Depends on
SDD-050, Feeds SDD-100. **Governance amendment (W3, R17) explicitly does NOT claim**
RBAC/ABAC, per-org policy/approval hierarchies, or per-org connectors exist today.

### Implemented surface (real symbols)

- `tenant-core/` — `validateTenantScope(input): ValidatedTenantScope`,
  `tenantScopeKey(scope)`, `sameTenantScope(a,b)` (`scope.ts`), branded
  `TENANT_SCOPE_BRAND`, `TenantScope`/`ValidatedTenantScope`, `TenantScopeError`
  (`types.ts`). Atomic fail-closed validation of companyId/RUC/period.
- `tenant-isolation/` — `assertTenantReadScope`, `readArtifact` (`read.ts`),
  `TenantScopedStore<T>`, scoped-read result types (`types.ts`). Note: `index.ts`
  states "Not yet wired into the package exports"; `package.json` exports
  `"./tenant": "./dist/tenant-core/index.js"` only — tenant-isolation is a tested
  unit, not a package export.
- Tests: `tenant-core/__tests__/scope.test.ts`, `tenant-isolation/__tests__/read.test.ts`,
  `import-boundaries.test.ts`.

### Gaps vs declared scope (verified absent)

- **RBAC/ABAC authorization engine:** no module, no symbols (grep for `rbac`/`abac`/
  role-based/attribute-based = zero matches). Genuinely absent.
- **Per-org policies, approval hierarchies, connectors:** absent.
- **Segregation of duties:** only the R3 **dual distinct approvers** rule exists
  (`guardian` approval finding + `gates/approval.ts distinctApprovers`), scoped to
  R3 candidates; there is no full organization-wide SoD enforcement. Partially
  present as a gate, not as the SDD's plane-wide enforcement.

### Closure recommendation — **STAY ACTIVE (reconcile, do not close)**

- The implemented **tenant model** (tenant scope + read isolation) is a real,
  verifiable slice, but it is **not** the declared core of SDD-060 — RBAC/ABAC
  authorization and segregation-of-duties are the core purpose and are genuinely
  absent. Per R3/R4 this record **cannot** read `complete`.
- Recommend a docs-only **reconciliation**: record `tenant-core`/`tenant-isolation`
  as an implemented slice in the README (matrix already marks them implemented),
  keep `lifecycle:planned`, and keep RBAC/ABAC + SoD + connectors as the pending
  core. No lifecycle promotion (consistent with the amendment's own R17 disclaimer).

---

## SDD-070 — Skills and Policy Supply Chain

### SDD record

`sdds/sdd-070-skills/README.md`. Status **PLANNED**, Wave 2, Depends on SDD-010,
Feeds SDD-050. Governance amendment (W3, R17) does NOT claim full supply-chain
capabilities exist; matrix rows `vigencia-versioning`/`checksum-signature`/`rollback`
= planned.

### Implemented surface (real symbols)

- `skills/types.ts` — `SkillDefinition`, `SkillValidity`, `SkillError`,
  `canonicalSkillJson`.
- `skills/registry.ts` — `SkillRegistry`, `computeSkillChecksum`,
  `validateSkill`, `isSkillInForce(skill, at)`, `compareVersions` (vigencia
  in-force check + exclusive `to` window + no retroactive change).
- `skills/pe.ts` — `BASE_PE_SKILLS` = `IGV_VALIDATE`, `SIRE_COMPARE`,
  `DETRACTION_CHECK`, `RETENTION_CHECK`, `PERCEPTION_CHECK`, `SIRE_FILING`.
- Conformance suite: `skills/__tests__/pe-skills.test.ts` + `registry.test.ts`
  (checksum content-derived, in-force resolution, jurisdiction enforcement,
  no-retroactive-change).

### Gaps vs declared scope (verified absent)

- **Signature:** `computeSkillChecksum` provides checksum but **no ed25519
  signature** on packs. Absent.
- **Mission pinning:** no pinning API; `flow/close.ts` passes a bare
  `igvSkill { id, version }` — no pinned immutable skill-set bound to the mission.
  Absent.
- **Rollback:** no rollback mechanism. Absent.
- **Full normative-source tracking:** partial (jurisdiction present on skills).
- **`skills:conformance` CLI command — documentation discrepancy:** the SDD-070
  README states "Conformance via `drenyra-ai skills:conformance` (PE IGV validate
  already implemented)", but **no such CLI command is registered** in
  `cmd/cli.ts` (the command list has `capabilities show`, `doctor run`, `install`,
  `sync`, `upgrade`, `rollback`, `mcp serve`; grep for `skills:conformance` = zero
  matches). Conformance is delivered as vitest suites only. This is a claim to
  correct, not a capability to remove.

### Closure recommendation — **STAY ACTIVE (reconcile, do not close)**

- The implemented core is the **PE skill registry with checksum + vigencia +
  conformance tests**. The declared core also requires **signing, mission pinning,
  and rollback**, which are genuinely absent → cannot read `complete`.
- Recommend a docs-only reconciliation: record the PE-skill-registry slice as
  implemented (matrix already marks `pe-igv-validate` implemented; `normative-sources`
  partial), keep signing/vigencia-versioning/pinning/rollback as the pending core,
  and **correct the `skills:conformance` CLI claim** (the conformance is a test
  suite, not a CLI command). No lifecycle promotion.

---

## SDD-080 — Engram Institutional Memory

### SDD record

`sdds/sdd-080-engram/README.md`. Status **PLANNED**, Wave 2, Depends on SDD-010,
Feeds SDD-050. Governance amendment (W3, R17) claims **no new** memory capability;
the non-authorization boundary + EvidenceObject maturity are already recorded.

### Implemented surface (real symbols) in `drenyra-ai`

Drenyra AI's engram role is the **non-authorization boundary**:

- `evidence/identity/types.ts` — `MEMORY_SHAPED_MARKERS = ["memory","engram","recall"]`,
  `EVIDENCE_CHANNEL`.
- `evidence/authority/authority.ts` — rejects memory-shaped channels
  (`EvidenceErrorCode.MEMORY_SHAPED`); `registerEvidence`, `assertEvidenceInScope`.
- `evidence/accept.ts` — `acceptEvidence` fail-closed on memory-shaped input.
- `gates/approval.ts` comment: "Memory (Drenyra Engram) never authorizes — only a
  professional records…".
- Tests: `evidence/authority/__tests__/authority.test.ts`,
  `evidence/__tests__/accept.test.ts`, `evidence/identity/__tests__/identity.test.ts`
  (each asserts `MEMORY_SHAPED_MARKERS` rejection). This is the `memory-never-authorizes`
  invariant.

### Gaps vs declared scope

The bulk of SDD-080's scope (scope-first SQLite, EvidenceObject WORM, ed25519
receipts, offline verification, provenance, cross-tenant isolation) lives in the
**sibling `drenyra-engram` repo** (matrix: most implemented, `cli-http-mcp` partial,
`audit-register-closure` active). These are **not verifiable from this clone**
(capability matrix: sibling facts = `historical-snapshot / awaiting evidence`).
No actual engram runtime client is wired into drenyra-ai — only the boundary.

### Closure recommendation — **STAY ACTIVE (reconcile, do not close)**

- From `drenyra-ai` alone, only the non-authorization boundary is verifiably
  implemented. The SDD core spans the sibling repo whose evidence cannot be
  verified from this clone, and `cli-http-mcp` + audit-register-closure remain
  open → cannot read `complete` here.
- Recommend a docs-only reconciliation recording the `memory-never-authorizes`
  boundary as the implemented drenyra-ai slice (already matrix-recorded), and
  deferring closure to a change that can verify the `drenyra-engram` sibling
  surface. No lifecycle promotion.

---

## SDD-090 — Guardian Angel

### SDD record

`sdds/sdd-090-guardian/README.md`. Status **PLANNED**, Wave 2, Depends on SDD-040,
Feeds SDD-100. Governance amendment (W3, R17) does NOT claim the verification
lenses exist today. Matrix: `posture-docs` partial; `verification-lenses`/
`read-only-frozen-candidates`/`refutation-dual-review`/`findings-resolution` planned.

### Implemented surface (real symbols)

- `guardian/guardian.ts` — `runGuardianReview(candidate, options): GuardianReport`.
  Strictly read-only: `verdict` is always `"none"`; findings only
  (`GuardianFinding` severity blocker/concern/info, categories scope/materiality/
  approval/evidence/integrity). Checks: checksummed RUC, valid period, subject-hash
  integrity, declared materiality tier, **R3 dual distinct approvers** (`r3DualRequired`),
  missing-review-history concern. Does not mutate the candidate.
- `guardian/index.ts` exports it.
- CLI: `candidate audit <candidate.json>` — "Guardian Angel read-only adversarial
  review (findings only)" (`cmd/cli.ts`).
- Tests: `guardian/__tests__/guardian.test.ts`.

### Gaps vs declared scope (verified absent)

- **Refutation dual-review:** no refuter/dual-review symbols (grep for
  `refutation`/`dual-review`/`refuter` = zero matches). Genuinely absent.
- **Findings resolution:** absent.
- **Command Center integration:** absent (SDD-100 is the consumer, `close-package`
  planned in the matrix).

### Closure recommendation — **STAY ACTIVE (reconcile, do not close)**

- The implemented core is the **read-only single-review verification** (findings
  only, `verdict:"none"`, `candidate audit` CLI) — verifiably present and tested.
- The declared core also includes **refutation dual-review and findings
  resolution**, which are genuinely absent → cannot read `complete`.
- Recommend a docs-only reconciliation recording the read-only verification core
  as implemented (matrix marks `posture-docs` partial; keep lenses planned) and
  dual refutation + Command Center integration as the pending core. No lifecycle
  promotion.

---

## Consolidated closure plan

| SDD | Declared core fully implemented? | Implemented slice | Gaps (true non-goal / follow-up) | Recommendation |
|-----|------|-------------------|----------------------------------|----------------|
| 050 | ✅ deterministic local close E2E | `flow/runMonthlyClose`, adapters/local, e2e test | ERP/SIRE/bank connectors → SDD-110; professional-validation UI → SDD-100 | **CLOSE (docs-only)** `lifecycle:complete` for the deterministic local close core |
| 060 | ❌ (RBAC/ABAC + SoD absent) | `tenant-core`/`tenant-isolation` | RBAC/ABAC engine, per-org policy/approval/connectors, SoD | **STAY ACTIVE** — record tenant slice |
| 070 | ❌ (signing/pinning/rollback absent) | PE skill registry + checksum + vigencia + conformance tests | signature, mission pinning, rollback, full normative-source tracking | **STAY ACTIVE** — record PE-slice; correct `skills:conformance` claim |
| 080 | ❌ (sibling surface unverifiable; interfaces/audit open) | `memory-never-authorizes` boundary (evidence identity) | CLI/HTTP/MCP, audit-register-closure, federated integration (sibling) | **STAY ACTIVE** — record boundary slice |
| 090 | ❌ (dual refutation + resolution absent) | read-only single-review verification + `candidate audit` CLI | refutation dual-review, findings resolution, Command Center integration | **STAY ACTIVE** — record read-only core |

### Only one docs-only closure

**SDD-050 closes** following the SDD-040 pattern: the deterministic local
monthly-close vertical is the declared core, verifiably implemented + tested, and
its gaps (real connectors → SDD-110; professional-validation surface → SDD-100)
are true non-goals / follow-up slices. This does NOT cascade-close SDD-060/070/080/
090 or SDD-100 (each remains `lifecycle:planned`, consistent with the SDD-040
closure note).

### Files to update (all docs-only, within `openspec/changes/vertical-closures/` + SDD records)

1. `sdds/sdd-050-monthly-close/README.md` — status → `lifecycle:complete`
   (deterministic local close core, closure date), add closure section (surface-to-
   scope table, gap list, revision-bound evidence, suite-unchanged).
2. `openspec/changes/vertical-closures/proposal.md` — closure proposal.
3. `openspec/changes/vertical-closures/specs/vertical-closures/spec.md` — closure
   requirements (R1–R6 pattern).
4. `openspec/changes/vertical-closures/tasks.md` — docs-only tasks; Review Workload
   Forecast (expected **well under 400 lines**, no code, no test edits).
5. `openspec/changes/vertical-closures/apply-progress.md` + `verify-report.md` +
   `archive-report.md`.
6. Optional reconciliation notes (no lifecycle change) in `sdd-060`, `sdd-070`,
   `sdd-080`, `sdd-090` READMEs recording their implemented slices and correcting
   the `skills:conformance` CLI claim in `sdd-070`.

### Size estimate

Docs-only. Estimated authored lines: ~250–350 across the README update and the
closure change's proposal/spec/tasks/apply/verify/archive. Comfortably within the
400-line review unit; **no chained PRs needed**.

---

## Risks / boundaries

- **No code changes.** Only docs under the SDD records and
  `openspec/changes/vertical-closures/`. `contracts/**`,
  `openspec/changes/archive/**`, and non-allowlisted program-root documents remain
  byte-identical → suite stays **843/843**.
- **Sibling-repo unverifiability (SDD-080):** any claim about `drenyra-engram`
  EvidenceObject/ed25519/audit-closure must be flagged `historical-snapshot /
  awaiting evidence`, never verified. SDD-080 stays active.
- **No lifecycle promotion on presence alone (R3/R4):** SDD-060/070/090 have real
  implemented cores but their *declared* cores are incomplete → they stay
  `planned`/`active`. Only SDD-050 meets the full R3/R4 closure bar.
- **Documentation discrepancy:** SDD-070's `skills:conformance` CLI claim is
  false (no such command); the conformance is a vitest suite. Correct the wording;
  do not implement the command in this change.
- **Frozen contracts:** the closure records the *existing* implemented surface; it
  adds no new authority, receipt type, or contract. No conformance vector or frozen
  contract is touched.

## Skill resolution

- `skill_resolution`: `paths-injected` (gentle-ai SKILL.md loaded before work).
