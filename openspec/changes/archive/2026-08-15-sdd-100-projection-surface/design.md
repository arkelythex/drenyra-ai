# Design — SDD-100 Option B Projection Surface

> Change: `sdd-100-projection-surface` · Design level: design-lite
> · Language: English · Scope: DRAFT contract plus read-only CLI adapter.

## Overview

This change exposes the existing Core-owned mission projection in two additive ways:

1. `contracts/projection.md` documents the transport-neutral projection as DRAFT v0.1.
2. `drenyra-ai project <missionId> [--store <file>]` reads one persisted mission and dumps the existing library result as JSON.

The dependency direction remains:

```text
contracts/ (normative) -> projection/ library -> agents/ -> cmd/
```

The new command is a thin adapter at `cmd/`. It may depend on `projection/`, the mission file-store adapter, and output helpers. Nothing in `projection/`, `missions/`, or `agents/` may depend on the command. The command observes a snapshot; it does not become lifecycle authority.

## Decisions

### D1 — Preserve the exact one-level command syntax

The public syntax is exactly:

```text
drenyra-ai project <missionId> [--store <file>]
```

`--continue-to` is NOT added. The approved non-goal is carried verbatim: **this CLI slice does not add a requested-continuation flag**. The CLI also rejects `--snapshot`, `--raw`, `--demo`, extra positionals, and every unknown flag.

**Rationale:** manual observation needs only mission identity and the existing store path. Requested continuation belongs to the projection library request context and is already conformance-tested there. Adding it here would widen the approved CLI contract and duplicate semantic testing.

### D2 — Adapt the existing two-level dispatcher without changing existing commands

`cmd/cli.ts` retains its current `COMMANDS` map and adds:

```ts
project: { run: projectCommand }
```

Because `project` has no public subcommand, `main()` selects `COMMANDS.project.run` when `argv[0] === "project"` and forwards `argv.slice(1)`. All existing two-level commands continue selecting by `argv[0]` and `argv[1]` and receive `argv.slice(2)`.

The header command list, `helpText()`, and unknown-command usage message all show `project <missionId> [--store <file>]`, never `project run`.

**Rationale:** the internal `run` slot satisfies the established map shape while a narrow dispatch branch preserves the approved public signature. A broad dispatcher redesign is unnecessary and riskier.

### D3 — Mirror `missionStatusCommand` for parsing, loading, and exits

`projectCommand(args)` uses `parseMissionFlags`, explicitly rejects `flags.demo`, rejects unknown flag-shaped values left in `flags.rest`, and requires exactly one positional mission ID. It then hydrates `MissionFileStore`, calls `stores.missions.findById(missionId)`, and handles absence before projection.

On success it constructs only the library input `{ status: snapshot.status }`, calls `projectMission` through `../../projection/index.js`, and passes the result directly to `emitJson`:

```ts
emitJson({ missionId, projection });
```

An optional `emitSummary` line may report the mission ID and observed status/next action. It must not alter stdout.

**Rationale:** this reuses the shipped store and JSON conventions, avoids new I/O, and keeps all projection semantics in the projection library.

### D4 — Projection output is opaque to the command

The command neither reconstructs nor normalizes `status`, transition arrays, `nextAction`, or `deny`. It wraps the exact object returned by `projectMission` under `projection`.

The normal CLI call supplies no `MissionProjectionRequest`, so a canonical stored status normally has no `deny`. If the library returns a denial, including a fail-closed `UNSUPPORTED_STATUS`, the adapter emits that result unchanged.

**Rationale:** one semantic authority prevents drift. The command is a transport adapter, not a second projector.

### D5 — Keep operation strictly read-only

The command may hydrate the file store and read `missions.findById`. It must not call `persist`, event stores, transition guards, gates, reconciliation, receipt APIs, network APIs, or mutation methods.

**Rationale:** the dump is snapshot observation and guidance only. Read-only behavior protects the never-second-authority invariant and makes rollback additive.

### D6 — Publish a DRAFT contract, not a frozen declaration

`contracts/projection.md` follows the established 11-part DRAFT structure described below. Its IMPORTANT callout states all of the following:

- status is DRAFT at v0.1 and NOT frozen;
- `projection/__tests__/` pins the documented behavior;
- this slice adds no second conformance suite;
- passing the suite does not prove adoption;
- freeze requires documented ecosystem adoption plus explicit maintainer approval.

`cmd/declared-surface.ts` remains byte-for-byte untouched and projection is not added to either frozen declaration collection.

**Rationale:** conformance evidence and ecosystem adoption are different claims. Promoting a DRAFT into the six-contract frozen identity set would be false authority.

### D7 — Make doctor inventory testable without changing package exports

`cmd/commands/doctor.ts` adds `project` to its CLI inventory. The inventory may be lifted to a module-level readonly exported constant used by `doctorCommand`, solely as a command-layer test seam; it is not added to the package export map.

