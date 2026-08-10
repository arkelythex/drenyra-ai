/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Local file adapter — TEST-ONLY evidence adapter (development and demos).
 * Reads a directory of local evidence files and hash-addresses them.
 * Never for production: production adapters connect to real external systems
 * and confirm execution (see the adapter framework in registry.ts).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	AdapterResult,
	EvidenceAdapter,
	EvidenceFetchInput,
} from "./registry.js";
import { evidenceItem, missingTypes } from "./registry.js";

/** A test-only adapter reading evidence files from a local directory. */
export class LocalFileAdapter implements EvidenceAdapter {
	readonly name = "local-file";
	readonly #dir: string;

	constructor(dir: string) {
		this.#dir = dir;
	}

	declareCapability() {
		return {
			system: "local-files",
			jurisdiction: "PE",
			evidenceTypes: ["voucher", "statement", "ledger"],
		};
	}

	async fetch(input: EvidenceFetchInput): Promise<AdapterResult> {
		const files = readdirSync(this.#dir)
			.filter((file) => file.endsWith(".json"))
			.map((file) => join(this.#dir, file));
		const items = files.map((file) => {
			const raw = readFileSync(file, "utf8");
			const label = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
			return evidenceItem(
				label,
				"voucher",
				`local-files/${input.ruc}/${input.period}`,
				new Date().toISOString(),
			);
		});
		const missingRequired = missingTypes(items, input.requiredTypes);
		return {
			items,
			missingRequired,
			complete: missingRequired.length === 0,
		};
	}
}
