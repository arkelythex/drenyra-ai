/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Agent registry composition — registers every deterministic intent handler
 * with an IntentRegistryImpl.
 *
 * The composition lives in its own module so the CLI (and future API/MCP
 * surfaces) can opt into the full orchestration set with one call. The
 * registry is Core-owned (`missions/intents.ts`); this module only populates it.
 */

import { IntentRegistryImpl } from "../missions/index.js";
import type { IntentHandler } from "../missions/index.js";
import {
  complianceCheckHandler,
  correctionHandler,
  invoiceReviewHandler,
  monthlyCloseHandler,
  reconciliationHandler,
} from "./handlers.js";

/** Every deterministic agent intent handler, one per frozen MissionIntent. */
export const AGENT_HANDLERS: readonly IntentHandler[] = [
  monthlyCloseHandler,
  correctionHandler,
  reconciliationHandler,
  invoiceReviewHandler,
  complianceCheckHandler,
];

/**
 * Builds a fresh registry with every agent intent handler registered.
 * Returns a new instance per call; registries never leak across invocations.
 */
export function createAgentRegistry(): IntentRegistryImpl {
  const registry = new IntentRegistryImpl();
  for (const handler of AGENT_HANDLERS) {
    registry.register(handler);
  }
  return registry;
}
