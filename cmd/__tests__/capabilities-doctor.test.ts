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
	managedHostPin,
	renderManagedMarker,
	renderManagedSkills,
	renderPinnedAiRuntime,
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
    
	it("names all four managed hosts (Codex, Claude Code, OpenCode, Drenyra Pi) without claiming Pi host-serving or program-lock-aware install", () => {
		const { code, stdout } = capture(capabilitiesCommand);
		expect(code).toBe(0);
		const parsed = JSON.parse(stdout) as { integrations: string[] };
		const hostIntegration = parsed.integrations.find((i) => i.includes("Codex"));
		expect(hostIntegration).toBeDefined();
		// the configurator renders managed host markers/skills/pins: no longer planned
		expect(hostIntegration).not.toContain("(planned)");
		expect(hostIntegration).toContain("managed");
		// slice B: all four recognized hosts are named, including Drenyra Pi
		expect(hostIntegration).toContain("Codex");
		expect(hostIntegration).toContain("Claude Code");
		expect(hostIntegration).toContain("OpenCode");
		expect(hostIntegration).toContain("Drenyra Pi");
		// still no Pi host-serving or program-lock-aware install claim
		expect(hostIntegration).not.toMatch(/host-serving/i);
		expect(hostIntegration).not.toMatch(/program-lock/i);
		// the MCP integration remains planned
		const mcp = parsed.integrations.find((i) => i.includes("MCP"));
		expect(mcp).toContain("(planned)");
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
    
    	const HOST_DIR: Record<string, string> = {
    		codex: ".codex",
    		"claude-code": ".claude",
    		opencode: ".config/opencode",
    		"drenyra-pi": ".drenyra",
    	};
    	type FixtureHostName = "codex" | "claude-code" | "opencode" | "drenyra-pi";
    
    	function writeHostAssets(
    		dir: string,
    		activatedAt: string,
    		hostName: FixtureHostName = "claude-code",
    	): void {
    		mkdirSync(join(dir, HOST_DIR[hostName]), { recursive: true });
    		writeFileSync(
    			join(dir, HOST_DIR[hostName], ".drenyra-managed"),
    			renderManagedMarker(activatedAt),
    		);
    		writeFileSync(
    			join(dir, HOST_DIR[hostName], ".drenyra-skills.json"),
    			renderManagedSkills(),
    		);
    		writeFileSync(
    			join(dir, HOST_DIR[hostName], ".drenyra-pinned-ai-runtime.json"),
    			renderPinnedAiRuntime(hostName),
    		);
    	}
    
    	/** A schema-2 (pin-capable) manifest fixture with per-host managed pins. */
    	function pinnedSchema(
    		dir: string,
    		version: string,
    		activatedAt: string,
    		hosts: Array<{ name: string; present: boolean }> = [
    			{ name: "claude-code", present: true },
    		],
    		opts: { pinsFor?: FixtureHostName[] } = {},
    	): Record<string, unknown> {
    		const manifest = currentSchema(dir, version, activatedAt, hosts);
    		(manifest.composition as Record<string, unknown>).schemaVersion = 2;
    		const pinsFor =
    			opts.pinsFor ??
    			hosts.filter((h) => h.present).map((h) => h.name as FixtureHostName);
    		const pinned: Record<string, unknown> = {};
    		for (const name of pinsFor) {
    			pinned[name] = managedHostPin(name);
    		}
    		(manifest.composition as { current: Record<string, unknown> }).current.pinnedComposition =
    			pinned;
    		return manifest;
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
    							: name === "opencode"
    								? ".config/opencode"
    								: ".drenyra";
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
    
    	type PinCheck = {
    		name: string;
    		ok: boolean;
    		detail: string;
    		applicability: string;
    		hosts: Array<{ host: string; state: string; detail: string }>;
    	};
    
    	it("reports a managed pin: applicable and healthy, per-host state managed, outer report healthy/readonly, exit 0", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z");
    			writeManifest(dir, pinnedSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(0);
    			const parsed = parseDoctor(stdout);
    			expect(parsed.status).toBe("healthy");
    			expect(parsed.readonly).toBe(true);
    			const pin = parsed.checks.find((c) => c.name === "pinned-ai-runtime") as PinCheck;
    			expect(pin.ok).toBe(true);
    			expect(pin.applicability).toBe("applicable");
    			expect(pin.hosts).toHaveLength(1);
    			expect(pin.hosts[0]).toMatchObject({ host: "claude-code", state: "managed" });
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("reports managed pin drift for unequal and unreadable bytes, leaves bytes unchanged, degraded, exit 1", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z");
    			writeManifest(dir, pinnedSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
    			const pinPath = join(dir, ".claude", ".drenyra-pinned-ai-runtime.json");
    			writeFileSync(pinPath, "tampered pin bytes");
    
    			const first = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(first.code).toBe(1);
    			const firstParsed = parseDoctor(first.stdout);
    			expect(firstParsed.status).toBe("degraded");
    			const pin = firstParsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(false);
    			expect(pin.applicability).toBe("applicable");
    			expect(pin.hosts[0]).toMatchObject({ host: "claude-code", state: "drift" });
    			expect(readFileSync(pinPath, "utf8")).toBe("tampered pin bytes");
    
    			// unreadable managed pin (path is a directory): still drift, preserved
    			rmSync(pinPath);
    			mkdirSync(pinPath);
    			const second = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(second.code).toBe(1);
    			const secondParsed = parseDoctor(second.stdout);
    			const pin2 = secondParsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin2.ok).toBe(false);
    			expect(pin2.hosts[0]).toMatchObject({ host: "claude-code", state: "drift" });
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("reports a foreign pin distinctly (user-authored, unmanaged, preserved, not adopted), bytes unchanged, exit 1", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			mkdirSync(join(dir, ".claude"), { recursive: true });
    			const pinPath = join(dir, ".claude", ".drenyra-pinned-ai-runtime.json");
    			writeFileSync(pinPath, "user-authored pin bytes");
    			// schema-2 manifest with NO managed entry for the present host
    			writeManifest(
    				dir,
    				pinnedSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z", undefined, {
    					pinsFor: [],
    				}),
    			);
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(1);
    			const parsed = parseDoctor(stdout);
    			expect(parsed.status).toBe("degraded");
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(false);
    			expect(pin.hosts[0]).toMatchObject({ host: "claude-code", state: "foreign" });
    			expect(pin.hosts[0].detail).toContain("user-authored");
    			expect(pin.hosts[0].detail).toContain("unmanaged");
    			expect(pin.hosts[0].detail).toContain("preserved");
    			expect(pin.hosts[0].detail).toContain("not adopted");
    			expect(readFileSync(pinPath, "utf8")).toBe("user-authored pin bytes");
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("reports an absent managed pin, creates nothing, exit 1", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			// marker/skills present but the recorded managed pin file is missing
    			mkdirSync(join(dir, ".claude"), { recursive: true });
    			writeFileSync(
    				join(dir, ".claude", ".drenyra-managed"),
    				renderManagedMarker("2026-03-02T00:00:00.000Z"),
    			);
    			writeFileSync(
    				join(dir, ".claude", ".drenyra-skills.json"),
    				renderManagedSkills(),
    			);
    			writeManifest(dir, pinnedSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
    			const pinPath = join(dir, ".claude", ".drenyra-pinned-ai-runtime.json");
    			expect(existsSync(pinPath)).toBe(false);
    
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(1);
    			const parsed = parseDoctor(stdout);
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(false);
    			expect(pin.hosts[0]).toMatchObject({ host: "claude-code", state: "absent" });
    			// doctor never creates the missing pin asset
    			expect(existsSync(pinPath)).toBe(false);
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("stays healthy and not-applicable for a pre-pin manifest and for no manifest, without writing anything", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			// pre-pin schema-1 manifest, host assets WITHOUT any pin file
    			mkdirSync(join(dir, ".claude"), { recursive: true });
    			writeFileSync(
    				join(dir, ".claude", ".drenyra-managed"),
    				renderManagedMarker("2026-03-02T00:00:00.000Z"),
    			);
    			writeFileSync(
    				join(dir, ".claude", ".drenyra-skills.json"),
    				renderManagedSkills(),
    			);
    			writeManifest(dir, currentSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z"));
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(0);
    			const parsed = parseDoctor(stdout);
    			expect(parsed.status).toBe("healthy");
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(true);
    			expect(pin.applicability).toBe("not-applicable");
    			expect(pin.hosts).toEqual([]);
    			expect(existsSync(join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"))).toBe(
    				false,
    			);
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("passes not-applicable healthy when no managed manifest exists", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(0);
    			const parsed = parseDoctor(stdout);
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(true);
    			expect(pin.applicability).toBe("not-applicable");
    			expect(pin.hosts).toEqual([]);
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("fails closed on an invalid pin record: managed-state fails, pin diagnostic unverifiable, full report emitted, exit 1", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			const m = pinnedSchema(dir, "1.4.0", "2026-03-02T00:00:00.000Z");
    			// a float pin version makes the schema-2 manifest invalid
    			(
    				m.composition as {
    					current: {
    						pinnedComposition: Record<
    							string,
    							{ record: { runtime: { version: unknown } } }
    						>;
    					};
    				}
    			).current.pinnedComposition["claude-code"].record.runtime.version = 1.5;
    			writeManifest(dir, m);
    
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(1);
    			const parsed = parseDoctor(stdout);
    			expect(parsed.status).toBe("degraded");
    			const managedState = parsed.checks.find((c) => c.name === "managed-state");
    			expect(managedState?.ok).toBe(false);
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(false);
    			expect(pin.applicability).toBe("unverifiable");
    			expect(pin.hosts).toEqual([]);
    			// the full report is still emitted
    			const names = parsed.checks.map((c) => c.name);
    			expect(names).toContain("managed-drift");
    			expect(names).toContain("package-pin");
    			expect(names).toContain("host-prerequisites");
    			expect(names).toContain("pinned-ai-runtime");
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("names every recorded-present host in the matrix and fails the aggregate on any non-managed state", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			// claude-code managed, codex drift (present), opencode present:false
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "claude-code");
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "codex");
    			writeFileSync(
    				join(dir, ".codex", ".drenyra-pinned-ai-runtime.json"),
    				"drifted codex pin",
    			);
    			writeManifest(
    				dir,
    				pinnedSchema(
    					dir,
    					"1.4.0",
    					"2026-03-02T00:00:00.000Z",
    					[
    						{ name: "claude-code", present: true },
    						{ name: "codex", present: true },
    						{ name: "opencode", present: false },
    					],
    				),
    			);
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(1);
    			const parsed = parseDoctor(stdout);
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(false);
    			const states = new Map(pin.hosts.map((h) => [h.host, h.state]));
    			// every recorded-present host is named; present:false is excluded
    			expect(states.get("claude-code")).toBe("managed");
    			expect(states.get("codex")).toBe("drift");
    			expect(states.has("opencode")).toBe(false);
    		} finally {
    			cleanup();
    		}
    	});
    
    	it("stays healthy for a fully managed multi-host matrix and ignores present:false hosts with a foreign pin file", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "claude-code");
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "codex");
    			// a present:false host has a pin file on disk: it must be excluded
    			mkdirSync(join(dir, ".config/opencode"), { recursive: true });
    			writeFileSync(
    				join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json"),
    				"unmanaged opencode pin",
    			);
    			writeManifest(
    				dir,
    				pinnedSchema(
    					dir,
    					"1.4.0",
    					"2026-03-02T00:00:00.000Z",
    					[
    						{ name: "claude-code", present: true },
    						{ name: "codex", present: true },
    						{ name: "opencode", present: false },
    					],
    				),
    			);
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(0);
    			const parsed = parseDoctor(stdout);
    			expect(parsed.status).toBe("healthy");
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(true);
    			expect(pin.hosts).toHaveLength(2);
    			expect(pin.hosts.every((h) => h.state === "managed")).toBe(true);
    			expect(pin.hosts.some((h) => h.host === "opencode")).toBe(false);
    		} finally {
    			cleanup();
    		}
    	});
        
    	it("names all four hosts in the four-host matrix: every recorded-present host (including drenyra-pi) managed, healthy exit 0 (SDD-020 slice B)", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			const hosts: FixtureHostName[] = [
    				"codex",
    				"claude-code",
    				"opencode",
    				"drenyra-pi",
    			];
    			for (const name of hosts) {
    				writeHostAssets(dir, "2026-03-02T00:00:00.000Z", name);
    			}
    			writeManifest(
    				dir,
    				pinnedSchema(
    					dir,
    					"1.4.0",
    					"2026-03-02T00:00:00.000Z",
    					hosts.map((name) => ({ name, present: true })),
    				),
    			);
    			const { code, stdout } = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(code).toBe(0);
    			const parsed = parseDoctor(stdout);
    			expect(parsed.status).toBe("healthy");
    			const pin = parsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(true);
    			expect(pin.applicability).toBe("applicable");
    			expect(pin.hosts).toHaveLength(4);
    			expect(pin.hosts.every((h) => h.state === "managed")).toBe(true);
    			for (const name of hosts) {
    				expect(pin.hosts.some((h) => h.host === name)).toBe(true);
    			}
    		} finally {
    			cleanup();
    		}
    	});
        
    	it("reports drenyra-pi drift and absent states distinctly in the four-host matrix (SDD-020 slice B)", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "claude-code");
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "codex");
    			writeHostAssets(dir, "2026-03-02T00:00:00.000Z", "opencode");
    			// drenyra-pi present but its managed pin drifts (user-authored bytes)
    			mkdirSync(join(dir, ".drenyra"), { recursive: true });
    			writeFileSync(
    				join(dir, ".drenyra", ".drenyra-pinned-ai-runtime.json"),
    				"drifted pi pin",
    			);
    			writeManifest(
    				dir,
    				pinnedSchema(
    					dir,
    					"1.4.0",
    					"2026-03-02T00:00:00.000Z",
    					[
    						{ name: "codex", present: true },
    						{ name: "claude-code", present: true },
    						{ name: "opencode", present: true },
    						{ name: "drenyra-pi", present: true },
    					],
    				),
    			);
    			const first = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(first.code).toBe(1);
    			const firstParsed = parseDoctor(first.stdout);
    			const pin = firstParsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin.ok).toBe(false);
    			const states = new Map(pin.hosts.map((h) => [h.host, h.state]));
    			expect(states.get("codex")).toBe("managed");
    			expect(states.get("claude-code")).toBe("managed");
    			expect(states.get("opencode")).toBe("managed");
    			expect(states.get("drenyra-pi")).toBe("drift");
    			expect(
    				readFileSync(
    					join(dir, ".drenyra", ".drenyra-pinned-ai-runtime.json"),
    					"utf8",
    				),
    			).toBe("drifted pi pin");
        
    			// remove the Pi pin entirely: absent state, doctor creates nothing
    			rmSync(join(dir, ".drenyra", ".drenyra-pinned-ai-runtime.json"));
    			const second = capture(() =>
    				doctorCommand(["--home", dir], { packagedVersion: "1.4.0" }),
    			);
    			expect(second.code).toBe(1);
    			const secondParsed = parseDoctor(second.stdout);
    			const pin2 = secondParsed.checks.find(
    				(c) => c.name === "pinned-ai-runtime",
    			) as PinCheck;
    			expect(pin2.ok).toBe(false);
    			const states2 = new Map(pin2.hosts.map((h) => [h.host, h.state]));
    			expect(states2.get("drenyra-pi")).toBe("absent");
    			expect(
    				existsSync(join(dir, ".drenyra", ".drenyra-pinned-ai-runtime.json")),
    			).toBe(false);
    		} finally {
    			cleanup();
    		}
    	});
    });
