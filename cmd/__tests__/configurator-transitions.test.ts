/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * SDD-020 configurator transition tests (R6) — isolated `--home` directories and
 * injected package versions only; no network, no real host binaries.
 *
 * Covers: clean upgrade, upgrade idempotency, rollback restore + idempotency,
 * rollback fail-closed, fail-closed state paths (missing/malformed/wrong-manager/
 * invalid-hash/redirected-host-path), legacy hydration + same-version no-rewrite,
 * foreign preservation, atomic fail-closed commit, not-packaged rejection, and
 * boundary compliance (no host binary, no authorization decision, allowlisted
 * paths only, frozen contracts and program-root docs byte-identical).
 */

import { describe, expect, it, vi } from "vitest";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { upgradeCommand } from "../commands/upgrade.js";
import { rollbackCommand } from "../commands/rollback.js";
import { installIntegrations } from "../commands/install.js";
import { syncManaged } from "../commands/sync.js";
import { doctorCommand } from "../commands/doctor.js";
import {
	hashManagedAsset,
	managedHostPin,
	renderManagedMarker,
	renderManagedSkills,
	renderPinnedAiRuntime,
	type InstallManifest,
} from "../../configurator/managed-config.js";

const A = "1.2.3";
const B = "1.4.0";
const INSTALLED_AT = "2026-03-01T00:00:00.000Z";
const ACTIVATED_B = "2026-03-02T00:00:00.000Z";

const HOST_DIR: Record<string, string> = {
	codex: ".codex",
	"claude-code": ".claude",
	opencode: ".config/opencode",
	"drenyra-pi": ".drenyra",
};

/** Creates an isolated home directory for one test. */
function tempHome(): { dir: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-configurator-"));
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Captures stdout/stderr around a synchronous command handler. */
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

/** Byte-level snapshot of every file under a root directory (sorted, recursive). */
function snapshotFiles(root: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else out[p] = readFileSync(p, "utf8");
		}
	};
	if (existsSync(root)) walk(root);
	return out;
}

type FixtureHostName = "codex" | "claude-code" | "opencode" | "drenyra-pi";
type FixtureHost = { name: FixtureHostName; present: boolean };
    
/** Creates a host config dir + managed marker/skills/pin asset exactly as install does. */
function writeHostAssets(home: string, hostName: FixtureHostName, installedAt: string): void {
	const configDir = join(home, HOST_DIR[hostName]!);
	mkdirSync(configDir, { recursive: true });
	writeFileSync(join(configDir, ".drenyra-managed"), renderManagedMarker(installedAt));
	writeFileSync(join(configDir, ".drenyra-skills.json"), renderManagedSkills());
	writeFileSync(join(configDir, ".drenyra-pinned-ai-runtime.json"), renderPinnedAiRuntime(hostName));
}
    
/** A composition snapshot fixture with exact managed-asset bytes (+ pins). */
function snapshot(
	version: string,
	sequence: number,
	activatedAt: string,
	opts: { pins?: boolean; hosts?: FixtureHost[] } = {},
): Record<string, unknown> {
	const hosts = opts.hosts ?? [{ name: "claude-code", present: true }];
	const base = {
		packageVersion: version,
		sequence,
		activatedAt,
		managedAssets: {
			marker: hashManagedAsset(renderManagedMarker(activatedAt)),
			skills: hashManagedAsset(renderManagedSkills()),
		},
	};
	if (opts.pins === false) return base;
	const pinnedComposition: Record<string, unknown> = {};
	for (const h of hosts) {
		if (h.present) pinnedComposition[h.name] = managedHostPin(h.name);
	}
	return { ...base, pinnedComposition };
}

/** A pre-slice (legacy) manifest fixture. */
function legacyManifest(
	home: string,
	opts: {
		version?: string;
		installedAt?: string;
		hosts?: Array<{ name: string; present: boolean }>;
	} = {},
): Record<string, unknown> {
	const hosts = (opts.hosts ?? [{ name: "claude-code", present: true }]).map(
		({ name, present }) => ({ name, configDir: join(home, HOST_DIR[name]!), present }),
	);
	return {
		manager: "drenyra-ai",
		version: opts.version ?? A,
		installedAt: opts.installedAt ?? INSTALLED_AT,
		hosts,
		assets: ["skills"],
	};
}

