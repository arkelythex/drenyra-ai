/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MCP protocol types — JSON-RPC 2.0 subset used by the Drenyra MCP server
 * (Design 03 "MCP server"). Transport-agnostic; the server binds it to stdio.
 */

/** A JSON-RPC 2.0 request (has an id; expects a response). */
export interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: string | number;
	method: string;
	params?: unknown;
}

/** A JSON-RPC 2.0 notification (no id; no response). */
export interface JsonRpcNotification {
	jsonrpc: "2.0";
	method: string;
	params?: unknown;
}

/** A JSON-RPC 2.0 success response. */
export interface JsonRpcSuccess {
	jsonrpc: "2.0";
	id: string | number | null;
	result: unknown;
}

/** A JSON-RPC 2.0 error response. */
export interface JsonRpcError {
	jsonrpc: "2.0";
	id: string | number | null;
	error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** Standard JSON-RPC error codes. */
export const RpcErrorCode = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
} as const;

/** A tool exposed by the MCP server. */
export interface McpTool {
	name: string;
	description: string;
	/** JSON Schema (draft-07 style) for the tool input. */
	inputSchema: Record<string, unknown>;
	/** Execute the tool; returns a JSON-serializable result. */
	handler(input: unknown): Promise<unknown> | unknown;
}
