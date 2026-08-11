import { describe, expect, it } from "vitest";
import { runGuardianReview } from "../index.js";
import type { Candidate, CandidateReview } from "../../candidates/types.js";

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

describe("runGuardianReview", () => {
	it("reports no findings for a clean candidate", () => {
		const report = runGuardianReview(candidate());
		expect(report.findings).toHaveLength(0);
	});

	it("never issues a verdict — the Guardian only surfaces findings", () => {
		const report = runGuardianReview(candidate());
		expect(report.verdict).toBe("none");
	});

	it("flags invalid scope (RUC and period) as blockers", () => {
		const report = runGuardianReview(
			candidate({ scope: { ruc: "123", period: "2026" } }),
		);
		expect(report.findings.filter((f) => f.category === "scope")).toHaveLength(
			2,
		);
		expect(report.findings.every((f) => f.severity === "blocker")).toBe(true);
	});

	it("flags a missing subject hash", () => {
		const report = runGuardianReview(candidate({ subjectHash: "" }));
		expect(report.findings.some((f) => f.category === "integrity")).toBe(true);
	});

	it("requires dual distinct approval for R3", () => {
		const oneApprover = runGuardianReview(
			candidate({ materiality: "R3", reviews: [review("alicia")] }),
		);
		expect(oneApprover.findings.some((f) => f.category === "approval")).toBe(
			true,
		);

		const duplicate = runGuardianReview(
			candidate({
				materiality: "R3",
				reviews: [review("alicia"), review("alicia")],
			}),
		);
		expect(
			duplicate.findings.some((f) =>
				f.description.includes("single reviewer identity"),
			),
		).toBe(true);

		const dual = runGuardianReview(
			candidate({
				materiality: "R3",
				reviews: [review("alicia"), review("beto")],
			}),
		);
		expect(dual.findings.filter((f) => f.category === "approval")).toHaveLength(
			0,
		);
	});

	it("does not demand dual approval when disabled", () => {
		const report = runGuardianReview(
			candidate({ materiality: "R3", reviews: [review("alicia")] }),
			{ r3DualRequired: false },
		);
		expect(
			report.findings.filter((f) => f.category === "approval"),
		).toHaveLength(0);
	});

	it("notes missing review history on material candidates (concern, not blocker)", () => {
		const report = runGuardianReview(
			candidate({ materiality: "R2", reviews: [] }),
		);
		expect(report.findings.some((f) => f.severity === "concern")).toBe(true);
	});

	it("is read-only: does not mutate the candidate", () => {
		const frozen = candidate();
		const before = JSON.stringify(frozen);
		runGuardianReview(frozen);
		expect(JSON.stringify(frozen)).toBe(before);
	});

	it("orders findings by severity (blockers first)", () => {
		const report = runGuardianReview(
			candidate({
				materiality: "R3",
				scope: { ruc: "x", period: "y" },
				reviews: [],
			}),
		);
		expect(report.findings[0]!.severity).toBe("blocker");
	});
});
