/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** PE policy tests (1E-1): PE evaluation, non-PE/unknown fail-closed, materiality
 * threshold escalation, insufficient evidence, scope mismatch, spy precondition proofs. */
import { describe, expect, it, vi } from "vitest";
import { HIGH_VALUE_CENTS } from "../../candidates/materiality.js";
import type { AcceptedEvidence } from "../../evidence/index.js";
import { FISCAL_JURISDICTION, POLICY_DECISION, POLICY_REASON, PolicyError, evaluatePePolicy, govern } from "../index.js";
import type { PolicySubject } from "../index.js";

const stubEvidence = (scopeKey: string): AcceptedEvidence => ({ scopeKey }) as unknown as AcceptedEvidence;

const subject = (over: Partial<PolicySubject> = {}): PolicySubject => ({
	jurisdiction: FISCAL_JURISDICTION.PE,
	valueCents: 1_000n,
	evidence: [stubEvidence("scope-a")],
	scopeKey: "scope-a",
	...over,
});

describe("evaluatePePolicy — PE jurisdiction only", () => {
	it("applies the PE restriction rules to a valid PE subject", () => {
		expect(evaluatePePolicy(subject())).toEqual({ decision: POLICY_DECISION.ALLOW, reason: POLICY_REASON.PE_RULES_APPLIED });
	});
	it("never auto-accepts a non-PE jurisdiction", () => {
		const outcome = evaluatePePolicy(subject({ jurisdiction: "CL" }));
		expect(outcome.decision).toBe(POLICY_DECISION.BLOCK);
		expect(outcome.reason).toBe(POLICY_REASON.NON_PE_JURISDICTION);
	});
	it("fails closed on an unknown/unsupported jurisdiction and never treats it as PE", () => {
		for (const jurisdiction of ["", "unknown", "zz"]) {
			expect(evaluatePePolicy(subject({ jurisdiction })).decision).not.toBe(POLICY_DECISION.ALLOW);
		}
		expect(evaluatePePolicy(subject({ jurisdiction: "" })).reason).toBe(POLICY_REASON.UNSUPPORTED_JURISDICTION);
	});
	it("blocks malformed input as unknown", () => {
		for (const malformed of [null, { jurisdiction: 42 }, { scopeKey: "" }]) {
			const outcome = evaluatePePolicy(malformed as unknown as PolicySubject);
			expect(outcome).toEqual({ decision: POLICY_DECISION.BLOCK, reason: POLICY_REASON.UNKNOWN_INPUT });
		}
	});
});

describe("evaluatePePolicy — journal and CDR restrictions (fail-closed)", () => {
	it("escalates a journal transition above the PE materiality threshold, never silently permitting it", () => {
		for (const valueCents of [HIGH_VALUE_CENTS, HIGH_VALUE_CENTS + 1n]) {
			expect(evaluatePePolicy(subject({ valueCents }))).toEqual({ decision: POLICY_DECISION.ESCALATE, reason: POLICY_REASON.ABOVE_PE_THRESHOLD });
		}
	});
	it("escalates insufficient bound evidence with no auto-accept", () => {
		expect(evaluatePePolicy(subject({ evidence: [] }))).toEqual({ decision: POLICY_DECISION.ESCALATE, reason: POLICY_REASON.INSUFFICIENT_EVIDENCE });
	});
	it("blocks on evidence scope mismatch", () => {
		expect(evaluatePePolicy(subject({ evidence: [stubEvidence("scope-other")] }))).toEqual({ decision: POLICY_DECISION.BLOCK, reason: POLICY_REASON.SCOPE_MISMATCH });
	});
});

describe("govern — policy is a precondition (mandatory composition order)", () => {
	it("stops before the journal transition port on BLOCK", () => {
		const journalPort = { apply: vi.fn(() => ({ receipt: "never" })) };
		expect(() => govern(subject({ jurisdiction: "CL" }), evaluatePePolicy, journalPort)).toThrow(PolicyError);
		expect(journalPort.apply).not.toHaveBeenCalled();
	});
	it("stops before mission, candidate, and receipt issuer ports on ESCALATE", () => {
		const missionPort = { apply: vi.fn() };
		const candidatePort = { apply: vi.fn() };
		const receiptIssuer = { apply: vi.fn() };
		for (const port of [missionPort, candidatePort, receiptIssuer]) {
			expect(() => govern(subject({ valueCents: HIGH_VALUE_CENTS, evidence: [] }), evaluatePePolicy, port)).toThrow(PolicyError);
			expect(port.apply).not.toHaveBeenCalled();
		}
	});
	it("only on ALLOW delegates to the owning authority primitive, which still owns validation", () => {
		const authority = { apply: vi.fn((s: PolicySubject) => ({ accepted: s.scopeKey })) };
		const frozen = Object.freeze(subject());
		const result = govern(frozen, evaluatePePolicy, authority);
		expect(result).toEqual({ accepted: "scope-a" });
		expect(authority.apply).toHaveBeenCalledTimes(1);
		expect(authority.apply).toHaveBeenCalledWith(frozen);
	});
});
