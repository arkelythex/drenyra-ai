/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — public surface.
 *
 * Pure library module: exports the deterministic annual tax-settlement engine
 * (net income determination, annual ISR, settlement against provisional
 * payments, year-end closing to retained earnings, declaration payload, and
 * post-settlement report), the canonical types, and the fail-closed error.
 * It composes over the SDD-CON-002 `close-calculations/` primitives by import
 * only and imports nothing from `agents/`, `cmd/`, `ledger/`, `mcp/`,
 * `adapters/`, or the sibling `bank-reconciliation/`; adapters bind to this
 * surface in a later slice.
 */

export * from "./types.js";
export {
	countClosedMonthlyPeriods,
	determineAnnualNetIncome,
} from "./net-income.js";
export {
	computeAnnualIsr,
	DEFAULT_MAX_STATUTORY_RATE_BP,
	DEFAULT_STATUTORY_RATE_BP,
} from "./isr.js";
export { computeAnnualSettlement } from "./settlement.js";
export { closeAnnualResults } from "./close-results.js";
export {
	buildAnnualDeclaration,
	type AnnualDeclarationInput,
	type AnnualDeclarationPayload,
} from "./declaration.js";
export {
	buildAnnualReport,
	type AnnualReport,
	type AnnualReportInput,
} from "./report.js";
