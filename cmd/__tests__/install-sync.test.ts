import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
	mkdtempSync,
	rmSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	detectHosts,
	installIntegrations,
	readInstallManifest,
	type InstallManifest,
} from "../commands/install.js";
import { syncManaged } from "../commands/sync.js";
import {
	PINNED_AI_COMPOSITION,
	isPinVersion,
	managedHostPin,
	pinnedAiRuntimeRecord,
	renderManagedMarker,
	renderManagedSkills,
	renderPinnedAiRuntime,
	type ManagedCompositionSnapshot,
} from "../../configurator/managed-config.js";

function repoRoot(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function tempHome(): { dir: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-test-"));
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("install", () => {
	it("detects present hosts and configures only those", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			const detected = detectHosts(dir);
			expect(detected.find((h) => h.name === "claude-code")?.present).toBe(
				true,
			);
			expect(detected.find((h) => h.name === "codex")?.present).toBe(false);

			const manifest = installIntegrations(dir);
			expect(manifest.hosts.filter((h) => h.present)).toHaveLength(1);
			// marker + skills asset written only for the present host
			expect(existsSync(join(dir, ".claude", ".drenyra-managed"))).toBe(true);
			expect(existsSync(join(dir, ".claude", ".drenyra-skills.json"))).toBe(true);
			expect(existsSync(join(dir, ".codex", ".drenyra-managed"))).toBe(false);
			const skillsAsset = JSON.parse(readFileSync(join(dir, ".claude", ".drenyra-skills.json"), "utf8")) as Array<{ id: string; version: string }>;
			expect(skillsAsset.length).toBeGreaterThanOrEqual(6);
			expect(skillsAsset.some((s) => s.id === "pe.igv-validate")).toBe(true);
			// managed manifest persisted with the assets list
			expect(readInstallManifest(dir)?.manager).toBe("drenyra-ai");
			expect(readInstallManifest(dir)?.assets).toContain("skills");
		} finally {
			cleanup();
		}
	});

	it("never overwrites an existing foreign marker", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			writeFileSync(
				join(dir, ".claude", ".drenyra-managed"),
				"foreign content",
			);
			const manifest = installIntegrations(dir);
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8"),
			).toBe("foreign content");
			expect(manifest.hosts.filter((h) => h.present)).toHaveLength(1);
		} finally {
			cleanup();
		}
	});
});

describe("sync", () => {
	it("reports not-installed without a manifest", () => {
		const { dir, cleanup } = tempHome();
		try {
			const results = syncManaged(dir);
			expect(results[0]!.action).toBe("not-installed");
		} finally {
			cleanup();
		}
	});

	it("preserves a foreign-modified marker and syncs a clean one", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			mkdirSync(join(dir, ".config/opencode"), { recursive: true });
			const manifest = installIntegrations(dir);
			// Foreign change on the opencode marker after install.
			writeFileSync(
				join(dir, ".config/opencode", ".drenyra-managed"),
				"someone edited this",
			);
			const results = syncManaged(dir);
			const claude = results.find((r) => r.host === "claude-code");
			const opencode = results.find((r) => r.host === "opencode");
			expect(claude?.action).toBe("synced");
			expect(opencode?.action).toBe("preserved");
			// Foreign content untouched.
			expect(
				readFileSync(join(dir, ".config/opencode", ".drenyra-managed"), "utf8"),
			).toBe("someone edited this");
			expect(manifest.version).toBeTruthy();
		} finally {
			cleanup();
		}
	});
});

describe("install composition record (SDD-020)", () => {
	it("writes composition.current with integer sequence/schemaVersion, exact asset hashes/content, previous null, and the compatibility version mirror", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			const manifest = installIntegrations(dir, "2026-03-01T00:00:00.000Z");
			const raw = JSON.parse(
				readFileSync(join(dir, ".drenyra", "managed.json"), "utf8"),
			) as {
				version: string;
				composition: {
					schemaVersion: number;
					current: {
						packageVersion: string;
						sequence: number;
						activatedAt: string;
						managedAssets: {
							marker: { sha256: string; content: string };
							skills: { sha256: string; content: string };
						};
						pinnedComposition?: Record<
							string,
							{ managedAsset: { sha256: string; content: string } }
						>;
					};
					previous: unknown;
				};
			};
			expect(raw.composition.schemaVersion).toBe(2);
			expect(Number.isInteger(raw.composition.schemaVersion)).toBe(true);
			expect(Number.isInteger(raw.composition.current.sequence)).toBe(true);
			expect(raw.composition.current.sequence).toBe(0);
			expect(raw.composition.current.packageVersion).toBe(manifest.version);
			expect(raw.composition.current.activatedAt).toBe("2026-03-01T00:00:00.000Z");
			expect(raw.composition.previous).toBe(null);
			expect(raw.composition.current.managedAssets.marker.content).toBe(
				renderManagedMarker("2026-03-01T00:00:00.000Z"),
			);
			expect(raw.composition.current.managedAssets.marker.sha256).toMatch(
				/^[0-9a-f]{64}$/,
			);
			expect(raw.composition.current.managedAssets.skills.content).toBe(
				renderManagedSkills(),
			);
			expect(raw.composition.current.managedAssets.skills.sha256).toMatch(
				/^[0-9a-f]{64}$/,
			);
			expect(raw.composition.current.pinnedComposition?.["claude-code"]).toBeDefined();
			expect(
				raw.composition.current.pinnedComposition?.["claude-code"]?.managedAsset
					.content,
			).toBe(renderPinnedAiRuntime("claude-code"));
			expect(raw.version).toBe(manifest.version);
		} finally {
			cleanup();
		}
	});
});

