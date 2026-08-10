/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Evidence identity domain types (unit: evidence-identity).
 *
 * Authority rule (docs/architecture/authority-model.md):
 *   "Memoria orienta. Memory guides. (Drenyra Engram — never authorizes)"
 *
 * Evidence is the only thing that demonstrates; advisory memory never
 * authorizes calculations or execution. This unit owns the channel vocabulary
 * and the provenance shape; the authority unit (evidence/authority) enforces
 * the memory/advisory fail-closed rejection at registration.
 *
 * Single-definition re-exports: `EvidenceItem` and `computeEvidenceHash` live
 * in receipts/ (frozen contract) and are reused here, never redefined;
 * `ValidatedTenantScope` lives in tenant-core/ (frozen) and is required.
 */

import type { EvidenceItem } from "../../receipts/index.js";
import type { ValidatedTenantScope } from "../../tenant-core/index.js";

/** Non-advisory, evidence-bearing channels — the only channels that may authorize. */
export const EVIDENCE_CHANNEL = {
	DOCUMENT: "document",
	REPORT: "report",
	SYSTEM: "system",
	EXTERNAL: "external",
} as const;

export type EvidenceChannel =
	(typeof EVIDENCE_CHANNEL)[keyof typeof EVIDENCE_CHANNEL];

/** Memory-shaped channel markers (Drenyra Engram never authorizes). */
export const MEMORY_SHAPED_MARKERS = ["memory", "engram", "recall"] as const;

/** Advisory-shaped channel markers (assistant/LLM suggestions never authorize). */
export const ADVISORY_SHAPED_MARKERS = [
	"advisory",
	"assistant",
	"llm",
	"suggestion",
	"agent",
	"chat",
] as const;

/** True when the value is one of the allowed evidence channels. */
export function isEvidenceChannel(value: string): value is EvidenceChannel {
	return (Object.values(EVIDENCE_CHANNEL) as string[]).includes(value);
}

/**
 * Normalized provenance shape: fields validated and trimmed, but the channel
 * is not yet checked against the memory/advisory/allowlist gates owned by the
 * authority unit at registration.
 */
export interface EvidenceProvenanceShape {
	readonly channel: string;
	readonly source: string;
	readonly capturedAt: string;
	readonly capturedBy: string;
}

/** Immutable provenance of the evidence: channel, artifact, capture time/actor. */
export interface EvidenceProvenance {
	readonly channel: EvidenceChannel;
	readonly source: string;
	readonly capturedAt: string;
	readonly capturedBy: string;
}

/** Registration envelope; every field is validated fail-closed at runtime. */
export interface EvidenceInput {
	scope: unknown;
	items: unknown;
	provenance: unknown;
}

/** Immutable, tenant-bound evidence record produced by the authority. */
export interface RegisteredEvidence {
	readonly id: string;
	readonly scope: ValidatedTenantScope;
	readonly scopeKey: string;
	readonly items: readonly EvidenceItem[];
	readonly evidenceHash: string;
	readonly provenance: EvidenceProvenance;
}
