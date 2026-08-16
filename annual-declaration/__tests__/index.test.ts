/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Barrel smoke test — every public engine function and canonical type is
 * reachable from the module index, and the full annual vertical (net income →
 * ISR → settlement → close → declaration → report) chains end-to-end for one
 * RUC and fiscal year.
 */

import { describe, expect, it } from "vitest";
import {
	AnnualDeclarationError,
	buildAnnualDeclaration,
	buildAnnualReport,
	closeAnnualResults,
	computeAnnualIsr,
	computeAnnualSettlement,
	countClosedMonthlyPeriods,
	determineAnnualNetIncome,
	type AnnualEntry,
	type AnnualReport,
	type AnnualSettlement,
	type AnnualScope,
} from "../index.js";

const RUC = "20123456789";
const YEAR = "2025";
const SCOPE: AnnualScope = { ruc: RUC, year: YEAR };
const CHART = new Set(["59", "70", "60", "12"]);

describe("annual-declaration public surface", () => {
	it("exposes every engine function and the counting helper", () => {
		expect(typeof countClosedMonthlyPeriods).toBe("function");
		expect(typeof determineAnnualNetIncome).toBe("function");
		expect(typeof computeAnnualIsr).toBe("function");
		expect(typeof computeAnnualSettlement).toBe("function");
		expect(typeof closeAnnualResults).toBe("function");
		expect(typeof buildAnnualDeclaration).toBe("function");
		expect(typeof buildAnnualReport).toBe("function");
		expect(typeof AnnualDeclarationError).toBe("function");
	});

	it("chains the full annual vertical end-to-end for one RUC and year", () => {
		const months = Array.from({ length: 12 }, (_, i) => ({
			scope: { ruc: RUC, year: YEAR, period: `${YEAR}-${String(i + 1).padStart(2, "0")}` },
			closed: true,
			netIncomeCents: 1_000_000n,
		}));
		const annualNetIncome = determineAnnualNetIncome({
			scope: SCOPE,
			months,
			adjustments: { additionsCents: 500_000n, deductionsCents: 200_000n },
		});
		expect(annualNetIncome).toBe(12_300_000n);

		const taxableBase = annualNetIncome;
		const annualIsr = computeAnnualIsr(taxableBase, { statutoryRateBp: 2950 });
		expect(annualIsr).toBe(3_628_500n);

		const monthlyCedulas = Array.from({ length: 12 }, (_, i) => ({
			scope: { ruc: RUC, period: `${YEAR}-${String(i + 1).padStart(2, "0")}` },
			amountCents: 200_000n,
		}));
		const settlement: AnnualSettlement = computeAnnualSettlement(
			SCOPE,
			annualIsr,
			monthlyCedulas,
		);
		expect(settlement.balanceKind).toBe("payable");
		expect(settlement.balanceCents).toBe(1_228_500n);

		const entries = closeAnnualResults(
			SCOPE,
			[
				{ accountCode: "70", balanceCents: -500_000n },
				{ accountCode: "60", balanceCents: 200_000n },
			],
			CHART,
		);
		const annualEntries: readonly AnnualEntry[] = entries;

		const payload = buildAnnualDeclaration({
			scope: SCOPE,
			annualNetIncomeCents: annualNetIncome,
			netIncome: { scope: SCOPE, months, adjustments: { additionsCents: 500_000n, deductionsCents: 200_000n } },
			taxableBaseCents: taxableBase,
			rateBp: 2950,
			settlement,
		});
		expect(payload.balanceKind).toBe("payable");
		expect(payload.cédulas.isr.rateBp).toBe(2950);

		const report: AnnualReport = buildAnnualReport({
			entries: annualEntries,
			settlement,
			retainedEarningsBeforeCents: 0n,
		});
		expect(report.trialBalanceBalanced).toBe(true);
		expect(report.retainedEarningsMovement.afterCents).toBe(300_000n);
	});
});
