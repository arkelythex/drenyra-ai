/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * IGV determination engine tests — orchestrates débito/crédito fiscal into the
 * net position (payable / in-favor / zero, mirroring `AnnualBalanceKind`), the
 * default 18% policy rate with override, and rate-envelope validation.
 */

import { describe, expect, it } from "vitest";
import { determineIgv } from "../engine.js";
import {
	DEFAULT_IGV_RATE_BP,
	IgvError,
	type PurchaseLine,
	type SalesLine,
	type Scope,
} from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof IgvError) return error.code;
		throw error;
	}
	throw new Error("expected an IgvError to be thrown");
}

describe("determineIgv", () => {
	it("reports a payable net position when débito exceeds crédito, using the 18% default rate", () => {
		const sales: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 1_000_000n, taxable: true },
		];
		const purchases: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 200_000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		const result = determineIgv(SCOPE, sales, purchases);
		expect(result.rateBp).toBe(DEFAULT_IGV_RATE_BP);
		expect(result.debitoFiscalCents).toBe(180_000n);
		expect(result.creditoFiscalCents).toBe(36_000n);
		expect(result.netPositionCents).toBe(144_000n);
		expect(result.netPositionKind).toBe("payable");
		expect(result.excludedCreditLines).toEqual([]);
	});

	it("reports an in-favor (saldo a favor) net position when crédito exceeds débito", () => {
		const sales: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 100_000n, taxable: true },
		];
		const purchases: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 1_000_000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		const result = determineIgv(SCOPE, sales, purchases);
		expect(result.netPositionCents).toBeLessThan(0n);
		expect(result.netPositionKind).toBe("in-favor");
	});

	it("reports a zero net position when débito equals crédito", () => {
		const sales: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 100_000n, taxable: true },
		];
		const purchases: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 100_000n,
				validComprobante: true,
				destinedToTaxedOperation: true,
			},
		];
		const result = determineIgv(SCOPE, sales, purchases);
		expect(result.netPositionCents).toBe(0n);
		expect(result.netPositionKind).toBe("zero");
	});

	it("accepts a policy-overridden rate", () => {
		const sales: SalesLine[] = [
			{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 100_000n, taxable: true },
		];
		const result = determineIgv(SCOPE, sales, [], { rateBp: 1000 });
		expect(result.rateBp).toBe(1000);
		expect(result.debitoFiscalCents).toBe(10_000n);
	});

	it("surfaces excluded credit lines as exceptions in the determination", () => {
		const purchases: PurchaseLine[] = [
			{
				id: "P001-1",
				ruc: SCOPE.ruc,
				baseCents: 100_000n,
				validComprobante: false,
				destinedToTaxedOperation: true,
			},
		];
		const result = determineIgv(SCOPE, [], purchases);
		expect(result.creditoFiscalCents).toBe(0n);
		expect(result.excludedCreditLines).toHaveLength(1);
		expect(result.excludedCreditLines[0]?.code).toBe("INVALID_COMPROBANTE");
	});

	it("rejects a policy rate outside the legal envelope fail-closed", () => {
		expect(
			codeOf(() => determineIgv(SCOPE, [], [], { rateBp: 10001 })),
		).toBe("RATE_OUT_OF_BOUNDS");
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() => determineIgv({ ruc: "123", period: "202607" }, [], [])),
		).toBe("INVALID_SCOPE");
	});
});
