/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Journal authority tests (slice 1C-1): BigInt-cent guard, balance, binding. */

import { describe, expect, it } from "vitest";
import { acceptEvidence } from "../../evidence/index.js";
import type { AcceptedEvidence } from "../../evidence/index.js";
import { validateTenantScope } from "../../tenant-core/index.js";
import { record } from "../journal.js";
import {
	JOURNAL_ERROR,
	JOURNAL_SIDE,
	JOURNAL_STATUS,
	JournalError,
	type JournalErrorCode,
	type JournalLine,
	type JournalRecordInput,
	type JournalSide,
} from "../types.js";

const SCOPE = validateTenantScope({ companyId: "acme", ruc: "20123456789", period: "202607" });
const OTHER_SCOPE = validateTenantScope({ companyId: "zeta", ruc: "20601234567", period: "202607" });
const ITEM = { id: "ev-1", label: "Bank reconciliation", type: "report" };
const PROVENANCE = { channel: "report", source: "erp://reports/2026-07/rec-114", capturedAt: "2026-08-02T10:00:00.000Z", capturedBy: "ledger-import/v1" };

function accept(scope = SCOPE): AcceptedEvidence {
	return acceptEvidence({ scope, items: [ITEM], provenance: PROVENANCE });
}
function line(amount: unknown, side: JournalSide = JOURNAL_SIDE.DEBIT): JournalLine {
	return { accountCode: "1000", side, amountCents: amount } as unknown as JournalLine;
}
function entryInput(overrides: Partial<JournalRecordInput> = {}): JournalRecordInput {
	return {
		id: "JE-1",
		scope: SCOPE,
		lines: [line(500n), line(500n, JOURNAL_SIDE.CREDIT)],
		evidence: [accept()],
		...overrides,
	};
}
function expectRejected(input: JournalRecordInput, code: JournalErrorCode): void {
	let thrown: unknown;
	let result: unknown;
	try {
		result = record(input);
	} catch (error) {
		thrown = error;
	}
	expect(result).toBeUndefined();
	expect(thrown).toBeInstanceOf(JournalError);
	expect((thrown as JournalError).code).toBe(code);
}

describe("record — BigInt cents only (1C-1 RED/GREEN)", () => {
	it("rejects a fractional-cent number (0.01)", () => expectRejected(entryInput({ lines: [line(0.01), line(0.01, JOURNAL_SIDE.CREDIT)] }), JOURNAL_ERROR.INVALID_AMOUNT));
	it("accepts 100n BigInt cents and preserves the amount", () => {
		const entry = record(entryInput({ lines: [line(100n), line(100n, JOURNAL_SIDE.CREDIT)] }));
		expect(entry.lines.map((l) => l.amountCents)).toEqual([100n, 100n]);
	});
	it("records a balanced 500n/500n entry", () => expect(record(entryInput()).status).toBe(JOURNAL_STATUS.RECORDED));
	it("rejects an unbalanced 500n/400n entry with no entry state", () => expectRejected(entryInput({ lines: [line(500n), line(400n, JOURNAL_SIDE.CREDIT)] }), JOURNAL_ERROR.UNBALANCED));
});

describe("record — amount boundaries and multi-line sums (1C-1 TRIANGULATE)", () => {
	it("rejects a negative amount (-1n)", () => expectRejected(entryInput({ lines: [line(-1n), line(-1n, JOURNAL_SIDE.CREDIT)] }), JOURNAL_ERROR.INVALID_AMOUNT));
	it("accepts the non-negative zero boundary (0n)", () => {
		const entry = record(entryInput({ lines: [line(0n), line(0n, JOURNAL_SIDE.CREDIT)] }));
		expect(entry.lines).toHaveLength(2);
	});
	it("rejects decimal-string and integer-string amounts", () => {
		for (const amount of ["1.50", "100"]) {
			expectRejected(entryInput({ lines: [line(amount), line(amount, JOURNAL_SIDE.CREDIT)] }), JOURNAL_ERROR.INVALID_AMOUNT);
		}
	});
	it("sums multi-line debits and credits in BigInt", () => {
		const entry = record(entryInput({ lines: [line(300n), line(100n), line(100n), line(500n, JOURNAL_SIDE.CREDIT)] }));
		expect(entry.lines).toHaveLength(4);
	});
});

describe("record — entry binding (1C-1 RED/GREEN)", () => {
	it("rejects a balanced entry with no bound evidence", () => expectRejected(entryInput({ evidence: [] }), JOURNAL_ERROR.MISSING_EVIDENCE));
	it("rejects evidence bound to a different tenant scope", () => expectRejected(entryInput({ evidence: [accept(OTHER_SCOPE)] }), JOURNAL_ERROR.EVIDENCE_SCOPE_MISMATCH));
	it("rejects an invalid scope", () => expectRejected(entryInput({ scope: { companyId: "acme", ruc: "123", period: "202607" } }), JOURNAL_ERROR.INVALID_SCOPE));
});

describe("record — immutability (1C-1 TRIANGULATE)", () => {
	it("returns a frozen RECORDED entry with frozen lines and scope", () => {
		const entry = record(entryInput());
		expect(Object.isFrozen(entry)).toBe(true);
		expect(Object.isFrozen(entry.lines)).toBe(true);
		expect(entry.lines.every((l) => Object.isFrozen(l))).toBe(true);
		expect(Object.isFrozen(entry.scope)).toBe(true);
		expect(entry.supersedesEntryId).toBeUndefined();
		expect(() => (entry.lines as JournalLine[]).push(line(1n, JOURNAL_SIDE.CREDIT))).toThrow(TypeError);
	});
});
