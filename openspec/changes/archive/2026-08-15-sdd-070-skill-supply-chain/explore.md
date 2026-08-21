# Exploration — SDD-070 First Slice: Skill Pack Signature + Mission Pinning + Rollback

> Purpose: size the FIRST SLICE of SDD-070's pending core — skill-pack Ed25519
> signature, mission pinning, and rollback — against the existing implemented PE
> skill-registry surface and the Ed25519 receipt precedent. Read-only: this file
> writes no code; the suite stays at its baseline (1104/1104 at `main` `04a91f0`).
>
> Scope: `drenyra-ai` only. All claims below are verified against exact paths and
> symbols in this clone. The governance amendment (W3) and the 2026-08-15
> reconciliation record the pending core: signature, mission pinning, rollback,
> and normative-source tracking partial. None of those four are claimed
> implemented today (R17); the matrix rows `vigencia-versioning` /
> `checksum-signature` / `rollback` stay `planned`.

## Purpose

SDD-070 makes accounting/fiscal knowledge verifiable and versioned. The already
implemented PE registry proves content integrity (SHA-256 checksum) and temporal
validity (vigencia), but content can still be tampered with *and re-checksummed* by
an attacker who controls the store, and nothing binds a skill set to a running
mission. This first slice closes the two highest-leverage gaps with a pure library
layer:

1. **Signature** — Ed25519 authenticity on every skill pack, reusing the receipt
   signing machinery already in the repo.
2. **Mission pinning** — a pure, immutable pin binding `{id, version, checksum,
   jurisdiction, vigencia}` to a mission, with no mutation and no live wiring.

Rollback is assessed and designed at the library level but **deferred** in the
recommended slice.

## Current-state inventory

### 1. Skills module surface (`skills/`)

All claims verified in this clone.

**`skills/types.ts`**

- `SkillDefinition` (interface, lines 31–71): `id`, `version`, `jurisdiction`,
  `validity: SkillValidity`, `normativeSources`, `inputs`, `outputs`,
  `requiredPermissions`, `maxAutonomy: Materiality`, `contractCompatibility`,
  `checksum: string` (SHA-256 hex), `retirementPolicy`.
- `SkillValidity` (lines 17–24): `{ from: IsoDate, to?: IsoDate }` — `to` exclusive.
- `SkillError` (lines 30–54): codes `SKILL_INVALID`, `SKILL_CHECKSUM_MISMATCH`,
  `SKILL_NOT_FOUND`, `SKILL_OUT_OF_VALIDITY`, `SKILL_JURISDICTION_MISMATCH`.
- `canonicalSkillJson(skill)` (lines 74–82): **recursive** key-sorted JSON with
  `checksum` set to `undefined` before sorting (so the checksum is stable and
  excludes itself).

**`skills/registry.ts`**

- `computeSkillChecksum(skill)` (line 35): `sha256(canonicalSkillJson(skill))`
  hex — content-derived, excludes the checksum field itself.
- `validateSkill(skill)` (line 42): structural + checksum-format validation.
- `isSkillInForce(skill, at)` (line 109): inclusive `from`, **exclusive** `to`
  (lapsed at `to`), undefined `to` = forever.
- `compareVersions(a, b)` (line ~101): private semver-numeric comparator —
  **NOT exported**.
- `class SkillRegistry` (line 129): `register` (line 132, fails closed on checksum
  mismatch with `SKILL_CHECKSUM_MISMATCH`), `list`, `resolveVersion`, `resolveAt`.

**`skills/pe.ts`** — `make()` helper computes the checksum after constructing each
definition (lines 21–40); `BASE_PE_SKILLS` (line 102) = `IGV_VALIDATE`,
`SIRE_COMPARE`, `DETRACTION_CHECK`, `RETENTION_CHECK`, `PERCEPTION_CHECK`,
`SIRE_FILING` (6 skills, all `PE`, `validity.from "2026-01-01"`, `R1`/`R2`).

