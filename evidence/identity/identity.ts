/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Canonical identity and provenance validation (unit: evidence-identity).
 *
 * The evidence identity is content-derived over the canonical scope key, the
 * canonical evidence hash (frozen receipt contract), and the normalized
 * provenance, so identity commits to all three. Provenance is validated
 * fail-closed at the shape level here; the memory/advisory/allowlist channel
 * gates are enforced by the authority unit at registration.
 */

import { createHash } from "node:crypto";
import { sortedStringify } from "../../receipts/index.js";
import { EvidenceError, EvidenceErrorCode } from "./errors.js";
import type { EvidenceProvenanceShape } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Non-empty after trimming. */
function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/** ISO-8601 parseable timestamp. */
function isTimestamp(value: unknown): value is string {
	return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/**
 * Fail-closed provenance shape gate. Missing provenance is rejected before
 * shape checks; the fields are normalized (trimmed, channel lowercased) so the
 * authority can apply the memory/advisory/allowlist gates on canonical bytes.
 */
export function validateProvenanceShape(
	provenance: unknown,
): EvidenceProvenanceShape {
	if (provenance === undefined) {
		throw new EvidenceError(
			EvidenceErrorCode.MISSING_PROVENANCE,
			"provenance is required",
		);
	}
	if (!isRecord(provenance)) {
		throw new EvidenceError(
			EvidenceErrorCode.MALFORMED_PROVENANCE,
			"provenance must be an object",
		);
	}

	const { channel, source, capturedAt, capturedBy } = provenance;
	if (
		typeof channel !== "string" ||
		!isNonEmptyString(source) ||
		!isNonEmptyString(capturedBy) ||
		!isTimestamp(capturedAt)
	) {
		throw new EvidenceError(
			EvidenceErrorCode.MALFORMED_PROVENANCE,
			"provenance needs channel, non-empty source, ISO capturedAt, and non-empty capturedBy",
		);
	}

	return {
		channel: channel.trim().toLowerCase(),
		source: source.trim(),
		capturedAt,
		capturedBy: capturedBy.trim(),
	};
}

/** Inputs for canonical identity derivation: scope key + evidence hash + provenance. */
export interface EvidenceIdentityInput {
	readonly scopeKey: string;
	readonly evidenceHash: string;
	readonly provenance: EvidenceProvenanceShape;
}

/**
 * Derives the canonical content-based evidence identity: SHA-256 over the
 * scope key, the canonical evidence hash, and the normalized provenance,
 * serialized with the frozen `sortedStringify` byte contract.
 */
export function deriveEvidenceIdentity(input: EvidenceIdentityInput): string {
	const idPayload = sortedStringify({
		scopeKey: input.scopeKey,
		evidenceHash: input.evidenceHash,
		provenance: {
			channel: input.provenance.channel,
			source: input.provenance.source,
			capturedAt: input.provenance.capturedAt,
			capturedBy: input.provenance.capturedBy,
		},
	});
	return createHash("sha256").update(idPayload).digest("hex");
}
