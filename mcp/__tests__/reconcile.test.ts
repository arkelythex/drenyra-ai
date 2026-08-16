/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `bank.reconcile` MCP tool tests — server level (`handleMessage`, mirroring
 * `server.test.ts`) and stdio level (`runMcpStdio`, mirroring `stdio.test.ts`).
 * The tool is a thin read-only wrapper over the bank-reconciliation engine:
 * happy path, every difference classification, fail-closed scope and
 * normalization rejections, typed errors without stack leakage, determinism,
 * and the stdio round-trip.
 */

import { describe, expect, it } from "vitest";
import { getDeclaredCapabilities } from "../../cmd/declared-surface.js";
import { createDrenyraMcpServer } from "../../cmd/commands/mcp-serve.js";
import {
	McpServer,
	bankReconcileTool,
	capabilitiesTool,
	ledgerValidateTool,
	runMcpStdio,
	type DeclaredCapabilities,
	type LineReader,
	type LineWriter,
} from "../index.js";

/** Production shared declaration; also proves the tool reports the package version. */
const TEST_DECLARED: DeclaredCapabilities = getDeclaredCapabilities();

const SCOPE = { ruc: "20123456789", period: "202607" };

function makeServer(): McpServer {
	const server = new McpServer({
		name: "drenyra-ai",
		version: TEST_DECLARED.version,
	});
	server.registerTool(capabilitiesTool(TEST_DECLARED));
	server.registerTool(ledgerValidateTool());
	server.registerTool(bankReconcileTool());
	return server;
}

function bankRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		ruc: SCOPE.ruc,
		date: "2026-07-15",
		reference: "B-001",
		amount: "250.00",
		side: "deposit",
		sourceKey: "stmt-0001",
		...overrides,
	};
}

function ledgerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		ruc: SCOPE.ruc,
		date: "2026-07-15",
		reference: "L-001",
		amount: "250.00",
		side: "debit",
		sourceKey: "entry-0001",
		...overrides,
	};
}

async function callTool(
	server: McpServer,
	name: string,
	args: unknown,
): Promise<Record<string, unknown>> {
	const response = await server.handleMessage(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 100,
			method: "tools/call",
			params: { name, arguments: args },
		}),
	);
	expect(response, "server must respond").not.toBeNull();
	const parsed = JSON.parse(response!) as {
		result?: { content?: Array<{ text?: string }> };
		error?: { code?: number; message?: string };
	};
	expect(parsed.error, "JSON-RPC error response").toBeUndefined();
	const text = parsed.result?.content?.[0]?.text;
	expect(text, "content[0].text must carry the tool result").toBeDefined();
	return JSON.parse(text!) as Record<string, unknown>;
}

async function listToolNames(server: McpServer): Promise<string[]> {
	const response = await server.handleMessage(
		JSON.stringify({ jsonrpc: "2.0", id: 200, method: "tools/list" }),
	);
	const parsed = JSON.parse(response!) as {
		result: { tools: Array<{ name: string }> };
	};
	return parsed.result.tools.map((tool) => tool.name).sort();
}

