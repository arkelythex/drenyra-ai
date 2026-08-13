/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Journal authority operations (slice 1C-2): immutable record, post, supersede, revoke. */

import { JOURNAL_ACTION, JOURNAL_SIDE, JOURNAL_STATUS } from "./types.js";
import type { JournalEntry, JournalPostResult, JournalReceiptIssuer, JournalRecordInput, JournalRevokeResult, JournalSupersedeResult } from "./types.js";
import { validateRecord } from "./validate.js";

export function record(input: JournalRecordInput): JournalEntry {
	const scope = Object.freeze(validateRecord(input));
	const lines = Object.freeze(
		input.lines.map((line) => Object.freeze({ ...line })),
	);
	return Object.freeze({
		id: input.id,
		scope,
		lines,
		evidence: Object.freeze([...input.evidence]),
		status: JOURNAL_STATUS.RECORDED,
	});
}

/** Posts a RECORDED entry: issues the signed receipt first, then returns the POSTED snapshot. */
export function post(entry: JournalEntry, issuer: JournalReceiptIssuer): JournalPostResult {
	const receipt = issuer.issue({ entryId: entry.id, action: JOURNAL_ACTION.POST });
	return { entry: Object.freeze({ ...entry, status: JOURNAL_STATUS.POSTED }), receipt };
}

/** Supersedes E1 with a new balanced entry E2; E1 is never mutated. */
export function supersede(prior: JournalEntry, input: JournalRecordInput, issuer: JournalReceiptIssuer): JournalSupersedeResult {
	const scope = Object.freeze(validateRecord(input));
	const lines = Object.freeze(input.lines.map((line) => Object.freeze({ ...line })));
	const receipt = issuer.issue({ entryId: input.id, action: JOURNAL_ACTION.SUPERSEDE, supersedesEntryId: prior.id });
	const entry: JournalEntry = Object.freeze({ id: input.id, scope, lines, evidence: Object.freeze([...input.evidence]), status: JOURNAL_STATUS.POSTED, supersedesEntryId: prior.id });
	return { prior, entry, receipt };
}

/** Revokes E1 with an explicit reversal entry; historical lines are never edited. */
export function revoke(prior: JournalEntry, issuer: JournalReceiptIssuer): JournalRevokeResult {
	const id = `revoke:${prior.id}`;
	const lines = Object.freeze(prior.lines.map((line) => Object.freeze({ ...line, side: line.side === JOURNAL_SIDE.DEBIT ? JOURNAL_SIDE.CREDIT : JOURNAL_SIDE.DEBIT })));
	const receipt = issuer.issue({ entryId: id, action: JOURNAL_ACTION.REVOKE, supersedesEntryId: prior.id });
	const entry: JournalEntry = Object.freeze({ id, scope: prior.scope, lines, evidence: Object.freeze([...prior.evidence]), status: JOURNAL_STATUS.REVOKED, supersedesEntryId: prior.id });
	return { entry, receipt };
}
