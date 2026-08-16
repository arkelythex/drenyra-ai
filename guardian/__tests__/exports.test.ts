import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Candidate, CandidateReview } from "../../candidates/types.js";
import {
	challengeRefutation,
	evaluateDualReview,
	type GuardianCategory,
	type GuardianFinding,
	type GuardianReport,
	type GuardianSeverity,
	type RefutationChallenge,
	type RefutationReview,
	type ResolutionRecord,
	resolveFinding,
	runGuardianReview,
} from "../index.js";

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

function dualReview(reviewerId: string, verdict: "uphold" | "refute" | "downgrade"): RefutationReview {
	return { reviewerId, verdict };
}

function resolutionRecord(overrides: Partial<ResolutionRecord> = {}): ResolutionRecord {
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

function review(
	reviewer: string,
	verdict: "accept" | "reject" = "accept",
): CandidateReview {
	return {
		id: `review-${reviewer}`,
		verdict,
		reviewer,
		reviewedAt: "2026-07-10T00:00:00.000Z",
	};
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
	return {
		id: "cand-1",
		subjectHash: "a".repeat(64),
		scope: { ruc: "20131312955", period: "202607" },
		materiality: "R1",
		status: "reviewing",
		reviews: [],
		corrections: [],
		createdAt: "2026-07-01T00:00:00.000Z",
		version: 1,
		...overrides,
	};
}

describe("T-GU-007 advisory-only boundary", () => {
	it("leaves the report verdict none and the candidate bytes unchanged", () => {
		const cand = candidate({ materiality: "R3", reviews: [review("alicia")] });
		const before = JSON.stringify(cand);
		const rep = runGuardianReview(cand);
		expect(rep.verdict).toBe("none");

		const bound = rep.findings[0]!;
		const ch = challenge({ finding: bound, candidateHash: rep.candidateHash });
		expect(challengeRefutation(rep, ch)).toEqual({ state: "accepted" });

		const dual = evaluateDualReview(
			rep,
			ch,
			dualReview("r-a", "uphold"),
			dualReview("r-b", "refute"),
		);
		expect(dual).toEqual({ state: "inconsistent", escalation: "required" });

		const resolution = resolveFinding(
			rep,
			resolutionRecord({
				finding: bound,
				disposition: "dismissed",
				reason: "not material",
				candidateHash: rep.candidateHash,
			}),
		);
		expect(resolution.state).toBe("applied");

		expect(rep.verdict).toBe("none");
		expect(rep.candidateHash).toBe(cand.subjectHash);
		expect(JSON.stringify(cand)).toBe(before);
	});

	it("carries no approval signal in any outcome (SC-GU-022)", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });

		const consistent = evaluateDualReview(
			rep,
			ch,
			dualReview("r-a", "uphold"),
			dualReview("r-b", "uphold"),
		);
		expect(consistent.state).toBe("consistent");
		if (consistent.state === "consistent") {
			expect(["uphold", "refute", "downgrade"]).toContain(consistent.verdict);
			expect(JSON.stringify(consistent)).not.toMatch(/accept|reject|quorum/i);
			expect(JSON.stringify(consistent)).not.toContain("CandidateReviewVerdict");
		}

		const inconsistent = evaluateDualReview(
			rep,
			ch,
			dualReview("r-a", "uphold"),
			dualReview("r-b", "refute"),
		);
		expect(Object.keys(inconsistent).sort()).toEqual(["escalation", "state"]);
		expect(JSON.stringify(inconsistent)).not.toMatch(/accept|reject|quorum/i);
		expect(JSON.stringify(inconsistent)).not.toContain("CandidateReviewVerdict");

		const applied = resolveFinding(rep, resolutionRecord({ finding: bound }));
		expect(applied.state).toBe("applied");
		expect(JSON.stringify(applied)).not.toMatch(/accept|reject|quorum|verdict/i);
		expect(JSON.stringify(applied)).not.toContain("CandidateReviewVerdict");
	});
});

describe("T-GU-007 immutability and determinism", () => {
	it("freezes outcomes and makes created records source-independent", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const applied = resolveFinding(rep, resolutionRecord({ finding: bound }));
		expect(applied.state).toBe("applied");
		if (applied.state === "applied") {
			const snapshot = JSON.stringify(applied.record);
			bound.description = "mutated after the record was created";
			bound.severity = "info";
			expect(JSON.stringify(applied.record)).toBe(snapshot);
			expect(applied.record.finding.description).toBe("finding f-1");
			expect(applied.record.finding.severity).toBe("blocker");
			expect(Object.isFrozen(applied)).toBe(true);
			expect(Object.isFrozen(applied.record)).toBe(true);
			expect(Object.isFrozen(applied.record.finding)).toBe(true);
		}

		const dual = evaluateDualReview(
			rep,
			challenge({ finding: bound }),
			dualReview("r-a", "uphold"),
			dualReview("r-b", "uphold"),
		);
		expect(Object.isFrozen(dual)).toBe(true);
	});

	it("produces deeply-equal outputs for identical inputs", () => {
		const bound = finding("f-1");
		const rep = report([bound]);
		const ch = challenge({ finding: bound });
		const dualFirst = evaluateDualReview(
			rep,
			ch,
			dualReview("r-a", "uphold"),
			dualReview("r-b", "refute"),
		);
		const dualSecond = evaluateDualReview(
			rep,
			ch,
			dualReview("r-a", "uphold"),
			dualReview("r-b", "refute"),
		);
		expect(dualFirst).toEqual(dualSecond);

		const rec = resolutionRecord({ finding: bound });
		const resolutionFirst = resolveFinding(rep, rec);
		const resolutionSecond = resolveFinding(rep, rec);
		expect(resolutionFirst).toEqual(resolutionSecond);
	});

	it("contains no clock reads in either module (SC-GU-029)", () => {
		const refutationSource = readFileSync(
			new URL("../refutation.ts", import.meta.url),
			"utf8",
		);
		const resolutionSource = readFileSync(
			new URL("../resolution.ts", import.meta.url),
			"utf8",
		);
		expect(refutationSource).not.toContain("Date.now");
		expect(refutationSource).not.toContain("new Date");
		expect(resolutionSource).not.toContain("Date.now");
		expect(resolutionSource).not.toContain("new Date");
		expect(refutationSource).not.toContain("CandidateReviewVerdict");
		expect(resolutionSource).not.toContain("CandidateReviewVerdict");
	});
});

describe("T-GU-007 barrel exports (SC-GU-031)", () => {
	it("resolves every refutation and resolution symbol from the guardian barrel", () => {
		expect(typeof challengeRefutation).toBe("function");
		expect(typeof evaluateDualReview).toBe("function");
		expect(typeof resolveFinding).toBe("function");
		expect(typeof runGuardianReview).toBe("function");
	});

	it("keeps the existing Guardian single-review behavior green", () => {
		const clean = runGuardianReview(candidate());
		expect(clean.verdict).toBe("none");
		expect(clean.findings).toHaveLength(0);

		const dirty = runGuardianReview(
			candidate({ scope: { ruc: "123", period: "2026" } }),
		);
		expect(dirty.findings.every((f) => f.severity === "blocker")).toBe(true);
	});
});