**`skills/index.ts`** — `export *` of `types`, `registry`, `pe`.

### 2. Ed25519 precedent (`receipts/`)

**`receipts/sign.ts`** (read in full):

- `generateReceiptKeyPair(keyId?)` — `generateKeyPairSync("ed25519")`; `publicKey`
  exported **SPKI DER, base64**; `privateKey` exported **PKCS8 DER, base64**;
  `keyId` default `key_` + 4 random hex bytes.
- `signReceipt(content, privateKeyBase64, keyId)` — canonical payload =
  `sortedStringify(content)`; Ed25519 `sign`; signature **base64**; returns
  `{ signature, canonicalPayload }`.
- `buildSignedReceipt(content, keyPair, protocolVersion?, receiptType?)` — full
  `SignedReceipt` bundle incl. `receiptHash` (via `generateReceiptHash`), algorithm
  `"Ed25519"`, `signerKeyId`, `signerPublicKey`, `signature`, `issuedAt`.

**`receipts/verify.ts`** (read in full):

- `verifyReceiptIntegrity` — recomputes SHA-256 and `timingSafeEqual` against the
  asserted hash.
- `verifyReceiptSignature(content, signatureBase64, publicKeyBase64)` — recreates
  `sortedStringify(content)`, `createPublicKey` SPKI DER base64, Ed25519 `verify`;
  returns `false` for any invalid input (fail-closed, never throws).
- `verifySignedReceipt(receipt)` — `{ valid, hashValid, signatureValid, keyId,
  protocolVersion }`.
- `verifySignedReceiptTrusted(receipt, resolveKey)` — full lifecycle: payload
  tamper → signature → signer recognition (`KeyTrustResolver`) → key current →
  revoked → `SIGNER_TRUSTED`.

**`receipts/canonical.ts`** — `sortedStringify(obj)` is **shallow** (top-level keys
sorted only; nested objects/arrays keep original order). Contrast with
`canonicalSkillJson` which is **recursive**.

**`receipts/types.ts`** — `ReceiptKeyPair { publicKey, privateKey, keyId }`;
`SignedReceipt`; `SigningKeyInfo { keyId, publicKey, issuedAt, expiresAt?,
revokedAt? }`; `KeyTrustResolver`.

**`receipts/index.ts`** — exports `sortedStringify`, `generateReceiptKeyPair`,
`signReceipt`, `buildSignedReceipt`, `verifyReceiptIntegrity`,
`verifyReceiptSignature`, `verifySignedReceipt`, `verifySignedReceiptTrusted`,
`computeEvidenceHash`, `generateReceiptHash`, and all types.

**Import direction (verified):** `receipts/*` never imports `skills/*`
(zero matches). Therefore `skills/signature.ts` may import from `receipts` with **no
circular-dependency risk**.

### 3. Mission-pinning integration point (`flow/close.ts`)

- `MonthlyCloseInput.igvSkill` (line 69): a **bare** `{ id: string; version:
  string }` reference — no checksum, no signature, no jurisdiction/vigencia binding.
- `runMonthlyClose` (line ~196–208) consumes it only by writing it into the receipt
  content's `skill` field via `buildSignedReceipt`. **No validation, no pinning, no
  registry lookup** — the skill version is merely *noted* in the receipt.
- This is the live consumer where a pinned skill set would eventually bind. Per the
  reconciliation, wiring pinning into `flow/close.ts` is a **follow-up**, not this
  slice.

### 4. Rollback gaps

- No rollback mechanism exists anywhere (`registry.ts` only registers/resolves;
  no history, no revert).
- `compareVersions` is **private** — any rollback ordering logic needs it exported
  or re-derived.

## Gap analysis

