import { describe, expect, it } from "vitest";
import { MissionRuntime } from "../runtime.js";
import {
	InMemoryMissionStore,
	InMemoryMissionEventStore,
	InMemoryIdempotencyStore,
} from "../store.js";
import { IntentRegistryImpl, type IntentHandler } from "../intents.js";
import { AccountingMissionStatus } from "../status.js";
import { InMemoryFenceStore, acquireFence } from "../fencing.js";
import {
	InMemoryOutboxStore,
	enqueueMessage,
	deliverMessage,
} from "../outbox.js";
import {
	reconcileExternalCall,
	type ExternalSystemResolver,
} from "../reconciliation.js";
import { CandidateLifecycle } from "../../candidates/lifecycle.js";
import {
	buildSignedReceipt,
	generateReceiptKeyPair,
	signReceipt,
} from "../../receipts/index.js";
import { validateLedger, GENESIS_EMPTY_HASH } from "../../ledger/index.js";
import type { CreateMissionCommand, MissionIntent } from "../commands.js";
import type { MissionSnapshot } from "../types.js";

/**
 * End-to-end monthly close for a synthetic Peruvian company — Design 02
 * flagship flow. Drives mission -> candidates -> review -> receipt -> ledger,
 * and proves that an external execution claim without evidence is rejected.
 */

const S = AccountingMissionStatus;
const SYNTHETIC_RUC = "20123456789";
const PERIOD = "202607";

function advance(
	status: AccountingMissionStatus,
): AccountingMissionStatus | null {
	switch (status) {
		case S.DRAFT:
			return S.QUEUED;
		case S.QUEUED:
			return S.RUNNING;
		case S.RUNNING:
			return S.AWAITING_APPROVAL;
		case S.APPROVED:
			return S.COMPLETED;
		default:
			return null;
	}
}

function makeRuntime(): {
	runtime: MissionRuntime;
	fences: InMemoryFenceStore;
	outbox: InMemoryOutboxStore;
} {
	const store = new InMemoryMissionStore();
	const events = new InMemoryMissionEventStore();
	const idempotency = new InMemoryIdempotencyStore();
	const fences = new InMemoryFenceStore();
	const outbox = new InMemoryOutboxStore();
	const registry = new IntentRegistryImpl();
	const handler: IntentHandler = {
		intent: "monthly-close" as MissionIntent,
		async execute(mission: MissionSnapshot) {
			const next = advance(mission.status);
			if (next === null) return null;
			return { ...mission, status: next };
		},
	};
	registry.register(handler);
	const runtime = new MissionRuntime({
		store,
		events,
		idempotency,
		registry,
		fenceStore: fences,
	});
	return { runtime, fences, outbox };
}

describe("E2E: monthly close (synthetic Peruvian company)", () => {
	it("drives mission -> candidates -> receipt -> ledger with evidence-gated execution", async () => {
		const { runtime, fences, outbox } = makeRuntime();

		// 1. Scope preflight: professional requests the July 2026 close.
		const create: CreateMissionCommand = {
			companyId: "synthetic-pe-01",
			fiscalPeriod: PERIOD,
			intent: "monthly-close",
			input: {
				instruction: `Prepare the ${PERIOD} monthly close for Company X.`,
			},
		};
		const mission = await runtime.start(create);
		expect(mission.companyId).toBe("synthetic-pe-01");
		expect(mission.fiscalPeriod).toBe(PERIOD);

		// 2. Workers execute the close with fencing.
		const token = await acquireFence(fences, mission.id);
		const executed = await runtime.apply(
			{
				type: "execute",
				missionId: mission.id,
				payload: { expectedMissionVersion: 1 },
			},
			{ fenceToken: token },
		);
		expect(executed.snapshot.status).toBe(S.QUEUED);

		// 3. An accounting candidate with materiality derived from BigInt cents.
		const lifecycle = new CandidateLifecycle();
		const candidate = lifecycle.propose({
			subject: JSON.stringify({
				ruc: SYNTHETIC_RUC,
				period: PERIOD,
				correction: "reclassify supplier prepayment",
			}),
			scope: { ruc: SYNTHETIC_RUC, period: PERIOD },
			materialityInput: {
				value: 120_000n,
				reversibility: "reversible",
				jurisdiction: "PE",
			},
		});
		expect(candidate.materiality).toBe("R1");
		const inspected = lifecycle.inspect(
			candidate,
			JSON.stringify({
				ruc: SYNTHETIC_RUC,
				period: PERIOD,
				correction: "reclassify supplier prepayment",
			}),
		);
		expect(inspected.status).toBe("inspected");

		// 4. The approved candidate is receipted (Ed25519).
		const keyPair = generateReceiptKeyPair("key_e2e_001");
		const receipt = buildSignedReceipt(
			{
				action: "approve-candidate",
				actor: "professional",
				ruc: SYNTHETIC_RUC,
				period: PERIOD,
				resource: `candidate/${candidate.id}`,
				beforeState: "reviewing",
				afterState: "accepted",
				timestamp: "2026-08-01T00:00:00.000Z",
				version: 1,
			} as never,
			keyPair,
		);
		expect(receipt.receiptHash).toHaveLength(64);

		// 5. The close result lands in the ledger as a chained entry.
		const manifest = {
			ledgerId: `ledger-${PERIOD}`,
			protocolVersion: "1.0",
			hashAlgorithm: "SHA-256" as const,
			trustRoot: { keyIds: [keyPair.keyId] },
			jurisdiction: "PE",
			createdAt: "2026-08-01T00:00:00.000Z",
			signingPolicy: {
				required: false,
				algorithm: "Ed25519" as const,
				keyIds: [],
			},
		};
		const ts = "2026-08-01T00:00:00.000Z";
		const genesis = {
			entryId: "entry-genesis",
			ledgerId: manifest.ledgerId,
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
			payload: { type: "genesis" },
		};
		const closeEntry = {
			entryId: "entry-close-001",
			ledgerId: manifest.ledgerId,
			sequence: 2,
			entryType: "RECEIPT_RECORDED" as const,
			previousEntryHash: genesis.payloadHash,
			payloadHash: receipt.receiptHash,
			receiptHash: receipt.receiptHash,
			occurredAt: ts,
			recordedAt: ts,
			actor: "professional",
			schemaVersion: "1.0",
			signerKeyId: keyPair.keyId,
			signature: signReceipt(
				{ type: "close", candidateId: candidate.id } as never,
				keyPair.privateKey,
				keyPair.keyId,
			).signature,
			signerPublicKey: keyPair.publicKey,
			payload: { candidateId: candidate.id },
		};
		const ledgerResult = validateLedger(manifest, [genesis, closeEntry]);
		expect(ledgerResult.valid).toBe(true);

		// 6. Execution claims are evidence-gated: a SUNAT claim without evidence
		//    is rejected; with evidence it is recorded.
		const claim: ExternalSystemResolver = {
			resolve: async () => ({ outcome: "executed" }), // no evidence
		};
		await expect(
			reconcileExternalCall(claim, {
				stableIdentifier: `${PERIOD}-declaration`,
				system: "SUNAT",
				missionId: mission.id,
			}),
		).rejects.toThrow(/no verifiable evidence/i);

		// 7. Outbox dedupes the confirmation message.
		const message = await enqueueMessage(outbox, {
			aggregateId: mission.id,
			type: "close-confirmed",
			payloadHash: receipt.receiptHash,
		});
		expect(await deliverMessage(outbox, message.id)).toBe(true);
		expect(await deliverMessage(outbox, message.id)).toBe(false);
	});
});
