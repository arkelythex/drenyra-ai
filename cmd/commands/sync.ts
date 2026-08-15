/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai sync` — refreshes managed assets (Design 03 "sync", SDD-020)
 * without overwriting foreign changes.
 *
 * Each managed marker is compared against the expected content from the shared
 * managed-state helpers (configurator/managed-config.ts): a marker that someone
 * modified is PRESERVED and reported; only markers still matching the managed
 * state are refreshed. Legacy manifests remain readable. Never touches foreign
 * config files.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectHosts, homeFromArgs } from "./install.js";
import { expectedMarkerContent, readManagedState } from "../../configurator/managed-config.js";

/** Result of syncing one managed marker. */
export interface SyncResult {
	host: string;
	action: "synced" | "preserved" | "missing" | "not-installed";
	reason: string;
}

/** Sync managed markers; a foreign-modified marker is preserved, never clobbered. */
export function syncManaged(homeDir: string): SyncResult[] {
	const state = readManagedState(homeDir);
	if (state.state === "absent" || state.state === "invalid") {
		return [
			{
				host: "*",
				action: "not-installed",
				reason: "no drenyra-ai install manifest found",
			},
		];
	}
	const manifest = state.manifest!;
	const hosts = detectHosts(homeDir);
	const expected = expectedMarkerContent(manifest);
	const results: SyncResult[] = [];
	for (const host of hosts) {
		if (!host.present) {
			results.push({
				host: host.name,
				action: "missing",
				reason: "host config directory absent",
			});
			continue;
		}
		const markerPath = join(host.configDir, ".drenyra-managed");
		if (existsSync(markerPath)) {
			const current = readFileSync(markerPath, "utf8");
			if (current === expected) {
				results.push({
					host: host.name,
					action: "synced",
					reason: "marker already current",
				});
			} else {
				// Foreign change: preserve it, report it. Never overwrite.
				results.push({
					host: host.name,
					action: "preserved",
					reason: "marker differs from managed state; foreign change preserved",
				});
			}
		} else {
			writeFileSync(markerPath, expected);
			results.push({
				host: host.name,
				action: "synced",
				reason: "marker recreated",
			});
		}
	}
	return results;
}

/** The sync command handler. */
export function syncCommand(args: string[]): number {
	const home = homeFromArgs(args);
	const results = syncManaged(home);
	console.log(JSON.stringify({ status: "synced", results }, null, 2));
	return 0;
}
