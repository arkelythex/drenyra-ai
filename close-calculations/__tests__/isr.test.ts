/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Provisional ISR (pago a cuenta) tests — LIR Art. 85 coefficient and
 * statutory-minimum (1.5% = 150 bp) paths, greater-of, BigInt-exact cédula,
 * and fail-closed validation.
 */

import { describe, expect, it } from "vitest";
import { computeProvisionalIsr } from "../isr.js";
import { CloseError, type Scope } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

const CHART = new Set(["59", "881", "4017"]);

/** Statutory minimum per LIR Art. 85: 1.5% = 150 bp. */
const STATUTORY_MINIMUM_BP = 150;

const POLICY = {
	chart: CHART,
	isrExpenseAccount: "881",
	isrPayableAccount: "4017",
	statutoryMinimumBp: STATUTORY_MINIMUM_BP,
};

/** Returns the code of the CloseError thrown by `fn`, else fails. */
function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof CloseError) return error.code;
		throw error;
	}
	throw new Error("expected a CloseError to be thrown");
}

describe("computeProvisionalIsr", () => {
	it("applies the coefficient path when rule is coeficiente", () => {
		// Coeficiente 2% = 200 bp over 10,000,000 cents net income = 200,000.
		const result = computeProvisionalIsr(
			SCOPE,
			{
				id: "ISR-001",
				netIncomeCents: 10_000_000n,
				priorYearRatioBp: 200,
				monthlyNetIncomeCents: 10_000_000n,
				rule: "coeficiente",
			},
			POLICY,
		);
		expect(result.entry.id).toBe("isr-1");
		expect(result.entry.kind).toBe("isr");
		expect(result.entry.lines[0]).toEqual({
			accountCode: "881",
			side: "debit",
			amountCents: 200_000n,
		});
		expect(result.entry.lines[1]).toEqual({
			accountCode: "4017",
			side: "credit",
			amountCents: 200_000n,
		});
		expect(result.cedula).toEqual({
			coefficientPathCents: 200_000n,
			pctPathCents: 150_000n,
			appliedCents: 200_000n,
		});
	});

	it("applies the statutory minimum path (1.5% = 150 bp) when rule is pct-ingresos", () => {
		const result = computeProvisionalIsr(
			SCOPE,
			{
				id: "ISR-002",
				netIncomeCents: 10_000_000n,
				priorYearRatioBp: null,
				monthlyNetIncomeCents: 10_000_000n,
				rule: "pct-ingresos",
			},
			POLICY,
		);
		// 150 * 10_000_000 / 10000 = 150_000
		expect(result.cedula.pctPathCents).toBe(150_000n);
		expect(result.cedula.appliedCents).toBe(150_000n);
	});

	it("applies the greater of both paths when rule is greater-of", () => {
		const result = computeProvisionalIsr(
			SCOPE,
			{
				id: "ISR-003",
				netIncomeCents: 20_000_000n,
				priorYearRatioBp: 100, // coefficient path: 200_000
				monthlyNetIncomeCents: 10_000_000n, // pct path: 150_000
				rule: "greater-of",
			},
			POLICY,
		);
		expect(result.cedula.appliedCents).toBe(200_000n);
	});

	it("falls back to the statutory minimum under greater-of with no prior-year ratio", () => {
		const result = computeProvisionalIsr(
			SCOPE,
			{
				id: "ISR-004",
				netIncomeCents: 0n,
				priorYearRatioBp: null,
				monthlyNetIncomeCents: 10_000_000n,
				rule: "greater-of",
			},
			POLICY,
		);
		expect(result.cedula.appliedCents).toBe(150_000n);
	});

	it("rejects the coefficient rule without a prior-year ratio fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisionalIsr(
					SCOPE,
					{
						id: "ISR-005",
						netIncomeCents: 10_000_000n,
						priorYearRatioBp: null,
						monthlyNetIncomeCents: 10_000_000n,
						rule: "coeficiente",
					},
					POLICY,
				),
			),
		).toBe("RATE_OUT_OF_BOUNDS");
	});

	it("rejects negative net income fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisionalIsr(
					SCOPE,
					{
						id: "ISR-006",
						netIncomeCents: -1n,
						priorYearRatioBp: 200,
						monthlyNetIncomeCents: 10_000_000n,
						rule: "coeficiente",
					},
					POLICY,
				),
			),
		).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects an unsupported rule fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisionalIsr(
					SCOPE,
					{
						id: "ISR-007",
						netIncomeCents: 10_000_000n,
						priorYearRatioBp: 200,
						monthlyNetIncomeCents: 10_000_000n,
						rule: "invented" as never,
					},
					POLICY,
				),
			),
		).toBe("UNCLASSIFIABLE_INPUT");
	});

	it("rejects a computed pago a cuenta of zero fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisionalIsr(
					SCOPE,
					{
						id: "ISR-008",
						netIncomeCents: 0n,
						priorYearRatioBp: 1,
						monthlyNetIncomeCents: 0n,
						rule: "pct-ingresos",
					},
					POLICY,
				),
			),
		).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects an invalid scope fail-closed", () => {
		expect(
			codeOf(() =>
				computeProvisionalIsr(
					{ ruc: "123", period: "202607" },
					{
						id: "ISR-009",
						netIncomeCents: 10_000_000n,
						priorYearRatioBp: 200,
						monthlyNetIncomeCents: 10_000_000n,
						rule: "coeficiente",
					},
					POLICY,
				),
			),
		).toBe("INVALID_SCOPE");
	});
});
