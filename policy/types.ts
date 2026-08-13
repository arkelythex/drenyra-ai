/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** PE policy domain types (1E-1): jurisdiction const, policy subject, restricted
 * outcome, decision consts, and the evaluator/authority ports of the composition order. */

import type { AcceptedEvidence } from "../evidence/index.js";

export const FISCAL_JURISDICTION = { PE: "PE" } as const;
export type FiscalJurisdiction =
	(typeof FISCAL_JURISDICTION)[keyof typeof FISCAL_JURISDICTION];

export const POLICY_DECISION = {
	ALLOW: "allow",
	BLOCK: "block",
	ESCALATE: "escalate",
} as const;
export type PolicyDecision = (typeof POLICY_DECISION)[keyof typeof POLICY_DECISION];

export const POLICY_REASON = {
	PE_RULES_APPLIED: "pe-rules-applied", NON_PE_JURISDICTION: "non-pe-jurisdiction",
	UNSUPPORTED_JURISDICTION: "unsupported-jurisdiction", ABOVE_PE_THRESHOLD: "above-pe-threshold",
	INSUFFICIENT_EVIDENCE: "insufficient-evidence", SCOPE_MISMATCH: "scope-mismatch",
	UNKNOWN_INPUT: "unknown-input",
} as const;
export type PolicyReason = (typeof POLICY_REASON)[keyof typeof POLICY_REASON];

/** Proposed journal or CDR outcome as immutable policy input, derived without
 * applying, returning, or persisting it. */
export interface PolicySubject {
	readonly jurisdiction: string;
	readonly valueCents: bigint;
	readonly evidence: readonly AcceptedEvidence[];
	readonly scopeKey: string;
}

export interface PolicyOutcome {
	readonly decision: PolicyDecision;
	readonly reason: PolicyReason;
}

export type PolicyEvaluator<TSubject> = (subject: TSubject) => PolicyOutcome;

/** Owning authority primitive: invoked only on ALLOW; still performs its own validation. */
export interface AuthorityPort<TSubject, TResult> {
	apply(subject: TSubject): TResult;
}

export class PolicyError extends Error {
	readonly decision: PolicyDecision;
	readonly reason: PolicyReason;

	constructor(decision: PolicyDecision, reason: PolicyReason, message: string) {
		super(message);
		this.name = "PolicyError";
		this.decision = decision;
		this.reason = reason;
	}
}
