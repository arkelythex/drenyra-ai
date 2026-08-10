import { describe, expect, it } from "vitest";
import {
	McpServer,
	runMcpStdio,
	capabilitiesTool,
	type LineReader,
	type LineWriter,
} from "../index.js";

function makeServer(): McpServer {
	const server = new McpServer({ name: "drenyra-ai", version: "0.2.0" });
	server.registerTool(capabilitiesTool());
	return server;
}

function feed(lines: string[]): {
	readLine: LineReader;
	writeLine: LineWriter;
	out: string[];
} {
	const queue = [...lines];
	const out: string[] = [];
	return {
		readLine: async () => (queue.length > 0 ? queue.shift()! : null),
		writeLine: (line) => out.push(line),
		out,
	};
}

describe("runMcpStdio", () => {
	it("answers requests and skips notifications until end-of-input", async () => {
		const server = makeServer();
		const { readLine, writeLine, out } = feed([
			JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
			JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
			JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }),
		]);
		const count = await runMcpStdio(server, readLine, writeLine);
		expect(count).toBe(3);
		expect(out).toHaveLength(2); // notifications produce no response
		expect(JSON.parse(out[0]!).id).toBe(1);
		expect(JSON.parse(out[1]!).id).toBe(2);
	});

	it("emits one response per line (protocol shape)", async () => {
		const server = makeServer();
		const { readLine, writeLine, out } = feed([
			JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "capabilities", arguments: {} },
			}),
		]);
		await runMcpStdio(server, readLine, writeLine);
		expect(out).toHaveLength(1);
		expect(out[0]!.endsWith("\n")).toBe(false);
	});

	it("returns 0 on immediate end-of-input", async () => {
		const server = makeServer();
		const { readLine, writeLine } = feed([]);
		expect(await runMcpStdio(server, readLine, writeLine)).toBe(0);
	});

	it("respects the maxMessages cap", async () => {
		const server = makeServer();
		const { readLine, writeLine } = feed([
			JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
			JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }),
			JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" }),
		]);
		expect(
			await runMcpStdio(server, readLine, writeLine, { maxMessages: 2 }),
		).toBe(2);
	});
});
