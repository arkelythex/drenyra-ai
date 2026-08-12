/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Core MCP tools — the uniform external-host surface (Design 03 "MCP server").
 *
 * Exposes read-only/verification tools from the frozen core: declared
 * capabilities and ledger validation. Mission/candidate mutations stay behind
 * the Core gates and are not exposed as blind MCP tools.
 */

import { validateLedger } from "../ledger/index.js";
import type { LedgerEntry, LedgerManifest } from "../ledger/index.js";
import type { McpTool } from "./protocol.js";

/**
 * Common declared capability facts shared with the CLI surface (consumer
 * port). Supplied at composition time by `cmd/declared-surface.ts`; the MCP
 * library never reads package files or imports `cmd/`.
 */
export interface DeclaredCapabilities {
	version: string;
	contracts: readonly { name: string; version: string; status: string }[];
	jurisdictions: readonly string[];
	adapters: readonly string[];
}

/** Declared capabilities (mirrors `drenyra-ai capabilities show`). */
export function capabilitiesTool(declared: DeclaredCapabilities): McpTool {
	return {
		name: "capabilities",
		description:
			"Declare available contracts, jurisdictions, skills, and adapters",
		inputSchema: {
			type: "object",
			properties: {},
			additionalProperties: false,
		},
		handler() {
			return declared;
		},
	};
}

/** Ledger chain validation (offline, from the frozen contracts). */
export function ledgerValidateTool(): McpTool {
	return {
		name: "ledger.validate",
		description: "Validate an append-only audit ledger hash chain",
		inputSchema: {
			type: "object",
			properties: {
				ledger: { type: "array", items: { type: "object" } },
				manifest: { type: "object" },
			},
			required: ["ledger"],
			additionalProperties: false,
		},
		handler(input) {
			const { ledger, manifest } = (input ?? {}) as {
				ledger?: unknown[];
				manifest?: unknown;
			};
			if (!Array.isArray(ledger)) {
				throw new Error("ledger must be an array");
			}
			if (typeof manifest !== "object" || manifest === null) {
				throw new Error("manifest is required (LedgerManifest)");
			}
			return validateLedger(
				manifest as LedgerManifest,
				ledger as LedgerEntry[],
			);
		},
	};
}
