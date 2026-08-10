/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Evidence authority (unit: evidence-authority) — tenant-bound registration,
 * deep-freeze immutability, scope assertion, and memory/advisory fail-closed
 * rejection, built on the identity unit's canonical identity and provenance
 * shape validation.
 *
 * Registration is atomic: any invalid component yields an `EvidenceError` and
 * no partial evidence record is ever produced. The returned record is
 * deep-frozen (immutable) and its identity is content-derived over
 * scope + evidence hash + provenance, so identity commits to all three.
 */

import { computeEvidenceHash } from "../../receipts/index.js";
import type { EvidenceItem } from "../../receipts/index.js";
import {
	TENANT_SCOPE_BRAND,
	tenantScopeKey,
	validateTenantScope,
	type ValidatedTenantScope,
} from "../../tenant-core/index.js";
import {
	ADVISORY_SHAPED_MARKERS,
	deriveEvidenceIdentity,
	EvidenceError,
	EvidenceErrorCode,
	isEvidenceChannel,
	MEMORY_SHAPED_MARKERS,
	validateProvenanceShape,
	type EvidenceChannel,
	type EvidenceInput,
	type EvidenceProvenance,
	type RegisteredEvidence,
} from "../identity/index.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Non-empty after trimming. */
function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Fail-closed scope gate: the scope must be a branded ValidatedTenantScope and
 * must re-validate structurally, so a forged or mutated scope can never issue
 * or bind evidence.
 */
function validateScopeValue(scope: unknown): ValidatedTenantScope {
	if (!isRecord(scope) || scope.brand !== TENANT_SCOPE_BRAND) {
		throw new EvidenceError(
			EvidenceErrorCode.INVALID_SCOPE,
			"scope must be a ValidatedTenantScope",
		);
	}
	try {
		return validateTenantScope(scope);
	} catch (cause) {
		throw new EvidenceError(
			EvidenceErrorCode.INVALID_SCOPE,
			cause instanceof Error ? cause.message : "invalid tenant scope",
		);
	}
}

/** Fail-closed item gate: every item needs non-empty id, label, and type. */
function validateItems(items: unknown): EvidenceItem[] {
	if (!Array.isArray(items)) {
		throw new EvidenceError(
			EvidenceErrorCode.INVALID_ITEM,
			"items must be an array of EvidenceItem",
		);
	}
	for (const item of items) {
		if (
			!isRecord(item) ||
			!isNonEmptyString(item.id) ||
			!isNonEmptyString(item.label) ||
			!isNonEmptyString(item.type)
		) {
			throw new EvidenceError(
				EvidenceErrorCode.INVALID_ITEM,
				"each EvidenceItem needs non-empty id, label, and type strings",
			);
		}
	}
	return items as EvidenceItem[];
}

/**
 * Fail-closed channel gate: memory/advisory-shaped channels are rejected
 * before the allowlist so their failure vocabulary stays distinct from plain
 * malformed input. The channel arrives normalized (trimmed, lowercased) from
 * the identity unit's provenance shape validation.
 */
function resolveEvidenceChannel(normalizedChannel: string): EvidenceChannel {
	if ((MEMORY_SHAPED_MARKERS as readonly string[]).includes(normalizedChannel)) {
		throw new EvidenceError(
			EvidenceErrorCode.MEMORY_SHAPED,
			`memory-shaped channel "${normalizedChannel}" cannot authorize evidence`,
		);
	}
	if ((ADVISORY_SHAPED_MARKERS as readonly string[]).includes(normalizedChannel)) {
		throw new EvidenceError(
			EvidenceErrorCode.ADVISORY_SHAPED,
			`advisory-shaped channel "${normalizedChannel}" cannot authorize evidence`,
		);
	}
	if (!isEvidenceChannel(normalizedChannel)) {
		throw new EvidenceError(
			EvidenceErrorCode.MALFORMED_PROVENANCE,
			`unknown evidence channel "${normalizedChannel}"`,
		);
	}
	return normalizedChannel;
}

/** Recursively freezes plain objects and arrays (immutable authority output). */
function deepFreeze<T>(value: T): Readonly<T> {
	if (Array.isArray(value)) {
		for (const entry of value) deepFreeze(entry);
		Object.freeze(value);
	} else if (isRecord(value)) {
		for (const key of Object.keys(value)) deepFreeze(value[key]);
		Object.freeze(value);
	}
	return value as Readonly<T>;
}

/**
 * Registers evidence: validates scope, items, and provenance atomically, then
 * returns a deep-frozen record whose identity is derived from the canonical
 * scope key, the canonical evidence hash, and the normalized provenance.
 */
export function registerEvidence(input: unknown): RegisteredEvidence {
	if (!isRecord(input)) {
		throw new EvidenceError(
			EvidenceErrorCode.INVALID_INPUT,
			"evidence input must be an object",
		);
	}
	const envelope = input as unknown as EvidenceInput;

	const scope = validateScopeValue(envelope.scope);
	const items = validateItems(envelope.items);
	const shape = validateProvenanceShape(envelope.provenance);
	const provenance: EvidenceProvenance = {
		channel: resolveEvidenceChannel(shape.channel),
		source: shape.source,
		capturedAt: shape.capturedAt,
		capturedBy: shape.capturedBy,
	};

	const scopeKey = tenantScopeKey(scope);
	const evidenceHash = computeEvidenceHash(items);
	const id = deriveEvidenceIdentity({ scopeKey, evidenceHash, provenance: shape });

	return deepFreeze({
		id,
		scope: deepFreeze({ ...scope }),
		scopeKey,
		items: deepFreeze(items.map((item) => ({ ...item }))),
		evidenceHash,
		provenance: deepFreeze({ ...provenance }),
	});
}

/**
 * Scope guard: tenant-bound evidence can never be asserted under another
 * scope. The asserted scope is re-validated fail-closed before comparison.
 */
export function assertEvidenceInScope(
	evidence: RegisteredEvidence,
	scope: unknown,
): void {
	const validated = validateScopeValue(scope);
	if (evidence.scopeKey !== tenantScopeKey(validated)) {
		throw new EvidenceError(
			EvidenceErrorCode.SCOPE_MISMATCH,
			"evidence is bound to a different tenant scope",
		);
	}
}
