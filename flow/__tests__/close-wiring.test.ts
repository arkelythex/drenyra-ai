/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Close vertical wiring — unit tests for the deterministic converters that bind
 * the bank-reconciliation and close-calculations engines to the monthly-close
 * vertical's ReconciliationProposal shape. Strict TDD: every behavior below was
 * written RED before the converter existed.
 */
import { describe, expect, it } from "vitest";
import {
	closeEntriesToProposals,
	reconciliationToProposals,
	type CloseEngineInputs,
} from "../close-wiring.js";
import type { BankRow, LedgerRow } from "../../bank-reconciliation/index.js";
import type { ProvisionInput } from "../../close-calculations/index.js";

const SCOPE = {
	ruc: "20131312955",
	period: "202607",
	companyId: "synthetic-pe-01",
};

function bankRow(overrides: Partial<BankRow> = {}): BankRow {
	return {
		ruc: SCOPE.ruc,
		date: "2026-07-05",
		reference: "DEP-001",
		amount: "250",
		side: "deposit",
		sourceKey: "B-1",
		...overrides,
	};
}

function ledgerRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
	return {
		ruc: SCOPE.ruc,
		date: "2026-07-05",
		reference: "DEP-001",
		amount: "250",
		side: "debit",
		sourceKey: "L-1",
		...overrides,
	};
}

