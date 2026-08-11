import { describe, expect, it } from "vitest";
import { runMonthlyClose, REQUIRED_EVIDENCE_SYSTEMS } from "../index.js";
import type { MonthlyCloseInput } from "../index.js";
import {
	AdapterRegistry,
	type EvidenceAdapter,
	type EvidenceFetchInput,
} from "../../adapters/index.js";
import { generateReceiptKeyPair } from "../../receipts/index.js";
import { GENESIS_EMPTY_HASH, type LedgerManifest } from "../../ledger/index.js";
import { BASE_PE_SKILLS } from "../../skills/index.js";

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
		scope: {
			ruc: "20131312955",
			period: "202607",
			companyId: "synthetic-pe-01",
		},
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

describe("runMonthlyClose", () => {
	it("fails preflight on an invalid scope (RUC or period)", async () => {
		const badRuc = await runMonthlyClose(
			baseInput({ scope: { ruc: "123", period: "202607", companyId: "x" } }),
		);
		expect(badRuc.status).toBe("preflight-failed");
		expect(badRuc.risks[0]).toContain("invalid RUC");
		// Shape-valid but Módulo 11-invalid RUC is rejected (Option A, slice 2).
		const badChecksum = await runMonthlyClose(
			baseInput({
				scope: { ruc: "20123456789", period: "202607", companyId: "x" },
			}),
		);
		expect(badChecksum.status).toBe("preflight-failed");
		expect(badChecksum.risks[0]).toContain("invalid RUC");
		const badPeriod = await runMonthlyClose(
			baseInput({
				scope: { ruc: "20131312955", period: "2026", companyId: "x" },
			}),
		);
		expect(badPeriod.status).toBe("preflight-failed");
	});

	it("waits for evidence when an indispensable source is missing (absence is never zero)", async () => {
		const input = baseInput({ adapters: registryWith({ sire: false }) });
		const result = await runMonthlyClose(input);
		expect(result.status).toBe("waiting-for-evidence");
		expect(result.sourcesMissing).toContain("sire");
		expect(result.candidates).toHaveLength(0);
	});

	it("produces a complete package: candidates, guardian, receipts, valid ledger", async () => {
		const result = await runMonthlyClose(baseInput());
		expect(result.status).toBe("complete");
		expect(result.sourcesUsed).toHaveLength(REQUIRED_EVIDENCE_SYSTEMS.length);
		expect(result.candidates).toHaveLength(1);
		expect(result.guardianReports[0]!.verdict).toBe("none");
		expect(result.receipts).toHaveLength(1);
		expect(result.receipts[0]!.receiptHash).toHaveLength(64);
		expect(result.ledgerValid).toBe(true);
		expect(result.risks).toHaveLength(0);
	});

	it("surfaces guardian blockers as risks and skips the receipt", async () => {
		const input = baseInput({
			proposals: [
				{
					label: "irreversible declaration",
					explanation: "fiscal declaration",
					subject: "file declaration 202607",
					amountCents: "500000000",
					reversibility: "irreversible",
				},
			],
		});
		const result = await runMonthlyClose(input);
		expect(result.status).toBe("complete");
		expect(result.candidates).toHaveLength(1);
		// R3 without dual approval -> guardian blocker -> no receipt.
		expect(result.receipts).toHaveLength(0);
		expect(result.risks.some((r) => r.includes("R3"))).toBe(true);
	});

	it("reports an invalid ledger chain", async () => {
		const input = baseInput({ ledgerEntries: [] });
		const result = await runMonthlyClose(input);
		expect(result.status).toBe("complete");
		expect(result.ledgerValid).toBe(false);
	});
});