| Gap | Current state | This slice's target |
|-----|---------------|---------------------|
| **Signature** | `computeSkillChecksum` = SHA-256 only; no Ed25519 authenticity; tamper can re-checksum. | Ed25519 signature over each skill's canonical payload; verify on every pack. |
| **Mission pinning** | No pinning API; `flow/close.ts` passes bare `{id,version}`. | Pure `skills/pinning.ts`: create/verify immutable mission pin binding `{id,version,checksum,jurisdiction,vigencia}`. |
| **Rollback** | Absent; `compareVersions` private. | Pure previous-pack selector (immutable, non-mutating). **Deferred** in recommended slice. |
| **Normative-source tracking** | Partial (jurisdiction on skills; `normativeSources` list). | Out of scope this slice; stays partial. |

## Design sketch

### Signed skill pack

Two viable shapes:

- **A1 — extend `SkillDefinition`:** add an optional `signature?: string` field.
  Pros: minimal, packs stay one object. Cons: `canonicalSkillJson` already
  strips `checksum`; it must now also strip `signature`; checksum and signature
  interplay must be explicit; a single object conflates content and provenance.
- **A2 — `SignedSkillPack` wrapper (recommended):** `{ pack: SkillDefinition,
  signerKeyId: string, signerPublicKey: string, signature: string, signedAt?:
  string }`. Keeps the checksum clean (content-only) and provenance separate, and
  mirrors the existing `SignedReceipt` shape the codebase already understands.

**Canonicalization decision:** the checksum already signs over `canonicalSkillJson`
(**recursive**). The receipt machinery signs over `sortedStringify` (**shallow**).
To keep skills self-consistent (checksum and signature over the same bytes), the
signature MUST cover the **same canonical payload as the checksum** —
`canonicalSkillJson(pack)`. Therefore:

- **Reuse:** `generateReceiptKeyPair` (identical key format — SPKI DER base64
  public, PKCS8 DER base64 private), the `ReceiptKeyPair` type, and the `node:crypto`
  `sign`/`verify` + `createPublicKey` pattern from `receipts/verify.ts`
  (`verifyReceiptSignature`).
- **Do not reuse verbatim:** `signReceipt`/`verifyReceiptSignature` are bound to
  `sortedStringify`. Passing a `SignedSkillPack` through them would sign a
  *different* canonicalization than the checksum. So add a thin `skills/signature.ts`
  that reuses the key format + the exact `createPublicKey`/`verify` crypto but signs
  `canonicalSkillJson`. This is reuse of machinery + key conventions, not a
  duplicated crypto stack. Alternative (lower reuse-fidelity): import
  `sortedStringify` from `receipts` and make the skill signature cover that shallow
  form, diverging from the checksum canonical — rejected as it creates two
  canonicals for one pack.

**Verify surface:** `verifySkillPack(pack): { valid, checksumValid, signatureValid }`
with tamper and vigencia checks. Every pack entering the registry verifies signature

- checksum (fails closed).

### Pinning API (`skills/pinning.ts`, pure)

- `SkillPin { missionId: string; pinnedAt: IsoDate; entries: readonly
  PinnedSkill[] }` where `PinnedSkill = { id, version, checksum, jurisdiction,
  vigencia: SkillValidity }`.
- `createPin(missionId, skills: readonly SkillDefinition[]): SkillPin` — snapshots
  the per-skill identity fields, all `readonly` (immutable by construction).
- `verifyPin(pin, skills: readonly SkillDefinition[]): { valid: boolean; reason?:
  string }` — re-derives each entry's checksum/vigencia from the provided skill set
  and asserts it matches the pin; any mismatch fails.
- Immutability is structural (readonly + checksum-bound), matching "pinned content
  is immutable for the active mission" and "never rewrites the past".
- **No wiring into `flow/close.ts` this slice** (established non-goal precedent).

### Rollback semantics (`skills/rollback.ts`, pure, deferred)

- Given an **ordered** pack history (newest → oldest), `previousPack(history)` returns
  the *previous* signed pack by `compareVersions` — a pure selector, **no mutation**
  (a returned reference; history untouched).