describe("reconciliationToProposals", () => {
	it("produces exactly one proposal per classified adjustment draft", () => {
		const bankRows = [
			bankRow({ sourceKey: "B-1", reference: "DEP-001", date: "2026-07-05" }),
			bankRow({
				sourceKey: "B-2",
				reference: "DEP-002",
				date: "2026-07-06",
			}),
			bankRow({
				sourceKey: "B-3",
				reference: "COMMON",
				amount: "500",
				date: "2026-07-07",
			}),
		];
		const ledgerRows = [
			ledgerRow({
				sourceKey: "L-1",
				reference: "COMMON",
				amount: "500",
				date: "2026-07-07",
			}),
		];

		const { proposals, risks } = reconciliationToProposals(
			SCOPE,
			bankRows,
			ledgerRows,
		);

		expect(risks).toHaveLength(0);
		expect(proposals).toHaveLength(2);
		// Label derives from the draft reference id; explanation from the justification.
		expect(proposals[0]!.label).toBe("adjustment:adj-1");
		expect(proposals[0]!.explanation).toContain("B-1");
		// Explanation derives from the draft justification; the engine
		// normalizes references (trimmed, collapsed, case-folded).
		expect(proposals[0]!.explanation).toContain("dep-001");
		// Lossless BigInt cents: pipeline reads BigInt(amountCents).
		expect(proposals[0]!.amountCents).toBe("250");
		// Default engine behavior: drafts require approval -> partially-reversible.
		expect(proposals[0]!.reversibility).toBe("partially-reversible");
		expect(proposals[0]!.subject).toContain(
			'"kind":"reconciliation-adjustment"',
		);
		expect(proposals[0]!.subject).toContain('"draftId":"adj-1"');
		expect(proposals[1]!.label).toBe("adjustment:adj-2");
		expect(proposals[1]!.amountCents).toBe("250");
		expect(proposals[1]!.reversibility).toBe("partially-reversible");
	});

	it("yields zero proposals when every movement is matched", () => {
		const bankRows = [
			bankRow({
				sourceKey: "B-1",
				reference: "COMMON",
				amount: "500",
				date: "2026-07-07",
			}),
		];
		const ledgerRows = [
			ledgerRow({
				sourceKey: "L-1",
				reference: "COMMON",
				amount: "500",
				date: "2026-07-07",
			}),
		];

		const { proposals, risks } = reconciliationToProposals(
			SCOPE,
			bankRows,
			ledgerRows,
		);
		expect(proposals).toHaveLength(0);
		expect(risks).toHaveLength(0);
	});

	it("is deterministic: identical inputs produce identical proposals in identical order", () => {
		const bankRows = [
			bankRow(),
			bankRow({
				sourceKey: "B-2",
				reference: "DEP-002",
				date: "2026-07-06",
			}),
		];

		const first = reconciliationToProposals(SCOPE, bankRows, []);
		const second = reconciliationToProposals(SCOPE, bankRows, []);

		expect(second.proposals.map((p) => p.label)).toEqual([
			"adjustment:adj-1",
			"adjustment:adj-2",
		]);
		expect(JSON.stringify(second.proposals)).toBe(
			JSON.stringify(first.proposals),
		);
	});

	it("maps requireApproval=false drafts to reversible and true drafts to partially-reversible", () => {
		const bankRows = [
			bankRow(),
			bankRow({
				sourceKey: "B-2",
				reference: "DEP-002",
				date: "2026-07-06",
			}),
		];

		const routine = reconciliationToProposals(SCOPE, bankRows, [], {
			requireApproval: false,
		});
		expect(routine.proposals).toHaveLength(2);
		expect(routine.proposals[0]!.reversibility).toBe("reversible");
		expect(routine.proposals[1]!.reversibility).toBe("reversible");

		const overridden = reconciliationToProposals(SCOPE, bankRows, [], {
			approvalOverrides: { "B-1": false },
		});
		expect(overridden.proposals[0]!.reversibility).toBe("reversible");
		expect(overridden.proposals[1]!.reversibility).toBe(
			"partially-reversible",
		);
	});

	it("surfaces a FRACTIONAL_CENTS rejection as a risk without fabricating a proposal for that row", () => {
		const bankRows = [
			bankRow({ sourceKey: "B-BAD", amount: "1.5" }),
			bankRow({
				sourceKey: "B-2",
				reference: "DEP-002",
				date: "2026-07-06",
			}),
		];

		const { proposals, risks } = reconciliationToProposals(
			SCOPE,
			bankRows,
			[],
		);

		expect(risks.some((r) => r.includes("FRACTIONAL_CENTS"))).toBe(true);
		expect(risks.some((r) => r.includes("B-BAD"))).toBe(true);
		expect(proposals).toHaveLength(1);
		expect(proposals[0]!.label).toBe("adjustment:adj-1");
	});

	it("keeps accepted rows and surfaces only the rejected rows", () => {
		const bankRows = [
			bankRow({ sourceKey: "B-BAD", reference: "   " }),
			bankRow({
				sourceKey: "B-2",
				reference: "DEP-002",
				date: "2026-07-06",
			}),
		];

		const { proposals, risks } = reconciliationToProposals(
			SCOPE,
			bankRows,
			[],
		);

		expect(risks.some((r) => r.includes("NORMALIZATION_REJECTED"))).toBe(
			true,
		);
		expect(risks.some((r) => r.includes("B-BAD"))).toBe(true);
		expect(proposals).toHaveLength(1);
		expect(proposals[0]!.label).toBe("adjustment:adj-1");
	});

	it("rejects a cross-RUC row fail-closed with CROSS_RUC_ACCESS", () => {
		const bankRows = [
			bankRow({ ruc: "99999999999", sourceKey: "B-FOREIGN" }),
			bankRow({
				sourceKey: "B-2",
				reference: "DEP-002",
				date: "2026-07-06",
			}),
		];

		const { proposals, risks } = reconciliationToProposals(
			SCOPE,
			bankRows,
			[],
		);

		expect(risks.some((r) => r.includes("CROSS_RUC_ACCESS"))).toBe(true);
		expect(risks.some((r) => r.includes("B-FOREIGN"))).toBe(true);
		expect(proposals).toHaveLength(1);
	});

	it("surfaces INVALID_SCOPE and produces no proposals for a malformed scope", () => {
		const badRuc = reconciliationToProposals(
			{ ...SCOPE, ruc: "123" },
			[bankRow()],
			[],
		);
		expect(badRuc.proposals).toHaveLength(0);
		expect(badRuc.risks.some((r) => r.includes("INVALID_SCOPE"))).toBe(
			true,
		);

		const badPeriod = reconciliationToProposals(
			{ ...SCOPE, period: "2026" },
			[bankRow()],
			[],
		);
		expect(badPeriod.proposals).toHaveLength(0);
		expect(badPeriod.risks.some((r) => r.includes("INVALID_SCOPE"))).toBe(
			true,
		);
	});

	it("produces zero proposals and zero risks for empty bank and ledger input", () => {
		const { proposals, risks } = reconciliationToProposals(SCOPE, [], []);
		expect(proposals).toHaveLength(0);
		expect(risks).toHaveLength(0);
	});

	it("never fabricates a proposal when an engine call fails", () => {
		// An invalid scope aborts the whole normalization pass: zero proposals,
		// typed INVALID_SCOPE risk — the fail-closed mechanism for any engine
		// failure (the same catch path preserves UNCLASSIFIED_DIFFERENCE etc.).
		const { proposals, risks } = reconciliationToProposals(
			{ ...SCOPE, period: "202699" },
			[bankRow()],
			[],
		);
		expect(proposals).toHaveLength(0);
		expect(risks.some((r) => r.includes("INVALID_SCOPE"))).toBe(true);
	});
});

