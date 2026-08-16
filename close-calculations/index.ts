/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — public surface.
 *
 * Pure library module: exports only the deterministic engine functions
 * (depreciation, provisions, provisional ISR, closing entries, post-close
 * report), the canonical types, and the shared fail-closed invariants. It
 * imports nothing from `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, or the
 * sibling `bank-reconciliation/`; adapters bind to this surface in a later
 * slice. The audit-only `ledger/` module never imports this module.
 */

export { computeDepreciation } from "./depreciation.js";
export { computeProvisions } from "./provisions.js";
export { computeProvisionalIsr } from "./isr.js";
export { closeResultAccounts } from "./close-results.js";
export { buildCloseReport } from "./report.js";
export * from "./types.js";
