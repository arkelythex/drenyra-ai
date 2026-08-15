# SDD-100 Option B — Projection DRAFT Contract and CLI Dump

> Change: `sdd-100-projection-surface` · Roadmap: SDD-100 Professional Command Center,
> Peru v1 Wave 3 · Approved follow-up to the archived projection-library slice.

## Intent

Make the shipped Core-owned mission projection understandable and manually inspectable without
creating another lifecycle authority. This slice documents the transport-neutral payload as a DRAFT
contract and adds a thin CLI command that reads a persisted mission and emits its projection as JSON.

Option B was approved at the slice-A gate. This proposal formalizes Option B only; Option C remains
gated on Command Center adoption.

## Current state and gap

Archived slice A ships `projection/` and the `./projection` package subpath. Its suite verifies all
15 mission states, canonical eligibility, separated UNKNOWN recovery, closed actions and denials,
determinism, fail-closed behavior, immutability, read-only operation, and receipt fidelity under
REQ-PROJ-001..013.

Two integration gaps remain:

1. No transport-neutral document explains the payload, invariants, compatibility, and authority
   boundary to consumers.
2. No narrow manual-verification surface lets an operator or integrator inspect a stored mission's
   projection without custom code.

These gaps invite ad hoc interpretation and duplicated lifecycle logic outside deterministic Core.

## Proposed change

### First-slice scope — approved Option B

Add:

1. DRAFT `contracts/projection.md`, version 0.1.
2. `drenyra-ai project <missionId> [--store <file>]`, emitting a JSON projection dump.
3. The contracts index entry, CLI registration/help, and doctor CLI-inventory wiring needed to make
   those surfaces discoverable.

The shipped projection library and its semantics remain unchanged.

### DRAFT contract structure

`contracts/projection.md` will reuse the established `connector-adapter.md` DRAFT shape:

1. `# Contract: projection`.
2. `Version: 0.1 · Status: DRAFT · Transport-agnostic.`
3. Transport-neutral definition of the read-only boundary.
4. IMPORTANT DRAFT callout naming conformance and freeze criteria.
5. `Purpose`.
6. `Normative surface`: `status`, `eligibleTransitions`, optional `recoveryTransitions`,
   `nextAction`, and optional `deny`.
7. `Invariants`: canonical passthrough and derivation, UNKNOWN separation, determinism,
   immutability, fail-closed behavior, guidance ceiling, never-second-authority, receipt fidelity.
8. `Fail-closed behavior`: closed denial codes, causes, and continuations.
9. `Conformance`: delegation to the existing slice-A `projection/__tests__/` suite.
10. `Compatibility` and `Freeze criteria`: DRAFT evolution, adoption, and explicit approval.
11. `Non-claims`: no MCP, mutation, receipt authority, UI, or frozen guarantee.

`contracts/README.md` will list `projection` v0.1 as DRAFT and identify intended consumers. The
artifact will be English and transport-neutral.

The Conformance section will explicitly state that this slice creates no second conformance suite.
Slice A already pins the normative payload and behavior; duplicating its matrix under
`contracts/__tests__/` would create maintenance drift rather than independent proof.

### CLI behavior

```text
drenyra-ai project <missionId> [--store <file>]
```

On valid input, the command will parse the mission ID and optional store path using established
mission flags, hydrate `MissionFileStore`, find the snapshot, call `projectMission` with canonical
status, and emit:

```json
{
  "missionId": "mission-123",
  "projection": {}
}
```

`projection` is emitted as returned by the library, without translation or re-derivation. It carries
canonical `status`, `eligibleTransitions`, separated `recoveryTransitions` for UNKNOWN, and
`nextAction`. The DRAFT contract also documents `deny` whenever projection request context asks for
an unavailable continuation; this CLI slice does not add a requested-continuation flag.

Exit codes follow existing CLI conventions:

- `0`: mission found and projection emitted.
- `1`: mission absent; structured `MISSION_NOT_FOUND` JSON emitted.
- `2`: invalid arguments, unsupported flags, malformed store data, or store I/O failure.

