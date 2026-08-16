/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Bank reconciliation — executive report.
 *
 * `buildReport(reconciliation, balances)` compiles the executive report: initial
 * and final bank/ledger balances, the full difference detail, the adjustment
 * drafts derived from the classified differences, their net impact
 * (`netAdjustmentCents = Σ inflow − Σ outflow`, BigInt arithmetic only), and the
 * reconciliation identity check.
 *
 * `reconciled` is true ONLY when every movement is matched (no unmatched
 * differences) AND `ledgerFinal + netAdjustmentCents === bankFinal`. The report
 * never claims a reconciliation it did not achieve: any unmatched difference
 * forces `reconciled` to false even when the arithmetic identity would hold.
 * A report request whose scope is not a single valid RUC + fiscal period is
 * rejected fail-closed with `INVALID_SCOPE`.
 */

import { buildAdjustments } from "./adjust.js";
import {
	validateScope,
	type Reconciliation,
	type ReconciliationBalances,
	type ReconciliationReport,
} from "./types.js";

/** Compile the executive reconciliation report for one RUC + fiscal period. */
export function buildReport(
	reconciliation: Reconciliation,
	balances: ReconciliationBalances,
): ReconciliationReport {
	validateScope(reconciliation.scope);

	const adjustments = buildAdjustments(reconciliation.differences);
	const netAdjustmentCents = adjustments.reduce(
		(sum, draft) => sum + (draft.side === "inflow" ? draft.amountCents : -draft.amountCents),
		0n,
	);

	return {
		scope: reconciliation.scope,
		balances,
		differences: reconciliation.differences,
		adjustments,
		netAdjustmentCents,
		reconciled:
			reconciliation.fullyMatched &&
			balances.ledgerFinal + netAdjustmentCents === balances.bankFinal,
	};
}
