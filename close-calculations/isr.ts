/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — provisional ISR (pago a cuenta), LIR Art. 85.
 *
 * The pago a cuenta for the month is the greater of:
 *   - coefficient path: `priorYearRatioBp * netIncomeCents / 10000`, where the
 *     coefficient is the prior-year impuesto/ingresos ratio in basis points;
 *   - statutory minimum path: `statutoryMinimumBp * monthlyNetIncomeCents /
 *     10000`, where the statutory minimum is 1.5% of the month's net income —
 *     150 basis points (LIR Art. 85: "el uno y medio por ciento (1,5%)").
 *
 * All arithmetic is integer-cent BigInt with deterministic floor; no float ever
 * appears. The statutory minimum is a validated policy input, never a hardcoded
 * guess. `rule` selects the path; `greater-of` applies the greater (and falls
 * back to the statutory minimum when no prior-year ratio exists). Any input that
 * cannot be processed is rejected fail-closed with a typed CloseError.
 */

import {
	assertBalanced,
	assertChartAccount,
	assertRateInBounds,
	CloseError,
	validateScope,
	type CloseEntry,
	type IsrCedula,
	type IsrPolicy,
	type ProvisionalIsrInput,
	type Scope,
} from "./types.js";

/** Result of a provisional ISR computation: the entry plus the cédula figures. */
export interface ProvisionalIsrResult {
	entry: CloseEntry;
	cedula: IsrCedula;
}

/** Compute the provisional ISR (pago a cuenta) entry for one RUC + fiscal period. */
export function computeProvisionalIsr(
	scope: Scope,
	input: ProvisionalIsrInput,
	policy: IsrPolicy,
): ProvisionalIsrResult {
	validateScope(scope);
	if (input.netIncomeCents < 0n) {
		throw new CloseError(
			`ISR input "${input.id}": netIncomeCents must be non-negative`,
			"NEGATIVE_AMOUNT",
		);
	}
	if (input.monthlyNetIncomeCents < 0n) {
		throw new CloseError(
			`ISR input "${input.id}": monthlyNetIncomeCents must be non-negative`,
			"NEGATIVE_AMOUNT",
		);
	}
	assertRateInBounds(policy.statutoryMinimumBp, "ISR statutory minimum");
	if (input.priorYearRatioBp !== null) {
		assertRateInBounds(
			input.priorYearRatioBp,
			`ISR input "${input.id}" coefficient`,
		);
	}
	assertChartAccount(policy.chart, policy.isrExpenseAccount);
	assertChartAccount(policy.chart, policy.isrPayableAccount);

	const coefficientPath =
		input.priorYearRatioBp === null
			? 0n
			: (BigInt(input.priorYearRatioBp) * input.netIncomeCents) / 10000n;
	const pctPath =
		(BigInt(policy.statutoryMinimumBp) * input.monthlyNetIncomeCents) / 10000n;

	let applied: bigint;
	if (input.rule === "coeficiente") {
		if (input.priorYearRatioBp === null) {
			throw new CloseError(
				`ISR input "${input.id}": coefficient rule requires a prior-year ratio`,
				"RATE_OUT_OF_BOUNDS",
			);
		}
		applied = coefficientPath;
	} else if (input.rule === "pct-ingresos") {
		applied = pctPath;
	} else if (input.rule === "greater-of") {
		applied = coefficientPath > pctPath ? coefficientPath : pctPath;
	} else {
		throw new CloseError(
			`ISR input "${input.id}": rule "${String(input.rule)}" is not supported`,
			"UNCLASSIFIABLE_INPUT",
		);
	}
	if (applied <= 0n) {
		throw new CloseError(
			`ISR input "${input.id}": computed pago a cuenta is zero`,
			"NEGATIVE_AMOUNT",
		);
	}

	const entry: CloseEntry = {
		id: "isr-1",
		scope,
		kind: "isr",
		lines: [
			{
				accountCode: policy.isrExpenseAccount,
				side: "debit",
				amountCents: applied,
			},
			{
				accountCode: policy.isrPayableAccount,
				side: "credit",
				amountCents: applied,
			},
		],
	};
	assertBalanced(entry);
	return {
		entry,
		cedula: {
			coefficientPathCents: coefficientPath,
			pctPathCents: pctPath,
			appliedCents: applied,
		},
	};
}
