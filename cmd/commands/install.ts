/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai install` — configures existing agent hosts (Design 03).
 *
 * Follows Gentle-AI's philosophy: Drenyra AI DETECTS and CONFIGURES hosts that
 * already exist; it never installs Codex, Claude Code, or OpenCode for the
 * user. Installation writes only managed markers (never touching foreign
 * config files) and reports what was configured.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** A detected agent host. */
export interface DetectedHost {
	name: "codex" | "claude-code" | "opencode";
	configDir: string;
	present: boolean;
}

/** Known host config directories relative to the user's home. */
const HOST_DIRS: ReadonlyArray<{ name: DetectedHost["name"]; dir: string }> = [
	{ name: "codex", dir: ".codex" },
	{ name: "claude-code", dir: ".claude" },
	{ name: "opencode", dir: ".config/opencode" },
];

/** Runtime version. */
function version(): string {
	try {
		const manifest = require("../../package.json") as { version?: string };
		return manifest.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

/** Detect which hosts are present on the machine (read-only). */
export function detectHosts(homeDir: string): DetectedHost[] {
	return HOST_DIRS.map(({ name, dir }) => {
		const configDir = join(homeDir, dir);
		return { name, configDir, present: existsSync(configDir) };
	});
}

/** Managed install manifest. */
export interface InstallManifest {
	manager: "drenyra-ai";
	version: string;
	installedAt: string;
	hosts: DetectedHost[];
}

const MANAGED_DIR = ".drenyra";
const MANAGED_FILE = "managed.json";

/** Install managed markers for the present hosts. Never touches foreign files. */
export function installIntegrations(
	homeDir: string,
	now = new Date().toISOString(),
): InstallManifest {
	const hosts = detectHosts(homeDir);
	const manifest: InstallManifest = {
		manager: "drenyra-ai",
		version: version(),
		installedAt: now,
		hosts,
	};
	const managedDir = join(homeDir, MANAGED_DIR);
	mkdirSync(managedDir, { recursive: true });
	// Marker per present host: created only when absent (foreign changes are
	// never overwritten).
	for (const host of hosts.filter((h) => h.present)) {
		const marker = join(host.configDir, ".drenyra-managed");
		if (!existsSync(marker)) {
			writeFileSync(marker, JSON.stringify({ manager: "drenyra-ai", installedAt: now }, null, 2));
		}
	}
	writeFileSync(join(managedDir, MANAGED_FILE), JSON.stringify(manifest, null, 2));
	return manifest;
}

/** Read the managed manifest, or undefined when not installed or unreadable. */
export function readInstallManifest(homeDir: string): InstallManifest | undefined {
	const path = join(homeDir, MANAGED_DIR, MANAGED_FILE);
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8")) as InstallManifest;
	} catch {
		return undefined;
	}
}

/** The install command handler. */
export function installCommand(args: string[]): number {
	const home = homeFromArgs(args);
	const manifest = installIntegrations(home);
	const present = manifest.hosts.flatMap((host) => (host.present ? [host.name] : []));
	console.log(
		JSON.stringify(
			{
				status: "installed",
				version: manifest.version,
				detectedHosts: manifest.hosts,
				configured: present,
				note: "hosts are detected and configured; drenyra-ai never installs a host",
			},
			null,
			2,
		),
	);
	return 0;
}

/** Resolve the home directory: --home override wins, else $HOME. */
export function homeFromArgs(args: string[]): string {
	const index = args.indexOf("--home");
	const value = index >= 0 ? args[index + 1] : undefined;
	if (index >= 0 && value !== undefined) {
		return value;
	}
	return process.env.HOME ?? process.cwd();
}

