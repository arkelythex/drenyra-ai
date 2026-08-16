# Skills Specification — Signed Skill Packs and Mission Pinning

## Purpose

Protect Peru v1 fiscal skill content against supply-chain tampering and prevent
skill identity from drifting during an active mission. A checksum detects
mutation, but a party that can replace a skill can also recompute a checksum;
only an Ed25519 signature proves signer authenticity. A running mission also
carries only a bare `{ id, version }` reference today and cannot prove the
checksum, jurisdiction, or vigencia accepted when it began. This slice adds two
deterministic integrity primitives as a pure library: Ed25519-authenticated
skill packs and immutable mission skill pins. It deliberately stops before
runtime integration so the contracts can be proven before the live close path
changes.

## Scope

- A `SignedSkillPack` wrapper separating skill content from provenance, Ed25519
  signing over the canonical skill payload, and fail-closed checksum-plus-
  signature verification (`skills/signature.ts`).
- Mission skill pin creation and verification binding `{ id, version, checksum,
  jurisdiction, vigencia }` per skill, with full-set membership, deterministic
  ordering, and runtime immutability (`skills/pinning.ts`).
- Public exports through `skills/index.ts`; the existing `./skills` package
  subpath is extended, no new subpath is introduced.
- Focused unit tests covering signing, tamper, malformed crypto input, key
  mismatch, full-set mismatch, duplicates, vigencia, determinism, and
  immutability.

## Decisions (closed in this specification)

1. **Signed payload:** the signature covers exactly `canonicalSkillJson(pack)`
   — the same recursive key-sorted payload used by `computeSkillChecksum`.
   Checksum and signature canonicalization MUST NOT diverge.
2. **Key convention:** reuse the receipt convention — SPKI DER base64 public
   keys, PKCS8 DER base64 private keys, key identifiers, and
   `generateReceiptKeyPair`. The `node:crypto` Ed25519 pattern is reused; the
   receipt sign/verify functions are not reused verbatim because they use a
   different (shallow) canonicalization.
3. **Pin verification composition:** a pin verifies when the pack's signature
   is valid, the recomputed/asserted/bound checksums agree, id, version,
   jurisdiction, and the vigencia window match the bound values, the skill is
   in force at the caller-supplied reference date, and the candidate set
   exactly matches the pin's bound set.
4. **Creation fails closed:** `createMissionSkillPin` re-verifies every
   supplied pack (checksum and signature) before binding any value; there is no
   implicit caller precondition.
5. **Runtime immutability:** the returned pin and its entries are frozen at
   creation; pin APIs neither mutate nor alias caller inputs.
6. **Ordering:** entries are ordered deterministically (by id, then numeric
   semver version); caller array order is not preserved; duplicate identities
   are rejected.
7. **No ambient clock:** every date-dependent operation takes the reference
   date as a caller-supplied argument; the APIs never read the clock.

## Non-goals (this slice)

- No wiring into `flow/close.ts`; `MonthlyCloseInput.igvSkill` stays a bare
  `{ id, version }` reference.
- No automatic enforcement inside every existing registry consumer; registry
  ingress verification is follow-up work and is NOT claimed here.
- No rollback, no `skills/rollback.ts`, and no `compareVersions` export.
- No store, persistence, cache, filesystem, database, or pin repository.
- No complete normative-source provenance lifecycle; normative sources are
  transitively bound via the checksum/signature only.
- No trusted-key expiry/revocation lifecycle (embedded keys prove
  cryptographic consistency, not organizational authorization).
- No LATAM packs beyond Peru.
- No `skills:conformance` CLI command; no agent, CLI, UI, or client-side
  integrity authority.
- No capability-matrix promotion: `vigencia-versioning`, `checksum-signature`,
  and `rollback` remain `planned`.
- No money fields; the fiscal convention (BigInt cents, no floats) is
  untouched.

## Requirements

### Requirement: REQ-SK-001 — Signed skill pack wrapper

Every authenticated skill pack MUST be represented as a signed skill pack that
separates the `SkillDefinition` content from its provenance. A signed pack MUST
carry the skill definition, a signer key identifier, the signer public key
encoded as SPKI DER base64, and an Ed25519 signature encoded as base64. A
signed pack MAY carry an optional signed-at timestamp (ISO-8601 date). The
signature and provenance fields MUST NOT be part of the canonical content
payload; the definition's checksum MUST remain content-derived and unchanged.

#### Scenario: SC-SK-001 — Structure of a signed pack

- GIVEN a valid Peru skill definition and an Ed25519 key pair produced by the receipt convention
- WHEN the definition is signed
- THEN the result is a signed skill pack containing the definition, a signer key identifier, an SPKI DER base64 public key, and a base64 Ed25519 signature
- AND the definition's checksum inside the pack is unchanged

