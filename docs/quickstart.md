# Drenyra AI — Quickstart

← [Back to README](../README.md)

Start with read-only inspection, then create one isolated draft mission. This
path checks that the runtime works without posting entries, contacting SUNAT,
or treating a configured agent as fiscal authority.

## Quick path

Requires **Node.js 22+** and npm. Install the binary globally if you want to run
it directly from your shell:

```bash
npm install -g drenyra-ai
drenyra-ai --help
drenyra-ai capabilities show
```

Expected: help lists the command surface; capabilities returns JSON. Exit `0`
means success. Neither command creates an accounting mission.

## Prerequisites

- Node.js `>=22`, as declared by `package.json`.
- npm for a package install; Bun for repository development scripts.
- Git if building from source.
- Your own evidence and approval context before attempting fiscal work.

> [!IMPORTANT]
> Money is BigInt cents, never floats. Company/RUC/period scope is mandatory.
> Creating a draft does not approve, post, declare, or execute external work.

## Install

For an application dependency rather than a global binary:

```bash
npm install drenyra-ai
npm exec -- drenyra-ai --help
```

The package ships ESM output in `dist/`, a CLI binary, and typed subsystem
subpaths. A local install does not create a globally available shell command.
See the [SDK](sdk.md) for library integration.

## Verify the install

```bash
drenyra-ai capabilities show
drenyra-ai doctor run
```

Capabilities declares the available contracts, skills, jurisdictions, and
adapters. Doctor diagnoses ecosystem configuration; a warning about an
unconfigured host is not proof that receipt verification is unavailable.

Core commands do not require configuring a host. To configure an existing host,
use `drenyra-ai install run`, then run doctor again. Installation writes managed
assets; it never installs an agent runtime for you.

## A minimal session

Work in an empty test directory. Save this synthetic create-command example as
`mission-create.json`:

```json
{
  "companyId": "20123456789",
  "fiscalPeriod": "202607",
  "intent": "monthly-close",
  "input": {
    "instruction": "Prepare a reviewable monthly-close draft; do not submit externally."
  }
}
```

Then create a draft in an explicitly named store:

```bash
drenyra-ai mission start mission-create.json --store ./example-missions.json
```

Expected: exit `0`, a JSON snapshot with `status: "DRAFT"` on stdout, and a
summary/audit diagnostics on stderr. Copy the returned `id`; replace `MISSION_ID`
below with that value:

```bash
drenyra-ai mission status MISSION_ID --store ./example-missions.json
drenyra-ai project MISSION_ID --store ./example-missions.json
```

Both inspect persisted state. `mission apply` consumes a separate command JSON;
it is not the next step to run blindly. Review the [command protocol](../contracts/mission-protocol.md)
and [CLI reference](usage.md) before advancing a mission.

For your own prepared artifacts, receipt and ledger verification are read-only:

```bash
drenyra-ai receipt verify receipt.json --keys keys.json
drenyra-ai ledger validate ledger.json
```

Those filenames stand for real inputs you provide, not files created by install.
A valid signature also needs a trusted signer; a missing key is not permission
to skip trust verification.

## The target experience

Professionals should ask for an accounting result through their interface, not
operate agent orchestration. The commands above exercise the headless runtime;
they are not a claim that the entire planned Desktop workflow is available.
See [Intended Usage](intended-usage.md) for that boundary.

## Install from source

```bash
git clone https://github.com/arkelythex/drenyra-ai.git
cd drenyra-ai
bun install --frozen-lockfile
bun run build
node dist/cmd/cli.js --help
```

## Next steps

- [Usage](usage.md) — every command, output channel, audit setting, and store option.
- [SDK](sdk.md) — integrate the same core through typed ESM subpaths.
- [Trust Model](architecture/trust-model.md) — distinguish evidence from authority.
- [Recovery runbook](runbooks/04-recovery.md) — handle interrupted work without guessing.
