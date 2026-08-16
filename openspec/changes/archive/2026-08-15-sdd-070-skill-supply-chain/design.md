# Design — Signed Skill Packs and Mission Pinning

## Overview

This change adds two pure integrity primitives to `skills/`: Ed25519-authenticated `SignedSkillPack` values whose signature covers exactly `canonicalSkillJson(pack)`, and immutable `MissionSkillPin` snapshots binding the complete supplied skill set by id, version, checksum, jurisdiction, and vigencia.

The design stays in the approved library layer. It imports only existing local library contracts and `node:crypto`; it adds no agent, command, storage, network, registry-ingress, or close-flow behavior.

```text
candidates/types <- skills/types <- skills/registry
receipts/types + receipts/sign <- skills/signature <- skills/pinning
                                              \----> skills/index
```

`receipts/` does not import `skills/`, so this direction is circular-safe. Receipt payload helpers are not reused because they use a different, shallow serialization.

## Decisions

### D1 — Separate content from provenance

`SignedSkillPack` wraps `SkillDefinition`; it does not add signature fields to the definition.

**Rationale:** checksum calculation already defines content identity and excludes only `checksum`. A wrapper keeps provenance outside content identity and supports a later immutable history selector.

The wrapper carries `pack`, `signerKeyId`, `signerPublicKey`, `signature`, and optional `signedAt`. `signSkillPack(pack, keyPair)` does not synthesize `signedAt`, because the API cannot read the clock. Wrapper provenance is not part of the signed payload.

### D2 — One canonical payload

Checksum and signature operations both use the UTF-8 bytes of `canonicalSkillJson(pack)`. No signature-specific serializer is introduced.

**Rationale:** recursive key sorting is already the skill content contract. `signReceipt` and `verifyReceiptSignature` are bound to shallow `sortedStringify`; reusing them would create two incompatible representations.

### D3 — Reuse receipt key contracts, not receipt signing functions

`skills/signature.ts` imports `ReceiptKeyPair` from `receipts/types.ts` and re-exports `generateReceiptKeyPair` from `receipts/sign.ts` through the skills barrel. It copies the `node:crypto` pattern: `createPrivateKey` plus `sign`, and `createPublicKey` plus `verify`, using PKCS8/SPKI DER base64.

**Rationale:** this preserves the established portable key format while preventing canonicalization drift. `receipts/` remains independent from `skills/`.

### D4 — Construction errors versus verification denials

`signSkillPack` is a construction boundary: it returns a complete frozen value or throws `SkillPackSigningError` with a closed code. Verification consumes untrusted artifacts and never throws; it returns a discriminated result with closed reasons and independent checksum/signature booleans.

**Rationale:** malformed private material cannot produce a meaningful signed value. Untrusted verification must instead fail closed, matching the authorization construction-versus-decision precedent.

### D5 — Pin creation is a fail-closed decision

The concrete return type of `createMissionSkillPin` is `MissionSkillPinCreationResult`. Its success branch contains a pin; its denial branch contains no pin.

**Rationale:** the normative spec says pinning never throws for malformed input. An unconditional `MissionSkillPin` return cannot represent invalid signatures, duplicates, invalid dates, or lapsed skills without throwing. The requested shorthand `createMissionSkillPin(...) -> MissionSkillPin` therefore describes the success branch, not the total function. This is the only input conflict found.

### D6 — Embedded-key verification is consistency, not organizational trust

`verifySkillPack(signed, publicKey)` requires the supplied key to exactly equal `signed.signerPublicKey` before crypto verification. Pin APIs call it with each wrapper's embedded key.

**Rationale:** direct callers can supply an expected key and detect embedded-key substitution. Pin APIs establish portable cryptographic consistency only; trusted signer authorization, expiry, and revocation remain out of scope.

### D7 — Exact sets use canonical order

Pin entries sort by binary string comparison of `id`, then numeric three-part semver. Duplicate `{id, version}` identities are denied.

**Rationale:** caller array order is not mission identity. Binary comparison avoids locale dependence; validated `x.y.z` versions allow a private comparator without exporting the registry's deferred rollback helper.

### D8 — Copy and freeze all returned graphs

Signing copies every mutable part of `SkillDefinition`, freezes fresh arrays, the copied validity window, pack, and wrapper. Successful verification returns another fresh frozen copy. Pin creation copies scalar bindings into fresh frozen vigencia objects and entries, then freezes the entries array and pin.

