/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MCP server — JSON-RPC 2.0 over stdio (Design 03 "MCP server").
 *
 * Exposes core tools under the uniform MCP protocol for external hosts
 * (Codex, Claude Code, OpenCode). The server is transport-agnostic:
 * `handleMessage` processes one JSON-RPC line and returns the response line
 * (or null for notifications); a stdio binding reads stdin and writes stdout.
 */

import {
	RpcErrorCode,
	type JsonRpcNotification,
	type JsonRpcRequest,
	type JsonRpcResponse,
	type McpTool,
} from "./protocol.js";

/** MCP handshake version (2025-03-26 draft, standard). */
export const MCP_PROTOCOL_VERSION = "2025-03-26";

export interface McpServerInfo {
	name: string;
	version: string;
}

/** In-process MCP server. */
export class McpServer {
	readonly #tools = new Map<string, McpTool>();
	readonly info: McpServerInfo;

	constructor(info: McpServerInfo) {
		this.info = info;
	}

	registerTool(tool: McpTool): void {
		this.#tools.set(tool.name, tool);
	}

	listTools(): readonly McpTool[] {
		return [...this.#tools.values()];
	}

	/**
	 * Process one JSON-RPC message (a request or notification) and return the
	 * serialized response, or null when no response is expected (notifications,
	 * invalid JSON on a notification channel).
	 */
	async handleMessage(raw: string): Promise<string | null> {
		let message: unknown;
		try {
			message = JSON.parse(raw);
		} catch {
			return this.#serialize({
				jsonrpc: "2.0",
				id: null,
				error: { code: RpcErrorCode.PARSE_ERROR, message: "parse error" },
			});
		}
		if (!isRequest(message) && !isNotification(message)) {
			return this.#serialize({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: RpcErrorCode.INVALID_REQUEST,
					message: "invalid request",
				},
			});
		}
		if (isNotification(message)) {
			return null;
		}
		return this.#serialize(await this.#handleRequest(message));
	}

	async #handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
		switch (request.method) {
			case "initialize":
				return {
					jsonrpc: "2.0",
					id: request.id,
					result: {
						protocolVersion: MCP_PROTOCOL_VERSION,
						capabilities: { tools: {} },
						serverInfo: this.info,
					},
				};
			case "ping":
				return { jsonrpc: "2.0", id: request.id, result: {} };
			case "tools/list":
				return {
					jsonrpc: "2.0",
					id: request.id,
					result: {
						tools: this.listTools().map(
							({ name, description, inputSchema }) => ({
								name,
								description,
								inputSchema,
							}),
						),
					},
				};
			case "tools/call":
				return this.#callTool(request);
			default:
				return this.#error(
					request.id,
					RpcErrorCode.METHOD_NOT_FOUND,
					`method not found: ${request.method}`,
				);
		}
	}

	async #callTool(request: JsonRpcRequest): Promise<JsonRpcResponse> {
		const params = (request.params ?? {}) as {
			name?: unknown;
			arguments?: unknown;
		};
		if (typeof params.name !== "string") {
			return this.#error(
				request.id,
				RpcErrorCode.INVALID_PARAMS,
				"missing tool name",
			);
		}
		const tool = this.#tools.get(params.name);
		if (tool === undefined) {
			return this.#error(
				request.id,
				RpcErrorCode.METHOD_NOT_FOUND,
				`unknown tool: ${params.name}`,
			);
		}
		try {
			const result = await tool.handler(params.arguments);
			return {
				jsonrpc: "2.0",
				id: request.id,
				result: {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				},
			};
		} catch (error) {
			return this.#error(
				request.id,
				RpcErrorCode.INTERNAL_ERROR,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	#error(id: string | number, code: number, message: string): JsonRpcResponse {
		return { jsonrpc: "2.0", id, error: { code, message } };
	}

	#serialize(response: JsonRpcResponse): string {
		return JSON.stringify(response);
	}
}

function isRequest(value: unknown): value is JsonRpcRequest {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return (
		record.jsonrpc === "2.0" &&
		typeof record.method === "string" &&
		"id" in record &&
		(Number.isInteger(record.id) || typeof record.id === "string")
	);
}

function isNotification(value: unknown): value is JsonRpcNotification {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return (
		record.jsonrpc === "2.0" &&
		typeof record.method === "string" &&
		!("id" in record)
	);
}