**Rationale:** the specification requires a smoke assertion that doctor identifies `project`. Reusing one constant avoids a test-only duplicate while preserving the public package surface.

## File map

| Path | Change | Responsibility |
| --- | --- | --- |
| `cmd/commands/project.ts` | New | Parse, read mission, call projector, emit wrapped JSON, map exits. |
| `cmd/__tests__/project.test.ts` | New | Command-layer behavior and wiring smoke only. |
| `cmd/cli.ts` | Modify | Import, `COMMANDS` entry, one-level dispatch branch, header/help/error text. |
| `cmd/commands/doctor.ts` | Modify | Add `project` to CLI inventory; expose the shared inventory only if needed by the smoke test. |
| `contracts/projection.md` | New | DRAFT v0.1 transport-neutral projection contract. |
| `contracts/README.md` | Modify | Add DRAFT index row and status-banner clause. |
| `cmd/declared-surface.ts` | Untouched | Keep exactly six FROZEN declared contracts. |
| `projection/**` | Untouched | Existing semantic implementation and conformance authority. |
| `package.json` | Untouched | Existing `drenyra-ai` bin and `./projection` export are sufficient. |

## Function signatures and illustrative flow

```ts
// cmd/commands/project.ts
export async function projectCommand(args: string[]): Promise<number>;

// Existing library; unchanged.
export function projectMission(
  snapshot: MissionProjectionSnapshot,
  request?: MissionProjectionRequest,
): MissionProjectionResult;
```

Illustrative command body:

```ts
export async function projectCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try {
    flags = parseMissionFlags(args);
  } catch (error) {
    return usageError(`project: ${errorMessage(error)}`);
  }
  if (flags.demo) return usageError("project does not support --demo");
  if (flags.rest.some((arg) => arg.startsWith("-"))) {
    return usageError("project: unsupported flag");
  }
  const missionId = flags.rest[0];
  if (missionId === undefined || flags.rest.length !== 1) {
    return usageError("usage: drenyra-ai project <missionId> [--store <file>]");
  }
  try {
    const stores = await new MissionFileStore(flags.storePath).hydrate();
    const snapshot = await stores.missions.findById(missionId);
    if (snapshot === undefined) {
      emitJson({ error: { code: "MISSION_NOT_FOUND", message: `Mission ${missionId} not found`, statusCode: 404 } });
      emitSummary("project", `mission ${missionId} not found`);
      return 1;
    }
    const projection = projectMission({ status: snapshot.status });
    emitJson({ missionId, projection });
    return 0;
  } catch (error) {
    console.error(`project: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
```

## Fail-closed flow and exit codes

| Condition | Output | Exit |
| --- | --- | --- |
| Exactly one mission ID, readable store, mission found | `{ missionId, projection }` JSON; optional stderr summary | `0` |
| Mission absent, including an empty non-existent store | Structured JSON error with `code: "MISSION_NOT_FOUND"` | `1` |
| Missing/extra positional, `--demo`, unsupported flag, or missing `--store` value | Usage/error text; no projection JSON | `2` |
| Store I/O failure or malformed store data | Error text; no partial/fabricated projection | `2` |

All parsing and loading failures terminate before `projectMission`. Mission absence terminates before projection. No error path emits a partial projection.

## Contract document outline

`contracts/projection.md` uses these 11 ordered parts:

1. `# Contract: projection`.
2. Header: `Version: 0.1 · Status: DRAFT · Transport-agnostic.`
3. A transport-neutral definition of the read-only projection boundary.
4. IMPORTANT DRAFT callout with conformance delegation, non-adoption warning, and freeze criteria.
5. `## Purpose`.
6. `## Normative surface`.
7. `## Invariants`.
8. `## Fail-closed behavior`.
9. `## Conformance`.
10. `## Compatibility` and `## Freeze criteria` as consecutive policy sections.
11. `## Non-claims`.

The normative result is the existing union: a normal projection contains `status`, `eligibleTransitions`, optional `recoveryTransitions`, `nextAction`, and optional `deny`; an unsupported result is the library's denial-only fail-closed result. The 15 statuses are `DRAFT`, `QUEUED`, `RUNNING`, `BLOCKED`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `COMPLETED`, `FAILED`, `UNKNOWN`, `RECOVERING`, `WAITING_FOR_EVIDENCE`, `BLOCKED_BY_GATE`, and `RETRYING`.

The closed `nextAction` vocabulary is exactly: `none`, `queue`, `run`, `monitor`, `resume`, `review`, `finalize`, `request-revision`, `requeue`, `reconcile`, `provide-evidence`, `resolve-gate`.

For `UNKNOWN`, `eligibleTransitions` is empty and `recoveryTransitions` is exactly `RUNNING`, `FAILED`, `COMPLETED`, in that labeled collection and never as ordinary progression.