/** A current-schema manifest fixture with a composition record. */
function currentSchemaManifest(
	home: string,
	opts: {
		version: string;
		sequence: number;
		activatedAt: string;
		previous?: unknown;
		installedAt?: string;
		hosts?: FixtureHost[];
		pins?: boolean;
	},
): Record<string, unknown> {
	const hosts = (opts.hosts ?? [{ name: "claude-code", present: true }]).map(
		({ name, present }) => ({ name, configDir: join(home, HOST_DIR[name]!), present }),
	);
	const snapshotOpts = { hosts, pins: opts.pins };
	return {
		manager: "drenyra-ai",
		version: opts.version,
		installedAt: opts.installedAt ?? INSTALLED_AT,
		hosts,
		assets: ["skills"],
		composition: {
			schemaVersion: 2,
			current: snapshot(opts.version, opts.sequence, opts.activatedAt, snapshotOpts),
			previous: opts.previous ?? null,
		},
	};
}

function writeManifest(home: string, manifest: Record<string, unknown>): void {
	mkdirSync(join(home, ".drenyra"), { recursive: true });
	writeFileSync(
		join(home, ".drenyra", "managed.json"),
		JSON.stringify(manifest, null, 2),
	);
}

function readManifest(home: string): Record<string, any> {
	return JSON.parse(
		readFileSync(join(home, ".drenyra", "managed.json"), "utf8"),
	) as Record<string, any>;
}

