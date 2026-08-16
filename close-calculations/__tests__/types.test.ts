/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Canonical type + shared-invariant tests for the close engine.
 *
 * Covers the sealed constants and unions, scope validation (RUC 11 digits +
 * YYYYMM period), chart-account validation, rate-envelope validation, and the
 * balanced-entry invariant that every producer relies on.
 */

import { describe, expect, it } from "vitest";
import {
	assertBalanced,
	assertChartAccount,
	assertRateInBounds,
	CLOSE_KIND,
	CLOSE_SIDE,
	CloseError,
	MAX_RATE_BP,
	PROVISION_KIND,
	RETAINED_EARNINGS_ACCOUNT,
	validateScope,
	type CloseEntry,
	type Scope,
} from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

/** Returns the typed code of the CloseError thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof CloseError) return error.code;
		throw error;
	}
	throw new Error("expected a CloseError to be thrown");
}

// Compile-time contract checks (enforced by `bun run typecheck`):
// A FixedAsset cost is bigint cents — a Number amount is a type error.
const _numberCostRejected: import("../types.js").FixedAsset = {
	id: "FA-001",
	description: "Servidor",
	// @ts-expect-error — monetary amounts are bigint cents, never Numbers
	costBasisCents: 12000000,
	annualRateBp: 1200,
	acquisitionDate: "2025-01-15",
};
void _numberCostRejected;

describe("close constants", () => {
	it("exposes the sealed side, kind, provision, and ISR-rule constants", () => {
		expect(CLOSE_SIDE).toEqual({ DEBIT: "debit", CREDIT: "credit" });
		expect(CLOSE_KIND).toEqual({
			DEPRECIATION: "depreciation",
			PROVISION: "provision",
			ISR: "isr",
			CLOSING: "closing",
		});
		expect(PROVISION_KIND).toEqual({
			RECEIVABLE: "receivable",
			INVENTORY: "inventory",
		});
		expect(MAX_RATE_BP).toBe(10000);
		expect(RETAINED_EARNINGS_ACCOUNT).toBe("59");
	});
});

describe("validateScope", () => {
	it("accepts an 11-digit RUC and a valid YYYYMM period", () => {
		expect(() => validateScope(SCOPE)).not.toThrow();
	});

	it("rejects a non-11-digit RUC", () => {
		expect(codeOf(() => validateScope({ ...SCOPE, ruc: "123" }))).toBe(
			"INVALID_SCOPE",
		);
	});

	it("rejects a malformed period (not YYYYMM)", () => {
		expect(codeOf(() => validateScope({ ...SCOPE, period: "2026" }))).toBe(
			"INVALID_SCOPE",
		);
	});

	it("rejects a period with an out-of-range month", () => {
		expect(codeOf(() => validateScope({ ...SCOPE, period: "202613" }))).toBe(
			"INVALID_SCOPE",
		);
	});
});

describe("assertChartAccount", () => {
	it("accepts an account present in the chart", () => {
		const chart = new Set(["59", "681", "391"]);
		expect(() => assertChartAccount(chart, "681")).not.toThrow();
	});

	it("rejects an account absent from the chart", () => {
		const chart = new Set(["59", "681"]);
		expect(codeOf(() => assertChartAccount(chart, "999"))).toBe(
			"ACCOUNT_NOT_IN_CHART",
		);
	});
});

describe("assertRateInBounds", () => {
	it("accepts an integer rate within (0, 100%]", () => {
		expect(() => assertRateInBounds(1500, "policy")).not.toThrow();
		expect(() => assertRateInBounds(MAX_RATE_BP, "policy")).not.toThrow();
	});

	it("rejects zero, negative, fractional, and over-100% rates", () => {
		expect(codeOf(() => assertRateInBounds(0, "policy"))).toBe(
			"RATE_OUT_OF_BOUNDS",
		);
		expect(codeOf(() => assertRateInBounds(-100, "policy"))).toBe(
			"RATE_OUT_OF_BOUNDS",
		);
		expect(codeOf(() => assertRateInBounds(10.5, "policy"))).toBe(
			"RATE_OUT_OF_BOUNDS",
		);
		expect(codeOf(() => assertRateInBounds(10001, "policy"))).toBe(
			"RATE_OUT_OF_BOUNDS",
		);
	});
});

describe("assertBalanced", () => {
	function entry(lines: CloseEntry["lines"]): CloseEntry {
		return { id: "t", scope: SCOPE, kind: "closing", lines };
	}

	it("accepts a balanced entry", () => {
		expect(() =>
			assertBalanced(
				entry([
					{ accountCode: "681", side: "debit", amountCents: 250n },
					{ accountCode: "391", side: "credit", amountCents: 250n },
				]),
			),
		).not.toThrow();
	});

	it("rejects an unbalanced entry", () => {
		expect(() =>
			assertBalanced(
				entry([
					{ accountCode: "681", side: "debit", amountCents: 250n },
					{ accountCode: "391", side: "credit", amountCents: 100n },
				]),
			),
		).toThrow(CloseError);
	});

	it("rejects an unknown side", () => {
		expect(() =>
			assertBalanced(
				entry([
					{ accountCode: "681", side: "debit", amountCents: 250n },
					// @ts-expect-error — side is sealed to debit|credit
					{ accountCode: "391", side: "sideways", amountCents: 250n },
				]),
			),
		).toThrow(CloseError);
	});

	it("rejects a non-positive amount", () => {
		expect(() =>
			assertBalanced(
				entry([
					{ accountCode: "681", side: "debit", amountCents: 0n },
					{ accountCode: "391", side: "credit", amountCents: 0n },
				]),
			),
		).toThrow(CloseError);
	});
});
