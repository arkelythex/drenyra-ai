/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Depreciation tests — deterministic monthly amount, BigInt-only arithmetic,
 * fail-closed validation, and the balanced-entry invariant.
 */

import { describe, expect, it } from "vitest";
import { computeDepreciation } from "../depreciation.js";
import { CloseError, type Scope } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

const CHART = new Set(["59", "681", "391"]);

const POLICY = {
	chart: CHART,
	depreciationExpenseAccount: "681",
	accumulatedDepreciationAccount: "391",
};

/** Example policy rate: 12% annual = 1200 bp (LIR-validated policy input). */
const EXAMPLE_ANNUAL_RATE_BP = 1200;

/** Returns the code of the CloseError thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof CloseError) return error.code;
		throw error;
	}
	throw new Error("expected a CloseError to be thrown");
}

describe("computeDepreciation", () => {
	it("produces one balanced entry per asset at the BigInt floor of (cost*rate/10000)/12", () => {
		const entries = computeDepreciation(
			SCOPE,
			[
				{
					id: "FA-001",
					description: "Servidor",
					costBasisCents: 120_000_000n, // S/ 1,200,000.00
					annualRateBp: EXAMPLE_ANNUAL_RATE_BP,
					acquisitionDate: "2025-01-15",
				},
			],
			POLICY,
		);
		expect(entries).toHaveLength(1);
		const entry = entries[0]!;
		expect(entry.id).toBe("depr-1");
		expect(entry.scope).toEqual(SCOPE);
		expect(entry.kind).toBe("depreciation");
		// (120_000_000 * 1200 / 10000) / 12 = 14_400_000 / 12 = 1_200_000
		expect(entry.lines[0]).toEqual({
			accountCode: "681",
			side: "debit",
			amountCents: 1_200_000n,
		});
		expect(entry.lines[1]).toEqual({
			accountCode: "391",
			side: "credit",
			amountCents: 1_200_000n,
		});
	});

	it("rounds deterministically with BigInt floor (remainder is dropped)", () => {
		// 10_000_001 * 1000 / 10000 / 12 = 1_000_000 / 12 = 83_333 (floor).
		const entries = computeDepreciation(
			SCOPE,
			[
				{
					id: "FA-002",
					description: "Laptop",
					costBasisCents: 10_000_001n,
					annualRateBp: 1000,
					acquisitionDate: "2025-02-01",
				},
			],
			POLICY,
		);
		expect(entries[0]!.lines[0]!.amountCents).toBe(83_333n);
	});

	it("rejects a zero or negative cost fail-closed", () => {
		expect(
			codeOf(() =>
				computeDepreciation(
					SCOPE,
					[
						{
							id: "FA-003",
							description: "Invalido",
							costBasisCents: 0n,
							annualRateBp: EXAMPLE_ANNUAL_RATE_BP,
							acquisitionDate: "2025-01-15",
						},
					],
					POLICY,
				),
			),
		).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects a rate outside the legal envelope fail-closed", () => {
		expect(
			codeOf(() =>
				computeDepreciation(
					SCOPE,
					[
						{
							id: "FA-004",
							description: "Tasa invalida",
							costBasisCents: 100_000n,
							annualRateBp: 0,
							acquisitionDate: "2025-01-15",
						},
					],
					POLICY,
				),
			),
		).toBe("RATE_OUT_OF_BOUNDS");
	});

	it("rejects monthly depreciation rounding to zero fail-closed", () => {
		expect(
			codeOf(() =>
				computeDepreciation(
					SCOPE,
					[
						{
							id: "FA-005",
							description: "Costo minimo",
							costBasisCents: 1n,
							annualRateBp: 1,
							acquisitionDate: "2025-01-15",
						},
					],
					POLICY,
				),
			),
		).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects a post account not in the chart fail-closed", () => {
		expect(
			codeOf(() =>
				computeDepreciation(SCOPE, [], {
					chart: new Set(["59"]),
					depreciationExpenseAccount: "681",
					accumulatedDepreciationAccount: "391",
				}),
			),
		).toBe("ACCOUNT_NOT_IN_CHART");
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() =>
				computeDepreciation({ ruc: "123", period: "202607" }, [], POLICY),
			),
		).toBe("INVALID_SCOPE");
	});
});
