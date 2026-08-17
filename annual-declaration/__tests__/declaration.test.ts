/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration payload tests — deterministic structured DJ payload: RUC,
 * fiscal year, annual net income, taxable base, annual ISR, provisional credit,
 * balance amount and kind, and the supporting cédulas (net income determination,
 * ISR with rate, settlement). Pure data with stable field ordering: identical
 * inputs produce deep-equal payloads, with no I/O or network side effect.
 */

import { describe, expect, it } from "vitest";
import { buildAnnualDeclaration } from "../declaration.js";
import {
	type AnnualMonthInput,
	type AnnualNetIncomeInput,
	type AnnualScope,
	type AnnualSettlement,
} from "../types.js";

const RUC = "20123456789";
const YEAR = "2025";
const SCOPE: AnnualScope = { ruc: RUC, year: YEAR };

const SETTLEMENT: AnnualSettlement = {
	scope: SCOPE,
	annualIsrCents: 2_950_000n,
	provisionalCreditCents: 2_000_000n,
	balanceCents: 950_000n,
	balanceKind: "payable",
};

function months(): AnnualMonthInput[] {
	return Array.from({ length: 12 }, (_, i) => ({
		scope: { ruc: RUC, year: YEAR, period: `${YEAR}-${String(i + 1).padStart(2, "0")}` },
		closed: true,
		netIncomeCents: 1_000_000n,
	}));
}

function netIncome(): AnnualNetIncomeInput {
	return {
		scope: SCOPE,
		months: months(),
		adjustments: { additionsCents: 500_000n, deductionsCents: 200_000n },
	};
}

function input() {
	return {
		scope: SCOPE,
		annualNetIncomeCents: 12_300_000n,
		netIncome: netIncome(),
		taxableBaseCents: 12_300_000n,
		rateBp: 2950,
		settlement: SETTLEMENT,
	};
}

describe("buildAnnualDeclaration", () => {
	it("compiles the full settlement with every field and supporting cédula", () => {
		const payload = buildAnnualDeclaration(input());
		expect(payload.scope).toEqual(SCOPE);
		expect(payload.annualNetIncomeCents).toBe(12_300_000n);
		expect(payload.taxableBaseCents).toBe(12_300_000n);
		expect(payload.annualIsrCents).toBe(2_950_000n);
		expect(payload.provisionalCreditCents).toBe(2_000_000n);
		expect(payload.balanceCents).toBe(950_000n);
		expect(payload.balanceKind).toBe("payable");
		expect(payload.cédulas.netIncome).toEqual(netIncome());
		expect(payload.cédulas.isr).toEqual({ taxableBaseCents: 12_300_000n, rateBp: 2950 });
		expect(payload.cédulas.settlement).toEqual(SETTLEMENT);
	});

	it("is deterministic: identical inputs yield deep-equal payloads", () => {
		const first = buildAnnualDeclaration(input());
		const second = buildAnnualDeclaration(input());
		// Deep-equality is the byte-identical evidence: BigInt cents are not
		// JSON-serializable, so structural equality is the canonical comparison.
		expect(second).toEqual(first);
	});

	it("emits pure data with no external side effect", () => {
		// The builder is a synchronous pure function: it returns the payload
		// directly and performs no I/O, network call, submission, or CDR interaction.
		const payload = buildAnnualDeclaration(input());
		expect(payload).toBeDefined();
		expect(payload.scope.ruc).toBe(RUC);
		expect(payload.scope.year).toBe(YEAR);
	});
});
