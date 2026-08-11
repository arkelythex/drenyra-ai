/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Guardian Angel — Design 01 responsibilities and Design 03 agent table.
 *
 * The Guardian independently challenges frozen candidates and produces
 * FINDINGS ONLY. It never approves, never rejects, and never mutates the
 * candidate: its output feeds the human/gate decision, it does not replace it.
 */

import type { Candidate, Materiality } from "../candidates/types.js";
import { isValidPeriod, orderOf } from "../candidates/types.js";
import { isValidRucChecksummed } from "../candidates/ruc.js";

/** Severity of a guardian finding. */
export type GuardianSeverity = "blocker" | "concern" | "info";

/** Category of a guardian finding. */
export type GuardianCategory =
	| "scope"
	| "materiality"
	| "approval"
	| "evidence"
	| "integrity";

/** A single adversarial finding. */
export interface GuardianFinding {
	id: string;
	severity: GuardianSeverity;
	category: GuardianCategory;
	description: string;
}

/**
 * Guardian report. `verdict` is always "none": the Guardian never approves or
 * rejects — it only surfaces findings for the professional and gates.
 */
export interface GuardianReport {
	/** Frozen candidate hash the review ran against. */
	candidateHash: string;
	/** Findings, ordered by severity (blocker first). */
	findings: readonly GuardianFinding[];
	/** Always "none" by design. */
	verdict: "none";
	/** ISO timestamp of the review. */
	reviewedAt: string;
}

/** Review options. */
export interface GuardianOptions {
	/** Require dual distinct approval for R3 (Design 02 "two distinct approvers"). */
	r3DualRequired?: boolean;
}

const TIERS = new Set<Materiality>(["R0", "R1", "R2", "R3"]);

let findingSeq = 0;

function finding(
	severity: GuardianSeverity,
	category: GuardianCategory,
	description: string,
): GuardianFinding {
	findingSeq += 1;
	return { id: `guardian-${findingSeq}`, severity, category, description };
}

/**
 * Run the adversarial read-only review over a frozen candidate.
 * Does not mutate the candidate; returns findings only.
 */
export function runGuardianReview(
	candidate: Candidate,
	options: GuardianOptions = {},
): GuardianReport {
	const findings: GuardianFinding[] = [];
	const { r3DualRequired = true } = options;

	// Scope integrity — the candidate's fiscal scope must be valid (checksummed RUC).
	if (!isValidRucChecksummed(candidate.scope.ruc)) {
		findings.push(
			finding(
				"blocker",
				"scope",
				`invalid RUC "${candidate.scope.ruc}" in candidate scope`,
			),
		);
	}
	if (!isValidPeriod(candidate.scope.period)) {
		findings.push(
			finding(
				"blocker",
				"scope",
				`invalid fiscal period "${candidate.scope.period}" (expected YYYYMM)`,
			),
		);
	}

	// Identity integrity — a frozen candidate must carry a non-empty subject hash.
	if (!candidate.subjectHash || candidate.subjectHash.length < 32) {
		findings.push(
			finding(
				"blocker",
				"integrity",
				"candidate subject hash is missing or implausibly short",
			),
		);
	}

	// Materiality integrity — the tier must be a declared tier.
	if (!TIERS.has(candidate.materiality)) {
		findings.push(
			finding(
				"blocker",
				"materiality",
				`unknown materiality tier "${candidate.materiality}"`,
			),
		);
	}

	// Approval sufficiency — R3 demands dual distinct approval when required.
	if (r3DualRequired && orderOf(candidate.materiality) >= 3) {
		const approvers = candidate.reviews.filter(
			(review) => review.verdict === "accept",
		);
		if (approvers.length < 2) {
			findings.push(
				finding(
					"blocker",
					"approval",
					`R3 candidate has ${approvers.length} acceptance(s); dual distinct approval required`,
				),
			);
		} else {
			const reviewerIds = new Set(approvers.map((review) => review.reviewer));
			if (reviewerIds.size < 2) {
				findings.push(
					finding(
						"blocker",
						"approval",
						"R3 candidate approved by a single reviewer identity; two distinct approvers required",
					),
				);
			}
		}
	}

	// Evidence — a reviewed candidate should not silently lack review history
	// when materiality demands it (informational, since evidence lives outside).
	if (orderOf(candidate.materiality) >= 2 && candidate.reviews.length === 0) {
		findings.push(
			finding(
				"concern",
				"approval",
				"material candidate has no recorded review history; approvals must be explicit events",
			),
		);
	}

	// Read-only guarantee: sort findings by severity, never touch the candidate.
	const severityOrder: Record<GuardianSeverity, number> = {
		blocker: 0,
		concern: 1,
		info: 2,
	};
	return {
		candidateHash: candidate.subjectHash,
		findings: [...findings].sort(
			(a, b) => severityOrder[a.severity] - severityOrder[b.severity],
		),
		verdict: "none",
		reviewedAt: new Date().toISOString(),
	};
}