The closed denial mappings are documented without reinterpretation:

- `INVALID_TRANSITION`: `terminal-state` / `no-continuation-available`, or `transition-not-eligible` / `choose-eligible-transition`.
- `APPROVAL_REQUIRED`: `approval-context-required` / `provide-approval-context`.
- `MISSING_EVIDENCE`: `evidence-context-required` / `provide-evidence-context`.
- `POLICY_BLOCKED`: `policy-context-blocked` / `resolve-policy-context`.
- `UNSUPPORTED_STATUS`: `unsupported-status-value` / `provide-supported-status`, or `malformed-projection-request` / `correct-projection-request`.

Invariants explicitly cover canonical status passthrough, canonical eligibility, UNKNOWN separation, determinism, immutability, fail-closed behavior, never-second-authority, and receipt fidelity. `nextAction` is guidance and `deny` is explanation; neither approves, executes, verifies, or completes a transition. The surface exposes no generic `verified` field and no receipt, hash, signature, signer-trust, or integrity-verification authority.

Conformance delegates only to `projection/__tests__/`. Compatibility states DRAFT changes require a version bump and coordinated documentation/conformance updates. Non-claims include adoption, freeze, consumers in production, MCP, UI, mutation, receipts, evidence, memory, ledger, journal, money, fiscal conclusions, and SUNAT behavior.

`contracts/README.md` adds `projection | 0.1 | DRAFT | Drenyra Command Center, Drenyra Pi, CLI` and updates the status banner to mention the DRAFT without changing the statement that exactly six contracts are FROZEN.

## Command-layer test plan and TDD order

Tests use Vitest, mocked `MissionFileStore` hydration/findById for deterministic snapshots, and spies on `console.log`/`console.error`. They inspect wrapper and pass-through shape, not projection matrices.

1. **RED/GREEN 1 — command skeleton and happy path.** Add one `QUEUED` case proving exit `0`, mission ID wrapper, JSON emission, and deep equality between emitted `projection` and the projector result.
2. **RED/GREEN 2 — error paths.** Table-drive missing mission (`1` + `MISSION_NOT_FOUND`) and usage/store failures (`2`), including no ID, extra positional, `--demo`, unknown flag, missing store value, malformed data, and I/O failure. Assert no projection JSON on exit `2`.
3. **RED/GREEN 3 — UNKNOWN and shape table.** Table-drive all 15 statuses with thin checks only: exit `0`, status passthrough, `eligibleTransitions` is an array, and `nextAction` exists. Add a focused UNKNOWN shape check and a no-denial-without-request assertion. A projector mock may return a typed denial once to prove the command preserves it unchanged; this tests adapter pass-through, not denial semantics.
4. **RED/GREEN 4 — wiring smoke.** Invoke CLI help/dispatch through a subprocess or existing CLI harness to prove `project` is reachable and documented with the exact syntax. Assert the doctor inventory contains `project` through the shared inventory seam. Check the unknown-command expected list includes `project`.
5. **Documentation 5 — contract and index.** Write/read back the 11-part DRAFT document and README entry. No new contract-side test suite is created.

The test suite must not reassert the full transition matrix, action mapping, denial precedence/matrix, determinism, or immutability; those remain owned by `projection/__tests__/`.

## Honest changed-line estimate

| Area | Estimated changed lines |
| --- | ---: |
| `cmd/commands/project.ts` | 130–180 |
| `cmd/__tests__/project.test.ts` | 150–220 |
| `contracts/projection.md` | 120–160 |
| `cmd/cli.ts` + `cmd/commands/doctor.ts` wiring | 10–20 |
| `contracts/README.md` | 3–5 |
| **Total** | **413–585** |

Midpoint is approximately **499 lines**. This exceeds the 300-line review budget and the 400-line chaining threshold. The planned delivery remains one cohesive PR with a documented size exception. If maintainers reject the exception, split at the stable boundary: PR 1 contract plus README; PR 2 command, tests, CLI wiring, and doctor inventory.

## Open risks

1. **Dispatcher drift:** one-level `project` can be accidentally rendered as `project run`. Mitigation: exact-syntax help and dispatch smoke.
2. **Projection duplication:** command tests can grow into a second semantic suite. Mitigation: shape/pass-through assertions only and explicit delegation to `projection/__tests__/`.
3. **False contract promotion:** a DRAFT may be added to frozen declarations. Mitigation: keep `cmd/declared-surface.ts` untouched and verify the six-frozen wording.
4. **Parser permissiveness:** `parseMissionFlags` preserves unknown tokens. Mitigation: command-level rejection of flag-shaped leftovers, `--demo`, and extra positionals.
5. **Size overrun:** the midpoint is already above 400. Mitigation: record the exception before apply and preserve the documented two-PR fallback.
6. **Stale observation:** the store can change after the dump. Mitigation: contract language states the output is a snapshot observation, never authorization.