/** Repo-root-relative snapshot of frozen contracts and program-root documents. */
function repoRoot(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function snapshotContractsAndDocs(): Record<string, string> {
	const out: Record<string, string> = {};
	const root = repoRoot();
	const walk = (relDir: string): void => {
		const abs = join(root, relDir);
		for (const entry of readdirSync(abs, { withFileTypes: true })) {
			const rel = join(relDir, entry.name);
			if (entry.isDirectory()) walk(rel);
			else out[rel] = readFileSync(join(root, rel), "utf8");
		}
	};
	for (const rel of ["contracts", "README.md", "LICENSE"]) {
		const abs = join(root, rel);
		if (existsSync(abs)) {
			if (statSync(abs).isDirectory()) {
				walk(rel);
			} else {
				out[rel] = readFileSync(abs, "utf8");
			}
		}
	}
	return out;
}

describe("configurator upgrade", () => {
	it("upgrades A to locally packaged B: current=B with package pin constants, previous=exact A pins, integer sequence increment, version mirror, assets reflect B, exit 0", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(
				dir,
				currentSchemaManifest(dir, {
					version: A,
					sequence: 0,
					activatedAt: INSTALLED_AT,
				}),
			);
    
			const { code, stdout } = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => ACTIVATED_B,
				}),
			);
			expect(code).toBe(0);
			const report = JSON.parse(stdout) as {
				status: string;
				from: string;
				to: string;
				results: Array<{ host: string; asset: string; action: string }>;
			};
			expect(report.status).toBe("upgraded");
			expect(report.from).toBe(A);
			expect(report.to).toBe(B);
			expect(report.results).toEqual([
				{ host: "claude-code", asset: "marker", action: "updated" },
				{ host: "claude-code", asset: "skills", action: "updated" },
				{ host: "claude-code", asset: "pin", action: "updated" },
			]);
    
			const manifest = readManifest(dir);
			expect(manifest.composition.schemaVersion).toBe(2);
			expect(Number.isInteger(manifest.composition.schemaVersion)).toBe(true);
			expect(manifest.composition.current.packageVersion).toBe(B);
			expect(manifest.composition.current.sequence).toBe(1);
			expect(Number.isInteger(manifest.composition.current.sequence)).toBe(true);
			expect(manifest.composition.current.activatedAt).toBe(ACTIVATED_B);
			expect(manifest.composition.current.managedAssets.marker.content).toBe(
				renderManagedMarker(ACTIVATED_B),
			);
			expect(manifest.composition.current.managedAssets.skills.content).toBe(
				renderManagedSkills(),
			);
			// current records B's package pin constants/bytes for the present host
			const currentPin = manifest.composition.current.pinnedComposition["claude-code"];
			expect(currentPin.managedAsset.content).toBe(renderPinnedAiRuntime("claude-code"));
			expect(currentPin.managedAsset.sha256).toMatch(/^[0-9a-f]{64}$/);
			// previous is the exact recorded A, including A's exact pin records/bytes
			expect(manifest.composition.previous.packageVersion).toBe(A);
			expect(manifest.composition.previous.sequence).toBe(0);
			expect(Number.isInteger(manifest.composition.previous.sequence)).toBe(true);
			expect(manifest.composition.previous.activatedAt).toBe(INSTALLED_AT);
			expect(manifest.composition.previous.managedAssets.marker.content).toBe(
				renderManagedMarker(INSTALLED_AT),
			);
			expect(manifest.composition.previous.managedAssets.skills.content).toBe(
				renderManagedSkills(),
			);
			const previousPin = manifest.composition.previous.pinnedComposition["claude-code"];
			expect(previousPin.managedAsset.content).toBe(renderPinnedAiRuntime("claude-code"));
			expect(previousPin.record.host).toBe("claude-code");
			// top-level compatibility mirror + retained fields
			expect(manifest.version).toBe(B);
			expect(manifest.manager).toBe("drenyra-ai");
			expect(manifest.installedAt).toBe(INSTALLED_AT);
			expect(manifest.hosts).toHaveLength(1);
			expect(manifest.assets).toEqual(["skills"]);
			// managed assets on disk reflect B (pin included)
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8"),
			).toBe(renderManagedMarker(ACTIVATED_B));
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-skills.json"), "utf8"),
			).toBe(renderManagedSkills());
			expect(
				readFileSync(
					join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"),
					"utf8",
				),
			).toBe(renderPinnedAiRuntime("claude-code"));
		} finally {
			cleanup();
		}
	});

	it("is byte-for-byte idempotent when upgrading B to B: status unchanged, zero writes, no timestamp generated", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", ACTIVATED_B);
			writeManifest(
				dir,
				currentSchemaManifest(dir, {
					version: B,
					sequence: 1,
					activatedAt: ACTIVATED_B,
					previous: snapshot(A, 0, INSTALLED_AT),
				}),
			);
			const before = snapshotFiles(dir);
			const { code, stdout } = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => {
						throw new Error(
							"unchanged upgrade must not generate a timestamp",
						);
					},
				}),
			);
			expect(code).toBe(0);
			const report = JSON.parse(stdout) as { status: string };
			expect(report.status).toBe("unchanged");
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});

	it("rejects a version that is not the locally packaged version: COMPOSITION_NOT_PACKAGED, exit 1, zero writes", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(dir, legacyManifest(dir));
			const before = snapshotFiles(dir);
			const { code, stdout } = capture(() =>
				upgradeCommand(["9.9.9", "--home", dir], {
					packagedVersion: B,
				}),
			);
			expect(code).toBe(1);
			const parsed = JSON.parse(stdout) as { error: { code: string } };
			expect(parsed.error.code).toBe("COMPOSITION_NOT_PACKAGED");
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});

	it("reports a missing <version> as a usage error (exit 2)", () => {
		const { dir, cleanup } = tempHome();
		try {
			const { code } = capture(() => upgradeCommand(["--home", dir], { packagedVersion: B }));
			expect(code).toBe(2);
		} finally {
			cleanup();
		}
	});
});

    	describe("configurator rollback", () => {
    	it("restores the previous composition including the exact previous pin bytes: current and mirror become A, previous stays A; a second rollback is byte-for-byte unchanged and exits 0", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			writeHostAssets(dir, "claude-code", ACTIVATED_B);
    			writeManifest(
    				dir,
    				currentSchemaManifest(dir, {
    					version: B,
    					sequence: 1,
    					activatedAt: ACTIVATED_B,
    					previous: snapshot(A, 0, INSTALLED_AT),
    				}),
    			);
    
    			const { code, stdout } = capture(() => rollbackCommand(["--home", dir]));
    			expect(code).toBe(0);
    			const report = JSON.parse(stdout) as {
    				status: string;
    				from: string;
    				to: string;
    				results: Array<{ host: string; asset: string; action: string }>;
    			};
    			expect(report.status).toBe("rolled-back");
    			expect(report.from).toBe(B);
    			expect(report.to).toBe(A);
    			expect(report.results).toEqual([
    				{ host: "claude-code", asset: "marker", action: "updated" },
    				{ host: "claude-code", asset: "skills", action: "updated" },
    				{ host: "claude-code", asset: "pin", action: "updated" },
    			]);
    
    			const manifest = readManifest(dir);
    			expect(manifest.composition.current.packageVersion).toBe(A);
    			expect(manifest.composition.current.sequence).toBe(0);
    			expect(manifest.composition.current.activatedAt).toBe(INSTALLED_AT);
    			expect(manifest.composition.current.pinnedComposition["claude-code"]
    				.managedAsset.content).toBe(renderPinnedAiRuntime("claude-code"));
    			expect(manifest.version).toBe(A);
    			// previous stays A (current === previous afterwards)
    			expect(manifest.composition.previous.packageVersion).toBe(A);
    			expect(
    				readFileSync(
    					join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"),
    					"utf8",
    				),
    			).toBe(renderPinnedAiRuntime("claude-code"));
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8"),
			).toBe(renderManagedMarker(INSTALLED_AT));

			// second rollback: exact zero-write no-op
			const before = snapshotFiles(dir);
			const second = capture(() => rollbackCommand(["--home", dir]));
			expect(second.code).toBe(0);
			const secondReport = JSON.parse(second.stdout) as { status: string };
			expect(secondReport.status).toBe("unchanged");
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});

	it("fails closed with ROLLBACK_UNAVAILABLE when previous is null: exit 1, current bytes unchanged", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", ACTIVATED_B);
			writeManifest(
				dir,
				currentSchemaManifest(dir, {
					version: B,
					sequence: 1,
					activatedAt: ACTIVATED_B,
					previous: null,
				}),
			);
			const before = snapshotFiles(dir);
			const { code, stdout } = capture(() => rollbackCommand(["--home", dir]));
			expect(code).toBe(1);
			const parsed = JSON.parse(stdout) as { error: { code: string } };
			expect(parsed.error.code).toBe("ROLLBACK_UNAVAILABLE");
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});
});

