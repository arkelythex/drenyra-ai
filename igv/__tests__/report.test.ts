/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * IGV executive report tests — compiles the determination into a report that
 * independently recomputes the débito/crédito identity before ever presenting
 * a net position; the report never claims a determination it did not verify.
 */

import { describe, expect, it } from "vitest";
import { determineIgv } from "../engine.js";
import { buildIgvReport } from "../report.js";
import { IgvError, type IgvDetermination, type Scope } from "../types.js";

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

describe("buildIgvReport", () => {
	it("compiles a verified report from a valid determination", () => {
		const determination = determineIgv(
			SCOPE,
			[{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 1_000_000n, taxable: true }],
			[
				{
					id: "P001-1",
					ruc: SCOPE.ruc,
					baseCents: 200_000n,
					validComprobante: false,
					destinedToTaxedOperation: true,
				},
			],
		);
		const report = buildIgvReport(determination);
		expect(report.identityVerified).toBe(true);
		expect(report.debitoFiscalCents).toBe(180_000n);
		expect(report.creditoFiscalCents).toBe(0n);
		expect(report.netPositionCents).toBe(180_000n);
		expect(report.netPositionKind).toBe("payable");
		expect(report.hasExceptions).toBe(true);
		expect(report.excludedCreditLines).toHaveLength(1);
	});

	it("reports no exceptions when every credit line is eligible", () => {
		const determination = determineIgv(
			SCOPE,
			[{ id: "F001-1", ruc: SCOPE.ruc, baseCents: 100_000n, taxable: true }],
			[],
		);
		const report = buildIgvReport(determination);
		expect(report.hasExceptions).toBe(false);
		expect(report.excludedCreditLines).toEqual([]);
	});

	it("throws INCONSISTENT_DETERMINATION when the net position was tampered with", () => {
		const determination = determineIgv(SCOPE, [], []);
		const tampered: IgvDetermination = {
			...determination,
			netPositionCents: 999n,
			netPositionKind: "payable",
		};
		expect(codeOf(() => buildIgvReport(tampered))).toBe(
			"INCONSISTENT_DETERMINATION",
		);
	});
});