The command only parses, reads, calls the library, emits JSON, and returns an exit code. It performs
no mutation, transition, gate, approval, receipt creation, reconciliation, or network request. It
adds no `--snapshot`, `--raw`, `--demo`, mutation, or MCP option.

## Architecture mapping

### 16-program Peru v1 roadmap

This is the Option B integration surface for **SDD-100 Professional Command Center**, a Wave 3
program in the approved 16-program Peru v1 roadmap. It helps adoption while preserving the boundary
required by later tenant, evidence, policy, ingest, journal, SUNAT, and commercial-product slices.

SDD-020 supplies configured hosts, SDD-060 organization and approval context, SDD-090 Guardian
findings, and SDD-110 later consumes the production surface. This change projects mission lifecycle
state only and does not pull those domains into Option B.

### Approved layer model

```text
contracts/ (normative, versioned)
  -> library modules, including projection/
    -> agents/
      -> cmd/
```

The DRAFT describes the shipped lower-level projection. The CLI is an upper adapter depending on the
projection library and existing file-store adapter. No reverse import is introduced.

`cmd/declared-surface.ts` remains untouched. Its six entries identify FROZEN contracts; adding a
DRAFT would falsely promote it. Doctor's separate `cliCommands` list gains `project` because it
reports CLI reachability, not frozen contract identity.

### Approved authority boundaries

- **AI advisory versus deterministic authority:** projection observes Core authority; it never
  becomes a second state machine. `nextAction` is guidance and `deny` is explanation, not approval.
- **Audit ledger versus accounting journal:** this slice touches neither, creates no posting, money,
  fiscal conclusion, or SUNAT submission behavior.
- **Evidence versus memory:** this slice projects neither and exposes no generic `verified` claim.
  Integrity evidence, Engram memory, and signatures do not become operational authority.

## Requirements preview

The specification should formalize these requirements with RFC 2119 language and Given/When/Then:

- **REQ-PB-001 — DRAFT contract:** The contract MUST be English, transport-neutral, v0.1 DRAFT,
  and follow the established structure.
- **REQ-PB-002 — Normative alignment:** It MUST describe slice A and MUST NOT invent fields, states,
  transitions, actions, or denials.
- **REQ-PB-003 — Conformance delegation:** It MUST cite `projection/__tests__/`; this slice MUST NOT
  add another conformance suite.
- **REQ-PB-004 — CLI input:** The CLI MUST accept exactly
  `project <missionId> [--store <file>]` and reject missing, extra, or unsupported input.
- **REQ-PB-005 — Projection dump:** For a stored mission in any of the 15 states, the command MUST
  emit `{ missionId, projection }` using the library result without reinterpretation.
- **REQ-PB-006 — UNKNOWN recovery:** UNKNOWN output MUST preserve separated recovery and MUST NOT
  represent recovery targets as ordinary progression.
- **REQ-PB-007 — Denial fidelity:** The contract MUST require `deny` when projection request context
  asks for an unavailable continuation and MUST preserve the slice-A denial vocabulary.
- **REQ-PB-008 — Exit codes:** Success MUST return 0, missing mission MUST return 1 with
  `MISSION_NOT_FOUND`, and usage/store failures MUST return 2.
- **REQ-PB-009 — Read-only:** The command MUST NOT mutate state, run guards or gates, reconcile
  UNKNOWN, emit receipts, or use the network.
- **REQ-PB-010 — Registration consistency:** Dispatch, help, usage guidance, and doctor inventory
  MUST identify `project` consistently.
- **REQ-PB-011 — Frozen-surface isolation:** `cmd/declared-surface.ts` and all six frozen identities
  MUST remain unchanged; DRAFT MUST NOT be represented as frozen.
- **REQ-PB-012 — No semantic duplication:** Command tests MUST cover command behavior and MUST NOT
  duplicate slice-A transition, action, or denial matrices.

## Non-goals

- No projection library, type, package-export, or slice-A conformance changes.
- No freeze, approval ceremony, declared-surface promotion, or new contract conformance suite.
- No MCP projection tool; Option C follows only after adoption evidence.
- No UI, Command Center implementation, localization, or professional Spanish copy.
- No new mission state, transition, mutation, gate, approval, reconciliation, or receipt.
- No evidence, memory, ledger, journal, money, fiscal, or SUNAT behavior.
- No widened CLI input such as `--snapshot`, `--raw`, `--demo`, or requested continuation.

