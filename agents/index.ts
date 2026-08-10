/**
 * Drenyra-AI agent orchestration layer — public API.
 *
 * Deterministic intent handlers + registry composition over the frozen
 * missions Core. This layer stages work only; the Core lifecycle, gates,
 * receipts, and human approval remain authoritative.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */

export {
  AGENT_INTENTS,
  INTENT_PLANS,
} from "./plans.js";
export type { AgentPlanStep, IntentPlan } from "./plans.js";
export {
  PlanIntentHandler,
  complianceCheckHandler,
  correctionHandler,
  invoiceReviewHandler,
  monthlyCloseHandler,
  reconciliationHandler,
} from "./handlers.js";
export { AGENT_HANDLERS, createAgentRegistry } from "./registry.js";
