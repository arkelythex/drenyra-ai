/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai mcp serve`
 *
 * Runs the MCP server over stdio (Design 03 "MCP server"): JSON-RPC 2.0
 * requests on stdin, responses on stdout, one message per line. Exposes the
 * read-only/verification tools from the frozen core (capabilities,
 * ledger.validate, bank.reconcile).
 */

import { createInterface } from "node:readline";
import {
	McpServer,
	bankReconcileTool,
	capabilitiesTool,
	ledgerValidateTool,
} from "../../mcp/index.js";
import { nodeStdioLines, runMcpStdio } from "../../mcp/index.js";
import { getDeclaredCapabilities } from "../declared-surface.js";

/**
 * Side-effect-free production MCP server factory: sources the shared
 * declaration once for handshake metadata and the capabilities tool, so
 * tests can inspect the production handshake without opening stdio.
 */
export function createDrenyraMcpServer(): McpServer {
	const declared = getDeclaredCapabilities();
	const server = new McpServer({
		name: "drenyra-ai",
		version: declared.version,
	});
	server.registerTool(capabilitiesTool(declared));
	server.registerTool(ledgerValidateTool());
	server.registerTool(bankReconcileTool());
	return server;
}

export function mcpServeCommand(): Promise<number> {
	const server = createDrenyraMcpServer();
	const { readLine, writeLine, close } = nodeStdioLines(
		{ createInterface },
		{ stdin: process.stdin, stdout: process.stdout },
	);
	return runMcpStdio(server, readLine, writeLine).then(() => {
		close();
		return 0;
	});
}
