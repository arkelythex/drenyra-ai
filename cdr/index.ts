/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Public API of the CDR successor module (1E-2, steps 1-7). */
export * from "./types.js";
export { CdrSuccessorComposer } from "./successor.js";
