/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Débito fiscal tests — sum of IGV on taxable sales invoices for the period,
 * exempt/inafecto lines excluded from the taxable base, and fail-closed
 * validation of malformed sales lines (TUO IGV — D.S. 055-99-EF).
 */

import { describe, expect, it } from "vitest";
import { computeDebitoFiscal } from "../debit.js";
import { IgvError, type Scope, type SalesLine } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

/** Standard combined rate: 18% = 1800 bp. */
const RATE_BP = 1800;

function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof IgvError) return error.code;
		throw error;
	}
	throw new Error("expected an IgvError to be thrown");
}

describe("computeDebitoFiscal", () => {
	it("sums IGV at the configured rate over taxable lines only", () => {
		const lines: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 100_000n, taxable: true },
			{ id: "F001-2", ruc: SCOPE.ruc, baseCents: 50_000n, taxable: true },
		];
		// 18% of 150_000 = 27_000
		expect(computeDebitoFiscal(SCOPE, lines, RATE_BP)).toBe(27_000n);
	});

	it("excludes exempt/inafecto lines from the taxable base", () => {
		const lines: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 100_000n, taxable: true },
			{ id: "F001-2", ruc: SCOPE.ruc, baseCents: 500_000n, taxable: false },
		];
		// Only the taxable line contributes: 18% of 100_000 = 18_000
		expect(computeDebitoFiscal(SCOPE, lines, RATE_BP)).toBe(18_000n);
	});

	it("returns zero débito fiscal for an empty invoice set", () => {
		expect(computeDebitoFiscal(SCOPE, [], RATE_BP)).toBe(0n);
	});

	it("floors fractional cents deterministically (BigInt floor, no float)", () => {
		const lines: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 333n, taxable: true },
		];
		// 333 * 1800 / 10000 = 59.94 -> floors to 59
		expect(computeDebitoFiscal(SCOPE, lines, RATE_BP)).toBe(59n);
	});

	it("rejects a zero base amount fail-closed", () => {
		const lines: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 0n, taxable: true },
		];
		expect(codeOf(() => computeDebitoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"NEGATIVE_AMOUNT",
		);
	});

	it("rejects a negative base amount fail-closed", () => {
		const lines: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: -1n, taxable: true },
		];
		expect(codeOf(() => computeDebitoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"NEGATIVE_AMOUNT",
		);
	});

	it("rejects a missing line id fail-closed", () => {
		const lines: SalesLine[] = [
			{ id: "", ruc: SCOPE.ruc, baseCents: 1000n, taxable: true },
		];
		expect(codeOf(() => computeDebitoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"MISSING_FIELD",
		);
	});

	it("rejects a line from a foreign RUC fail-closed (tenant isolation)", () => {
		const lines: SalesLine[] = [
			{ id: "F001-1", ruc: "20999999999", baseCents: 1000n, taxable: true },
		];
		expect(codeOf(() => computeDebitoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"CROSS_RUC_ACCESS",
		);
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() =>
				computeDebitoFiscal({ ruc: "123", period: "202607" }, [], RATE_BP),
			),
		).toBe("INVALID_SCOPE");
	});
});
