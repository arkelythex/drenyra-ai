/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Post-close report tests — trial-balance identity, ISR cédula, retained
 * earnings movement, and fail-closed rejection of unbalanced state.
 */

import { describe, expect, it } from "vitest";
import { buildCloseReport } from "../report.js";
import { CloseError, type CloseEntry, type Scope } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

const CHART = new Set(["59", "681", "391", "881", "4017", "70", "60"]);

const CEDULA = {
	coefficientPathCents: 200_000n,
	pctPathCents: 150_000n,
	appliedCents: 200_000n,
};

function entry(id: string, lines: CloseEntry["lines"]): CloseEntry {
	return { id, scope: SCOPE, kind: "closing", lines };
}

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

describe("buildCloseReport", () => {
	it("emits a trial-balance-balanced report with cédula and movement", () => {
		const report = buildCloseReport({
			scope: SCOPE,
			entries: [
				entry("depr-1", [
					{ accountCode: "681", side: "debit", amountCents: 100_000n },
					{ accountCode: "391", side: "credit", amountCents: 100_000n },
				]),
				entry("isr-1", [
					{ accountCode: "881", side: "debit", amountCents: 200_000n },
					{ accountCode: "4017", side: "credit", amountCents: 200_000n },
				]),
				entry("close-1", [
					{ accountCode: "70", side: "debit", amountCents: 500_000n },
					{ accountCode: "59", side: "credit", amountCents: 500_000n },
				]),
			],
			isrCedula: CEDULA,
			openingRetainedEarningsCents: 1_000_000n,
			chart: CHART,
		});
		expect(report.trialBalanceBalanced).toBe(true);
		expect(report.isrCedula).toEqual(CEDULA);
		expect(report.balanceMovement).toEqual({
			beforeCents: 1_000_000n,
			afterCents: 1_500_000n,
		});
	});

	it("tracks negative retained movement for debit-side closings", () => {
		const report = buildCloseReport({
			scope: SCOPE,
			entries: [
				entry("close-1", [
					{ accountCode: "60", side: "credit", amountCents: 300_000n },
					{ accountCode: "59", side: "debit", amountCents: 300_000n },
				]),
			],
			isrCedula: CEDULA,
			openingRetainedEarningsCents: 1_000_000n,
			chart: CHART,
		});
		expect(report.balanceMovement.afterCents).toBe(700_000n);
	});

	it("rejects an unbalanced close state fail-closed (never claims reconciliation)", () => {
		expect(
			codeOf(() =>
				buildCloseReport({
					scope: SCOPE,
					entries: [
						entry("broken", [
							{ accountCode: "681", side: "debit", amountCents: 100_000n },
							{ accountCode: "391", side: "credit", amountCents: 90_000n },
						]),
					],
					isrCedula: CEDULA,
					openingRetainedEarningsCents: 0n,
					chart: CHART,
				}),
			),
		).toBe("UNBALANCED_ENTRY");
	});

	it("rejects an account not in the chart fail-closed", () => {
		expect(
			codeOf(() =>
				buildCloseReport({
					scope: SCOPE,
					entries: [
						entry("close-1", [
							{ accountCode: "999", side: "debit", amountCents: 1n },
							{ accountCode: "59", side: "credit", amountCents: 1n },
						]),
					],
					isrCedula: CEDULA,
					openingRetainedEarningsCents: 0n,
					chart: CHART,
				}),
			),
		).toBe("ACCOUNT_NOT_IN_CHART");
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() =>
				buildCloseReport({
					scope: { ruc: "123", period: "202607" },
					entries: [],
					isrCedula: CEDULA,
					openingRetainedEarningsCents: 0n,
					chart: CHART,
				}),
			),
		).toBe("INVALID_SCOPE");
	});
});
