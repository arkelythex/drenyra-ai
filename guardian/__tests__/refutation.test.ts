import { describe, expect, it } from "vitest";
import type {
	GuardianCategory,
	GuardianFinding,
	GuardianReport,
	GuardianSeverity,
} from "../index.js";
import {
	challengeRefutation,
	evaluateDualReview,
	type RefutationChallenge,
	type RefutationReview,
	type RefutationVerdict,
} from "../refutation.js";

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

function challenge(overrides: Partial<RefutationChallenge> = {}): RefutationChallenge {
	return {
		finding: finding("f-1"),
		challengerId: "challenger-1",
		reason: "the finding is overstated",
		...overrides,
	};
}

function review(reviewerId: string, verdict: RefutationVerdict): RefutationReview {
	return { reviewerId, verdict };
}

describe("challengeRefutation — T-GU-001 binding", () => {
	it("accepts a challenge binding a finding from the same review", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = challengeRefutation(rep, challenge({ finding: bound }));
		expect(result).toEqual({ state: "accepted" });
	});

	it("denies a foreign finding with unknown-finding and performs no evaluation", () => {
		const bound = finding("f-1");
		const foreign = finding("f-2");
		const rep = report([bound]);
		const result = challengeRefutation(rep, challenge({ finding: foreign }));
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("unknown-finding");
			expect(result.cause).toContain("report.findings");
			expect(result.continuation.length).toBeGreaterThan(0);
		}
	});

	it("denies a challenge without a finding with malformed-challenge", () => {
		const rep = report([finding("f-1")]);
		const result = challengeRefutation(
			rep,
			challenge({ finding: undefined as unknown as GuardianFinding }),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("malformed-challenge");
		}
	});

	it("denies an empty challengerId with malformed-challenge", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = challengeRefutation(
			rep,
			challenge({ finding: bound, challengerId: "" }),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("malformed-challenge");
		}
	});

	it("denies a whitespace-only reason with malformed-challenge", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const result = challengeRefutation(
			rep,
			challenge({ finding: bound, reason: "   " }),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("malformed-challenge");
		}
	});

	it("denies an asserted candidateHash that differs from the report with candidate-changed", () => {
		const bound = finding("f-1");
		const rep = report([bound], "candidate-hash-a");
		const result = challengeRefutation(
			rep,
			challenge({ finding: bound, candidateHash: "candidate-hash-b" }),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("candidate-changed");
		}
	});

	it("accepts a challenge asserting the matching candidateHash", () => {
		const bound = finding("f-1");
		const rep = report([bound], "candidate-hash-a");
		const result = challengeRefutation(
			rep,
			challenge({ finding: bound, candidateHash: "candidate-hash-a" }),
		);
		expect(result).toEqual({ state: "accepted" });
	});

	it("is deterministic and returns frozen denial outcomes", () => {
		const bound = finding("f-1");
		const foreign = finding("f-2");
		const rep = report([bound]);
		const first = challengeRefutation(rep, challenge({ finding: foreign }));
		const second = challengeRefutation(rep, challenge({ finding: foreign }));
		expect(first).toEqual(second);
		if (first.state === "denied") {
			expect(Object.isFrozen(first)).toBe(true);
		}
	});
});

describe("evaluateDualReview — T-GU-002 verdicts and downgrade", () => {
	it("accepts every closed verdict across all severities and categories", () => {
		const severities: readonly GuardianSeverity[] = ["blocker", "concern", "info"];
		const categories: readonly GuardianCategory[] = [
			"scope",
			"materiality",
			"approval",
			"evidence",
			"integrity",
		];
		for (const severity of severities) {
			for (const category of categories) {
				const bound = finding(`f-${severity}-${category}`, severity, category);
				const rep = report([bound]);
				const ch = challenge({ finding: bound });
				expect(challengeRefutation(rep, ch)).toEqual({ state: "accepted" });
				const upheld = evaluateDualReview(
					rep,
					ch,
					review("r-a", "uphold"),
					review("r-b", "uphold"),
				);
				expect(upheld).toEqual({ state: "consistent", verdict: "uphold" });
			}
		}
	});

	it("returns consistent refute for every severity", () => {
		for (const severity of ["blocker", "concern", "info"] as const) {
			const bound = finding("f-1", severity);
			const rep = report([bound]);
			const ch = challenge({ finding: bound });
			const result = evaluateDualReview(
				rep,
				ch,
				review("r-a", "refute"),
				review("r-b", "refute"),
			);
			expect(result).toEqual({ state: "consistent", verdict: "refute" });
		}
	});

	it("denies a verdict outside the closed set with invalid-verdict", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "approve" as RefutationVerdict),
			review("r-b", "refute"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-verdict");
		}
	});

	it("denies downgrade without a severityOverride with downgrade-without-target", () => {
		const bound = finding("f-1", "blocker");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "downgrade"),
			review("r-b", "downgrade"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("downgrade-without-target");
		}
	});

	it("denies downgrade with an equal-severity override", () => {
		const bound = finding("f-1", "blocker");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, severityOverride: "blocker" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "downgrade"),
			review("r-b", "downgrade"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("downgrade-without-target");
		}
	});

	it("denies downgrade with a higher-severity override", () => {
		const bound = finding("f-1", "concern");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, severityOverride: "blocker" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "downgrade"),
			review("r-b", "downgrade"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("downgrade-without-target");
		}
	});

	it("never lowers info — no strictly-lower severity exists", () => {
		const bound = finding("f-1", "info");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, severityOverride: "info" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "downgrade"),
			review("r-b", "downgrade"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("downgrade-without-target");
		}
	});

	it("accepts strictly-lower severityOverrides at each boundary", () => {
		const cases: readonly (readonly [GuardianSeverity, GuardianSeverity])[] = [
			["blocker", "concern"],
			["blocker", "info"],
			["concern", "info"],
		];
		for (const [current, override] of cases) {
			const bound = finding("f-1", current);
			const rep = report([bound]);
			const ch = challenge({ finding: bound, severityOverride: override });
			const result = evaluateDualReview(
				rep,
				ch,
				review("r-a", "downgrade"),
				review("r-b", "downgrade"),
			);
			expect(result.state).toBe("consistent");
			if (result.state === "consistent") {
				expect(result.verdict).toBe("downgrade");
			}
		}
	});
});

