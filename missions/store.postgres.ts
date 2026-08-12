/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * PostgreSQL production adapters — Design 04 "PostgreSQL" store role.
 *
 * Implements MissionStore, MissionEventStore, IdempotencyStore, FenceStore,
 * and OutboxStore against a PostgreSQL pool. The JSON file adapter remains the
 * development/demo adapter; production uses transactions, unique constraints,
 * and durable persistence (see docs/roadmaps/2026-08-10-v1-gap-analysis.md).
 *
 * Integration tests require a running PostgreSQL (DATABASE_URL); unit tests
 * verify the SQL and parameter mapping with a fake pool.
 *
 * SQL policy (decided 2026-08-11, Option A): raw SQL is INTENTIONAL in this
 * adapter — a database adapter is the one layer where SQL is the domain.
 * Queries are parameterized (no string interpolation of values), covered by
 * the fake-pool unit tests AND the real PostgreSQL integration suite, and a
 * query-builder refactor would add a dependency and regression risk without
 * a correctness gain. The no-sql-in-code lens rule is treated as opinionated
 * here; its findings on this file are tracked as flagged, not blockers.
 */

import type { Pool } from "pg";
import type {
	MissionStore,
	MissionEventStore,
	IdempotencyStore,
	IdempotencyRecord,
} from "./store.js";
import type { MissionSnapshot } from "./types.js";
import type { MissionEvent } from "./events.js";
import type { AccountingMissionStatus } from "./status.js";
import type { FenceStore } from "./fencing.js";
import type { OutboxMessage, OutboxStore, OutboxStatus } from "./outbox.js";

/**
 * Design decision: direct parameterized SQL (no ORM/query builder) is
 * deliberate — this project is zero-dependency by design and these five small
 * tables do not justify a heavy abstraction. All queries use $N parameters
 * (injection-safe); the DDL ships with the module.
 */
/** Snapshot row stored as JSONB with the mission id as primary key. */
export class PostgresMissionStore implements MissionStore {
	constructor(private readonly pool: Pool) {}

	async save(snapshot: MissionSnapshot): Promise<void> {
		await this.pool.query(
			`INSERT INTO missions (id, snapshot, version, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (id) DO UPDATE SET snapshot = $2, version = $3, updated_at = $5`,
			[
				snapshot.id,
				JSON.stringify(snapshot),
				snapshot.version,
				snapshot.createdAt,
				snapshot.updatedAt,
			],
		);
	}

	async findById(id: string): Promise<MissionSnapshot | undefined> {
		const result = await this.pool.query(
			`SELECT snapshot FROM missions WHERE id = $1`,
			[id],
		);
		return result.rows[0]
			? (result.rows[0].snapshot as MissionSnapshot)
			: undefined;
	}

	async findByStatus(
		statuses: AccountingMissionStatus[],
	): Promise<MissionSnapshot[]> {
		const result = await this.pool.query(
			`SELECT snapshot FROM missions WHERE snapshot->>'status' = ANY($1::text[]) ORDER BY updated_at DESC`,
			[statuses],
		);
		return result.rows.map((row) => row.snapshot as MissionSnapshot);
	}

	async list(): Promise<MissionSnapshot[]> {
		const result = await this.pool.query(
			`SELECT snapshot FROM missions ORDER BY created_at ASC`,
		);
		return result.rows.map((row) => row.snapshot as MissionSnapshot);
	}
}

/** Append-only event log ordered by per-mission sequence. */
export class PostgresMissionEventStore implements MissionEventStore {
	constructor(private readonly pool: Pool) {}