describe("configurator fail-closed state paths", () => {
	const cases: Array<{ name: string; setup: (home: string) => void }> = [
		{
			name: "missing manifest",
			setup: () => undefined,
		},
		{
			name: "malformed manifest",
			setup: (home) => {
				mkdirSync(join(home, ".drenyra"), { recursive: true });
				writeFileSync(join(home, ".drenyra", "managed.json"), "{ not json");
			},
		},
		{
			name: "wrong manager",
			setup: (home) => {
				const m = legacyManifest(home) as Record<string, unknown>;
				m.manager = "someone-else";
				writeManifest(home, m);
			},
		},
		{
			name: "invalid asset hash",
			setup: (home) => {
				const m = currentSchemaManifest(home, {
					version: B,
					sequence: 1,
					activatedAt: ACTIVATED_B,
					previous: null,
				});
				(m.composition as { current: { managedAssets: { marker: { sha256: string } } } }).current.managedAssets.marker.sha256 =
					"0".repeat(64);
				writeManifest(home, m);
			},
		},
		{
			name: "redirected host path",
			setup: (home) => {
				const m = legacyManifest(home, {
					hosts: [{ name: "codex", present: true }],
				}) as Record<string, unknown>;
				(m.hosts as Array<{ configDir: string }>)[0]!.configDir = "/tmp/evil-redirect";
				writeManifest(home, m);
			},
		},
		{
			name: "redirected host path with recorded pins",
			setup: (home) => {
				const m = currentSchemaManifest(home, {
					version: A,
					sequence: 0,
					activatedAt: INSTALLED_AT,
				}) as Record<string, unknown>;
				(m.hosts as Array<{ configDir: string }>)[0]!.configDir = "/tmp/evil-redirect";
				writeManifest(home, m);
			},
		},
	];

	for (const c of cases) {
		it(`upgrade fails closed with MANAGED_STATE_UNKNOWN and zero writes: ${c.name}`, () => {
			const { dir, cleanup } = tempHome();
			try {
				c.setup(dir);
				const before = snapshotFiles(dir);
				const { code, stdout } = capture(() =>
					upgradeCommand([B, "--home", dir], { packagedVersion: B }),
				);
				expect(code).toBe(1);
				const parsed = JSON.parse(stdout) as { error: { code: string } };
				expect(parsed.error.code).toBe("MANAGED_STATE_UNKNOWN");
				expect(snapshotFiles(dir)).toEqual(before);
			} finally {
				cleanup();
			}
		});
	}
});

