/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Protocol versioning — capabilities, compatibility, and feature negotiation.
 *
 * Enables multi-surface clients (CLI, web, desktop, mobile) with different
 * release cycles to negotiate supported features with the server.
 *
 * Capability naming convention:
 *   <domain>.<action>.<mechanism>.v<major>
 *
 * Examples:
 *   mission.create.http.v1
 *   mission.watch.sse.v1
 *   receipt.verify.hash.v1
 *   receipt.verify.signature.ed25519.v1
 */

/**
 * Current protocol version.
 * Follows semver: MAJOR.minor
 * MAJOR bumps indicate breaking changes in the wire protocol.
 */
export const PROTOCOL_VERSION = "1.0";

/**
 * Minimum supported client version for this server version.
 */
export const MINIMUM_CLIENT_VERSION = "1.0";

/**
 * Granular protocol capabilities using domain.action.mechanism.vN format.
 * Enables evolving one capability independently of others.
 *
 * Patch: documentation, internal compatible validation fixes
 * Minor: new optional capability, new optional field, new event
 * Major: semantic change, required field, removal/rename, canonicalization change, state change
 */
export const SUPPORTED_FEATURES = [
	// Mission lifecycle
	"mission.create.http.v1",
	"mission.read.http.v1",
	"mission.list.http.v1",
	"mission.execute.http.v1",
	"mission.approve.http.v1",
	"mission.reject.http.v1",
	"mission.reconcile.http.v1",

	// Gates and exceptions
	"mission.gates.read.http.v1",
	"mission.exceptions.read.http.v1",

	// SSE streaming
	"mission.watch.sse.v1",
	"mission.watch.cursor.v1",

	// Idempotency
	"idempotency.key.v1",
	"idempotency.replay.v1",

	// Concurrency
	"concurrency.optimistic.v1",

	// Receipts
	"receipt.verify.hash.v1",

	// Multi-signer
	"approval.multi-signer.v1",

	// Protocol
	"protocol.capabilities.v1",
] as const;

export type ProtocolFeature = (typeof SUPPORTED_FEATURES)[number];

/**
 * Server capabilities response.
 * Returned by the /capabilities endpoint.
 */
export interface CapabilitiesResponse {
	protocolVersion: string;
	minimumClientVersion: string;
	features: ProtocolFeature[];
	deprecatedFields?: string[];
}

/**
 * Returns the current server capabilities.
 */
export function getCapabilities(): CapabilitiesResponse {
	return {
		protocolVersion: PROTOCOL_VERSION,
		minimumClientVersion: MINIMUM_CLIENT_VERSION,
		features: [...SUPPORTED_FEATURES],
	};
}

/**
 * Compares two semver versions.
 */
export function compareVersions(a: string, b: string): number {
	const aParts = a.split(".").map(Number);
	const bParts = b.split(".").map(Number);
	for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
		const aVal = aParts[i] ?? 0;
		const bVal = bParts[i] ?? 0;
		if (aVal !== bVal) return aVal - bVal;
	}
	return 0;
}

/**
 * Checks if a client version is compatible with the server.
 */
export function isClientCompatible(
	clientVersion: string,
	minimumClientVersion: string,
): boolean {
	return compareVersions(clientVersion, minimumClientVersion) >= 0;
}

/**
 * Checks if a specific feature is supported.
 */
export function hasFeature(
	capabilities: CapabilitiesResponse,
	feature: string,
): boolean {
	return capabilities.features.includes(feature as ProtocolFeature);
}
