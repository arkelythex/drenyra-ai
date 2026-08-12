/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Installed-package identity — the single declared-surface package lookup.
 * Locates the nearest `package.json` from this module's own URL (the proven
 * source/dist-safe upward walk previously owned by schema-loader.ts), derives
 * the package root, and statically reads the resolved manifest. Never uses
 * `process.cwd()` for package assets.
 */

import { accessSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageMetadata {
	version: string;
	engines?: { node?: string };
	packageRoot: string;
}

function findPackageRoot(from: string): string {
	let dir = from;
	for (;;) {
		try {
			accessSync(join(dir, "package.json"));
			return dir;
		} catch {
			// continue walking up
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error("drenyra-ai package root not found");
		}
		dir = parent;
	}
}

let cachedRoot: string | undefined;
let cachedMetadata: PackageMetadata | undefined;

/** Resolve the installed package root once; never falls back to cwd. */
export function getPackageRoot(): string {
	if (cachedRoot === undefined) {
		cachedRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));
	}
	return cachedRoot;
}

/**
 * Lazy, cached read-only package metadata; only a successful result is cached.
 * A failure is never converted into a stale literal or ambient fallback.
 */
export function getPackageMetadata(): PackageMetadata {
	if (cachedMetadata !== undefined) return cachedMetadata;
	const packageRoot = getPackageRoot();
	let manifest: { version?: unknown; engines?: { node?: string } };
	try {
		// Static manifest read (never a dynamic module load): JSON.parse mirrors
		// Node's `require` of a .json manifest, BOM included.
		manifest = JSON.parse(
			readFileSync(join(packageRoot, "package.json"), "utf8").replace(
				/^\uFEFF/,
				"",
			),
		);
	} catch {
		throw new Error(
			"drenyra-ai package metadata error: cannot read package.json manifest",
		);
	}
	if (typeof manifest.version !== "string" || manifest.version.length === 0) {
		throw new Error(
			"drenyra-ai package metadata error: package.json version must be a non-empty string",
		);
	}
	cachedMetadata = {
		version: manifest.version,
		engines: manifest.engines,
		packageRoot,
	};
	return cachedMetadata;
}
