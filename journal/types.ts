/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Journal authority domain types (slice 1C-2): sides, statuses, lines, entries, receipt issuer. */

import type { AcceptedEvidence } from "../evidence/index.js";
import type { ValidatedTenantScope } from "../tenant-core/index.js";
import type { SignedReceipt } from "../receipts/index.js";
export type { SignedReceipt } from "../receipts/index.js";

export const JOURNAL_SIDE = { DEBIT: "debit", CREDIT: "credit" } as const;
export type JournalSide = (typeof JOURNAL_SIDE)[keyof typeof JOURNAL_SIDE];
export const JOURNAL_STATUS = {
	RECORDED: "recorded",
	POSTED: "posted",
	SUPERSEDED: "superseded",
	REVOKED: "revoked",
} as const;
export type JournalStatus = (typeof JOURNAL_STATUS)[keyof typeof JOURNAL_STATUS];
export interface JournalLine {
	readonly accountCode: string;
	readonly side: JournalSide;
	readonly amountCents: bigint;
}
export interface JournalEntry {
	readonly id: string;
	readonly scope: ValidatedTenantScope;
	readonly lines: readonly JournalLine[];
	readonly evidence: readonly AcceptedEvidence[];
	readonly status: JournalStatus;
	readonly supersedesEntryId?: string;
}
export interface JournalRecordInput {
	readonly id: string;
	readonly scope: unknown;
	readonly lines: readonly JournalLine[];
	readonly evidence: readonly AcceptedEvidence[];
}
export const JOURNAL_ERROR = {
	INVALID_SCOPE: "invalid-scope",
	INVALID_AMOUNT: "invalid-amount",
	EMPTY_LINES: "empty-lines",
	UNBALANCED: "unbalanced",
	MISSING_EVIDENCE: "missing-evidence",
	EVIDENCE_SCOPE_MISMATCH: "evidence-scope-mismatch",
} as const;
export type JournalErrorCode = (typeof JOURNAL_ERROR)[keyof typeof JOURNAL_ERROR];

export class JournalError extends Error {
	readonly code: JournalErrorCode;

	constructor(code: JournalErrorCode, message: string) {
		super(message);
		this.name = "JournalError";
		this.code = code;
	}
}

export const JOURNAL_ACTION = { POST: "post", SUPERSEDE: "supersede", REVOKE: "revoke" } as const;
export type JournalAction = (typeof JOURNAL_ACTION)[keyof typeof JOURNAL_ACTION];

export interface JournalReceiptContext {
	readonly entryId: string;
	readonly action: JournalAction;
	readonly supersedesEntryId?: string;
}

export interface JournalReceiptIssuer {
	issue(context: JournalReceiptContext): SignedReceipt;
}

export interface JournalPostResult {
	readonly entry: JournalEntry;
	readonly receipt: SignedReceipt;
}

export interface JournalSupersedeResult {
	readonly prior: JournalEntry;
	readonly entry: JournalEntry;
	readonly receipt: SignedReceipt;
}

export interface JournalRevokeResult {
	readonly entry: JournalEntry;
	readonly receipt: SignedReceipt;
}
