/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * IGV determination engine — public surface.
 *
 * Pure library module: exports the deterministic IGV (Impuesto General a las
 * Ventas, TUO — D.S. 055-99-EF) determination engine (débito fiscal, crédito
 * fiscal, net position, executive report), the canonical types, and the
 * fail-closed error. It imports nothing from `agents/`, `cmd/`, `ledger/`,
 * `mcp/`, `adapters/`, or any sibling engine module (`close-calculations/`,
 * `bank-reconciliation/`, `annual-declaration/`); adapters bind to this
 * surface in a later slice.
 */

export * from "./types.js";
export { computeDebitoFiscal } from "./debit.js";
export { computeCreditoFiscal, type CreditoFiscalResult } from "./credit.js";
export { determineIgv } from "./engine.js";
export { buildIgvReport, type IgvReport } from "./report.js";
