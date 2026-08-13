/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the fiscal candidate-ordering module (slice 1D-5).
 *
 * Exposes the FiscalCandidateOrderingAdapter, the fiscal-flow port types
 * (CoreValidator, Reconciler, FiscalSubjectBuilder, FiscalCandidatePort,
 * CandidateLifecyclePort), the fiscal-flow input/output envelopes, the
 * FISCAL_ERROR taxonomy, and FiscalError. The frozen CandidateLifecycle is
 * wired by default through CandidateLifecyclePort; the adapter never
 * subclasses or modifies that lifecycle.
 */

export * from "./types.js";
export { FiscalCandidateOrderingAdapter } from "./candidate-ordering.js";
