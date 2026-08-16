/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Close vertical wiring — end-to-end integration: `runMonthlyClose` generates
 * its candidates from the deterministic engines (bank-reconciliation +
 * close-calculations) and feeds them through the unchanged
 * candidate/guardian/receipt/ledger pipeline. Strict TDD: written RED before
 * `MonthlyCloseInput` gained the engine-input fields.
 */
import { describe, expect, it } from "vitest";
import { REQUIRED_EVIDENCE_SYSTEMS, runMonthlyClose } from "../index.js";
import type { MonthlyCloseInput } from "../index.js";
import { reconciliationToProposals } from "../close-wiring.js";
import { CandidateLifecycle } from "../../candidates/lifecycle.js";
import {
	AdapterRegistry,
	type EvidenceAdapter,
	type EvidenceFetchInput,
} from "../../adapters/index.js";
import { generateReceiptKeyPair } from "../../receipts/index.js";
import { GENESIS_EMPTY_HASH, type LedgerManifest } from "../../ledger/index.js";
import { BASE_PE_SKILLS } from "../../skills/index.js";

const SCOPE = {
	ruc: "20131312955",
	period: "202607",
	companyId: "synthetic-pe-01",
};

/** Two bank-only deposit differences of 250 cents each (no ledger counterpart). */
const TWO_BANK_ONLY = [
	{
		ruc: SCOPE.ruc,
		date: "2026-07-05",
		reference: "DEP-001",
		amount: "250",
		side: "deposit" as const,
		sourceKey: "B-1",
	},
	{
		ruc: SCOPE.ruc,
		date: "2026-07-06",
		reference: "DEP-002",
		amount: "250",
		side: "deposit" as const,
		sourceKey: "B-2",
	},
];

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

