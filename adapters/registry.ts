/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Evidence adapter framework — Design 03 "ERP/SUNAT/banks evidence connectors"
 * and Design 04 "Evidence". Adapters obtain evidence from external systems and
 * files; they NEVER declare success without a verifiable response. Each item
 * carries a content hash and provenance; missing required sources surface as
 * WAITING_FOR_EVIDENCE signals (absence is never zero).
 */

import { createHash } from "node:crypto";
import type { EvidenceItem } from "../receipts/index.js";
import { computeEvidenceHash } from "../receipts/index.js";

/** What an adapter can produce, scoped by system and jurisdiction. */
export interface AdapterCapability {
	system: string;
	jurisdiction: string;
	evidenceTypes: readonly string[];
}

/** Scope of an evidence fetch (tenant-bound: RUC + fiscal period). */
export interface EvidenceFetchInput {
	missionId: string;
	ruc: string;
	period: string;
	requiredTypes: readonly string[];
}

/** Result of an evidence fetch. */
export interface AdapterResult {
	/** Evidence obtained, each hash-addressed and provenance-tagged. */
	items: readonly EvidenceItem[];
	/** Required types that could not be obtained (=> WAITING_FOR_EVIDENCE). */
	missingRequired: readonly string[];
	/** True only when every required type was obtained. */
	complete: boolean;
}

/** An evidence adapter contract. */
export interface EvidenceAdapter {
	readonly name: string;
	/** Declared capability (system + jurisdiction + evidence types). */
	declareCapability(): AdapterCapability;
	/** Fetch evidence for a scoped mission. Never throws success without items. */
	fetch(input: EvidenceFetchInput): Promise<AdapterResult>;
}

/** Registry of evidence adapters, resolved by system + jurisdiction. */
export class AdapterRegistry {
	readonly #adapters: EvidenceAdapter[] = [];

	register(adapter: EvidenceAdapter): void {
		const capability = adapter.declareCapability();
		const duplicate = this.#adapters.some(
			(existing) =>
				existing.declareCapability().system === capability.system &&
				existing.declareCapability().jurisdiction === capability.jurisdiction,
		);
		if (duplicate) {
			throw new Error(
				`adapter already registered for ${capability.system}/${capability.jurisdiction}`,
			);
		}
		this.#adapters.push(adapter);
	}

	resolve(system: string, jurisdiction: string): EvidenceAdapter | undefined {
		return this.#adapters.find(
			(adapter) =>
				adapter.declareCapability().system === system &&
				adapter.declareCapability().jurisdiction === jurisdiction,
		);
	}

	list(): readonly EvidenceAdapter[] {
		return [...this.#adapters];
	}
}

/** Build a hash-addressed evidence item (id = sha256 of its own content). */
export function evidenceItem(
	label: string,
	type: string,
	source: string,
	capturedAt: string,
): EvidenceItem {
	const content = JSON.stringify({ label, type, source, capturedAt });
	return {
		id: createHash("sha256").update(content, "utf8").digest("hex"),
		label,
		type,
	};
}

/** Manifest hash over the whole evidence set (order-independent). */
export function evidenceManifestHash(items: readonly EvidenceItem[]): string {
	return computeEvidenceHash([...items]);
}

/** Summarize which required types are still missing. */
export function missingTypes(
	items: readonly EvidenceItem[],
	required: readonly string[],
): string[] {
	const present = new Set(items.map((item) => item.type));
	return required.filter((type) => !present.has(type));
}
