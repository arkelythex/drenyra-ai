/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MCP stdio binding — wires the JSON-RPC server to a line-oriented transport
 * (Design 03 "MCP server"). Each inbound line is one JSON-RPC message; each
 * response is emitted on its own line. Testable: the loop takes injectable
 * read/write functions and runs until the transport signals end-of-input.
 */

import type { McpServer } from "./server.js";

/** Line-oriented input: resolves the next raw line, or null at end-of-input. */
export type LineReader = () => Promise<string | null>;

/** Line-oriented output: writes one raw line. */
export type LineWriter = (line: string) => void;

/** Options for the stdio loop. */
export interface StdioOptions {
	/** Max messages processed before the loop stops (safety cap; 0 = unlimited). */
	maxMessages?: number;
}

/**
 * Run the MCP server over a line-oriented transport until end-of-input.
 * Returns the number of responses emitted. Notifications and parse errors
 * follow the server's handleMessage semantics.
 */
export async function runMcpStdio(
	server: McpServer,
	readLine: LineReader,
	writeLine: LineWriter,
	options: StdioOptions = {},
): Promise<number> {
	const max = options.maxMessages ?? 0;
	let count = 0;
	for (;;) {
		if (max > 0 && count >= max) break;
		const raw = await readLine();
		if (raw === null) break;
		count += 1;
		const response = await server.handleMessage(raw);
		if (response !== null) {
			writeLine(response);
		}
	}
	return count;
}

/** Adapt Node's readline over stdin/stdout to the line-oriented contract. */
export function nodeStdioLines(
	readline: { createInterface: typeof import("node:readline").createInterface },
	stream: { stdin: NodeJS.ReadableStream; stdout: NodeJS.WritableStream },
): { readLine: LineReader; writeLine: LineWriter; close: () => void } {
	const rl = readline.createInterface({
		input: stream.stdin,
		crlfDelay: Infinity,
	});
	const pending: string[] = [];
	let waiting: ((value: string | null) => void) | undefined;
	let done = false;

	rl.on("line", (line) => {
		if (waiting !== undefined) {
			const resolve = waiting;
			waiting = undefined;
			resolve(line);
		} else {
			pending.push(line);
		}
	});
	rl.on("close", () => {
		done = true;
		if (waiting !== undefined) {
			const resolve = waiting;
			waiting = undefined;
			resolve(null);
		}
	});

	const readLine: LineReader = () => {
		if (pending.length > 0) return Promise.resolve(pending.shift()!);
		if (done) return Promise.resolve(null);
		return new Promise<string | null>((resolve) => {
			waiting = resolve;
		});
	};
	const writeLine: LineWriter = (line) => {
		stream.stdout.write(`${line}\n`);
	};
	const close = () => rl.close();
	return { readLine, writeLine, close };
}
