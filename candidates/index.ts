/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the candidate subsystem — candidate identity + proportional
 * review (slice 3 of the Drenyra ecosystem extraction).
 *
 * ZERO runtime dependencies (node:crypto only). Spec: contracts/candidate.md.
 */

export * from "./errors.js";
export * from "./identity.js";
export * from "./materiality.js";
export * from "./types.js";
export { CandidateLifecycle } from "./lifecycle.js";
export type {
  ProposeInput,
  ReviewDecision,
  ReviewRejection,
  CorrectionInput,
} from "./lifecycle.js";