describe("configurator legacy compatibility", () => {
	it("fails closed with MANAGED_STATE_UNKNOWN on a real legacy upgrade (no prior pin bytes) and never invents historical pin state", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(dir, legacyManifest(dir));
			const before = snapshotFiles(dir);
			const { code, stdout } = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => ACTIVATED_B,
				}),
			);
			expect(code).toBe(1);
			const parsed = JSON.parse(stdout) as { error: { code: string } };
			expect(parsed.error.code).toBe("MANAGED_STATE_UNKNOWN");
			// no schema migration, no pin bytes fabricated for the old manifest
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});

	it("reports unchanged for a legacy same-version upgrade without rewriting the manifest", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(dir, legacyManifest(dir));
			const before = snapshotFiles(dir);
			const { code, stdout } = capture(() =>
				upgradeCommand([A, "--home", dir], { packagedVersion: A }),
			);
			expect(code).toBe(0);
			const report = JSON.parse(stdout) as { status: string };
			expect(report.status).toBe("unchanged");
			// no silent schema migration: byte-for-byte identical
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});
});

describe("configurator foreign preservation", () => {
	it("preserves foreign-modified marker, skills, and pin bytes across upgrade and rollback, reports preserved, sentinels untouched", () => {
		const { dir, cleanup } = tempHome();
		try {
			// Current-schema A with RECORDED expectations: foreign-modified managed
			// assets are detected against the recorded bytes and preserved.
			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(
				dir,
				currentSchemaManifest(dir, {
					version: A,
					sequence: 0,
					activatedAt: INSTALLED_AT,
					previous: null,
				}),
			);
			writeFileSync(join(dir, ".claude", ".drenyra-managed"), "foreign marker bytes");
			writeFileSync(join(dir, ".claude", ".drenyra-skills.json"), "foreign skills bytes");
			writeFileSync(
				join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"),
				"user-authored pin bytes",
			);
			writeFileSync(join(dir, ".claude", "unrelated.txt"), "sentinel");
    
			const upgrade = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => ACTIVATED_B,
				}),
			);
			expect(upgrade.code).toBe(0);
			const upgradeReport = JSON.parse(upgrade.stdout) as {
				results: Array<{ host: string; asset: string; action: string }>;
			};
			expect(upgradeReport.results).toEqual([
				{ host: "claude-code", asset: "marker", action: "preserved" },
				{ host: "claude-code", asset: "skills", action: "preserved" },
				{ host: "claude-code", asset: "pin", action: "preserved" },
			]);
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8"),
			).toBe("foreign marker bytes");
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-skills.json"), "utf8"),
			).toBe("foreign skills bytes");
			expect(
				readFileSync(
					join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"),
					"utf8",
				),
			).toBe("user-authored pin bytes");
			expect(readFileSync(join(dir, ".claude", "unrelated.txt"), "utf8")).toBe(
				"sentinel",
			);
    
			const rollback = capture(() => rollbackCommand(["--home", dir]));
			expect(rollback.code).toBe(0);
			const rollbackReport = JSON.parse(rollback.stdout) as {
				results: Array<{ host: string; asset: string; action: string }>;
			};
			expect(rollbackReport.results).toEqual([
				{ host: "claude-code", asset: "marker", action: "preserved" },
				{ host: "claude-code", asset: "skills", action: "preserved" },
				{ host: "claude-code", asset: "pin", action: "preserved" },
			]);
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8"),
			).toBe("foreign marker bytes");
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-skills.json"), "utf8"),
			).toBe("foreign skills bytes");
			expect(
				readFileSync(
					join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"),
					"utf8",
				),
			).toBe("user-authored pin bytes");
			expect(readFileSync(join(dir, ".claude", "unrelated.txt"), "utf8")).toBe(
				"sentinel",
			);
		} finally {
			cleanup();
		}
	});
});

