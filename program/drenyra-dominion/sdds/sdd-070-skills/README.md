---

# SDD-070 — Skills and Policy Supply Chain

> Status: lifecycle:active · Maturity: partial (PE skill registry + signed packs + mission pinning implemented) · Wave: 2 · Depends on: SDD-010 · Feeds: SDD-050

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
- Conformance via vitest suites — `skills/__tests__/pe-skills.test.ts` and
  `skills/__tests__/registry.test.ts` (PE IGV validate already implemented; there
  is no `drenyra-ai skills:conformance` CLI command — see reconciliation note).

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
- Conformance suite via vitest (`skills/__tests__/pe-skills.test.ts`,
  `skills/__tests__/registry.test.ts`); tamper tests.

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

## Reconciliation — 2026-08-15 (vertical-closures)

> Change: `vertical-closures` (documentation-only reconciliation). Records the
> implemented PE skill-registry slice and the pending supply-chain core; NO
> lifecycle promotion to `complete` (status-and-evidence rules R3/R4). Evidence
> axes: lifecycle `active` · evidence `verified-revision-bound` (`6a7f0f7`,
> suite 843/843) · temporal class `current-claim`.

### Implemented core (real symbols, verified at `6a7f0f7`)

- `skills/registry.ts` — `SkillRegistry`, `computeSkillChecksum` (content-derived),
  `validateSkill`, `isSkillInForce(skill, at)` (exclusive `to` window, no
  retroactive change), `compareVersions`.
- `skills/pe.ts` — `BASE_PE_SKILLS` = `IGV_VALIDATE`, `SIRE_COMPARE`,
  `DETRACTION_CHECK`, `RETENTION_CHECK`, `PERCEPTION_CHECK`, `SIRE_FILING`.
- `skills/types.ts` — `SkillDefinition`, `SkillValidity`, `SkillError`,
  `canonicalSkillJson`.
- Conformance suites (vitest): `skills/__tests__/pe-skills.test.ts` +
  `skills/__tests__/registry.test.ts` (checksum, in-force resolution,
  jurisdiction enforcement, no-retroactive-change).

### Wording correction — `skills:conformance` is a vitest suite, not a CLI command

The record previously stated conformance runs via `drenyra-ai skills:conformance`.
No such CLI subcommand exists (`cmd/cli.ts` registers no `skills:conformance`;
grep = zero matches). PE conformance is exercised by the vitest suites listed
above — there is no CLI command. (The package.json `skills:conformance` script is
a sibling-manifest drift checker for `drenyra-skills`, not a CLI command of the
binary.) The record wording is corrected accordingly; no capability is added or
removed.

### Pending core (follow-up slices, NOT implemented)

- **Signature:** `computeSkillChecksum` provides a checksum but no ed25519
  signature on packs.
- **Mission pinning:** no pinning API; `flow/close.ts` passes a bare
  `igvSkill { id, version }` — no pinned immutable skill set bound to the mission.
- **Rollback:** no rollback mechanism.
- **Normative-source tracking:** partial (jurisdiction present on skills).

Capability-matrix rows `vigencia-versioning`/`checksum-signature`/`rollback` stay
`planned`; `pe-igv-validate` stays `implemented`; nothing is promoted on
documentary presence alone (R4).

## Progress

- [x] Exploration
- [x] Proposal
- [x] Specification (RFC 2119 + Given/When/Then)
- [x] Design
- [x] Tasks (vertical TDD units)
- [x] Apply (strict TDD)
- [x] Verification report
- [x] Archive report

> Progress reflects the signed-packs + mission-pinning slice (PR #62, change archived 2026-08-15
> at `openspec/changes/archive/2026-08-15-sdd-070-skill-supply-chain/`). Rollback,
> full normative-source tracking, and live wiring (`flow/close.ts` consuming pinned skills)
> remain NOT complete — this record stays `lifecycle:active` (R3/R4). Capability-matrix rows
> (vigencia-versioning/checksum-signature/rollback) not promoted; program-level pass is a
> follow-up.
