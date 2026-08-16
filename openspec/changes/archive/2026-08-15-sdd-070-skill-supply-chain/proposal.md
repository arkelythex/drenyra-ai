# SDD-070 Proposal — Signed Skill Packs and Mission Pinning

## Status

- Change: `sdd-070-skill-supply-chain`
- Program: Drenyra Dominion, SDD-070 — Skills and Policy Supply Chain
- Roadmap: 16-program Peru v1
- Chosen slice: Option A — signature and mission pinning as pure library APIs
- Estimate: approximately 1,100–1,400 authored changed lines
- Delivery: one PR with a documented size exception; chained split as fallback

## Intent

Protect Peru v1 fiscal skill content against supply-chain tampering and prevent skill identity from drifting during an active mission.
This slice adds two deterministic integrity primitives: Ed25519-authenticated skill packs and immutable mission skill pins.
It deliberately stops before runtime integration so the contracts can be proven before changing the live close path.

## Business problem

A checksum detects mutation, but a party that can replace a skill can also calculate a new checksum.
The current registry therefore proves content consistency, not signer authenticity.
A running mission also carries only a bare `{ id, version }` reference and cannot prove the checksum, jurisdiction, or vigencia accepted when it began.
For Peru v1, those gaps allow two material failures:

- unsigned or re-checksummed fiscal content can enter the skill supply chain; and
- a regulatory update can drift into an already-started mission, contrary to constitutional rule 6.

## Current state and gap

### Implemented today

The `skills/` library already provides:

- `SkillDefinition` with version, jurisdiction, validity, normative sources, compatibility, permissions, checksum, and retirement policy;
- `canonicalSkillJson`, which recursively sorts object keys and excludes `checksum`;
- `computeSkillChecksum`, which hashes `canonicalSkillJson` with SHA-256;
- `validateSkill` and fail-closed checksum validation in `SkillRegistry.register`;
- `isSkillInForce`, with inclusive `from` and exclusive `to` semantics;
- exact-version and in-force registry resolution; and
- six Peru base skills with Vitest conformance coverage.
The `receipts/` library already provides:
- Ed25519 key generation through `generateReceiptKeyPair`;
- SPKI DER base64 public keys and PKCS8 DER base64 private keys;
- a `node:crypto` signing and verification precedent; and
- fail-closed verification for malformed keys, signatures, and payloads.

### Missing today

- No Ed25519 signature authenticates a skill pack.
- No mission pinning API binds a mission to skill identity.
- No rollback selector exists, and `compareVersions` remains private.
- No pin store or persistence exists.
- Full normative-source provenance tracking remains incomplete.
- `flow/close.ts` passes a bare `igvSkill: { id, version }` and does not validate or pin it.

## Proposed change

Adopt Option A: add signed skill-pack and mission-pinning primitives under `skills/`, export them through `skills/index.ts`, and cover them with focused unit tests.
The implementation SHALL remain a pure library slice.
It SHALL NOT introduce storage, CLI behavior, agent orchestration, client-side decisions, or live close-flow integration.

### Signed skill packs

Add `skills/signature.ts` with:

- a `SignedSkillPack` wrapper separating `SkillDefinition` content from provenance;
- `signSkillPack`, which signs `canonicalSkillJson(pack)` with Ed25519;
- `verifySkillPack`, which validates the asserted checksum and signature;
- signer key identifier, signer public key, and signature metadata; and
- fail-closed handling for malformed payloads, keys, and signatures.
The signature MUST cover exactly `canonicalSkillJson(pack)`, the payload already used by `computeSkillChecksum`.
One pack must have one canonical content representation for checksum and signature.
The implementation SHALL reuse `generateReceiptKeyPair` and its SPKI/PKCS8 DER base64 convention.
It SHALL follow the established `node:crypto` Ed25519 `sign`, `createPublicKey`, and `verify` pattern.
It SHALL NOT reuse `signReceipt` or `verifyReceiptSignature` verbatim.
Those functions use receipt `sortedStringify`, which sorts only top-level keys and would create a second canonicalization for nested skill content.
Importing `receipts/sign` from `skills/signature.ts` is circular-safe because `receipts/` does not import `skills/`.

