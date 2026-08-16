/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual net income determination tests — BigInt-exact sum of the closed monthly
 * net incomes plus the explicit statutory additions minus the deductions, with
 * the closed-month counting helper. Fail-closed on malformed scope, cross-RUC
 * input, and incomplete monthly sets; never a partial or estimated amount.
 */

import { describe, expect, it } from "vitest";
import { countClosedMonthlyPeriods, determineAnnualNetIncome } from "../net-income.js";
import { AnnualDeclarationError, type AnnualMonthInput } from "../types.js";

const RUC = "20123456789";
const YEAR = "2025";

/** Returns the code of the AnnualDeclarationError thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof AnnualDeclarationError) return error.code;
		throw error;
	}
	throw new Error("expected an AnnualDeclarationError to be thrown");
}

function month(
	index: number,
	overrides: Partial<AnnualMonthInput> = {},
): AnnualMonthInput {
	const n = String(index).padStart(2, "0");
	return {
		scope: { ruc: RUC, year: YEAR, period: `${YEAR}-${n}` },
		closed: true,
		netIncomeCents: 1_000_000n,
		...overrides,
	};
}

describe("countClosedMonthlyPeriods", () => {
	it("counts only closed monthly periods and ignores unclosed ones", () => {
		const months: AnnualMonthInput[] = [
			...Array.from({ length: 12 }, (_, i) => month(i + 1)),
			{ ...month(6), closed: false },
		];
		expect(countClosedMonthlyPeriods(months)).toBe(12);
	});

	it("returns zero when no period is closed", () => {
		const months = Array.from({ length: 12 }, (_, i) => ({ ...month(i + 1), closed: false }));
		expect(countClosedMonthlyPeriods(months)).toBe(0);
	});

	it("is a pure count and computes no amount", () => {
		const months = Array.from({ length: 3 }, (_, i) => month(i + 1, { netIncomeCents: 9_999n }));
		expect(countClosedMonthlyPeriods(months)).toBe(3);
	});
});

describe("determineAnnualNetIncome", () => {
	it("sums the twelve closed months plus additions minus deductions, no rounding", () => {
		const months = Array.from({ length: 12 }, (_, i) =>
			month(i + 1, { netIncomeCents: 1_000_000n }),
		);
		const netIncome = determineAnnualNetIncome({
			scope: { ruc: RUC, year: YEAR },
			months,
			adjustments: { additionsCents: 500_000n, deductionsCents: 200_000n },
		});
		expect(netIncome).toBe(12_300_000n);
	});

	it("accepts months in any order when the twelve periods are present", () => {
		const months = Array.from({ length: 12 }, (_, i) =>
			month(i + 1, { netIncomeCents: 1_000_000n }),
		);
		months.reverse();
		const netIncome = determineAnnualNetIncome({
			scope: { ruc: RUC, year: YEAR },
			months,
			adjustments: { additionsCents: 500_000n, deductionsCents: 200_000n },
		});
		expect(netIncome).toBe(12_300_000n);
	});

	it("rejects eleven closed months with INCOMPLETE_INPUT", () => {
		const months = Array.from({ length: 11 }, (_, i) => month(i + 1));
		expect(
			codeOf(() =>
				determineAnnualNetIncome({
					scope: { ruc: RUC, year: YEAR },
					months,
					adjustments: { additionsCents: 0n, deductionsCents: 0n },
				}),
			),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects an unclosed month with INCOMPLETE_INPUT", () => {
		const months = Array.from({ length: 12 }, (_, i) =>
			i === 2 ? month(i + 1, { closed: false }) : month(i + 1),
		);
		expect(
			codeOf(() =>
				determineAnnualNetIncome({
					scope: { ruc: RUC, year: YEAR },
					months,
					adjustments: { additionsCents: 0n, deductionsCents: 0n },
				}),
			),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects a duplicate-month set with INCOMPLETE_INPUT", () => {
		const months = Array.from({ length: 12 }, (_, i) =>
			i === 11 ? month(1) : month(i + 1),
		);
		expect(
			codeOf(() =>
				determineAnnualNetIncome({
					scope: { ruc: RUC, year: YEAR },
					months,
					adjustments: { additionsCents: 0n, deductionsCents: 0n },
				}),
			),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects a month outside the year with CROSS_RUC_ACCESS", () => {
		const months = Array.from({ length: 12 }, (_, i) => month(i + 1));
		months[11] = { ...months[11]!, scope: { ruc: RUC, year: YEAR, period: "2026-12" } };
		expect(
			codeOf(() =>
				determineAnnualNetIncome({
					scope: { ruc: RUC, year: YEAR },
					months,
					adjustments: { additionsCents: 0n, deductionsCents: 0n },
				}),
			),
		).toBe("CROSS_RUC_ACCESS");
	});
});
