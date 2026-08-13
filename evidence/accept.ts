/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Accepted-evidence surface (work unit 1b-evidence-accept-conformance) — the
 * thin wrap-and-expose layer over the existing evidence-authority behavior.
 *
 * `acceptEvidence` delegates the entire fail-closed pipeline (envelope
 * narrowing, tenant-scope validation, item validation, provenance shape and
 * memory/advisory channel gates, deep-freeze immutability) to
 * `registerEvidence` unchanged, then exposes the canonical content identity
 * required by the evidence specification: `identity` is the frozen receipt
 * primitive `computeEvidenceHash` over the accepted items.
 *
 * The surface preserves the existing `id` (content-derived over scope key +
 * evidence hash + provenance) and `evidenceHash` (the receipt hash) fields and
 * adds the canonical receipt-hash-based `identity`. Any rejection throws an
 * `EvidenceError` and produces no artifact and no downstream-capable partial
 * object.
 */

import { computeEvidenceHash } from "../receipts/index.js";
import { registerEvidence } from "./authority/index.js";
import type { RegisteredEvidence } from "./identity/index.js";

/**
 * Deeply immutable accepted-evidence record. Extends the existing registered
 * record so `id`, `scope`, `scopeKey`, `items`, `evidenceHash`, and
 * `provenance` keep their established semantics, and adds the canonical
 * `identity` based on the frozen receipt hash.
 */
export interface AcceptedEvidence extends RegisteredEvidence {
	/** Canonical content identity: `computeEvidenceHash` over the accepted items. */
	readonly identity: string;
}

/**
 * Accepts a submission (`{ scope, items, provenance }`) as canonical evidence.
 * All validation and immutability are delegated to the existing authority
 * behavior; the canonical `identity` is derived from the frozen receipt hash.
 */
export function acceptEvidence(input: unknown): AcceptedEvidence {
	const registered = registerEvidence(input);
	const identity = computeEvidenceHash([...registered.items]);
	return Object.freeze({
		...registered,
		identity,
	}) as AcceptedEvidence;
}
