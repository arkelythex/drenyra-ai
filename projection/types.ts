/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Mission projection — closed public types. Guidance, never authorization. */
import type { AccountingMissionStatus } from "../missions/status.js";

export interface MissionProjectionSnapshot {
	readonly status: AccountingMissionStatus;
}

export type MissionNextAction =
	| "none" | "queue" | "run" | "monitor" | "resume" | "review"
	| "finalize" | "request-revision" | "requeue" | "reconcile"
	| "provide-evidence" | "resolve-gate";

export type MissionProjectionDenialCode =
	| "INVALID_TRANSITION" | "APPROVAL_REQUIRED" | "MISSING_EVIDENCE"
	| "POLICY_BLOCKED" | "UNSUPPORTED_STATUS";

export type MissionProjectionBlockingCondition =
	| "APPROVAL_REQUIRED" | "MISSING_EVIDENCE" | "POLICY_BLOCKED";

export type MissionProjectionDenialCause =
	| "unsupported-status-value" | "malformed-projection-request"
	| "terminal-state" | "transition-not-eligible"
	| "approval-context-required" | "evidence-context-required"
	| "policy-context-blocked";

export type MissionProjectionContinuation =
	| "provide-supported-status" | "correct-projection-request"
	| "choose-eligible-transition" | "no-continuation-available"
	| "provide-approval-context" | "provide-evidence-context"
	| "resolve-policy-context";

export interface MissionProjectionRequest {
	readonly requestedContinuation: AccountingMissionStatus;
	readonly blockingCondition?: MissionProjectionBlockingCondition;
}

export interface MissionProjectionDenial {
	readonly code: MissionProjectionDenialCode;
	readonly cause: MissionProjectionDenialCause;
	readonly continuation: MissionProjectionContinuation;
}

export interface MissionProjection {
	readonly status: AccountingMissionStatus;
	readonly eligibleTransitions: readonly AccountingMissionStatus[];
	readonly recoveryTransitions?: readonly AccountingMissionStatus[];
	readonly nextAction: MissionNextAction;
	readonly deny?: MissionProjectionDenial;
}

export interface UnsupportedMissionProjection {
	readonly deny: MissionProjectionDenial & { readonly code: "UNSUPPORTED_STATUS" };
}

export type MissionProjectionResult = MissionProjection | UnsupportedMissionProjection;
