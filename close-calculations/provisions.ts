/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — provisions for past-due receivables and inventory.
 *
 * `computeProvisions(scope, inputs, policy)` produces one balanced CloseEntry
 * per classified input at the deterministic BigInt floor of
 * `exposureCents * provisionRateBp / 10000`. Provision rates are LIR-validated
 * policy inputs in basis points checked against the legal envelope; the exact
 * LIR percentages per aging bucket belong to the policy owner. An input that
 * cannot be classified by the policy is a fail-closed blocker: NO entry is
 * produced, never a guess, and no partial result is ever returned as success.
 */

import {
	assertBalanced,
	assertChartAccount,
	assertRateInBounds,
	CloseError,
	validateScope,
	type CloseEntry,
	type ProvisionInput,
	type ProvisionPolicy,
	type Scope,
} from "./types.js";

/** Produce one balanced provision entry per classified receivable/inventory input. */
export function computeProvisions(
	scope: Scope,
	inputs: readonly ProvisionInput[],
	policy: ProvisionPolicy,
): CloseEntry[] {
	validateScope(scope);
	assertChartAccount(policy.chart, policy.provisionExpenseAccount);
	assertChartAccount(policy.chart, policy.provisionLiabilityAccount);

	return inputs.map((input, index) => {
		if (input.kind !== "receivable" && input.kind !== "inventory") {
			throw new CloseError(
				`input "${input.id}": kind "${String(input.kind)}" has no rule in the configured policy`,
				"UNCLASSIFIABLE_INPUT",
			);
		}
		if (input.agingDays < 0) {
			throw new CloseError(
				`input "${input.id}": agingDays must be >= 0`,
				"NEGATIVE_AMOUNT",
			);
		}
		if (input.exposureCents <= 0n) {
			throw new CloseError(
				`input "${input.id}": exposureCents must be positive`,
				"NEGATIVE_AMOUNT",
			);
		}
		assertRateInBounds(input.provisionRateBp, `input "${input.id}" provision`);

		const amount =
			(input.exposureCents * BigInt(input.provisionRateBp)) / 10000n;
		if (amount <= 0n) {
			throw new CloseError(
				`input "${input.id}": provision amount rounds to zero`,
				"NEGATIVE_AMOUNT",
			);
		}

		const entry: CloseEntry = {
			id: `prov-${index + 1}`,
			scope,
			kind: "provision",
			lines: [
				{
					accountCode: policy.provisionExpenseAccount,
					side: "debit",
					amountCents: amount,
				},
				{
					accountCode: policy.provisionLiabilityAccount,
					side: "credit",
					amountCents: amount,
				},
			],
		};
		assertBalanced(entry);
		return entry;
	});
}
