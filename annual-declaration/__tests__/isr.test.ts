/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual ISR liability tests — configurable statutory rate (default 2950 bp,
 * LIR legal-entity rate) applied with deterministic BigInt floor against the
 * annual taxable base. A rate outside the validated policy envelope is rejected
 * with `RATE_OUT_OF_BOUNDS`; a negative taxable base is rejected with
 * `NEGATIVE_AMOUNT`. No liability is ever produced from an invalid input.
 */

import { describe, expect, it } from "vitest";
import { computeAnnualIsr } from "../isr.js";
import { AnnualDeclarationError } from "../types.js";

/** Returns the code of the AnnualDeclarationError thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof AnnualDeclarationError) return error.code;
		throw error;
	}
	throw new Error("expected an AnnualDeclarationError to be thrown");
}

describe("computeAnnualIsr", () => {
	it("applies the default statutory rate (2950 bp) when no policy is given", () => {
		expect(computeAnnualIsr(10_000_000n)).toBe(2_950_000n);
	});

	it("applies the configured statutory rate with deterministic BigInt floor", () => {
		// 3_333_333n * 2950 / 10000 = 983_333.235 -> floor 983_333n (cent discarded).
		expect(computeAnnualIsr(3_333_333n, { statutoryRateBp: 2950 })).toBe(983_333n);
	});

	it("rejects a rate above the default legal envelope with RATE_OUT_OF_BOUNDS", () => {
		expect(
			codeOf(() => computeAnnualIsr(10_000_000n, { statutoryRateBp: 15000 })),
		).toBe("RATE_OUT_OF_BOUNDS");
	});

	it("rejects a negative taxable base with NEGATIVE_AMOUNT", () => {
		expect(codeOf(() => computeAnnualIsr(-500_000n))).toBe("NEGATIVE_AMOUNT");
	});

	it("accepts a rate exactly at the configured max envelope", () => {
		expect(
			computeAnnualIsr(10_000_000n, {
				statutoryRateBp: 15000,
				maxStatutoryRateBp: 15000,
			}),
		).toBe(15_000_000n);
	});

	it("accepts a rate exactly at the default max envelope (10000 bp)", () => {
		expect(computeAnnualIsr(10_000_000n, { statutoryRateBp: 10000 })).toBe(10_000_000n);
	});

	it("rejects a rate just above the default max envelope with RATE_OUT_OF_BOUNDS", () => {
		expect(
			codeOf(() => computeAnnualIsr(10_000_000n, { statutoryRateBp: 10001 })),
		).toBe("RATE_OUT_OF_BOUNDS");
	});

	it("rejects a non-positive rate with RATE_OUT_OF_BOUNDS", () => {
		expect(codeOf(() => computeAnnualIsr(10_000_000n, { statutoryRateBp: 0 }))).toBe(
			"RATE_OUT_OF_BOUNDS",
		);
	});

	it("rejects a fractional rate with RATE_OUT_OF_BOUNDS", () => {
		expect(
			codeOf(() => computeAnnualIsr(10_000_000n, { statutoryRateBp: 2950.5 })),
		).toBe("RATE_OUT_OF_BOUNDS");
	});

	it("computes a zero liability for a zero taxable base", () => {
		expect(computeAnnualIsr(0n)).toBe(0n);
	});
});
