import { describe, expect, it } from "vitest";
import { acquireFence, assertFence, FenceConflict, InMemoryFenceStore } from "../fencing.js";
import {
	deliverMessage,
	DuplicateDeliveryError,
	enqueueMessage,
	InMemoryOutboxStore,
} from "../outbox.js";

describe("fencing", () => {
	it("acquires monotonically increasing tokens per mission", async () => {
		const store = new InMemoryFenceStore();
		expect(await acquireFence(store, "mission_a")).toBe(1);
		expect(await acquireFence(store, "mission_a")).toBe(2);
		expect(await acquireFence(store, "mission_b")).toBe(1);
	});

	it("accepts a current token and rejects a stale one", async () => {
		const store = new InMemoryFenceStore();
		const token = await acquireFence(store, "mission_a");
		await assertFence(store, "mission_a", token);
		await acquireFence(store, "mission_a");
		await expect(assertFence(store, "mission_a", token)).rejects.toThrow(FenceConflict);
	});

	it("stale worker cannot write after a leader change", async () => {
		const store = new InMemoryFenceStore();
		const worker1 = await acquireFence(store, "mission_a");
		await acquireFence(store, "mission_a"); // leader change
		await expect(assertFence(store, "mission_a", worker1)).rejects.toThrow(FenceConflict);
	});
});

describe("outbox", () => {
	it("enqueues and delivers a message exactly once", async () => {
		const store = new InMemoryOutboxStore();
		const message = await enqueueMessage(store, {
			aggregateId: "mission_a",
			type: "post-journal",
			payloadHash: "h1",
		});
		expect(message.status).toBe("pending");
		expect(await deliverMessage(store, message.id)).toBe(true);
		expect(await deliverMessage(store, message.id)).toBe(false);
	});

	it("blocks a duplicate delivery of the same payload", async () => {
		const store = new InMemoryOutboxStore();
		const message = await enqueueMessage(store, {
			aggregateId: "mission_a",
			type: "post-journal",
			payloadHash: "h1",
		});
		await deliverMessage(store, message.id);
		await expect(
			enqueueMessage(store, { aggregateId: "mission_a", type: "post-journal", payloadHash: "h1" }),
		).rejects.toThrow(DuplicateDeliveryError);
	});

	it("returns the pending message when re-enqueued before delivery", async () => {
		const store = new InMemoryOutboxStore();
		const first = await enqueueMessage(store, {
			aggregateId: "mission_a",
			type: "post-journal",
			payloadHash: "h1",
		});
		const second = await enqueueMessage(store, {
			aggregateId: "mission_a",
			type: "post-journal",
			payloadHash: "h1",
		});
		expect(second.id).toBe(first.id);
	});

	it("marks failures and allows bounded retry", async () => {
		const store = new InMemoryOutboxStore();
		const message = await enqueueMessage(store, {
			aggregateId: "mission_a",
			type: "external-call",
			payloadHash: "h2",
		});
		await store.markFailed(message.id);
		const failed = await store.findById(message.id);
		expect(failed?.status).toBe("failed");
		expect(failed?.attempts).toBe(1);
		// still pending-eligible for bounded retry (not delivered)
		expect(await store.wasDelivered("mission_a", "h2")).toBe(false);
	});

	it("different payloads on the same aggregate are distinct deliveries", async () => {
		const store = new InMemoryOutboxStore();
		const a = await enqueueMessage(store, { aggregateId: "m", type: "t", payloadHash: "h1" });
		const b = await enqueueMessage(store, { aggregateId: "m", type: "t", payloadHash: "h2" });
		expect(a.id).not.toBe(b.id);
		expect(await deliverMessage(store, a.id)).toBe(true);
		expect(await deliverMessage(store, b.id)).toBe(true);
	});
});
