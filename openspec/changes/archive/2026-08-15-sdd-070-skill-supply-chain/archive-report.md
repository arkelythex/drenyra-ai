# Archive Report — SDD-070 Signed Skill Packs and Mission Pinning

**Change:** `sdd-070-skill-supply-chain` · **Program:** SDD-070 — Skills and Policy Supply Chain (Drenyra Dominion)
**Status:** PASS — first implementation slice archived. Program SDD-070 record stays `lifecycle:active`.
**Merged:** PR #62, squash commit `a70ae8f` on `main` (implementation commit `5158e12` on `feat/sdd-070-skill-supply-chain`, parent `04a91f0`).

## Executive summary

This slice delivered the two highest-leverage pending-core primitives of the SDD-070
supply chain as a pure `skills/` library: Ed25519-authenticated skill packs and
immutable mission skill pins. A checksum proves content consistency but a party that
can replace a skill can recompute it; the Ed25519 signature closes signer authenticity.
A bare `{ id, version }` mission reference could not prove the checksum, jurisdiction,
or vigencia accepted at mission start; mission pinning binds and freezes the full set.

Implementation is complete and green: suite 1158/1158 over 80 files, typecheck 0
errors, build OK, lint clean, CI 6/6. Verification PASS — 15/15 REQ-SK and 38/38
SC-SK, zero code findings. Two process findings from verification (stale task
checkboxes, missing TDD table) were remediated by the orchestrator before archive.

## Final state (what shipped, PR ref)

- **Commit:** `5158e12` (implementation), merged to `main` as `a70ae8f` via PR #62.
- **Files (exactly 6, 1773 insertions):** `skills/signature.ts` (374), `skills/pinning.ts` (431),
  `skills/index.ts` (+2 export lines), `skills/__tests__/signature.test.ts` (367),
  `skills/__tests__/pinning.test.ts` (524), `skills/__tests__/exports.test.ts` (75).
- **Protection:** zero diff on `flow/close.ts`, `receipts/`, `registry.ts` behavior,
  `pe.ts`, `cmd/`, `contracts/`, and `package.json` exports.

## Requirements verification

Verification reports PASS on all requirements and scenarios:

- **REQ-SK-001..015 — 15/15 PASS**, each mapped to implementation code paths and/or
  passing tests (signature over `canonicalSkillJson`, key-format reuse, complete
  checksum+signature verification, fail-closed tamper/malformed handling, full-set
  pinning, runtime immutability, vigencia semantics, no persistence, public surface,
  English artifacts, deferred rollback compatibility, determinism/purity).
- **SC-SK-001..038 — 38/38 PASS** (37 with direct test evidence; SC-SK-036 verified
  structurally as shape-compatible for a future `previousPack(history)` selector).
- **Runtime gates:** `bun run typecheck` 0 · `bun run build` OK · `bun run test`
  1158/1158 (baseline 1104 + 54 new: 19 signature + 32 pinning + 3 exports) ·
  `bun run lint` clean (175 files).
- **Crypto correctness:** `signSkillPack` and `verifySkillPackUnchecked` both use the
  identical UTF-8 bytes of `canonicalSkillJson(pack)` — zero divergence between
  signature and checksum canonicalization.

## Deliverables inventory

- `skills/signature.ts` — `SignedSkillPack` wrapper, `SkillPackSigningError` (closed
  codes), `SkillPackVerification` (discriminated), `signSkillPack`, `verifySkillPack`;
  re-exports `generateReceiptKeyPair`/`ReceiptKeyPair`; reuses the `node:crypto`
  Ed25519 pattern, does not reuse receipt sign/verify (different canonicalization).
- `skills/pinning.ts` — `MissionSkillPin`/`MissionSkillPinEntry`/`MissionSkillPinDenial`
  - 16-code closed denial vocabulary; `createMissionSkillPin`
  (`MissionSkillPinCreationResult`), `verifyMissionSkillPin`; deterministic ordering
  (binary id, then numeric semver), full-set membership, runtime freezing, no mutation
  of caller inputs.
- `skills/index.ts` — +2 barrel export lines only; no new package subpath, no
  export-map change.
- Tests — `signature.test.ts` (19), `pinning.test.ts` (32), `exports.test.ts` (3,
  runtime resolve via `dist/skills`, E2E flow, no-new-subpath).

## Deviations and decisions

1. **Size exception — 1773 lines vs 400 review unit** (forecast 1100–1400, outer
   800–1600). 5th occurrence in the program (425/588/1043/1601 precedent),
   user-approved continuation, single cohesive PR (chained split declined). No scope
   or proof dropped to meet a line target; `tasks.md` explicitly forbade that.
