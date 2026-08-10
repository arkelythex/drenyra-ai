/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission status — canonical 15-state enum with terminal classification.
 *
 * Transport-agnostic: does not depend on HTTP, SSE, or any runtime.
 * This is the single source of truth for mission lifecycle states.
 *
 * States added in M4:
 *   WAITING_FOR_EVIDENCE — mission paused for human-provided evidence
 *   BLOCKED_BY_GATE      — mission blocked by a specific readiness gate
 *   RETRYING             — automatic retry after transient failure
 */

/**
 * The 15 canonical accounting mission states (12 original + 3 M4).
 */
export enum AccountingMissionStatus {
	DRAFT = "DRAFT",
	QUEUED = "QUEUED",
	RUNNING = "RUNNING",
	BLOCKED = "BLOCKED",
	AWAITING_APPROVAL = "AWAITING_APPROVAL",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
	REVISION_REQUESTED = "REVISION_REQUESTED",
	COMPLETED = "COMPLETED",
	FAILED = "FAILED",
	UNKNOWN = "UNKNOWN",

	// M4 extended states
	RECOVERING = "RECOVERING",
	WAITING_FOR_EVIDENCE = "WAITING_FOR_EVIDENCE",
	BLOCKED_BY_GATE = "BLOCKED_BY_GATE",
	RETRYING = "RETRYING",
}

const S = AccountingMissionStatus;

/**
 * Formal reason a mission is waiting rather than actively progressing.
 */
export enum WaitReason {
	EVIDENCE = "EVIDENCE",
	APPROVAL = "APPROVAL",
	POLICY_GATE = "POLICY_GATE",
	EXTERNAL_SYSTEM = "EXTERNAL_SYSTEM",
	MANUAL_INTERVENTION = "MANUAL_INTERVENTION",
}

/**
 * Valid transitions matrix.
 *
 * Key invariants:
 *   - COMPLETED and FAILED are terminal — no transitions out.
 *   - UNKNOWN is special — only recovery transitions allowed.
 *   - Extended states (WAITING_FOR_EVIDENCE, BLOCKED_BY_GATE, RETRYING)
 *     can only return to RUNNING or go terminal.
 */
export const VALID_TRANSITIONS: Map<
	AccountingMissionStatus,
	Set<AccountingMissionStatus>
> = new Map([
	[S.DRAFT, new Set([S.QUEUED])],
	[S.QUEUED, new Set([S.RUNNING, S.FAILED])],
	[
		S.RUNNING,
		new Set([
			S.BLOCKED,
			S.AWAITING_APPROVAL,
			S.COMPLETED,
			S.FAILED,
			S.UNKNOWN,
			S.WAITING_FOR_EVIDENCE,
			S.BLOCKED_BY_GATE,
			S.RETRYING,
		]),
	],
	[S.BLOCKED, new Set([S.RUNNING, S.FAILED])],
	// Extended states can return to RUNNING or fail
	[S.WAITING_FOR_EVIDENCE, new Set([S.RUNNING, S.FAILED])],
	[S.BLOCKED_BY_GATE, new Set([S.RUNNING, S.AWAITING_APPROVAL, S.FAILED])],
	[S.RECOVERING, new Set([S.RUNNING, S.FAILED])],
	[S.RETRYING, new Set([S.RUNNING, S.FAILED])],
	// Approval flow
	[S.AWAITING_APPROVAL, new Set([S.APPROVED, S.REJECTED, S.RUNNING])],
	[S.APPROVED, new Set([S.COMPLETED, S.FAILED])],
	[S.REJECTED, new Set([S.REVISION_REQUESTED])],
	[S.REVISION_REQUESTED, new Set([S.QUEUED])],
	// Terminal states
	[S.COMPLETED, new Set()],
	[S.FAILED, new Set()],
	// UNKNOWN recovery
	[S.UNKNOWN, new Set([S.RUNNING, S.FAILED, S.COMPLETED])],
]);

/**
 * Terminal states: no transitions out.
 */
export const TERMINAL_STATES: Set<AccountingMissionStatus> = new Set([
	S.COMPLETED,
	S.FAILED,
]);

/**
 * Execution states actively progress mission work. Wait states pause that work
 * pending the mapped wait reason. Terminal states cannot coexist with another
 * lifecycle state; execution and wait classifications are mutually exclusive.
 */
const EXECUTION_STATES: Set<AccountingMissionStatus> = new Set([
	S.DRAFT,
	S.QUEUED,
	S.RUNNING,
	S.RECOVERING,
	S.APPROVED,
	S.REJECTED,
	S.REVISION_REQUESTED,
]);