- "Never rewrites the past" = the function never mutates history or drops a signed
  pack; it only selects. "Started missions keep their pinned versions" = a mission's
  `SkillPin` is unaffected because pinning is a separate immutable snapshot.
- Requires exporting `compareVersions` from `skills/registry.ts` (currently private)
  or re-deriving it locally.

## First-slice options

| Option | Contents | Relative size | Risk |
|--------|----------|---------------|------|
| **A (recommended)** | Signature (A2 wrapper + `skills/signature.ts` verify) + pinning (`skills/pinning.ts`), pure library, unit tests; rollback deferred. | Medium | Low |
| **B** | A + rollback (`skills/rollback.ts` + export `compareVersions`). | Medium+ | Low–medium |
| **C** | A/B + wiring into `flow/close.ts` (live consumer replaces bare `igvSkill` with pinned set). | Large | Medium–high |

All options need `compareVersions` exported for the rollback branch; Option A can
avoid it by deferring rollback.

## Recommendation

**Option A — signature + mission pinning, pure library, unit tests; rollback
deferred.** This is the smallest vertical slice that independently satisfies two of
SDD-070's four core threats (tampered content, unpinned mid-mission drift) with zero
risk to the live close path, and it establishes the `SignedSkillPack` shape that
rollback (Option B) and live wiring (Option C) later build on.

**Honest changed-line estimate:** ~1100–1400 authored lines. Lesson from the
vertical-closures and prior slices: mandated-coverage forecasts undercount ~2×. Even
the minimal Option A includes, per the SDD-070 README test/metric contract: signature
verification on every pack, pinning immutability, and **tamper tests** — so the
expectation is **~800–1600**; the recommendation sits mid-range.

## Non-goals

- **No wiring into `flow/close.ts`** — the bare `igvSkill {id, version}` stays this
  slice (consumption is a follow-up; established in the reconciliation).
- **No full normative-source tracking completion** — `normativeSources` remain lists;
  jurisdiction already present. Stays partial.
- **No registry persistence/store** — pinning and rollback are pure in-memory
  libraries; no store is introduced.
- **No rollback in Option A** (deferred to Option B).
- **No LATAM packs** — Peru only.
- **No conformance CLI** — PE conformance remains the vitest suites; no
  `skills:conformance` command is added (corrected in reconciliation).

## Risks

1. **Canonicalization divergence** — if the signature covers a different canonical
   payload than the checksum, pack self-consistency breaks and cross-language
   verification drifts. Mitigated by signing `canonicalSkillJson` (same as checksum)
   and reusing the exact `node:crypto` Ed25519 pattern + key format from receipts.
2. **Scope creep toward live wiring** — Option A's purity is the whole point; pulling
   `flow/close.ts` into this slice raises risk and size substantially. Guard by
   keeping the non-goal explicit in the spec.
3. **Forecast undercount** — mandated tamper/vigencia/immutability coverage tends to
   land ~2× the naive estimate. Budgeted at ~1100–1400; any single-slice pressure
   beyond ~1600 points to splitting (signature first, then pinning) via chained PRs.

## Test / metric hints

- **Signature:** every `SignedSkillPack` verifies signature + checksum (fails
  closed); tampered content (flip a field or the signature bytes) → invalid.
- **Pinning immutability:** a `SkillPin` created for a mission must reject a changed
  skill (different checksum/version/vigencia); pin entries are `readonly`.
- **Vigencia:** signature and pinning honor the exclusive-`to` window
  (`isSkillInForce`), matching the existing `registry.test.ts` in-force coverage.
- Suites to extend: new `skills/__tests__/signature.test.ts` and
  `skills/__tests__/pinning.test.ts`; baseline suite 1104/1104 stays green.

## Skill resolution

- `skill_resolution`: `paths-injected` — no registry skill matched this read-only
  mapping task (checked `.atl/skill-registry.md`); proceeded directly.
