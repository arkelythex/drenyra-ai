/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Mission projection conformance (REQ-PROJ-001..013, SC-PROJ-001..018). */
import { describe, expect, it } from "vitest";
import {
	AccountingMissionStatus, TERMINAL_STATES, VALID_TRANSITIONS,
} from "../../missions/status.js";
import { projectMission } from "../project-mission.js";
import type {
	MissionNextAction, MissionProjection, MissionProjectionBlockingCondition,
	MissionProjectionDenial, MissionProjectionRequest, MissionProjectionResult,
	MissionProjectionSnapshot,
} from "../types.js";

const S = AccountingMissionStatus;
const ALL = Object.values(AccountingMissionStatus);
const INVALID = { code: "INVALID_TRANSITION", cause: "transition-not-eligible", continuation: "choose-eligible-transition" } as const;
const TERMINAL = { code: "INVALID_TRANSITION", cause: "terminal-state", continuation: "no-continuation-available" } as const;
const UNSUPPORTED = { code: "UNSUPPORTED_STATUS", cause: "unsupported-status-value", continuation: "provide-supported-status" } as const;
const MALFORMED_REQ = { code: "UNSUPPORTED_STATUS", cause: "malformed-projection-request", continuation: "correct-projection-request" } as const;
const BLOCKER_DENIALS: Record<MissionProjectionBlockingCondition, MissionProjectionDenial> = {
	APPROVAL_REQUIRED: { code: "APPROVAL_REQUIRED", cause: "approval-context-required", continuation: "provide-approval-context" },
	MISSING_EVIDENCE: { code: "MISSING_EVIDENCE", cause: "evidence-context-required", continuation: "provide-evidence-context" },
	POLICY_BLOCKED: { code: "POLICY_BLOCKED", cause: "policy-context-blocked", continuation: "resolve-policy-context" },
};
const ACTION_TABLE: ReadonlyArray<readonly [AccountingMissionStatus, MissionNextAction]> = [
	[S.DRAFT, "queue"], [S.QUEUED, "run"], [S.RUNNING, "monitor"], [S.BLOCKED, "resume"],
	[S.AWAITING_APPROVAL, "review"], [S.APPROVED, "finalize"], [S.REJECTED, "request-revision"],
	[S.REVISION_REQUESTED, "requeue"], [S.COMPLETED, "none"], [S.FAILED, "none"],
	[S.UNKNOWN, "reconcile"], [S.RECOVERING, "monitor"], [S.WAITING_FOR_EVIDENCE, "provide-evidence"],
	[S.BLOCKED_BY_GATE, "resolve-gate"], [S.RETRYING, "monitor"],
];
const DENIALS: ReadonlyArray<{ status: AccountingMissionStatus; target: AccountingMissionStatus; blocker?: MissionProjectionBlockingCondition; expected: MissionProjectionDenial }> = [
	{ status: S.DRAFT, target: S.COMPLETED, expected: INVALID },
	{ status: S.COMPLETED, target: S.RUNNING, expected: TERMINAL },
	{ status: S.FAILED, target: S.DRAFT, expected: TERMINAL },
	{ status: S.UNKNOWN, target: S.DRAFT, expected: INVALID },
	{ status: S.QUEUED, target: S.RUNNING, blocker: "APPROVAL_REQUIRED", expected: BLOCKER_DENIALS.APPROVAL_REQUIRED },
	{ status: S.QUEUED, target: S.RUNNING, blocker: "MISSING_EVIDENCE", expected: BLOCKER_DENIALS.MISSING_EVIDENCE },
	{ status: S.QUEUED, target: S.RUNNING, blocker: "POLICY_BLOCKED", expected: BLOCKER_DENIALS.POLICY_BLOCKED },
	{ status: S.UNKNOWN, target: S.RUNNING, blocker: "POLICY_BLOCKED", expected: BLOCKER_DENIALS.POLICY_BLOCKED },
];
const MALFORMED: ReadonlyArray<{ name: string; snapshot: unknown; request?: unknown; expected: MissionProjectionDenial }> = [
	{ name: "null snapshot", snapshot: null, expected: UNSUPPORTED },
	{ name: "undefined snapshot", snapshot: undefined, expected: UNSUPPORTED },
	{ name: "non-object snapshot", snapshot: "DRAFT", expected: UNSUPPORTED },
	{ name: "array snapshot", snapshot: [S.DRAFT], expected: UNSUPPORTED },
	{ name: "missing status", snapshot: {}, expected: UNSUPPORTED },
	{ name: "empty status", snapshot: { status: "" }, expected: UNSUPPORTED },
	{ name: "misspelled status", snapshot: { status: "DRAFTT" }, expected: UNSUPPORTED },
	{ name: "null request", snapshot: { status: S.DRAFT }, request: null, expected: MALFORMED_REQ },
	{ name: "empty request", snapshot: { status: S.DRAFT }, request: {}, expected: MALFORMED_REQ },
	{ name: "request without target", snapshot: { status: S.DRAFT }, request: { blockingCondition: "APPROVAL_REQUIRED" }, expected: MALFORMED_REQ },
	{ name: "request with unknown key", snapshot: { status: S.DRAFT }, request: { requestedContinuation: S.QUEUED, extra: true }, expected: MALFORMED_REQ },
	{ name: "non-canonical target", snapshot: { status: S.DRAFT }, request: { requestedContinuation: "BOGUS" }, expected: MALFORMED_REQ },
	{ name: "unknown blocker", snapshot: { status: S.DRAFT }, request: { requestedContinuation: S.QUEUED, blockingCondition: "GATE_BLOCKED" }, expected: MALFORMED_REQ },
];

