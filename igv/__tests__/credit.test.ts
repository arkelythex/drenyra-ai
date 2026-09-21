/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Crédito fiscal tests — sum of IGV on purchase invoices for the period,
 * restricted to lines that pass the TUO IGV Arts. 18-19 formal/substantial
 * validity checks. A line failing either check is excluded from the credit
 * and reported as a typed exception, never silently dropped.
 */

import { describe, expect, it } from "vitest";
import { computeCreditoFiscal } from "../credit.js";
import { IgvError, type PurchaseLine, type Scope } from "../types.js";

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

describe("computeCreditoFiscal", () => {
	it("sums IGV at the configured rate over eligible lines only", () => {
		const lines: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 100_000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
			{
				id: "P001-2",
				ruc: SCOPE.ruc,
				baseCents: 50_000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		const result = computeCreditoFiscal(SCOPE, lines, RATE_BP);
		// 18% of 150_000 = 27_000
		expect(result.creditoFiscalCents).toBe(27_000n);
		expect(result.excludedCreditLines).toEqual([]);
	});

	it("excludes a line with an annulled/voided comprobante as a reported exception (Art. 19)", () => {
		const lines: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 100_000n,
				validComprobante: false,
				destinedToTaxedOperation: true,
			},
		];
		const result = computeCreditoFiscal(SCOPE, lines, RATE_BP);
		expect(result.creditoFiscalCents).toBe(0n);
		expect(result.excludedCreditLines).toEqual([
			{
				lineId: "P001-1",
				code: "INVALID_COMPROBANTE",
				detail: expect.any(String),
			},
		]);
	});

	it("excludes a line not destined to a taxed/exported operation as a reported exception (Art. 18)", () => {
		const lines: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 100_000n,
				validComprobante: true,
				destinedToTaxedOperation: false,
			},
		];
		const result = computeCreditoFiscal(SCOPE, lines, RATE_BP);
		expect(result.creditoFiscalCents).toBe(0n);
		expect(result.excludedCreditLines).toEqual([
			{
				lineId: "P001-1",
				code: "NOT_DESTINED_TO_TAXED_OPERATION",
				detail: expect.any(String),
			},
		]);
	});

	it("mixes eligible and excluded lines correctly", () => {
		const lines: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 100_000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
			{
				id: "P001-2",
				ruc: SCOPE.ruc,
				baseCents: 200_000n,
				validComprobante: false,
				destinedToTaxedOperation: true,
			},
		];
		const result = computeCreditoFiscal(SCOPE, lines, RATE_BP);
		expect(result.creditoFiscalCents).toBe(18_000n);
		expect(result.excludedCreditLines).toHaveLength(1);
		expect(result.excludedCreditLines[0]?.lineId).toBe("P001-2");
	});

	it("returns zero crédito fiscal for an empty purchase set", () => {
		const result = computeCreditoFiscal(SCOPE, [], RATE_BP);
		expect(result.creditoFiscalCents).toBe(0n);
		expect(result.excludedCreditLines).toEqual([]);
	});

	it("rejects a zero base amount fail-closed (malformed input, not an exception)", () => {
		const lines: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 0n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		expect(codeOf(() => computeCreditoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"NEGATIVE_AMOUNT",
		);
	});

	it("rejects a missing line id fail-closed", () => {
		const lines: PurchaseLine[] = [
			{
				id: "",
				ruc: SCOPE.ruc,
				baseCents: 1000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		expect(codeOf(() => computeCreditoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"MISSING_FIELD",
		);
	});

	it("rejects a line from a foreign RUC fail-closed (tenant isolation)", () => {
		const lines: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: "20999999999",
				baseCents: 1000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		expect(codeOf(() => computeCreditoFiscal(SCOPE, lines, RATE_BP))).toBe(
			"CROSS_RUC_ACCESS",
		);
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() =>
				computeCreditoFiscal({ ruc: "123", period: "202607" }, [], RATE_BP),
			),
		).toBe("INVALID_SCOPE");
	});
});