2. **Test-expectation corrections during GREEN — tests were wrong, not code:** (a)
   the design's valid branch carries the WRAPPER `pack: SignedSkillPack`, so checksum
   lives at `result.pack.pack.checksum`; (b) jurisdiction/validity are canonical
   content, so drift denials also carry `checksum-mismatch` (design preserves all
   dimensions). No production code changed as a result.
3. **No trusted-key authority — embedded keys prove consistency, not trust.**
   `verifySkillPack` requires the supplied key to equal `signed.signerPublicKey`;
   pin APIs re-verify each pack with its embedded key. This matches the documented
   non-goal (signer trust, expiry, revocation deferred).
4. **Exports-test build sequencing —** `drenyra-ai/skills` resolves to
   `dist/skills/index.js`, so the exports smoke requires a build before GREEN; the
   unit was sequenced accordingly (not a code defect).

## Findings resolution

Verification reported **PASS on implementation evidence** with two CRITICAL process
findings, both process-only (no code defect) and both remediated by the orchestrator
before archive:

- **(1) All 29 task checkboxes unchecked** in `tasks.md` at verify time → flipped 29/29
  to checked, reconciled against `apply-progress.md` and the verify report.
- **(2) Missing formal `TDD Cycle Evidence` table** in `apply-progress.md` → table
  written covering SIG-1..5, PIN-1..7, EX-1..3 (RED → GREEN → TRIANGULATE → REFACTOR).

Both are now closed; there are no unresolved FAIL, BLOCKED, or CRITICAL findings.

## Non-goals respected

- `flow/close.ts` — **zero diff**; `MonthlyCloseInput.igvSkill` stays a bare
  `{ id, version }` reference.
- No rollback — no `skills/rollback.ts`, no `compareVersions` export.
- No store/persistence/cache/filesystem/network/CLI/agent code.
- No trusted-key lifecycle; no LATAM packs beyond Peru; no `skills:conformance` CLI.
- **No capability-matrix promotion** — `vigencia-versioning`/`checksum-signature`/
  `rollback` stay `planned`; `pe-igv-validate` stays `implemented`. This slice does
  not claim the supply chain is complete.

## Lessons learned

1. **6th confirmation of forecast undercount.** Mandated tamper/malformed/full-set/
   vigencia/immutability/determinism coverage continues to land ~1.6× the midpoint
   estimate (1773 vs 1100–1400). The program should make the size exception the
   DEFAULT planning assumption for capability slices, not a deviation — or budget the
   outer range (1600+) as the primary estimate.
2. **The pi-lens phantom guard can block a subagent's edit tool mid-task.** The verify
   executor timed out partway through writing its report (a documented repo LSP defect
   where stale missing-export/implicit-any phantoms block edits on new files). The
   report was completed and the orchestrator remediated the two process findings;
   orchestrator recovery is the safety net when a delegated executor loses its edit
   tool.
3. **Deferred-canvas value confirmed.** Stopping before `flow/close.ts` wiring kept the
   slice pure, green, and independently testable while proving the exact contracts a
   later integration slice consumes.

## Follow-ups (NOT complete — program SDD-070 record stays lifecycle:active)

- **Rollback slice:** pure `previousPack(history)` selector + export/relocate
  `compareVersions` (SDD-070 governance amendment row `rollback`).
- **Live wiring:** consume pinned signed skills in `flow/close.ts` after the
  pinned-skill consumption decision (feeds SDD-050).
- **Full normative-source tracking:** complete provenance lifecycle; currently
  transitively bound via checksum/signature only.
- **Capability-matrix promotion pass:** after the program-level gate, promote the
  `vigencia-versioning`/`checksum-signature`/`rollback` rows from `planned` (consistent
  with prior slices; nothing promoted on this slice alone).

## Archive disposition

- Artifacts read: `explore.md`, `proposal.md`, `spec.md` (flat), `design.md`,
  `tasks.md`, `apply-progress.md`, `verify-report.md`, program README
  (`openspec/programs/drenyra-dominion/sdds/sdd-070-skills/README.md`).
- All 29 implementation task checkboxes checked; no `- [ ]` implementation-task
  markers remain; no stale-checkbox reconciliation was needed at archive time (the
  two process findings were remediated pre-archive).
- No destructive canonical spec merge occurred (flat spec, no sync-report; parent
  approved archive report only — no file moves, no commit, no sync fallback).