describe("closeEntriesToProposals", () => {
	const CHART = new Set([
		"391",
		"681",
		"685",
		"195",
		"881",
		"4017",
		"59",
		"12",
		"14",
	]);
	const CLOSING_CHART = new Set(["12", "14", "59"]);

	const depreciationPolicy = {
		chart: CHART,
		depreciationExpenseAccount: "681",
		accumulatedDepreciationAccount: "391",
	};
	const provisionPolicy = {
		chart: CHART,
		provisionExpenseAccount: "685",
		provisionLiabilityAccount: "195",
	};
	const isrPolicy = {
		chart: CHART,
		isrExpenseAccount: "881",
		isrPayableAccount: "4017",
		statutoryMinimumBp: 150,
	};

	function fiveEntryInputs(): CloseEngineInputs {
		return {
			depreciation: {
				assets: [
					{
						id: "asset-1",
						description: "server",
						costBasisCents: 1200000n,
						annualRateBp: 2000,
						acquisitionDate: "2026-01-10",
					},
				],
				policy: depreciationPolicy,
			},
			provisions: {
				inputs: [
					{
						id: "prov-1",
						agingDays: 90,
						exposureCents: 1000000n,
						provisionRateBp: 500,
						kind: "receivable",
					},
				],
				policy: provisionPolicy,
			},
			isr: {
				input: {
					id: "isr-1",
					netIncomeCents: 10000000n,
					priorYearRatioBp: 200,
					monthlyNetIncomeCents: 10000000n,
					rule: "coeficiente",
				},
				policy: isrPolicy,
			},
			closing: {
				balances: [
					{ accountCode: "12", balanceCents: -500000n },
					{ accountCode: "14", balanceCents: -300000n },
				],
				chart: CLOSING_CHART,
			},
		};
	}

	it("produces exactly one proposal per balanced close entry", () => {
		const { proposals, risks } = closeEntriesToProposals(
			SCOPE,
			fiveEntryInputs(),
		);

		expect(risks).toHaveLength(0);
		expect(proposals).toHaveLength(5);
		expect(proposals.map((p) => p.label)).toEqual([
			"close:depreciation:depr-1",
			"close:provision:prov-1",
			"close:isr:isr-1",
			"close:closing:close-1",
			"close:closing:close-2",
		]);
		// amountCents is the balanced magnitude (per-side total) in BigInt cents.
		expect(proposals[0]!.amountCents).toBe("20000");
		expect(proposals[1]!.amountCents).toBe("50000");
		expect(proposals[2]!.amountCents).toBe("200000");
		expect(proposals[3]!.amountCents).toBe("500000");
		expect(proposals[4]!.amountCents).toBe("300000");
	});

	it("maps a depreciation entry's label, explanation, and balanced amount", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			depreciation: {
				assets: [
					{
						id: "asset-1",
						description: "server",
						costBasisCents: 1200000n,
						annualRateBp: 10000,
						acquisitionDate: "2026-01-10",
					},
				],
				policy: depreciationPolicy,
			},
		});

		expect(risks).toHaveLength(0);
		expect(proposals).toHaveLength(1);
		const proposal = proposals[0]!;
		expect(proposal.label).toBe("close:depreciation:depr-1");
		expect(proposal.explanation).toContain("681 debit 100000");
		expect(proposal.explanation).toContain("391 credit 100000");
		expect(proposal.amountCents).toBe("100000");
		expect(proposal.reversibility).toBe("irreversible");
	});

	it("derives reversibility deterministically per entry kind", () => {
		const { proposals } = closeEntriesToProposals(
			SCOPE,
			fiveEntryInputs(),
		);
		const byLabel = new Map(
			proposals.map((p) => [p.label, p.reversibility]),
		);
		expect(byLabel.get("close:depreciation:depr-1")).toBe("irreversible");
		expect(byLabel.get("close:provision:prov-1")).toBe(
			"partially-reversible",
		);
		expect(byLabel.get("close:isr:isr-1")).toBe("irreversible");
		expect(byLabel.get("close:closing:close-1")).toBe("reversible");
		expect(byLabel.get("close:closing:close-2")).toBe("reversible");
	});

	it("derives exactly one proposal from the ISR entry and never from the cédula", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			isr: {
				input: {
					id: "isr-1",
					netIncomeCents: 10000000n,
					priorYearRatioBp: 200,
					monthlyNetIncomeCents: 10000000n,
					rule: "coeficiente",
				},
				policy: isrPolicy,
			},
		});

		expect(risks).toHaveLength(0);
		expect(proposals).toHaveLength(1);
		expect(proposals[0]!.label).toBe("close:isr:isr-1");
		expect(proposals[0]!.subject).not.toContain("cedula");
	});

	it("surfaces ACCOUNT_NOT_IN_CHART fail-closed with no proposal from that group", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			depreciation: {
				assets: [
					{
						id: "asset-1",
						description: "server",
						costBasisCents: 1200000n,
						annualRateBp: 2000,
						acquisitionDate: "2026-01-10",
					},
				],
				// Chart missing the expense account: the engine refuses to run.
				policy: { ...depreciationPolicy, chart: new Set(["391"]) },
			},
		});

		expect(proposals).toHaveLength(0);
		expect(risks.some((r) => r.includes("ACCOUNT_NOT_IN_CHART"))).toBe(
			true,
		);
	});

	it("surfaces UNCLASSIFIABLE_INPUT for a provision kind with no rule", () => {
		const badInput = {
			id: "prov-1",
			agingDays: 90,
			exposureCents: 1000000n,
			provisionRateBp: 500,
			kind: "other",
		} as unknown as ProvisionInput;

		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			provisions: { inputs: [badInput], policy: provisionPolicy },
		});

		expect(proposals).toHaveLength(0);
		expect(risks.some((r) => r.includes("UNCLASSIFIABLE_INPUT"))).toBe(
			true,
		);
	});

	it("surfaces UNCLASSIFIABLE_INPUT for an unclassifiable closing balance", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			closing: {
				balances: [{ accountCode: "59", balanceCents: -500000n }],
				chart: CLOSING_CHART,
			},
		});

		expect(proposals).toHaveLength(0);
		expect(risks.some((r) => r.includes("UNCLASSIFIABLE_INPUT"))).toBe(
			true,
		);
	});

	it("surfaces INVALID_SCOPE and produces no proposals for a malformed close scope", () => {
		const { proposals, risks } = closeEntriesToProposals(
			{ ...SCOPE, ruc: "123" },
			fiveEntryInputs(),
		);
		expect(proposals).toHaveLength(0);
		expect(risks.some((r) => r.includes("INVALID_SCOPE"))).toBe(true);
	});

	it("skips zero-balance closing accounts with no proposal", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			closing: {
				balances: [
					{ accountCode: "12", balanceCents: 0n },
					{ accountCode: "14", balanceCents: 0n },
				],
				chart: CLOSING_CHART,
			},
		});

		expect(proposals).toHaveLength(0);
		expect(risks).toHaveLength(0);
	});

	it("produces zero proposals for empty close engine inputs", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {});
		expect(proposals).toHaveLength(0);
		expect(risks).toHaveLength(0);
	});

	it("produces one depreciation proposal per asset", () => {
		const { proposals, risks } = closeEntriesToProposals(SCOPE, {
			depreciation: {
				assets: [
					{
						id: "asset-1",
						description: "server",
						costBasisCents: 1200000n,
						annualRateBp: 2000,
						acquisitionDate: "2026-01-10",
					},
					{
						id: "asset-2",
						description: "laptop",
						costBasisCents: 600000n,
						annualRateBp: 2000,
						acquisitionDate: "2026-02-10",
					},
				],
				policy: depreciationPolicy,
			},
		});

		expect(risks).toHaveLength(0);
		expect(proposals.map((p) => p.label)).toEqual([
			"close:depreciation:depr-1",
			"close:depreciation:depr-2",
		]);
		expect(proposals[0]!.amountCents).toBe("20000");
		expect(proposals[1]!.amountCents).toBe("10000");
	});
});
