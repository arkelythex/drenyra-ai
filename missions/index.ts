/**
 * Public API of the mission subsystem.
 *
 * Ported from @drenyra/mission-protocol (canonical) + @drenyra/mission-domain
 * (state-machine enforcement) + new runtime/store/intent layers. This module
 * is the TypeScript reference implementation of contracts/mission-protocol.md
 * with ZERO runtime dependencies (node:crypto built-in only).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */

export * from "./status.js";
export * from "./commands.js";
export * from "./events.js";
export * from "./errors.js";
export * from "./versioning.js";
export * from "./idempotency.js";
export * from "./types.js";
export {
  transition,
  validateTransition,
  guardTerminal,
  reconcileTransition,
  isValidRecoveryPath,
} from "./transitions.js";
export * from "./store.js";
export * from "./intents.js";
export { MissionRuntime, canonicalHash, IdempotencyConflict } from "./runtime.js";
export type { MissionApplyResult, BoundMissionCommand } from "./runtime.js";
export * from "./fencing.js";
export * from "./outbox.js";
export * from "./reconciliation.js";