**Rationale:** TypeScript `readonly` is compile-time only. Fresh copies plus `Object.freeze` prevent caller mutation and mutable aliases. Caller inputs are never frozen or mutated.

### D9 — Explicit dates, no ambient state

Pin creation and verification validate caller-supplied `IsoDate` and call `isSkillInForce(pack, referenceDate)`. They never read a clock, environment, file, database, network, or retained module state.

**Rationale:** equal inputs must yield equal outputs. Vigencia remains inclusive at `from`, exclusive at `to`, and open-ended when `to` is absent.

### D10 — Preserve all observed failure dimensions

Pack verification computes checksum and signature outcomes independently whenever shape permits. Its denial carries a deterministic, frozen, deduplicated reason array. Pin verification also accumulates deterministic reasons after validating the complete collection.

**Rationale:** checksum-only and signature-only failures must be distinguishable; arbitrary first-error behavior would hide relevant integrity failures.

## Module layout and file map

```text
skills/
  types.ts                         existing; unchanged
  registry.ts                      existing; unchanged
  signature.ts                     new types, crypto, cloning, sign/verify
  pinning.ts                       new pin types, ordering, create/verify
  index.ts                         extend existing barrel only
  __tests__/
    signature.test.ts              signing, tamper, malformed crypto
    pinning.test.ts                set, drift, date, immutability
    exports.test.ts                skills-root export smoke
receipts/
  sign.ts                          reused key generator; unchanged
  types.ts                         reused ReceiptKeyPair; unchanged
openspec/changes/sdd-070-skill-supply-chain/
  design.md                        this artifact
```

A lean two-module split is preferred over a new directory. Signature owns the signed wrapper and crypto boundary; pinning owns mission-set projection and comparison. Unlike the larger authorization feature, this slice does not need another internal barrel.

## Type definitions

Illustrative TypeScript; public names and closed vocabularies are normative for apply.

```ts
import type { ReceiptKeyPair } from "../receipts/types.js";
import type { IsoDate, SkillDefinition, SkillValidity } from "./types.js";

export interface SignedSkillPack {
  readonly pack: SkillDefinition;
  readonly signerKeyId: string;
  readonly signerPublicKey: string; // SPKI DER base64
  readonly signature: string;       // Ed25519 base64
  readonly signedAt?: IsoDate;
}

export type SkillPackSigningErrorCode =
  | "invalid-skill-definition"
  | "checksum-mismatch"
  | "malformed-private-key"
  | "malformed-public-key"
  | "key-pair-mismatch";

export class SkillPackSigningError extends Error {
  readonly code: SkillPackSigningErrorCode;
}

export type SkillPackVerificationReason =
  | "malformed-signed-pack"
  | "checksum-mismatch"
  | "malformed-public-key"
  | "public-key-mismatch"
  | "malformed-signature"
  | "signature-invalid";

export type SkillPackVerification =
  | {
      readonly valid: true;
      readonly checksumValid: true;
      readonly signatureValid: true;
      readonly pack: SignedSkillPack;
    }
  | {
      readonly valid: false;
      readonly checksumValid: boolean;
      readonly signatureValid: boolean;
      readonly error: {
        readonly code: "skill-pack-verification-failed";
        readonly reasons: readonly SkillPackVerificationReason[];
      };
    };

export interface MissionSkillPinEntry {
  readonly id: string;
  readonly version: string;
  readonly checksum: string;
  readonly jurisdiction: string;
  readonly vigencia: SkillValidity;
}

export interface MissionSkillPin {
  readonly entries: readonly MissionSkillPinEntry[];
}

export type MissionSkillPinDenialCode =
  | "malformed-pin"
  | "malformed-candidate-set"
  | "invalid-reference-date"
  | "duplicate-pin-identity"
  | "duplicate-candidate-identity"
  | "missing-skill"
  | "additional-skill"
  | "id-mismatch"
  | "version-mismatch"
  | "checksum-mismatch"
  | "jurisdiction-mismatch"
  | "vigencia-mismatch"
  | "skill-out-of-force"
  | "candidate-malformed"
  | "candidate-public-key-invalid"
  | "candidate-signature-invalid";

export interface MissionSkillPinDenial {
  readonly code: "mission-skill-pin-denied";
  readonly reasons: readonly {
    readonly code: MissionSkillPinDenialCode;
    readonly identity?: string;
  }[];
}

export type MissionSkillPinCreationResult =
  | { readonly valid: true; readonly pin: MissionSkillPin }
  | { readonly valid: false; readonly denial: MissionSkillPinDenial };

export type MissionSkillPinVerification =
  | { readonly valid: true }
  | { readonly valid: false; readonly denial: MissionSkillPinDenial };
```