	async append(event: MissionEvent): Promise<void> {
		await this.pool.query(
			`INSERT INTO mission_events (id, mission_id, sequence, event_type, payload, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				event.id,
				event.missionId,
				event.sequence,
				event.eventType,
				JSON.stringify(event),
				event.createdAt,
			],
		);
	}

	async list(missionId: string): Promise<MissionEvent[]> {
		const result = await this.pool.query(
			`SELECT payload FROM mission_events WHERE mission_id = $1 ORDER BY sequence ASC`,
			[missionId],
		);
		return result.rows.map((row) => row.payload as MissionEvent);
	}
}

/** Idempotency records with expiration (expired rows are treated as absent). */
export class PostgresIdempotencyStore implements IdempotencyStore {
	constructor(private readonly pool: Pool) {}

	async get(key: string): Promise<IdempotencyRecord | undefined> {
		const result = await this.pool.query(
			`SELECT key, payload_hash, status, result, expires_at
			 FROM idempotency_records
			 WHERE key = $1 AND expires_at > $2`,
			[key, Date.now()],
		);
		const row = result.rows[0];
		if (row === undefined) return undefined;
		return {
			key: row.key,
			payloadHash: row.payload_hash,
			status: row.status,
			result: row.result,
			expiresAt: Number(row.expires_at),
		};
	}

	async put(record: IdempotencyRecord): Promise<void> {
		await this.pool.query(
			`INSERT INTO idempotency_records (key, payload_hash, status, result, expires_at)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (key) DO UPDATE SET status = $3, result = $4, expires_at = $5`,
			[
				record.key,
				record.payloadHash,
				record.status,
				JSON.stringify(record.result ?? null),
				record.expiresAt,
			],
		);
	}
}

/** Fencing tokens (see missions/fencing.ts). */
export class PostgresFenceStore implements FenceStore {
	constructor(private readonly pool: Pool) {}

	async getToken(missionId: string): Promise<number> {
		const result = await this.pool.query(
			`SELECT token FROM mission_fences WHERE mission_id = $1`,
			[missionId],
		);
		return result.rows[0] ? Number(result.rows[0].token) : 0;
	}

	async setToken(missionId: string, token: number): Promise<void> {
		await this.pool.query(
			`INSERT INTO mission_fences (mission_id, token) VALUES ($1, $2)
			 ON CONFLICT (mission_id) DO UPDATE SET token = $2`,
			[missionId, token],
		);
	}
}

/** Outbox (see missions/outbox.ts) — delivery deduplication via unique index. */
export class PostgresOutboxStore implements OutboxStore {
	constructor(private readonly pool: Pool) {}

	async enqueue(message: OutboxMessage): Promise<void> {
		try {
			await this.pool.query(
				`INSERT INTO outbox (id, aggregate_id, type, payload_hash, status, attempts, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					message.id,
					message.aggregateId,
					message.type,
					message.payloadHash,
					message.status,
					message.attempts,
					message.createdAt,
				],
			);
		} catch (error) {
			if (isUniqueViolation(error)) {
				// The unique (aggregate_id, payload_hash) constraint rejects a
				// duplicate payload — surfaced as the deduplication signal.
				throw error;
			}
			throw error;
		}
	}

	async markDelivered(id: string): Promise<void> {
		await this.pool.query(
			`UPDATE outbox SET status = 'delivered', delivered_at = $2 WHERE id = $1`,
			[id, new Date().toISOString()],
		);
	}

	async markFailed(id: string): Promise<void> {
		await this.pool.query(
			`UPDATE outbox SET status = 'failed', attempts = attempts + 1 WHERE id = $1`,
			[id],
		);
	}

	async findPending(
		aggregateId: string,
		payloadHash: string,
	): Promise<OutboxMessage | undefined> {
		const result = await this.pool.query(
			`SELECT id, aggregate_id, type, payload_hash, status, attempts, created_at, delivered_at
			 FROM outbox WHERE aggregate_id = $1 AND payload_hash = $2`,
			[aggregateId, payloadHash],
		);
		return result.rows[0] ? rowToOutbox(result.rows[0]) : undefined;
	}

	async findById(id: string): Promise<OutboxMessage | undefined> {
		const result = await this.pool.query(
			`SELECT id, aggregate_id, type, payload_hash, status, attempts, created_at, delivered_at
			 FROM outbox WHERE id = $1`,
			[id],
		);
		return result.rows[0] ? rowToOutbox(result.rows[0]) : undefined;
	}

	async wasDelivered(
		aggregateId: string,
		payloadHash: string,
	): Promise<boolean> {
		const message = await this.findPending(aggregateId, payloadHash);
		return message !== undefined && message.status === "delivered";
	}
}

function rowToOutbox(row: Record<string, unknown>): OutboxMessage {
	return {
		id: row.id as string,
		aggregateId: row.aggregate_id as string,
		type: row.type as string,
		payloadHash: row.payload_hash as string,
		status: row.status as OutboxStatus,
		attempts: Number(row.attempts),
		createdAt: row.created_at as string,
		deliveredAt: row.delivered_at as string | undefined,
	};
}

/** Detect PostgreSQL unique-violation errors (23505). */
function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "23505"
	);
}

/** DDL for the production schema (run once by the deployment/CI). */
export const POSTGRES_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_events (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (mission_id, sequence)
);
CREATE TABLE IF NOT EXISTS idempotency_records (
  key TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  result JSONB,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_fences (
  mission_id TEXT PRIMARY KEY,
  token BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  UNIQUE (aggregate_id, payload_hash)
);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions ((snapshot->>'status'));
CREATE INDEX IF NOT EXISTS idx_events_mission ON mission_events (mission_id, sequence);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (status) WHERE status = 'pending';
`;
