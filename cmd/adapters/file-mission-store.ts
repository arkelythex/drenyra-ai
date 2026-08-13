/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * DEVELOPMENT ADAPTER — JSON-file mission store for the drenyra-ai CLI.
 *
 * NOT canonical storage: this adapter persists the in-memory mission
 * stores (snapshots, events, idempotency records) as a single JSON file so a
 * shell-driven lifecycle can survive across process invocations. Production
 * deployments of the Drenyra ecosystem persist missions in the API's real
 * stores; this file is a local development/testing convenience.
 *
 * Writes are ATOMIC: serialize -> write a temp file in the same directory ->
 * fsync the temp file -> rename over the target -> best-effort fsync of the
 * parent directory (POSIX). A crash or failed write never leaves a truncated
 * or half-written store behind; the previous file stays intact.
 *
 * Persisted shape: { storeSchemaVersion, missions, events, idempotency }.
 * Loading tolerates legacy files without storeSchemaVersion (treated as 0).
 */

import {
	readFileSync,
	writeFileSync,
	openSync,
	closeSync,
	fsyncSync,
	renameSync,
	unlinkSync,
} from "node:fs";
import { dirname, basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
	InMemoryIdempotencyStore,
	InMemoryMissionEventStore,
	InMemoryMissionStore,
	type IdempotencyRecord,
	type MissionEvent,
	type MissionSnapshot,
} from "../../missions/index.js";

/** Version of the on-disk store shape written by this adapter. */
export const STORE_SCHEMA_VERSION = 1;

/** Default store file location (relative to the invocation cwd). */
export const DEFAULT_STORE_PATH = "./drenyra-missions.json";

/** Persisted store file shape. */
export interface MissionStoreFile {
	storeSchemaVersion: number;
	missions: MissionSnapshot[];
	events: MissionEvent[];
	idempotency: IdempotencyRecord[];
}

/** The three in-memory stores the MissionRuntime depends on. */
export interface MissionRuntimeStores {
	missions: InMemoryMissionStore;
	events: InMemoryMissionEventStore;
	idempotency: InMemoryIdempotencyStore;
}

function buildEmptyStores(): MissionRuntimeStores {
	return {
		missions: new InMemoryMissionStore(),
		events: new InMemoryMissionEventStore(),
		idempotency: new InMemoryIdempotencyStore(),
	};
}

function isEnoent(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "ENOENT"
	);
}

function loadStoreFile(filePath: string): MissionStoreFile {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
	} catch (error) {
		if (isEnoent(error)) {
			// Preserve the native ENOENT so hydrate() can recognize a missing
			// store and start from empty stores instead of failing.
			throw error;
		}
		throw new Error(
			`cannot parse mission store ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (typeof raw !== "object" || raw === null) {
		throw new Error(`${filePath} must be an object`);
	}
	const record = raw as Record<string, unknown>;
	const missions = record.missions;
	const events = record.events;
	const idempotency = record.idempotency;
	if (
		!Array.isArray(missions) ||
		!Array.isArray(events) ||
		!Array.isArray(idempotency)
	) {
		throw new Error(
			`${filePath} must be { missions, events, idempotency } arrays`,
		);
	}
	const storeSchemaVersion =
		typeof record.storeSchemaVersion === "number"
			? record.storeSchemaVersion
			: 0;
	return {
		storeSchemaVersion,
		missions: missions as MissionSnapshot[],
		events: events as MissionEvent[],
		idempotency: idempotency as IdempotencyRecord[],
	};
}

/**
 * Builds the temp-file path for an atomic write: same directory as the target
 * (same filesystem, so rename is atomic), with a discoverable .tmp pattern.
 */
export function buildTempPath(filePath: string): string {
	const dir = dirname(filePath);
	const base = basename(filePath);
	return join(dir, `${base}.tmp.${process.pid}.${randomUUID()}`);
}

/**
 * Atomic file write: temp file in the target's directory -> write + fsync ->
 * rename over the target -> best-effort fsync of the parent directory.
 *
 * On any failure the temp file is removed (best effort) and the original
 * target, if it existed, is left untouched. The parent-directory fsync is
 * best-effort because opening a directory for fsync is POSIX-only.
 */
export async function writeFileAtomic(
	filePath: string,
	data: string,
): Promise<void> {
	const tmpPath = buildTempPath(filePath);
	let fd: number | undefined;
	try {
		fd = openSync(tmpPath, "w", 0o644);
		writeFileSync(fd, data, "utf-8");
		fsyncSync(fd);
		closeSync(fd);
		fd = undefined;
		renameSync(tmpPath, filePath);
		// Best-effort parent-directory fsync (POSIX): guarantees the rename itself
		// is durable. Not fatal when unsupported (e.g. Windows or odd filesystems).
		let dirFd: number | undefined;
		try {
			dirFd = openSync(dirname(filePath), "r");
			fsyncSync(dirFd);
		} catch {
			// best-effort only
		} finally {
			if (dirFd !== undefined) {
				closeSync(dirFd);
			}
		}
	} catch (error) {
		if (fd !== undefined) {
			try {
				closeSync(fd);
			} catch {
				// already closed or unusable
			}
		}
		try {
			unlinkSync(tmpPath);
		} catch {
			// temp file may never have been created
		}
		throw error;
	}
}

/**
 * JSON-file mission store adapter. Hydrates the in-memory stores from the
 * file (or an empty store when the file does not exist) and persists them back
 * atomically.
 */
export class MissionFileStore {
	public readonly filePath: string;

	constructor(filePath: string) {
		this.filePath = filePath;
	}

	/** Loads the file (or starts empty on ENOENT) into fresh in-memory stores. */
	async hydrate(): Promise<MissionRuntimeStores> {
		let file: MissionStoreFile;
		try {
			file = loadStoreFile(this.filePath);
		} catch (error) {
			if (isEnoent(error)) {
				file = {
					storeSchemaVersion: STORE_SCHEMA_VERSION,
					missions: [],
					events: [],
					idempotency: [],
				};
			} else {
				throw error;
			}
		}
		const stores = buildEmptyStores();
		for (const snapshot of file.missions) {
			await stores.missions.save(snapshot);
		}
		for (const event of file.events) {
			await stores.events.append(event);
		}
		for (const record of file.idempotency) {
			await stores.idempotency.put(record);
		}
		return stores;
	}

	/** Serializes the in-memory stores and writes them atomically. */
	async persist(stores: MissionRuntimeStores): Promise<void> {
		const file: MissionStoreFile = {
			storeSchemaVersion: STORE_SCHEMA_VERSION,
			missions: await stores.missions.list(),
			events: stores.events.all(),
			idempotency: stores.idempotency.all(),
		};
		await writeFileAtomic(this.filePath, JSON.stringify(file, null, 2) + "\n");
	}
}
