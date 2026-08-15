/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** projectMission — read-only, deterministic projection of the canonical
 * 15-state mission lifecycle. Reads canonical data as data; never invokes
 * guards, gates, mutations, receipts, I/O, or authority. */
import {
	AccountingMissionStatus,
	TERMINAL_STATES,
	VALID_TRANSITIONS,
} from "../missions/status.js";
import type {
	MissionNextAction,
	MissionProjectionBlockingCondition,
	MissionProjectionDenial,
	MissionProjectionDenialCause,
	MissionProjectionContinuation,
	MissionProjectionRequest,
	MissionProjectionResult,
	MissionProjectionSnapshot,
} from "./types.js";

const S = AccountingMissionStatus;

/** Exhaustive private next-action map (D11); a new state fails typecheck. */
const NEXT_ACTIONS = {
	[S.DRAFT]: "queue", [S.QUEUED]: "run", [S.RUNNING]: "monitor", [S.BLOCKED]: "resume",
	[S.AWAITING_APPROVAL]: "review", [S.APPROVED]: "finalize", [S.REJECTED]: "request-revision",
	[S.REVISION_REQUESTED]: "requeue", [S.COMPLETED]: "none", [S.FAILED]: "none",
	[S.UNKNOWN]: "reconcile", [S.RECOVERING]: "monitor", [S.WAITING_FOR_EVIDENCE]: "provide-evidence",
	[S.BLOCKED_BY_GATE]: "resolve-gate", [S.RETRYING]: "monitor",
} as const satisfies Record<AccountingMissionStatus, MissionNextAction>;

/** Closed denial details per blocking condition (D10). */
const BLOCKER_DETAILS = {
	APPROVAL_REQUIRED: { cause: "approval-context-required", continuation: "provide-approval-context" },
	MISSING_EVIDENCE: { cause: "evidence-context-required", continuation: "provide-evidence-context" },
	POLICY_BLOCKED: { cause: "policy-context-blocked", continuation: "resolve-policy-context" },
} as const satisfies Record<
	MissionProjectionBlockingCondition,
	{ readonly cause: MissionProjectionDenialCause; readonly continuation: MissionProjectionContinuation }
>;

const CANONICAL_STATUS_VALUES: readonly string[] = Object.values(AccountingMissionStatus);
const REQUEST_KEYS: ReadonlySet<string> = new Set(["requestedContinuation", "blockingCondition"]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const isCanonicalStatus = (v: unknown): v is AccountingMissionStatus =>
	typeof v === "string" && CANONICAL_STATUS_VALUES.includes(v);
const isBlockingCondition = (v: unknown): v is MissionProjectionBlockingCondition =>
	v === "APPROVAL_REQUIRED" || v === "MISSING_EVIDENCE" || v === "POLICY_BLOCKED";

/** Strict request shape: known keys only, canonical target, closed blocker. */
const hasExactRequestShape = (r: Record<string, unknown>): boolean => {
	for (const key of Object.keys(r)) if (!REQUEST_KEYS.has(key)) return false;
	if (!isCanonicalStatus(r.requestedContinuation)) return false;
	return r.blockingCondition === undefined || isBlockingCondition(r.blockingCondition);
};

const unsupported = (
	cause: "unsupported-status-value" | "malformed-projection-request",
	continuation: "provide-supported-status" | "correct-projection-request",
): MissionProjectionResult =>
	Object.freeze({ deny: Object.freeze({ code: "UNSUPPORTED_STATUS", cause, continuation }) });

/**
 * Projects the canonical lifecycle for a snapshot.
 * @returns a full frozen projection, or a fail-closed UNSUPPORTED_STATUS result.
 */
export function projectMission(
	snapshot: MissionProjectionSnapshot,
	request?: MissionProjectionRequest,
): MissionProjectionResult {
	if (!isRecord(snapshot) || !isCanonicalStatus(snapshot.status)) {
		return unsupported("unsupported-status-value", "provide-supported-status");
	}
	if (request !== undefined && (!isRecord(request) || !hasExactRequestShape(request))) {
		return unsupported("malformed-projection-request", "correct-projection-request");
	}
	const status = snapshot.status;
	const canonical = VALID_TRANSITIONS.get(status);
	if (!canonical) return unsupported("unsupported-status-value", "provide-supported-status");
	const isUnknown = status === S.UNKNOWN;
	// UNKNOWN recovery is labeled, never ordinary progression (D4/D5). Fresh
	// copies keep canonical declaration order (D6); freezing protects callers (D7).
	const eligibleTransitions = Object.freeze(isUnknown ? [] : [...canonical]);
	const recoveryTransitions = isUnknown ? Object.freeze([...canonical]) : undefined;
	const nextAction = NEXT_ACTIONS[status];

	// Fixed precedence (D9): unavailable target, then blocker, else no denial.
	let deny: MissionProjectionDenial | undefined;
	if (request !== undefined) {
		if (!canonical.has(request.requestedContinuation)) {
			const terminal = TERMINAL_STATES.has(status);
			deny = Object.freeze({
				code: "INVALID_TRANSITION",
				cause: terminal ? "terminal-state" : "transition-not-eligible",
				continuation: terminal ? "no-continuation-available" : "choose-eligible-transition",
			});
		} else if (request.blockingCondition !== undefined) {
			const details = BLOCKER_DETAILS[request.blockingCondition];
			deny = Object.freeze({
				code: request.blockingCondition,
				cause: details.cause,
				continuation: details.continuation,
			});
		}
	}

	return Object.freeze({
		status,
		eligibleTransitions,
		nextAction,
		...(recoveryTransitions ? { recoveryTransitions } : {}),
		...(deny ? { deny } : {}),
	});
}
