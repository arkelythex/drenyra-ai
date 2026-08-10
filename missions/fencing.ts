/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Fencing tokens — Design 04 "Idempotency and concurrency".
 *
 * Parallel workers may analyze the same mission, but a stale worker must not
 * write. Each worker acquires a monotonically increasing fence token for a
 * mission; `assertFence` rejects any write carrying a token older than the
 * current one (fencing prevents the "zombie writer" after a leader change).
 */

/** Raised when a worker's fence token is stale. */
export class FenceConflict extends Error {
	constructor(
		readonly missionId: string,
		readonly currentToken: number,
		readonly staleToken: number,
	) {
		super(
			`fence conflict on ${missionId}: current token ${currentToken}, stale worker token ${staleToken}`,
		);
		this.name = "FenceConflict";
	}
}

/** Persistence contract for fence tokens. */
export interface FenceStore {
	/** Read the current token for a mission (0 when never fenced). */
	getToken(missionId: string): Promise<number>;
	/** Atomically set the current token for a mission. */
	setToken(missionId: string, token: number): Promise<void>;
}

/** In-memory fence store (development; production uses the transactional store). */
export class InMemoryFenceStore implements FenceStore {
	readonly #tokens = new Map<string, number>();

	async getToken(missionId: string): Promise<number> {
		return this.#tokens.get(missionId) ?? 0;
	}

	async setToken(missionId: string, token: number): Promise<void> {
		this.#tokens.set(missionId, token);
	}
}

/** Acquire a fresh fence token for a worker (monotonically increasing). */
export async function acquireFence(
	store: FenceStore,
	missionId: string,
): Promise<number> {
	const next = (await store.getToken(missionId)) + 1;
	await store.setToken(missionId, next);
	return next;
}

/** Assert a worker's token is still current; throws FenceConflict when stale. */
export async function assertFence(
	store: FenceStore,
	missionId: string,
	token: number,
): Promise<void> {
	const current = await store.getToken(missionId);
	if (token < current) {
		throw new FenceConflict(missionId, current, token);
	}
}