const asProjection = (r: MissionProjectionResult): MissionProjection => {
	if (!("eligibleTransitions" in r)) throw new Error("expected MissionProjection");
	return r;
};
const ineligibleTarget = (status: AccountingMissionStatus): AccountingMissionStatus => {
	const eligible = new Set(VALID_TRANSITIONS.get(status) ?? []);
	return ALL.find((c) => c !== status && !eligible.has(c)) ?? S.DRAFT;
};

describe("T-PRJ-001/002 shape, closed actions, eligibility, recovery", () => {
	it("passes status through, maps one closed action, derives eligibility, and labels recovery", () => {
		const closed = new Set(ACTION_TABLE.map(([, a]) => a));
		for (const status of ALL) {
			const p = asProjection(projectMission({ status }));
			expect(p.status).toBe(status);
			expect(p.nextAction).toBe(ACTION_TABLE.find(([s]) => s === status)![1]);
			expect(closed.has(p.nextAction)).toBe(true);
			if (!TERMINAL_STATES.has(status)) expect(p.nextAction).not.toBe("none");
			expect(p.deny).toBeUndefined();
			expect(p.eligibleTransitions).toEqual(
				status === S.UNKNOWN ? [] : [...VALID_TRANSITIONS.get(status)!],
			);
			if (status !== S.UNKNOWN) expect(p).not.toHaveProperty("recoveryTransitions");
		}
		const u = asProjection(projectMission({ status: S.UNKNOWN }));
		expect(u.recoveryTransitions).toEqual([...VALID_TRANSITIONS.get(S.UNKNOWN)!]);
		expect(u.recoveryTransitions).toEqual([S.RUNNING, S.FAILED, S.COMPLETED]);
		expect(u.eligibleTransitions).not.toContain(S.RUNNING);
	});
	it("never claims approval, execution, verification, or a receipt (SC-PROJ-008/016)", () => {
		const p = asProjection(projectMission({ status: S.AWAITING_APPROVAL }));
		expect([...Object.keys(p)].sort()).toEqual(["eligibleTransitions", "nextAction", "status"]);
		for (const claim of ["verified", "approved", "receipt"]) expect(p).not.toHaveProperty(claim);
	});
});

describe("T-PRJ-003 typed denial matrix", () => {
	it("denies unavailable and blocked continuations without throwing (SC-PROJ-009/010)", () => {
		for (const c of DENIALS) {
			const req: MissionProjectionRequest = { requestedContinuation: c.target, ...(c.blocker ? { blockingCondition: c.blocker } : {}) };
			expect(asProjection(projectMission({ status: c.status }, req)).deny).toEqual(c.expected);
		}
	});
	it("maps every eligible RUNNING target with every blocker to its exact closed denial", () => {
		const targets = [...VALID_TRANSITIONS.get(S.RUNNING)!];
		expect(targets).toHaveLength(8);
		for (const blocker of Object.keys(BLOCKER_DENIALS) as MissionProjectionBlockingCondition[]) {
			for (const target of targets) {
				expect(asProjection(projectMission({ status: S.RUNNING }, { requestedContinuation: target, blockingCondition: blocker })).deny).toEqual(BLOCKER_DENIALS[blocker]);
			}
		}
	});
	it("emits no denial for absent or eligible requests; keeps codes locale-neutral (SC-PROJ-011/017)", () => {
		const cases: ReadonlyArray<{ status: AccountingMissionStatus; request?: MissionProjectionRequest }> = [
			{ status: S.DRAFT }, { status: S.QUEUED, request: { requestedContinuation: S.RUNNING } },
			{ status: S.RUNNING, request: { requestedContinuation: S.COMPLETED } },
			{ status: S.UNKNOWN, request: { requestedContinuation: S.RUNNING } },
			{ status: S.UNKNOWN, request: { requestedContinuation: S.COMPLETED } }, { status: S.COMPLETED },
		];
		for (const c of cases) expect(asProjection(projectMission({ status: c.status }, c.request)).deny).toBeUndefined();
		const low = /^[a-z0-9-]+$/;
		for (const status of ALL) expect(asProjection(projectMission({ status })).nextAction).toMatch(low);
		const denied = asProjection(projectMission({ status: S.DRAFT }, { requestedContinuation: S.COMPLETED }));
		expect(denied.deny?.code).toMatch(/^[A-Z0-9_]+$/);
		expect(denied.deny?.cause).toMatch(low);
		expect(denied.deny?.continuation).toMatch(low);
	});
});

