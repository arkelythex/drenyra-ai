/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — canonical types and scope-isolation boundary.
 *
 * Every annual operation is scoped to exactly one RUC (11 digits) and one fiscal
 * year (period form YYYY): a malformed scope is rejected fail-closed with
 * `INVALID_SCOPE`, an input mixing RUCs or fiscal years is rejected with
 * `CROSS_RUC_ACCESS`, and an incomplete monthly input set is rejected with
 * `INCOMPLETE_INPUT`. Nothing is ever computed from partial, cross-RUC, or
 * malformed data.
 */

import { describe, expect, it } from "vitest";
import { type CloseEntry, type CloseLine } from "../../close-calculations/types.js";
import { determineAnnualNetIncome } from "../net-income.js";
import { computeAnnualSettlement } from "../settlement.js";
import {
	AnnualDeclarationError,
	type AnnualIsrPolicy,
	type AnnualMonthInput,
	type AnnualNetIncomeInput,
	type AnnualScope,
	type AnnualSettlement,
	type AnnualStatutoryAdjustments,
	type MonthlyIsrCedula,
} from "../types.js";

/** Returns the code of the typed error thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof AnnualDeclarationError) return error.code;
		throw error;
	}
	throw new Error("expected an AnnualDeclarationError to be thrown");
}

const RUC = "20123456789";
const YEAR = "2025";

/** Twelve closed monthly periods, one per month 01..12 of `year`. */
function monthsFor(
	ruc: string,
	year: string,
	perMonth: bigint = 1_000_000n,
): AnnualMonthInput[] {
	return Array.from({ length: 12 }, (_, i) => ({
		scope: { ruc, year, period: `${year}-${String(i + 1).padStart(2, "0")}` },
		closed: true,
		netIncomeCents: perMonth,
	}));
}

function netIncomeInput(
	overrides: Partial<{
		scope: AnnualScope;
		months: AnnualMonthInput[];
		adjustments: AnnualStatutoryAdjustments;
	}> = {},
): AnnualNetIncomeInput {
	return {
		scope: { ruc: RUC, year: YEAR },
		months: monthsFor(RUC, YEAR),
		adjustments: { additionsCents: 0n, deductionsCents: 0n },
		...overrides,
	};
}

describe("canonical types", () => {
	it("models an annual scope as one RUC plus one fiscal year (YYYY)", () => {
		const scope: AnnualScope = { ruc: "20123456789", year: "2025" };
		expect(scope.ruc).toBe("20123456789");
		expect(scope.year).toBe("2025");
	});

	it("models a monthly input with a YYYY-MM period, closed flag, and BigInt cents", () => {
		const month: AnnualMonthInput = {
			scope: { ruc: RUC, year: YEAR, period: "2025-03" },
			closed: true,
			netIncomeCents: 1_000_000n,
		};
		expect(month.scope.period).toBe("2025-03");
		expect(month.closed).toBe(true);
		expect(month.netIncomeCents).toBe(1_000_000n);
	});

	it("models the statutory adjustments and the net-income input", () => {
		const adjustments: AnnualStatutoryAdjustments = {
			additionsCents: 500_000n,
			deductionsCents: 200_000n,
		};
		const input: AnnualNetIncomeInput = {
			scope: { ruc: RUC, year: YEAR },
			months: monthsFor(RUC, YEAR),
			adjustments,
		};
		expect(input.adjustments.additionsCents).toBe(500_000n);
		expect(input.adjustments.deductionsCents).toBe(200_000n);
	});

	it("models the ISR policy with the legal-entity defaults (2950 bp / 10000 bp)", () => {
		const policy: AnnualIsrPolicy = {};
		expect(policy.statutoryRateBp).toBeUndefined();
		expect(policy.maxStatutoryRateBp).toBeUndefined();
	});

	it("models a monthly ISR cédula scoped to a RUC and a YYYY-MM period", () => {
		const cedula: MonthlyIsrCedula = {
			scope: { ruc: RUC, period: "2025-01" },
			amountCents: 500_000n,
		};
		expect(cedula.scope.period).toBe("2025-01");
		expect(cedula.amountCents).toBe(500_000n);
	});

	it("models the settlement with an annual balance kind of payable|in-favor|zero", () => {
		const settlement: AnnualSettlement = {
			scope: { ruc: RUC, year: YEAR },
			annualIsrCents: 2_500_000n,
			provisionalCreditCents: 2_000_000n,
			balanceCents: 500_000n,
			balanceKind: "payable",
		};
		expect(settlement.balanceKind).toBe("payable");
		expect(["payable", "in-favor", "zero"]).toContain(settlement.balanceKind);
	});

	it("aliases the annual entry to the shared CloseEntry shape (composition)", () => {
		const line: CloseLine = {
			accountCode: "70",
			side: "debit",
			amountCents: 500_000n,
		};
		// Type-level alias: an annual entry is structurally a CloseEntry.
		const entry: CloseEntry = {
			id: "close-1",
			scope: { ruc: RUC, period: "202512" },
			kind: "closing",
			lines: [line],
		};
		expect(entry.lines[0]!.amountCents).toBe(500_000n);
	});
});

