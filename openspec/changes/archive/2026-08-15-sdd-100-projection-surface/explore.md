# SDD-100 Option B — Projection DRAFT Contract + CLI Dump · Exploration & Sizing

> Change: `sdd-100-projection-surface` · Domain: mission projection **surface** (Option B:
> DRAFT `contracts/projection.md` + `drenyra-ai project` JSON dump). Read-only exploration;
> no code, tests, or commits were produced.
>
> Slice A (the `projection/` library) is COMPLETE and archived under
> `openspec/changes/archive/2026-08-15-sdd-100-command-center/`. All projection SEMANTICS
> (REQ-PROJ-001..013, SC-PROJ-001..018, `MissionProjection` shape, closed vocabularies) are
> already defined and conformed there. This slice does NOT re-derive the domain; it only (1)
> authors a DRAFT transport-neutral contract doc and (2) adds a CLI dump command.
>
> Repo `drenyra-ai` v0.4.1, main @ `7049fe2`, clean. Suite 1010/1010.

## Purpose

Size and shape SDD-100 **Option B** against the 300-line review budget and the 400-line
chained-PR threshold, using the archived slice-A semantics as fixed input. Option B delivers
two additive, DRAFT-only surfaces:

1. **A DRAFT transport-neutral `contracts/projection.md`** documenting the projection payload
   (`status`/`eligibleTransitions`/`nextAction`/`deny`, closed vocabularies,
   never-second-authority, receipt fidelity), following the repo's
   DRAFT-with-conformance-then-freeze convention (cf. `brand-system.md`, `connector-adapter.md`).
2. **A `drenyra-ai project` CLI subcommand** that dumps a projection as JSON for manual
   verification, reusing the existing `mission-status` snapshot+`emitJson` pattern.

**Sizing honesty:** slice A forecast 216–257 changed lines and shipped **425** (a documented
size exception), undercounting mandated strict-TDD SC coverage ~2.6×. This estimate applies that
lesson to the upper bound of every row and scopes the command tests to the COMMAND layer only
(parse → emit shape, exit codes, error paths), explicitly citing the library's slice-A
conformance instead of re-testing projection semantics.

## Option-B scope recap (from archived slice-A proposal)

The archived `proposal.md` (Product tradeoffs, Option B) defines exactly these two additions
and states the constraint this slice respects:

> **Option B** … adds a DRAFT transport-neutral `contracts/projection.md` and a thin
> `drenyra-ai project` JSON dump command. At **350–500 changed lines**, it needs a separate
> slice or chained PR.

