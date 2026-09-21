/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Barrel smoke test — every public engine function is reachable from the
 * module index and chains end-to-end into a verified report.
 */

import { describe, expect, it } from "vitest";
import {
	buildIgvReport,
	computeCreditoFiscal,
	computeDebitoFiscal,
	determineIgv,
	type PurchaseLine,
	type SalesLine,
	type Scope,
} from "../index.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

describe("igv public surface", () => {
	it("exposes every engine function", () => {
		expect(typeof computeDebitoFiscal).toBe("function");
		expect(typeof computeCreditoFiscal).toBe("function");
		expect(typeof determineIgv).toBe("function");
		expect(typeof buildIgvReport).toBe("function");
	});

	it("chains the full IGV determination end-to-end", () => {
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
		const determination = determineIgv(SCOPE, sales, purchases);
		const report = buildIgvReport(determination);
		expect(report.identityVerified).toBe(true);
		expect(report.netPositionKind).toBe("payable");
	});
});
