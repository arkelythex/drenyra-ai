#!/usr/bin/env bun
/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * drenyra-ai CLI — thin dispatcher.
 *
 * Parses the top-level command/subcommand pair, routes to the command
 * adapters in cmd/commands/, and maps exit codes (0 success, 1 business error,
 * 2 usage/IO). JSON goes to stdout; the human-readable one-line summary goes
 * to stderr. `--help`/`-h` prints this help text and exits 0.
 *
 * Commands:
 *   drenyra-ai receipt verify <receipt.json> [--keys <keys.json>]
 *   drenyra-ai ledger validate <ledger.json>
 *   drenyra-ai mission start <create-command.json> [--store <file>] [--demo]
 *   drenyra-ai mission apply <command.json> [--store <file>] [--demo]
 *   drenyra-ai mission status <missionId> [--store <file>]
 *   drenyra-ai mission recover [--store <file>]
 *   drenyra-ai candidate inspect <candidate.json>
 *   drenyra-ai candidate verify <candidate.json> --subject <subject-file>
 *   drenyra-ai gate check <gate-input.json>
 *
 * Mission note: real deterministic intent handlers for every frozen mission
 * intent (see agents/) are registered by default, so `mission apply` execute
 * commands stage work and pause at the evidence or approval gate. `--demo`
 * is accepted for compatibility and has no effect.
 */

import { receiptVerifyCommand } from "./commands/receipt-verify.js";
import { ledgerValidateCommand } from "./commands/ledger-validate.js";
import { missionStartCommand } from "./commands/mission-start.js";
import { missionApplyCommand } from "./commands/mission-apply.js";
import { missionStatusCommand } from "./commands/mission-status.js";
import { missionRecoverCommand } from "./commands/mission-recover.js";
import { candidateInspectCommand } from "./commands/candidate-inspect.js";
import { candidateVerifyCommand } from "./commands/candidate-verify.js";
import { gateCheckCommand } from "./commands/gate-check.js";
import { capabilitiesCommand } from "./commands/capabilities.js";
import { doctorCommand } from "./commands/doctor.js";
import { usageError } from "./output/errors.js";

/** Command handler signature: raw args, resolved exit code (0/1/2). */
type CommandHandler = (args: string[]) => number | Promise<number>;

const COMMANDS: Readonly<Record<string, Readonly<Record<string, CommandHandler>>>> = {
  receipt: { verify: receiptVerifyCommand },
  ledger: { validate: ledgerValidateCommand },
  mission: {
    start: missionStartCommand,
    apply: missionApplyCommand,
    status: missionStatusCommand,
    recover: missionRecoverCommand,
  },
  candidate: {
    inspect: candidateInspectCommand,
    verify: candidateVerifyCommand,
  },
  gate: {
    check: gateCheckCommand,
  },
      capabilities: {
        show: capabilitiesCommand,
      },
      doctor: {
        run: doctorCommand,
      },
};

function helpText(): string {
  return [
    "drenyra-ai — Receipt-Driven Accounting core CLI",
    "",
    "Usage:",
    "  drenyra-ai <command> <subcommand> [args]",
    "",
    "Commands:",
    "  receipt verify <receipt.json> [--keys <keys.json>]",
    "    Verify a signed receipt bundle (hash + Ed25519 signature + trusted signer).",
    "  ledger validate <ledger.json>",
    "    Validate an append-only audit ledger hash chain.",
    "  mission start <create-command.json> [--store <file>] [--demo]",
    "    Create a new mission (DRAFT).",
    "  mission apply <command.json> [--store <file>] [--demo]",
    "    Apply an execute/approve/reject/reconcile command (real intent handlers by default).",
    "  mission status <missionId> [--store <file>]",
    "    Show a mission snapshot and its event log.",
    "  mission recover [--store <file>]",
    "    Crash-safe recovery: mark in-flight RUNNING missions UNKNOWN (idempotent).",
    "  candidate inspect <candidate.json>",
    "    Derive candidate identity + materiality from an inspect file.",
    "  candidate verify <candidate.json> --subject <subject-file>",
    "    Revalidate candidate identity against the exact subject bytes.",
    "  gate check <gate-input.json>",
    "    Run the standard gates [mission, receipt, approval] over a gate input.",
    "  capabilities show",
    "    Declare available contracts, skills, jurisdictions, and adapters.",
    "  doctor run",
    "    Read-only ecosystem health check.",
    "",
    "Exit codes: 0 success, 1 business error (JSON error to stdout), 2 usage/IO.",
    "",
    "Mission store file (default ./drenyra-missions.json):",
    "  { storeSchemaVersion, missions, events, idempotency }",
    "",
    "Real deterministic intent handlers for every mission intent (monthly-close,",
    "correction, reconciliation, invoice-review, compliance-check) are registered",
    "by default: execute commands stage work and pause at the evidence or",
    "approval gate. --demo is accepted for compatibility and has no effect.",
    "",
  ].join("\n");
}

async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  const subcommand = argv[1];
  if (command === "--help" || command === "-h" || command === "help") {
    console.log(helpText());
    return 0;
  }
  const handler = COMMANDS[command ?? ""]?.[subcommand ?? ""];
  if (handler === undefined) {
    return usageError(
      `unknown command "${command ?? ""} ${subcommand ?? ""}"; expected "receipt verify", "ledger validate", "mission start|apply|status|recover", "candidate inspect|verify", or "gate check"`,
    );
  }
  return handler(argv.slice(2));
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