### Mission skill pinning

Add `skills/pinning.ts` with:

- `createMissionSkillPin(missionId, skills)` to snapshot the active mission's skill set;
- `verifyMissionSkillPin(pin, skills)` to re-derive and compare the candidate set;
- entries binding `id`, `version`, `checksum`, `jurisdiction`, and `vigencia`;
- readonly pin and entry contracts, with no mutation of caller inputs;
- failure on missing, additional, duplicate, or changed entries; and
- no store, cache, filesystem, database, or ambient mutable state.
The checksum transitively binds canonical content, including the current `normativeSources` list.
This slice does not claim complete, separately-addressable normative-source provenance in the pin.
Pinning binds the full supplied set; the spec/design must define deterministic ordering and reject duplicates.

### Public exports

Update `skills/index.ts` to export signature and pinning alongside existing types, registry functions, and Peru skills.

## Architecture and roadmap mapping

### 16-program Peru v1 roadmap

SDD-070 is the Peru v1 skills and policy supply-chain program.
This slice advances pending `checksum-signature` and mission-pinning work without claiming rollback, full provenance, or live consumption are complete.
It prepares the contract that SDD-050 can later consume: a verified mission-pinned signed skill set instead of a bare reference.
No LATAM expansion is included; explicit jurisdiction ensures cross-country substitution fails pin verification.

### Approved layer model

The change stays within the approved direction: `contracts -> library modules -> agents -> cmd`.

- `skills/signature.ts` and `skills/pinning.ts` are pure library code.
- Cryptography remains `node:crypto` only.
- No agent, CLI, UI, or client receives deterministic authority.
- Signed packs and pins are supply-chain integrity gates, never advisory client behavior.
- The audit ledger remains audit-only; this does not create accounting journal entries.
- A skill pin is an integrity contract, not evidence storage or conversational memory.

### Constitutional rule 6

Skills never silently modify an active mission.
A newly signed fiscal update may affect a new mission but cannot rewrite the identity accepted by a started mission.
Runtime wiring is deferred, so this slice does not claim end-to-end enforcement in `flow/close.ts`.

## Requirements preview

The specification should formalize these drafts with RFC 2119 keywords and Given/When/Then scenarios:

- **REQ-SK-001 — Signed wrapper:** Every authenticated pack MUST contain a `SkillDefinition`, signer key identifier, SPKI DER base64 public key, and base64 Ed25519 signature.
- **REQ-SK-002 — Shared canonical payload:** `signSkillPack` and `verifySkillPack` MUST use `canonicalSkillJson(pack)`; signature and checksum canonicalization MUST NOT diverge.
- **REQ-SK-003 — Key-format reuse:** Signing MUST accept the receipt convention: SPKI DER base64 public key, PKCS8 DER base64 private key, and key identifier.
- **REQ-SK-004 — Complete verification:** Every `verifySkillPack` call MUST verify checksum and signature, distinguish their failures, and accept neither failure. Registry/live-consumer enforcement is follow-up work and MUST NOT be claimed here.
- **REQ-SK-005 — Tamper failure:** Content change, checksum substitution, signature mutation, malformed key, or malformed signature MUST return invalid.
- **REQ-SK-006 — Mission pin identity:** Each entry MUST bind `id`, `version`, `checksum`, `jurisdiction`, and complete vigencia (`from` and optional exclusive `to`).
- **REQ-SK-007 — Full pinned set:** Missing, additional, duplicate, or identity-mismatched entries MUST fail verification.
- **REQ-SK-008 — Pin immutability:** An active-mission pin MUST NOT be mutated or silently replaced; types MUST be readonly and APIs MUST not mutate inputs.
- **REQ-SK-009 — Pin verification:** `verifyMissionSkillPin` MUST deterministically reject version, checksum, jurisdiction, vigencia, and membership drift.
- **REQ-SK-010 — No persistence:** APIs MUST be pure and MUST NOT add storage, filesystem, network, registry persistence, or a pin repository.
- **REQ-SK-011 — Vigencia semantics:** Pins MUST preserve inclusive `from` and exclusive `to`.
- **REQ-SK-012 — Public surface:** APIs MUST be exported through `skills/index.ts` without internal-file imports.
- **REQ-SK-013 — English artifacts:** Public APIs, comments, tests, and technical artifacts MUST be in English.
- **REQ-SK-014 — Deferred rollback compatibility:** Shapes SHOULD support later pure `previousPack(history)` without mutating history or started-mission pins; rollback is deferred.