describe("T-PRJ-004 fail closed and read-only", () => {
	it("fails closed with only an UNSUPPORTED_STATUS denial (REQ-PROJ-007, SC-PROJ-012)", () => {
		for (const c of MALFORMED) {
			const result = projectMission(c.snapshot as MissionProjectionSnapshot, c.request as MissionProjectionRequest | undefined);
			expect("status" in result).toBe(false);
			expect("eligibleTransitions" in result).toBe(false);
			expect("nextAction" in result).toBe(false);
			expect(result.deny).toEqual(c.expected);
		}
	});
	it("keeps a canonical matrix entry for every enum value", () => {
		expect(ALL).toHaveLength(15);
		for (const status of ALL) expect(VALID_TRANSITIONS.has(status)).toBe(true);
	});
	it("never invokes a guard for ineligible requests (SC-PROJ-013)", () => {
		for (const status of ALL) {
			expect(asProjection(projectMission({ status }, { requestedContinuation: ineligibleTarget(status) })).deny?.code).toBe("INVALID_TRANSITION");
		}
	});
});

describe("T-PRJ-005 determinism and immutability", () => {
	it("is deterministic, preserves canonical order, and allocates distinct refs (SC-PROJ-004/014)", () => {
		const first = asProjection(projectMission({ status: S.RUNNING }));
		const expected = [...VALID_TRANSITIONS.get(S.RUNNING)!];
		for (let i = 0; i < 25; i++) {
			expect(asProjection(projectMission({ status: S.RUNNING }))).toEqual(first);
		}
		const again = asProjection(projectMission({ status: S.RUNNING }));
		expect(again).not.toBe(first);
		expect(again.eligibleTransitions).toEqual(expected);
		expect(again.eligibleTransitions).not.toBe(first.eligibleTransitions);
	});
	it("returns frozen references; consumer mutation cannot leak (REQ-PROJ-010, SC-PROJ-015)", () => {
		const p = asProjection(projectMission({ status: S.QUEUED }));
		const q = asProjection(projectMission({ status: S.QUEUED }));
		expect(q).not.toBe(p);
		expect(q.eligibleTransitions).not.toBe(p.eligibleTransitions);
		expect(Object.isFrozen(q)).toBe(true);
		expect(Object.isFrozen(q.eligibleTransitions)).toBe(true);
		expect(() => (q.eligibleTransitions as string[]).push("COMPLETED")).toThrow(TypeError);
		expect([...VALID_TRANSITIONS.get(S.QUEUED)!]).toEqual([S.RUNNING, S.FAILED]);
		const later = asProjection(projectMission({ status: S.QUEUED }));
		expect(later.eligibleTransitions).toEqual([S.RUNNING, S.FAILED]);
		expect(later.eligibleTransitions).not.toBe(q.eligibleTransitions);
		expect(Object.isFrozen(later.eligibleTransitions)).toBe(true);
	});
	it("freezes denials, recovery arrays, and fail-closed results", () => {
		const denied = asProjection(projectMission({ status: S.DRAFT }, { requestedContinuation: S.COMPLETED }));
		expect(Object.isFrozen(denied.deny!)).toBe(true);
		const unknown = asProjection(projectMission({ status: S.UNKNOWN }));
		expect(Object.isFrozen(unknown.eligibleTransitions)).toBe(true);
		expect(Object.isFrozen(unknown.recoveryTransitions!)).toBe(true);
		const failClosed = projectMission(null as unknown as MissionProjectionSnapshot);
		expect(Object.isFrozen(failClosed)).toBe(true);
		expect(Object.isFrozen(failClosed.deny)).toBe(true);
	});
});
