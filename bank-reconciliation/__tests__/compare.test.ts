/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Matching unit tests — reference-first classification, bounded amount+same-day
 * fallback, ambiguity surfacing (conflict), and scope rejection. Every movement
 * must end in exactly one classification; conflicts are never guessed and never
 * auto-matched.
 */

import { describe, expect, it } from "vitest";
import { reconcile } from "../compare.js";
import {
	normalizeBankRows,
	normalizeLedgerRows,
} from "../normalize.js";
import {
	BankReconciliationError,
	type BankRow,
	type Difference,
	type LedgerRow,
	type Movement,
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

function bankRow(overrides: Partial<BankRow> = {}): BankRow {
	return {
		ruc: SCOPE.ruc,
		date: "2026-07-15",
		reference: "B-001",
		amount: "250",
		side: "deposit",
		sourceKey: "stmt-0001",
		...overrides,
	};
}

function ledgerRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
	return {
		ruc: SCOPE.ruc,
		date: "2026-07-15",
		reference: "L-001",
		amount: "250",
		side: "debit",
		sourceKey: "entry-0001",
		...overrides,
	};
}

/** Count of movements referenced by a difference, for completeness checks. */
function movementCount(difference: Difference): number {
	switch (difference.classification) {
		case "matched":
			return 2;
		case "bankOnly":
		case "ledgerOnly":
			return 1;
		case "conflict":
			return difference.bank.length + difference.ledger.length;
	}
}