/** Count of movements referenced by a difference, for completeness checks. */
function movementCount(difference: Record<string, unknown>): number {
	switch (difference.classification) {
		case "matched":
			return 2;
		case "bankOnly":
		case "ledgerOnly":
			return 1;
		case "conflict":
			return (
				(difference.bank as unknown[]).length +
				(difference.ledger as unknown[]).length
			);
		default:
			return 0;
	}
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

describe("bank.reconcile (server level)", () => {
	it("lists bank.reconcile alongside the existing surface", async () => {
		const server = makeServer();
		const names = await listToolNames(server);
		expect(names).toContain("bank.reconcile");
		expect(names).toContain("capabilities");
		expect(names).toContain("ledger.validate");
	});

	it("declares the input schema: required scope/bank/ledger, string amounts, side enums", async () => {
		const server = makeServer();
		const response = await server.handleMessage(
			JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		);
		const parsed = JSON.parse(response!) as {
			result: {
				tools: Array<{ name: string; inputSchema: Record<string, unknown> }>;
			};
		};
		const tool = parsed.result.tools.find((t) => t.name === "bank.reconcile");
		expect(tool).toBeDefined();
		const schema = tool!.inputSchema;
		expect(schema.type).toBe("object");
		expect(schema.required).toEqual(["scope", "bank", "ledger"]);
		expect(schema.additionalProperties).toBe(false);
		const properties = schema.properties as Record<string, unknown>;
		const scope = properties.scope as Record<string, unknown>;
		expect(scope.required).toEqual(["ruc", "period"]);
		expect(scope.additionalProperties).toBe(false);
		expect((scope.properties as Record<string, unknown>).ruc).toMatchObject({
			type: "string",
			minLength: 11,
			maxLength: 11,
		});
		expect((scope.properties as Record<string, unknown>).period).toMatchObject({
			type: "string",
			pattern: "^\\d{6}$",
		});
		const definitions = schema.definitions as Record<string, unknown>;
		const bankRowDef = definitions.bankRow as Record<string, unknown>;
		expect(bankRowDef.required).toEqual([
			"ruc",
			"date",
			"reference",
			"amount",
			"side",
			"sourceKey",
		]);
		expect(
			(bankRowDef.properties as Record<string, unknown>).amount,
		).toMatchObject({ type: "string" });
		expect((bankRowDef.properties as Record<string, unknown>).side).toEqual({
			enum: ["deposit", "withdrawal"],
		});
		const ledgerRowDef = definitions.ledgerRow as Record<string, unknown>;
		expect(
			(ledgerRowDef.properties as Record<string, unknown>).amount,
		).toMatchObject({ type: "string" });
		expect((ledgerRowDef.properties as Record<string, unknown>).side).toEqual({
			enum: ["debit", "credit"],
		});
	});

	it("returns fullyMatched true with one matched difference and amountCents as a string", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ reference: "B-001" })],
			ledger: [ledgerRow({ reference: "B-001" })],
		});
		expect(result.ok).toBe(true);
		expect(result.fullyMatched).toBe(true);
		expect(result.scope).toEqual(SCOPE);
		const differences = result.differences as Array<Record<string, unknown>>;
		expect(differences).toHaveLength(1);
		expect(differences[0]!.classification).toBe("matched");
		const bankMovement = differences[0]!.bank as Record<string, unknown>;
		const ledgerMovement = differences[0]!.ledger as Record<string, unknown>;
		expect(typeof bankMovement.amountCents).toBe("string");
		expect(bankMovement.amountCents).toBe("250");
		expect(ledgerMovement.amountCents).toBe("250");
	});

	it("classifies every movement across matched, bankOnly, ledgerOnly, and conflict", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [
				bankRow({
					reference: "B-MATCH",
					amount: "100",
					side: "deposit",
					sourceKey: "stmt-match",
				}),
				bankRow({
					reference: "B-ONLY",
					amount: "50",
					side: "withdrawal",
					sourceKey: "stmt-only",
				}),
				bankRow({
					reference: "B-CONFLICT",
					amount: "10",
					side: "deposit",
					sourceKey: "stmt-c1",
				}),
				bankRow({
					reference: "B-CONFLICT",
					amount: "20",
					side: "deposit",
					sourceKey: "stmt-c2",
				}),
			],
			ledger: [
				ledgerRow({
					reference: "B-MATCH",
					amount: "100",
					side: "debit",
					sourceKey: "entry-match",
				}),
				ledgerRow({
					reference: "L-ONLY",
					amount: "30",
					side: "credit",
					sourceKey: "entry-only",
				}),
				ledgerRow({
					reference: "B-CONFLICT",
					amount: "10",
					side: "debit",
					sourceKey: "entry-c1",
				}),
			],
		});
		expect(result.ok).toBe(true);
		expect(result.fullyMatched).toBe(false);
		const differences = result.differences as Array<Record<string, unknown>>;
		const classifications = differences.map((d) => d.classification).sort();
		expect(classifications).toEqual([
			"bankOnly",
			"conflict",
			"ledgerOnly",
			"matched",
		]);
		// Every movement (4 bank + 3 ledger) lands in exactly one classified difference.
		expect(differences.reduce((total, d) => total + movementCount(d), 0)).toBe(7);
		const conflict = differences.find((d) => d.classification === "conflict");
		expect(conflict!.reference).toBe("b-conflict");
		expect(
			(conflict!.bank as unknown[]).map(
				(m) => (m as Record<string, unknown>).sourceKey,
			),
		).toEqual(["stmt-c1", "stmt-c2"]);
		expect(
			(conflict!.ledger as unknown[]).map(
				(m) => (m as Record<string, unknown>).sourceKey,
			),
		).toEqual(["entry-c1"]);
	});

	it("rejects an amount as a JSON number with INVALID_INPUT and stays responsive", async () => {
		const server = makeServer();
		const bad = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ amount: 250 })],
			ledger: [ledgerRow()],
		});
		expect(bad.ok).toBe(false);
		expect(bad.code).toBe("INVALID_INPUT");
		expect(bad.message).toContain("bank[0].amount");
		const good = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow()],
			ledger: [ledgerRow()],
		});
		expect(good.ok).toBe(true);
		expect(good.fullyMatched).toBe(true);
	});

	it("rejects a missing ledger field with INVALID_INPUT naming the field", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("INVALID_INPUT");
		expect(result.message).toContain("ledger");
	});

	it("rejects an extra top-level property with INVALID_INPUT", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow()],
			ledger: [ledgerRow()],
			unexpected: true,
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("INVALID_INPUT");
		expect(result.message).toContain("extra");
	});

	it("rejects a non-object scope with INVALID_INPUT", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: "202607",
			bank: [bankRow()],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("INVALID_INPUT");
		expect(result.message).toContain("scope");
	});

	it("rejects an unknown side token with INVALID_INPUT", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ side: "transfer" })],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("INVALID_INPUT");
		expect(result.message).toContain("bank[0].side");
	});

	it("rejects an invalid RUC with INVALID_SCOPE and no reconciliation result", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: { ruc: "123", period: "202607" },
			bank: [bankRow()],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("INVALID_SCOPE");
		expect(result.message).toContain("RUC");
		expect(result).not.toHaveProperty("differences");
		expect(result).not.toHaveProperty("fullyMatched");
	});

	it("rejects a bad period with INVALID_SCOPE (non-YYYYMM, month 00, month 13)", async () => {
		const server = makeServer();
		for (const period of ["2026-07", "202600", "202613"]) {
			const result = await callTool(server, "bank.reconcile", {
				scope: { ruc: SCOPE.ruc, period },
				bank: [bankRow()],
				ledger: [ledgerRow()],
			});
			expect(result.ok).toBe(false);
			expect(result.code).toBe("INVALID_SCOPE");
			expect(result.message).toContain("period");
		}
	});

	it("rejects a cross-RUC row with CROSS_RUC_ACCESS naming the sourceKey", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ ruc: "99999999999" })],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("NORMALIZATION_REJECTED");
		const rejections = result.rejections as Array<Record<string, unknown>>;
		expect(rejections).toHaveLength(1);
		expect(rejections[0]!.code).toBe("CROSS_RUC_ACCESS");
		expect(rejections[0]!.sourceKey).toBe("stmt-0001");
		expect(result).not.toHaveProperty("differences");
	});

	it("rejects a negative amount with NEGATIVE_AMOUNT", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ amount: "-250.00" })],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("NORMALIZATION_REJECTED");
		const rejections = result.rejections as Array<Record<string, unknown>>;
		expect(rejections[0]!.code).toBe("NEGATIVE_AMOUNT");
		expect(rejections[0]!.sourceKey).toBe("stmt-0001");
	});

	it("rejects fractional cents with FRACTIONAL_CENTS", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ amount: "250.005" })],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("NORMALIZATION_REJECTED");
		const rejections = result.rejections as Array<Record<string, unknown>>;
		expect(rejections[0]!.code).toBe("FRACTIONAL_CENTS");
		expect(rejections[0]!.sourceKey).toBe("stmt-0001");
	});

	it("rejects a malformed amount with NORMALIZATION_REJECTED naming the sourceKey", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [bankRow({ amount: "abc" })],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("NORMALIZATION_REJECTED");
		const rejections = result.rejections as Array<Record<string, unknown>>;
		expect(rejections[0]!.code).toBe("NORMALIZATION_REJECTED");
		expect(rejections[0]!.sourceKey).toBe("stmt-0001");
		expect(result).not.toHaveProperty("differences");
	});

	it("blocks the reconcile delegation when any single row is rejected", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: SCOPE,
			bank: [
				bankRow({
					reference: "B-OK",
					amount: "100",
					side: "deposit",
					sourceKey: "stmt-ok",
				}),
				bankRow({
					reference: "B-BAD",
					amount: "abc",
					side: "deposit",
					sourceKey: "stmt-bad",
				}),
			],
			ledger: [
				ledgerRow({
					reference: "B-OK",
					amount: "100",
					side: "debit",
					sourceKey: "entry-ok",
				}),
			],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("NORMALIZATION_REJECTED");
		const rejections = result.rejections as Array<Record<string, unknown>>;
		expect(rejections).toHaveLength(1);
		expect(rejections[0]!.sourceKey).toBe("stmt-bad");
		expect(result).not.toHaveProperty("differences");
		expect(result).not.toHaveProperty("fullyMatched");
	});

	it("surfaces typed errors without stack frames or internal paths", async () => {
		const server = makeServer();
		const result = await callTool(server, "bank.reconcile", {
			scope: { ruc: "123", period: "202607" },
			bank: [bankRow()],
			ledger: [ledgerRow()],
		});
		expect(result.ok).toBe(false);
		expect(result.code).toBe("INVALID_SCOPE");
		const text = JSON.stringify(result);
		expect(text).not.toMatch(/ at .+:\d+:\d+/);
		expect(text).not.toContain("bank-reconciliation/");
		expect(text).not.toContain("node_modules");
	});

	it("is deterministic and side-effect-free for identical inputs", async () => {
		const server = makeServer();
		const args = { scope: SCOPE, bank: [bankRow()], ledger: [ledgerRow()] };
		const before = await listToolNames(server);
		const first = await callTool(server, "bank.reconcile", args);
		const second = await callTool(server, "bank.reconcile", args);
		expect(second).toEqual(first);
		expect(second.ok).toBe(true);
		expect(second.fullyMatched).toBe(true);
		expect(await listToolNames(server)).toEqual(before);
	});
});

