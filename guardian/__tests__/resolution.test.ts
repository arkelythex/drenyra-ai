import { describe, expect, it } from "vitest";
import type {
	GuardianCategory,
	GuardianFinding,
	GuardianReport,
	GuardianSeverity,
} from "../index.js";
import {
	type ResolutionDisposition,
	type ResolutionRecord,
	resolveFinding,
} from "../resolution.js";

function finding(
	id: string,
	severity: GuardianSeverity = "blocker",
	category: GuardianCategory = "scope",
): GuardianFinding {
	return { id, severity, category, description: `finding ${id}` };
}

function report(
	findings: readonly GuardianFinding[],
	candidateHash = "candidate-hash-1",
): GuardianReport {
	return {
		candidateHash,
		findings,
		verdict: "none",
		reviewedAt: "2026-07-10T00:00:00.000Z",
	};
}

function record(overrides: Partial<ResolutionRecord> = {}): ResolutionRecord {
	return {
		finding: finding("f-1"),
		actorId: "actor-1",
		disposition: "resolved",
		reason: "evidence confirms the concern is resolved",
		referenceTime: "2026-07-11T00:00:00.000Z",
		candidateHash: "candidate-hash-1",
		...overrides,
	};
}

describe("resolveFinding — T-GU-005 lifecycle", () => {
	it("applies a valid resolved record to an open finding and freezes it", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = resolveFinding(rep, record({ finding: bound }));
		expect(result.state).toBe("applied");
		if (result.state === "applied") {
			expect(result.record.disposition).toBe("resolved");
			expect(result.record.actorId).toBe("actor-1");
			expect(Object.isFrozen(result)).toBe(true);
			expect(Object.isFrozen(result.record)).toBe(true);
			expect(Object.isFrozen(result.record.finding)).toBe(true);
		}
	});

	it("applies a valid dismissed record to an open finding", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = resolveFinding(
			rep,
			record({ finding: bound, disposition: "dismissed", reason: "not material" }),
		);
		expect(result.state).toBe("applied");
		if (result.state === "applied") {
			expect(result.record.disposition).toBe("dismissed");
			expect(result.record.reason).toBe("not material");
		}
	});

	it("denies any second transition on an already-resolved finding", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const first = resolveFinding(rep, record({ finding: bound }));
		expect(first.state).toBe("applied");

		const againResolved = resolveFinding(rep, record({ finding: bound }), "resolved");
		expect(againResolved.state).toBe("denied");
		if (againResolved.state === "denied") {
			expect(againResolved.code).toBe("already-resolved");
		}

		const dismissed = resolveFinding(
			rep,
			record({ finding: bound, disposition: "dismissed" }),
			"resolved",
		);
		expect(dismissed.state).toBe("denied");
		if (dismissed.state === "denied") {
			expect(dismissed.code).toBe("already-resolved");
		}
	});

	it("denies any second transition on an already-dismissed finding", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const first = resolveFinding(
			rep,
			record({ finding: bound, disposition: "dismissed" }),
		);
		expect(first.state).toBe("applied");

		const resolved = resolveFinding(rep, record({ finding: bound }), "dismissed");
		expect(resolved.state).toBe("denied");
		if (resolved.state === "denied") {
			expect(resolved.code).toBe("already-dismissed");
		}

		const again = resolveFinding(
			rep,
			record({ finding: bound, disposition: "dismissed" }),
			"dismissed",
		);
		expect(again.state).toBe("denied");
		if (again.state === "denied") {
			expect(again.code).toBe("already-dismissed");
		}
	});

	it("offers no reopen or revocation path — a terminal finding never produces a record", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const terminal = resolveFinding(
			rep,
			record({ finding: bound, disposition: "dismissed" }),
			"dismissed",
		);
		expect(terminal.state).toBe("denied");
		if (terminal.state === "denied") {
			expect(terminal.code).toBe("already-dismissed");
			expect("record" in terminal).toBe(false);
		}
	});

	it("is deterministic and freezes denial outcomes", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const first = resolveFinding(rep, record({ finding: bound }), "resolved");
		const second = resolveFinding(rep, record({ finding: bound }), "resolved");
		expect(first).toEqual(second);
		if (first.state === "denied") {
			expect(Object.isFrozen(first)).toBe(true);
		}
	});
});

