/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Journal authority operations (slice 1C-1): pure immutable `record`. */

import { JOURNAL_STATUS } from "./types.js";
import type { JournalEntry, JournalRecordInput } from "./types.js";
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