describe("sync with a legacy manifest (SDD-020)", () => {
	it("keeps a pre-composition manifest readable and preserves foreign markers", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			mkdirSync(join(dir, ".drenyra"), { recursive: true });
			writeFileSync(join(dir, ".claude", ".drenyra-managed"), "foreign marker");
			writeFileSync(join(dir, ".claude", ".drenyra-skills.json"), renderManagedSkills());
			writeFileSync(
				join(dir, ".drenyra", "managed.json"),
				JSON.stringify(
					{
						manager: "drenyra-ai",
						version: "1.2.3",
						installedAt: "2026-03-01T00:00:00.000Z",
						hosts: [
							{
								name: "claude-code",
								configDir: join(dir, ".claude"),
								present: true,
							},
						],
						assets: ["skills"],
					},
					null,
					2,
				),
			);
    
			const results = syncManaged(dir);
			expect(results.some((r) => r.action === "not-installed")).toBe(false);
			const claude = results.find((r) => r.host === "claude-code");
			expect(claude?.action).toBe("preserved");
			expect(readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8")).toBe(
				"foreign marker",
			);
		} finally {
			cleanup();
		}
	});
});
    
describe("per-host pinned AI runtime (SDD-020 slice 2)", () => {
	it("creates exactly one .drenyra-pinned-ai-runtime.json per present host, records kind/schemaVersion/host/runtime/model/tool with integer-or-semver versions, and rejects float versions", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			mkdirSync(join(dir, ".config/opencode"), { recursive: true });
			const manifest = installIntegrations(dir);
			// exactly one pin file per present host; the absent codex host gets none
			expect(
				existsSync(join(dir, ".claude", ".drenyra-pinned-ai-runtime.json")),
			).toBe(true);
			expect(
				existsSync(
					join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json"),
				),
			).toBe(true);
			expect(
				existsSync(join(dir, ".codex", ".drenyra-pinned-ai-runtime.json")),
			).toBe(false);
			expect(existsSync(join(dir, ".codex"))).toBe(false);
			// parsed records carry the full pin shape
			for (const host of ["claude-code", "opencode"] as const) {
				const pinPath =
					host === "claude-code"
						? join(dir, ".claude", ".drenyra-pinned-ai-runtime.json")
						: join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json");
				const raw = JSON.parse(readFileSync(pinPath, "utf8")) as {
					kind: string;
					schemaVersion: number;
					host: string;
					runtime: { id: string; version: unknown };
					model: { id: string; version: unknown };
					tool: { id: string; version: unknown };
				};
				expect(raw.kind).toBe("pinned-ai-runtime");
				expect(raw.schemaVersion).toBe(1);
				expect(Number.isInteger(raw.schemaVersion)).toBe(true);
				expect(raw.host).toBe(host);
				expect(raw.runtime.id.length).toBeGreaterThan(0);
				expect(raw.model.id.length).toBeGreaterThan(0);
				expect(raw.tool.id.length).toBeGreaterThan(0);
				expect(isPinVersion(raw.runtime.version)).toBe(true);
				expect(isPinVersion(raw.model.version)).toBe(true);
				expect(isPinVersion(raw.tool.version)).toBe(true);
			}
			// version-domain rejection fixtures (scenario 1.2: no floats)
			expect(isPinVersion(1.5)).toBe(false);
			expect(isPinVersion(-1)).toBe(false);
			expect(isPinVersion(Number.NaN)).toBe(false);
			expect(isPinVersion(Number.POSITIVE_INFINITY)).toBe(false);
			expect(isPinVersion("1.2")).toBe(false);
			expect(isPinVersion("v1.2.3")).toBe(false);
			expect(isPinVersion("")).toBe(false);
			expect(isPinVersion(0)).toBe(true);
			expect(isPinVersion(1)).toBe(true);
			expect(isPinVersion("1.2.3")).toBe(true);
			expect(isPinVersion("1.2.3-rc.1")).toBe(true);
			// the manifest snapshot records a managed entry per created pin file
			const composition = (
				readInstallManifest(dir) as InstallManifest & {
					composition?: {
						current: {
							pinnedComposition?: Record<string, unknown>;
						};
					};
				}
			).composition?.current.pinnedComposition;
			expect(composition).toBeDefined();
			expect(Object.keys(composition!)).toEqual(["claude-code", "opencode"]);
			expect(manifest.hosts.filter((h) => h.present)).toHaveLength(2);
		} finally {
			cleanup();
		}
	});
    
	it("renders pin bytes deterministically: disk, snapshot content, and repeat renders are byte-identical and hashes recompute", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			mkdirSync(join(dir, ".config/opencode"), { recursive: true });
			const manifest = installIntegrations(dir);
			const composition = (
				manifest as InstallManifest & {
					composition?: { current: ManagedCompositionSnapshot };
				}
			).composition!.current;
			for (const host of ["claude-code", "opencode"] as const) {
				const pinPath =
					host === "claude-code"
						? join(dir, ".claude", ".drenyra-pinned-ai-runtime.json")
						: join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json");
				const disk = readFileSync(pinPath, "utf8");
				const entry = composition.pinnedComposition![host]!;
				expect(disk).toBe(renderPinnedAiRuntime(host));
				expect(entry.managedAsset.content).toBe(renderPinnedAiRuntime(host));
				expect(entry.record).toEqual(pinnedAiRuntimeRecord(host));
				expect(entry.record.host).toBe(host);
				expect(entry.managedAsset.sha256).toBe(
					createHash("sha256")
						.update(entry.managedAsset.content, "utf8")
						.digest("hex"),
				);
				// repeat rendering is byte-identical
				expect(renderPinnedAiRuntime(host)).toBe(renderPinnedAiRuntime(host));
			}
			// the package-owned constant is exhaustive over the three hosts
			expect(Object.keys(PINNED_AI_COMPOSITION)).toEqual([
				"codex",
				"claude-code",
				"opencode",
			]);
			// sync does not change the rendered bytes
			syncManaged(dir);
			for (const host of ["claude-code", "opencode"] as const) {
				const pinPath =
					host === "claude-code"
						? join(dir, ".claude", ".drenyra-pinned-ai-runtime.json")
						: join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json");
				expect(readFileSync(pinPath, "utf8")).toBe(renderPinnedAiRuntime(host));
			}
			expect(managedHostPin("claude-code").managedAsset.content).toBe(
				renderPinnedAiRuntime("claude-code"),
			);
		} finally {
			cleanup();
		}
	});
    
	it("sync recreates a deleted managed pin (asset pin, synced) and preserves a foreign pin byte-for-byte (asset pin, preserved)", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			mkdirSync(join(dir, ".config/opencode"), { recursive: true });
			// a foreign pin for opencode exists BEFORE install: preserved, never adopted
			writeFileSync(
				join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json"),
				"user-authored pin bytes",
			);
			installIntegrations(dir);
			expect(
				readFileSync(
					join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json"),
					"utf8",
				),
			).toBe("user-authored pin bytes");
			const manifest = readInstallManifest(dir) as InstallManifest & {
				composition?: {
					current: {
						pinnedComposition?: Record<string, unknown>;
					};
				};
			};
			const pinned = manifest.composition!.current.pinnedComposition!;
			expect(pinned["claude-code"]).toBeDefined();
			expect(pinned["opencode"]).toBeUndefined();
			// delete the managed claude-code pin and sync: recreated from recorded bytes
			rmSync(join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"));
			const results = syncManaged(dir);
			const recreated = results.find(
				(r) => r.host === "claude-code" && r.asset === "pin",
			);
			expect(recreated?.action).toBe("synced");
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-pinned-ai-runtime.json"), "utf8"),
			).toBe(renderPinnedAiRuntime("claude-code"));
			// the foreign opencode pin is preserved with a preserved result and no write
			const preserved = results.find(
				(r) => r.host === "opencode" && r.asset === "pin",
			);
			expect(preserved?.action).toBe("preserved");
			expect(
				readFileSync(
					join(dir, ".config/opencode", ".drenyra-pinned-ai-runtime.json"),
					"utf8",
				),
			).toBe("user-authored pin bytes");
		} finally {
			cleanup();
		}
	});
    
	it("runs in isolation: no missing host config directory is created and no host binary seam exists or is called during install/sync", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			installIntegrations(dir);
			expect(existsSync(join(dir, ".codex"))).toBe(false);
			expect(existsSync(join(dir, ".config/opencode"))).toBe(false);
			syncManaged(dir);
			expect(existsSync(join(dir, ".codex"))).toBe(false);
			expect(existsSync(join(dir, ".config/opencode"))).toBe(false);
			// no process/network seams in the install/sync/library sources
			for (const rel of [
				"cmd/commands/install.ts",
				"cmd/commands/sync.ts",
				"configurator/managed-config.ts",
			]) {
				const source = readFileSync(join(repoRoot(), rel), "utf8");
				expect(source).not.toMatch(
					/child_process|spawn\(|execSync|spawnSync|fork\(/,
				);
			}
		} finally {
			cleanup();
		}
	});
});
