/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission persistence ports — store interfaces plus in-memory implementations.
 *
 * The MissionRuntime depends only on these interfaces; file/DB persistence is
 * an adapter concern (drenyra-ai's CLI keeps file I/O inside cli.ts). The
 * in-memory implementations hydrate from and persist to plain JSON objects so
 * the CLI can round-trip a store file without a database.
 */

import type { MissionSnapshot } from "./types.js";
import type { MissionEvent } from "./events.js";
import type { AccountingMissionStatus } from "./status.js";

/**
 * Stores mission snapshots keyed by mission id.
 */
export interface MissionStore {
  save(snapshot: MissionSnapshot): Promise<void>;
  findById(id: string): Promise<MissionSnapshot | undefined>;
  findByStatus(statuses: AccountingMissionStatus[]): Promise<MissionSnapshot[]>;
  list(): Promise<MissionSnapshot[]>;
}

/**
 * Append-only mission event log, ordered by per-mission sequence.
 */
export interface MissionEventStore {
  append(event: MissionEvent): Promise<void>;
  list(missionId: string): Promise<MissionEvent[]>;
}

/**
 * Idempotency record bound to one command attempt.
 *
 * `payloadHash` is the canonical SHA-256 of the command; `result` carries the
 * cached { snapshot, event } outcome of a completed attempt (or failure
 * metadata for a FAILED attempt). `expiresAt` is a UNIX epoch millisecond.
 */
export interface IdempotencyRecord {
  key: string;
  payloadHash: string;
  status: "EXECUTING" | "COMPLETED" | "FAILED";
  result?: unknown;
  expiresAt: number;
}

/**
 * Stores idempotency records keyed by idempotency key.
 */
export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  put(record: IdempotencyRecord): Promise<void>;
}

/**
 * In-memory mission snapshot store.
 */
export class InMemoryMissionStore implements MissionStore {
  private readonly snapshots = new Map<string, MissionSnapshot>();

  async save(snapshot: MissionSnapshot): Promise<void> {
    this.snapshots.set(snapshot.id, snapshot);
  }

  async findById(id: string): Promise<MissionSnapshot | undefined> {
    return this.snapshots.get(id);
  }

  async findByStatus(
    statuses: AccountingMissionStatus[],
  ): Promise<MissionSnapshot[]> {
    const wanted = new Set(statuses);
    return [...this.snapshots.values()].filter((s) => wanted.has(s.status));
  }

  async list(): Promise<MissionSnapshot[]> {
    return [...this.snapshots.values()];
  }
}

/**
 * In-memory append-only mission event log.
 */
export class InMemoryMissionEventStore implements MissionEventStore {
  private readonly events = new Map<string, MissionEvent[]>();

  async append(event: MissionEvent): Promise<void> {
    const existing = this.events.get(event.missionId) ?? [];
    existing.push(event);
    this.events.set(event.missionId, existing);
  }

  async list(missionId: string): Promise<MissionEvent[]> {
    const events = this.events.get(missionId) ?? [];
    return [...events].sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * All events across all missions, in append order (for persistence).
   * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt
   * cents; no float is ever used for money in drenyra-ai.
   */
  all(): MissionEvent[] {
    return [...this.events.values()].flat();
  }
}

/**
 * In-memory idempotency store. Expired records are treated as absent so a
 * retried command after the TTL window re-executes cleanly.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.records.get(key);
    if (record === undefined) return undefined;
    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return undefined;
    }
    return record;
  }

  async put(record: IdempotencyRecord): Promise<void> {
    this.records.set(record.key, record);
  }

  /**
   * All idempotency records, including expired-but-unpruned (for persistence).
   * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt
   * cents; no float is ever used for money in drenyra-ai.
   */
  all(): IdempotencyRecord[] {
    return [...this.records.values()];
  }
}
