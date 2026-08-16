# Apply Progress — sdd-070-skill-supply-chain (Signed Packs + Mission Pinning)

> Phase: apply · Branch: `feat/sdd-070-skill-supply-chain` · Commit: `5158e12` · PR: #62
> Status: implementation complete and green; verification PASS 15/15 REQ-SK + 38/38 SC-SK (2 process findings remediated by orchestrator).

## Scope delivered

| File | Purpose |
| --- | --- |
| `skills/signature.ts` (374) | `signSkillPack`/`verifySkillPack` over `canonicalSkillJson` (same canonical as checksum); Ed25519 via `generateReceiptKeyPair` key format (SPKI DER base64 pub / PKCS8 DER base64 priv); node:crypto pattern; receipt `sortedStringify`-bound functions NOT reused |
| `skills/pinning.ts` (431) | `createMissionSkillPin` (re-verifies every pack, frozen, deterministic ordering, duplicates rejected, `MissionSkillPinCreationResult`) + `verifyMissionSkillPin` (checksum + signature + id/version/jurisdiction + vigencia at referenceDate + full-set; 16-code denial vocabulary) |
| `skills/index.ts` | +2 export lines (`./signature.js`, `./pinning.js`) — barrel only, no new subpath |
| `skills/__tests__/signature.test.ts` (367) | SIG-1..5: 19 tests |
| `skills/__tests__/pinning.test.ts` (524) | PIN-1..7: 32 tests |
| `skills/__tests__/exports.test.ts` (75) | EX-1..3: 3 tests (runtime resolve via dist, E2E flow, no-new-subpath) |

Untouched: `flow/close.ts`, `receipts/`, `registry.ts` behavior, `pe.ts`, `cmd/`, `contracts/`, `package.json` exports. No `rollback.ts`, no `compareVersions` export (deferred per non-goal).

## TDD Cycle Evidence (strict TDD, RED → GREEN → TRIANGULATE → REFACTOR)

| Unit (tasks) | Test File | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- |
| SIG-1..5 (T-SK-001..007) | `signature.test.ts` | ✅ 19/19 fail (missing exports) | ✅ 19/19 pass | ✅ 2+ cases/behavior (canonical, tamper, malformed key/sig, wrong key, determinism, mutation) | ✅ cleaned unused destructure |
| PIN-1..7 (T-SK-008..016) | `pinning.test.ts` | ✅ 32/32 fail (missing exports) | ✅ 32/32 pass | ✅ 2+ cases/behavior (drift, vigencia boundaries, membership, duplicates, immutability) | ✅ `entry` unused destructure fixed (TS6133) |
| EX-1..3 (T-SK-017..019) | `exports.test.ts` | ✅ 2/3 fail (stale dist) | ✅ 3/3 pass (after build) | ✅ 3 assertions: runtime resolve, E2E behavior, no-new-subpath | ➖ none needed |

Test-expectation corrections during GREEN (tests were wrong, not code): (1) design's valid branch carries the WRAPPER `pack: SignedSkillPack` → checksum at `result.pack.pack.checksum`; (2) jurisdiction/validity are canonical content, so drift denials also carry `checksum-mismatch` (design preserves all dimensions).

## Deviations (documented)

1. **Size exception** — 1773 added lines (forecast 1100-1400, outer 800-1600; review unit 400): mandated SC-SK coverage under strict TDD; 5th in program (425/588/1043/1601); user-approved continuation. No scope/proof dropped.
2. **Exports test sequencing** — `drenyra-ai/skills` resolves to `dist/skills/index.js`, so the exports smoke requires a build before GREEN (sequenced accordingly).
3. **pi-lens LSP phantoms** — missing-export/implicit-any errors on the new files are stale-cache (documented repo LSP defect). Refuted: `bun run typecheck` (tsc --noEmit strict, authoritative) 0 errors — implicit-any would fail strict; exports present in `skills/index.ts`; suite 1158/1158 runs these exact files; CI typecheck green.

## Gates (run at apply close + independently re-run by verifier)

- `bun run test` → **1158/1158** (80 files; baseline 1104 + 54 = 19 sig + 32 pin + 3 exports; 0 failures)
- `bun run typecheck` → 0 errors · `bun run build` → OK · `bun run lint` (biome) → clean (175 files)
- `git show --stat 5158e12` → exactly 6 files, 1773 insertions; protected paths zero diff