When present, denial `identity` is only safe `${id}@${version}` metadata. Denials never contain content, keys, signatures, or mutable causes. Reason arrays use the declared closed order and are frozen.

## Function signatures

```ts
export { generateReceiptKeyPair } from "../receipts/sign.js";
export type { ReceiptKeyPair } from "../receipts/types.js";

export function signSkillPack(
  pack: SkillDefinition,
  keyPair: ReceiptKeyPair,
): SignedSkillPack;

export function verifySkillPack(
  signed: SignedSkillPack,
  publicKey: string,
): SkillPackVerification;

export function createMissionSkillPin(
  signedPacks: readonly SignedSkillPack[],
  referenceDate: IsoDate,
): MissionSkillPinCreationResult;

export function verifyMissionSkillPin(
  pin: MissionSkillPin,
  packs: readonly SignedSkillPack[],
  referenceDate: IsoDate,
): MissionSkillPinVerification;
```

### Signing flow

1. Run `validateSkill`, recompute with `computeSkillChecksum`, and translate failures to `SkillPackSigningError`.
2. Strictly decode PKCS8 and SPKI base64 and construct Ed25519 key objects.
3. Compute `canonicalSkillJson(pack)` once and sign its UTF-8 bytes.
4. Verify the generated signature against `keyPair.publicKey`; reject mismatched pairs.
5. Return a fresh deeply frozen wrapper without adding `signedAt`.

Strict base64 decoding rejects empty, non-alphabet, incorrectly padded, or non-round-tripping input before DER parsing. An Ed25519 signature must decode to exactly 64 bytes. Crypto exceptions are caught and translated at the boundary.

### Pack verification flow

1. Treat the argument as unknown at runtime and validate the complete wrapper shape.
2. Validate embedded and supplied public keys; require exact string equality.
3. Validate canonical signature base64 and its 64-byte decoded length.
4. Recompute checksum from `canonicalSkillJson(signed.pack)`.
5. Verify Ed25519 over those same canonical UTF-8 bytes.
6. Return a fresh frozen pack only when every dimension passes; otherwise return a frozen invalid result. Never throw.

### Pin creation flow

1. Validate `referenceDate` and the array shape.
2. Scan the complete input for duplicate `{id, version}` identities.
3. Verify every pack using its embedded public key.
4. Require every verified pack to be in force at `referenceDate`.
5. Project fresh entry values, copying `validity` to `vigencia`.
6. Sort by id and numeric semver, freeze, and return the success branch.
7. If any reason exists, return one denial and no partial pin.

### Pin verification flow

1. Validate and normalize the complete pin and candidate collections; reject duplicates in either set.
2. Verify every candidate checksum/signature with its embedded key and require it in force at `referenceDate`.
3. Compare exact `{id, version}` membership in both directions.
4. For exact identities, compare checksum, jurisdiction, and both vigencia bounds.
5. For unmatched identities with the same unambiguous id, also report `version-mismatch`; retain missing/additional reasons. Ambiguous repeated ids use exact-membership reasons only.
6. Return valid only when no reason exists.

## Fail-closed and error vocabulary

- Signing throws only `SkillPackSigningError`; raw `SkillError`, DER, Buffer, and crypto exceptions do not escape.
- `verifySkillPack`, `createMissionSkillPin`, and `verifyMissionSkillPin` never throw for caller-shaped malformed input.
- A valid checksum never compensates for an invalid signature, or vice versa.
- Pin creation never binds an invalid or out-of-force pack and never returns a partial pin.
- Pin verification never accepts a subset, superset, duplicate, or drifted set.
- Invalid reference dates deny explicitly; they are not interpreted or replaced.
- Closed string-literal unions prohibit ad hoc denial codes.
- Results, nested errors/denials, reason arrays, returned packs, and pins are frozen.

## Immutability and ordering guarantees

A private `cloneSkillDefinition` creates a new validity object and new arrays for `normativeSources`, `inputs`, `outputs`, `requiredPermissions`, and `contractCompatibility`. Children are frozen before parents. No caller-owned array is sorted or frozen.

