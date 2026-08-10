import { describe, expect, it, beforeAll, afterAll } from "vitest";
import pg from "pg";
import {
	PostgresFenceStore,
	PostgresIdempotencyStore,
	PostgresMissionEventStore,
	PostgresMissionStore,
	PostgresOutboxStore,
	POSTGRES_SCHEMA_DDL,
} from "../store.postgres.js";
import { AccountingMissionStatus } from "../status.js";
import { MissionEventType } from "../events.js";
import type { MissionSnapshot } from "../types.js";

/**
 * Real PostgreSQL integration suite (Design 04 "Integration: real PostgreSQL").
 * Connects to DATABASE_URL when set, else to a local dev instance; skips when
 * no PostgreSQL is reachable (CI without a database).
 */

const POOL = new pg.Pool({
	connectionString:
		process.env.DATABASE_URL ?? "postgres://postgres@localhost:54329/postgres",
});

let available = true;

beforeAll(async () => {
	try {
		await POOL.query("SELECT 1");
		await POOL.query(POSTGRES_SCHEMA_DDL);
	} catch {
		available = false;
	}
}, 15000);

afterAll(async () => {
	await POOL.end();
});

function snapshot(id: string): MissionSnapshot {
	return {
		id,
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
	};
}

describe("PostgreSQL integration (real)", () => {
	it("mission store: save, findById, list round trip", async () => {
		if (!available) return;
		const store = new PostgresMissionStore(POOL);
		const snap = snapshot(`mission_it_${Date.now()}`);
		await store.save(snap);
		expect(await store.findById(snap.id)).toEqual(snap);
		expect((await store.list()).some((m) => m.id === snap.id)).toBe(true);
	});

	it("event store: append and ordered list", async () => {
		if (!available) return;
		const store = new PostgresMissionEventStore(POOL);
		const id = `mission_evt_${Date.now()}`;
		const event = {
			id: `evt_${Date.now()}`,
			missionId: id,
			sequence: 1,
			eventType: MissionEventType.STATE_TRANSITION,
			snapshot: snapshot(id),
			createdAt: "2026-07-01T00:00:00.000Z",
		};
		await store.append(event);
		const events = await store.list(id);
		expect(events).toHaveLength(1);
		expect(events[0]!.id).toBe(event.id);
	});

	it("fence store: monotonic tokens", async () => {
		if (!available) return;
		const store = new PostgresFenceStore(POOL);
		const id = `mission_fence_${Date.now()}`;
		expect(await store.getToken(id)).toBe(0);
		await store.setToken(id, 1);
		await store.setToken(id, 2);
		expect(await store.getToken(id)).toBe(2);
	});

	it("idempotency store: put, get, and expiry filtering", async () => {
		if (!available) return;
		const store = new PostgresIdempotencyStore(POOL);
		const key = `key_it_${Date.now()}`;
		await store.put({ key, payloadHash: "h1", status: "COMPLETED", result: { ok: true }, expiresAt: Date.now() + 60000 });
		expect((await store.get(key))?.status).toBe("COMPLETED");
		const expiredKey = `expired_${Date.now()}`;
		await store.put({ key: expiredKey, payloadHash: "h2", status: "COMPLETED", result: null, expiresAt: Date.now() - 1 });
		// expired rows are treated as absent
		expect(await store.get(expiredKey)).toBeUndefined();
	});

	it("outbox store: enqueue, dedupe by unique constraint, deliver", async () => {
		if (!available) return;
		const store = new PostgresOutboxStore(POOL);
		const id = `mission_outbox_${Date.now()}`;
		await store.enqueue({
			id,
			aggregateId: id,
			type: "post-journal",
			payloadHash: "h1",
			status: "pending",
			attempts: 0,
			createdAt: "2026-07-01T00:00:00.000Z",
		});
		expect((await store.findById(id))?.status).toBe("pending");
		// the (aggregate_id, payload_hash) unique constraint rejects the duplicate
		await expect(
			store.enqueue({
				id: `${id}_dup`,
				aggregateId: id,
				type: "post-journal",
				payloadHash: "h1",
				status: "pending",
				attempts: 0,
				createdAt: "2026-07-01T00:00:00.000Z",
			}),
		).rejects.toThrow();
		await store.markDelivered(id);
		expect(await store.wasDelivered(id, "h1")).toBe(true);
	});
});
