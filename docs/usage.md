# Drenyra AI — Usage

Full reference for the `drenyra-ai` CLI, the mission store, and the library subpaths. For a five-minute start, see [Quickstart](quickstart.md).

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); version/sequence numbers are JSON integers, never floats.

---

## CLI reference

```bash
drenyra-ai <command> <subcommand> [args]
```

### Receipts and ledger

| Command | What it does |
| --- | --- |
| `drenyra-ai receipt verify <receipt.json> [--keys <keys.json>]` | Verify a signed receipt bundle (hash + Ed25519 signature + trusted signer) |
| `drenyra-ai ledger validate <ledger.json>` | Validate an append-only audit ledger hash chain |

### Missions

| Command | What it does |
| --- | --- |
| `drenyra-ai mission start <create-command.json> [--store <file>] [--demo]` | Create a new mission (DRAFT) |
| `drenyra-ai mission apply <command.json> [--store <file>] [--demo]` | Apply an execute/approve/reject/reconcile command (real intent handlers by default) |
| `drenyra-ai mission status <missionId> [--store <file>]` | Show a mission snapshot and its event log |
| `drenyra-ai mission recover [--store <file>]` | Crash-safe recovery: mark in-flight RUNNING missions UNKNOWN (idempotent) |
| `drenyra-ai project <missionId> [--store <file>]` | Read-only projection dump (status, transitions, next action) as JSON |

### Candidates and gates

| Command | What it does |
| --- | --- |
| `drenyra-ai candidate inspect <candidate.json>` | Derive candidate identity + materiality from an inspect file |
| `drenyra-ai candidate verify <candidate.json> --subject <subject-file>` | Revalidate candidate identity against the exact subject bytes |
| `drenyra-ai candidate audit <candidate.json>` | Guardian Angel read-only adversarial review (findings only) |
| `drenyra-ai gate check <gate-input.json>` | Run the standard gates (mission, receipt, approval) over a gate input |

### Ecosystem surface

| Command | What it does |
| --- | --- |
| `drenyra-ai capabilities show` | Declare available contracts, skills, jurisdictions, and adapters |
| `drenyra-ai doctor run [--home <dir>]` | Read-only ecosystem health check |
| `drenyra-ai install run [--home <dir>]` | Detect and configure existing agent hosts (never installs a host) |
| `drenyra-ai sync run [--home <dir>]` | Refresh managed assets without overwriting foreign changes |
| `drenyra-ai upgrade run <version> [--home <dir>]` | Transition the managed composition to a packaged version (never installs a host) |
| `drenyra-ai rollback run [--home <dir>]` | Restore the previous managed composition (idempotent; never installs a host) |
| `drenyra-ai mcp serve` | Run the MCP server over stdio (JSON-RPC 2.0, one message per line) |

## Exit codes and output

- `0` — success
- `1` — business error (JSON error to stdout)
- `2` — usage/IO

**JSON goes to stdout; the human-readable one-line summary goes to stderr.** Scripts should parse stdout as JSON and treat stderr as diagnostics.

## The mission store

Missions persist to a JSON store (default `./drenyra-missions.json`), shaped as:

```text
{ storeSchemaVersion, missions, events, idempotency }
```

Real deterministic intent handlers are registered for every mission intent — `monthly-close`, `correction`, `reconciliation`, `invoice-review`, `compliance-check` — and stage work, request evidence, and pause at the evidence or approval gate. The deterministic Core (transitions, idempotency, rules) remains the authority for what may actually change.

## Library subpaths

The package exposes each subsystem as an ESM subpath (all via `dist/`):

```text
drenyra-ai                      core index
drenyra-ai/missions             mission protocol + MissionRuntime
drenyra-ai/candidates           candidate identity and materiality
drenyra-ai/review               proportional review lenses + forecasting
drenyra-ai/receipts             receipt schemas and verification
drenyra-ai/ledger               audit ledger core
drenyra-ai/gates                lifecycle gates
drenyra-ai/recovery             crash recovery and resumption
drenyra-ai/tenant               tenant-core primitives (RUC/company/period scope)
drenyra-ai/adapters             adapter surface
drenyra-ai/configurator         installer/configurator surface
drenyra-ai/mcp                  MCP server surface
drenyra-ai/skills               versioned skills registry runtime
…and the domain service modules (fiscal, journal, cdr, bank-reconciliation,
close-calculations, annual-declaration, authorization, evidence, flow,
guardian, policy, projection, routing, security, cdr)
```

Library modules use `node:crypto` only; the CLI adds `ajv` for schema validation. Integrate via the [SDK](sdk.md) for the typed API.

## Read next

- [Quickstart](quickstart.md) — get running in five minutes
- [SDK](sdk.md) — typed library integration
- [Intended Usage](intended-usage.md) — the frontier and the responsibility split
