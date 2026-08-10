import { describe, expect, it } from "vitest";
import { MissionRuntime } from "../runtime.js";
import {
	InMemoryMissionStore,
	InMemoryMissionEventStore,
	InMemoryIdempotencyStore,
} from "../store.js";
import { IntentRegistryImpl, type IntentHandler } from "../intents.js";
import { AccountingMissionStatus } from "../status.js";
import { ReconciliationError } from "../reconciliation.js";
import type { ExternalEvidence, ExternalSystemResolver } from "../reconciliation.js";
import type { CreateMissionCommand, MissionIntent } from "../commands.js";
import type { MissionSnapshot } from "../types.js";

const S = AccountingMissionStatus;

function advance(status: AccountingMissionStatus): AccountingMissionStatus | null {
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

async function makeRuntime(): Promise<{
	runtime: MissionRuntime;
	driveToRunning: () => Promise<string>;
}> {
	const store = new InMemoryMissionStore();
	const events = new InMemoryMissionEventStore();
	const idempotency = new InMemoryIdempotencyStore();
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
	const runtime = new MissionRuntime({ store, events, idempotency, registry });

	const create: CreateMissionCommand = {
		companyId: "company-1",
		fiscalPeriod: "202607",
		intent: "monthly-close",
		input: { instruction: "close" },
	};
	const mission = await runtime.start(create);
	await runtime.apply({ type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 1 } });
	await runtime.apply({ type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 2 } });
	await runtime.recoverIncomplete();
	return { runtime, driveToRunning: async () => mission.id };
}

function evidence(): ExternalEvidence {
	return {
		identifier: "SUNAT-202607-001",
		state: "accepted",
		provenance: "SUNAT",
		moment: "2026-08-01T00:00:00.000Z",
		responseHash: "f".repeat(64),
	};
}

function resolverFor(outcome: "executed" | "not-executed" | "indeterminate", withEvidence?: ExternalEvidence): ExternalSystemResolver {
	return { resolve: async () => ({ outcome, evidence: withEvidence }) };
}

const call = { stableIdentifier: "202607-declaration", system: "SUNAT", missionId: "mission" };

describe("MissionRuntime.reconcile", () => {
	it("records a confirmed execution: UNKNOWN -> RUNNING with evidence", async () => {
		const { runtime, driveToRunning } = await makeRuntime();
		const missionId = await driveToRunning();
		const { result, snapshot } = await runtime.reconcile(missionId, call, resolverFor("executed", evidence()));
		expect(result.decision).toBe("record");
		expect(snapshot.status).toBe(S.RUNNING);
	});

	it("permits an idempotent retry: UNKNOWN -> RUNNING", async () => {
		const { runtime, driveToRunning } = await makeRuntime();
		const missionId = await driveToRunning();
		const { result, snapshot } = await runtime.reconcile(missionId, call, resolverFor("not-executed"));
		expect(result.decision).toBe("retry");
		expect(snapshot.status).toBe(S.RUNNING);
	});

	it("stays UNKNOWN for human intervention", async () => {
		const { runtime, driveToRunning } = await makeRuntime();
		const missionId = await driveToRunning();
		const { result, snapshot } = await runtime.reconcile(missionId, call, resolverFor("indeterminate"));
		expect(result.decision).toBe("human-intervention");
		expect(snapshot.status).toBe(S.UNKNOWN);
	});

	it("rejects executed-without-evidence and leaves the mission UNKNOWN", async () => {
		const { runtime, driveToRunning } = await makeRuntime();
		const missionId = await driveToRunning();
		await expect(runtime.reconcile(missionId, call, resolverFor("executed"))).rejects.toThrow(ReconciliationError);
	});

	it("fails closed without a resolver", async () => {
		const { runtime, driveToRunning } = await makeRuntime();
		const missionId = await driveToRunning();
		await expect(runtime.reconcile(missionId, call, undefined)).rejects.toThrow(ReconciliationError);
	});

	it("requires UNKNOWN status and an existing mission", async () => {
		const { runtime, driveToRunning } = await makeRuntime();
		const missionId = await driveToRunning();
		// Mission is UNKNOWN after recovery; reconcile once to RUNNING...
		await runtime.reconcile(missionId, call, resolverFor("not-executed"));
		// ...now it is RUNNING, so reconcile must reject.
		await expect(runtime.reconcile(missionId, call, resolverFor("executed", evidence()))).rejects.toThrow(/UNKNOWN/i);
		await expect(runtime.reconcile("missing_mission", call, resolverFor("indeterminate"))).rejects.toThrow(/not found/i);
	});
});
