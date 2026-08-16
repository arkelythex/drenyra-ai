/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — fixed-asset depreciation.
 *
 * `computeDepreciation(scope, assets, policy)` produces one balanced CloseEntry
 * per fixed asset. The monthly amount is the deterministic BigInt floor of
 * `(costBasisCents * annualRateBp / 10000) / 12` — the annual depreciation split
 * by 12, integer cents throughout, no float at any step, remainder floor. Annual
 * rates are LIR-validated policy inputs in basis points checked against the
 * legal envelope; the exact LIR maxima per asset class are enforced by the
 * policy owner, never hardcoded here. Every invalid input is rejected fail-closed
 * with a typed CloseError; no partial result is ever returned as success.
 */

import {
	assertBalanced,
	assertChartAccount,
	assertRateInBounds,
	CloseError,
	validateScope,
	type CloseEntry,
	type DepreciationPolicy,
	type FixedAsset,
	type Scope,
} from "./types.js";

/** Produce one balanced monthly depreciation entry per fixed asset. */
export function computeDepreciation(
	scope: Scope,
	assets: readonly FixedAsset[],
	policy: DepreciationPolicy,
): CloseEntry[] {
	validateScope(scope);
	assertChartAccount(policy.chart, policy.depreciationExpenseAccount);
	assertChartAccount(policy.chart, policy.accumulatedDepreciationAccount);

	return assets.map((asset, index) => {
		if (asset.costBasisCents <= 0n) {
			throw new CloseError(
				`asset "${asset.id}": costBasisCents must be positive`,
				"NEGATIVE_AMOUNT",
			);
		}
		assertRateInBounds(asset.annualRateBp, `asset "${asset.id}" annual`);

		const monthly =
			(asset.costBasisCents * BigInt(asset.annualRateBp)) / 10000n / 12n;
		if (monthly <= 0n) {
			throw new CloseError(
				`asset "${asset.id}": monthly depreciation rounds to zero`,
				"NEGATIVE_AMOUNT",
			);
		}

		const entry: CloseEntry = {
			id: `depr-${index + 1}`,
			scope,
			kind: "depreciation",
			lines: [
				{
					accountCode: policy.depreciationExpenseAccount,
					side: "debit",
					amountCents: monthly,
				},
				{
					accountCode: policy.accumulatedDepreciationAccount,
					side: "credit",
					amountCents: monthly,
				},
			],
		};
		assertBalanced(entry);
		return entry;
	});
}
