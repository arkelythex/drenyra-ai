import { describe, expect, it } from "vitest";
import { McpServer, capabilitiesTool, ledgerValidateTool } from "../index.js";

function makeServer(): McpServer {
	const server = new McpServer({ name: "drenyra-ai", version: "0.2.0" });
	server.registerTool(capabilitiesTool());
	server.registerTool(ledgerValidateTool());
	return server;
}

describe("McpServer", () => {
	it("handles the initialize handshake", async () => {
		const server = makeServer();
		const response = await server.handleMessage(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {},
			}),
		);
		const parsed = JSON.parse(response!) as {
			result: { protocolVersion: string; serverInfo: { name: string } };
		};
		expect(parsed.result.protocolVersion).toBeTruthy();
		expect(parsed.result.serverInfo.name).toBe("drenyra-ai");
	});

	it("lists registered tools", async () => {
		const server = makeServer();
		const response = await server.handleMessage(
			JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
		);
		const parsed = JSON.parse(response!) as {
			result: { tools: Array<{ name: string }> };
		};
		const names = parsed.result.tools.map((tool) => tool.name);
		expect(names).toContain("capabilities");
		expect(names).toContain("ledger.validate");
	});

	it("calls the capabilities tool", async () => {
		const server = makeServer();
		const response = await server.handleMessage(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "capabilities", arguments: {} },
			}),
		);
		const parsed = JSON.parse(response!) as {
			result: { content: Array<{ text: string }> };
		};
		const content = JSON.parse(parsed.result.content[0]!.text) as {
			contracts: unknown[];
			jurisdictions: string[];
		};
		expect(content.contracts).toHaveLength(6);
		expect(content.jurisdictions).toEqual(["PE"]);
	});

	it("rejects an unknown tool with METHOD_NOT_FOUND", async () => {
		const server = makeServer();
		const response = await server.handleMessage(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 4,
				method: "tools/call",
				params: { name: "nope" },
			}),
		);
		const parsed = JSON.parse(response!) as { error: { code: number } };
		expect(parsed.error.code).toBe(-32601);
	});

	it("returns null for notifications and an error for parse failures", async () => {
		const server = makeServer();
		expect(
			await server.handleMessage(
				JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
			),
		).toBeNull();
		const bad = await server.handleMessage("{not json");
		const parsed = JSON.parse(bad!) as { error: { code: number } };
		expect(parsed.error.code).toBe(-32700);
	});

	it("surfaces tool handler errors as INTERNAL_ERROR", async () => {
		const server = makeServer();
		const response = await server.handleMessage(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 5,
				method: "tools/call",
				params: {
					name: "ledger.validate",
					arguments: { ledger: "not-an-array" },
				},
			}),
		);
		const parsed = JSON.parse(response!) as {
			error: { code: number; message: string };
		};
		expect(parsed.error.code).toBe(-32603);
		expect(parsed.error.message).toContain("ledger must be an array");
	});
});
