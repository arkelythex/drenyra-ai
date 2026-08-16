/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Normalization unit tests — canonical movement acceptance, deterministic side
 * mapping, reference folding, and fail-closed typed rejection of every
 * malformed row (never skipped, never partially accepted).
 */

import { describe, expect, it } from "vitest";
import {
	normalizeBankRows,
	normalizeLedgerRows,
	normalizeReference,
} from "../normalize.js";
import { BankReconciliationError, type BankRow, type LedgerRow, type Scope } from "../types.js";

const SCOPE: Scope = { ruc: "20123456789", period: "202607" };

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

describe("normalizeReference()", () => {
	it("trims, collapses internal whitespace, and case-folds", () => {
		expect(normalizeReference("  Recibo   No 001  ")).toBe("recibo no 001");
		expect(normalizeReference("FACTURA-ABC")).toBe("factura-abc");
	});
});

describe("normalizeBankRows()", () => {
	it("normalizes a deposit to inflow and a withdrawal to outflow", () => {
		const result = normalizeBankRows(SCOPE, [
			bankRow({ reference: " DEPOSITO  001 ", amount: "250.00", side: "deposit", sourceKey: "stmt-1" }),
			bankRow({ reference: "Retiro-002", amount: "80", side: "withdrawal", sourceKey: "stmt-2" }),
		]);
		expect(result.rejected).toEqual([]);
		expect(result.movements).toHaveLength(2);
		expect(result.movements[0]).toEqual({
			date: "2026-07-15",
			reference: "deposito 001",
			amountCents: 250n,
			side: "inflow",
			source: "bank",
			sourceKey: "stmt-1",
		});
		expect(result.movements[1]).toEqual({
			date: "2026-07-15",
			reference: "retiro-002",
			amountCents: 80n,
			side: "outflow",
			source: "bank",
			sourceKey: "stmt-2",
		});
	});

	it("parses decimal-cent strings into integer bigint cents", () => {
		const result = normalizeBankRows(SCOPE, [
			bankRow({ amount: "250", sourceKey: "stmt-whole" }),
			bankRow({ amount: "250.00", sourceKey: "stmt-decimal" }),
		]);
		expect(result.rejected).toEqual([]);
		expect(result.movements.map((m) => m.amountCents)).toEqual([250n, 250n]);
	});
});

describe("normalizeLedgerRows()", () => {
	it("maps a ledger debit to inflow and a ledger credit to outflow", () => {
		const result = normalizeLedgerRows(SCOPE, [
			ledgerRow({ side: "debit", sourceKey: "entry-1" }),
			ledgerRow({ side: "credit", amount: "80", sourceKey: "entry-2" }),
		]);
		expect(result.rejected).toEqual([]);
		expect(result.movements.map((m) => [m.side, m.amountCents])).toEqual([
			["inflow", 250n],
			["outflow", 80n],
		]);
	});

	it("produces a canonical shape indistinguishable from a bank movement", () => {
		const bank = normalizeBankRows(SCOPE, [bankRow({ sourceKey: "stmt-1" })]);
		const ledger = normalizeLedgerRows(SCOPE, [ledgerRow({ sourceKey: "entry-1" })]);
		expect(bank.movements[0]).toEqual({
			date: "2026-07-15",
			reference: "b-001",
			amountCents: 250n,
			side: "inflow",
			source: "bank",
			sourceKey: "stmt-1",
		});
		expect(ledger.movements[0]).toEqual({
			date: "2026-07-15",
			reference: "l-001",
			amountCents: 250n,
			side: "inflow",
			source: "ledger",
			sourceKey: "entry-1",
		});
		const bankFields = Object.keys(bank.movements[0]).sort();
		const ledgerFields = Object.keys(ledger.movements[0]).sort();
		expect(ledgerFields).toEqual(bankFields);
	});
});