describe("bank.reconcile (stdio level)", () => {
	it("lists bank.reconcile alongside the production surface over stdio", async () => {
		const server = createDrenyraMcpServer();
		const { readLine, writeLine, out } = feed([
			JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		]);
		await runMcpStdio(server, readLine, writeLine);
		expect(out).toHaveLength(1);
		const parsed = JSON.parse(out[0]!) as {
			result: { tools: Array<{ name: string }> };
		};
		const names = parsed.result.tools.map((tool) => tool.name);
		expect(names).toContain("bank.reconcile");
		expect(names).toContain("capabilities");
		expect(names).toContain("ledger.validate");
	});

	it("delivers a full bank.reconcile round-trip over the line protocol", async () => {
		const server = createDrenyraMcpServer();
		const { readLine, writeLine, out } = feed([
			JSON.stringify({
				jsonrpc: "2.0",
				id: 7,
				method: "tools/call",
				params: {
					name: "bank.reconcile",
					arguments: {
						scope: SCOPE,
						bank: [bankRow({ reference: "B-001" })],
						ledger: [ledgerRow({ reference: "B-001" })],
					},
				},
			}),
		]);
		const count = await runMcpStdio(server, readLine, writeLine);
		expect(count).toBe(1);
		expect(out).toHaveLength(1);
		const parsed = JSON.parse(out[0]!) as {
			jsonrpc: string;
			id: number;
			result: { content: Array<{ type: string; text: string }> };
		};
		expect(parsed.jsonrpc).toBe("2.0");
		expect(parsed.id).toBe(7);
		const content = JSON.parse(
			parsed.result.content[0]!.text,
		) as Record<string, unknown>;
		expect(parsed.result.content[0]!.type).toBe("text");
		expect(content.ok).toBe(true);
		expect(content.fullyMatched).toBe(true);
		const differences = content.differences as Array<Record<string, unknown>>;
		expect(differences).toHaveLength(1);
		expect(differences[0]!.classification).toBe("matched");
		const bankMovement = differences[0]!.bank as Record<string, unknown>;
		expect(typeof bankMovement.amountCents).toBe("string");
		expect(bankMovement.amountCents).toBe("250");
	});
});
