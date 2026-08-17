/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Year-end closing tests — result accounts (PCGE 12/13/14…) move into retained
 * earnings (PCGE 59) through the composed `closeResultAccounts` primitive. The
 * annual module converts the annual scope to the December fiscal period
 * (`YYYY12`), delegates, and inherits the balanced-entry invariant
 * (`UNBALANCED_ENTRY`), the chart validation (`ACCOUNT_NOT_IN_CHART`), and the
 * zero-balance skip. Composition only — no reimplementation of the invariants.
 */

import { describe, expect, it } from "vitest";
import { assertBalanced } from "../../close-calculations/types.js";
import {
	CloseError,
	type CloseEntry,
	type ResultBalance,
} from "../../close-calculations/types.js";
import { closeAnnualResults } from "../close-results.js";
import { AnnualDeclarationError, type AnnualScope } from "../types.js";

const RUC = "20123456789";
const YEAR = "2025";
const SCOPE: AnnualScope = { ruc: RUC, year: YEAR };

const CHART = new Set(["59", "70", "60", "12"]);

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

describe("closeAnnualResults", () => {
	it("closes result accounts into retained earnings balanced, in December", () => {
		const balances: readonly ResultBalance[] = [
			{ accountCode: "70", balanceCents: -500_000n }, // credit balance (revenue)
			{ accountCode: "60", balanceCents: 200_000n }, // debit balance (expense)
		];
		const entries = closeAnnualResults(SCOPE, balances, CHART);
		expect(entries).toHaveLength(2);
		expect(entries.map((entry) => entry.id)).toEqual(["close-1", "close-2"]);
		// Year-end closing posts in December of the fiscal year.
		expect(entries[0]!.scope).toEqual({ ruc: RUC, period: "202512" });
		expect(entries[1]!.scope).toEqual({ ruc: RUC, period: "202512" });
		// Credit-balance account closes with a debit; retained earnings offsets.
		expect(entries[0]!.lines).toEqual([
			{ accountCode: "70", side: "debit", amountCents: 500_000n },
			{ accountCode: "59", side: "credit", amountCents: 500_000n },
		]);
		// Debit-balance account closes with a credit; retained earnings offsets.
		expect(entries[1]!.lines).toEqual([
			{ accountCode: "60", side: "credit", amountCents: 200_000n },
			{ accountCode: "59", side: "debit", amountCents: 200_000n },
		]);
		// Every amount is positive BigInt cents and every entry is balanced.
		for (const entry of entries) {
			for (const line of entry.lines) {
				expect(line.amountCents).toBeGreaterThan(0n);
			}
			expect(() => assertBalanced(entry)).not.toThrow();
		}
	});

	it("skips zero-balance result accounts", () => {
		const entries = closeAnnualResults(
			SCOPE,
			[
				{ accountCode: "70", balanceCents: -500_000n },
				{ accountCode: "60", balanceCents: 0n },
			],
			CHART,
		);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.id).toBe("close-1");
	});

	it("rejects an account absent from the chart with ACCOUNT_NOT_IN_CHART", () => {
		expect(
			codeOf(() =>
				closeAnnualResults(SCOPE, [{ accountCode: "999", balanceCents: 1n }], CHART),
			),
		).toBe("ACCOUNT_NOT_IN_CHART");
	});

	it("rejects a malformed annual scope with INVALID_SCOPE", () => {
		expect(
			codeOf(() =>
				closeAnnualResults({ ruc: "123", year: YEAR }, [], CHART),
			),
		).toBe("INVALID_SCOPE");
		expect(
			codeOf(() =>
				closeAnnualResults({ ruc: RUC, year: "20" }, [], CHART),
			),
		).toBe("INVALID_SCOPE");
	});

	it("inherits the unbalanced-entry invariant (never auto-corrected)", () => {
		// The composed primitive constructs balanced entries; the shared invariant
		// that rejects an unbalanced draft is the one `closeAnnualResults` inherits.
		const unbalanced: CloseEntry = {
			id: "draft-1",
			scope: { ruc: RUC, period: "202512" },
			kind: "closing",
			lines: [
				{ accountCode: "70", side: "debit", amountCents: 500_000n },
				{ accountCode: "59", side: "credit", amountCents: 400_000n },
			],
		};
		expect(codeOf(() => assertBalanced(unbalanced))).toBe("UNBALANCED_ENTRY");
	});

	it("rejects retained earnings as a result source account", () => {
		expect(
			codeOf(() => closeAnnualResults(SCOPE, [{ accountCode: "59", balanceCents: 1n }], CHART)),
		).toBe("UNCLASSIFIABLE_INPUT");
	});
});