## First-slice scope

Included:

- signed skill-pack wrapper types;
- Ed25519 signing over `canonicalSkillJson`;
- checksum plus signature verification;
- receipt key-generation and key-format reuse;
- mission pin creation and verification;
- immutable full-set pin identity;
- `skills/index.ts` exports; and
- focused unit, tamper, vigencia, and immutability tests.

## Non-goals

- No wiring into `flow/close.ts` or change to `MonthlyCloseInput.igvSkill`.
- No automatic enforcement inside every existing registry consumer.
- No rollback, `skills/rollback.ts`, or `compareVersions` export in this slice.
- No store, persistence, cache, or database.
- No complete normative-source provenance lifecycle.
- No trusted-key expiry/revocation lifecycle unless later approved explicitly.
- No LATAM packs beyond Peru.
- No `skills:conformance` CLI command.
- No agent, CLI, UI, or client-side integrity authority.
- No capability-matrix promotion: `vigencia-versioning`, `checksum-signature`, and `rollback` remain planned.

## Tradeoffs

### Option A — signature plus pinning, pure library (chosen)

Benefits: closes authenticity and mission-drift primitive gaps, remains independently testable, leaves the live close path untouched, and establishes shapes for rollback and wiring.
Costs: end-to-end enforcement remains incomplete, legacy bare references still work, and integration requires a follow-up.

### Option B — Option A plus rollback (deferred)

Benefits: also delivers a previous-signed-pack selector.
Costs: expands an underestimated slice, requires exporting or relocating `compareVersions`, adds history-ordering decisions, and does not improve live enforcement while wiring is absent.

### Option C — library plus `flow/close.ts` wiring (deferred)

Benefits: immediate close-path enforcement.
Costs: changes a live fiscal input contract, adds migration policy, increases blast radius, and couples primitives to one consumer.
Option A is first because it creates the smallest stable trust boundary required by Options B and C.
This is sequencing, not a claim that the supply chain is complete.

## Affected areas

Expected implementation files:

- `skills/signature.ts` — new signed-pack types and functions;
- `skills/pinning.ts` — new mission-pin types and functions;
- `skills/index.ts` — exports;
- `skills/__tests__/signature.test.ts` — signing and tamper coverage; and
- `skills/__tests__/pinning.test.ts` — full-set, vigencia, and immutability coverage.
Referenced precedents: `skills/types.ts`, `skills/registry.ts`, `receipts/sign.ts`, and `receipts/verify.ts`.
`flow/close.ts` is a future integration point, not an affected file.

## Impact and risks

### Canonicalization divergence — top risk

Signing receipt-style shallow canonical JSON would authenticate different bytes than the checksum.
Mitigation: make `canonicalSkillJson` the only signed payload and test nested content explicitly.

### Embedded key versus trusted signer

An embedded public key proves cryptographic consistency, not organizational authorization, expiry, or revocation.
Mitigation: preserve signer identity, state the limitation, and add trust resolution later if required.

### Apparent versus runtime immutability

TypeScript `readonly` does not freeze runtime objects.
Mitigation: copy inputs, avoid mutation, detect drift, and resolve runtime `Object.freeze` in design.

### Set-order and duplicate ambiguity

Array order or duplicate identities can make verification ambiguous.
Mitigation: define deterministic ordering and reject duplicates.

### Scope creep

Rollback, storage, trust lifecycle, registry enforcement, or close wiring would obscure the primitive contracts.
Mitigation: enforce non-goals and create explicit follow-up slices.