### Requirement: REQ-SK-002 — Shared canonical payload

Signing and verification MUST use `canonicalSkillJson(pack)` as the signed
payload — the same recursive, key-sorted canonicalization used by
`computeSkillChecksum`. The signature canonicalization MUST NOT diverge from
the checksum canonicalization: one pack MUST have exactly one canonical content
representation for both checksum and signature. The signature MUST NOT be
computed over any other serialization, including a shallow top-level-only
canonicalization.

#### Scenario: SC-SK-002 — Key-order independence of the canonical payload

- GIVEN a signed pack whose nested object and array fields are recursively key-sorted
- WHEN the same logical content is presented again with a different key order inside nested objects
- THEN verification of both presentations succeeds, because both canonicalize to the same payload

#### Scenario: SC-SK-003 — Divergent serialization is rejected

- GIVEN a signature that was computed over a shallow, top-level-only canonicalization of the pack
- WHEN the pack is verified and the payload is recomputed with `canonicalSkillJson`
- THEN the signature is invalid, because the signed bytes differ from the checksum's canonical bytes

### Requirement: REQ-SK-003 — Receipt key-format reuse

Signing and verification MUST accept the receipt key convention: PKCS8 DER
base64 private keys, SPKI DER base64 public keys, and key identifiers as
produced by `generateReceiptKeyPair`. The skill signature machinery MUST reuse
that key format and the `node:crypto` Ed25519 pattern. It MUST NOT reuse
`signReceipt` or `verifyReceiptSignature` verbatim, because those serialize with
a different canonicalization.

#### Scenario: SC-SK-004 — Receipt key pair round trip

- GIVEN a key pair produced by `generateReceiptKeyPair` and a skill definition
- WHEN the definition is signed with the pair's private key and verified with the same pair's public key
- THEN verification succeeds

### Requirement: REQ-SK-004 — Complete verification

Every `verifySkillPack` call MUST verify both the asserted checksum (recomputed
over `canonicalSkillJson(pack)`) and the Ed25519 signature, MUST distinguish
the two failures in its result, and MUST accept the pack only when both pass. A
pack that fails verification MUST NOT be accepted by any consuming API in this
slice.

#### Scenario: SC-SK-005 — Valid signed pack passes

- GIVEN a correctly signed pack with a valid asserted checksum
- WHEN the pack is verified
- THEN the result reports valid, with checksum valid and signature valid

#### Scenario: SC-SK-006 — Checksum-only failure is distinguished

- GIVEN a pack whose signature is valid but whose asserted checksum was altered
- WHEN the pack is verified
- THEN the result reports invalid, with signature valid and checksum invalid

#### Scenario: SC-SK-007 — Signature-only failure is distinguished

- GIVEN a pack whose checksum is valid but whose signature does not match the content
- WHEN the pack is verified
- THEN the result reports invalid, with checksum valid and signature invalid

#### Scenario: SC-SK-008 — Consuming API rejects an unverified pack

- GIVEN a candidate set for mission pin creation that contains a pack failing checksum or signature verification
- WHEN creation is attempted
- THEN creation fails closed and no pin is produced

### Requirement: REQ-SK-005 — Tamper and malformed inputs fail closed

Verification MUST return invalid for: any canonical content change; an
attacker-substituted checksum; a mutated signature; a malformed public key; or
a malformed signature. Verification MUST NOT throw for malformed input; it MUST
return a structured invalid result.

#### Scenario: SC-SK-009 — Nested canonical field tamper fails

- GIVEN a signed pack whose canonical fields were changed after signing (for example, a normative-source entry in a nested array)
- WHEN the pack is verified
- THEN the result is invalid, even though the pack is structurally well-formed

#### Scenario: SC-SK-010 — Re-checksumming tampered content fails

- GIVEN tampered skill content whose checksum was recomputed by the attacker without the signer's key
- WHEN the pack is verified
- THEN the result is invalid, because the signature no longer matches the canonical payload

#### Scenario: SC-SK-011 — Signature mutation fails

- GIVEN a signed pack whose signature bytes were modified
- WHEN the pack is verified
- THEN the result is invalid

#### Scenario: SC-SK-012 — Wrong public key fails

- GIVEN a signed pack verified with the public key of a different key pair
- WHEN the pack is verified
- THEN the result is invalid

#### Scenario: SC-SK-013 — Malformed public key fails without throwing

- GIVEN a pack whose public key is not decodable SPKI DER base64
- WHEN the pack is verified
- THEN the result is invalid and no exception is raised

#### Scenario: SC-SK-014 — Malformed signature fails without throwing

