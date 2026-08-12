/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * CLI `capabilities` and `doctor` command tests — read-only surfaces.
 *
 * Declared-surface regressions: CLI version tracks package.json.version, CLI and
 * MCP agree on the shared common declaration (drift guard), and doctor resolves
 * frozen contracts from the installed package root regardless of cwd.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getPackageMetadata } from "../adapters/package-metadata.js";
import { capabilitiesCommand } from "../commands/capabilities.js";
import { createDrenyraMcpServer } from "../commands/mcp-serve.js";
import { doctorCommand } from "../commands/doctor.js";
import { getDeclaredCapabilities } from "../declared-surface.js";
import {
	capabilitiesTool,
	type DeclaredCapabilities,
} from "../../mcp/index.js";

function capture(fn: () => number): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const out: string[] = [];
	const err: string[] = [];
	const log = vi
		.spyOn(console, "log")
		.mockImplementation((...args: unknown[]) => {
			out.push(args.map(String).join(" "));
		});
	const error = vi
		.spyOn(console, "error")
		.mockImplementation((...args: unknown[]) => {
			err.push(args.map(String).join(" "));
		});
	let code = -1;
	try {
		code = fn();
	} finally {
		log.mockRestore();
		error.mockRestore();
	}
	return { code, stdout: out.join("\n"), stderr: err.join("\n") };
}

describe("capabilities show", () => {
	it("declares the six frozen contracts, PE jurisdiction, and base skills", () => {
		const { code, stdout } = capture(capabilitiesCommand);
		expect(code).toBe(0);
		const parsed = JSON.parse(stdout) as {
			contracts: Array<{ name: string; status: string }>;
			jurisdictions: string[];
			skills: Array<{ id: string; version: string; jurisdiction: string }>;
			version: string;
		};
		expect(parsed.contracts).toHaveLength(6);
		expect(parsed.contracts.every((c) => c.status === "FROZEN")).toBe(true);
		expect(parsed.jurisdictions).toEqual(["PE"]);
		expect(parsed.skills.length).toBeGreaterThanOrEqual(3);
		expect(parsed.skills.every((s) => s.jurisdiction === "PE")).toBe(true);
		expect(parsed.version).toBe(getPackageMetadata().version);
	});

	it("skills carry versions and no checksums leak in the declared surface", () => {
		const { stdout } = capture(capabilitiesCommand);
		const parsed = JSON.parse(stdout) as {
			skills: Array<{ id: string; version: string; checksum?: string }>;
		};
		expect(parsed.skills.every((s) => /^\d+\.\d+\.\d+$/.test(s.version))).toBe(
			true,
		);
		expect(parsed.skills.some((s) => s.checksum !== undefined)).toBe(false);
	});

	it("CLI and MCP capabilities agree on the shared common fields (drift guard)", () => {
		const { stdout } = capture(capabilitiesCommand);
		const cli = JSON.parse(stdout) as {
			version: string;
			contracts: Array<{ name: string; version: string; status: string }>;
			jurisdictions: string[];
			adapters: string[];
			skills: unknown[];
			integrations: unknown[];
		};
		const mcp = capabilitiesTool(getDeclaredCapabilities()).handler(
			{},
		) as DeclaredCapabilities;
		// Common declared facts MUST agree exactly; skills/integrations are
		// intentionally CLI-only and must NOT be required in the MCP payload.
		expect(cli.version).toBe(mcp.version);
		expect(cli.contracts).toEqual(mcp.contracts);
		expect(cli.jurisdictions).toEqual(mcp.jurisdictions);
		expect(cli.adapters).toEqual(mcp.adapters);
		expect(cli.skills.length).toBeGreaterThanOrEqual(3);
		expect(cli.integrations.length).toBeGreaterThan(0);
		expect("skills" in mcp).toBe(false);
		expect("integrations" in mcp).toBe(false);
	});
});

describe("MCP server metadata", () => {
	it("production server handshake reports the package-derived version", async () => {
		const server = createDrenyraMcpServer();
		const response = await server.handleMessage(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {},
			}),
		);
		const parsed = JSON.parse(response!) as {
			result: { serverInfo: { name: string; version: string } };
		};
		expect(parsed.result.serverInfo.name).toBe("drenyra-ai");
		expect(parsed.result.serverInfo.version).toBe(getPackageMetadata().version);
	});
});

describe("doctor run", () => {
	it("reports healthy on a clean checkout with all six contracts present", () => {
		const { code, stdout } = capture(doctorCommand);
		expect(code).toBe(0);
		const parsed = JSON.parse(stdout) as {
			status: string;
			readonly: boolean;
			checks: Array<{ name: string; ok: boolean; detail?: string }>;
		};
		expect(parsed.status).toBe("healthy");
		expect(parsed.readonly).toBe(true);
		expect(parsed.checks.every((c) => c.ok)).toBe(true);
		const contracts = parsed.checks.find((c) => c.name === "contracts");
		expect(contracts?.ok).toBe(true);
		expect(contracts?.detail).toBe("all six frozen contracts present");
	});

	it("finds packaged contracts from a non-root working directory", () => {
		const originalCwd = process.cwd();
		const nonRoot = mkdtempSync(join(tmpdir(), "drenyra-ai-doctor-"));
		process.chdir(nonRoot);
		try {
			const { code, stdout } = capture(doctorCommand);
			expect(code).toBe(0);
			const parsed = JSON.parse(stdout) as {
				status: string;
				checks: Array<{ name: string; ok: boolean; detail?: string }>;
			};
			expect(parsed.status).toBe("healthy");
			const contracts = parsed.checks.find((c) => c.name === "contracts");
			expect(contracts?.ok).toBe(true);
			expect(contracts?.detail).toBe("all six frozen contracts present");
		} finally {
			process.chdir(originalCwd);
			rmSync(nonRoot, { recursive: true, force: true });
		}
	});
});
