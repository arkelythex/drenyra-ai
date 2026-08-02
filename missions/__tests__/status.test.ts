/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Status conformance tests — ported from @drenyra/mission-protocol
 * (status.test.ts) and @drenyra/mission-domain (mission-status.test.ts).
 * String-literal enum values from the originals are expressed as enum members
 * so strict TypeScript accepts them.
 */

import { describe, expect, it } from "vitest";
import {
	AccountingMissionStatus,
	isTerminal,
	isWaitingForHuman,
	isRecoverable,
	isResumable,
	isExecutionState,
	isWaitState,
	waitReasonFor,
	WaitReason,
	STATUS_LABELS,
	EXTENDED_STATES,
	VALID_TRANSITIONS,
	TERMINAL_STATES,
	isRunnable,
	isAwaitingApproval,
} from "../status.js";

const S = AccountingMissionStatus;

describe("M4 extended states", () => {
	it("has 15 states including 3 M4 additions", () => {
		const allStates = Object.values(AccountingMissionStatus);
		expect(allStates).toHaveLength(15);
		expect(allStates).toContain("WAITING_FOR_EVIDENCE");
		expect(allStates).toContain("BLOCKED_BY_GATE");
		expect(allStates).toContain("RETRYING");
	});

	it("WAITING_FOR_EVIDENCE transitions correctly", () => {
		const transitions = VALID_TRANSITIONS.get(S.WAITING_FOR_EVIDENCE)!;
		expect(transitions.has(S.RUNNING)).toBe(true);
		expect(transitions.has(S.FAILED)).toBe(true);
		expect(transitions.has(S.COMPLETED)).toBe(false);
	});

	it("BLOCKED_BY_GATE transitions correctly", () => {
		const transitions = VALID_TRANSITIONS.get(S.BLOCKED_BY_GATE)!;
		expect(transitions.has(S.RUNNING)).toBe(true);
		expect(transitions.has(S.AWAITING_APPROVAL)).toBe(true);
		expect(transitions.has(S.FAILED)).toBe(true);
		expect(transitions.has(S.COMPLETED)).toBe(false);
	});

	it("RETRYING transitions correctly", () => {
		const transitions = VALID_TRANSITIONS.get(S.RETRYING)!;
		expect(transitions.has(S.RUNNING)).toBe(true);
		expect(transitions.has(S.FAILED)).toBe(true);
		expect(transitions.has(S.COMPLETED)).toBe(false);
	});

	it("RUNNING can transition to extended states", () => {
		const transitions = VALID_TRANSITIONS.get(S.RUNNING)!;
		expect(transitions.has(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(transitions.has(S.BLOCKED_BY_GATE)).toBe(true);
		expect(transitions.has(S.RETRYING)).toBe(true);
	});

	it("isWaitingForHuman includes extended + approval states", () => {
		expect(isWaitingForHuman(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(isWaitingForHuman(S.BLOCKED_BY_GATE)).toBe(true);
		expect(isWaitingForHuman(S.BLOCKED)).toBe(true);
		expect(isWaitingForHuman(S.AWAITING_APPROVAL)).toBe(true);
		expect(isWaitingForHuman(S.RUNNING)).toBe(false);
		expect(isWaitingForHuman(S.COMPLETED)).toBe(false);
	});

	it("isRecoverable includes all non-terminal paused states", () => {
		expect(isRecoverable(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(isRecoverable(S.BLOCKED_BY_GATE)).toBe(true);
		expect(isRecoverable(S.BLOCKED)).toBe(true);
		expect(isRecoverable(S.RETRYING)).toBe(true);
		expect(isRecoverable(S.UNKNOWN)).toBe(true);
		expect(isRecoverable(S.REVISION_REQUESTED)).toBe(true);
		expect(isRecoverable(S.COMPLETED)).toBe(false);
		expect(isRecoverable(S.FAILED)).toBe(false);
	});

	it("isResumable includes runnable + resumable states", () => {
		expect(isResumable(S.DRAFT)).toBe(true);
		expect(isResumable(S.QUEUED)).toBe(true);
		expect(isResumable(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(isResumable(S.BLOCKED_BY_GATE)).toBe(true);
		expect(isResumable(S.RETRYING)).toBe(true);
		expect(isResumable(S.UNKNOWN)).toBe(true);
		expect(isResumable(S.COMPLETED)).toBe(false);
		expect(isResumable(S.FAILED)).toBe(false);
	});

	it("classifies execution, wait, and terminal states without overlap", () => {
		expect(isExecutionState(S.RUNNING)).toBe(true);
		expect(isExecutionState(S.APPROVED)).toBe(true);
		expect(isExecutionState(S.WAITING_FOR_EVIDENCE)).toBe(false);
		expect(isWaitState(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(isWaitState(S.UNKNOWN)).toBe(true);
		expect(isWaitState(S.COMPLETED)).toBe(false);
		expect(isExecutionState(S.COMPLETED)).toBe(false);
	});

	it("maps every wait state to its formal reason", () => {
		expect(waitReasonFor(S.WAITING_FOR_EVIDENCE)).toBe(WaitReason.EVIDENCE);
		expect(waitReasonFor(S.AWAITING_APPROVAL)).toBe(WaitReason.APPROVAL);
		expect(waitReasonFor(S.BLOCKED_BY_GATE)).toBe(WaitReason.POLICY_GATE);
		expect(waitReasonFor(S.BLOCKED)).toBe(WaitReason.MANUAL_INTERVENTION);
		expect(waitReasonFor(S.RETRYING)).toBe(WaitReason.EXTERNAL_SYSTEM);
		expect(waitReasonFor(S.UNKNOWN)).toBe(WaitReason.EXTERNAL_SYSTEM);
		expect(waitReasonFor(S.RUNNING)).toBeNull();
	});

	it("terminal states remain unchanged", () => {
		expect(isTerminal(S.COMPLETED)).toBe(true);
		expect(isTerminal(S.FAILED)).toBe(true);
		expect(isTerminal(S.RUNNING)).toBe(false);
	});

	it("has human-readable labels for all states", () => {
		for (const status of Object.values(AccountingMissionStatus)) {
			expect(STATUS_LABELS[status]).toBeDefined();
			expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
		}
	});

	it("EXTENDED_STATES contains M4 pause states", () => {
		expect(EXTENDED_STATES.has(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(EXTENDED_STATES.has(S.BLOCKED_BY_GATE)).toBe(true);
		expect(EXTENDED_STATES.has(S.BLOCKED)).toBe(true);
		expect(EXTENDED_STATES.has(S.RUNNING)).toBe(false);
	});
});

describe("AccountingMissionStatus", () => {
	it("should have exactly 15 states", () => {
		const states = Object.values(AccountingMissionStatus);
		expect(states).toHaveLength(15);
		expect(states).toContain("DRAFT");
		expect(states).toContain("QUEUED");
		expect(states).toContain("RUNNING");
		expect(states).toContain("BLOCKED");
		expect(states).toContain("AWAITING_APPROVAL");
		expect(states).toContain("APPROVED");
		expect(states).toContain("REJECTED");
		expect(states).toContain("REVISION_REQUESTED");
		expect(states).toContain("COMPLETED");
		expect(states).toContain("FAILED");
		expect(states).toContain("UNKNOWN");
	});
});

describe("VALID_TRANSITIONS", () => {
	it("should have entries for all non-terminal states", () => {
		expect(VALID_TRANSITIONS.has(S.DRAFT)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.QUEUED)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.RUNNING)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.BLOCKED)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.AWAITING_APPROVAL)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.APPROVED)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.REJECTED)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.REVISION_REQUESTED)).toBe(true);
		expect(VALID_TRANSITIONS.has(S.UNKNOWN)).toBe(true);
	});

	it("DRAFT transitions to QUEUED only", () => {
		const targets = VALID_TRANSITIONS.get(S.DRAFT)!;
		expect(targets.size).toBe(1);
		expect(targets.has(S.QUEUED)).toBe(true);
	});

	it("QUEUED transitions to RUNNING and FAILED", () => {
		const targets = VALID_TRANSITIONS.get(S.QUEUED)!;
		expect(targets.size).toBe(2);
		expect(targets.has(S.RUNNING)).toBe(true);
		expect(targets.has(S.FAILED)).toBe(true);
	});

	it("RUNNING transitions to 8 states including extended", () => {
		const targets = VALID_TRANSITIONS.get(S.RUNNING)!;
		expect(targets.size).toBe(8);
		expect(targets.has(S.BLOCKED)).toBe(true);
		expect(targets.has(S.AWAITING_APPROVAL)).toBe(true);
		expect(targets.has(S.COMPLETED)).toBe(true);
		expect(targets.has(S.FAILED)).toBe(true);
		expect(targets.has(S.UNKNOWN)).toBe(true);
		expect(targets.has(S.WAITING_FOR_EVIDENCE)).toBe(true);
		expect(targets.has(S.BLOCKED_BY_GATE)).toBe(true);
		expect(targets.has(S.RETRYING)).toBe(true);
	});

	it("BLOCKED transitions to RUNNING and FAILED", () => {
		const targets = VALID_TRANSITIONS.get(S.BLOCKED)!;
		expect(targets.size).toBe(2);
		expect(targets.has(S.RUNNING)).toBe(true);
		expect(targets.has(S.FAILED)).toBe(true);
	});

	it("AWAITING_APPROVAL transitions to APPROVED, REJECTED, RUNNING", () => {
		const targets = VALID_TRANSITIONS.get(S.AWAITING_APPROVAL)!;
		expect(targets.size).toBe(3);
		expect(targets.has(S.APPROVED)).toBe(true);
		expect(targets.has(S.REJECTED)).toBe(true);
		expect(targets.has(S.RUNNING)).toBe(true);
	});

	it("APPROVED transitions to COMPLETED and FAILED", () => {
		const targets = VALID_TRANSITIONS.get(S.APPROVED)!;
		expect(targets.size).toBe(2);
		expect(targets.has(S.COMPLETED)).toBe(true);
		expect(targets.has(S.FAILED)).toBe(true);
	});

	it("REJECTED transitions to REVISION_REQUESTED only", () => {
		const targets = VALID_TRANSITIONS.get(S.REJECTED)!;
		expect(targets.size).toBe(1);
		expect(targets.has(S.REVISION_REQUESTED)).toBe(true);
	});

	it("REVISION_REQUESTED transitions to QUEUED only", () => {
		const targets = VALID_TRANSITIONS.get(S.REVISION_REQUESTED)!;
		expect(targets.size).toBe(1);
		expect(targets.has(S.QUEUED)).toBe(true);
	});

	it("COMPLETED has no transitions", () => {
		const targets = VALID_TRANSITIONS.get(S.COMPLETED);
		expect(targets?.size ?? 0).toBe(0);
	});

	it("FAILED has no transitions", () => {
		const targets = VALID_TRANSITIONS.get(S.FAILED);
		expect(targets?.size ?? 0).toBe(0);
	});

	it("UNKNOWN transitions to RUNNING, FAILED, COMPLETED (recovery paths)", () => {
		const targets = VALID_TRANSITIONS.get(S.UNKNOWN)!;
		expect(targets.size).toBe(3);
		expect(targets.has(S.RUNNING)).toBe(true);
		expect(targets.has(S.FAILED)).toBe(true);
		expect(targets.has(S.COMPLETED)).toBe(true);
	});
});

describe("TERMINAL_STATES", () => {
	it("should contain COMPLETED and FAILED", () => {
		expect(TERMINAL_STATES.has(S.COMPLETED)).toBe(true);
		expect(TERMINAL_STATES.has(S.FAILED)).toBe(true);
	});

	it("should NOT contain REJECTED", () => {
		expect(TERMINAL_STATES.has(S.REJECTED)).toBe(false);
	});

	it("should have exactly 2 states", () => {
		expect(TERMINAL_STATES.size).toBe(2);
	});
});

describe("isRunnable()", () => {
	it("DRAFT is runnable", () => expect(isRunnable(S.DRAFT)).toBe(true));
	it("QUEUED is runnable", () => expect(isRunnable(S.QUEUED)).toBe(true));
	it("REVISION_REQUESTED is runnable", () =>
		expect(isRunnable(S.REVISION_REQUESTED)).toBe(true));
	it("RUNNING is NOT runnable", () =>
		expect(isRunnable(S.RUNNING)).toBe(false));
	it("BLOCKED is NOT runnable", () =>
		expect(isRunnable(S.BLOCKED)).toBe(false));
	it("AWAITING_APPROVAL is NOT runnable", () =>
		expect(isRunnable(S.AWAITING_APPROVAL)).toBe(false));
	it("APPROVED is NOT runnable", () =>
		expect(isRunnable(S.APPROVED)).toBe(false));
	it("REJECTED is NOT runnable", () =>
		expect(isRunnable(S.REJECTED)).toBe(false));
	it("COMPLETED is NOT runnable", () =>
		expect(isRunnable(S.COMPLETED)).toBe(false));
	it("FAILED is NOT runnable", () => expect(isRunnable(S.FAILED)).toBe(false));
	it("UNKNOWN is NOT runnable", () =>
		expect(isRunnable(S.UNKNOWN)).toBe(false));
});

describe("isAwaitingApproval()", () => {
	it("AWAITING_APPROVAL returns true", () => {
		expect(isAwaitingApproval(S.AWAITING_APPROVAL)).toBe(true);
	});
	it("other states return false", () => {
		expect(isAwaitingApproval(S.DRAFT)).toBe(false);
		expect(isAwaitingApproval(S.RUNNING)).toBe(false);
		expect(isAwaitingApproval(S.APPROVED)).toBe(false);
		expect(isAwaitingApproval(S.REJECTED)).toBe(false);
		expect(isAwaitingApproval(S.COMPLETED)).toBe(false);
		expect(isAwaitingApproval(S.FAILED)).toBe(false);
	});
});

describe("isTerminal()", () => {
	it("COMPLETED is terminal", () => expect(isTerminal(S.COMPLETED)).toBe(true));
	it("FAILED is terminal", () => expect(isTerminal(S.FAILED)).toBe(true));

	it("REJECTED is NOT terminal (can go to REVISION_REQUESTED)", () => {
		expect(isTerminal(S.REJECTED)).toBe(false);
	});

	it("non-terminal states return false", () => {
		expect(isTerminal(S.DRAFT)).toBe(false);
		expect(isTerminal(S.QUEUED)).toBe(false);
		expect(isTerminal(S.RUNNING)).toBe(false);
		expect(isTerminal(S.BLOCKED)).toBe(false);
		expect(isTerminal(S.AWAITING_APPROVAL)).toBe(false);
		expect(isTerminal(S.APPROVED)).toBe(false);
		expect(isTerminal(S.REVISION_REQUESTED)).toBe(false);
		expect(isTerminal(S.UNKNOWN)).toBe(false);
	});
});
