/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Adjustment draft unit tests — drafts derive ONLY from classified `bankOnly` /
 * `ledgerOnly` differences; `matched` and `conflict` never produce a draft; an
 * unclassified difference is a blocker (`UNCLASSIFIED_DIFFERENCE`), never a
 * silent adjustment. Approval defaults to `true` with a per-draft override.
 */

import { describe, expect, it } from "vitest";
import { buildAdjustments, type AdjustOptions } from "../adjust.js";
import {
	BankReconciliationError,
	type BankOnlyDifference,
	type Difference,
	type LedgerOnlyDifference,
	type Movement,
} from "../types.js";

const MOVEMENT: Movement = {
	date: "2026-07-15",
	reference: "recibo-001",
	amountCents: 250n,
	side: "inflow",
	source: "bank",
	sourceKey: "b1",
};

function bankOnly(overrides: Partial<Movement> = {}): BankOnlyDifference {
	return {
		classification: "bankOnly",
		bank: { ...MOVEMENT, ...overrides },
	};
}

function ledgerOnly(overrides: Partial<Movement> = {}): LedgerOnlyDifference {
	return {
		classification: "ledgerOnly",
		ledger: { ...MOVEMENT, source: "ledger", sourceKey: "l1", ...overrides },
	};
}

function matchedPair(): Difference {
	return {
		classification: "matched",
		bank: { ...MOVEMENT, sourceKey: "b1" },
		ledger: { ...MOVEMENT, source: "ledger", sourceKey: "l1" },
	};
}

function conflict(): Difference {
	return {
		classification: "conflict",
		reference: "dup-ref",
		bank: [{ ...MOVEMENT, sourceKey: "b1" }, { ...MOVEMENT, sourceKey: "b2" }],
		ledger: [{ ...MOVEMENT, source: "ledger", sourceKey: "l1" }],
	};
}

describe("buildAdjustments() — drafts from classified differences", () => {
	it("yields a justified draft with requireApproval true by default for a bankOnly difference of 250n cents", () => {
		const drafts = buildAdjustments([bankOnly()]);
		expect(drafts).toHaveLength(1);
		const draft = drafts[0];
		expect(draft.draftId).toBe("adj-1");
		expect(draft.reference).toBe("recibo-001");
		expect(draft.source).toBe("bank");
		expect(draft.amountCents).toBe(250n);
		expect(draft.side).toBe("inflow");
		expect(draft.justification).toContain("b1");
		expect(draft.justification).toContain("250");
		expect(draft.requireApproval).toBe(true);
		expect(draft.status).toBe("pending-approval");
	});

	it("yields a ledger-side draft for a ledgerOnly difference", () => {
		const drafts = buildAdjustments([ledgerOnly()]);
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({
			draftId: "adj-1",
			reference: "recibo-001",
			source: "ledger",
			amountCents: 250n,
			side: "inflow",
			requireApproval: true,
			status: "pending-approval",
		});
		expect(drafts[0].justification).toContain("l1");
	});

	it("produces deterministic draft ids in difference order for multiple differences", () => {
		const drafts = buildAdjustments([
			bankOnly({ sourceKey: "b1" }),
			ledgerOnly({ sourceKey: "l1", amountCents: 80n, side: "outflow" }),
		]);
		expect(drafts.map((d) => d.draftId)).toEqual(["adj-1", "adj-2"]);
		expect(drafts.map((d) => d.amountCents)).toEqual([250n, 80n]);
		expect(drafts.map((d) => d.side)).toEqual(["inflow", "outflow"]);
		// Determinism: same input, same ids.
		const again = buildAdjustments([
			bankOnly({ sourceKey: "b1" }),
			ledgerOnly({ sourceKey: "l1", amountCents: 80n, side: "outflow" }),
		]);
		expect(again.map((d) => d.draftId)).toEqual(["adj-1", "adj-2"]);
	});
});

describe("buildAdjustments() — fail-closed rules", () => {
	it("never produces a draft from a matched difference", () => {
		expect(buildAdjustments([matchedPair()])).toEqual([]);
	});

	it("never produces a draft from a conflict", () => {
		expect(buildAdjustments([conflict()])).toEqual([]);
	});

	it("skips matched and conflict differences while drafting the classified ones", () => {
		const drafts = buildAdjustments([
			matchedPair(),
			bankOnly({ sourceKey: "b1" }),
			conflict(),
			ledgerOnly({ sourceKey: "l1" }),
		]);
		expect(drafts).toHaveLength(2);
		expect(drafts.map((d) => d.draftId)).toEqual(["adj-1", "adj-2"]);
	});

	it("returns no drafts for an empty difference list", () => {
		expect(buildAdjustments([])).toEqual([]);
	});

	it("surfaces an unclassified difference as a blocker (UNCLASSIFIED_DIFFERENCE), never a draft", () => {
		const unclassified = { classification: "mystery" } as unknown as Difference;
		try {
			buildAdjustments([unclassified]);
			expect.unreachable("buildAdjustments should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BankReconciliationError);
			expect((error as BankReconciliationError).code).toBe("UNCLASSIFIED_DIFFERENCE");
		}
	});
});

describe("buildAdjustments() — approval policy", () => {
	it("defaults requireApproval to true", () => {
		const drafts = buildAdjustments([bankOnly()]);
		expect(drafts[0].requireApproval).toBe(true);
		expect(drafts[0].status).toBe("pending-approval");
	});

	it("honors opts.requireApproval false across all drafts", () => {
		const opts: AdjustOptions = { requireApproval: false };
		const drafts = buildAdjustments([bankOnly({ sourceKey: "b1" }), ledgerOnly({ sourceKey: "l1" })], opts);
		expect(drafts.every((d) => d.requireApproval === false)).toBe(true);
		expect(drafts.every((d) => d.status === "draft")).toBe(true);
	});

	it("supports a per-draft override keyed by the originating movement sourceKey", () => {
		const opts: AdjustOptions = {
			approvalOverrides: { b1: false },
		};
		const drafts = buildAdjustments(
			[bankOnly({ sourceKey: "b1" }), ledgerOnly({ sourceKey: "l1" })],
			opts,
		);
		expect(drafts).toHaveLength(2);
		expect(drafts.find((d) => d.draftId === "adj-1")?.requireApproval).toBe(false);
		expect(drafts.find((d) => d.draftId === "adj-1")?.status).toBe("draft");
		expect(drafts.find((d) => d.draftId === "adj-2")?.requireApproval).toBe(true);
		expect(drafts.find((d) => d.draftId === "adj-2")?.status).toBe("pending-approval");
	});

	it("applies the default when no override matches the movement", () => {
		const opts: AdjustOptions = { approvalOverrides: { "some-other-key": false } };
		const drafts = buildAdjustments([bankOnly({ sourceKey: "b1" })], opts);
		expect(drafts[0].requireApproval).toBe(true);
	});
});
