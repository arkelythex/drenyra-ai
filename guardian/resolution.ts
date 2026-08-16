/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Findings resolution — one-way, advisory Guardian lens (SDD-090).
 *
 * A finding under a review identity begins open and a single valid resolution
 * record transitions it to resolved or dismissed. The library holds no lifecycle
 * state: the caller passes the finding's current disposition (undefined = open).
 * There is no reopen, no revocation, and no carry-over across candidates.
 * Outcomes are advisory only: they never alter the Guardian report's verdict
 * (always "none") and never read the clock — referenceTime is caller-supplied.
 * Expected domain failures return closed typed denials and never throw
 * (SC-GU-028).
 */

import type { GuardianFinding, GuardianReport } from "./guardian.js";

/** Terminal advisory disposition of a resolved finding. */
export type ResolutionDisposition = "resolved" | "dismissed";

/** Closed vocabulary of resolution denials (spec REQ-GU-011). */
export type ResolutionDenialCode =
	| "unknown-finding"
	| "already-resolved"
	| "already-dismissed"
	| "empty-reason"
	| "missing-actor"
	| "missing-timestamp"
	| "malformed-record"
	| "candidate-changed";

/** A resolution record attempting one transition of a bound finding. */
export interface ResolutionRecord {
	readonly finding: GuardianFinding;
	readonly actorId: string;
	readonly disposition: ResolutionDisposition;
	readonly reason: string;
	readonly evidence?: string;
	/** Caller-supplied; the library reads no clock. */
	readonly referenceTime: string;
	/** Asserted review identity; mismatch denies with candidate-changed. */
	readonly candidateHash?: string;
}

/** Fail-closed resolution result: an applied frozen record or a typed denial. */
export type ResolutionResult =
	| { readonly state: "applied"; readonly record: Readonly<ResolutionRecord> }
	| {
			readonly state: "denied";
			readonly code: ResolutionDenialCode;
			readonly cause: string;
			readonly continuation: string;
	  };

const RESOLUTION_DISPOSITIONS: readonly ResolutionDisposition[] = Object.freeze([
	"resolved",
	"dismissed",
]);

/** Caller-supplied timestamps must be ISO-8601 (no clock reads). */
const ISO_8601 =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** Internal denied-shape for resolution results. */
type ResolutionDenialShape = {
	readonly state: "denied";
	readonly code: ResolutionDenialCode;
	readonly cause: string;
	readonly continuation: string;
};

/** Frozen closed denial — code, stable machine-readable cause, actionable continuation. */
function denial(
	code: ResolutionDenialCode,
	cause: string,
	continuation: string,
): ResolutionDenialShape {
	return Object.freeze({ state: "denied", code, cause, continuation });
}

/** Runtime object guard for untrusted inputs (never throws). */
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Fresh, frozen, source-independent copy of a resolution record. */
function freezeRecord(source: ResolutionRecord): Readonly<ResolutionRecord> {
	return Object.freeze({
		finding: Object.freeze({ ...source.finding }),
		actorId: source.actorId,
		disposition: source.disposition,
		reason: source.reason,
		...(source.evidence !== undefined ? { evidence: source.evidence } : {}),
		referenceTime: source.referenceTime,
		...(source.candidateHash !== undefined
			? { candidateHash: source.candidateHash }
			: {}),
	});
}

/**
 * Attempt exactly one resolution transition: open → resolved | dismissed.
 * Library holds no lifecycle state; `currentDisposition` (undefined = open) is
 * the explicit input. Advisory only — applies a record, never decides.
 */
export function resolveFinding(
	report: GuardianReport,
	record: ResolutionRecord,
	currentDisposition?: ResolutionDisposition,
): ResolutionResult {
	// 1. Record shape (wrong fields or types) — first failure wins.
	if (!isRecord(record)) {
		return denial(
			"malformed-record",
			"record is not an object",
			"provide a resolution record",
		);
	}
	if (!isRecord(record.finding)) {
		return denial(
			"malformed-record",
			"record.finding is missing or not a finding",
			"bind the whole GuardianFinding from the same review",
		);
	}
	if (
		typeof record.disposition !== "string" ||
		!(RESOLUTION_DISPOSITIONS as readonly string[]).includes(record.disposition)
	) {
		return denial(
			"malformed-record",
			"record.disposition must be resolved or dismissed",
			"use a closed-set disposition",
		);
	}
	if (record.evidence !== undefined && typeof record.evidence !== "string") {
		return denial(
			"malformed-record",
			"record.evidence must be a string when present",
			"provide a string evidence reference or omit it",
		);
	}
	if (record.candidateHash !== undefined && typeof record.candidateHash !== "string") {
		return denial(
			"malformed-record",
			"record.candidateHash must be a string when present",
			"provide a string candidateHash or omit it",
		);
	}

	// 2. Same-review membership.
	if (!Array.isArray(report.findings) || !report.findings.includes(record.finding)) {
		return denial(
			"unknown-finding",
			"record.finding is not an element of report.findings",
			"bind a finding from the same review's findings array",
		);
	}

	// 3. Asserted candidate identity.
	if (
		record.candidateHash !== undefined &&
		record.candidateHash !== report.candidateHash
	) {
		return denial(
			"candidate-changed",
			"record.candidateHash does not match report.candidateHash",
			"run a fresh Guardian review for the new candidate",
		);
	}

	// 4. Non-empty reason.
	if (typeof record.reason !== "string" || record.reason.trim() === "") {
		return denial(
			"empty-reason",
			"record.reason is missing or empty",
			"provide a non-empty reason",
		);
	}

	// 5. Non-empty actorId.
	if (typeof record.actorId !== "string" || record.actorId.trim() === "") {
		return denial(
			"missing-actor",
			"record.actorId is missing or empty",
			"provide a non-empty actorId",
		);
	}

	// 6. Caller-supplied ISO-8601 referenceTime (the library reads no clock).
	if (
		typeof record.referenceTime !== "string" ||
		record.referenceTime.trim() === "" ||
		!ISO_8601.test(record.referenceTime)
	) {
		return denial(
			"missing-timestamp",
			"record.referenceTime is missing, empty, or not ISO-8601",
			"provide a caller-supplied ISO-8601 referenceTime",
		);
	}

	// 7. One-way lifecycle: open → resolved | dismissed, exactly once.
	if (currentDisposition === "resolved") {
		return denial(
			"already-resolved",
			"finding is already resolved",
			"findings resolve exactly once; a fresh review is required for further changes",
		);
	}
	if (currentDisposition === "dismissed") {
		return denial(
			"already-dismissed",
			"finding is already dismissed",
			"findings resolve exactly once; a fresh review is required for further changes",
		);
	}
	if (currentDisposition !== undefined) {
		return denial(
			"malformed-record",
			"currentDisposition is not a valid disposition",
			"pass undefined (open), resolved, or dismissed",
		);
	}

	return Object.freeze({ state: "applied", record: freezeRecord(record) });
}
