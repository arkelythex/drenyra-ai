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

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import {
	hashManagedAsset,
	renderManagedMarker,
	renderManagedSkills,
} from "../../configurator/managed-config.js";

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

describe("doctor run: managed configuration diagnostics (SDD-020)", () => {
	function tempHome(): { dir: string; cleanup: () => void } {
		const dir = mkdtempSync(join(tmpdir(), "drenyra-doctor-config-"));
		return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
	}

	function currentSchema(
		dir: string,
		version: string,
		activatedAt: string,
		hosts: Array<{ name: string; present: boolean }> = [
			{ name: "claude-code", present: true },
		],
	): Record<string, unknown> {
		return {
			manager: "drenyra-ai",
			version,
			installedAt: "2026-03-01T00:00:00.000Z",
			hosts: hosts.map(({ name, present }) => {
				const dirFor =
					name === "codex"
						? ".codex"
						: name === "claude-code"
							? ".claude"
							: ".config/opencode";
				return { name, configDir: join(dir, dirFor), present };
			}),
			assets: ["skills"],
			composition: {
				schemaVersion: 1,
				current: {
					packageVersion: version,
					sequence: 1,
					activatedAt,
					managedAssets: {
						marker: hashManagedAsset(renderManagedMarker(activatedAt)),
						skills: hashManagedAsset(renderManagedSkills()),
					},
				},
				previous: null,
			},
		};
	}

	function writeManifest(dir: string, manifest: Record<string, unknown>): void {
		mkdirSync(join(dir, ".drenyra"), { recursive: true });
		writeFileSync(
			join(dir, ".drenyra", "managed.json"),
			JSON.stringify(manifest, null, 2),
		);
	}

	function writeHostAssets(dir: string, activatedAt: string): void {
		mkdirSync(join(dir, ".claude"), { recursive: true });
		writeFileSync(
			join(dir, ".claude", ".drenyra-managed"),
			renderManagedMarker(activatedAt),
		);
		writeFileSync(join(dir, ".claude", ".drenyra-skills.json"), renderManagedSkills());
	}

	function parseDoctor(stdout: string): {
		status: string;
		readonly: boolean;
		checks: Array<{ name: string; ok: boolean; detail?: string }>;
	} {
		return JSON.parse(stdout) as {
			status: string;
			readonly: boolean;
			checks: Array<{ name: string; ok: boolean; detail?: string }>;
		};
	}

	it("reports managed marker drift naming host:marker, stays read-only, leaves bytes unchanged, exits 1", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "2026-03-02T00:00:00.000Z");
			writeManifest(dir, currentSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
			writeFileSync(join(dir, ".claude", ".drenyra-managed"), "tampered marker");

			const { code, stdout } = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(code).toBe(1);
			const parsed = parseDoctor(stdout);
			expect(parsed.status).toBe("degraded");
			expect(parsed.readonly).toBe(true);
			const drift = parsed.checks.find((c) => c.name === "managed-drift");
			expect(drift?.ok).toBe(false);
			expect(drift?.detail).toContain("claude-code:marker");
			expect(readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8")).toBe(
				"tampered marker",
			);
		} finally {
			cleanup();
		}
	});

	it("reports managed skills-asset drift naming host:skills", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "2026-03-02T00:00:00.000Z");
			writeManifest(dir, currentSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
			writeFileSync(join(dir, ".claude", ".drenyra-skills.json"), "tampered skills");

			const { code, stdout } = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(code).toBe(1);
			const parsed = parseDoctor(stdout);
			expect(parsed.readonly).toBe(true);
			const drift = parsed.checks.find((c) => c.name === "managed-drift");
			expect(drift?.ok).toBe(false);
			expect(drift?.detail).toContain("claude-code:skills");
		} finally {
			cleanup();
		}
	});

	it("reports a package-pin mismatch stating both versions and exits 1", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "2026-03-01T00:00:00.000Z");
			writeManifest(dir, currentSchema(dir, "1.2.3", "2026-03-01T00:00:00.000Z"));

			const { code, stdout } = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(code).toBe(1);
			const parsed = parseDoctor(stdout);
			const pin = parsed.checks.find((c) => c.name === "package-pin");
			expect(pin?.ok).toBe(false);
			expect(pin?.detail).toContain("1.2.3");
			expect(pin?.detail).toContain("1.4.0");
		} finally {
			cleanup();
		}
	});

	it("reports missing host prerequisites naming the exact missing item and creates nothing", () => {
		const { dir, cleanup } = tempHome();
		try {
			// config dir entirely absent
			writeManifest(dir, currentSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
			const first = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(first.code).toBe(1);
			const firstParsed = parseDoctor(first.stdout);
			const prereq = firstParsed.checks.find((c) => c.name === "host-prerequisites");
			expect(prereq?.ok).toBe(false);
			expect(prereq?.detail).toContain("claude-code:config-dir");
			expect(existsSync(join(dir, ".claude"))).toBe(false);

			// config dir present but the managed marker removed
			mkdirSync(join(dir, ".claude"), { recursive: true });
			writeFileSync(join(dir, ".claude", ".drenyra-skills.json"), renderManagedSkills());
			const second = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(second.code).toBe(1);
			const secondParsed = parseDoctor(second.stdout);
			const prereq2 = secondParsed.checks.find((c) => c.name === "host-prerequisites");
			expect(prereq2?.ok).toBe(false);
			expect(prereq2?.detail).toContain("claude-code:marker");
			// doctor never creates the missing asset
			expect(existsSync(join(dir, ".claude", ".drenyra-managed"))).toBe(false);
		} finally {
			cleanup();
		}
	});

	it("does not turn recorded present:false entries into missing-prerequisite failures", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "2026-03-02T00:00:00.000Z");
			writeManifest(
				dir,
				currentSchema(
					dir,
					"1.4.0",
					"2026-03-02T00:00:00.000Z",
					[
						{ name: "claude-code", present: true },
						{ name: "codex", present: false },
					],
				),
			);
			// no .codex directory exists on disk
			const { code, stdout } = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(code).toBe(0);
			const parsed = parseDoctor(stdout);
			expect(parsed.status).toBe("healthy");
			expect(parsed.readonly).toBe(true);
			expect(parsed.checks.every((c) => c.ok)).toBe(true);
		} finally {
			cleanup();
		}
	});

	it("fails managed-state closed on a malformed existing manifest while still emitting the full report", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".drenyra"), { recursive: true });
			writeFileSync(join(dir, ".drenyra", "managed.json"), "{ not json");

			const { code, stdout } = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
			);
			expect(code).toBe(1);
			const parsed = parseDoctor(stdout);
			expect(parsed.status).toBe("degraded");
			expect(parsed.readonly).toBe(true);
			const names = parsed.checks.map((c) => c.name);
			expect(names).toContain("managed-state");
			expect(names).toContain("managed-drift");
			expect(names).toContain("package-pin");
			expect(names).toContain("host-prerequisites");
			const managedState = parsed.checks.find((c) => c.name === "managed-state");
			expect(managedState?.ok).toBe(false);
			// the pre-existing package checks are still emitted in order
			expect(names.slice(0, 5)).toEqual([
				"node-engine",
				"version",
				"contracts",
				"cli",
				"mission-store",
			]);
		} finally {
			cleanup();
		}
	});
});
