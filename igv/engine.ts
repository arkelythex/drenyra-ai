/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * IGV determination — orchestrates débito/crédito fiscal into the net
 * position for one RUC + fiscal period.
 *
 * `determineIgv(scope, salesLines, purchaseLines, policy)` computes the
 * débito fiscal (output tax on taxable sales), the crédito fiscal (input tax
 * on eligible purchases, TUO IGV Arts. 18-19), and the net position:
 * `payable` when débito exceeds crédito, `in-favor` (saldo a favor) when
 * crédito exceeds débito, `zero` when they are equal — mirroring the
 * three-way `AnnualBalanceKind` shape. The rate is a validated policy input
 * in basis points, defaulting to the standard combined rate (18% = 1800 bp,
 * TUO IGV — D.S. 055-99-EF); a rate outside the legal envelope is rejected
 * fail-closed with `RATE_OUT_OF_BOUNDS`.
 */

import { computeCreditoFiscal } from "./credit.js";
import { computeDebitoFiscal } from "./debit.js";
import {
	assertRateInBounds,
	DEFAULT_IGV_RATE_BP,
	DEFAULT_MAX_IGV_RATE_BP,
	validateScope,
	type IgvDetermination,
	type IgvPolicy,
	type PurchaseLine,
	type SalesLine,
	type Scope,
} from "./types.js";

/** Determine the IGV débito/crédito/net position for one RUC + fiscal period. */
export function determineIgv(
	scope: Scope,
	salesLines: readonly SalesLine[],
	purchaseLines: readonly PurchaseLine[],
	policy?: IgvPolicy,
): IgvDetermination {
	validateScope(scope);

	const maxRateBp = policy?.maxRateBp ?? DEFAULT_MAX_IGV_RATE_BP;
	const rateBp = policy?.rateBp ?? DEFAULT_IGV_RATE_BP;
	assertRateInBounds(rateBp, maxRateBp, "IGV");

	const debitoFiscalCents = computeDebitoFiscal(scope, salesLines, rateBp);
	const { creditoFiscalCents, excludedCreditLines } = computeCreditoFiscal(
		scope,
		purchaseLines,
		rateBp,
	);

	const netPositionCents = debitoFiscalCents - creditoFiscalCents;
	const netPositionKind =
		netPositionCents > 0n
			? "payable"
			: netPositionCents < 0n
				? "in-favor"
				: "zero";

	return {
		scope,
		debitoFiscalCents,
		creditoFiscalCents,
		netPositionCents,
		netPositionKind,
		excludedCreditLines,
		rateBp,
	};
}
