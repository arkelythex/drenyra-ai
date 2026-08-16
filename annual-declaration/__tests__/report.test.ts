/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual settlement report tests — the post-settlement report states the
 * produced journal entries, `trialBalanceBalanced === true`, the settlement
 * cédula, and the retained-earnings (PCGE 59) movement before vs after the
 * close. A state that violates the trial-balance identity is rejected with
 * `UNBALANCED_ENTRY` and the report is NEVER emitted for an unbalanced state.
 */

import { describe, expect, it } from "vitest";
import { CloseError, type CloseEntry } from "../../close-calculations/types.js";
import { buildAnnualReport } from "../report.js";
import { closeAnnualResults } from "../close-results.js";
import {
	AnnualDeclarationError,
	type AnnualScope,
	type AnnualSettlement,
} from "../types.js";

const RUC = "20123456789";
const YEAR = "2025";
const SCOPE: AnnualScope = { ruc: RUC, year: YEAR };
const CHART = new Set(["59", "70", "60"]);

const SETTLEMENT: AnnualSettlement = {
	scope: SCOPE,
	annualIsrCents: 2_950_000n,
	provisionalCreditCents: 2_000_000n,
	balanceCents: 950_000n,
	balanceKind: "payable",
};

/** Returns the code of the typed error (annual or inherited close) thrown by `fn`. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof AnnualDeclarationError || error instanceof CloseError) {
			return error.code;
		}
		throw error;
	}
	throw new Error("expected a typed annual-declaration error to be thrown");
}

describe("buildAnnualReport", () => {
	it("reports balanced entries with the settlement cédula and the PCGE 59 movement", () => {
		const entries = closeAnnualResults(
			SCOPE,
			[
				{ accountCode: "70", balanceCents: -500_000n },
				{ accountCode: "60", balanceCents: 200_000n },
			],
			CHART,
		);
		const report = buildAnnualReport({
			entries,
			settlement: SETTLEMENT,
			retainedEarningsBeforeCents: 0n,
		});
		expect(report.entries).toEqual(entries);
		expect(report.trialBalanceBalanced).toBe(true);
		expect(report.settlement).toEqual(SETTLEMENT);
		// close-1 credits 59 (+500_000n), close-2 debits 59 (-200_000n) -> net +300_000n.
		expect(report.retainedEarningsMovement.beforeCents).toBe(0n);
		expect(report.retainedEarningsMovement.afterCents).toBe(300_000n);
	});

	it("derives the after-balance from a non-zero opening balance", () => {
		const entries = closeAnnualResults(
			SCOPE,
			[{ accountCode: "70", balanceCents: -500_000n }],
			CHART,
		);
		const report = buildAnnualReport({
			entries,
			settlement: SETTLEMENT,
			retainedEarningsBeforeCents: 1_000_000n,
		});
		expect(report.retainedEarningsMovement.beforeCents).toBe(1_000_000n);
		expect(report.retainedEarningsMovement.afterCents).toBe(1_500_000n);
	});

	it("computes the net PCGE 59 movement across debit and credit lines", () => {
		const entries: readonly CloseEntry[] = [
			{
				id: "close-1",
				scope: { ruc: RUC, period: "202512" },
				kind: "closing",
				lines: [
					{ accountCode: "70", side: "debit", amountCents: 500_000n },
					{ accountCode: "59", side: "credit", amountCents: 500_000n },
				],
			},
			{
				id: "close-2",
				scope: { ruc: RUC, period: "202512" },
				kind: "closing",
				lines: [
					{ accountCode: "60", side: "credit", amountCents: 200_000n },
					{ accountCode: "59", side: "debit", amountCents: 200_000n },
				],
			},
		];
		const report = buildAnnualReport({
			entries,
			settlement: SETTLEMENT,
			retainedEarningsBeforeCents: 0n,
		});
		expect(report.trialBalanceBalanced).toBe(true);
		expect(report.retainedEarningsMovement.afterCents).toBe(300_000n);
	});

	it("rejects an unbalanced state with UNBALANCED_ENTRY and never emits a report", () => {
		const unbalanced: CloseEntry = {
			id: "draft-1",
			scope: { ruc: RUC, period: "202512" },
			kind: "closing",
			lines: [
				{ accountCode: "70", side: "debit", amountCents: 500_000n },
				{ accountCode: "59", side: "credit", amountCents: 400_000n },
			],
		};
		expect(
			codeOf(() =>
				buildAnnualReport({
					entries: [unbalanced],
					settlement: SETTLEMENT,
					retainedEarningsBeforeCents: 0n,
				}),
			),
		).toBe("UNBALANCED_ENTRY");
	});

	it("rejects a state that aggregates unbalanced across entries", () => {
		const entries: readonly CloseEntry[] = [
			{
				id: "close-1",
				scope: { ruc: RUC, period: "202512" },
				kind: "closing",
				lines: [
					{ accountCode: "70", side: "debit", amountCents: 100_000n },
					{ accountCode: "59", side: "credit", amountCents: 100_000n },
				],
			},
			{
				id: "close-2",
				scope: { ruc: RUC, period: "202512" },
				kind: "closing",
				lines: [
					{ accountCode: "60", side: "credit", amountCents: 100_000n },
					{ accountCode: "59", side: "debit", amountCents: 50_000n },
				],
			},
		];
		expect(
			codeOf(() =>
				buildAnnualReport({
					entries,
					settlement: SETTLEMENT,
					retainedEarningsBeforeCents: 0n,
				}),
			),
		).toBe("UNBALANCED_ENTRY");
	});
});
