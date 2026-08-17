# Drenyra AI — Quickstart

Get Drenyra AI running in five minutes: install the package, verify a receipt, validate a ledger, start a mission.

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); version/sequence numbers are JSON integers, never floats.

---

## Prerequisites

- **Node.js >= 22** (the package declares `engines.node >= 22`)
- **npm** (or **bun**) to install and run scripts
- Git 2.38+ if you build from source

## Install

```bash
npm install drenyra-ai
```

The package ships:

- A prebuilt ESM artifact (`dist/`, Node >= 22) — library modules use `node:crypto` only; the CLI adds `ajv` for schema validation.
- A `drenyra-ai` binary (the CLI).
- Library subpaths for each subsystem: `drenyra-ai/missions`, `drenyra-ai/receipts`, `drenyra-ai/ledger`, `drenyra-ai/gates`, `drenyra-ai/candidates`, `drenyra-ai/recovery`, `drenyra-ai/tenant`, and more (see [SDK](sdk.md)).

## Verify the install

```bash
drenyra-ai --help
drenyra-ai capabilities show     # declared contracts, skills, jurisdictions, adapters
drenyra-ai doctor run            # read-only ecosystem health check
```

Exit codes: `0` success, `1` business error (JSON error to stdout), `2` usage/IO. JSON goes to stdout; the human-readable one-line summary goes to stderr.

## A minimal session

```bash
# 1. Start a monthly-close mission
drenyra-ai mission start mission-create.json

# 2. Apply an execute command — the intent handler stages work and pauses at the gate
drenyra-ai mission apply mission-command.json

# 3. Show where it stands (snapshot + event log)
drenyra-ai mission status <missionId>

# 4. Read-only projection of status, transitions, and next action
drenyra-ai project <missionId>

# 5. Verify any receipt and validate the ledger
drenyra-ai receipt verify receipt.json
drenyra-ai ledger validate ledger.json
```

Missions persist to a JSON store (default `./drenyra-missions.json`). Crash-safe recovery marks in-flight `RUNNING` missions `UNKNOWN` — idempotent, decide-by-evidence:

```bash
drenyra-ai mission recover
```

## The target experience

After installation, a professional accountant should be able to say:

> "I use Codex, Claude, or OpenCode — but Drenyra gives them accounting memory, skills, missions, materiality controls, approvals, and verifiable evidence."

```bash
drenyra-ai install            # configure the accounting/fiscal agent runtime
drenyra-ai doctor             # read-only health check of the ecosystem
drenyra-ai mission start monthly-close
drenyra-ai candidate inspect correction.json
drenyra-ai gate check posting.json
drenyra-ai receipt verify receipt.json
drenyra-ai ledger validate ledger.json
```

## Install from source

```bash
git clone https://github.com/arkelythex/drenyra-ai.git
cd drenyra-ai
bun install --frozen-lockfile
bun run build                # builds dist/ via scripts/build.mjs
node dist/cmd/cli.js --help
```

## Next steps

- Full CLI reference → [Usage](usage.md)
- Integrate via the library surface → [SDK](sdk.md)
- Understand the trust model → [Trust Model](architecture/trust-model.md)
- Understand the frozen contracts → [Contracts](../contracts/README.md)
