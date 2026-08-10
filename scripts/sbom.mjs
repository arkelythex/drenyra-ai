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
import { join } from "node:path";

let manifest;
try {
	manifest = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
} catch (error) {
	console.error(`sbom: cannot read package.json: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}

const components = Object.entries(manifest.dependencies ?? {}).map(([name, version]) => ({
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
		timestamp: new Date().toISOString(),
	},
	components,
	dependencies: [
		{
			ref: manifest.name,
			dependsOn: components.map((component) => component.name),
		},
	],
};

const out = join(process.cwd(), "dist", "sbom.json");
writeFileSync(out, JSON.stringify(sbom, null, 2) + "\n");
console.log(`sbom: ${components.length} components -> dist/sbom.json`);