- **Option B is a separate slice** (the archived slice A explicitly listed "A CLI project
  command, JSON dump, or MCP projection tool" and "A DRAFT or frozen public projection
  contract" as its non-goals). This change name, `sdd-100-projection-surface`, is that separate
  slice.
- The projection library (`projection/index.ts` → `projectMission`) already ships the
  `./projection` subpath and full conformance (14 tests across 2 files in slice A, verified
  PASS). Option B adds no library code.
- **No freeze, no new conformance suite, no MCP tool.** This slice is DRAFT doc + CLI dump.

## CLI command pattern (paths/symbols verified)

### Registration and dispatch — `cmd/cli.ts`

- Top-level `COMMANDS` map: `Record<string, Readonly<Record<string, CommandHandler>>>` where
  `CommandHandler = (args: string[]) => number | Promise<number>`.
- Existing entries include `mission: { start, apply, status, recover }` and
  `capabilities/doctor/install/sync/upgrade/rollback/mcp` each with a `run`-style subcommand.
- A new `drenyra-ai project` command adds `project: { ... }` to the map (e.g. a positional
  subcommand key). The `main()` resolves `COMMANDS[command]?.[subcommand]`, slices `argv[2..]`
  to the handler, and maps exit codes 0/1/2.
- **`helpText()` must be updated** (both the header comment command list at lines 16–33 and the
  runtime `helpText()` string) to document `drenyra-ai project …`. The `usageError` fallback
  string listing expected commands must also gain the new command.

### JSON dump precedent — `cmd/commands/mission-status.ts`

`missionStatusCommand(args)` is the exact template to reuse:

- Parses `--store <file>` + positional missionId via `parseMissionFlags` (from
  `cmd/commands/mission-demo-handler.ts`, which also parses `--demo`).
- `new MissionFileStore(flags.storePath)` → `hydrate()` → `stores.missions.findById(missionId)`.
- Emits `{ snapshot, events }` via `emitJson`; `emitSummary` writes the one-line human summary
  to stderr.
- Exit codes: 0 success, **1** with `emitJson({ error: { code: "MISSION_NOT_FOUND", … } })`
  for a missing mission, **2** (via `usageError`) for bad args and `console.error(...); return 2`
  for IO/parse errors.

`cmd/output/json.ts` provides `readJsonFile`, `emitJson` (2-space pretty stdout), and
`emitSummary` (stderr) — all reusable as-is.

### Command test conventions — `cmd/__tests__/`

- Direct-import the command handler and `vi.spyOn(console, "log"/"error")` to capture stdout;
  a `capture(fn)` helper (as in `capabilities-doctor.test.ts`) or a `lastStdout()` helper (as in
  `cli.test.ts`) parses the emitted JSON. `afterEach(() => rmSync(dir, …); vi.restoreAllMocks())`
  cleans up temp dirs.
- Command-layer integration runs through a real temp JSON store (write a store file, run the
  command with `--store`, read stdout). `missionStatusCommand` is exercised inside
  `cli.test.ts` end-to-end; a dedicated `project.test.ts` is the new home.

### Doctor / declared-surface touchpoints

- `cmd/commands/doctor.ts` hardcodes a `cliCommands` array ("… gate check, capabilities,
  doctor"). Adding `project` should add `"project"` to this list so the doctor's CLI-surface
  check stays accurate. (Small, ~1 line.)
- `cmd/declared-surface.ts` exposes the **six FROZEN** contracts via `DECLARED_CONTRACTS` and
  `DECLARED_CONTRACT_FILES` (doctor checks these exist under `contracts/`). **A DRAFT
  `projection.md` must NOT be added to `DECLARED_CONTRACTS`** — that array is the frozen
  contract identity set; doctor's "all six frozen contracts present" message and the
  `capabilities show` contract list are frozen-surface concerns. Adding a DRAFT contract to the
  frozen declared surface would be a semantic regression. Document this as an explicit
  non-goal so apply does not "helpfully" touch it.

## Projection consumption in CLI (minimal viable input)

A `drenyra-ai project` command obtains a mission snapshot exactly the way `mission status`
does — there is a single existing loader: `cmd/adapters/file-mission-store.ts` →
`MissionFileStore.hydrate()` → `stores.missions.findById(missionId)` (returns a
`MissionSnapshot` or `undefined`).

- **Recommended minimal input:** `drenyra-ai project <missionId> [--store <file>]`,
  mirroring `mission status` (positional missionId + `--store`, reusing `parseMissionFlags`).
  This is the smallest viable input for manual verification and reuses the entire store-read
  path with zero new IO logic.
- **Command body (sketch):** validate args → `parseMissionFlags` → hydrate store →
  `findById` (exit 1 `MISSION_NOT_FOUND` if absent) → build a projection snapshot
  `{ status: snapshot.status }` → call `projectMission(snapshot)` from `../../projection/index.js`
  → `emitJson({ missionId, projection })` → `emitSummary("project", …)` → return 0. IO/parse
  errors → `console.error` + return 2, matching `mission-status.ts` exactly.
- **Emitted shape:** wrap the projection for context:
  `{ missionId: string, projection: MissionProjectionResult }` where `projection` carries
  `status`, `eligibleTransitions`, `recoveryTransitions?`, `nextAction`, and `deny?` (or the
  fail-closed `{ deny: { code: "UNSUPPORTED_STATUS", … } }` form). The projection object is
  emitted as-is from the library — the command does not reshape or re-derive semantics.
- **No `--snapshot <file>` / `--raw` options in this slice.** Those widen the input contract
  and add parse paths not needed for manual verification; keep scope to missionId so the
  command tests stay thin.

## Contract doc convention (paths/symbols verified)

`contracts/README.md` governs the index: a table with `Contract | Version | Status | Consumed
by`, and a required `> [!IMPORTANT]` status banner. `brand-system.md` (v0.2 DRAFT) and the
fresh `connector-adapter.md` (v0.1 DRAFT) are the best recent templates. Their shared
structure to reuse for `contracts/projection.md`:

1. `# Contract: projection`
2. `> Version: 0.1 · Status: DRAFT · Transport-agnostic.` header line + a one-paragraph
   transport-neutral definition.
3. `> [!IMPORTANT]` **Status: DRAFT at v0.1** callout naming the conformance suite that pins
   the surface and the freeze criteria (freeze requires ecosystem adoption + explicit approval,
   the `brand-system` precedent).
4. `## Purpose` — bulleted "same/define/keep/no drift" goals.
5. `## Normative surface` — the projection payload fields and closed vocabularies.
6. `## Invariants` — numbered (canonical status passthrough, eligibility from
   `VALID_TRANSITIONS`, UNKNOWN recovery separation, determinism, immutability, fail-closed,
   never-second-authority, receipt fidelity).
7. `## Fail-closed behavior` — the closed denial codes/causes/continuations.
8. `## Conformance` — **reference the existing slice-A `projection/__tests__/` suite** (the
   library's conformance already pins the payload); do NOT author a second suite.
9. `## Compatibility` — DRAFT changes expected; version bump per change.
10. `## Freeze criteria` — v0.1 freezes only after documented adoption + explicit approval.
11. `## Non-claims` — no MCP tool, no freeze, no receipt/authority, no UI copy.

Plus a `contracts/README.md` index row: `projection | 0.1 | DRAFT | Drenyra Command Center,
Drenyra Pi, CLI` and a status-banner clause mentioning the new DRAFT.

**Conformance note:** `brand-system` and `connector-adapter` each ship their own conformance
suite even as DRAFT. For `projection.md` this slice does NOT add a new suite — the projection
library (slice A) already has full conformance, and the DRAFT doc's conformance section cites
those existing tests. This is the correct, non-duplicative reading of the convention and must
be stated in the doc to avoid a reviewer expecting a new `contracts/__tests__/` file.

## Design sketch

### CLI command — `cmd/commands/project.ts`

```ts
// drenyra-ai project <missionId> [--store <file>]
import { MissionFileStore } from "../adapters/file-mission-store.js";
import { parseMissionFlags } from "./mission-demo-handler.js";
import { emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";
import { projectMission } from "../../projection/index.js";

export async function projectCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try { flags = parseMissionFlags(args); } catch (error) {
    return usageError(`project: ${errorMessage(error)}`);
  }
  if (flags.demo) return usageError("project does not support --demo");
  const missionId = flags.rest[0];
  if (missionId === undefined || flags.rest.length > 1)
    return usageError("usage: drenyra-ai project <missionId> [--store <file>]");
  try {
    const fileStore = new MissionFileStore(flags.storePath);
    const stores = await fileStore.hydrate();
    const snapshot = await stores.missions.findById(missionId);
    if (snapshot === undefined) {
      emitJson({ error: { code: "MISSION_NOT_FOUND", message: `Mission ${missionId} not found`, statusCode: 404 } });
      emitSummary("project", `mission ${missionId} not found`);
      return 1;
    }
    const projection = projectMission({ status: snapshot.status });
    emitJson({ missionId, projection });
    emitSummary("project", `${missionId} status=${snapshot.status} nextAction=${projection.nextAction}`);
    return 0;
  } catch (error) {
    console.error(`project: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
```

### Wiring

- `cmd/cli.ts`: import `projectCommand`, add `project: { dump: projectCommand }` (or
  `project: { run: projectCommand }`) to `COMMANDS`, add the command to the header comment,
  `helpText()`, and the `usageError` expected-commands string.
- `cmd/commands/doctor.ts`: add `"project"` to the `cliCommands` array.
- No `cmd/declared-surface.ts` change (DRAFT is not a frozen declared contract — non-goal).
- No `package.json` / `index.ts` / export-map change (projection already exported).

### Tests — `cmd/__tests__/project.test.ts`

Command-layer only; **do not re-test projection semantics** (cite the library's slice-A
conformance instead). Table-drive:

- **Happy path over all 15 statuses:** seed a temp store with a mission in each state, run
  `projectCommand([missionId, "--store", storePath])`, expect exit 0 and
  `stdout.projection.status === snapshot.status`. Thin shape assertions (projection has
  `status`, `eligibleTransitions` array, `nextAction`) without re-deriving the matrix.
- **UNKNOWN recovery:** one row asserting `recoveryTransitions` present / `eligibleTransitions`
  empty for a `UNKNOWN` mission (shape-level only).
- **Denial surface:** one row where the library returns a denial (shape-level; a `deny` object
  present) — a light smoke, since full denial semantics are conformance-covered in slice A.
- **Error paths:** missing mission → exit 1 + `MISSION_NOT_FOUND`; bad args (no missionId, too
  many, `--demo`) → exit 2 + usage; malformed/IO store → exit 2.
- **CLI wiring:** assert the command is reachable through `COMMANDS` (a `main`-level smoke, or
  via the help text listing) so registration regressions are caught.

This keeps mandated coverage tight because the projection's 15-state conformance, denial
matrix, fail-closed, determinism, and immutability are already proven by the library suite —
the command tests cover only parse → emit shape → exit codes → error paths.

## Honest changed-line estimate

| Area | Path | Estimated changed lines |
| --- | --- | --- |
| Contract doc | `contracts/projection.md` (new) | 120–160 |
| CLI command | `cmd/commands/project.ts` (new) | 130–180 |
| Command tests | `cmd/__tests__/project.test.ts` (new) | 150–220 |
| CLI wiring | `cmd/cli.ts` (import + COMMANDS + helpText + usage string) | 8–15 |
| Doctor CLI list | `cmd/commands/doctor.ts` (+`"project"`) | 1 |
| Contracts index | `contracts/README.md` (+1 row + banner clause) | 3–5 |
| **Total (implementation + tests)** | | **412–581** |

**Midpoint ≈ 497 changed lines.** Every row is set to the upper end per the slice-A lesson
(~2.6× undercount); the command tests stay bounded because projection semantics are delegated
to the existing library conformance.

## Budget verdict

- **300-line budget:** exceeded (est. 412–581).
- **400-line chained-PR threshold:** exceeded at midpoint (~497) and at the top end.
- **Recommendation: single PR with a documented size exception** (not a split, not a chained
  PR), based on three facts:
  1. **Precedent:** slice A shipped 425 changed lines as one cohesive commit with an explicit
     documented size exception ("Size exception (425 changed lines vs 300 budget)") recorded in
     the verify report — the repo has an established acceptance path for this exact overage.
  2. **Cohesion:** the contract doc, the CLI dump command, and its command-layer tests are one
     additive deliverable that is rollback-safe (remove the command + DRAFT doc; the projection
     library and all canonical data stay untouched). Splitting (doc in PR 1, command in PR 2)
     would split a single manual-verification surface for no reduction in total review surface.
  3. **DRAFT not frozen:** no freeze ceremony, no CI conformance addition, no public-contract
     approval — the two heaviest review burdens are absent, so a single larger PR is acceptable.
- If the parent prefers strict budget discipline over cohesion, the clean split point is:
  **PR 1 = contract doc + README row (≈130–165 lines, inside budget); PR 2 = CLI command +
  tests + wiring (≈290–397 lines).** This is the fallback if the maintainer rejects a
  >400-line single PR.

## Non-goals

- **No projection library changes** — `projection/` (types, project-mission, index, its tests)
  is archived slice-A surface; Option B adds none. Only the command and doc are new.
- **No new conformance suite** for `contracts/projection.md` — the DRAFT cites the library's
  existing slice-A suite.
- **No MCP projection tool** (deferred to Option C).
- **No contract freeze, no public-contract approval ceremony.**
- **No `cmd/declared-surface.ts` change** — DRAFT `projection.md` is NOT a frozen declared
  contract; `DECLARED_CONTRACTS`/`DECLARED_CONTRACT_FILES`/`capabilities show` stay six-frozen.
- **No CLI input widening** (`--snapshot <file>`, `--raw`, `--recovery`-style flags).
- **No UI, no Spanish copy, no receipts, no authority, no canonical-state changes.**
- **No changes to `missions/`, `routing/`, `agents/`, `flow/`, `contracts/*.md` other than the
  new `projection.md` + README row.**

## Risks

1. **Size overrun (HIGH, ~2.6× lesson from slice A).** Mitigation: upper-bound every row;
   scope command tests strictly to the command layer and cite the library's slice-A conformance
   for projection semantics. If the midpoint climbs above ~500, apply the fallback split (doc PR
   first).
2. **DRAFT-with-conformance convention ambiguity.** `brand-system`/`connector-adapter` ship
   their own suites; a reviewer may expect `projection.md` to add a `contracts/__tests__/`
   suite. Mitigation: the doc's Conformance section explicitly states it delegates to the
   existing slice-A suite and explains why no second suite is authored.
3. **Accidental frozen-surface mutation.** `doctor.ts`/`declared-surface.ts` touchpoints are
   tempting. `DECLARED_CONTRACTS` must stay six-frozen; only `doctor.ts`'s `cliCommands` array
   gains `"project"`. Flag in the apply prompt.
4. **CLI registration drift** — forgetting `helpText()`, the header comment, the
   `usageError` string, or the doctor list leaves the command undocumented/unreported. Mitigated
   by a CLI-wiring smoke test in `project.test.ts`.
5. **Emitted-shape ambiguity** — wrapping the projection in `{ missionId, projection }` vs
   emitting bare. Recommend the wrapped form for context; the contract doc must pin the field
   names so the doc and the CLI agree (the doc is DRAFT, so this is provisional until freeze).
6. **Over-testing projection semantics in the command tests** would inflate the estimate toward
   the slice-A overrun. Explicitly forbid re-testing the 15-state matrix/denial matrix here.

## Recommendation (summary)

**Shape:** DRAFT `contracts/projection.md` (copy `connector-adapter.md`'s 11-section structure;
delegate conformance to slice-A) + `cmd/commands/project.ts` mirroring `mission-status.ts`
(`project <missionId> [--store]`, reuse `parseMissionFlags` + `MissionFileStore` +
`projectMission`, wrap `{ missionId, projection }`, exit 0/1/2) + `cmd/__tests__/project.test.ts`
(command-layer table over 15 states + denial smoke + error paths) + wiring in `cmd/cli.ts` and
`doctor.ts`'s `cliCommands`.

**Honest changed-line estimate:** ~412–581 (midpoint ≈ 497), upper-bounded per the slice-A
lesson.

**Budget verdict:** exceeds both 300 and 400 thresholds; recommend a single PR with a
documented size exception (precedent: slice A at 425), with a two-PR split as fallback if the
maintainer rejects the overage.

**Top risks:** (1) size overrun, (2) DRAFT-conformance convention ambiguity, (3) accidental
frozen-surface mutation, (4) CLI registration drift, (5) over-testing projection semantics.
