/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Closing-entries tests — result accounts (PCGE 12/13/14) into retained
 * earnings (PCGE 59), debit/credit direction, balanced-entry invariant,
 * zero-balance skip, and fail-closed validation.
 */

import { describe, expect, it } from "vitest";
import { closeResultAccounts } from "../close-results.js";
import { CloseError, RETAINED_EARNINGS_ACCOUNT, type Scope } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

const CHART = new Set(["59", "12", "13", "14", "70", "60"]);

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

describe("closeResultAccounts", () => {
	it("closes a credit-balance (revenue) account with a debit into retained earnings", () => {
		const entries = closeResultAccounts(
			SCOPE,
			[{ accountCode: "70", balanceCents: -500_000n }],
			CHART,
		);
		expect(entries).toHaveLength(1);
		const entry = entries[0]!;
		expect(entry.id).toBe("close-1");
		expect(entry.kind).toBe("closing");
		expect(entry.lines).toEqual([
			{ accountCode: "70", side: "debit", amountCents: 500_000n },
			{ accountCode: "59", side: "credit", amountCents: 500_000n },
		]);
	});

	it("closes a debit-balance (expense) account with a credit into retained earnings", () => {
		const entries = closeResultAccounts(
			SCOPE,
			[{ accountCode: "60", balanceCents: 200_000n }],
			CHART,
		);
		expect(entries[0]!.lines).toEqual([
			{ accountCode: "60", side: "credit", amountCents: 200_000n },
			{ accountCode: "59", side: "debit", amountCents: 200_000n },
		]);
	});

	it("skips zero balances and emits one entry per non-zero account", () => {
		const entries = closeResultAccounts(
			SCOPE,
			[
				{ accountCode: "70", balanceCents: -500_000n },
				{ accountCode: "60", balanceCents: 0n },
				{ accountCode: "12", balanceCents: 100_000n },
			],
			CHART,
		);
		expect(entries).toHaveLength(2);
		expect(entries.map((entry) => entry.id)).toEqual(["close-1", "close-2"]);
	});

	it("rejects an account not in the chart fail-closed", () => {
		expect(
			codeOf(() =>
				closeResultAccounts(SCOPE, [{ accountCode: "999", balanceCents: 1n }], CHART),
			),
		).toBe("ACCOUNT_NOT_IN_CHART");
	});

	it("rejects retained earnings as a result source account fail-closed", () => {
		expect(
			codeOf(() =>
				closeResultAccounts(
					SCOPE,
					[{ accountCode: RETAINED_EARNINGS_ACCOUNT, balanceCents: 1n }],
					CHART,
				),
			),
		).toBe("UNCLASSIFIABLE_INPUT");
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() => closeResultAccounts({ ruc: "123", period: "202607" }, [], CHART)),
		).toBe("INVALID_SCOPE");
	});
});
