# Tasks — Vertical Closures (SDD-050/060/070/080/090)

## Review Workload Forecast

- Estimated changed lines: ~120 (5 SDD records + change record)
- 400-line risk: **Low** — no chaining recommended
- Delivery: single PR (docs-only)

## Phase 0 — Setup/evidence

- [x] Freeze inspected revision and capture baseline: `bun run test` → 843/843, typecheck clean. Protected paths: `contracts/**`, archived change records, non-allowlisted program root docs. <!-- sdd-owner: implementation -->

## Phase 1 — Record reconciliation edits

- [x] SDD-050 record: lifecycle → `complete` (monthly-close core) with the implemented-surface mapping (`runMonthlyClose`, `AdapterRegistry`/`LocalFileAdapter`, e2e + unit tests) and revision-bound evidence; checklist updated; gaps (connectors → SDD-110, professional UI → SDD-100) recorded as follow-up slices. <!-- sdd-owner: implementation -->
- [x] SDD-060 record: reconciliation note — implemented core (`tenant-core/validateTenantScope`, `tenant-isolation/assertTenantReadScope`) recorded; RBAC/ABAC + SoD gaps recorded as follow-up slices; stays `lifecycle:active`. <!-- sdd-owner: implementation -->
- [x] SDD-070 record: reconciliation note — implemented core (`SkillRegistry`, `computeSkillChecksum`, `isSkillInForce`, `BASE_PE_SKILLS`) recorded; signing/vigencia/pinning/rollback gaps recorded; **wording correction: `skills:conformance` is a vitest suite (not a CLI command)**; stays `lifecycle:active`. <!-- sdd-owner: implementation -->
- [x] SDD-080 record: reconciliation note — `MEMORY_SHAPED_MARKERS` boundary recorded; federated integration + sibling-en gram core marked awaiting evidence (unverifiable from this clone); stays `lifecycle:active`. <!-- sdd-owner: implementation -->
- [x] SDD-090 record: reconciliation note — `guardian/runGuardianReview` (verdict "none", findings-only) recorded; dual refutation + full integration gaps recorded; stays `lifecycle:active`. <!-- sdd-owner: implementation -->
- [x] Write `apply-progress.md` (this batch). <!-- sdd-owner: implementation -->

## Phase 2 — Verification

- [x] Suite stays 843/843; typecheck green; protected paths unchanged; 12-SDD invariant; changed-line budget OK. <!-- sdd-owner: implementation -->
- [x] No capability claimed beyond evidence in any record; no lifecycle promoted for 060/070/080/090. <!-- sdd-owner: implementation -->

## Governance and lifecycle gates (parent-owned, post-apply)

- [ ] Post-apply bounded review per native review contract (RDD-off precedent). <!-- sdd-owner: parent -->
- [ ] Single-PR delivery + archive of the change. <!-- sdd-owner: parent -->
