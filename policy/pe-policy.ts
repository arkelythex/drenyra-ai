/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Restriction-only, fail-closed PE evaluation (1E-1). `evaluatePePolicy` derives
 * the decision from an immutable proposed outcome; `govern` enforces the mandatory
 * composition order: evaluate first, stop before any snapshot/transition/candidate/
 * receipt on BLOCK or ESCALATE, and only on ALLOW delegate to the owning authority. */

import { HIGH_VALUE_CENTS } from "../candidates/materiality.js";
import { FISCAL_JURISDICTION, POLICY_DECISION, POLICY_REASON, PolicyError } from "./types.js";
import type { AuthorityPort, PolicyEvaluator, PolicyOutcome, PolicySubject } from "./types.js";

export function evaluatePePolicy(subject: PolicySubject): PolicyOutcome {
	if (
		subject === null || typeof subject !== "object" || typeof subject.jurisdiction !== "string" ||
		typeof subject.valueCents !== "bigint" || !Array.isArray(subject.evidence) ||
		typeof subject.scopeKey !== "string" || subject.scopeKey.length === 0
	) {
		return { decision: POLICY_DECISION.BLOCK, reason: POLICY_REASON.UNKNOWN_INPUT };
	}
	if (subject.jurisdiction !== FISCAL_JURISDICTION.PE) {
		return subject.jurisdiction.length === 0
			? { decision: POLICY_DECISION.BLOCK, reason: POLICY_REASON.UNSUPPORTED_JURISDICTION }
			: { decision: POLICY_DECISION.BLOCK, reason: POLICY_REASON.NON_PE_JURISDICTION };
	}
	if (subject.evidence.length === 0) {
		return { decision: POLICY_DECISION.ESCALATE, reason: POLICY_REASON.INSUFFICIENT_EVIDENCE };
	}
	if (subject.evidence.some((artifact) => artifact.scopeKey !== subject.scopeKey)) {
		return { decision: POLICY_DECISION.BLOCK, reason: POLICY_REASON.SCOPE_MISMATCH };
	}
	if (subject.valueCents >= HIGH_VALUE_CENTS) {
		return { decision: POLICY_DECISION.ESCALATE, reason: POLICY_REASON.ABOVE_PE_THRESHOLD };
	}
	return { decision: POLICY_DECISION.ALLOW, reason: POLICY_REASON.PE_RULES_APPLIED };
}

export function govern<TSubject, TResult>(
	subject: TSubject,
	evaluate: PolicyEvaluator<TSubject>,
	authority: AuthorityPort<TSubject, TResult>,
): TResult {
	const outcome = evaluate(subject);
	if (outcome.decision !== POLICY_DECISION.ALLOW) {
		throw new PolicyError(
			outcome.decision,
			outcome.reason,
			`policy ${outcome.decision}: ${outcome.reason}`,
		);
	}
	return authority.apply(subject);
}