describe("evaluateDualReview — T-GU-003 independence", () => {
	it("accepts exactly two distinct reviewers distinct from the challenger", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, challengerId: "challenger-1" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			review("r-b", "uphold"),
		);
		expect(result).toEqual({ state: "consistent", verdict: "uphold" });
	});

	it("denies a reviewer identical to the challenger with invalid-independence", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, challengerId: "r-a" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			review("r-b", "refute"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-independence");
		}
	});

	it("denies duplicate reviewerIds with invalid-independence", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			review("r-a", "refute"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-independence");
		}
	});

	it("denies a missing second review (wrong count) with invalid-independence", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			undefined as unknown as RefutationReview,
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-independence");
		}
	});

	it("denies a review list passed in place of a single review (count enforcement)", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const list = [review("r-a", "uphold"), review("r-b", "refute")];
		const result = evaluateDualReview(
			rep,
			ch,
			list as unknown as RefutationReview,
			review("r-c", "uphold"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-independence");
		}
	});

	it("denies an empty reviewerId with invalid-independence", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			{ reviewerId: "   ", verdict: "uphold" },
			review("r-b", "refute"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-independence");
		}
	});

	it("denies a missing verdict with invalid-verdict, never as consistency", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			{ reviewerId: "r-a", verdict: undefined as unknown as RefutationVerdict },
			review("r-b", "refute"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-verdict");
		}
		expect(result.state).not.toBe("consistent");
	});

	it("never reports an independence denial as consistency", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, challengerId: "r-a" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			review("r-b", "uphold"),
		);
		expect(result.state).toBe("denied");
		if (result.state === "denied") {
			expect(result.code).toBe("invalid-independence");
			expect(result).not.toHaveProperty("verdict");
			expect(result).not.toHaveProperty("escalation");
		}
	});
});

describe("evaluateDualReview — T-GU-004 consistency matrix", () => {
	it("reports consistent uphold for uphold/uphold", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			review("r-b", "uphold"),
		);
		expect(result).toEqual({ state: "consistent", verdict: "uphold" });
	});

	it("reports consistent refute for refute/refute", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "refute"),
			review("r-b", "refute"),
		);
		expect(result).toEqual({ state: "consistent", verdict: "refute" });
	});

	it("reports consistent downgrade with the lowered severity for downgrade/downgrade", () => {
		const bound = finding("f-1", "blocker");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, severityOverride: "concern" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "downgrade"),
			review("r-b", "downgrade"),
		);
		expect(result).toEqual({
			state: "consistent",
			verdict: "downgrade",
			loweredSeverity: "concern",
		});
	});

	it("reports inconsistent with advisory escalation for a mixed verdict pair", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "uphold"),
			review("r-b", "refute"),
		);
		expect(result).toEqual({ state: "inconsistent", escalation: "required" });
		expect("verdict" in result).toBe(false);
	});

	it("reports inconsistent for a downgrade/refute mix with a valid target", () => {
		const bound = finding("f-1", "blocker");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, severityOverride: "concern" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "downgrade"),
			review("r-b", "refute"),
		);
		expect(result).toEqual({ state: "inconsistent", escalation: "required" });
	});

	it("keeps inconsistent advisory-only: no verdict, no approval signal, no third reviewer", () => {
		const bound = finding("f-1", "blocker");
		const rep = report([bound]);
		const ch = challenge({ finding: bound, severityOverride: "concern" });
		const result = evaluateDualReview(
			rep,
			ch,
			review("r-a", "refute"),
			review("r-b", "downgrade"),
		);
		expect(result.state).toBe("inconsistent");
		if (result.state === "inconsistent") {
			expect(result.escalation).toBe("required");
			expect(Object.keys(result).sort()).toEqual(["escalation", "state"]);
			expect(JSON.stringify(result)).not.toMatch(/accept|reject|quorum/i);
			expect(JSON.stringify(result)).not.toContain("reviewer");
		}
	});

	it("computes consistency only after all validation passes", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const invalid = evaluateDualReview(
			rep,
			ch,
			review("r-a", "approve" as RefutationVerdict),
			review("r-b", "approve" as RefutationVerdict),
		);
		expect(invalid.state).toBe("denied");
		if (invalid.state === "denied") {
			expect(invalid.code).toBe("invalid-verdict");
		}
		expect(invalid).not.toHaveProperty("escalation");
	});
});
