/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Executive report unit tests — balances, full difference detail, adjustment
 * impact (`netAdjustmentCents = Σ inflow − Σ outflow`), and the reconciliation
 * identity check. `reconciled` is true ONLY when every movement is matched AND
 * `ledgerFinal + netAdjustmentCents === bankFinal`; a report without a single
 * valid RUC + fiscal period is rejected (`INVALID_SCOPE`).
 */

import { describe, expect, it } from "vitest";
import { reconcile } from "../compare.js";
import { buildReport } from "../report.js";
import {
	BankReconciliationError,
	type Movement,
	type Reconciliation,
	type ReconciliationBalances,
	type Scope,
} from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

function bankMovement(overrides: Partial<Movement> = {}): Movement {
	return {
		date: "2026-07-15",
		reference: "recibo-001",
		amountCents: 250n,
		side: "inflow",
		source: "bank",
		sourceKey: "b1",
		...overrides,
	};
}

function ledgerMovement(overrides: Partial<Movement> = {}): Movement {
	return {
		date: "2026-07-15",
		reference: "asiento-001",
		amountCents: 250n,
		side: "inflow",
		source: "ledger",
		sourceKey: "l1",
		...overrides,
	};
}

describe("buildReport() — balances and difference detail", () => {
	it("states initial/final balances, lists every difference with its classification, and lists each adjustment with netAdjustmentCents", () => {
		const reconciliation = reconcile(
			SCOPE,
			[
				bankMovement({ reference: "shared", sourceKey: "b1" }),
				bankMovement({ reference: "ba-2", sourceKey: "b2", amountCents: 80n, side: "outflow" }),
			],
			[ledgerMovement({ reference: "shared", sourceKey: "l1" })],
		);
		const balances: ReconciliationBalances = {
			bankInitial: 5000n,
			bankFinal: 5070n,
			ledgerInitial: 5000n,
			ledgerFinal: 5000n,
		};

		const report = buildReport(reconciliation, balances);

		expect(report.scope).toEqual(SCOPE);
		expect(report.balances).toEqual(balances);
		expect(report.differences).toHaveLength(2);
		expect(report.differences.map((d) => d.classification).sort()).toEqual([
			"bankOnly",
			"matched",
		]);
		expect(report.adjustments).toHaveLength(1);
		expect(report.adjustments[0]).toMatchObject({
			draftId: "adj-1",
			source: "bank",
			amountCents: 80n,
			side: "outflow",
			requireApproval: true,
		});
		expect(report.netAdjustmentCents).toBe(-80n);
	});

	it("lists matched differences with their bank and ledger sides", () => {
		const reconciliation = reconcile(
			SCOPE,
			[bankMovement({ reference: "shared", sourceKey: "b1" })],
			[ledgerMovement({ reference: "shared", sourceKey: "l1" })],
		);
		const report = buildReport(reconciliation, {
			bankInitial: 1000n,
			bankFinal: 1250n,
			ledgerInitial: 1000n,
			ledgerFinal: 1250n,
		});
		expect(report.differences).toHaveLength(1);
		expect(report.differences[0].classification).toBe("matched");
		if (report.differences[0].classification === "matched") {
			expect(report.differences[0].bank.sourceKey).toBe("b1");
			expect(report.differences[0].ledger.sourceKey).toBe("l1");
		}
	});
});

describe("buildReport() — reconciliation identity", () => {
	it("is reconciled only when fully matched and ledgerFinal + netAdjustmentCents === bankFinal", () => {
		const reconciliation = reconcile(
			SCOPE,
			[bankMovement({ reference: "shared", sourceKey: "b1" })],
			[ledgerMovement({ reference: "shared", sourceKey: "l1" })],
		);
		const report = buildReport(reconciliation, {
			bankInitial: 1000n,
			bankFinal: 1250n,
			ledgerInitial: 1000n,
			ledgerFinal: 1250n,
		});
		expect(report.reconciled).toBe(true);
	});

	it("is NOT reconciled when unmatched differences exist even if the arithmetic identity holds", () => {
		// A 250n inflow draft would close the gap (1000 + 250 === 1250), but the
		// bank-only movement is unmatched: the report must not claim a
		// reconciliation it did not achieve.
		const reconciliation = reconcile(
			SCOPE,
			[bankMovement({ reference: "ba-1", sourceKey: "b1" })],
			[],
		);
		const report = buildReport(reconciliation, {
			bankInitial: 1000n,
			bankFinal: 1250n,
			ledgerInitial: 1000n,
			ledgerFinal: 1000n,
		});
		expect(report.netAdjustmentCents).toBe(250n);
		expect(report.reconciled).toBe(false);
	});

	it("is NOT reconciled when balances do not agree even if fully matched", () => {
		const reconciliation = reconcile(
			SCOPE,
			[bankMovement({ reference: "shared", sourceKey: "b1" })],
			[ledgerMovement({ reference: "shared", sourceKey: "l1" })],
		);
		const report = buildReport(reconciliation, {
			bankInitial: 1000n,
			bankFinal: 1250n,
			ledgerInitial: 1000n,
			ledgerFinal: 1000n,
		});
		expect(report.netAdjustmentCents).toBe(0n);
		expect(report.reconciled).toBe(false);
	});

	it("computes netAdjustmentCents as inflow minus outflow (negative for outflows)", () => {
		const reconciliation = reconcile(
			SCOPE,
			[
				bankMovement({ reference: "ba-in", sourceKey: "b1", amountCents: 120n, side: "inflow" }),
				bankMovement({ reference: "ba-out", sourceKey: "b2", amountCents: 80n, side: "outflow" }),
			],
			[],
		);
		const report = buildReport(reconciliation, {
			bankInitial: 0n,
			bankFinal: 40n,
			ledgerInitial: 0n,
			ledgerFinal: 0n,
		});
		expect(report.adjustments).toHaveLength(2);
		expect(report.netAdjustmentCents).toBe(40n);
		expect(report.reconciled).toBe(false);
	});

	it("reports an empty reconciliation as reconciled when balances agree", () => {
		const report = buildReport(reconcile(SCOPE, [], []), {
			bankInitial: 1000n,
			bankFinal: 1000n,
			ledgerInitial: 1000n,
			ledgerFinal: 1000n,
		});
		expect(report.differences).toEqual([]);
		expect(report.adjustments).toEqual([]);
		expect(report.netAdjustmentCents).toBe(0n);
		expect(report.reconciled).toBe(true);
	});

	it("rejects a report without a single valid RUC and fiscal period (INVALID_SCOPE)", () => {
		const badScopeReconciliation = {
			scope: { ruc: "123", period: "202607" },
			differences: [],
			fullyMatched: true,
		} as unknown as Reconciliation;
		try {
			buildReport(badScopeReconciliation, {
				bankInitial: 0n,
				bankFinal: 0n,
				ledgerInitial: 0n,
				ledgerFinal: 0n,
			});
			expect.unreachable("buildReport should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BankReconciliationError);
			expect((error as BankReconciliationError).code).toBe("INVALID_SCOPE");
		}
	});
});
