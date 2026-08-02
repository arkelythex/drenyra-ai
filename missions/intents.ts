/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Intent handlers — pluggable per-intent mission execution.
 *
 * Mirrors the API's intent-handler registry concept with a synchronous
 * execute() contract: a handler receives the current snapshot and the execute
 * command, and returns either the next snapshot (a state change) or null (no
 * change; the runtime keeps the mission RUNNING). Handlers must return a
 * single legal transition per call — the runtime validates it.
 */

import type { MissionIntent, ExecuteMissionCommand } from "./commands.js";
import type { MissionSnapshot } from "./types.js";

/**
 * Executes one step of a mission for its intent.
 *
 * @returns the next snapshot when the handler changes mission state, or null
 *          to signal "no state change" (the runtime then keeps the default
 *          target status).
 */
export interface IntentHandler {
  intent: MissionIntent;
  execute(
    mission: MissionSnapshot,
    command: ExecuteMissionCommand,
  ): Promise<MissionSnapshot | null>;
}

/**
 * Resolves intent handlers by mission intent.
 */
export interface IntentRegistry {
  register(handler: IntentHandler): void;
  resolve(intent: MissionIntent): IntentHandler | undefined;
}

/**
 * Default in-memory intent registry.
 */
export class IntentRegistryImpl implements IntentRegistry {
  private readonly handlers = new Map<MissionIntent, IntentHandler>();

  register(handler: IntentHandler): void {
    this.handlers.set(handler.intent, handler);
  }

  resolve(intent: MissionIntent): IntentHandler | undefined {
    return this.handlers.get(intent);
  }
}
