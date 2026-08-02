/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * Mission CLI wiring — shared flag parsing for the mission commands plus the
 * demo auto-advance intent handler.
 *
 * The demo handler advances a mission one legal status per execute command so
 * the full lifecycle can be driven from the shell (start -> execute x3 ->
 * approve). It is NOT registered by default: `mission start`/`mission apply`
 * only register it when the invocation passes `--demo`. All transitions below
 * are protocol-legal (they come from the canonical status machine's
 * transition table).
 */

import { IntentRegistryImpl, type MissionSnapshot, AccountingMissionStatus } from "../../missions/index.js";
import { DEFAULT_STORE_PATH } from "../adapters/file-mission-store.js";

/** Intents accepted by `mission start` create commands. */
export const VALID_MISSION_INTENTS = new Set([
  "monthly-close",
  "correction",
  "reconciliation",
  "invoice-review",
  "compliance-check",
]);

/** Parsed mission command flags: --store <file> and --demo. */
export interface MissionFlags {
  storePath: string;
  demo: boolean;
  rest: string[];
}

/**
 * Parses --store <path> and --demo out of a mission command's argument list.
 * Anything else is preserved in `rest` for the command to validate. Throws on
 * a --store flag with no following path.
 */
export function parseMissionFlags(args: string[]): MissionFlags {
  const rest: string[] = [];
  let storePath: string | undefined;
  let demo = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--store") {
      const next = args[i + 1];
      if (next === undefined) {
        throw new Error("--store requires a file path");
      }
      storePath = next;
      i += 1;
    } else if (arg === "--demo") {
      demo = true;
    } else {
      rest.push(arg);
    }
  }
  return { storePath: storePath ?? DEFAULT_STORE_PATH, demo, rest };
}

/** Next single legal status for the demo auto-advance intent handler. */
export function demoNextStatus(
  status: AccountingMissionStatus,
): AccountingMissionStatus | null {
  switch (status) {
    case AccountingMissionStatus.DRAFT:
      return AccountingMissionStatus.QUEUED;
    case AccountingMissionStatus.QUEUED:
      return AccountingMissionStatus.RUNNING;
    case AccountingMissionStatus.RUNNING:
      return AccountingMissionStatus.AWAITING_APPROVAL;
    case AccountingMissionStatus.APPROVED:
      return AccountingMissionStatus.COMPLETED;
    case AccountingMissionStatus.REVISION_REQUESTED:
      return AccountingMissionStatus.QUEUED;
    case AccountingMissionStatus.BLOCKED:
    case AccountingMissionStatus.WAITING_FOR_EVIDENCE:
    case AccountingMissionStatus.BLOCKED_BY_GATE:
    case AccountingMissionStatus.RETRYING:
    case AccountingMissionStatus.RECOVERING:
    case AccountingMissionStatus.UNKNOWN:
      return AccountingMissionStatus.RUNNING;
    case AccountingMissionStatus.REJECTED:
      return AccountingMissionStatus.REVISION_REQUESTED;
    case AccountingMissionStatus.AWAITING_APPROVAL:
    case AccountingMissionStatus.COMPLETED:
    case AccountingMissionStatus.FAILED:
      return null;
  }
}

/**
 * Registers the demo auto-advance intent handler for every intent. Only called
 * when the invoking mission command passed `--demo`; the default CLI path
 * registers no intent handlers.
 */
export function registerDemoIntentHandlers(registry: IntentRegistryImpl): void {
  const advance = async (
    mission: MissionSnapshot,
  ): Promise<MissionSnapshot | null> => {
    const next = demoNextStatus(mission.status);
    if (next === null) {
      return null;
    }
    return { ...mission, status: next };
  };
  for (const intent of VALID_MISSION_INTENTS) {
    registry.register({
      intent: intent as MissionSnapshot["intent"],
      execute: advance,
    });
  }
}