describe("fail-closed rejection", () => {
	it("rejects a row with a missing date", () => {
		const result = normalizeBankRows(SCOPE, [bankRow({ date: "", sourceKey: "stmt-bad" })]);
		expect(result.movements).toEqual([]);
		expect(result.rejected).toHaveLength(1);
		expect(result.rejected[0]).toMatchObject({
			sourceKey: "stmt-bad",
			code: "NORMALIZATION_REJECTED",
		});
	});

	it("rejects a row with an empty or whitespace-only reference", () => {
		const result = normalizeBankRows(SCOPE, [bankRow({ reference: "   ", sourceKey: "stmt-bad" })]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0].code).toBe("NORMALIZATION_REJECTED");
	});

	it("rejects a non-integer amount string", () => {
		const result = normalizeBankRows(SCOPE, [bankRow({ amount: "abc", sourceKey: "stmt-bad" })]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0].code).toBe("NORMALIZATION_REJECTED");
	});

	it("rejects fractional-cent amounts", () => {
		const frac1 = normalizeBankRows(SCOPE, [bankRow({ amount: "250.5", sourceKey: "stmt-frac1" })]);
		const frac2 = normalizeBankRows(SCOPE, [bankRow({ amount: "250.50", sourceKey: "stmt-frac2" })]);
		const frac3 = normalizeBankRows(SCOPE, [bankRow({ amount: "999.99", sourceKey: "stmt-frac3" })]);
		const frac4 = normalizeBankRows(SCOPE, [bankRow({ amount: "0.01", sourceKey: "stmt-frac4" })]);
		expect(frac1.movements).toEqual([]);
		expect(frac1.rejected[0].code).toBe("FRACTIONAL_CENTS");
		expect(frac2.rejected[0].code).toBe("FRACTIONAL_CENTS");
		expect(frac3.rejected[0].code).toBe("FRACTIONAL_CENTS");
		expect(frac4.rejected[0].code).toBe("FRACTIONAL_CENTS");
	});

	it("rejects a negative amount", () => {
		const result = normalizeBankRows(SCOPE, [bankRow({ amount: "-250", sourceKey: "stmt-neg" })]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0].code).toBe("NEGATIVE_AMOUNT");
	});

	it("rejects a zero amount (amounts must be positive)", () => {
		const result = normalizeBankRows(SCOPE, [bankRow({ amount: "0", sourceKey: "stmt-zero" })]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0].code).toBe("NORMALIZATION_REJECTED");
	});

	it("rejects an unknown side token", () => {
		const row = { ...bankRow({ sourceKey: "stmt-side" }), side: "transfer" } as unknown as BankRow;
		const result = normalizeBankRows(SCOPE, [row]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0].code).toBe("NORMALIZATION_REJECTED");
	});

	it("rejects a row carrying a foreign RUC (CROSS_RUC_ACCESS)", () => {
		const result = normalizeLedgerRows(SCOPE, [
			ledgerRow({ ruc: "20555555555", sourceKey: "entry-cross" }),
		]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0]).toMatchObject({
			sourceKey: "entry-cross",
			code: "CROSS_RUC_ACCESS",
		});
	});

	it("rejects an impossible calendar date", () => {
		const result = normalizeBankRows(SCOPE, [bankRow({ date: "2026-02-30", sourceKey: "stmt-date" })]);
		expect(result.movements).toEqual([]);
		expect(result.rejected[0].code).toBe("NORMALIZATION_REJECTED");
	});

	it("rejects a duplicate sourceKey within the same source set", () => {
		const result = normalizeBankRows(SCOPE, [
			bankRow({ sourceKey: "stmt-dup" }),
			bankRow({ reference: "B-002", sourceKey: "stmt-dup" }),
		]);
		expect(result.movements).toHaveLength(1);
		expect(result.movements[0].sourceKey).toBe("stmt-dup");
		expect(result.rejected).toHaveLength(1);
		expect(result.rejected[0]).toMatchObject({
			sourceKey: "stmt-dup",
			code: "NORMALIZATION_REJECTED",
		});
	});

	it("never partially accepts a malformed batch: valid rows pass, malformed rows reject", () => {
		const result = normalizeBankRows(SCOPE, [
			bankRow({ sourceKey: "stmt-ok" }),
			bankRow({ amount: "12.34", sourceKey: "stmt-frac" }),
			bankRow({ ruc: "20555555555", sourceKey: "stmt-cross" }),
		]);
		expect(result.movements).toHaveLength(1);
		expect(result.movements[0].sourceKey).toBe("stmt-ok");
		expect(result.rejected).toHaveLength(2);
		expect(result.rejected.map((r) => r.code).sort()).toEqual([
			"CROSS_RUC_ACCESS",
			"FRACTIONAL_CENTS",
		]);
	});

	it("throws INVALID_SCOPE when the operation scope is malformed", () => {
		const badScope: Scope = { ruc: "123", period: "202607" };
		try {
			normalizeBankRows(badScope, [bankRow()]);
			expect.unreachable("normalizeBankRows should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BankReconciliationError);
			expect((error as BankReconciliationError).code).toBe("INVALID_SCOPE");
		}
	});
});
