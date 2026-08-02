/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Lens selection tests — ported from
 * @drenyra/drenyra-orchestrator/__tests__/review-lenses.test.ts (same cases,
 * imports adapted to ../lenses.js). One extra case exercises the `_` segment
 * separator that isHotPath also matches.
 */

import { describe, expect, it } from "vitest";
import { isHotPath, selectReviewLenses } from "../lenses.js";

describe("review-lenses", () => {
	describe("isHotPath", () => {
		it("detects fiscal hot path", () => {
			expect(isHotPath("packages/fiscal-sdd/src/types.ts")).toBe(true);
		});

		it("detects auth hot path", () => {
			expect(isHotPath("apps/api/src/features/auth/routes.ts")).toBe(true);
		});

		it("detects compliance hot path", () => {
			expect(isHotPath("packages/compliance/src/gatekeeper.ts")).toBe(true);
		});

		it("returns false for non-hot paths", () => {
			expect(isHotPath("packages/ui/src/components/Button.tsx")).toBe(false);
		});

		it("detects sunat hot path", () => {
			expect(isHotPath("apps/api/src/features/sunat/invoice.ts")).toBe(true);
		});

		it("supports custom hot paths", () => {
			expect(isHotPath("packages/billing/src/invoice.ts", ["billing"])).toBe(
				true,
			);
		});

		it("matches underscore-separated segments too", () => {
			expect(isHotPath("apps/api/src/features/fiscal_sunat/report.ts")).toBe(
				true,
			);
		});
	});

	describe("selectReviewLenses", () => {
		it("returns advisory readability for pre-commit", () => {
			const result = selectReviewLenses({
				filePaths: ["src/button.tsx"],
				changedLines: 20,
				isPreCommit: true,
				isPrePR: false,
				isPostSDDPhase: false,
			});
			expect(result.selectedLenses).toEqual(["review-readability"]);
			expect(result.blocking).toBe(false);
		});

		it("returns advisory readability for pre-push", () => {
			const result = selectReviewLenses({
				filePaths: ["src/button.tsx"],
				changedLines: 20,
				isPreCommit: false,
				isPrePR: false,
				isPostSDDPhase: false,
			});
			expect(result.selectedLenses).toEqual(["review-readability"]);
			expect(result.blocking).toBe(false);
		});

		it("returns full 4R for hot path on pre-PR", () => {
			const result = selectReviewLenses({
				filePaths: ["packages/fiscal-sdd/src/types.ts"],
				changedLines: 50,
				isPreCommit: false,
				isPrePR: true,
				isPostSDDPhase: false,
			});
			expect(result.selectedLenses).toHaveLength(4);
			expect(result.selectedLenses).toContain("review-risk");
			expect(result.selectedLenses).toContain("review-resilience");
			expect(result.selectedLenses).toContain("review-readability");
			expect(result.selectedLenses).toContain("review-reliability");
			expect(result.blocking).toBe(true);
		});

		it("returns full 4R for large diff on pre-PR", () => {
			const result = selectReviewLenses({
				filePaths: ["src/button.tsx"],
				changedLines: 500,
				isPreCommit: false,
				isPrePR: true,
				isPostSDDPhase: false,
			});
			expect(result.selectedLenses).toHaveLength(4);
			expect(result.blocking).toBe(true);
		});

		it("returns readability for small pre-PR without hot paths", () => {
			const result = selectReviewLenses({
				filePaths: ["src/button.tsx"],
				changedLines: 50,
				isPreCommit: false,
				isPrePR: true,
				isPostSDDPhase: false,
			});
			expect(result.selectedLenses).toEqual(["review-readability"]);
			expect(result.blocking).toBe(false);
		});

		it("returns judgment-day for post-SDD phase", () => {
			const result = selectReviewLenses({
				filePaths: ["packages/fiscal-sdd/src/types.ts"],
				changedLines: 200,
				isPreCommit: false,
				isPrePR: false,
				isPostSDDPhase: true,
			});
			expect(result.selectedLenses).toEqual(["judgment-day"]);
			expect(result.blocking).toBe(true);
		});

		it("respects custom line threshold", () => {
			const result = selectReviewLenses({
				filePaths: ["src/button.tsx"],
				changedLines: 200,
				isPreCommit: false,
				isPrePR: true,
				isPostSDDPhase: false,
				lineThreshold: 100,
			});
			expect(result.selectedLenses).toHaveLength(4);
			expect(result.blocking).toBe(true);
		});
	});
});
