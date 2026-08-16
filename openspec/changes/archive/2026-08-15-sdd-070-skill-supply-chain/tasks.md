# Tasks — SDD-070 Signed Skill Packs and Mission Pinning

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,100–1,400 (outer range 800–1,600) |
| 400-line budget risk | High |
| Chained PRs recommended | No (single cohesive PR, documented size exception per program precedent) |
| Suggested split | Single PR; fallback split at module boundary (PR1 signature → PR2 pinning) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High
```

Forecast rationale: mandated tamper, malformed-input, full-set, vigencia,
immutability, and determinism coverage dominates the estimate (design.md gives
1,102–1,440). This exceeds the configured 300-line budget; a single cohesive PR
with a documented size exception is recommended, consistent with program
precedent (approved exceptions at 425/588/1043/1601). If reviewability degrades
or the upper estimate is exceeded, split at the module boundary — signature
first, pinning second. Do not drop scope or proof to meet a line target.

## Scope recap and delivery shape

- Add two pure library primitives under `skills/`:
  - `skills/signature.ts` — `SignedSkillPack` wrapper + `signSkillPack` / `verifySkillPack` (Ed25519 over `canonicalSkillJson`).
  - `skills/pinning.ts` — `MissionSkillPin` + `createMissionSkillPin` / `verifyMissionSkillPin` (full-set binding, deterministic ordering, runtime immutability).
- Public surface: extend existing `skills/index.ts` only; no new package subpath, no export-map change.
- Non-goals (do NOT implement): wiring into `flow/close.ts`, registry ingress enforcement, `skills/rollback.ts`, `compareVersions` export, any store/persistence/cache/CLI/agent.
- Strict TDD, test runner `bun run test`. Each group runs RED → GREEN → TRIANGULATE/REFACTOR.
- All public identifiers, comments, and tests in English (REQ-SK-013).

## Phase 0 — Preflight

- [x] Confirm clean git tree (`git status --porcelain` empty) and record current HEAD revision. <!-- sdd-owner: implementation -->
- [x] Run `bun run test` and record the baseline (expected 1104/1104 at `04a91f0`); capture any pre-existing unrelated failures without normalizing them as new PASS. <!-- sdd-owner: implementation -->
- [x] Run `bun run typecheck` and `bun run build`; confirm both pass before starting RED. <!-- sdd-owner: implementation -->
- [x] Create `skills/__tests__/signature.test.ts`, `skills/__tests__/pinning.test.ts`, and `skills/__tests__/exports.test.ts` as empty stubs (RED starters). <!-- sdd-owner: implementation -->

## Phase 1 — RED / GREEN / TRIANGULATE / REFACTOR units

Each unit maps a design TDD group to a T-SK task. Sequence is RED (assert failing
behavior) → GREEN (minimum implementation) → TRIANGULATE/REFACTOR (add cases,
refactor without behavior change).

### Unit 1 — Signed pack types, signing, and verification (REQ-SK-001..005)

- [x] T-SK-001 — RED: write `skills/__tests__/signature.test.ts` group SIG-1: a `generateReceiptKeyPair` pair signs a valid Peru skill definition via `signSkillPack`; assert wrapper shape (pack, signerKeyId, signerPublicKey SPKI base64, signature base64), checksum unchanged, and `verifySkillPack(signed, keyPair.publicKey)` returns valid with `checksumValid` and `signatureValid` true. Assert fail on missing/incorrect exports. <!-- sdd-owner: implementation -->
- [x] T-SK-002 — RED: write SIG-2: nested-object key reordering still verifies (SC-SK-002); a shallow/top-level-only canonicalization signature is invalid (SC-SK-003, REQ-SK-002 divergence). <!-- sdd-owner: implementation -->
- [x] T-SK-003 — RED: write SIG-3: re-checksummed tampered content fails (SC-SK-010), mutated signature fails (SC-SK-011), wrong public key fails (SC-SK-012), each with distinguishable dimensions (REQ-SK-004). <!-- sdd-owner: implementation -->
- [x] T-SK-004 — RED: write SIG-4: malformed SPKI base64 public key (SC-SK-013) and malformed signature base64 (SC-SK-014) return invalid without throwing (REQ-SK-005). <!-- sdd-owner: implementation -->
- [x] T-SK-005 — RED: write SIG-5: equal pack + key pair produce identical signatures and canonical payloads (REQ-SK-015, SC-SK-037); source mutation cannot change the signed copy (REQ-SK-008). <!-- sdd-owner: implementation -->
- [x] T-SK-006 — GREEN: implement `skills/signature.ts` types, `SkillPackSigningError`, `SkillPackVerification`, `cloneSkillDefinition`, `signSkillPack`, and `verifySkillPack` per design D1–D6, D8, D10. Signing throws only `SkillPackSigningError` (closed codes); verification never throws and returns a frozen discriminated result. Reuse receipt key format via `ReceiptKeyPair` / `generateReceiptKeyPair`; copy the `node:crypto` Ed25519 pattern (do NOT reuse `signReceipt`/`verifyReceiptSignature`). Strict base64/DER decoding; 64-byte signature length check. Verify generated signature against the pair before returning. <!-- sdd-owner: implementation -->
- [x] T-SK-007 — TRIANGULATE/REFACTOR: run focused `bun run test` on `signature.test.ts`; add any missed malformed/canonical cases; refactor cloning and reason ordering without behavior change. Confirm all RED cases green. <!-- sdd-owner: implementation -->

### Unit 2 — Mission pin creation (REQ-SK-006..009)

- [x] T-SK-008 — RED: write `skills/__tests__/pinning.test.ts` group PIN-1: `createMissionSkillPin(packs, referenceDate)` binds full `{id,version,checksum,jurisdiction,vigencia}` per skill (SC-SK-015); pin is frozen; creation re-verifies every pack (REQ-SK-006). <!-- sdd-owner: implementation -->
- [x] T-SK-009 — RED: write PIN-2: duplicate identity denied (SC-SK-016); invalid signature/checksum, malformed candidate, invalid reference date, not-yet-valid, and lapsed-at-`to` all deny via `MissionSkillPinCreationResult` (design D5, D9). <!-- sdd-owner: implementation -->
- [x] T-SK-010 — RED: write PIN-3: same set in two caller orders yields identical, deterministically ordered pins (SC-SK-017); missing, additional, and duplicate sets deny (SC-SK-018..020). <!-- sdd-owner: implementation -->
- [x] T-SK-011 — RED: write PIN-4: checksum, version, jurisdiction, `from`, `to`, and open-ended-window drift return typed denial dimensions (REQ-SK-009). <!-- sdd-owner: implementation -->
- [x] T-SK-012 — RED: write PIN-5: `from === referenceDate` in force (SC-SK-030), `to === referenceDate` lapsed (SC-SK-031), before `from` not in force (SC-SK-032), open-ended passes after `from` (SC-SK-033) — REQ-SK-011. <!-- sdd-owner: implementation -->
- [x] T-SK-013 — RED: write PIN-6: pins, entries, vigencia, arrays, and denials are frozen; source pack mutation after pinning leaves the pin unchanged and later verification fails (SC-SK-021..022, REQ-SK-008). <!-- sdd-owner: implementation -->
- [x] T-SK-014 — RED: write PIN-7: reversed caller order gives deeply equal pins; repeated calls and interleaved calls are deterministic and stateless (SC-SK-017, SC-SK-029, REQ-SK-010/015). <!-- sdd-owner: implementation -->
- [x] T-SK-015 — GREEN: implement `skills/pinning.ts` types (`MissionSkillPinEntry`, `MissionSkillPin`, `MissionSkillPinDenial`, `MissionSkillPinCreationResult`, `MissionSkillPinVerification`, `MissionSkillPinDenialCode`), private semver comparator, `createMissionSkillPin`, and `verifyMissionSkillPin` per design D5, D7–D10. Creation re-verifies every pack with its embedded key, requires in-force at referenceDate, rejects duplicates, sorts fresh projection deterministically (binary id, then numeric semver), freezes all returned graphs, never throws, never mutates/aliases caller inputs. <!-- sdd-owner: implementation -->
- [x] T-SK-016 — TRIANGULATE/REFACTOR: run focused `bun run test` on `pinning.test.ts`; confirm denial reason ordering follows the declared closed code order then identity; refactor without behavior change. <!-- sdd-owner: implementation -->

### Unit 3 — Export smoke (REQ-SK-012, SC-SK-034)

- [x] T-SK-017 — RED: write `skills/__tests__/exports.test.ts`: import `signSkillPack`, `verifySkillPack`, `createMissionSkillPin`, `verifyMissionSkillPin`, `SignedSkillPack`, `MissionSkillPin`, `generateReceiptKeyPair`, `ReceiptKeyPair` from the skills module root via the existing `./skills` subpath — no internal-file import. Assert all resolve. <!-- sdd-owner: implementation -->
- [x] T-SK-018 — GREEN: extend `skills/index.ts` with `export * from "./signature.js";` and `export * from "./pinning.js";`. No other barrel, no export-map, no new subpath change. <!-- sdd-owner: implementation -->
- [x] T-SK-019 — TRIANGULATE: run focused `bun run test` on `exports.test.ts`; confirm the existing `./skills` subpath imports still resolve and no new subpath is introduced (REQ-SK-012). <!-- sdd-owner: implementation -->

## Phase 2 — Gates

- [x] T-SK-020 — Run `bun run typecheck`; fix any type errors introduced by the new modules. <!-- sdd-owner: implementation -->
- [x] T-SK-021 — Run `bun run build`; fix any build errors. <!-- sdd-owner: implementation -->
- [x] T-SK-022 — Run full `bun run test`; all new tests pass and the baseline count advances by the expected delta; report any pre-existing unrelated failures separately, never as new PASS. <!-- sdd-owner: implementation -->
- [x] T-SK-023 — Confirm no non-goal artifacts exist: no `flow/close.ts` wiring, no `skills/rollback.ts`, no `compareVersions` export, no store/persistence/CLI/agent code introduced. <!-- sdd-owner: implementation -->

## Phase 3 — Close

- [x] Update `openspec/changes/sdd-070-skill-supply-chain/` change record: mark apply complete, record actual changed-line count and any split taken. <!-- sdd-owner: implementation -->
- [x] Orchestrator commits the change (conventional commit) and opens the PR; if split fallback is used, open signature PR first then pinning PR per the chain strategy. <!-- sdd-owner: parent -->

## Acceptance mapping

| Requirement | Tasks |
|---|---|
| REQ-SK-001..005 | T-SK-001..007 |
| REQ-SK-006..009 | T-SK-008..016 |
| REQ-SK-010, REQ-SK-011 | T-SK-013..016 |
| REQ-SK-012 | T-SK-017..019 |
| REQ-SK-013 | all units (English surface) |
| REQ-SK-014 | non-goal guard T-SK-023; shape retained, no rollback introduced |
| REQ-SK-015 | T-SK-005, T-SK-014 (determinism/purity) |

## Notes for apply

- Strict TDD is active. Do not fall back to Standard Mode; follow RED → GREEN → TRIANGULATE → REFACTOR.
- Keep the discriminated `MissionSkillPinCreationResult` return type for `createMissionSkillPin`; do not collapse to an unconditional `MissionSkillPin` (design D5, REQ-SK-015).
- Reuse existing contracts: `canonicalSkillJson` and `computeSkillChecksum` (`skills/types.ts`, `skills/registry.ts`), `SkillDefinition`/`SkillValidity`/`IsoDate` (`skills/types.ts`), `ReceiptKeyPair` and `generateReceiptKeyPair` (`receipts/types.ts`, `receipts/sign.ts`).
- Signing canonical payload MUST be the UTF-8 bytes of `canonicalSkillJson(pack)` — the same representation used by the checksum (D2).
- Do not introduce `signedAt` automatically; signing never reads the clock (D1, D9).