describe("annual scope isolation", () => {
	it("rejects a malformed RUC with INVALID_SCOPE", () => {
		expect(
			codeOf(() =>
				determineAnnualNetIncome(netIncomeInput({ scope: { ruc: "12345", year: YEAR } })),
			),
		).toBe("INVALID_SCOPE");
	});

	it("rejects a non-YYYY fiscal year with INVALID_SCOPE", () => {
		expect(
			codeOf(() =>
				determineAnnualNetIncome(netIncomeInput({ scope: { ruc: RUC, year: "25" } })),
			),
		).toBe("INVALID_SCOPE");
	});

	it("rejects a monthly input from another RUC with CROSS_RUC_ACCESS", () => {
		const months = monthsFor(RUC, YEAR);
		months[0] = { ...months[0]!, scope: { ruc: "10987654321", year: YEAR, period: "2025-01" } };
		expect(
			codeOf(() => determineAnnualNetIncome(netIncomeInput({ months }))),
		).toBe("CROSS_RUC_ACCESS");
	});

	it("rejects a monthly period outside the fiscal year with CROSS_RUC_ACCESS", () => {
		const months = monthsFor(RUC, YEAR);
		months[11] = { ...months[11]!, scope: { ruc: RUC, year: YEAR, period: "2026-12" } };
		expect(
			codeOf(() => determineAnnualNetIncome(netIncomeInput({ months }))),
		).toBe("CROSS_RUC_ACCESS");
	});

	it("rejects an incomplete monthly set with INCOMPLETE_INPUT", () => {
		const months = monthsFor(RUC, YEAR).slice(0, 11);
		expect(
			codeOf(() => determineAnnualNetIncome(netIncomeInput({ months }))),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects an unclosed monthly period with INCOMPLETE_INPUT", () => {
		const months = monthsFor(RUC, YEAR);
		months[0] = { ...months[0]!, closed: false };
		expect(
			codeOf(() => determineAnnualNetIncome(netIncomeInput({ months }))),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects a malformed settlement scope with INVALID_SCOPE", () => {
		const cedulas = Array.from({ length: 12 }, (_, i) => ({
			scope: { ruc: RUC, period: `${YEAR}-${String(i + 1).padStart(2, "0")}` },
			amountCents: 100_000n,
		}));
		expect(
			codeOf(() =>
				computeAnnualSettlement({ ruc: "abc", year: YEAR }, 2_500_000n, cedulas),
			),
		).toBe("INVALID_SCOPE");
	});

	it("rejects a cross-RUC settlement cédula with CROSS_RUC_ACCESS", () => {
		const cedulas = Array.from({ length: 12 }, (_, i) => ({
			scope: { ruc: RUC, period: `${YEAR}-${String(i + 1).padStart(2, "0")}` },
			amountCents: 100_000n,
		}));
		cedulas[0] = { scope: { ruc: "10987654321", period: "2025-01" }, amountCents: 100_000n };
		expect(
			codeOf(() => computeAnnualSettlement({ ruc: RUC, year: YEAR }, 2_500_000n, cedulas)),
		).toBe("CROSS_RUC_ACCESS");
	});

	it("rejects fewer than twelve settlement cédulas with INCOMPLETE_INPUT", () => {
		const cedulas = Array.from({ length: 11 }, (_, i) => ({
			scope: { ruc: RUC, period: `${YEAR}-${String(i + 1).padStart(2, "0")}` },
			amountCents: 100_000n,
		}));
		expect(
			codeOf(() => computeAnnualSettlement({ ruc: RUC, year: YEAR }, 2_500_000n, cedulas)),
		).toBe("INCOMPLETE_INPUT");
	});
});
