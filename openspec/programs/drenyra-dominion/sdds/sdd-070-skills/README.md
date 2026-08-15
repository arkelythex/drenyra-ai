---

# SDD-070 — Skills and Policy Supply Chain

> Status: PLANNED · Wave: 2 · Depends on: SDD-010 · Feeds: SDD-050

## Purpose

Makes accounting and fiscal knowledge verifiable and versioned. Delivers skill
packs with normative sources, vigencia, checksum, signature, and rollback, and
guarantees that skills are immutable during an active mission.

## Scope

- Skill format and registry manifest schema (already implemented in
  `drenyra-skills`).
- Normative sources tracking (partial → complete) with jurisdiction and vigencia.
- Vigencia versioning, checksum + signature, and rollback (currently planned in
  the capability matrix).
- Mission pinning: each mission pins skill versions, normative sources, vigencia,
  checksum, and jurisdiction; a fiscal update affects new missions only.
- Conformance via `drenyra-ai skills:conformance` (PE IGV validate already
  implemented).

## Non-goals

- Skills never silently modify an active mission (constitutional rule 6).
- Skills track normative sources; they do not create law or replace the norm.
- LATAM policy packs are future work; the first conquest is Peru.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-010 | provides — versioning and compatibility rules for the supply chain |
| SDD-050 | consumes — pinned skills and policies during the close journey |

## Input/output contract

- Inputs: fiscal/normative content and regulatory updates.
- Outputs: signed, versioned skill packs with vigencia and jurisdiction;
  conformance passing; a pinning API for missions.

## Threats

- Retroactive skill changes on a started mission.
- Unsigned or tampered content entering the registry.
- Vigencia violations (applying rules after they lapsed or before they entered
  force).
- Supply-chain compromise of the content registry.

## Tests and metrics

- Checksum/signature verification on every pack.
- Mission pinning immutability: pinned versions cannot change mid-mission.
- Conformance suite via `drenyra-ai skills:conformance`; tamper tests.

## Rollback

- Revert to the previous signed pack version; started missions keep their pinned
  versions — rollback never rewrites the past.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Governance amendment — normative-source provenance, vigencia, pinning, and rollback (W3 only)

Allocated to SDD-070 by the Dominion reconciliation (W3 only; not repeated in any
other SDD). This is a governance requirement allocation (R14): it records future
acceptance wording and does NOT claim the policy/skill supply-chain capabilities
exist in full today (R17).

- **Provenance:** every skill pack MUST be traceable to its normative source
  (jurisdiction + instrument); skills track the norm, never create or replace law.
- **Vigencia:** a skill applies only within its vigencia window (entered force ≤
  applicability < lapsed); a fiscal update affects new missions only, never
  retroactively.
- **Pinning:** each mission pins skill versions, normative sources, vigencia,
  checksum, and jurisdiction; pinned content is immutable for the active mission.
- **Rollback:** revert to the previous signed pack version; started missions keep
  their pinned versions — rollback never rewrites the past.
- **No capability claim:** full normative-source tracking, vigencia versioning,
  checksum/signature, and mission pinning are NOT claimed to exist today; their
  `partial`/`planned` rows in the capability matrix are unchanged, and this
  amendment promotes nothing to `implemented`.

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
