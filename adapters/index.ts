/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Public API of the evidence adapter framework (Design 03/04). */

export * from "./registry.js";
export * from "./local.js";
export * from "./connector.js";
