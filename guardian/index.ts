/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Public API of the Guardian Angel module — adversarial read-only review. */

export * from "./guardian.js";
export * from "./refutation.js";
export * from "./resolution.js";