- GIVEN a pack whose signature is not decodable base64
- WHEN the pack is verified
- THEN the result is invalid and no exception is raised

### Requirement: REQ-SK-006 — Mission pin identity

Each mission skill pin MUST bind, for every skill in the mission's set, an
entry with exactly: the skill id, version, checksum, jurisdiction, and the
complete vigencia window (inclusive `from` and optional exclusive `to`).
`createMissionSkillPin` MUST snapshot these values only from verified signed
packs: every supplied pack MUST pass checksum and signature verification before
any value is bound, and creation MUST fail closed otherwise. Creation MUST
reject duplicate skill identities (same id and version), MUST order entries
deterministically so that equal input sets always produce equal pins, and MUST
NOT preserve or depend on caller array order.

#### Scenario: SC-SK-015 — Pin entry carries the full binding

- GIVEN a verified signed pack
- WHEN a mission pin is created from it
- THEN the pin contains one entry whose id, version, checksum, jurisdiction, vigencia from, and vigencia to exactly equal the pack's values

#### Scenario: SC-SK-016 — Duplicate identity is rejected at creation

- GIVEN two packs with the same id and version in the supplied set
- WHEN mission pin creation is attempted
- THEN creation fails closed and no pin is produced

#### Scenario: SC-SK-017 — Deterministic ordering

- GIVEN the same skill set presented in two different caller orders
- WHEN a mission pin is created from each presentation
- THEN both pins contain identical, deterministically ordered entries

### Requirement: REQ-SK-007 — Full pinned set

`verifyMissionSkillPin` MUST fail verification when the candidate set does not
exactly match the pin's bound set: a missing entry, an additional entry, a
duplicate identity, or an identity-mismatched entry MUST invalidate the
verification.

#### Scenario: SC-SK-018 — Missing entry fails

- GIVEN a pin whose bound set has two entries and a candidate set containing only one
- WHEN the pin is verified against the candidate set
- THEN the result is invalid

#### Scenario: SC-SK-019 — Additional entry fails

- GIVEN a candidate set that contains a skill not present in the pin's bound set
- WHEN the pin is verified against the candidate set
- THEN the result is invalid

#### Scenario: SC-SK-020 — Duplicate candidate fails

- GIVEN a candidate set that lists the same skill identity (id and version) twice
- WHEN the pin is verified against the candidate set
- THEN the result is invalid

### Requirement: REQ-SK-008 — Pin immutability

An active-mission pin MUST be immutable: once created, a pin MUST NOT be
mutated and MUST NOT be silently replaced by another pin. The pin and its
entries MUST be runtime-immutable (frozen) after creation. The creating and
verifying APIs MUST NOT mutate caller inputs and MUST NOT alias caller objects:
later mutation of the source packs MUST NOT alter the pin.

#### Scenario: SC-SK-021 — Pinned object is frozen

- GIVEN a created mission pin
- WHEN a consumer attempts to mutate the pin or one of its entries
- THEN the mutation is rejected and the pin's bound values remain unchanged

#### Scenario: SC-SK-022 — Source mutation does not alter the pin

- GIVEN a mission pin created from a set of packs
- WHEN a caller mutates a source pack's version or checksum after pinning
- THEN the pin's bound values remain the original values and verifying the mutated pack against the pin fails

### Requirement: REQ-SK-009 — Pin verification

`verifyMissionSkillPin` MUST verify every bound field against the candidate
signed pack and MUST fail closed on any mismatch: the pack's signature MUST be
valid; the recomputed checksum, the pack's asserted checksum, and the pin's
bound checksum MUST all agree; the pack's id, version, and jurisdiction MUST
equal the bound values; the pack's vigencia window MUST equal the bound window;
and the skill MUST be in force at the supplied reference date. The result MUST
distinguish the failing dimension(s) with a typed, testable reason.

#### Scenario: SC-SK-023 — Matching set passes

- GIVEN a mission pin and the identical verified signed packs it was created from
- WHEN the pin is verified at a reference date inside the vigencia window
- THEN the result is valid

#### Scenario: SC-SK-024 — Checksum mismatch fails

- GIVEN a candidate pack whose content changed so its checksum differs from the bound value
- WHEN the pin is verified against it
- THEN the result is invalid with a checksum-classified reason

#### Scenario: SC-SK-025 — Version drift fails

- GIVEN a candidate pack whose version differs from the pin's bound version
- WHEN the pin is verified against it
- THEN the result is invalid

#### Scenario: SC-SK-026 — Jurisdiction mismatch fails

- GIVEN a candidate pack whose jurisdiction differs from the pin's bound jurisdiction
- WHEN the pin is verified against it
- THEN the result is invalid

