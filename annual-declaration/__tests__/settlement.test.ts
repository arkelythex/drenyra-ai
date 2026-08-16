/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual settlement tests — reconcile the annual ISR liability against the
 * cumulative provisional payments (the twelve monthly ISR cédulas). The credit
 * is the BigInt-exact sum of the cédula amounts; the balance is
 * `annualIsr - credit`, typed as `payable` (>0), `in-favor` (<0), or `zero`
 * (=0). Cross-RUC/out-of-year cédulas are rejected with `CROSS_RUC_ACCESS`;
 * fewer than twelve, duplicated, or missing months are rejected with
 * `INCOMPLETE_INPUT` — no partial credit is ever produced.
 */

import { describe, expect, it } from "vitest";
import { computeAnnualSettlement } from "../settlement.js";
import { AnnualDeclarationError, type AnnualScope, type MonthlyIsrCedula } from "../types.js";

const RUC = "20123456789";
const YEAR = "2025";
const SCOPE: AnnualScope = { ruc: RUC, year: YEAR };

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

/** Twelve monthly cédulas, one per month 01..12 of the year. */
function cedulas(
	amounts: readonly bigint[],
	overrides: { ruc?: string; year?: string } = {},
): MonthlyIsrCedula[] {
	const { ruc = RUC, year = YEAR } = overrides;
	return Array.from({ length: 12 }, (_, i) => ({
		scope: { ruc, period: `${year}-${String(i + 1).padStart(2, "0")}` },
		amountCents: amounts[i] ?? 0n,
	}));
}

describe("computeAnnualSettlement", () => {
	it("reports a payable balance when the annual ISR exceeds the credit", () => {
		const settlement = computeAnnualSettlement(SCOPE, 2_500_000n, cedulas([2_000_000n]));
		expect(settlement).toEqual({
			scope: SCOPE,
			annualIsrCents: 2_500_000n,
			provisionalCreditCents: 2_000_000n,
			balanceCents: 500_000n,
			balanceKind: "payable",
		});
	});

	it("reports a balance in favor when the credit exceeds the annual ISR", () => {
		const settlement = computeAnnualSettlement(SCOPE, 2_500_000n, cedulas([2_700_000n]));
		expect(settlement.balanceKind).toBe("in-favor");
		expect(settlement.balanceCents).toBe(-200_000n);
		expect(settlement.provisionalCreditCents).toBe(2_700_000n);
		expect(settlement.annualIsrCents).toBe(2_500_000n);
	});

	it("reports a zero balance when the credit equals the annual ISR", () => {
		const settlement = computeAnnualSettlement(SCOPE, 2_500_000n, cedulas([2_500_000n]));
		expect(settlement.balanceKind).toBe("zero");
		expect(settlement.balanceCents).toBe(0n);
		expect(settlement.provisionalCreditCents).toBe(2_500_000n);
	});

	it("rejects a cross-RUC cédula with CROSS_RUC_ACCESS", () => {
		const crossRuc = cedulas([2_000_000n], { ruc: "10987654321" });
		expect(
			codeOf(() => computeAnnualSettlement(SCOPE, 2_500_000n, crossRuc)),
		).toBe("CROSS_RUC_ACCESS");
	});

	it("rejects a cédula outside the fiscal year with CROSS_RUC_ACCESS", () => {
		const outOfYear = cedulas([2_000_000n], { year: "2026" });
		expect(
			codeOf(() => computeAnnualSettlement(SCOPE, 2_500_000n, outOfYear)),
		).toBe("CROSS_RUC_ACCESS");
	});

	it("rejects fewer than twelve cédulas with INCOMPLETE_INPUT", () => {
		const partial = cedulas([2_000_000n]).slice(0, 11);
		expect(
			codeOf(() => computeAnnualSettlement(SCOPE, 2_500_000n, partial)),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects a duplicated-month cédula set with INCOMPLETE_INPUT", () => {
		const duplicated = cedulas([2_000_000n]);
		duplicated[11] = { ...duplicated[11]!, scope: { ruc: RUC, period: "2025-01" } };
		expect(
			codeOf(() => computeAnnualSettlement(SCOPE, 2_500_000n, duplicated)),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects a missing-month cédula set with INCOMPLETE_INPUT", () => {
		const missing = cedulas([2_000_000n]);
		missing[5] = { ...missing[5]!, scope: { ruc: RUC, period: "2025-13" } };
		expect(
			codeOf(() => computeAnnualSettlement(SCOPE, 2_500_000n, missing)),
		).toBe("INCOMPLETE_INPUT");
	});

	it("rejects a malformed scope with INVALID_SCOPE", () => {
		const twelve = cedulas([2_000_000n]);
		expect(
			codeOf(() => computeAnnualSettlement({ ruc: "abc", year: YEAR }, 2_500_000n, twelve)),
		).toBe("INVALID_SCOPE");
	});
});
