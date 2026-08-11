/**
 * RUC Módulo 11 checksum tests — pins the canonical algorithm
 * (candidates/ruc.ts, ported from drenyra-pi runtime/ruc.ts).
 *
 * Covers: the known-valid real RUC 20131312955, wrong-check-digit rejection,
 * the two boundary branches (expected 11 → 1 and expected 10 → 0), and
 * non-numeric / wrong-length rejection.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; RUC digits and check digits are integers.
 */
import { describe, expect, it } from "vitest";
import { expectedRucCheckDigit, isValidRucChecksummed } from "../ruc.js";

describe("expectedRucCheckDigit (Módulo 11)", () => {
	it("computes the check digit for the known-valid RUC 20131312955", () => {
		// sum = 2·5+0·4+1·3+3·2+1·7+3·6+1·5+2·4+9·3+5·2 = 94; 94 % 11 = 6; 11-6 = 5
		expect(expectedRucCheckDigit("2013131295")).toBe(5);
	});

	it("maps expected 11 → 1 (remainder 0)", () => {
		// first10 "0000000000": sum 0; 0 % 11 = 0; 11 - 0 = 11 → 1
		expect(expectedRucCheckDigit("0000000000")).toBe(1);
	});

	it("maps expected 10 → 0 (remainder 1)", () => {
		// first10 "0000000006": sum 12; 12 % 11 = 1; 11 - 1 = 10 → 0
		expect(expectedRucCheckDigit("0000000006")).toBe(0);
	});
});

describe("isValidRucChecksummed", () => {
	it("accepts the known-valid real RUC 20131312955", () => {
		expect(isValidRucChecksummed("20131312955")).toBe(true);
	});

	it("accepts boundary RUCs hitting the 11→1 and 10→0 branches", () => {
		expect(isValidRucChecksummed("00000000001")).toBe(true);
		expect(isValidRucChecksummed("00000000060")).toBe(true);
	});

	it("rejects a wrong check digit on an otherwise shape-valid RUC", () => {
		expect(isValidRucChecksummed("20131312954")).toBe(false);
	});

	it("rejects non-numeric, too-short, and too-long input", () => {
		expect(isValidRucChecksummed("2013131295A")).toBe(false);
		expect(isValidRucChecksummed("2013131295")).toBe(false);
		expect(isValidRucChecksummed("201313129555")).toBe(false);
		expect(isValidRucChecksummed("")).toBe(false);
	});
});
