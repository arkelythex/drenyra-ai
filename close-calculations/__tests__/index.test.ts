/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Barrel smoke test — every public engine function is reachable from the
 * module index and produces the expected canonical shape.
 */

import { describe, expect, it } from "vitest";
import {
	assertBalanced,
	buildCloseReport,
	closeResultAccounts,
	computeDepreciation,
	computeProvisions,
	computeProvisionalIsr,
	type CloseEntry,
	type Scope,
} from "../index.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

const CHART = new Set(["59", "681", "391", "685", "195", "881", "4017", "70"]);

describe("close-calculations public surface", () => {
	it("exposes every engine function and the shared invariant", () => {
		expect(typeof computeDepreciation).toBe("function");
		expect(typeof computeProvisions).toBe("function");
		expect(typeof computeProvisionalIsr).toBe("function");
		expect(typeof closeResultAccounts).toBe("function");
		expect(typeof buildCloseReport).toBe("function");
		expect(typeof assertBalanced).toBe("function");
	});

	it("chains the full close vertical end-to-end", () => {
		const depreciation = computeDepreciation(
			SCOPE,
			[
				{
					id: "FA-001",
					description: "Servidor",
					costBasisCents: 120_000_000n,
					annualRateBp: 1200,
					acquisitionDate: "2025-01-15",
				},
			],
			{ chart: CHART, depreciationExpenseAccount: "681", accumulatedDepreciationAccount: "391" },
		);
		const provisions = computeProvisions(
			SCOPE,
			[
				{
					id: "P-001",
					agingDays: 90,
					exposureCents: 1_000_000n,
					provisionRateBp: 1000,
					kind: "receivable",
				},
			],
			{ chart: CHART, provisionExpenseAccount: "685", provisionLiabilityAccount: "195" },
		);
		const isr = computeProvisionalIsr(
			SCOPE,
			{
				id: "ISR-001",
				netIncomeCents: 10_000_000n,
				priorYearRatioBp: 200,
				monthlyNetIncomeCents: 10_000_000n,
				rule: "greater-of",
			},
			{ chart: CHART, isrExpenseAccount: "881", isrPayableAccount: "4017", statutoryMinimumBp: 150 },
		);
		const closing = closeResultAccounts(
			SCOPE,
			[{ accountCode: "70", balanceCents: -500_000n }],
			CHART,
		);
		const entries: readonly CloseEntry[] = [
			...depreciation,
			...provisions,
			isr.entry,
			...closing,
		];
		const report = buildCloseReport({
			scope: SCOPE,
			entries,
			isrCedula: isr.cedula,
			openingRetainedEarningsCents: 0n,
			chart: CHART,
		});
		expect(report.trialBalanceBalanced).toBe(true);
		expect(report.entries.length).toBe(4);
		expect(report.isrCedula.appliedCents).toBe(200_000n);
	});
});
