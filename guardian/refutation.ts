/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Finding-scoped refutation dual review — pure, read-only Guardian lens (SDD-090).
 *
 * A challenge binds the WHOLE GuardianFinding produced by the same review's
 * findings array; exactly two independent reviewers each return a closed verdict
 * (uphold | refute | downgrade); consistency is pure equality over that
 * vocabulary. Outcomes are advisory only: they never alter the Guardian report's
 * verdict (always "none"), never approve or reject a candidate, and never read
 * the clock. Expected domain failures return closed typed denials and never
 * throw (SC-GU-028).
 */

import type {
	GuardianCategory,
	GuardianFinding,
	GuardianReport,
	GuardianSeverity,
} from "./guardian.js";

/** Closed verdict vocabulary for a single reviewer judgment. */
export type RefutationVerdict = "uphold" | "refute" | "downgrade";

/** Closed vocabulary of refutation denials (spec REQ-GU-011). */
export type RefutationDenialCode =
	| "malformed-challenge"
	| "unknown-finding"
	| "invalid-verdict"
	| "invalid-independence"
	| "downgrade-without-target"
	| "candidate-changed";

/** A challenge binding a whole finding from the same review's findings array. */
export interface RefutationChallenge {
	readonly finding: GuardianFinding;
	readonly challengerId: string;
	readonly reason: string;
	/** Strictly lower than the finding's severity; required for downgrade. */
	readonly severityOverride?: GuardianSeverity;
	readonly categoryOverride?: GuardianCategory;
	/** Asserted review identity; mismatch denies with candidate-changed. */
	readonly candidateHash?: string;
}

/** One reviewer judgment; reviewerId must differ from the other reviewer and the challenger. */
export interface RefutationReview {
	readonly reviewerId: string;
	readonly verdict: RefutationVerdict;
	readonly reason?: string;
}

/** Fail-closed result of binding a challenge to a review. */
export type RefutationChallengeResult =
	| { readonly state: "accepted" }
	| {
			readonly state: "denied";
			readonly code: RefutationDenialCode;
			readonly cause: string;
			readonly continuation: string;
	  };

/** Fail-closed dual-review outcome: consistent, inconsistent (advisory), or denied. */
export type RefutationDualReviewResult =
	| {
			readonly state: "consistent";
			readonly verdict: RefutationVerdict;
			readonly loweredSeverity?: GuardianSeverity;
	  }
	| { readonly state: "inconsistent"; readonly escalation: "required" }
	| {
			readonly state: "denied";
			readonly code: RefutationDenialCode;
			readonly cause: string;
			readonly continuation: string;
	  };

const REFUTATION_VERDICTS: readonly RefutationVerdict[] = Object.freeze([
	"uphold",
	"refute",
	"downgrade",
]);

/** Internal denied-shape shared by challenge and dual-review results. */
type RefutationDenialShape = {
	readonly state: "denied";
	readonly code: RefutationDenialCode;
	readonly cause: string;
	readonly continuation: string;
};

/** Severity order — blocker > concern > info; single source of truth. */
const SEVERITY_RANK: Readonly<Record<GuardianSeverity, number>> = Object.freeze({
	blocker: 0,
	concern: 1,
	info: 2,
});

/** Runtime object guard for untrusted inputs (never throws). */
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Closed-set verdict guard for untrusted reviewer judgments. */
function isRefutationVerdict(value: unknown): value is RefutationVerdict {
	return (
		typeof value === "string" &&
		(REFUTATION_VERDICTS as readonly string[]).includes(value)
	);
}

/** Strictly lower severity: the override must be less severe than the finding's. */
function isStrictlyLowerSeverity(
	override: GuardianSeverity | undefined,
	current: GuardianSeverity,
): boolean {
	if (override === undefined) return false;
	return SEVERITY_RANK[override] > SEVERITY_RANK[current];
}

/** Frozen closed denial — code, stable machine-readable cause, actionable continuation. */
function denial(
	code: RefutationDenialCode,
	cause: string,
	continuation: string,
): RefutationDenialShape {
	return Object.freeze({ state: "denied", code, cause, continuation });
}