### Forecast undercount

Prior slices show mandated coverage can reach roughly twice a naive estimate.
Mitigation: budget 1,100–1,400 authored lines, with an outer range of 800–1,600, and split if reviewability degrades.

## Security and compliance implications

Verification fails closed, no private key is persisted, and no client-side result becomes authoritative. Jurisdiction and vigencia remain explicit in each pin.
Normative sources are checksum/signature-bound, but the provenance lifecycle and governance amendment remain incomplete.

## Success criteria and test hints

The slice succeeds when:

1. A valid signed Peru skill pack passes checksum and Ed25519 verification.
2. Every signed-pack verification checks checksum and signature.
3. Any canonical field change fails verification.
4. Re-checksumming tampered content without the signer still fails.
5. Signature mutation and malformed key material fail closed.
6. A mission pin records the complete supplied set.
7. Version, checksum, jurisdiction, vigencia, missing, extra, or duplicate drift fails.
8. Pin APIs do not mutate caller inputs.
9. New APIs are exported through `skills/index.ts`.
10. Existing registry, receipt, and close behavior remains unchanged.
11. Tests cover nested tamper, malformed crypto input, key mismatch, full-set mismatch, duplicates, immutability, and exclusive-`to` vigencia.
12. The full Vitest suite remains green under strict TDD.
13. No capability row is promoted based only on this pure library.
Suggested suites: `skills/__tests__/signature.test.ts` and `skills/__tests__/pinning.test.ts`.
These implement the README metrics: checksum/signature verification, mission pin immutability, and tamper tests.

## Delivery shape

### Primary path

Deliver Option A as one PR with a documented size exception.
Signature, pinning, and proof form one coherent primitive, but 1,100–1,400 lines exceed the 300-line configuration budget and SDD record's 400-line review-unit limit.
The exception must be explicit; implementation cannot hide test cost or understate scope.

### Fallback path

If the forecast exceeds the upper estimate or reviewability becomes unacceptable, use chained PRs:

1. signed wrapper, canonical signature, exports, and tamper tests;
2. mission pin creation/verification, exports, and full-set/immutability tests.
Rollback and live wiring remain later slices in either path.

## Delivery rollback

Because no live consumer or persistence changes, delivery rollback is a source revert of the new modules, exports, and tests.
Existing registry and close behavior remains unchanged.
This differs from SDD-070 product rollback, which will use pure `previousPack(history)` and requires exporting `compareVersions`; that capability is deferred.

## Follow-up slices

Follow-ups add pure `previousPack(history)`, trusted signer lifecycle if required, authoritative registry-ingress verification, `flow/close.ts` migration to a verified pinned set, and complete normative-source provenance.
History and started-mission pins remain unchanged during product rollback.

## Proposal question round

The delegated phase cannot pause the parent workflow.
These product questions are recorded to improve the PRD by exposing business rules, implications, edge cases, and tradeoffs:

1. Is embedded-key cryptographic verification sufficient, or must signer trust, expiry, and revocation also be enforced now?
2. Must `createMissionSkillPin` runtime-freeze nested data, or is a copied readonly snapshot plus drift verification sufficient?
3. Is pin entry order semantically irrelevant and canonicalized, or must caller order be preserved?
4. Must pin creation reject a skill whose asserted checksum is invalid, or is prior `verifySkillPack` an explicit precondition?
5. Is the one-PR size exception approved, with the two-PR chain used only if reviewability becomes unacceptable?
Current assumptions: trust lifecycle is deferred; normative sources are transitively bound; duplicates and full-set mismatch fail; order is normalized; runtime freezing is undecided; one PR is preferred with a chained fallback.
The user may answer, skip, correct this framing, or request a second question round before specification.

## Decision

Proceed with Option A: signed skill packs and immutable mission pinning as pure `skills/` library APIs with focused unit tests.
Defer product rollback, trusted-key lifecycle, registry enforcement, persistence, capability promotion, and `flow/close.ts` integration.