Pin sorting always operates on a fresh projection. Reason ordering follows the declared code order, then identity by binary comparison. Equal logical sets therefore produce deeply equal pins and identically ordered denials regardless of caller order.

Ed25519 makes signing deterministic for equal key and payload bytes. Key generation is intentionally random and is outside that equal-input claim.

## Export plan

Extend `skills/index.ts` only:

```ts
export * from "./signature.js";
export * from "./pinning.js";
```

The signature module exports/re-exports its wrapper, result/error types, `ReceiptKeyPair`, `generateReceiptKeyPair`, `signSkillPack`, and `verifySkillPack`. Pinning exports its entry/result/denial types plus creation and verification functions.

Consumers continue importing through the existing `./skills` package subpath. No export-map change or new package subpath is required. Internal helpers remain private.

## Test plan and strict TDD order

Each group starts RED, receives the minimum GREEN implementation, then refactors without changing behavior.

1. **RED-SIG-1:** receipt-generated key pair signs and verifies; checksum is unchanged; wrapper is frozen.
2. **RED-SIG-2:** nested key reordering stays valid; nested normative-source/content tamper fails.
3. **RED-SIG-3:** re-checksummed tamper, shallow-canonical signature, mutated signature, and wrong key fail with the correct dimensions.
4. **RED-SIG-4:** malformed private key throws the typed signing error; malformed public key/signature returns invalid without throw.
5. **RED-SIG-5:** equal pack and key pair produce equal signatures; source mutation cannot change the signed copy.
6. **RED-PIN-1:** creation binds full id/version/checksum/jurisdiction/vigencia and re-verifies every pack.
7. **RED-PIN-2:** duplicates, invalid signature/checksum, malformed candidate/date, not-yet-valid, and lapsed-at-`to` deny.
8. **RED-PIN-3:** identical full set passes; missing, additional, duplicate, and identity-mismatched sets deny.
9. **RED-PIN-4:** checksum, version, jurisdiction, `from`, `to`, and open-ended-window drift return typed dimensions.
10. **RED-PIN-5:** `from === referenceDate` passes; `to === referenceDate` fails; open-ended vigencia passes after `from`.
11. **RED-PIN-6:** packs, pin, entries, vigencia, arrays, and denials are frozen; source mutation leaves the pin unchanged and later verification fails.
12. **RED-PIN-7:** reversed caller order gives deeply equal pins; denials and repeated calls are deterministic and stateless.
13. **RED-EXPORT-1:** runtime APIs and public types import from the skills root; no internal import is required.
14. Run focused Vitest suites during GREEN steps, then `bun run typecheck`, `bun run test`, and `bun run build`. Report pre-existing unrelated failures; never normalize them as new PASS.

## Honest changed-line estimate

Expected authored change: **1,100–1,400 lines**, with an outer uncertainty range of approximately 800–1,600.

```text
skills/signature.ts                    220–300
skills/pinning.ts                      280–360
skills/index.ts                          2–10
skills/__tests__/signature.test.ts     250–320
skills/__tests__/pinning.test.ts       320–390
skills export smoke                    30–60
                                      ---------
Total                                 1,102–1,440
```

The estimate exceeds the configured 300-line review budget because mandated tamper, malformed-input, full-set, vigencia, immutability, and determinism coverage dominates the change. The proposal's one-PR size exception remains required. If reviewability degrades or the upper estimate is exceeded, split at the module boundary: signature first, pinning second. Do not drop scope or proof to meet a line target.

## Open risks

1. **Embedded key is not signer trust.** A self-consistent attacker key/signature pair passes embedded-key verification. Trust resolution, expiry, and revocation remain follow-up work.
2. **Signer key id is not signed content.** The closed payload authenticates only `canonicalSkillJson(pack)`; consumers must not treat `signerKeyId` alone as authenticated evidence.
3. **Optional `signedAt` is not produced by the pure API.** Adding it manually does not alter signature validity. A signed provenance envelope would need a future versioned contract.
4. **Creation shorthand conflicts with never-throw pinning.** The discriminated creation result preserves REQ-SK-015; implementation tasks must retain it.
5. **No live enforcement.** Existing registry and `flow/close.ts` consumers can continue using unsigned or bare references until a later integration slice.
6. **Cloning follows the current flat skill contract.** Future mutable nested fields require expanding cloning and immutability tests before being alias-safe.
7. **Large proof surface.** Use the approved size exception or two-PR chain; do not create an unreviewed monolith.
