/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — annual net income determination.
 *
 * `determineAnnualNetIncome` computes the annual net income for the fiscal year
 * as the BigInt-exact sum of the net incomes of the closed monthly periods plus
 * the explicit statutory additions minus the statutory deductions. An input set
 * that is incomplete — a missing month, a duplicate month, a monthly period
 * that is not closed, or a period outside the fiscal year / from another RUC —
 * is rejected fail-closed with a typed `AnnualDeclarationError` and NEVER
 * produces a partial or estimated amount. `countClosedMonthlyPeriods` is a pure
 * counting helper that counts only closed periods and computes no amount.
 */

import {
	AnnualDeclarationError,
	assertAnnualScope,
	type AnnualMonthInput,
	type AnnualNetIncomeInput,
} from "./types.js";

/** Count the closed monthly periods in an input set; pure count, no amounts. */
export function countClosedMonthlyPeriods(
	months: readonly AnnualMonthInput[],
): number {
	let closed = 0;
	for (const month of months) {
		if (month.closed) closed += 1;
	}
	return closed;
}

/** Periods 01..12 of `year`, e.g. "2025-01".."2025-12". */
function expectedPeriods(year: string): string[] {
	return Array.from(
		{ length: 12 },
		(_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
	);
}

/** Compute the annual net income for the fiscal year; fail-closed on any gap. */
export function determineAnnualNetIncome(input: AnnualNetIncomeInput): bigint {
	const { scope, months, adjustments } = input;
	assertAnnualScope(scope);

	for (const month of months) {
		if (
			month.scope.ruc !== scope.ruc ||
			month.scope.period.slice(0, 4) !== scope.year
		) {
			throw new AnnualDeclarationError(
				"CROSS_RUC_ACCESS",
				`month "${month.scope.period}" (RUC ${month.scope.ruc}) is outside the annual scope ` +
					`${scope.ruc}/${scope.year}`,
			);
		}
	}

	const present = new Set(months.map((month) => month.scope.period));
	const complete =
		months.length === 12 &&
		present.size === 12 &&
		expectedPeriods(scope.year).every((period) => present.has(period)) &&
		months.every((month) => month.closed);
	if (!complete) {
		throw new AnnualDeclarationError(
			"INCOMPLETE_INPUT",
			`incomplete monthly input for ${scope.ruc}/${scope.year}: exactly twelve closed ` +
				"months 01..12 are required",
		);
	}

	let total = 0n;
	for (const month of months) {
		total += month.netIncomeCents;
	}
	return total + adjustments.additionsCents - adjustments.deductionsCents;
}
