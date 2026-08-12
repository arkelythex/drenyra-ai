#!/usr/bin/env node
/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version fields are JSON integers/strings,
 * never floats.
 */
/**
 * Release integrity — minimal SBOM (Design 05 "SBOM generation"). Derived from
 * the package manifest: name, version, and every runtime dependency with its
 * declared version. Written to dist/sbom.json so the published artifact carries
 * a software bill of materials.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

let manifest;
let deps;
try {
	manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	if (typeof manifest.name !== "string" || typeof manifest.version !== "string")
		throw new Error("package.json must declare string name and version");
	deps = manifest.dependencies ?? {};
	if (deps === null || typeof deps !== "object" || Array.isArray(deps))
		throw new Error(
			"package.json dependencies must be an object of string ranges",
		);
	for (const version of Object.values(deps))
		if (typeof version !== "string")
			throw new Error("package.json dependencies must declare string versions");
} catch (error) {
	console.error(
		`sbom: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
}

const components = Object.entries(deps)
	.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	.map(([name, version]) => ({
		type: "library",
		name,
		version,
		scope: "required",
	}));

const sbom = {
	bomFormat: "CycloneDX",
	specVersion: "1.5",
	version: 1,
	metadata: {
		component: {
			type: "library",
			name: manifest.name,
			version: manifest.version,
		},
	},
	components,
	dependencies: [
		{
			ref: manifest.name,
			dependsOn: components.map((component) => component.name),
		},
	],
};

const out = join(root, "dist", "sbom.json");
writeFileSync(out, JSON.stringify(sbom, null, 2) + "\n");
console.log(`sbom: ${components.length} components -> dist/sbom.json`);
