#!/usr/bin/env node
/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version fields are JSON integers/strings,
 * never floats.
 */
/**
 * Release integrity — resolved SBOM (Design 05 "SBOM generation"). Derived from
 * the Bun lockfile: exact locked versions and the complete required-runtime
 * closure. Written to dist/sbom.json so the published artifact carries
 * a software bill of materials.
 */

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRuntimeGraph } from "./lib/bun-lockfile.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

let manifest;
let deps;
let graph;
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
	graph = resolveRuntimeGraph(root);
} catch (error) {
	console.error(
		`sbom: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
}

const components = graph.nodes.map(({ name, version, direct }) => ({
	type: "library", "bom-ref": name, name, version, scope: "required",
	properties: [{ name: "drenyra:resolution", value: direct ? "direct" : "transitive" }] }));

const sbom = {
	bomFormat: "CycloneDX",
	specVersion: "1.5",
	version: 1,
	metadata: {
		component: {
			type: "library",
			"bom-ref": manifest.name,
			name: manifest.name,
			version: manifest.version,
		},
	},
	components,
	dependencies: [
		{
			ref: manifest.name,
			dependsOn: graph.direct,
		},
		...graph.nodes.map((node) => ({ ref: node.name, dependsOn: node.dependsOn })),
	],
};

const out = join(root, "dist", "sbom.json");
try {
	if (!existsSync(join(root, "dist"))) throw new Error(`missing dist/ directory: ${join(root, "dist")}`);
	writeFileSync(`${out}.tmp`, JSON.stringify(sbom, null, 2) + "\n");
	renameSync(`${out}.tmp`, out);
} catch (error) {
	rmSync(`${out}.tmp`, { force: true });
	console.error(`sbom: ${error instanceof Error ? error.message : String(error)}`); process.exit(1);
}
console.log(`sbom: ${components.length} components -> dist/sbom.json`);
