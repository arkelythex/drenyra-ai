import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
	PostgresFenceStore,
	PostgresIdempotencyStore,
	PostgresMissionEventStore,
	PostgresMissionStore,
	PostgresOutboxStore,
	POSTGRES_SCHEMA_DDL,
} from "../store.postgres.js";
import type { MissionSnapshot } from "../types.js";
import { AccountingMissionStatus } from "../status.js";
import { MissionEventType } from "../events.js";

/** Fake pg Pool: records queries and serves scripted rows. */
function fakePool(rows: unknown[][] = []): { pool: Pool; calls: Array<{ text: string; values: unknown[] }> } {
	const calls: Array<{ text: string; values: unknown[] }> = [];
	const pool = {
		async query(text: string, values: unknown[] = []) {
			calls.push({ text, values });
			return { rows: rows.length > 0 ? rows.shift()! : [] };
		},
	} as unknown as Pool;
	return { pool, calls };
}

function snapshot(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
	return {
		id: "mission_1",
		companyId: "company-1",
		fiscalPeriod: "202607",
		intent: "monthly-close",
		status: AccountingMissionStatus.DRAFT,
		version: 1,
		progress: 0,
		steps: [],
		currentStep: "",
		blockers: [],
		proposal: null,
		rejection: null,
		receiptId: null,
		receiptHash: null,
		lastEventSequence: 1,
		createdAt: "2026-07-01T00:00:00.000Z",
		updatedAt: "2026-07-01T00:00:00.000Z",
		...overrides,
	};
}

describe("PostgresMissionStore", () => {
	it("saves with upsert SQL and snapshot JSONB", async () => {
		const { pool, calls } = fakePool();
		const store = new PostgresMissionStore(pool);
		const snap = snapshot();
		await store.save(snap);
		expect(calls).toHaveLength(1);
		expect(calls[0]!.text).toContain("ON CONFLICT (id) DO UPDATE");
		expect(calls[0]!.values[1]).toBe(JSON.stringify(snap));
	});

	it("maps a snapshot row from findById", async () => {
		const snap = snapshot({ status: AccountingMissionStatus.RUNNING });
		const { pool } = fakePool([[{ snapshot: snap }]]);
		const store = new PostgresMissionStore(pool);
		expect(await store.findById("mission_1")).toEqual(snap);
	});

	it("returns undefined when the mission is absent", async () => {
		const { pool } = fakePool([[]]);
		const store = new PostgresMissionStore(pool);
		expect(await store.findById("mission_1")).toBeUndefined();
	});
});

describe("PostgresMissionEventStore", () => {
	it("appends an event and lists by sequence", async () => {
		const { pool, calls } = fakePool();
		const store = new PostgresMissionEventStore(pool);
		await store.append({
			id: "evt_1",
			missionId: "mission_1",
			sequence: 1,
			eventType: MissionEventType.STATE_TRANSITION,
			snapshot: snapshot(),
			createdAt: "2026-07-01T00:00:00.000Z",
		});
		expect(calls[0]!.text).toContain("INSERT INTO mission_events");
		expect(calls[0]!.values[2]).toBe(1);
	});
});

describe("PostgresIdempotencyStore", () => {
	it("filters expired records via SQL (expires_at > now)", async () => {
		const { pool, calls } = fakePool();
		const store = new PostgresIdempotencyStore(pool);
		await store.get("key-1");
		expect(calls[0]!.text).toContain("expires_at > $2");
		expect(typeof calls[0]!.values[1]).toBe("number");
	});

	it("maps a stored record", async () => {
		const { pool } = fakePool([
			[{ key: "k", payload_hash: "h", status: "COMPLETED", result: { ok: true }, expires_at: 9999999999 }],
		]);
		const store = new PostgresIdempotencyStore(pool);
		const record = await store.get("k");
		expect(record?.status).toBe("COMPLETED");
		expect(record?.expiresAt).toBe(9999999999);
	});
});

describe("PostgresFenceStore", () => {
	it("reads 0 for an unfenced mission and upserts tokens", async () => {
		const { pool, calls } = fakePool([[]]);
		const store = new PostgresFenceStore(pool);
		expect(await store.getToken("mission_1")).toBe(0);
		await store.setToken("mission_1", 3);
		expect(calls[1]!.text).toContain("ON CONFLICT (mission_id) DO UPDATE");
		expect(calls[1]!.values[1]).toBe(3);
	});
});

describe("PostgresOutboxStore", () => {
	it("enqueues with the deduplication payload hash", async () => {
		const { pool, calls } = fakePool();
		const store = new PostgresOutboxStore(pool);
		await store.enqueue({
			id: "outbox_1",
			aggregateId: "mission_1",
			type: "post-journal",
			payloadHash: "h1",
			status: "pending",
			attempts: 0,
			createdAt: "2026-07-01T00:00:00.000Z",
		});
		expect(calls[0]!.text).toContain("INSERT INTO outbox");
		expect(calls[0]!.values[3]).toBe("h1");
	});

	it("maps a pending row back to an OutboxMessage", async () => {
		const { pool } = fakePool([
			[{ id: "outbox_1", aggregate_id: "m", type: "t", payload_hash: "h", status: "pending", attempts: 1, created_at: "2026-07-01T00:00:00.000Z", delivered_at: null }],
		]);
		const store = new PostgresOutboxStore(pool);
		const message = await store.findById("outbox_1");
		expect(message?.status).toBe("pending");
		expect(message?.attempts).toBe(1);
	});
});

describe("schema DDL", () => {
	it("declares the five production tables with the dedup unique constraint", () => {
		expect(POSTGRES_SCHEMA_DDL).toContain("CREATE TABLE IF NOT EXISTS missions");
		expect(POSTGRES_SCHEMA_DDL).toContain("CREATE TABLE IF NOT EXISTS mission_events");
		expect(POSTGRES_SCHEMA_DDL).toContain("CREATE TABLE IF NOT EXISTS idempotency_records");
		expect(POSTGRES_SCHEMA_DDL).toContain("CREATE TABLE IF NOT EXISTS mission_fences");
		expect(POSTGRES_SCHEMA_DDL).toContain("CREATE TABLE IF NOT EXISTS outbox");
		expect(POSTGRES_SCHEMA_DDL).toContain("UNIQUE (aggregate_id, payload_hash)");
	});
});