describe("reconcile() — reference-first matching", () => {
	it("classifies a shared reference as a matched pair", () => {
		const bank = [bankMovement({ reference: "recibo-001", sourceKey: "b1" })];
		const ledger = [ledgerMovement({ reference: "recibo-001", sourceKey: "l1" })];
		const result = reconcile(SCOPE, bank, ledger);

		expect(result.differences).toHaveLength(1);
		const difference = result.differences[0];
		expect(difference.classification).toBe("matched");
		if (difference.classification === "matched") {
			expect(difference.bank.sourceKey).toBe("b1");
			expect(difference.ledger.sourceKey).toBe("l1");
		}
		expect(result.fullyMatched).toBe(true);
	});

	it("classifies a bank movement with no ledger reference as bankOnly", () => {
		const result = reconcile(SCOPE, [bankMovement({ sourceKey: "b1" })], []);
		expect(result.differences).toHaveLength(1);
		expect(result.differences[0].classification).toBe("bankOnly");
		if (result.differences[0].classification === "bankOnly") {
			expect(result.differences[0].bank.sourceKey).toBe("b1");
		}
		expect(result.fullyMatched).toBe(false);
	});

	it("classifies a ledger movement with no bank reference as ledgerOnly", () => {
		const result = reconcile(SCOPE, [], [ledgerMovement({ sourceKey: "l1" })]);
		expect(result.differences).toHaveLength(1);
		expect(result.differences[0].classification).toBe("ledgerOnly");
		if (result.differences[0].classification === "ledgerOnly") {
			expect(result.differences[0].ledger.sourceKey).toBe("l1");
		}
		expect(result.fullyMatched).toBe(false);
	});

	it("matches multiple independent references", () => {
		const bank = [
			bankMovement({ reference: "recibo-001", sourceKey: "b1" }),
			bankMovement({ reference: "recibo-002", sourceKey: "b2" }),
		];
		const ledger = [
			ledgerMovement({ reference: "recibo-001", sourceKey: "l1" }),
			ledgerMovement({ reference: "recibo-002", sourceKey: "l2" }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(true);
		expect(result.differences).toHaveLength(2);
		expect(result.differences.every((d) => d.classification === "matched")).toBe(true);
	});
});

describe("reconcile() — amount + same-day fallback", () => {
	it("matches identical BigInt-cent amounts on the same date when references do not match", () => {
		const bank = [
			bankMovement({ reference: "ba-1", sourceKey: "b1", amountCents: 250n, date: "2026-07-15" }),
		];
		const ledger = [
			ledgerMovement({ reference: "le-1", sourceKey: "l1", amountCents: 250n, date: "2026-07-15" }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(true);
		expect(result.differences).toHaveLength(1);
		expect(result.differences[0].classification).toBe("matched");
		if (result.differences[0].classification === "matched") {
			expect(result.differences[0].bank.sourceKey).toBe("b1");
			expect(result.differences[0].ledger.sourceKey).toBe("l1");
		}
	});

	it("does NOT match identical amounts on different dates", () => {
		const bank = [
			bankMovement({ reference: "ba-1", sourceKey: "b1", date: "2026-07-15" }),
		];
		const ledger = [
			ledgerMovement({ reference: "le-1", sourceKey: "l1", date: "2026-07-16" }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(false);
		expect(result.differences).toHaveLength(2);
		const classifications = result.differences.map((d) => d.classification).sort();
		expect(classifications).toEqual(["bankOnly", "ledgerOnly"]);
	});

	it("does NOT match same-day different amounts", () => {
		const bank = [
			bankMovement({ reference: "ba-1", sourceKey: "b1", amountCents: 250n }),
		];
		const ledger = [
			ledgerMovement({ reference: "le-1", sourceKey: "l1", amountCents: 300n }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(false);
		expect(result.differences).toHaveLength(2);
		expect(result.differences.map((d) => d.classification).sort()).toEqual([
			"bankOnly",
			"ledgerOnly",
		]);
	});

	it("never matches on amount alone", () => {
		const bank = [bankMovement({ reference: "ba-1", sourceKey: "b1", date: "2026-07-10" })];
		const ledger = [ledgerMovement({ reference: "le-1", sourceKey: "l1", date: "2026-07-20" })];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(false);
		expect(result.differences.map((d) => d.classification).sort()).toEqual([
			"bankOnly",
			"ledgerOnly",
		]);
	});

	it("never matches on date alone", () => {
		const bank = [bankMovement({ reference: "ba-1", sourceKey: "b1", amountCents: 250n })];
		const ledger = [ledgerMovement({ reference: "le-1", sourceKey: "l1", amountCents: 999n })];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(false);
		expect(result.differences.map((d) => d.classification).sort()).toEqual([
			"bankOnly",
			"ledgerOnly",
		]);
	});

	it("does NOT match same amount and same date when canonical sides differ", () => {
		const bank = [bankMovement({ reference: "ba-1", sourceKey: "b1", side: "inflow" })];
		const ledger = [ledgerMovement({ reference: "le-1", sourceKey: "l1", side: "outflow" })];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(false);
		expect(result.differences.map((d) => d.classification).sort()).toEqual([
			"bankOnly",
			"ledgerOnly",
		]);
	});
});

describe("reconcile() — conflicts and scope", () => {
	it("surfaces an ambiguous reference as a conflict and never auto-matches", () => {
		const bank = [
			bankMovement({ reference: "dup-ref", sourceKey: "b1" }),
			bankMovement({ reference: "dup-ref", sourceKey: "b2" }),
		];
		const ledger = [ledgerMovement({ reference: "dup-ref", sourceKey: "l1" })];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(false);
		expect(result.differences).toHaveLength(1);
		const difference = result.differences[0];
		expect(difference.classification).toBe("conflict");
		if (difference.classification === "conflict") {
			expect(difference.reference).toBe("dup-ref");
			expect(difference.bank.map((m) => m.sourceKey).sort()).toEqual(["b1", "b2"]);
			expect(difference.ledger.map((m) => m.sourceKey)).toEqual(["l1"]);
		}
	});

	it("treats a reference with more than one ledger counterpart as a conflict", () => {
		const bank = [bankMovement({ reference: "dup-ref", sourceKey: "b1" })];
		const ledger = [
			ledgerMovement({ reference: "dup-ref", sourceKey: "l1" }),
			ledgerMovement({ reference: "dup-ref", sourceKey: "l2" }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.differences).toHaveLength(1);
		expect(result.differences[0].classification).toBe("conflict");
		if (result.differences[0].classification === "conflict") {
			expect(result.differences[0].ledger.map((m) => m.sourceKey).sort()).toEqual([
				"l1",
				"l2",
			]);
		}
	});

	it("treats duplicate references on both sides as a conflict", () => {
		const bank = [
			bankMovement({ reference: "dup-ref", sourceKey: "b1" }),
			bankMovement({ reference: "dup-ref", sourceKey: "b2" }),
		];
		const ledger = [
			ledgerMovement({ reference: "dup-ref", sourceKey: "l1" }),
			ledgerMovement({ reference: "dup-ref", sourceKey: "l2" }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.differences).toHaveLength(1);
		expect(result.differences[0].classification).toBe("conflict");
		if (result.differences[0].classification === "conflict") {
			expect(result.differences[0].bank).toHaveLength(2);
			expect(result.differences[0].ledger).toHaveLength(2);
		}
	});

	it("excludes conflict movements from the fallback pass (never guessed)", () => {
		// Same reference, same amount, same date, same side — a fallback could
		// match them, but the ambiguity must surface instead of being guessed.
		const bank = [
			bankMovement({ reference: "dup-ref", sourceKey: "b1" }),
			bankMovement({ reference: "dup-ref", sourceKey: "b2" }),
		];
		const ledger = [ledgerMovement({ reference: "dup-ref", sourceKey: "l1" })];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.differences).toHaveLength(1);
		expect(result.differences[0].classification).toBe("conflict");
		expect(result.fullyMatched).toBe(false);
	});

	it("rejects a malformed scope with INVALID_SCOPE", () => {
		const badScope: Scope = { ruc: "123", period: "202607" };
		try {
			reconcile(badScope, [bankMovement()], []);
			expect.unreachable("reconcile should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BankReconciliationError);
			expect((error as BankReconciliationError).code).toBe("INVALID_SCOPE");
		}
	});

	it("never lets cross-RUC rows into a reconcile pass (CROSS_RUC_ACCESS at the normalize boundary)", () => {
		const normalizedBank = normalizeBankRows(SCOPE, [
			bankRow({ sourceKey: "stmt-ok" }),
			bankRow({ ruc: "20555555555", sourceKey: "stmt-cross" }),
		]);
		expect(normalizedBank.rejected).toHaveLength(1);
		expect(normalizedBank.rejected[0]).toMatchObject({
			sourceKey: "stmt-cross",
			code: "CROSS_RUC_ACCESS",
		});
		// Only the in-scope movements reach the matcher.
		const ledger = normalizeLedgerRows(SCOPE, [ledgerRow({ sourceKey: "entry-1" })]);
		const result = reconcile(SCOPE, normalizedBank.movements, ledger.movements);
		expect(result.fullyMatched).toBe(true);
		expect(result.differences).toHaveLength(1);
	});
});

describe("reconcile() — determinism and completeness", () => {
	it("returns no differences and fullyMatched true for empty inputs", () => {
		const result = reconcile(SCOPE, [], []);
		expect(result.scope).toEqual(SCOPE);
		expect(result.differences).toEqual([]);
		expect(result.fullyMatched).toBe(true);
	});

	it("prefers reference matching over fallback matching", () => {
		const bank = [
			bankMovement({ reference: "shared", sourceKey: "b1", amountCents: 100n }),
			bankMovement({ reference: "ba-2", sourceKey: "b2", amountCents: 250n }),
		];
		const ledger = [
			ledgerMovement({ reference: "shared", sourceKey: "l1", amountCents: 100n }),
			ledgerMovement({ reference: "le-2", sourceKey: "l2", amountCents: 250n }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(true);
		expect(result.differences).toHaveLength(2);
		const matched = result.differences.filter(
			(d): d is Extract<typeof d, { classification: "matched" }> =>
				d.classification === "matched",
		);
		expect(matched).toHaveLength(2);
		expect(matched.map((m) => m.bank.sourceKey).sort()).toEqual(["b1", "b2"]);
		expect(matched.map((m) => m.ledger.sourceKey).sort()).toEqual(["l1", "l2"]);
	});

	it("picks fallback candidates deterministically by sourceKey", () => {
		const bank = [
			bankMovement({ reference: "ba-1", sourceKey: "b1" }),
			bankMovement({ reference: "ba-2", sourceKey: "b2" }),
		];
		const ledger = [
			ledgerMovement({ reference: "le-1", sourceKey: "l1" }),
			ledgerMovement({ reference: "le-2", sourceKey: "l2" }),
		];
		const result = reconcile(SCOPE, bank, ledger);
		expect(result.fullyMatched).toBe(true);
		const matched = result.differences.filter(
			(d): d is Extract<typeof d, { classification: "matched" }> =>
				d.classification === "matched",
		);
		expect(matched).toHaveLength(2);
		// b1 must pair with l1 and b2 with l2 (sorted sourceKey order).
		const pairOf = (sourceKey: string) =>
			matched.find((m) => m.bank.sourceKey === sourceKey)?.ledger.sourceKey;
		expect(pairOf("b1")).toBe("l1");
		expect(pairOf("b2")).toBe("l2");
	});

	it("leaves every movement classified exactly once (completeness)", () => {
		const bank = [
			bankMovement({ reference: "shared", sourceKey: "b1", amountCents: 100n }),
			bankMovement({ reference: "ba-2", sourceKey: "b2", amountCents: 250n }),
			bankMovement({ reference: "dup-ref", sourceKey: "b3" }),
			bankMovement({ reference: "dup-ref", sourceKey: "b4" }),
			bankMovement({ reference: "ba-5", sourceKey: "b5", amountCents: 40n }),
		];
		const ledger = [
			ledgerMovement({ reference: "shared", sourceKey: "l1", amountCents: 100n }),
			ledgerMovement({ reference: "le-2", sourceKey: "l2", amountCents: 250n }),
			ledgerMovement({ reference: "dup-ref", sourceKey: "l3" }),
			ledgerMovement({ reference: "le-4", sourceKey: "l4", amountCents: 900n }),
		];
		const result = reconcile(SCOPE, bank, ledger);

		const classifiedCount = result.differences.reduce(
			(sum, d) => sum + movementCount(d),
			0,
		);
		expect(classifiedCount).toBe(bank.length + ledger.length);

		const classifications = result.differences.map((d) => d.classification);
		expect(classifications).toContain("matched");
		expect(classifications).toContain("bankOnly");
		expect(classifications).toContain("ledgerOnly");
		expect(classifications).toContain("conflict");
		// b5 (amount 40) has no ledger counterpart → bankOnly; l4 (amount 900)
		// has no bank counterpart → ledgerOnly.
		const bankOnly = result.differences.find((d) => d.classification === "bankOnly");
		const ledgerOnly = result.differences.find((d) => d.classification === "ledgerOnly");
		expect(bankOnly?.classification).toBe("bankOnly");
		expect(ledgerOnly?.classification).toBe("ledgerOnly");
		expect(result.fullyMatched).toBe(false);
	});
});