/** Challenge validation shared by binding and dual evaluation (first failure wins). */
function validateChallenge(
	report: GuardianReport,
	challenge: RefutationChallenge,
): RefutationChallengeResult {
	if (!isRecord(challenge)) {
		return denial(
			"malformed-challenge",
			"challenge is not an object",
			"provide a challenge object",
		);
	}
	if (!isRecord(challenge.finding)) {
		return denial(
			"malformed-challenge",
			"challenge.finding is missing or not a finding",
			"bind the whole GuardianFinding from the same review",
		);
	}
	if (typeof challenge.challengerId !== "string" || challenge.challengerId.trim() === "") {
		return denial(
			"malformed-challenge",
			"challenge.challengerId is missing or empty",
			"provide a non-empty challengerId",
		);
	}
	if (typeof challenge.reason !== "string" || challenge.reason.trim() === "") {
		return denial(
			"malformed-challenge",
			"challenge.reason is missing or empty",
			"provide a non-empty reason",
		);
	}
	if (!Array.isArray(report.findings) || !report.findings.includes(challenge.finding)) {
		return denial(
			"unknown-finding",
			"challenge.finding is not an element of report.findings",
			"bind a finding from the same review's findings array",
		);
	}
	if (
		challenge.candidateHash !== undefined &&
		challenge.candidateHash !== report.candidateHash
	) {
		return denial(
			"candidate-changed",
			"challenge.candidateHash does not match report.candidateHash",
			"scope the challenge to the current review's candidateHash",
		);
	}
	return Object.freeze({ state: "accepted" });
}

/**
 * Bind a challenge to a review: validate shape, same-review membership, and
 * asserted candidate identity. Advisory only — binds, never decides.
 */
export function challengeRefutation(
	report: GuardianReport,
	challenge: RefutationChallenge,
): RefutationChallengeResult {
	return validateChallenge(report, challenge);
}

/**
 * Evaluate a dual review: validate challenge, verdicts, independence, and the
 * downgrade target, then decide consistency as pure verdict equality. Advisory
 * only — a consistent verdict concerns a finding, never a candidate.
 */
export function evaluateDualReview(
	report: GuardianReport,
	challenge: RefutationChallenge,
	reviewA: RefutationReview,
	reviewB: RefutationReview,
): RefutationDualReviewResult {
	const bound = validateChallenge(report, challenge);
	if (bound.state === "denied") return bound;

	// Exactly two review objects, each carrying a reviewerId (count/shape guard).
	if (!isRecord(reviewA) || !isRecord(reviewB)) {
		return denial(
			"invalid-independence",
			"exactly two review objects are required",
			"provide exactly two reviews, one per reviewer",
		);
	}
	if (
		typeof reviewA.reviewerId !== "string" ||
		reviewA.reviewerId.trim() === "" ||
		typeof reviewB.reviewerId !== "string" ||
		reviewB.reviewerId.trim() === ""
	) {
		return denial(
			"invalid-independence",
			"each review must carry a non-empty reviewerId",
			"provide a reviewerId for every review",
		);
	}

	// Verdicts must belong to the closed set before anything else is judged.
	if (!isRefutationVerdict(reviewA.verdict) || !isRefutationVerdict(reviewB.verdict)) {
		return denial(
			"invalid-verdict",
			"review verdict must be one of uphold, refute, or downgrade",
			"use a verdict from the closed set uphold|refute|downgrade",
		);
	}

	// Independence: distinct reviewerIds, neither equal to the challenger.
	if (reviewA.reviewerId === reviewB.reviewerId) {
		return denial(
			"invalid-independence",
			"the two reviewerIds must be distinct",
			"provide two distinct reviewers",
		);
	}
	if (
		reviewA.reviewerId === challenge.challengerId ||
		reviewB.reviewerId === challenge.challengerId
	) {
		return denial(
			"invalid-independence",
			"a reviewer must not be the challenger",
			"reviewers must be distinct from the challenger",
		);
	}

	// A downgrade verdict demands a strictly-lower severityOverride on the challenge.
	if (
		(reviewA.verdict === "downgrade" || reviewB.verdict === "downgrade") &&
		!isStrictlyLowerSeverity(challenge.severityOverride, challenge.finding.severity)
	) {
		return denial(
			"downgrade-without-target",
			"downgrade requires a severityOverride strictly lower than the finding's severity",
			"add a strictly-lower severityOverride (blocker > concern > info)",
		);
	}

	// Consistency is pure equality over the closed verdict vocabulary.
	if (reviewA.verdict === reviewB.verdict) {
		if (reviewA.verdict === "downgrade") {
			return Object.freeze({
				state: "consistent",
				verdict: "downgrade",
				loweredSeverity: challenge.severityOverride,
			});
		}
		return Object.freeze({ state: "consistent", verdict: reviewA.verdict });
	}
	return Object.freeze({ state: "inconsistent", escalation: "required" });
}
