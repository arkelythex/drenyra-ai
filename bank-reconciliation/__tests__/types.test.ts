/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Canonical bank-reconciliation types — the movement shape, the sealed
 * difference classification, the RUC/period scope guard, and the typed error
 * model.
 *
 * Compile-time contract checks live at module scope so `bun run typecheck`
 * enforces them; runtime behavior is asserted in the `describe` blocks below.
 */

import { describe, expect, it } from "vitest";
import {
	BankReconciliationError,
	type ConflictDifference,
	type Difference,
	type Movement,
	type MovementSource,
	type Scope,
	validateScope,
} from "../types.js";

// Compile-time contract checks (enforced by `bun run typecheck`):
// A Movement amount is bigint cents — a Number amount is a type error.
const _numberAmountRejected: Movement = {
	date: "2026-07-15",
	reference: "ref-1",
	// @ts-expect-error — monetary amounts are bigint cents, never Numbers
	amountCents: 100,
	side: "inflow",
	source: "bank",
	sourceKey: "b1",
};
void _numberAmountRejected;
// A Movement side is inflow | outflow — anything else is a type error.
const _unknownSideRejected: Movement = {
	date: "2026-07-15",
	reference: "ref-1",
	amountCents: 100n,
	// @ts-expect-error — side must be "inflow" | "outflow"
	side: "sideways",
	source: "bank",
	sourceKey: "b1",
};
void _unknownSideRejected;
// A Movement source is bank | ledger — anything else is a type error.
const _unknownSourceRejected: Movement = {
	date: "2026-07-15",
	reference: "ref-1",
	amountCents: 100n,
	side: "inflow",
	// @ts-expect-error — source must be "bank" | "ledger"
	source: "erp",
	sourceKey: "b1",
};
void _unknownSourceRejected;
// The difference classification is sealed — an invented label is a type error.
const _unknownClassificationRejected: Difference = {
	// @ts-expect-error — classification is matched | bankOnly | ledgerOnly | conflict
	classification: "guessed",
};
void _unknownClassificationRejected;

describe("Movement canonical shape", () => {
	it("carries date, normalized reference, bigint cents, side, source, and sourceKey", () => {
		const movement: Movement = {
			date: "2026-07-15",
			reference: "recibo-001",
			amountCents: 250n,
			side: "inflow",
			source: "bank",
			sourceKey: "stmt-202607-0001",
		};
		expect(movement.date).toBe("2026-07-15");
		expect(movement.reference).toBe("recibo-001");
		expect(movement.amountCents).toBe(250n);
		expect(movement.side).toBe("inflow");
		expect(movement.source).toBe("bank");
		expect(movement.sourceKey).toBe("stmt-202607-0001");
		expect(typeof movement.amountCents).toBe("bigint");
	});
});

describe("Difference classification (sealed)", () => {
	it("classifies every movement via the matched | bankOnly | ledgerOnly | conflict discriminant", () => {
		const movement = (source: MovementSource, sourceKey: string): Movement => ({
			date: "2026-07-15",
			reference: "r-1",
			amountCents: 100n,
			side: "inflow",
			source,
			sourceKey,
		});
		const matched: Difference = {
			classification: "matched",
			bank: movement("bank", "b1"),
			ledger: movement("ledger", "l1"),
		};
		const bankOnly: Difference = {
			classification: "bankOnly",
			bank: movement("bank", "b2"),
		};
		const ledgerOnly: Difference = {
			classification: "ledgerOnly",
			ledger: movement("ledger", "l2"),
		};
		const conflict: ConflictDifference = {
			classification: "conflict",
			reference: "dup-ref",
			bank: [movement("bank", "b3"), movement("bank", "b4")],
			ledger: [movement("ledger", "l3")],
		};

		expect(matched.classification).toBe("matched");
		expect(bankOnly.classification).toBe("bankOnly");
		expect(ledgerOnly.classification).toBe("ledgerOnly");
		expect(conflict.classification).toBe("conflict");
		expect(conflict.reference).toBe("dup-ref");
		expect(conflict.bank).toHaveLength(2);
		expect(conflict.ledger).toHaveLength(1);
	});
});

describe("validateScope()", () => {
	it("accepts an 11-digit RUC with a YYYYMM period", () => {
		const valid: Scope = { ruc: "20123456789", period: "202607" };
		expect(() => validateScope(valid)).not.toThrow();
	});

	it("rejects a non-11-digit RUC with INVALID_SCOPE", () => {
		expectInvalidScope({ ruc: "123", period: "202607" });
		expectInvalidScope({ ruc: "201234567891", period: "202607" });
		expectInvalidScope({ ruc: "2012345678a", period: "202607" });
	});

	it("rejects a non-YYYYMM period with INVALID_SCOPE", () => {
		expectInvalidScope({ ruc: "20123456789", period: "2026" });
		expectInvalidScope({ ruc: "20123456789", period: "20260715" });
		expectInvalidScope({ ruc: "20123456789", period: "202600" });
		expectInvalidScope({ ruc: "20123456789", period: "202613" });
	});
});

describe("BankReconciliationError", () => {
	it("carries a typed error code", () => {
		const error = new BankReconciliationError("invalid scope", "INVALID_SCOPE");
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("BankReconciliationError");
		expect(error.message).toBe("invalid scope");
		expect(error.code).toBe("INVALID_SCOPE");
	});
});

function expectInvalidScope(scope: Scope): void {
	try {
		validateScope(scope);
		expect.unreachable(`validateScope should reject ${JSON.stringify(scope)}`);
	} catch (error) {
		expect(error).toBeInstanceOf(BankReconciliationError);
		expect((error as BankReconciliationError).code).toBe("INVALID_SCOPE");
	}
}