/** One depreciation, one provision, one ISR, and two closing entries. */
function fiveEntryCloseInputs() {
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
			policy: {
				chart: CHART,
				depreciationExpenseAccount: "681",
				accumulatedDepreciationAccount: "391",
			},
		},
		provisions: {
			inputs: [
				{
					id: "prov-1",
					agingDays: 90,
					exposureCents: 1000000n,
					provisionRateBp: 500,
					kind: "receivable" as const,
				},
			],
			policy: {
				chart: CHART,
				provisionExpenseAccount: "685",
				provisionLiabilityAccount: "195",
			},
		},
		isr: {
			input: {
				id: "isr-1",
				netIncomeCents: 10000000n,
				priorYearRatioBp: 200,
				monthlyNetIncomeCents: 10000000n,
				rule: "coeficiente" as const,
			},
			policy: {
				chart: CHART,
				isrExpenseAccount: "881",
				isrPayableAccount: "4017",
				statutoryMinimumBp: 150,
			},
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

function fakeAdapter(system: string, present = true): EvidenceAdapter {
	return {
		name: `fake-${system}`,
		declareCapability: () => ({
			system,
			jurisdiction: "PE",
			evidenceTypes: [system],
		}),
		fetch: async (_input: EvidenceFetchInput) => {
			if (!present)
				return { items: [], missingRequired: [system], complete: false };
			return {
				items: [
					{
						id: "e".repeat(64),
						label: `${system}-item`,
						type: system,
					},
				],
				missingRequired: [],
				complete: true,
			};
		},
	};
}

function registryWith(present: Record<string, boolean>): AdapterRegistry {
	const registry = new AdapterRegistry();
	for (const system of REQUIRED_EVIDENCE_SYSTEMS) {
		registry.register(fakeAdapter(system, present[system] ?? true));
	}
	return registry;
}

function manifest(ledgerId: string): LedgerManifest {
	return {
		ledgerId,
		protocolVersion: "1.0",
		hashAlgorithm: "SHA-256",
		trustRoot: { keyIds: ["key_flow"] },
		jurisdiction: "PE",
		createdAt: "2026-08-01T00:00:00.000Z",
		signingPolicy: { required: false, algorithm: "Ed25519", keyIds: [] },
	};
}

function genesisEntry(ledgerId: string) {
	const ts = "2026-08-01T00:00:00.000Z";
	return {
		entryId: "entry-genesis",
		ledgerId,
		sequence: 1,
		entryType: "GENESIS" as const,
		previousEntryHash: GENESIS_EMPTY_HASH,
		payloadHash: "a".repeat(64),
		receiptHash: GENESIS_EMPTY_HASH,
		occurredAt: ts,
		recordedAt: ts,
		actor: "system",
		schemaVersion: "1.0",
		signerKeyId: "hash-only" as const,
	};
}

function baseInput(
	overrides: Partial<MonthlyCloseInput> = {},
): MonthlyCloseInput {
	return {
		scope: SCOPE,
		adapters: registryWith({}),
		keyPair: generateReceiptKeyPair("key_flow"),
		igvSkill: {
			id: BASE_PE_SKILLS[0]!.id,
			version: BASE_PE_SKILLS[0]!.version,
		},
		ledgerManifest: manifest("ledger-202607"),
		ledgerEntries: [genesisEntry("ledger-202607")],
		proposals: [
			{
				label: "reclassify prepayment",
				explanation: "supplier prepayment reclassified to current assets",
				subject: "reclassify supplier prepayment 202607",
				amountCents: "120000",
				reversibility: "reversible",
			},
		],
		...overrides,
	};
}

describe("runMonthlyClose with engine inputs", () => {
	it("generates candidates from engine inputs end-to-end through the existing pipeline", async () => {
		const result = await runMonthlyClose(
			baseInput({
				proposals: undefined,
				bankRows: TWO_BANK_ONLY,
				ledgerRows: [],
				closeInputs: fiveEntryCloseInputs(),
			}),
		);

		expect(result.status).toBe("complete");
		expect(result.sourcesUsed).toHaveLength(
			REQUIRED_EVIDENCE_SYSTEMS.length,
		);
		// 2 reconciliation drafts + depreciation + provision + ISR + 2 closing.
		expect(result.candidates).toHaveLength(7);
		for (const candidate of result.candidates) {
			expect(candidate.scope).toEqual({
				ruc: SCOPE.ruc,
				period: SCOPE.period,
			});
		}
		expect(result.guardianReports).toHaveLength(7);
		// Depreciation + ISR are irreversible -> R3 -> guardian blocker -> no
		// receipt (existing authority model unchanged).
		const r3Count = result.candidates.filter(
			(candidate) => candidate.materiality === "R3",
		).length;
		expect(r3Count).toBe(2);
		expect(result.receipts).toHaveLength(5);
		expect(result.risks.some((risk) => risk.includes("R3"))).toBe(true);
		expect(result.ledgerValid).toBe(true);
	});

	it("merges external proposals first, then engine-generated proposals, dropping nothing", async () => {
		const external = [
			{
				label: "reclassify prepayment",
				explanation: "supplier prepayment reclassified to current assets",
				subject: "reclassify supplier prepayment 202607",
				amountCents: "120000",
				reversibility: "reversible" as const,
			},
		];
		const lifecycle = new CandidateLifecycle();
		const expectedExternalCandidate = lifecycle.propose({
			subject: external[0]!.subject,
			scope: { ruc: SCOPE.ruc, period: SCOPE.period },
			materialityInput: {
				value: BigInt(external[0]!.amountCents),
				reversibility: external[0]!.reversibility,
				jurisdiction: "PE",
			},
		});

		const result = await runMonthlyClose(
			baseInput({
				proposals: external,
				bankRows: TWO_BANK_ONLY,
				ledgerRows: [],
				closeInputs: fiveEntryCloseInputs(),
			}),
		);

		expect(result.status).toBe("complete");
		// External first, then 7 generated: nothing is silently dropped.
		expect(result.candidates).toHaveLength(8);
		expect(result.candidates[0]!.id).toBe(expectedExternalCandidate.id);
		expect(result.candidates[0]!.scope).toEqual({
			ruc: SCOPE.ruc,
			period: SCOPE.period,
		});
	});

	it("honors external proposals when engine inputs are absent (pre-change behavior)", async () => {
		const result = await runMonthlyClose(baseInput());
		expect(result.status).toBe("complete");
		expect(result.candidates).toHaveLength(1);
		expect(result.receipts).toHaveLength(1);
		expect(result.ledgerValid).toBe(true);
		expect(result.risks).toHaveLength(0);
	});

	it("produces zero candidates when neither external proposals nor engine inputs are supplied", async () => {
		const result = await runMonthlyClose(baseInput({ proposals: undefined }));
		expect(result.status).toBe("complete");
		expect(result.candidates).toHaveLength(0);
		expect(result.guardianReports).toHaveLength(0);
		expect(result.receipts).toHaveLength(0);
		expect(result.ledgerValid).toBe(true);
	});

	it("surfaces a wiring engine error as a risk in ClosePackage.risks", async () => {
		const result = await runMonthlyClose(
			baseInput({
				proposals: undefined,
				bankRows: [
					{
						ruc: SCOPE.ruc,
						date: "2026-07-05",
						reference: "DEP-001",
						amount: "1.5",
						side: "deposit",
						sourceKey: "B-BAD",
					},
					{
						ruc: SCOPE.ruc,
						date: "2026-07-06",
						reference: "DEP-002",
						amount: "250",
						side: "deposit",
						sourceKey: "B-2",
					},
				],
				ledgerRows: [],
			}),
		);

		expect(result.status).toBe("complete");
		expect(result.risks.some((risk) => risk.includes("FRACTIONAL_CENTS"))).toBe(
			true,
		);
		expect(result.risks.some((risk) => risk.includes("B-BAD"))).toBe(true);
		// Accepted rows still generate candidates through the pipeline.
		expect(result.candidates.length).toBeGreaterThan(0);
	});

	it("surfaces an unclassifiable close input as a risk", async () => {
		const result = await runMonthlyClose(
			baseInput({
				proposals: undefined,
				closeInputs: {
					closing: {
						balances: [{ accountCode: "59", balanceCents: -500000n }],
						chart: CLOSING_CHART,
					},
				},
			}),
		);

		expect(result.status).toBe("complete");
		expect(
			result.risks.some((risk) => risk.includes("UNCLASSIFIABLE_INPUT")),
		).toBe(true);
		expect(result.candidates).toHaveLength(0);
	});

	it("produces exactly one candidate per generated proposal with the close scope and derived materiality", async () => {
		const { proposals } = reconciliationToProposals(
			SCOPE,
			TWO_BANK_ONLY,
			[],
		);
		const first = proposals[0]!;
		const lifecycle = new CandidateLifecycle();
		const expected = lifecycle.propose({
			subject: first.subject,
			scope: { ruc: SCOPE.ruc, period: SCOPE.period },
			materialityInput: {
				value: BigInt(first.amountCents),
				reversibility: first.reversibility,
				jurisdiction: "PE",
			},
		});

		const result = await runMonthlyClose(
			baseInput({
				proposals: undefined,
				bankRows: TWO_BANK_ONLY,
				ledgerRows: [],
			}),
		);

		expect(result.status).toBe("complete");
		const matches = result.candidates.filter(
			(candidate) => candidate.id === expected.id,
		);
		expect(matches).toHaveLength(1);
		expect(matches[0]!.scope).toEqual({
			ruc: SCOPE.ruc,
			period: SCOPE.period,
		});
		expect(matches[0]!.materiality).toBe(expected.materiality);
	});

	it("blocks receipting for an irreversible generated candidate via the guardian", async () => {
		const result = await runMonthlyClose(
			baseInput({
				proposals: undefined,
				closeInputs: {
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
						policy: {
							chart: CHART,
							depreciationExpenseAccount: "681",
							accumulatedDepreciationAccount: "391",
						},
					},
				},
			}),
		);

		expect(result.status).toBe("complete");
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]!.materiality).toBe("R3");
		expect(result.receipts).toHaveLength(0);
		expect(result.risks.some((risk) => risk.includes("R3"))).toBe(true);
	});

	it("produces identical outcomes for identical external and generated proposals", async () => {
		const bankRows = [TWO_BANK_ONLY[0]!];
		const { proposals } = reconciliationToProposals(SCOPE, bankRows, []);
		const identical = proposals[0]!;

		const externalRun = await runMonthlyClose(
			baseInput({
				proposals: [identical],
				bankRows: undefined,
				ledgerRows: undefined,
				closeInputs: undefined,
			}),
		);
		const generatedRun = await runMonthlyClose(
			baseInput({
				proposals: undefined,
				bankRows,
				ledgerRows: [],
			}),
		);

		expect(generatedRun.candidates[0]!.id).toBe(
			externalRun.candidates[0]!.id,
		);
		expect(generatedRun.guardianReports[0]!.candidateHash).toBe(
			externalRun.guardianReports[0]!.candidateHash,
		);
		expect(generatedRun.receipts).toHaveLength(
			externalRun.receipts.length,
		);
		expect(generatedRun.ledgerValid).toBe(externalRun.ledgerValid);
	});
});
