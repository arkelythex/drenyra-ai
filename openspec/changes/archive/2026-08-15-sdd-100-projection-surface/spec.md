# Projection Surface Specification — SDD-100 Option B (DRAFT Contract + CLI Dump)

> Change: `sdd-100-projection-surface` · Domain: mission projection surface (Option B)
>
> Repository convention: this repo keeps change specs as flat files under
> `openspec/changes/{change}/spec.md`; no canonical `openspec/specs/{domain}/spec.md` tree
> exists yet, so this is a full change spec for the slice, preserved as-is at archive.
>
> Normative basis: the archived slice-A spec
> (`openspec/changes/archive/2026-08-15-sdd-100-command-center/spec.md`,
> REQ-PROJ-001..013, SC-PROJ-001..018) defines all projection semantics. This spec
> formalizes the approved Option B surface only — a DRAFT transport-neutral contract
> document and a thin CLI dump command. It MUST NOT re-define, extend, or contradict
> projection semantics; it only documents and projects them.

## Purpose

Make the shipped Core-owned mission projection (slice A) understandable and manually
inspectable without creating a second lifecycle authority. After this change, two new
surfaces exist:

1. `contracts/projection.md` — a DRAFT v0.1, transport-neutral, English contract document
   that describes the projection payload, invariants, fail-closed behavior, and authority
   boundary exactly as slice A defines them, and delegates conformance to the existing
   slice-A suite.
2. `drenyra-ai project <missionId> [--store <file>]` — a read-only CLI command that loads a
   persisted mission snapshot from the store and emits its projection as JSON, computed by
   the existing `projectMission` library.

The projection library, its package export, its conformance suite, and the six FROZEN
declared contracts remain unchanged. The DRAFT is not frozen, not adopted, and not claimed
as consumed; `project` is a diagnostic observation surface, never authorization.

## Domain 1 — DRAFT contract document (`contracts/projection.md`)

### Requirement: REQ-PB-001 — DRAFT contract document

The system MUST provide a contract document at `contracts/projection.md` written in
English, transport-neutral, declaring `Version: 0.1` and `Status: DRAFT`. The document MUST
follow the established 11-section DRAFT structure of `connector-adapter.md` — contract
title and version/status header, transport-neutral definition of the read-only boundary,
an IMPORTANT DRAFT status callout naming the conformance suite and freeze criteria,
`Purpose`, `Normative surface`, `Invariants`, `Fail-closed behavior`, `Conformance`,
`Compatibility`, `Freeze criteria`, and `Non-claims`. The status callout MUST state that
the surface is DRAFT and NOT frozen, and MUST name the criteria under which a future
freeze could occur (documented adoption plus explicit approval).

#### Scenario: SC-PB-001 — Document exists with DRAFT v0.1 header

- GIVEN the change is applied
- WHEN `contracts/projection.md` is read
- THEN the document declares `Version: 0.1` and `Status: DRAFT`
- AND the document states it is transport-agnostic
- AND the document is written in English

#### Scenario: SC-PB-002 — Structure and DRAFT callout follow the convention

- GIVEN the document at `contracts/projection.md`
- WHEN its section layout and status callout are inspected
- THEN it follows the 11-section structure established by `connector-adapter.md`
- AND an IMPORTANT callout states the surface is DRAFT and NOT frozen
- AND the callout names the conformance suite that pins the surface and the freeze
  criteria (documented adoption plus explicit approval)

### Requirement: REQ-PB-002 — Normative alignment with the slice-A surface