#### Scenario: SC-SK-027 — Vigencia drift fails

- GIVEN a candidate pack whose validity window differs from the pin's bound window
- WHEN the pin is verified against it
- THEN the result is invalid

#### Scenario: SC-SK-028 — Unauthenticated candidate fails

- GIVEN a candidate pack that fails signature verification
- WHEN the pin is verified against it
- THEN the result is invalid

### Requirement: REQ-SK-010 — No persistence

All APIs in this slice MUST be pure functions: they MUST NOT read or write
storage, filesystems, databases, or network services, MUST NOT add registry
persistence or a pin repository, and MUST NOT retain state between calls.

#### Scenario: SC-SK-029 — APIs are stateless

- GIVEN the same inputs
- WHEN the signing, verification, and pinning APIs are invoked repeatedly and interleaved with other calls
- THEN every invocation returns the same results and no observable registry or store state is created

### Requirement: REQ-SK-011 — Vigencia semantics

Pins MUST preserve the vigencia window exactly as declared: inclusive `from`
and exclusive `to`, where an undefined `to` means no expiry. Pin creation and
verification MUST evaluate in-force status with `isSkillInForce` semantics: a
skill is in force only within `from <= at < to`. Applying a skill that is not
yet in force or that has lapsed at the reference date MUST fail closed.

#### Scenario: SC-SK-030 — Inclusive from is in force

- GIVEN a skill whose vigencia `from` equals the reference date
- WHEN the pin is verified at that date
- THEN the skill is in force and the pin verifies

#### Scenario: SC-SK-031 — Lapsed at exclusive to fails

- GIVEN a skill whose vigencia `to` equals the reference date
- WHEN the pin is verified at that date
- THEN the skill is not in force and the pin fails closed

#### Scenario: SC-SK-032 — Not yet in force fails

- GIVEN a reference date before the skill's vigencia `from`
- WHEN the pin is verified at that date
- THEN the skill is not in force and the pin fails closed

#### Scenario: SC-SK-033 — Open-ended window stays in force

- GIVEN a skill with no `to` in its vigencia window
- WHEN the pin is verified at any date at or after `from`
- THEN the skill is in force and the pin verifies

### Requirement: REQ-SK-012 — Public surface

All new APIs and types MUST be exported through `skills/index.ts`, and
consumers MUST be able to import them from the skills module root via the
existing `./skills` package subpath without importing internal module files. No
new package subpath is introduced.

#### Scenario: SC-SK-034 — Export smoke

- GIVEN the skills module root
- WHEN a consumer imports the signing, verification, pin creation, and pin verification functions together with the signed-pack and pin types
- THEN all are available from the module root and no internal-file import is required

### Requirement: REQ-SK-013 — English artifacts

Public API identifiers, comments, tests, and technical artifacts produced by
this change MUST be in English.

#### Scenario: SC-SK-035 — English surface

- GIVEN the new modules and their tests
- WHEN the public identifiers, documentation comments, and test names are inspected
- THEN they contain only English

### Requirement: REQ-SK-014 — Deferred rollback compatibility

The signed-pack and pin shapes SHOULD support a later pure `previousPack(history)`
selector without mutation: a future selector MUST be able to operate over an
ordered pack history without mutating the history or any started-mission pin.
Rollback, `skills/rollback.ts`, and exporting `compareVersions` are deferred to
a later slice and MUST NOT be introduced by this change.

#### Scenario: SC-SK-036 — Shape compatibility for a future selector

- GIVEN a signed pack wrapper that keeps content separate from provenance and pins that are immutable snapshots
- WHEN a pure `previousPack(history)` selector is later added over an ordered history
- THEN it can return the previous pack reference without altering the history or any existing pin

### Requirement: REQ-SK-015 — Determinism and purity

Equal inputs MUST produce equal results: signing the same pack with the same
key MUST produce the same signature and canonical payload, and verification and
pinning MUST return identical results for identical inputs. The APIs MUST NOT
read the ambient clock, perform I/O, or access the network; any date-dependent
behavior MUST take the date as a caller-supplied argument. Malformed key or
definition inputs to signing MUST fail with a typed error, never an untyped
crash; verification and pinning MUST never throw for malformed input and MUST
return structured fail-closed results.

#### Scenario: SC-SK-037 — Repeatable signing

- GIVEN the same pack, private key, and key identifier
- WHEN the pack is signed twice
- THEN both signatures and both canonical payloads are identical

#### Scenario: SC-SK-038 — No ambient clock or I/O

- GIVEN verification and pinning calls with explicit reference dates
- WHEN they are executed in an environment with no clock, network, or storage access
- THEN they complete and return identical, deterministic results
