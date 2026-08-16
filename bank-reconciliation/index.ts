/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Bank reconciliation — public surface.
 *
 * Pure library module: exports only the deterministic engine functions and the
 * canonical types. It imports nothing from `agents/`, `cmd/`, `ledger/`, or any
 * adapter; adapters (MCP, missions, gates, receipts, CLI) bind to this surface
 * in a later slice.
 */

export { normalizeBankRows, normalizeLedgerRows } from "./normalize.js";
export { reconcile, type ReconcileOptions } from "./compare.js";
export { buildAdjustments, type AdjustOptions } from "./adjust.js";
export { buildReport } from "./report.js";
export * from "./types.js";
