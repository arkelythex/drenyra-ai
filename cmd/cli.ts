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
 *   drenyra-ai project <missionId> [--store <file>]
 *   drenyra-ai candidate inspect <candidate.json>
 *   drenyra-ai candidate verify <candidate.json> --subject <subject-file>
 *   drenyra-ai gate check <gate-input.json>
 *
 * Mission note: real deterministic intent handlers for every frozen mission
 * intent (see agents/) are registered by default, so `mission apply` execute
 * commands stage work and pause at the evidence or approval gate. `--demo`
 * is accepted for compatibility and has no effect.
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { receiptVerifyCommand } from "./commands/receipt-verify.js";
import { ledgerValidateCommand } from "./commands/ledger-validate.js";
import { missionStartCommand } from "./commands/mission-start.js";
import { missionApplyCommand } from "./commands/mission-apply.js";
import { missionStatusCommand } from "./commands/mission-status.js";
import { missionRecoverCommand } from "./commands/mission-recover.js";
import { projectCommand } from "./commands/project.js";
import { candidateInspectCommand } from "./commands/candidate-inspect.js";
import { candidateVerifyCommand } from "./commands/candidate-verify.js";
import { candidateAuditCommand } from "./commands/candidate-audit.js";
import { gateCheckCommand } from "./commands/gate-check.js";
import { capabilitiesCommand } from "./commands/capabilities.js";
import { doctorCommand } from "./commands/doctor.js";
import { installCommand } from "./commands/install.js";
import { syncCommand } from "./commands/sync.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { rollbackCommand } from "./commands/rollback.js";
import { mcpServeCommand } from "./commands/mcp-serve.js";
import { usageError } from "./output/errors.js";

/** Command handler signature: raw args, resolved exit code (0/1/2). */
type CommandHandler = (args: string[]) => number | Promise<number>;

export const COMMANDS: Readonly<Record<string, Readonly<Record<string, CommandHandler>>>> = {
  receipt: { verify: receiptVerifyCommand },
  ledger: { validate: ledgerValidateCommand },
  mission: {
    start: missionStartCommand,
    apply: missionApplyCommand,
    status: missionStatusCommand,
    recover: missionRecoverCommand,
  },
  project: {
    run: projectCommand,
  },
  candidate: {
    inspect: candidateInspectCommand,
    verify: candidateVerifyCommand,
    audit: candidateAuditCommand,
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
      install: {
        run: installCommand,
      },
      sync: {
        run: syncCommand,
      },
      upgrade: {
        run: upgradeCommand,
      },
      rollback: {
        run: rollbackCommand,
      },
      mcp: {
        serve: mcpServeCommand,
      },
};

export function helpText(): string {
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
    "  project <missionId> [--store <file>]",
    "    Read-only projection dump (status, transitions, next action) as JSON.",
    "  candidate inspect <candidate.json>",
    "    Derive candidate identity + materiality from an inspect file.",
    "  candidate verify <candidate.json> --subject <subject-file>",
    "    Revalidate candidate identity against the exact subject bytes.",
    "  candidate audit <candidate.json>",
    "    Guardian Angel read-only adversarial review (findings only).",
    "  gate check <gate-input.json>",
    "    Run the standard gates [mission, receipt, approval] over a gate input.",
    "  capabilities show",
    "    Declare available contracts, skills, jurisdictions, and adapters.",
    "  doctor run",
    "    Read-only ecosystem health check.",
    "  install run [--home <dir>]",
    "    Detect and configure existing agent hosts (never installs a host).",
    "  sync run [--home <dir>]",
    "    Refresh managed assets without overwriting foreign changes.",
    "  upgrade run <version> [--home <dir>]",
    "    Transition the managed composition to a packaged version (never installs a host).",
    "  rollback run [--home <dir>]",
    "    Restore the previous managed composition (idempotent; never installs a host).",
    "  mcp serve",
    "    Run the MCP server over stdio (JSON-RPC 2.0, one message per line).",
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

export async function main(argv: string[]): Promise<number> {
      const command = argv[0];
      const subcommand = argv[1];
      if (command === "--help" || command === "-h" || command === "help") {
        console.log(helpText());
        return 0;
      }
      if (command === "project") {
        // One-level command: `drenyra-ai project <missionId> [--store <file>]`.
        return COMMANDS.project.run(argv.slice(1));
      }
      const handler = COMMANDS[command ?? ""]?.[subcommand ?? ""];
      if (handler === undefined) {
        return usageError(
          `unknown command "${command ?? ""} ${subcommand ?? ""}"; expected "receipt verify", "ledger validate", "mission start|apply|status|recover", "project <missionId> [--store <file>]", "candidate inspect|verify", "gate check", "doctor run", "install run", "sync run", "upgrade run", or "rollback run"`,
        );
      }
      return handler(argv.slice(2));
    }

    const isCliEntry =
      process.argv[1] !== undefined &&
      (() => {
        try {
          return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
        } catch {
          return false;
        }
      })();

    if (isCliEntry) {
      const exitCode = await main(process.argv.slice(2));
      process.exit(exitCode);
    }