## Product tradeoffs

A single PR keeps the DRAFT and its manual-verification adapter cohesive, but exceeds both the
300-line review budget and 400-line chaining threshold. The honest estimate is **412–581 changed
lines**, midpoint approximately **497**.

Recommend one PR with a documented size exception. Slice A established precedent at 425 changed
lines. Option B is additive, rollback-safe, and omits freeze ceremony and duplicate conformance.

If maintainers reject the exception, split cleanly:

- **PR 1:** DRAFT contract plus index, approximately 130–165 lines.
- **PR 2:** command, command-layer tests, registration/help, and doctor wiring, approximately
  290–397 lines.

The split improves review sizing but temporarily lands documentation without its verification
adapter and adds coordination; it does not reduce total work.

## Affected areas

Expected touchpoints:

- new `contracts/projection.md` and `contracts/README.md` update;
- new `cmd/commands/project.ts` and `cmd/__tests__/project.test.ts`;
- `cmd/cli.ts` registration/help/usage; and
- `cmd/commands/doctor.ts` CLI inventory.

`projection/`, `missions/`, `cmd/declared-surface.ts`, package exports, MCP, agents, ledger, and
journal remain untouched.

## Impact and risks

1. **Size overrun — HIGH:** mitigate with the upper-bounded estimate, command-only tests, and split.
2. **DRAFT-conformance ambiguity — MEDIUM:** explicitly explain delegation to slice-A conformance.
3. **CLI registration drift — MEDIUM:** cover dispatch, help, usage, and doctor with a wiring smoke.
4. **Projection over-testing — MEDIUM:** assert pass-through shape, not semantic matrices.
5. **Frozen-surface promotion — HIGH impact/LOW likelihood:** protect `cmd/declared-surface.ts` and
   verify the frozen count stays six.
6. **Stale output — LOW:** document the dump as snapshot observation, never authorization.

## Success criteria and test hints

Success means:

- the v0.1 DRAFT accurately documents the payload and authority boundary;
- Conformance cites slice A and no duplicate suite exists;
- all 15 stored statuses can be dumped with exit 0 and `{ missionId, projection }`;
- UNKNOWN recovery remains separated and the contract preserves denial semantics when requested;
- missing mission returns `MISSION_NOT_FOUND`/1; invalid input or store failures return 2;
- help, dispatch, usage, and doctor agree on `project`;
- execution causes no mutation or receipt; and
- six frozen declared contracts remain unchanged.

Tests stay at the command layer: table-drive status passthrough, smoke UNKNOWN shape, verify wrapper,
0/1/2 exits, errors, and CLI reachability. Exact transition lists, action mappings, denial matrices,
determinism, and immutability remain covered by slice A.

## Delivery shape

Use a **single PR with documented size exception**, forecast 412–581 lines (~497 midpoint). Record
the exception before apply. If rejected or the upper bound is materially exceeded, use the two-PR
fallback without changing scope. Option C freeze and MCP remain gated on adoption and approval.

## Rollback

Remove the command, wiring, tests, DRAFT, and index entry while leaving the projection library
untouched. No migration or rewrite of mission state, receipts, ledger, or accounting data is needed.

## Proposal question round and assumptions for review

This delegated phase could not pause for an interactive question round. Assumptions recorded for
review are: manual inspection is valuable before MCP; mission ID plus optional store is sufficient;
adoption evidence rather than elapsed time gates Option C; and DRAFT output is diagnostic, not a
stable automation contract. These assumptions do not reopen approved Option B scope.

## Open questions

1. What Command Center adoption evidence triggers Option C: integration branch, released consumer,
   or approved payload fixture?
2. Should the index name only current consumers or also intended consumers before adoption?
3. Who records the size exception, and what forecast increase makes the fallback split mandatory?
4. Does future automation need an explicit DRAFT warning beyond the contract status banner?

None blocks approval or changes the Option B boundary.