describe("configurator atomic fail-closed commit", () => {
	it("restores the prior manifest, assets, and pin file, and removes temp files when a replacement fails mid-commit", () => {
		const { dir, cleanup } = tempHome();
		try {
			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(
				dir,
				currentSchemaManifest(dir, {
					version: A,
					sequence: 0,
					activatedAt: INSTALLED_AT,
					previous: null,
				}),
			);
			const before = snapshotFiles(dir);
    
			const { code } = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => ACTIVATED_B,
					hooks: {
						afterAssetReplacement: (replaced) => {
							if (replaced >= 1) {
								throw new Error("injected IO failure after one replacement");
							}
						},
					},
				}),
			);
			expect(code).toBe(2);
			// prior manifest, marker, skills, and pin file restored byte-for-byte
			expect(snapshotFiles(dir)).toEqual(before);
			// no stale temp files remain anywhere under the home
			const all = snapshotFiles(dir);
			expect(Object.keys(all).every((p) => !p.includes(".tmp."))).toBe(true);
		} finally {
			cleanup();
		}
	});
});

    describe("configurator pre-pin fail-closed (SDD-020 slice 2)", () => {
    	it("pre-pin schema-1 current snapshot: same-version upgrade is an unchanged no-op; a real upgrade and a rollback to a pinless previous snapshot fail MANAGED_STATE_UNKNOWN with zero writes", () => {
    		const { dir, cleanup } = tempHome();
    		try {
    			writeHostAssets(dir, "claude-code", INSTALLED_AT);
    			writeManifest(
    				dir,
    				currentSchemaManifest(dir, {
    					version: A,
    					sequence: 0,
    					activatedAt: INSTALLED_AT,
    					pins: false,
    					previous: snapshot(A, 0, INSTALLED_AT, { pins: false }),
    				}),
    			);
    			const before = snapshotFiles(dir);
    
    			// same-version upgrade: unchanged no-op (idempotency precedes pins)
    			const same = capture(() =>
    				upgradeCommand([A, "--home", dir], { packagedVersion: A }),
    			);
    			expect(same.code).toBe(0);
    			expect(JSON.parse(same.stdout).status).toBe("unchanged");
    			expect(snapshotFiles(dir)).toEqual(before);
    
    			// real upgrade needs prior pin bytes the pre-pin manifest cannot supply
    			const upgrade = capture(() =>
    				upgradeCommand([B, "--home", dir], { packagedVersion: B }),
    			);
    			expect(upgrade.code).toBe(1);
    			expect(JSON.parse(upgrade.stdout).error.code).toBe("MANAGED_STATE_UNKNOWN");
    			expect(snapshotFiles(dir)).toEqual(before);
    
    			// rollback to a previous snapshot without pins fails the same way
    			const rollback = capture(() => rollbackCommand(["--home", dir]));
    			expect(rollback.code).toBe(1);
    			expect(JSON.parse(rollback.stdout).error.code).toBe("MANAGED_STATE_UNKNOWN");
    			expect(snapshotFiles(dir)).toEqual(before);
    		} finally {
    			cleanup();
    		}
    	});
    });
    
    describe("configurator boundary compliance", () => {
	it("upgrade then rollback invoke no host binary, make no authorization decision, change only allowlisted paths, and leave frozen contracts and program-root docs byte-identical", () => {
		const { dir, cleanup } = tempHome();
		try {
			// static guards: no process/child-process usage and no reverse imports
			for (const rel of [
				"configurator/managed-config.ts",
				"cmd/commands/upgrade.ts",
				"cmd/commands/rollback.ts",
			]) {
				const source = readFileSync(join(repoRoot(), rel), "utf8");
				expect(source).not.toMatch(/child_process|spawn\(|execSync|spawnSync|fork\(/);
			}
			const library = readFileSync(
				join(repoRoot(), "configurator", "managed-config.ts"),
				"utf8",
			);
			// every import specifier is a node: built-in or the skills library
			const specifiers = [...library.matchAll(/from "([^"]+)"/g)].map(
				(m) => m[1],
			);
			expect(specifiers.length).toBeGreaterThan(0);
			for (const specifier of specifiers) {
				expect(
					specifier === "../skills/index.js" || specifier.startsWith("node:"),
				).toBe(true);
			}

			writeHostAssets(dir, "claude-code", INSTALLED_AT);
			writeManifest(
				dir,
				currentSchemaManifest(dir, {
					version: A,
					sequence: 0,
					activatedAt: INSTALLED_AT,
					previous: null,
				}),
			);
			const repoBefore = snapshotContractsAndDocs();
			const homeBefore = snapshotFiles(dir);
    
			const upgrade = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => ACTIVATED_B,
				}),
			);
			const rollback = capture(() => rollbackCommand(["--home", dir]));
			expect(upgrade.code).toBe(0);
			expect(rollback.code).toBe(0);
    
			// only allowlisted managed paths changed under home (pin path included)
			const allowlisted = new Set([
				join(dir, ".drenyra", "managed.json"),
				join(dir, ".claude", ".drenyra-managed"),
				join(dir, ".claude", ".drenyra-skills.json"),
				join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"),
			]);
			const after = snapshotFiles(dir);
			const changed = Object.keys(after).filter(
				(p) => homeBefore[p] !== after[p],
			);
			expect(changed.length).toBeGreaterThan(0);
			for (const p of changed) {
				expect(allowlisted.has(p)).toBe(true);
			}
			// frozen contracts and program-root docs byte-identical
			expect(snapshotContractsAndDocs()).toEqual(repoBefore);
		} finally {
			cleanup();
		}
	});
});

