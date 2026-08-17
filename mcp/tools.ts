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

    import {
    	BankReconciliationError,
    	normalizeBankRows,
    	normalizeLedgerRows,
    	reconcile,
    	validateScope,
    	type BankRow,
    	type Difference,
    	type LedgerRow,
    	type Scope,
    } from "../bank-reconciliation/index.js";
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

    /** Structured `bank.reconcile` tool result (serialized into `content[0].text`). */
    export type BankReconcileToolResult =
    	| {
    			ok: true;
    			scope: Scope;
    			differences: readonly Difference[];
    			fullyMatched: boolean;
    	  }
    	| {
    			ok: false;
    			code: string;
    			message: string;
    			rejections?: readonly {
    				sourceKey: string;
    				code: string;
    				detail: string;
    			}[];
    	  };

    /** JSON Schema (draft-07 style) for `bank.reconcile` — mirrors `ledgerValidateTool()`. */
    const BANK_RECONCILE_INPUT_SCHEMA: Record<string, unknown> = {
    	type: "object",
    	properties: {
    		scope: {
    			type: "object",
    			properties: {
    				ruc: { type: "string", minLength: 11, maxLength: 11 },
    				period: { type: "string", pattern: "^\\d{6}$" },
    			},
    			required: ["ruc", "period"],
    			additionalProperties: false,
    		},
    		bank: { type: "array", items: { $ref: "#/definitions/bankRow" } },
    		ledger: { type: "array", items: { $ref: "#/definitions/ledgerRow" } },
    	},
    	required: ["scope", "bank", "ledger"],
    	additionalProperties: false,
    	definitions: {
    		bankRow: {
    			type: "object",
    			properties: {
    				ruc: { type: "string" },
    				date: { type: "string" },
    				reference: { type: "string" },
    				amount: {
    					type: "string",
    					description: "Decimal string of integer cents; never a JSON number",
    				},
    				side: { enum: ["deposit", "withdrawal"] },
    				sourceKey: { type: "string" },
    			},
    			required: ["ruc", "date", "reference", "amount", "side", "sourceKey"],
    			additionalProperties: false,
    		},
    		ledgerRow: {
    			type: "object",
    			properties: {
    				ruc: { type: "string" },
    				date: { type: "string" },
    				reference: { type: "string" },
    				amount: {
    					type: "string",
    					description: "Decimal string of integer cents; never a JSON number",
    				},
    				side: { enum: ["debit", "credit"] },
    				sourceKey: { type: "string" },
    			},
    			required: ["ruc", "date", "reference", "amount", "side", "sourceKey"],
    			additionalProperties: false,
    		},
    	},
    };

    const SCOPE_FIELDS: readonly string[] = ["ruc", "period"];
    const TOP_LEVEL_FIELDS: readonly string[] = ["scope", "bank", "ledger"];
    const BANK_ROW_FIELDS: readonly string[] = [
    	"ruc",
    	"date",
    	"reference",
    	"amount",
    	"side",
    	"sourceKey",
    ];
    const LEDGER_ROW_FIELDS: readonly string[] = BANK_ROW_FIELDS;
    const BANK_SIDE_TOKENS: ReadonlySet<string> = new Set(["deposit", "withdrawal"]);
    const LEDGER_SIDE_TOKENS: ReadonlySet<string> = new Set(["debit", "credit"]);

    /** Deep-convert BigInt values to decimal strings so no BigInt reaches the wire. */
    function toJsonSafe(value: unknown): unknown {
    	if (typeof value === "bigint") return value.toString();
    	if (Array.isArray(value)) return value.map(toJsonSafe);
    	if (value !== null && typeof value === "object") {
    		return Object.fromEntries(
    			Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
    				key,
    				toJsonSafe(nested),
    			]),
    		);
    	}
    	return value;
    }

    /** Hand-rolled scope shape check (node:crypto-only; no runtime JSON-Schema validator). */
    function scopeShapeError(scope: unknown): string | null {
    	if (typeof scope !== "object" || scope === null || Array.isArray(scope)) {
    		return "scope must be an object";
    	}
    	const record = scope as Record<string, unknown>;
    	for (const field of SCOPE_FIELDS) {
    		if (!(field in record)) {
    			return `scope is missing required property "${field}"`;
    		}
    	}
    	const extra = Object.keys(record).filter((key) => !SCOPE_FIELDS.includes(key));
    	if (extra.length > 0) {
    		return `scope has extra properties: ${extra.join(", ")}`;
    	}
    	if (typeof record.ruc !== "string") return "scope.ruc must be a string";
    	if (typeof record.period !== "string") return "scope.period must be a string";
    	return null;
    }

    /** Hand-rolled row shape check: required fields, types, side enum, no extra props. */
    function rowShapeError(
    	row: unknown,
    	index: number,
    	label: "bank" | "ledger",
    	sideTokens: ReadonlySet<string>,
    ): string | null {
    	const path = `${label}[${index}]`;
    	if (typeof row !== "object" || row === null || Array.isArray(row)) {
    		return `${path} must be an object`;
    	}
    	const record = row as Record<string, unknown>;
    	const fields = label === "bank" ? BANK_ROW_FIELDS : LEDGER_ROW_FIELDS;
    	for (const field of fields) {
    		if (!(field in record)) {
    			return `${path} is missing required property "${field}"`;
    		}
    	}
    	const extra = Object.keys(record).filter((key) => !fields.includes(key));
    	if (extra.length > 0) {
    		return `${path} has extra properties: ${extra.join(", ")}`;
    	}
    	if (typeof record.ruc !== "string") return `${path}.ruc must be a string`;
    	if (typeof record.date !== "string") return `${path}.date must be a string`;
    	if (typeof record.reference !== "string") {
    		return `${path}.reference must be a string`;
    	}
    	if (typeof record.amount !== "string") {
    		return `${path}.amount must be a decimal string, never a JSON number`;
    	}
    	if (typeof record.side !== "string" || !sideTokens.has(record.side)) {
    		const allowed = [...sideTokens].map((token) => `"${token}"`).join(", ");
    		return `${path}.side must be one of ${allowed}`;
    	}
    	if (typeof record.sourceKey !== "string") {
    		return `${path}.sourceKey must be a string`;
    	}
    	return null;
    }

    /** Top-level shape validation; returns an error message naming the field, or null. */
    function inputShapeError(input: unknown): string | null {
    	if (typeof input !== "object" || input === null || Array.isArray(input)) {
    		return "input must be an object";
    	}
    	const record = input as Record<string, unknown>;
    	for (const field of TOP_LEVEL_FIELDS) {
    		if (!(field in record)) {
    			return `input is missing required property "${field}"`;
    		}
    	}
    	const extra = Object.keys(record).filter((key) => !TOP_LEVEL_FIELDS.includes(key));
    	if (extra.length > 0) {
    		return `input has extra properties: ${extra.join(", ")}`;
    	}
    	const scopeError = scopeShapeError(record.scope);
    	if (scopeError !== null) return scopeError;
    	if (!Array.isArray(record.bank)) return "bank must be an array";
    	if (!Array.isArray(record.ledger)) return "ledger must be an array";
    	const bankRows = record.bank as unknown[];
    	for (let index = 0; index < bankRows.length; index += 1) {
    		const rowError = rowShapeError(bankRows[index], index, "bank", BANK_SIDE_TOKENS);
    		if (rowError !== null) return rowError;
    	}
    	const ledgerRows = record.ledger as unknown[];
    	for (let index = 0; index < ledgerRows.length; index += 1) {
    		const rowError = rowShapeError(
    			ledgerRows[index],
    			index,
    			"ledger",
    			LEDGER_SIDE_TOKENS,
    		);
    		if (rowError !== null) return rowError;
    	}
    	return null;
    }

    /**
     * Read-only wrapper over the SDD-CON-001 engine, exposed as MCP tool
     * `bank.reconcile`. Never throws across the wire: the handler returns the
     * structured `BankReconcileToolResult` serialized into `content[0].text`.
     */
    export function bankReconcileTool(): McpTool {
    	return {
    		name: "bank.reconcile",
    		description:
    			"Reconcile bank statement rows against ledger movements within one RUC + fiscal period (read-only, advisory). Validates the scope, normalizes every row fail-closed, and delegates to the deterministic bank-reconciliation engine; returns matched/bankOnly/ledgerOnly/conflict classifications and the fullyMatched flag. Money travels as decimal strings; amounts are never JSON numbers.",
    		inputSchema: BANK_RECONCILE_INPUT_SCHEMA,
    		handler(input: unknown): BankReconcileToolResult {
    			const shapeError = inputShapeError(input);
    			if (shapeError !== null) {
    				return { ok: false, code: "INVALID_INPUT", message: shapeError };
    			}
    			const call = input as {
    				scope: Scope;
    				bank: BankRow[];
    				ledger: LedgerRow[];
    			};
    			try {
    				validateScope(call.scope);
    			} catch (error) {
    				if (error instanceof BankReconciliationError) {
    					return { ok: false, code: error.code, message: error.message };
    				}
    				return {
    					ok: false,
    					code: "INVALID_SCOPE",
    					message: error instanceof Error ? error.message : String(error),
    				};
    			}
    			try {
    				const bankResult = normalizeBankRows(call.scope, call.bank);
    				const ledgerResult = normalizeLedgerRows(call.scope, call.ledger);
    				const rejections = [...bankResult.rejected, ...ledgerResult.rejected];
    				if (rejections.length > 0) {
    					return {
    						ok: false,
    						code: "NORMALIZATION_REJECTED",
    						message: `${rejections.length} row(s) rejected during normalization; reconcile is blocked until every row normalizes`,
    						rejections: rejections.map((rejection) => ({
    							sourceKey: rejection.sourceKey,
    							code: rejection.code,
    							detail: rejection.detail,
    						})),
    					};
    				}
    				const reconciliation = reconcile(
    					call.scope,
    					bankResult.movements,
    					ledgerResult.movements,
    				);
    				return toJsonSafe({
    					ok: true,
    					scope: reconciliation.scope,
    					differences: reconciliation.differences,
    					fullyMatched: reconciliation.fullyMatched,
    				}) as BankReconcileToolResult;
    			} catch (error) {
    				if (error instanceof BankReconciliationError) {
    					return { ok: false, code: error.code, message: error.message };
    				}
    				return {
    					ok: false,
    					code: "UNCLASSIFIED_DIFFERENCE",
    					message: error instanceof Error ? error.message : String(error),
    				};
    			}
    		},
    	};
    }
