/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Work routing tests — ported from
 * @drenyra/drenyra-orchestrator/__tests__/work-routing.test.ts (same cases,
 * imports adapted to ../workload.js). One extra case covers the
 * critical-subsystem + fresh-reviewer branch.
 */

import { describe, expect, it } from "vitest";
import {
	forecastReviewWorkload,
	getWorkflowInstructions,
} from "../workload.js";

describe("work-routing", () => {
	describe("forecastReviewWorkload", () => {
		it("recommends single-pr for small low-risk changes", () => {
			const result = forecastReviewWorkload({
				estimatedLines: 50,
				estimatedFiles: 1,
				affectedSubsystems: ["ui"],
				isMechanicalRefactor: false,
				isFiscalChange: false,
				reviewerContext: "has-context",
			});
			expect(result.deliveryStrategy).toBe("single-pr");
			expect(result.chainedPRsRecommended).toBe(false);
			expect(result.decisionNeeded).toBe(false);
		});

		it("recommends exception-ok for mechanical refactors", () => {
			const result = forecastReviewWorkload({
				estimatedLines: 500,
				estimatedFiles: 5,
				affectedSubsystems: ["ui"],
				isMechanicalRefactor: true,
				isFiscalChange: false,
				reviewerContext: "fresh",
			});
			expect(result.deliveryStrategy).toBe("exception-ok");
			expect(result.chainedPRsRecommended).toBe(false);
		});

		it("recommends chained PRs for large changes", () => {
			const result = forecastReviewWorkload({
				estimatedLines: 600,
				estimatedFiles: 3,
				affectedSubsystems: ["api", "domain"],
				isMechanicalRefactor: false,
				isFiscalChange: false,
				reviewerContext: "fresh",
			});
			expect(result.chainedPRsRecommended).toBe(true);
			expect(result.deliveryStrategy).toBe("ask-on-risk");
			expect(result.decisionNeeded).toBe(true);
		});

		it("recommends chained PRs for fiscal changes over threshold", () => {
			const result = forecastReviewWorkload({
				estimatedLines: 450,
				estimatedFiles: 2,
				affectedSubsystems: ["fiscal", "sunat"],
				isMechanicalRefactor: false,
				isFiscalChange: true,
				reviewerContext: "fresh",
			});
			expect(result.chainedPRsRecommended).toBe(true);
			expect(result.deliveryStrategy).toBe("ask-on-risk");
			expect(result.decisionNeeded).toBe(true);
		});

		it("recommends auto-chain for large refactors with clear phases", () => {
			const result = forecastReviewWorkload({
				estimatedLines: 300,
				estimatedFiles: 4,
				affectedSubsystems: ["api", "domain", "persistence"],
				isMechanicalRefactor: false,
				isFiscalChange: false,
				reviewerContext: "has-context",
			});
			expect(result.deliveryStrategy).toBe("auto-chain");
			expect(result.chainedPRsRecommended).toBe(true);
		});

		it("asks on risk for critical subsystems with a fresh reviewer", () => {
			const result = forecastReviewWorkload({
				estimatedLines: 50,
				estimatedFiles: 1,
				affectedSubsystems: ["fiscal"],
				isMechanicalRefactor: false,
				isFiscalChange: false,
				reviewerContext: "fresh",
			});
			expect(result.deliveryStrategy).toBe("ask-on-risk");
			expect(result.chainedPRsRecommended).toBe(false);
			expect(result.decisionNeeded).toBe(false);
		});
	});

	describe("getWorkflowInstructions", () => {
		it("returns bugfix workflow", () => {
			const instructions = getWorkflowInstructions("bugfix");
			expect(instructions).toHaveLength(6);
			expect(instructions[0]).toContain("git status");
		});

		it("returns fiscal-change workflow with compliance gates", () => {
			const instructions = getWorkflowInstructions("fiscal-change");
			expect(instructions).toHaveLength(7);
			expect(instructions.some((i) => i.includes("compliance:sire-gate"))).toBe(
				true,
			);
			expect(
				instructions.some((i) => i.includes("compliance:sire-repro")),
			).toBe(true);
		});

		it("returns review workflow with findings ledger", () => {
			const instructions = getWorkflowInstructions("review");
			expect(instructions.some((i) => i.includes("ledger"))).toBe(true);
		});

		it("returns docs workflow with Diátaxis", () => {
			const instructions = getWorkflowInstructions("docs");
			expect(instructions.some((i) => i.includes("Diátaxis"))).toBe(true);
		});
	});
});