describe("four-host lifecycle (SDD-020 slice B)", () => {
	it("install → doctor → sync → upgrade → rollback across codex, claude-code, opencode, and drenyra-pi with deterministic pin rendering and preservation", () => {
		const { dir, cleanup } = tempHome();
		try {
			const INSTALLED = "2026-03-01T00:00:00.000Z";
			const ACTIVATED = "2026-03-05T00:00:00.000Z";
			// All four host config dirs exist BEFORE install. drenyra-pi's canonical
			// config directory is the Drenyra-managed home (~/.drenyra), where the
			// managed manifest already lives; a present Pi host is one whose home
			// exists. drenyra-ai manages only the marker/skills/pin assets there.
			const HOST_NAMES = ["codex", "claude-code", "opencode", "drenyra-pi"] as const;
			for (const name of HOST_NAMES) {
				mkdirSync(join(dir, HOST_DIR[name]!), { recursive: true });
			}

			// 1) install: every present host gets marker/skills/pin + a managed entry
			const manifest = installIntegrations(dir, INSTALLED);
			expect(manifest.hosts.filter((h) => h.present).map((h) => h.name)).toEqual([
				...HOST_NAMES,
			]);
			for (const name of HOST_NAMES) {
				const configDir = join(dir, HOST_DIR[name]!);
				expect(existsSync(join(configDir, ".drenyra-managed"))).toBe(true);
				expect(existsSync(join(configDir, ".drenyra-skills.json"))).toBe(true);
				expect(
					readFileSync(
						join(configDir, ".drenyra-pinned-ai-runtime.json"),
						"utf8",
					),
				).toBe(renderPinnedAiRuntime(name));
				const pinned = (
					manifest as InstallManifest & {
						composition?: {
							current: {
								pinnedComposition?: Record<string, unknown>;
							};
						};
					}
				).composition!.current.pinnedComposition!;
				expect(
					(pinned[name] as { managedAsset: { content: string } }).managedAsset
						.content,
				).toBe(renderPinnedAiRuntime(name));
			}

			// 2) doctor: all four managed → healthy, exit 0
			const doctor = capture(() =>
				doctorCommand(["--home", dir], { packagedVersion: manifest.version }),
			);
			expect(doctor.code).toBe(0);
			const doctorReport = JSON.parse(doctor.stdout) as {
				status: string;
				checks: Array<{
					name: string;
					ok: boolean;
					applicability?: string;
					hosts?: Array<{ host: string; state: string }>;
				}>;
			};
			expect(doctorReport.status).toBe("healthy");
			const pinCheck = doctorReport.checks.find(
				(c) => c.name === "pinned-ai-runtime",
			);
			expect(pinCheck?.ok).toBe(true);
			expect(pinCheck?.applicability).toBe("applicable");
			expect(pinCheck?.hosts).toHaveLength(4);
			expect(pinCheck?.hosts?.every((h) => h.state === "managed")).toBe(true);
			for (const name of HOST_NAMES) {
				expect(pinCheck?.hosts?.some((h) => h.host === name)).toBe(true);
			}

			// 3) sync: everything already current → synced for marker and pin per host
			const results = syncManaged(dir);
			for (const name of HOST_NAMES) {
				expect(
					results.find((r) => r.host === name && r.asset === "marker")?.action,
				).toBe("synced");
				expect(
					results.find((r) => r.host === name && r.asset === "pin")?.action,
				).toBe("synced");
			}

			// 4) upgrade A→B: all four hosts updated marker/skills/pin; current=B, previous=A
			const upgrade = capture(() =>
				upgradeCommand([B, "--home", dir], {
					packagedVersion: B,
					now: () => ACTIVATED,
				}),
			);
			expect(upgrade.code).toBe(0);
			const upgradeReport = JSON.parse(upgrade.stdout) as {
				status: string;
				results: Array<{ host: string; asset: string; action: string }>;
			};
			expect(upgradeReport.status).toBe("upgraded");
			for (const name of HOST_NAMES) {
				expect(upgradeReport.results).toContainEqual({
					host: name,
					asset: "marker",
					action: "updated",
				});
				expect(upgradeReport.results).toContainEqual({
					host: name,
					asset: "skills",
					action: "updated",
				});
				expect(upgradeReport.results).toContainEqual({
					host: name,
					asset: "pin",
					action: "updated",
				});
				const configDir = join(dir, HOST_DIR[name]!);
				expect(readFileSync(join(configDir, ".drenyra-managed"), "utf8")).toBe(
					renderManagedMarker(ACTIVATED),
				);
				expect(
					readFileSync(
						join(configDir, ".drenyra-pinned-ai-runtime.json"),
						"utf8",
					),
				).toBe(renderPinnedAiRuntime(name));
			}
			const upgraded = readManifest(dir);
			expect(upgraded.composition.current.packageVersion).toBe(B);
			expect(upgraded.composition.previous.packageVersion).toBe(
				manifest.version,
			);
			expect(upgraded.composition.current.sequence).toBe(1);
			expect(Number.isInteger(upgraded.composition.current.sequence)).toBe(true);

			// 5) rollback: restores the A bytes for all four hosts; second rollback no-op
			const rollback = capture(() => rollbackCommand(["--home", dir]));
			expect(rollback.code).toBe(0);
			const rollbackReport = JSON.parse(rollback.stdout) as {
				status: string;
				results: Array<{ host: string; asset: string; action: string }>;
			};
			expect(rollbackReport.status).toBe("rolled-back");
			for (const name of HOST_NAMES) {
				expect(rollbackReport.results).toContainEqual({
					host: name,
					asset: "marker",
					action: "updated",
				});
				expect(rollbackReport.results).toContainEqual({
					host: name,
					asset: "skills",
					action: "updated",
				});
				expect(rollbackReport.results).toContainEqual({
					host: name,
					asset: "pin",
					action: "updated",
				});
				const configDir = join(dir, HOST_DIR[name]!);
				expect(readFileSync(join(configDir, ".drenyra-managed"), "utf8")).toBe(
					renderManagedMarker(INSTALLED),
				);
				expect(
					readFileSync(
						join(configDir, ".drenyra-pinned-ai-runtime.json"),
						"utf8",
					),
				).toBe(renderPinnedAiRuntime(name));
			}
			const rolledBack = readManifest(dir);
			expect(rolledBack.composition.current.packageVersion).toBe(
				manifest.version,
			);
			expect(rolledBack.version).toBe(manifest.version);

			// second rollback: exact zero-write no-op
			const before = snapshotFiles(dir);
			const second = capture(() => rollbackCommand(["--home", dir]));
			expect(second.code).toBe(0);
			expect(JSON.parse(second.stdout).status).toBe("unchanged");
			expect(snapshotFiles(dir)).toEqual(before);
		} finally {
			cleanup();
		}
	});
});
