/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — annual ISR liability.
 *
 * `computeAnnualIsr` computes the annual ISR liability for legal entities as the
 * BigInt floor of `taxableBaseCents * statutoryRateBp / 10000`, where the rate
 * comes from the policy input and defaults to 2950 bp (29.5%, LIR legal-entity
 * rate) with a default legal envelope of 10000 bp (100%). A rate outside the
 * envelope is rejected with `RATE_OUT_OF_BOUNDS`; a negative taxable base is
 * rejected with `NEGATIVE_AMOUNT`. All arithmetic is integer-cent BigInt with
 * deterministic floor; no float ever appears.
 */

import { AnnualDeclarationError, type AnnualIsrPolicy } from "./types.js";

/** Default annual ISR statutory rate for legal entities (LIR): 2950 bp. */
export const DEFAULT_STATUTORY_RATE_BP = 2950;

/** Default legal envelope ceiling: 100% = 10000 bp. */
export const DEFAULT_MAX_STATUTORY_RATE_BP = 10000;

/** Compute the annual ISR liability; fail-closed on rate or base violations. */
export function computeAnnualIsr(
	taxableBaseCents: bigint,
	policy?: AnnualIsrPolicy,
): bigint {
	const statutoryRateBp = policy?.statutoryRateBp ?? DEFAULT_STATUTORY_RATE_BP;
	const maxRateBp = policy?.maxStatutoryRateBp ?? DEFAULT_MAX_STATUTORY_RATE_BP;
	if (!Number.isInteger(statutoryRateBp) || statutoryRateBp <= 0 || statutoryRateBp > maxRateBp) {
		throw new AnnualDeclarationError(
			"RATE_OUT_OF_BOUNDS",
			`statutory rate ${statutoryRateBp} bp is outside the legal envelope (0, ${maxRateBp}]`,
		);
	}
	if (taxableBaseCents < 0n) {
		throw new AnnualDeclarationError(
			"NEGATIVE_AMOUNT",
			`taxable base ${taxableBaseCents} cents must be non-negative`,
		);
	}
	// BigInt floor: fractional cent discarded deterministically.
	return (taxableBaseCents * BigInt(statutoryRateBp)) / 10000n;
}
