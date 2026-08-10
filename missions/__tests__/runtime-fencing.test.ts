import { describe, expect, it } from "vitest";
import { MissionRuntime, type BoundMissionCommand } from "../runtime.js";
import {
	InMemoryMissionStore,
	InMemoryMissionEventStore,
	InMemoryIdempotencyStore,
} from "../store.js";
import { IntentRegistryImpl, type IntentHandler } from "../intents.js";
import { AccountingMissionStatus } from "../status.js";
import { acquireFence, InMemoryFenceStore } from "../fencing.js";
import type { CreateMissionCommand, MissionIntent } from "../commands.js";
import type { MissionSnapshot } from "../types.js";

const S = AccountingMissionStatus;

/** Next single legal step (mirrors the scripted handler in runtime.test.ts). */
function advanceStatus(
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
		case S.REVISION_REQUESTED:
			return S.QUEUED;
		default:
			return null;
	}
}

function makeRuntime(fenceStore?: InMemoryFenceStore): {
	runtime: MissionRuntime;
	create: () => Promise<{ missionId: string }>;
} {
	const store = new InMemoryMissionStore();
	const events = new InMemoryMissionEventStore();
	const idempotency = new InMemoryIdempotencyStore();
	const registry = new IntentRegistryImpl();
	const handler: IntentHandler = {
		intent: "monthly-close" as MissionIntent,
		async execute(mission: MissionSnapshot) {
			const next = advanceStatus(mission.status);
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
		fenceStore,
	});
	return {
		runtime,
		create: async () => {
			const create: CreateMissionCommand = {
				companyId: "company-1",
				fiscalPeriod: "202607",
				intent: "monthly-close",
				input: { instruction: "close period" },
			};
			const mission = await runtime.start(create);
			return { missionId: mission.id };
		},
	};
}

function executeCommand(
	missionId: string,
	expectedVersion: number,
): BoundMissionCommand {
	return {
		type: "execute",
		missionId,
		payload: { expectedMissionVersion: expectedVersion },
	};
}

describe("MissionRuntime + fencing", () => {
	it("accepts a current fence token and rejects a stale one", async () => {
		const fenceStore = new InMemoryFenceStore();
		const { runtime, create } = makeRuntime(fenceStore);
		const { missionId } = await create();

		const worker1 = await acquireFence(fenceStore, missionId);
		await runtime.apply(executeCommand(missionId, 1), { fenceToken: worker1 });

		// Leader change: a new token is acquired; worker1 is now stale.
		await acquireFence(fenceStore, missionId);
		await expect(
			runtime.apply(executeCommand(missionId, 2), { fenceToken: worker1 }),
		).rejects.toThrow(/fence conflict/i);
	});

	it("runs without fencing when no fence store is configured", async () => {
		const { runtime, create } = makeRuntime();
		const { missionId } = await create();
		const result = await runtime.apply(executeCommand(missionId, 1));
		expect(result.snapshot.status).toBeDefined();
	});
});