const WAIT_STATES: Set<AccountingMissionStatus> = new Set([
	S.WAITING_FOR_EVIDENCE,
	S.AWAITING_APPROVAL,
	S.BLOCKED_BY_GATE,
	S.BLOCKED,
	S.RETRYING,
	S.UNKNOWN,
]);

/**
 * Returns true when the mission is actively executing or progressing its
 * lifecycle rather than waiting or terminal.
 */
export function isExecutionState(status: AccountingMissionStatus): boolean {
	return EXECUTION_STATES.has(status);
}

/**
 * Returns true when the mission is paused for a human, policy, or external
 * system condition.
 */
export function isWaitState(status: AccountingMissionStatus): boolean {
	return WAIT_STATES.has(status);
}

/**
 * Returns the reason associated with a wait state, or null for states that do
 * not wait.
 */
export function waitReasonFor(
	status: AccountingMissionStatus,
): WaitReason | null {
	switch (status) {
		case S.WAITING_FOR_EVIDENCE:
			return WaitReason.EVIDENCE;
		case S.AWAITING_APPROVAL:
			return WaitReason.APPROVAL;
		case S.BLOCKED_BY_GATE:
			return WaitReason.POLICY_GATE;
		case S.BLOCKED:
			return WaitReason.MANUAL_INTERVENTION;
		case S.RETRYING:
		case S.UNKNOWN:
			return WaitReason.EXTERNAL_SYSTEM;
		default:
			return null;
	}
}

/**
 * Extended states that require human intervention to resolve.
 * Missions in these states are "paused" and need external action.
 */
export const EXTENDED_STATES: Set<AccountingMissionStatus> = new Set([
	S.WAITING_FOR_EVIDENCE,
	S.BLOCKED_BY_GATE,
	S.BLOCKED,
]);

/**
 * Returns true if the state is terminal.
 */
export function isTerminal(status: AccountingMissionStatus): boolean {
	return TERMINAL_STATES.has(status);
}

/**
 * Returns true if the mission is waiting for human approval.
 */
export function isAwaitingApproval(status: AccountingMissionStatus): boolean {
	return status === AccountingMissionStatus.AWAITING_APPROVAL;
}

/**
 * Returns true if the mission is paused waiting for human intervention
 * (evidence, gate resolution, or general blocked state).
 */
export function isWaitingForHuman(status: AccountingMissionStatus): boolean {
	return EXTENDED_STATES.has(status) || isAwaitingApproval(status);
}

/**
 * Returns true if the mission is in a recoverable state
 * (can return to RUNNING with external action or automatic retry).
 */
export function isRecoverable(status: AccountingMissionStatus): boolean {
	switch (status) {
		case S.WAITING_FOR_EVIDENCE:
		case S.BLOCKED_BY_GATE:
		case S.BLOCKED:
		case S.RETRYING:
		case S.UNKNOWN:
		case S.REVISION_REQUESTED:
			return true;
		default:
			return false;
	}
}

/**
 * States from which execution can be initiated or resumed.
 */
const RUNNABLE_STATES: Set<AccountingMissionStatus> = new Set([
	S.DRAFT,
	S.QUEUED,
	S.REVISION_REQUESTED,
]);

/**
 * Returns true if the mission can be executed from this state.
 */
export function isRunnable(status: AccountingMissionStatus): boolean {
	return RUNNABLE_STATES.has(status);
}

/**
 * States from which the mission can be resumed (continues execution).
 * These include extended states that can return to RUNNING.
 */
const RESUMABLE_STATES: Set<AccountingMissionStatus> = new Set([
	S.WAITING_FOR_EVIDENCE,
	S.BLOCKED_BY_GATE,
	S.RETRYING,
	S.UNKNOWN,
]);

/**
 * Returns true if the mission can be resumed (not just started fresh).
 */
export function isResumable(status: AccountingMissionStatus): boolean {
	return RESUMABLE_STATES.has(status) || isRunnable(status);
}

/**
 * Human-readable label for each status.
 */
export const STATUS_LABELS: Record<AccountingMissionStatus, string> = {
	[S.DRAFT]: "Borrador",
	[S.QUEUED]: "En cola",
	[S.RUNNING]: "Ejecutando",
	[S.BLOCKED]: "Bloqueado",
	[S.WAITING_FOR_EVIDENCE]: "Esperando evidencia",
	[S.BLOCKED_BY_GATE]: "Bloqueado por gate",
	[S.RECOVERING]: "Recuperando",
	[S.RETRYING]: "Reintentando",
	[S.AWAITING_APPROVAL]: "Esperando aprobacion",
	[S.APPROVED]: "Aprobado",
	[S.REJECTED]: "Rechazado",
	[S.REVISION_REQUESTED]: "Revision solicitada",
	[S.COMPLETED]: "Completado",
	[S.FAILED]: "Fallido",
	[S.UNKNOWN]: "Estado desconocido",
};
