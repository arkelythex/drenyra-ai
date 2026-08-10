/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Outbox — Design 04 "Idempotency and concurrency" (inbox/outbox delivery).
 *
 * Material messages (commands, confirmations, external calls) are enqueued and
 * delivered exactly once: a message with the same (aggregateId, payloadHash)
 * that was already delivered is never delivered again. This deduplicates
 * retries so a blind retry cannot double-post or double-submit.
 */

import { randomUUID } from "node:crypto";

/** Delivery state of an outbox message. */
export type OutboxStatus = "pending" | "delivered" | "failed";

/** A material message awaiting (or having completed) delivery. */
export interface OutboxMessage {
	id: string;
	aggregateId: string;
	type: string;
	/** Canonical hash of the payload (deduplication identity). */
	payloadHash: string;
	status: OutboxStatus;
	attempts: number;
	createdAt: string;
	deliveredAt?: string;
}

/** Raised when a message is enqueued that matches an already-delivered one. */
export class DuplicateDeliveryError extends Error {
	constructor(
		readonly aggregateId: string,
		readonly payloadHash: string,
	) {
		super(
			`duplicate delivery blocked for ${aggregateId} (payload ${payloadHash.slice(0, 12)}…)`,
		);
		this.name = "DuplicateDeliveryError";
	}
}

/** Persistence contract for the outbox. */
export interface OutboxStore {
	/** Persist a pending message; must reject a duplicate delivered hash. */
	enqueue(message: OutboxMessage): Promise<void>;
	/** Mark a message delivered (exactly-once completion). */
	markDelivered(id: string): Promise<void>;
	/** Mark a message failed (bounded retries allowed). */
	markFailed(id: string): Promise<void>;
	/** Find a pending message by aggregate + payload hash. */
	findPending(
		aggregateId: string,
		payloadHash: string,
	): Promise<OutboxMessage | undefined>;
	/** Find a message by its id. */
	findById(id: string): Promise<OutboxMessage | undefined>;
	/** True when a message with this payload hash was already delivered. */
	wasDelivered(aggregateId: string, payloadHash: string): Promise<boolean>;
}

/** In-memory outbox (development; production uses the transactional store). */
export class InMemoryOutboxStore implements OutboxStore {
	readonly #messages = new Map<string, OutboxMessage>();

	async enqueue(message: OutboxMessage): Promise<void> {
		if (await this.wasDelivered(message.aggregateId, message.payloadHash)) {
			throw new DuplicateDeliveryError(
				message.aggregateId,
				message.payloadHash,
			);
		}
		this.#messages.set(message.id, message);
	}

	async markDelivered(id: string): Promise<void> {
		const message = this.#messages.get(id);
		if (message === undefined) return;
		message.status = "delivered";
		message.deliveredAt = new Date().toISOString();
	}

	async markFailed(id: string): Promise<void> {
		const message = this.#messages.get(id);
		if (message === undefined) return;
		message.status = "failed";
		message.attempts += 1;
	}

	async findPending(
		aggregateId: string,
		payloadHash: string,
	): Promise<OutboxMessage | undefined> {
		for (const message of this.#messages.values()) {
			if (
				message.aggregateId === aggregateId &&
				message.payloadHash === payloadHash
			) {
				return message;
			}
		}
		return undefined;
	}

	async findById(id: string): Promise<OutboxMessage | undefined> {
		return this.#messages.get(id);
	}

	async wasDelivered(
		aggregateId: string,
		payloadHash: string,
	): Promise<boolean> {
		const found = await this.findPending(aggregateId, payloadHash);
		return found !== undefined && found.status === "delivered";
	}
}

/**
 * Enqueue a material message, deduplicating against delivered payloads.
 * Returns the new message, or the existing pending one when already queued.
 */
export async function enqueueMessage(
	store: OutboxStore,
	input: { aggregateId: string; type: string; payloadHash: string },
): Promise<OutboxMessage> {
	const existing = await store.findPending(
		input.aggregateId,
		input.payloadHash,
	);
	if (existing !== undefined) {
		if (existing.status === "delivered") {
			throw new DuplicateDeliveryError(input.aggregateId, input.payloadHash);
		}
		return existing;
	}
	const message: OutboxMessage = {
		id: `outbox_${randomUUID()}`,
		aggregateId: input.aggregateId,
		type: input.type,
		payloadHash: input.payloadHash,
		status: "pending",
		attempts: 0,
		createdAt: new Date().toISOString(),
	};
	await store.enqueue(message);
	return message;
}

/**
 * Deliver a pending message exactly once. Returns false (and does not
 * re-deliver) when the payload was already delivered.
 */
export async function deliverMessage(
	store: OutboxStore,
	id: string,
): Promise<boolean> {
	const message = await store.findById(id);
	if (message === undefined) return false;
	if (message.status === "delivered") return false;
	await store.markDelivered(id);
	return true;
}
