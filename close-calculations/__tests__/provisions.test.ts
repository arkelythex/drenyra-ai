/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Provisions tests — policy-driven entries, unclassifiable inputs blocked
 * fail-closed, BigInt-only arithmetic, and the balanced-entry invariant.
 */

import { describe, expect, it } from "vitest";
import { computeProvisions } from "../provisions.js";
import { CloseError, type Scope } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

const CHART = new Set(["59", "685", "195"]);

const POLICY = {
	chart: CHART,
	provisionExpenseAccount: "685",
	provisionLiabilityAccount: "195",
};

/** Example policy rate: 10% = 1000 bp (LIR-validated policy input). */
const EXAMPLE_PROVISION_RATE_BP = 1000;

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

describe("computeProvisions", () => {
	it("produces one balanced entry per classified input at the BigInt floor", () => {
		const entries = computeProvisions(
			SCOPE,
			[
				{
					id: "P-001",
					agingDays: 90,
					exposureCents: 1_000_000n,
					provisionRateBp: EXAMPLE_PROVISION_RATE_BP,
					kind: "receivable",
				},
				{
					id: "P-002",
					agingDays: 30,
					exposureCents: 2_000_000n,
					provisionRateBp: 500,
					kind: "inventory",
				},
			],
			POLICY,
		);
		expect(entries).toHaveLength(2);
		const first = entries[0]!;
		expect(first.id).toBe("prov-1");
		expect(first.scope).toEqual(SCOPE);
		expect(first.kind).toBe("provision");
		// 1_000_000 * 1000 / 10000 = 100_000
		expect(first.lines[0]).toEqual({
			accountCode: "685",
			side: "debit",
			amountCents: 100_000n,
		});
		expect(first.lines[1]).toEqual({
			accountCode: "195",
			side: "credit",
			amountCents: 100_000n,
		});
		// 2_000_000 * 500 / 10000 = 100_000
		expect(entries[1]!.lines[0]!.amountCents).toBe(100_000n);
	});

	it("rounds deterministically with BigInt floor", () => {
		const entries = computeProvisions(
			SCOPE,
			[
				{
					id: "P-003",
					agingDays: 60,
					exposureCents: 10_001n,
					provisionRateBp: 999,
					kind: "receivable",
				},
			],
			POLICY,
		);
		// 10_001 * 999 / 10000 = 999.0999... -> floor 999
		expect(entries[0]!.lines[0]!.amountCents).toBe(999n);
	});

	it("blocks an unclassifiable kind fail-closed with NO entry", () => {
		expect(
			codeOf(() =>
				computeProvisions(
					SCOPE,
					[
						{
							id: "P-004",
							agingDays: 10,
							exposureCents: 100n,
							provisionRateBp: EXAMPLE_PROVISION_RATE_BP,
							kind: "guessed" as never,
						},
					],
					POLICY,
				),
			),
		).toBe("UNCLASSIFIABLE_INPUT");
	});

	it("rejects negative aging days fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisions(
					SCOPE,
					[
						{
							id: "P-005",
							agingDays: -1,
							exposureCents: 100n,
							provisionRateBp: EXAMPLE_PROVISION_RATE_BP,
							kind: "receivable",
						},
					],
					POLICY,
				),
			),
		).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects zero exposure fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisions(
					SCOPE,
					[
						{
							id: "P-006",
							agingDays: 0,
							exposureCents: 0n,
							provisionRateBp: EXAMPLE_PROVISION_RATE_BP,
							kind: "receivable",
						},
					],
					POLICY,
				),
			),
		).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects a provision amount rounding to zero fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisions(
					SCOPE,
					[
						{
							id: "P-007",
							agingDays: 0,
							exposureCents: 1n,
							provisionRateBp: 1,
							kind: "receivable",
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
				computeProvisions(SCOPE, [], {
					chart: new Set(["59"]),
					provisionExpenseAccount: "685",
					provisionLiabilityAccount: "195",
				}),
			),
		).toBe("ACCOUNT_NOT_IN_CHART");
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisions({ ruc: "123", period: "202607" }, [], POLICY),
			),
		).toBe("INVALID_SCOPE");
	});
});
