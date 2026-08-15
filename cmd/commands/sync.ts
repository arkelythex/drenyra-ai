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
    import {
    	ASSET_FILENAMES,
    	expectedMarkerContent,
    	readManagedState,
    	type ManagedAssetName,
    } from "../../configurator/managed-config.js";
    
    /** Result of syncing one managed asset (marker or per-host pin). */
    export interface SyncResult {
    	host: string;
    	/** Which managed asset this result describes (marker vs pin). */
    	asset: ManagedAssetName;
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
    				asset: "marker",
    				action: "not-installed",
    				reason: "no drenyra-ai install manifest found",
    			},
    		];
    	}
    	const manifest = state.manifest!;
    	const hosts = detectHosts(homeDir);
    	const expected = expectedMarkerContent(manifest);
    	const pinned = manifest.composition?.current.pinnedComposition;
    	const results: SyncResult[] = [];
    	for (const host of hosts) {
    		if (!host.present) {
    			results.push({
    				host: host.name,
    				asset: "marker",
    				action: "missing",
    				reason: "host config directory absent",
    			});
    			continue;
    		}
    		const markerPath = join(host.configDir, ASSET_FILENAMES.marker);
    		if (existsSync(markerPath)) {
    			const current = readFileSync(markerPath, "utf8");
    			if (current === expected) {
    				results.push({
    					host: host.name,
    					asset: "marker",
    					action: "synced",
    					reason: "marker already current",
    				});
    			} else {
    				// Foreign change: preserve it, report it. Never overwrite.
    				results.push({
    					host: host.name,
    					asset: "marker",
    					action: "preserved",
    					reason: "marker differs from managed state; foreign change preserved",
    				});
    			}
    		} else {
    			writeFileSync(markerPath, expected);
    			results.push({
    				host: host.name,
    				asset: "marker",
    				action: "synced",
    				reason: "marker recreated",
    			});
    		}
    		// Pin reconciliation uses ONLY the recorded current pinnedComposition as
    		// authority: exact bytes are synced, a missing managed pin is recreated,
    		// unequal/unreadable bytes are preserved, and an unmanaged pin file is
    		// reported foreign/preserved. Pre-pin manifests stay pin-not-applicable.
    		const pinEntry = pinned?.[host.name];
    		const pinPath = join(host.configDir, ASSET_FILENAMES.pin);
    		if (pinEntry === undefined) {
    			if (existsSync(pinPath)) {
    				results.push({
    					host: host.name,
    					asset: "pin",
    					action: "preserved",
    					reason:
    						"pin asset exists without a managed composition entry; foreign bytes preserved",
    				});
    			}
    			continue;
    		}
    		if (!existsSync(pinPath)) {
    			writeFileSync(pinPath, pinEntry.managedAsset.content);
    			results.push({
    				host: host.name,
    				asset: "pin",
    				action: "synced",
    				reason: "pin recreated from recorded managed bytes",
    			});
    			continue;
    		}
    		let diskPin: string;
    		try {
    			diskPin = readFileSync(pinPath, "utf8");
    		} catch {
    			results.push({
    				host: host.name,
    				asset: "pin",
    				action: "preserved",
    				reason: "pin unreadable; bytes preserved",
    			});
    			continue;
    		}
    		if (diskPin === pinEntry.managedAsset.content) {
    			results.push({
    				host: host.name,
    				asset: "pin",
    				action: "synced",
    				reason: "pin already current",
    			});
    		} else {
    			results.push({
    				host: host.name,
    				asset: "pin",
    				action: "preserved",
    				reason: "pin differs from recorded managed state; foreign change preserved",
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
