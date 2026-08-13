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
import { post, record, revoke, supersede } from "../journal.js";
import {
	JOURNAL_ACTION,
	JOURNAL_ERROR,
	JOURNAL_SIDE,
	JOURNAL_STATUS,
	JournalError,
	type JournalErrorCode,
	type JournalLine,
	type JournalReceiptContext,
	type JournalReceiptIssuer,
	type JournalRecordInput,
	type JournalSide,
	type SignedReceipt,
} from "../types.js";
import { GENESIS_EMPTY_HASH, HASH_ONLY_SIGNER, validateLedger, type HashOnlyEntry, type LedgerEntry, type LedgerManifest, type SignedEntry } from "../../ledger/index.js";
import { ReceiptType } from "../../receipts/index.js";

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

    /** Deterministic fake receipt: stable 64-hex hashes, fixed signer material. */
    const FAKE_RECEIPT: SignedReceipt = {
    	protocolVersion: "1.0",
    	receiptType: ReceiptType.APPROVAL,
    	algorithm: "Ed25519",
    	content: { missionId: "journal", companyId: "acme", actorId: "journal-actor", decision: "APPROVE", proposalVersion: 1, evidenceHash: "b".repeat(64), previousStatus: "recorded", newStatus: "posted", payloadHash: "c".repeat(64), timestamp: "2026-08-02T00:00:00.000Z" },
    	receiptHash: "d".repeat(64),
    	signerKeyId: "key_journal_test",
    	signerPublicKey: "MCowBQYDK2VwAyEA",
    	signature: "c2lnbmF0dXJl",
    	issuedAt: "2026-08-02T00:00:00.000Z",
    };

    /** Deterministic fake JournalReceiptIssuer; `fail` forces issuance to throw. */
    function fakeIssuer(fail = false): { issuer: JournalReceiptIssuer; issued: JournalReceiptContext[] } {
    	const issued: JournalReceiptContext[] = [];
    	return {
    		issued,
    		issuer: {
    			issue: (context) => {
    				issued.push(context);
    				if (fail) throw new Error("receipt issuance failed");
    				return FAKE_RECEIPT;
    			},
    		},
    	};
    }

    /** Deep snapshot that survives BigInt cents (JSON.stringify alone throws). */
    function snapshot(value: unknown): string {
    	return JSON.stringify(value, (_key: string, v: unknown) => (typeof v === "bigint" ? `${v}n` : v));
    }

    const MANIFEST: LedgerManifest = { ledgerId: "ledger_journal_test", protocolVersion: "1.0", hashAlgorithm: "SHA-256", trustRoot: { keyIds: ["key_journal_test"] }, jurisdiction: "PE", createdAt: "2026-08-02T00:00:00.000Z", signingPolicy: { required: true, algorithm: "Ed25519", keyIds: ["key_journal_test"] } };

    function genesisEntry(): HashOnlyEntry {
    	return { entryId: "genesis-1", ledgerId: MANIFEST.ledgerId, sequence: 1, entryType: "GENESIS", previousEntryHash: GENESIS_EMPTY_HASH, payloadHash: "f".repeat(64), receiptHash: GENESIS_EMPTY_HASH, occurredAt: "2026-08-02T00:00:00.000Z", recordedAt: "2026-08-02T00:00:00.000Z", actor: "system", schemaVersion: "1.0", signerKeyId: HASH_ONLY_SIGNER };
    }

    describe("post — signed receipt and atomicity (1C-2 RED/GREEN)", () => {
    	it("issues a signed receipt and returns a POSTED snapshot", () => {
    		const { issuer, issued } = fakeIssuer();
    		const result = post(record(entryInput({ id: "JE-1" })), issuer);
    		expect(issued).toHaveLength(1);
    		expect(issued[0].action).toBe(JOURNAL_ACTION.POST);
    		expect(result.entry.status).toBe(JOURNAL_STATUS.POSTED);
    		expect(result.entry.id).toBe("JE-1");
    		expect(Object.isFrozen(result.entry)).toBe(true);
    		expect(result.receipt.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    	});
    	it("fails the transition and leaves state unchanged when receipt issuance fails", () => {
    		const { issuer } = fakeIssuer(true);
    		const entry = record(entryInput({ id: "JE-1" }));
    		expect(() => post(entry, issuer)).toThrow("receipt issuance failed");
    		expect(entry.status).toBe(JOURNAL_STATUS.RECORDED);
    		expect(entry.lines[0].amountCents).toBe(500n);
    	});
    });

    describe("supersede — balanced successor, unchanged prior (1C-2 RED/GREEN)", () => {
    	it("creates E2 linked to E1, leaves E1 unchanged, and produces a signed receipt", () => {
    		const { issuer, issued } = fakeIssuer();
    		const e1 = record(entryInput({ id: "JE-1" }));
    		const result = supersede(e1, entryInput({ id: "JE-2" }), issuer);
    		expect(result.prior).toBe(e1);
    		expect(e1.status).toBe(JOURNAL_STATUS.RECORDED);
    		expect(result.entry.id).toBe("JE-2");
    		expect(result.entry.supersedesEntryId).toBe("JE-1");
    		expect(result.entry.status).toBe(JOURNAL_STATUS.POSTED);
    		expect(result.receipt.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    		expect(issued[0].action).toBe(JOURNAL_ACTION.SUPERSEDE);
    	});
    	it("rejects an unbalanced successor with no receipt issued (1C-2 TRIANGULATE)", () => {
    		const { issuer, issued } = fakeIssuer();
    		const e1 = record(entryInput({ id: "JE-1" }));
    		expect(() => supersede(e1, entryInput({ id: "JE-2", lines: [line(700n), line(500n, JOURNAL_SIDE.CREDIT)] }), issuer)).toThrow(JournalError);
    		expect(issued).toHaveLength(0);
    	});
    });

    describe("supersede/revoke — append-only semantics (1C-2 TRIANGULATE)", () => {
    	it("never mutates prior lines or status of historical entries", () => {
    		const { issuer } = fakeIssuer();
    		const e1 = record(entryInput({ id: "JE-1" }));
    		const before = snapshot(e1);
    		supersede(e1, entryInput({ id: "JE-2" }), issuer);
    		revoke(e1, issuer);
    		expect(snapshot(e1)).toBe(before);
    		expect(e1.status).toBe(JOURNAL_STATUS.RECORDED);
    		expect(Object.isFrozen(e1)).toBe(true);
    	});
    });

    describe("revoke — explicit reversal entry (1C-2 RED/GREEN)", () => {
    	it("creates a balanced reversal entry with a signed receipt and never edits historical lines", () => {
    		const { issuer, issued } = fakeIssuer();
    		const e1 = post(record(entryInput({ id: "JE-1" })), fakeIssuer().issuer).entry;
    		const result = revoke(e1, issuer);
    		expect(issued[0].action).toBe(JOURNAL_ACTION.REVOKE);
    		expect(result.entry.id).toBe("revoke:JE-1");
    		expect(result.entry.supersedesEntryId).toBe("JE-1");
    		expect(result.entry.status).toBe(JOURNAL_STATUS.REVOKED);
    		expect(result.entry.lines.map((l) => l.side)).toEqual([JOURNAL_SIDE.CREDIT, JOURNAL_SIDE.DEBIT]);
    		expect(result.entry.lines.map((l) => l.amountCents)).toEqual([500n, 500n]);
    		expect(result.receipt.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    		expect(e1.status).toBe(JOURNAL_STATUS.POSTED);
    		expect(e1.lines[0].side).toBe(JOURNAL_SIDE.DEBIT);
    	});
    });

    describe("status independence — journal vs fiscal axes (1C-2 RED/GREEN)", () => {
    	it("transitions journal status while a held fiscal-workflow snapshot stays constant", () => {
    		const fiscalSnapshot = { fiscalStatus: "submitted", cdrStage: "awaiting-approval" };
    		const { issuer } = fakeIssuer();
    		const entry = record(entryInput({ id: "JE-1" }));
    		const before = snapshot(fiscalSnapshot);
    		post(entry, issuer);
    		supersede(entry, entryInput({ id: "JE-2" }), issuer); revoke(entry, issuer);
    		expect(snapshot(fiscalSnapshot)).toBe(before);
    	});
    	it("keeps the journal snapshot constant while the fiscal-workflow snapshot changes", () => {
    		const { issuer } = fakeIssuer();
    		const posted = post(record(entryInput({ id: "JE-1" })), issuer).entry;
    		const before = snapshot(posted);
    		const fiscalSnapshot = { fiscalStatus: "submitted" };
    		fiscalSnapshot.fiscalStatus = "approved";
    		expect(snapshot(posted)).toBe(before);
    	});
    });

    describe("audit-only boundary — ledger records receipts, rejects entries (1C-2 RED/GREEN)", () => {
    	it("records a receipt-shaped entry carrying a journal SignedReceipt hash", () => {
    		const { issuer } = fakeIssuer();
    		const { receipt } = supersede(record(entryInput({ id: "JE-1" })), entryInput({ id: "JE-2" }), issuer);
    		const recorded: SignedEntry = { entryId: "rec-1", ledgerId: MANIFEST.ledgerId, sequence: 2, entryType: "RECEIPT_RECORDED", previousEntryHash: genesisEntry().payloadHash, payloadHash: "e".repeat(64), receiptHash: receipt.receiptHash, occurredAt: "2026-08-02T00:00:00.000Z", recordedAt: "2026-08-02T00:00:00.000Z", actor: "journal", schemaVersion: "1.0", signerKeyId: "key_journal_test", signature: "c2lnbmF0dXJl", signerPublicKey: "MCowBQYDK2VwAyEA" };
    		expect(validateLedger(MANIFEST, [genesisEntry(), recorded]).valid).toBe(true);
    	});
    	it("rejects an entry-shaped payload — a JournalEntry is not a LedgerEntry", () => {
    		const entry = record(entryInput({ id: "JE-1" }));
    		const result = validateLedger(MANIFEST, [genesisEntry(), entry as unknown as LedgerEntry]);
    		expect(result.valid).toBe(false);
    		expect(result.reasons.length).toBeGreaterThan(0);
    	});
    });
