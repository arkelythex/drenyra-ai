/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Canonical type + shared-invariant tests for the IGV determination engine.
 *
 * Covers scope validation (RUC 11 digits + YYYYMM period), the rate-envelope
 * validation shared by débito/crédito, and the sealed default constants.
 */

import { describe, expect, it } from "vitest";
import {
	assertRateInBounds,
	DEFAULT_IGV_RATE_BP,
	DEFAULT_MAX_IGV_RATE_BP,
	IgvError,
	validateScope,
	type Scope,
} from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

/** Returns the typed code of the IgvError thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof IgvError) return error.code;
		throw error;
	}
	throw new Error("expected an IgvError to be thrown");
}

describe("IGV default constants", () => {
	it("defaults to the standard combined rate (18% = 1800 bp)", () => {
		expect(DEFAULT_IGV_RATE_BP).toBe(1800);
	});

	it("caps the legal envelope at 100% = 10000 bp", () => {
		expect(DEFAULT_MAX_IGV_RATE_BP).toBe(10000);
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

describe("assertRateInBounds", () => {
	it("accepts an integer rate within (0, 100%]", () => {
		expect(() =>
			assertRateInBounds(1800, DEFAULT_MAX_IGV_RATE_BP, "IGV"),
		).not.toThrow();
		expect(() =>
			assertRateInBounds(DEFAULT_MAX_IGV_RATE_BP, DEFAULT_MAX_IGV_RATE_BP, "IGV"),
		).not.toThrow();
	});

	it("rejects zero, negative, fractional, and over-envelope rates", () => {
		expect(codeOf(() => assertRateInBounds(0, DEFAULT_MAX_IGV_RATE_BP, "IGV"))).toBe(
			"RATE_OUT_OF_BOUNDS",
		);
		expect(
			codeOf(() => assertRateInBounds(-100, DEFAULT_MAX_IGV_RATE_BP, "IGV")),
		).toBe("RATE_OUT_OF_BOUNDS");
		expect(
			codeOf(() => assertRateInBounds(18.5, DEFAULT_MAX_IGV_RATE_BP, "IGV")),
		).toBe("RATE_OUT_OF_BOUNDS");
		expect(
			codeOf(() => assertRateInBounds(10001, DEFAULT_MAX_IGV_RATE_BP, "IGV")),
		).toBe("RATE_OUT_OF_BOUNDS");
	});
});
