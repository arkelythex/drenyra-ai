/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * Mission CLI wiring — shared flag parsing for the mission commands.
 *
 * `--store <path>` and `--demo` are parsed here so `mission start`/`mission
 * apply`/`mission status`/`mission recover` share one contract. `--demo` is
 * accepted for compatibility with earlier CLIs and has no effect: real
 * deterministic intent handlers are registered by default (see agents/).
 * The former demo auto-advance handler was removed when the real agent
 * handlers replaced the demo-only CLI gate.
 */

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