describe("resolveFinding — T-GU-006 denials", () => {
	it("denies an empty reason with empty-reason", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = resolveFinding(rep, record({ finding: bound, reason: "" }));
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("empty-reason");
		}
	});

	it("denies an empty actorId with missing-actor", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = resolveFinding(rep, record({ finding: bound, actorId: "  " }));
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("missing-actor");
		}
	});

	it("denies a missing or malformed referenceTime with missing-timestamp", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const missing = resolveFinding(
			rep,
			record({ finding: bound, referenceTime: "" }),
		);
		expect(missing.state).toBe("denied");
		if (missing.state === "denied") {
			expect(missing.code).toBe("missing-timestamp");
		}
		const malformed = resolveFinding(
			rep,
			record({ finding: bound, referenceTime: "not-an-iso-timestamp" }),
		);
		expect(malformed.state).toBe("denied");
		if (malformed.state === "denied") {
			expect(malformed.code).toBe("missing-timestamp");
		}
	});

	it("denies wrong fields or types with malformed-record", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const invalidDisposition = {
			...record({ finding: bound }),
			disposition: "pending",
		} as unknown as ResolutionRecord;
		expect(resolveFinding(rep, invalidDisposition).state).toBe("denied");
		const stringFinding = {
			...record({ finding: bound }),
			finding: "f-1",
		} as unknown as ResolutionRecord;
		expect(resolveFinding(rep, stringFinding).state).toBe("denied");
		const numericEvidence = {
			...record({ finding: bound }),
			evidence: 42,
		} as unknown as ResolutionRecord;
		expect(resolveFinding(rep, numericEvidence).state).toBe("denied");
	});

	it("denies a foreign finding with unknown-finding", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = resolveFinding(rep, record({ finding: finding("f-9") }));
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("unknown-finding");
		}
	});

	it("denies an asserted identity mismatch with candidate-changed", () => {
		const bound = finding("f-1");
		const rep = report([bound], "candidate-hash-a");
		const result = resolveFinding(
			rep,
			record({ finding: bound, candidateHash: "candidate-hash-b" }),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("candidate-changed");
		}
	});

	it("returns the closed denial code for each of the 8 resolution codes", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const cases: readonly {
			name: string;
			record: ResolutionRecord;
			disposition?: ResolutionDisposition;
			code: string;
		}[] = [
			{
				name: "already-resolved",
				record: record({ finding: bound }),
				disposition: "resolved",
				code: "already-resolved",
			},
			{
				name: "already-dismissed",
				record: record({ finding: bound }),
				disposition: "dismissed",
				code: "already-dismissed",
			},
			{
				name: "empty-reason",
				record: record({ finding: bound, reason: "  " }),
				code: "empty-reason",
			},
			{
				name: "missing-actor",
				record: record({ finding: bound, actorId: "" }),
				code: "missing-actor",
			},
			{
				name: "missing-timestamp",
				record: record({
					finding: bound,
					referenceTime: "not-an-iso-timestamp",
				}),
				code: "missing-timestamp",
			},
			{
				name: "malformed-record",
				record: {
					...record({ finding: bound }),
					disposition: "pending",
				} as unknown as ResolutionRecord,
				code: "malformed-record",
			},
			{
				name: "unknown-finding",
				record: record({ finding: finding("f-9") }),
				code: "unknown-finding",
			},
			{
				name: "candidate-changed",
				record: record({ finding: bound, candidateHash: "other-hash" }),
				code: "candidate-changed",
			},
		];
		for (const c of cases) {
			const result = resolveFinding(rep, c.record, c.disposition);
			expect(result.state, c.name).toBe("denied");
			if (result.state === "denied") {
				expect(result.code, c.name).toBe(c.code);
				expect(result.cause.length, c.name).toBeGreaterThan(0);
				expect(result.continuation.length, c.name).toBeGreaterThan(0);
				expect(Object.isFrozen(result), c.name).toBe(true);
			}
		}
	});

	it("follows deterministic first-failure-wins ordering (D7/D8)", () => {
		const bound = finding("f-1");
		const rep = report([bound]);

		const malformedFirst = resolveFinding(
			rep,
			{
				...record({ finding: finding("f-9") }),
				disposition: "pending",
			} as unknown as ResolutionRecord,
		);
		expect(malformedFirst.state).toBe("denied");
		if (malformedFirst.state === "denied") {
			expect(malformedFirst.code).toBe("malformed-record");
		}

		const membershipFirst = resolveFinding(
			rep,
			record({ finding: finding("f-9"), reason: "" }),
		);
		expect(membershipFirst.state).toBe("denied");
		if (membershipFirst.state === "denied") {
			expect(membershipFirst.code).toBe("unknown-finding");
		}

		const identityBeforeContent = resolveFinding(
			rep,
			record({ finding: bound, candidateHash: "other-hash", reason: "" }),
		);
		expect(identityBeforeContent.state).toBe("denied");
		if (identityBeforeContent.state === "denied") {
			expect(identityBeforeContent.code).toBe("candidate-changed");
		}

		const contentBeforeDisposition = resolveFinding(
			rep,
			record({ finding: bound, reason: "" }),
			"resolved",
		);
		expect(contentBeforeDisposition.state).toBe("denied");
		if (contentBeforeDisposition.state === "denied") {
			expect(contentBeforeDisposition.code).toBe("empty-reason");
		}
	});

	it("never throws for expected invalid input (SC-GU-028)", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const invalidInputs: readonly {
			record: unknown;
			disposition?: unknown;
		}[] = [
			{ record: null },
			{ record: "not-a-record" },
			{ record: { ...record({ finding: bound }), disposition: "pending" } },
			{ record: { ...record({ finding: bound }), finding: "f-1" } },
			{ record: { ...record({ finding: bound }), actorId: "" } },
			{ record: { ...record({ finding: bound }), reason: "   " } },
			{ record: { ...record({ finding: bound }), referenceTime: "" } },
			{ record: { ...record({ finding: bound }), referenceTime: "not-iso" } },
			{ record: { ...record({ finding: bound }), evidence: 42 } },
			{ record: { ...record({ finding: bound }), candidateHash: 42 } },
			{ record: record({ finding: finding("f-9") }) },
			{ record: record({ finding: bound, candidateHash: "other-hash" }) },
			{ record: record({ finding: bound }), disposition: "open" },
		];
		for (const input of invalidInputs) {
			let outcome: unknown;
			expect(() => {
				outcome = resolveFinding(
					rep,
					input.record as ResolutionRecord,
					input.disposition as ResolutionDisposition | undefined,
				);
			}).not.toThrow();
			if (outcome !== null && typeof outcome === "object") {
				expect((outcome as { state?: string }).state).toBe("denied");
			}
		}
	});
});