The document's `Normative surface` section MUST describe the projection payload shape
exactly as the archived slice-A spec (REQ-PROJ-001..013) defines it: `status` (one of the
15 canonical states, passed through unchanged), `eligibleTransitions` (ordinary canonical
eligibility), optional `recoveryTransitions` (present only for `UNKNOWN`, carrying the
canonical recovery targets `RUNNING`, `FAILED`, `COMPLETED` under a clearly separated,
labeled collection that MUST NOT be presented as ordinary progression), `nextAction`
(exactly one of the closed 12-code vocabulary), and optional `deny` (typed denial with
`code`, `cause`, and `continuation`). The document MUST enumerate the closed
`nextAction` vocabulary — exactly `none`, `queue`, `run`, `monitor`, `resume`, `review`,
`finalize`, `request-revision`, `requeue`, `reconcile`, `provide-evidence`,
`resolve-gate` — and the closed denial vocabulary — exactly `INVALID_TRANSITION`,
`APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, `POLICY_BLOCKED`, `UNSUPPORTED_STATUS` — with
the slice-A meanings for each denial code, cause, and continuation. The document MUST NOT
invent, rename, add, or omit any field, state, transition, action code, denial code,
cause, or continuation relative to the slice-A surface, and MUST NOT introduce any new
semantics.

#### Scenario: SC-PB-003 — nextAction vocabulary matches slice A exactly

- GIVEN the `Normative surface` section of `contracts/projection.md`
- WHEN the documented `nextAction` vocabulary is compared to the closed vocabulary in
  REQ-PROJ-004
- THEN the document lists exactly the 12 codes `none`, `queue`, `run`, `monitor`,
  `resume`, `review`, `finalize`, `request-revision`, `requeue`, `reconcile`,
  `provide-evidence`, `resolve-gate`
- AND no code is added, removed, renamed, or re-meaning

#### Scenario: SC-PB-004 — Denial vocabulary and UNKNOWN recovery match slice A exactly

- GIVEN the `Normative surface` and `Fail-closed behavior` sections of
  `contracts/projection.md`
- WHEN they are compared to REQ-PROJ-002 and REQ-PROJ-006
- THEN the document lists exactly the 5 denial codes `INVALID_TRANSITION`,
  `APPROVAL_REQUIRED`, `MISSING_EVIDENCE`, `POLICY_BLOCKED`, `UNSUPPORTED_STATUS`
- AND each denial code carries the slice-A cause and continuation semantics
- AND the document describes `recoveryTransitions` as the labeled, separated collection
  `RUNNING`, `FAILED`, `COMPLETED` for `UNKNOWN`, never as ordinary progression
- AND no field, state, transition, code, cause, or continuation beyond the slice-A
  surface appears anywhere in the document

### Requirement: REQ-PB-003 — Conformance delegation

The document's `Conformance` section MUST cite the existing slice-A conformance suite at
`projection/__tests__/` as the normative proof that the documented payload and behavior
hold. This slice MUST NOT add a new conformance suite (no `contracts/__tests__/`
projection tests), and the document MUST state that it creates no second suite because
slice A already pins the normative payload and behavior.

#### Scenario: SC-PB-005 — Conformance cites the slice-A suite

- GIVEN the `Conformance` section of `contracts/projection.md`
- WHEN it is read
- THEN it names `projection/__tests__/` as the suite that pins the documented surface
- AND it states that this slice adds no second conformance suite and explains why

#### Scenario: SC-PB-006 — No new conformance suite is added

- GIVEN the applied change
- WHEN the change's test file set is inspected
- THEN no contract-side projection test files are added under `contracts/__tests__/` or
  any equivalent path
- AND the only projection conformance that exists remains the slice-A
  `projection/__tests__/` suite

### Requirement: REQ-PB-004 — Authority invariants in the contract

The document MUST include the never-second-authority invariant: the projection observes
Core as the single lifecycle authority and never becomes a second state machine; a
`nextAction` is descriptive guidance and a `deny` is explanation, and neither implies that
any transition was approved, executed, verified, or completed. The document MUST include
the receipt-fidelity invariant: the projection exposes no generic `verified` claim and no
receipt, hash, signature, signer-trust, or integrity-verification authority.

#### Scenario: SC-PB-007 — Never-second-authority invariant is documented

- GIVEN the `Invariants` section of `contracts/projection.md`
- WHEN it is read
- THEN it states the projection is observation and guidance, never authorization
- AND it states that no output field claims a transition was approved, executed, verified,
  or completed

#### Scenario: SC-PB-008 — Receipt-fidelity invariant is documented

- GIVEN the `Invariants` section of `contracts/projection.md`
- WHEN it is read
- THEN it states the projection exposes no generic `verified` claim
- AND it states that receipts, hashes, signatures, signer trust, and integrity checks are
  not part of the projection surface

### Requirement: REQ-PB-005 — No freeze, adoption, or consumer claims; frozen surface untouched

The document MUST NOT claim the surface is frozen, adopted, or used by any consumer; it
MUST present itself as a DRAFT whose freeze requires documented adoption plus explicit
approval, per its `Freeze criteria` section. The file `cmd/declared-surface.ts` and its
six FROZEN declared contracts MUST remain unchanged; the DRAFT `projection.md` MUST NOT be
added to `DECLARED_CONTRACTS` or `DECLARED_CONTRACT_FILES`.

#### Scenario: SC-PB-009 — The document makes no frozen/adopted/consumed claims

- GIVEN the full text of `contracts/projection.md`
- WHEN it is scanned for status claims
- THEN it contains no statement that the surface is frozen, adopted, or consumed by any
  consumer
- AND its `Freeze criteria` section states that freezing requires documented adoption plus
  explicit approval

#### Scenario: SC-PB-010 — Declared surface stays six-frozen

- GIVEN the applied change
- WHEN `cmd/declared-surface.ts` is inspected and the git diff is reviewed
- THEN `DECLARED_CONTRACTS` still contains exactly the six FROZEN entries it contained
  before the change
- AND `projection` does not appear in `DECLARED_CONTRACTS` or `DECLARED_CONTRACT_FILES`
- AND no byte of `cmd/declared-surface.ts` changed

## Domain 2 — CLI projection dump (`drenyra-ai project`)

### Requirement: REQ-PB-006 — Command loads a mission and emits the projection

The system MUST provide a CLI command accepting exactly
`drenyra-ai project <missionId> [--store <file>]` and rejecting missing, extra, or
unsupported input. The command MUST parse the mission ID and optional store path using the
established `parseMissionFlags` pattern, hydrate `MissionFileStore`, look up the snapshot
by mission ID, compute the projection by calling the existing `projectMission` library
with the snapshot, and emit JSON via `emitJson` in the wrapped shape
`{ "missionId": string, "projection": <library result> }`. The `projection` value MUST be
the library result emitted unchanged — without translation, re-derivation, reshaping, or
reinterpretation. The command MAY write a one-line human summary to stderr via
`emitSummary`.

#### Scenario: SC-PB-011 — Happy path emits the exact wrapped shape

- GIVEN a store containing a mission `mission-123` whose snapshot status is `QUEUED`
- WHEN `drenyra-ai project mission-123 --store <store>` is run
- THEN the command exits 0
- AND stdout is JSON with `missionId` equal to `"mission-123"`
- AND the `projection` object has `status` equal to `"QUEUED"`, an
  `eligibleTransitions` array containing `RUNNING` and `FAILED`, and `nextAction` equal
  to `"run"`
- AND no other fields are added or re-mapped by the command

#### Scenario: SC-PB-012 — Projection is emitted as the library returns it

- GIVEN a store containing a mission in any canonical state
- WHEN the command runs and emits the projection
- THEN the emitted `projection` object is deeply equal to the object returned by the
  `projectMission` library for that snapshot
- AND the command performs no translation, re-derivation, or reshaping of the library
  result

### Requirement: REQ-PB-007 — All 15 states, separated UNKNOWN recovery, deny pass-through, no requested-continuation input

The command MUST emit a projection for a stored mission in any of the 15 canonical states.
For a `UNKNOWN` mission, the emitted projection MUST expose the canonical recovery targets
under the library's separated, labeled `recoveryTransitions` collection and MUST NOT
present recovery targets as ordinary `eligibleTransitions` progression. If the library
result carries a `deny` (fail-closed denial, for example `UNSUPPORTED_STATUS`), the
command MUST emit it unchanged and MUST NOT synthesize, suppress, translate, or remap
denial fields. The command MUST NOT accept any requested-continuation flag (such as
`--continue-to <status>`); the denial surface is exercised through projection request
context at the library layer and documented in the DRAFT contract, not through CLI input.
This slice adds no CLI input beyond `project <missionId> [--store <file>]`.

#### Scenario: SC-PB-013 — UNKNOWN recovery stays labeled and separated

- GIVEN a store containing a mission whose snapshot status is `UNKNOWN`
- WHEN `drenyra-ai project <missionId> --store <store>` is run
- THEN the command exits 0
- AND the emitted projection has `status` equal to `"UNKNOWN"`
- AND `recoveryTransitions` is present and equals `["RUNNING", "FAILED", "COMPLETED"]`
- AND `recoveryTransitions` is not represented as ordinary `eligibleTransitions`
  progression

#### Scenario: SC-PB-014 — A deny in the library result passes through unchanged

- GIVEN the projection library returns a result carrying a typed `deny` for the loaded
  snapshot
- WHEN the command emits the projection
- THEN the emitted `projection` includes that `deny` object unchanged, with its `code`,
  `cause`, and `continuation` intact
- AND the command neither synthesizes a denial it did not receive nor drops or rewrites a
  denial it did receive
- AND the command accepts no `--continue-to` or equivalent requested-continuation flag

### Requirement: REQ-PB-008 — Exit codes and fail-closed behavior

The command MUST return exit code 0 when the mission is found and its projection is
emitted. It MUST return exit code 1 and emit structured JSON carrying the error code
`MISSION_NOT_FOUND` when the mission is absent or unknown. It MUST return exit code 2 for
invalid arguments, unsupported flags, malformed store data, or store I/O failure. The
command MUST fail closed: any input or store condition it cannot satisfy must produce a
non-zero exit and MUST NOT emit a partial or fabricated projection.

#### Scenario: SC-PB-015 — Missing mission returns 1 with MISSION_NOT_FOUND

- GIVEN a store that does not contain a mission `mission-999`
- WHEN `drenyra-ai project mission-999 --store <store>` is run
- THEN the command exits 1
- AND stdout is JSON whose error object carries `code` equal to `"MISSION_NOT_FOUND"`

#### Scenario: SC-PB-016 — Invalid arguments return 2

- GIVEN the command is invoked with no mission ID, with extra positional arguments, with an
  unsupported flag, or with a store path that cannot be read or parsed
- WHEN the command runs
- THEN the command exits 2
- AND usage or error text is emitted
- AND no projection JSON is emitted

### Requirement: REQ-PB-009 — Read-only operation

The command MUST be read-only: it MUST NOT mutate mission state, MUST NOT invoke
transition guards, gates, or reconciliation, MUST NOT emit receipts, and MUST NOT perform
network requests. Its only effects are reading the store, computing the projection via the
pure `projectMission` library, writing JSON to stdout, optionally a summary line to
stderr, and returning an exit code. The emitted dump is a snapshot observation, never
authorization.

#### Scenario: SC-PB-017 — Running the command causes no mutation

- GIVEN a store containing a mission in any canonical state
- WHEN `drenyra-ai project <missionId> --store <store>` is run
- THEN the mission snapshot, the store file, and any ledger or receipt state are unchanged
- AND no transition guard runs, no gate executes, no reconciliation occurs, no receipt is
  emitted, and no network request is made
- AND the only outputs are stdout JSON, an optional stderr summary, and the exit code

### Requirement: REQ-PB-010 — Registration consistency

The `project` command MUST be registered in the CLI `COMMANDS` dispatch map in
`cmd/cli.ts` so that `main()` resolves it, and MUST be documented consistently in the
`helpText()` runtime string, the header command list, and the usage-error expected
commands string. The doctor CLI inventory (`cmd/commands/doctor.ts`) MUST include
`project` in its `cliCommands` list so it is reported as reachable. The six FROZEN
declared contracts and `cmd/declared-surface.ts` MUST remain untouched; the DRAFT contract
is documented as DRAFT by the contracts index, never as a declared/frozen contract.

#### Scenario: SC-PB-018 — Dispatch and help agree on project

- GIVEN the built CLI
- WHEN `drenyra-ai project` (or the help text) is inspected
- THEN `COMMANDS` resolves the `project` subcommand to the project command handler
- AND `helpText()` and the usage-error expected commands string list `drenyra-ai project`

#### Scenario: SC-PB-019 — Doctor reports project and six frozen contracts

- GIVEN the doctor command runs
- WHEN its CLI inventory check is inspected
- THEN `project` is present in the doctor's `cliCommands` list
- AND the doctor still reports the six FROZEN declared contracts, unchanged

### Requirement: REQ-PB-011 — Command-layer tests only

The command's test suite MUST cover command behavior only: parse and emit shape across all
15 canonical states (shape-level assertions on `status`, `eligibleTransitions`,
`nextAction`), the separated `recoveryTransitions` shape for `UNKNOWN`, denial pass-through
(asserting an emitted `deny` is preserved unchanged), exit codes 0/1/2, error paths, and a
CLI wiring smoke proving the command is registered and documented. The test suite MUST NOT
re-test projection semantics — the transition matrix, nextAction mapping, denial matrix,
determinism, immutability, and fail-closed behavior are proven by the slice-A conformance
suite at `projection/__tests__/` and MUST NOT be duplicated at the command layer.

#### Scenario: SC-PB-020 — Fifteen-state pass-through at shape level only

- GIVEN the command test suite
- WHEN it runs against stored missions in each of the 15 canonical states
- THEN each row asserts exit 0 and that the emitted `projection.status` equals the
  snapshot status, with a thin shape check on `eligibleTransitions` and `nextAction`
- AND no row re-asserts the full transition, action, or denial matrices that slice-A
  conformance already pins

#### Scenario: SC-PB-021 — Wiring smoke catches registration drift

- GIVEN the command test suite
- WHEN the CLI wiring smoke runs
- THEN it asserts the `project` command is reachable through `COMMANDS`
- AND it asserts `project` appears in the help text
- AND it asserts the doctor's `cliCommands` list includes `project`

### Requirement: REQ-PB-012 — Language and artifact constraints

All artifacts of this slice (the contract document, the command, its tests, the contracts
index entry, help text, and error strings) MUST be written in English. The contract
document MUST be transport-neutral. This slice MUST NOT introduce money fields or any
monetary, fiscal, ledger-posting, or SUNAT-facing semantics.

#### Scenario: SC-PB-022 — Artifacts are English and non-monetary

- GIVEN the applied change
- WHEN all new and modified artifact files are inspected
- THEN every user-facing string, the contract document, and the tests are in English
- AND no money field, fiscal conclusion, or accounting-journal behavior is introduced

## Non-goals (restated from the proposal, binding)

- No projection library, type, package-export, or slice-A conformance changes.
- No freeze, approval ceremony, declared-surface promotion, or new contract conformance
  suite.
- No MCP projection tool; Option C follows only after adoption evidence.
- No UI, Command Center implementation, localization, or professional Spanish copy.
- No new mission state, transition, mutation, gate, approval, reconciliation, or receipt.
- No evidence, memory, ledger, journal, money, fiscal, or SUNAT behavior.
- No widened CLI input: no `--snapshot`, `--raw`, `--demo`, or requested-continuation
  (`--continue-to`) flag.
- No changes to `cmd/declared-surface.ts`; the six FROZEN declared contracts stay intact.

## Resolved decisions and spec-level notes

- **Requested-continuation flag (`--continue-to`): NOT added.** The approved proposal
  states explicitly that "this CLI slice does not add a requested-continuation flag" and
  lists "requested continuation" among excluded CLI inputs in its non-goals. The denial
  surface is therefore documented by the DRAFT contract (REQ-PB-007 Domain 1) and
  exercised through projection request context at the library layer, where slice-A
  conformance pins it; the CLI accepts only `project <missionId> [--store <file>]` and
  passes any library-returned `deny` through unchanged. This overrides the parent
  delegation's tentative recommendation of a `--continue-to` flag, which would have
  contradicted the approved scope.
- **No semantic conflict with slice A:** the shipped library exposes
  `recoveryTransitions` (frozen, `["RUNNING", "FAILED", "COMPLETED"]`, present only for
  `UNKNOWN`), matching REQ-PROJ-002/SC-PROJ-003; the 12-code `nextAction` and 5-code
  denial vocabularies match REQ-PROJ-004/REQ-PROJ-006. This spec and the DRAFT contract
  MUST remain faithful to those identifiers.
- **Emitted shape:** `{ missionId, projection }` wrapping the library result, pinned by
  REQ-PB-006/SC-PB-011 so the DRAFT doc and the CLI agree.
- **Flat change-spec shape:** the repo keeps change specs flat under
  `openspec/changes/{change}/spec.md` (no canonical `openspec/specs/` tree exists yet);
  this file follows that convention, like the archived slice-A spec.
