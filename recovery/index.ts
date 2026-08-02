/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the recovery subsystem — crash-safe mission resumption
 * (contract: contracts/recovery.md, v0.1-draft).
 *
 * ZERO runtime dependencies (node:crypto built-in only, via the missions
 * module). Recovery policy is derived from the event log, never from agent
 * transcripts: the last persisted event's snapshot is the source of truth.
 */

export {
  recoveryAction,
  decideUnknownRecovery,
  isValidSnapshot,
} from "./policy.js";
export type {
  RecoveryAction,
  UnknownRecoveryOutcome,
} from "./policy.js";
export { replayMission } from "./replay.js";
