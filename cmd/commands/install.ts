/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai install` — configures existing agent hosts (Design 03, SDD-020).
 *
 * Follows Gentle-AI's philosophy: Drenyra AI DETECTS and CONFIGURES hosts that
 * already exist; it never installs Codex, Claude Code, or OpenCode for the
 * user. Installation writes only managed markers (never touching foreign
 * config files) and reports what was configured.
 *
 * Thin adapter: host detection, marker/skills rendering, and hashing delegate
 * to configurator/managed-config.ts; a new install also records the additive
 * composition record (current snapshot, `previous: null`) plus the
 * compatibility top-level `version` mirror. Existing test-referenced exports
 * (`detectHosts`, `readInstallManifest`, `homeFromArgs`, `InstallManifest`,
 * `DetectedHost`) are re-exported unchanged.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
	ASSET_FILENAMES,
	COMPOSITION_SCHEMA_VERSION,
	MANAGED_DIR,
	MANAGED_FILE,
	detectHosts,
	hashManagedAsset,
	homeFromArgs,
	managedHostPin,
	readManagedState,
	renderManagedMarker,
	renderManagedSkills,
	renderPinnedAiRuntime,
	type HostName,
	type InstallManifest,
	type ManagedCompositionSnapshot,
	type ManagedHostPin,
} from "../../configurator/managed-config.js";
import {
	readPromotedComposition,
	type PromotedComposition,
	type PromotedCompositionRead,
	type VersionRelationship,
} from "../../configurator/promoted-composition.js";

export {
	detectHosts,
	homeFromArgs,
	readInstallManifest,
	type DetectedHost,
	type InstallManifest,
} from "../../configurator/managed-config.js";

const require = createRequire(import.meta.url);

/** Runtime version. */
function version(): string {
	try {
		const manifest = require("../../package.json") as { version?: string };
		return manifest.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Install managed markers + skills for the present hosts and record the
 * composition. Never touches foreign files; never installs a host binary.
 */
export function installIntegrations(
	homeDir: string,
	now = new Date().toISOString(),
): InstallManifest {
	const hosts = detectHosts(homeDir);
	const markerContent = renderManagedMarker(now);
	const skillsContent = renderManagedSkills();
	// Per-host managed pin entries: only hosts whose pin file we actually
	// create get an entry. Existing bytes are preserved and recorded as
	// unmanaged (never adopted by coincidence).
	const pinEntries: Partial<Record<HostName, ManagedHostPin>> = {};
	for (const host of hosts.filter((h) => h.present)) {
		const pinPath = join(host.configDir, ASSET_FILENAMES.pin);
		if (!existsSync(pinPath)) {
			writeFileSync(pinPath, renderPinnedAiRuntime(host.name));
			pinEntries[host.name] = managedHostPin(host.name);
		}
	}
	const current: ManagedCompositionSnapshot = {
		packageVersion: version(),
		sequence: 0,
		activatedAt: now,
		managedAssets: {
			marker: hashManagedAsset(markerContent),
			skills: hashManagedAsset(skillsContent),
		},
		pinnedComposition: pinEntries,
	};
	const managedDir = join(homeDir, MANAGED_DIR);
	mkdirSync(managedDir, { recursive: true });
	// Marker + skills per present host: created only when absent (foreign
	// changes are never overwritten).
	for (const host of hosts.filter((h) => h.present)) {
		const marker = join(host.configDir, ".drenyra-managed");
		if (!existsSync(marker)) {
			writeFileSync(marker, markerContent);
		}
		const skillsPath = join(host.configDir, ".drenyra-skills.json");
		if (!existsSync(skillsPath)) {
			writeFileSync(skillsPath, skillsContent);
		}
	}
	// Preserve an existing composition record across re-installs; create a
	// fresh one (sequence 0, previous null) for a new install.
	const existing = readManagedState(homeDir);
	const composition =
		existing.state === "current-schema" &&
		existing.manifest?.composition !== undefined
			? existing.manifest.composition
			: {
					schemaVersion: COMPOSITION_SCHEMA_VERSION,
					current,
					previous: null,
				};
	const manifest: InstallManifest = {
		manager: "drenyra-ai",
		version: current.packageVersion,
		installedAt: now,
		hosts,
		assets: ["skills"],
		composition,
	};
	writeFileSync(
		join(managedDir, MANAGED_FILE),
		JSON.stringify(manifest, null, 2),
	);
	return manifest;
}

/**
 * Promoted-composition evidence reported by install (R3; D10). Absent/invalid
 * evidence is reported unavailable with no promoted facts; a valid manifest
 * adds the five facts and the packaged-versus-promoted relationship
 * (`matches`/`differs`, never an ordering gate).
 */
export type PromotedCompositionReport =
	| {
			state: "valid";
			availability: "available";
			versionRelationship: VersionRelationship;
			composition: PromotedComposition;
		}
	| { state: "absent"; availability: "unavailable" }
	| { state: "invalid"; availability: "unavailable"; reason: string };

export interface InstallCommandDeps {
	/** Test seam: injected reader; production uses the real library reader. */
	readPromotedComposition?: () => PromotedCompositionRead;
}

/** Report-only mapping of the read evidence (D10, D11): no gating. */
function promotedCompositionReport(
	read: PromotedCompositionRead,
	packageVersion: string,
): PromotedCompositionReport {
	if (read.state === "absent") {
		return { state: "absent", availability: "unavailable" };
	}
	if (read.state === "invalid") {
		return {
			state: "invalid",
			availability: "unavailable",
			reason: read.invalidReason,
		};
	}
	return {
		state: "valid",
		availability: "available",
		versionRelationship:
			read.composition.version === packageVersion ? "matches" : "differs",
		composition: read.composition,
	};
}

/** The install command handler. */
export function installCommand(
	args: string[],
	deps: InstallCommandDeps = {},
): number {
	const home = homeFromArgs(args);
	const manifest = installIntegrations(home);
	const present = manifest.hosts.flatMap((host) =>
		host.present ? [host.name] : [],
	);
	// Read-only promoted-composition evidence for the report; never persisted
	// into managed.json and never gating install success (R3; D10).
	const read = (deps.readPromotedComposition ?? readPromotedComposition)();
	console.log(
		JSON.stringify(
			{
				status: "installed",
				version: manifest.version,
				packageVersion: manifest.version,
				detectedHosts: manifest.hosts,
				configured: present,
				promotedComposition: promotedCompositionReport(
					read,
					manifest.version,
				),
				note: "hosts are detected and configured; drenyra-ai never installs a host",
			},
			null,
			2,
		),
	);
	return 0;
}
