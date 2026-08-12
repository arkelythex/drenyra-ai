#!/usr/bin/env node
/**
 * Release integrity — verify dist/checksums.txt self-consistency and SBOM
 * coverage of declared runtime dependencies. Consistency evidence, not
 * authenticity: checksums detect mismatch, they are not signatures.
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

/** Regular files under dist/ (excludes checksums.txt), sorted by code point. */
function packagedFiles() {
	const out = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			const stat = lstatSync(path);
			if (stat.isDirectory()) walk(path);
			else if (stat.isFile())
				out.push(relative(dist, path).split(sep).join("/"));
			else
				throw new Error(
					`unsupported or symlinked entry: ${relative(dist, path)}`,
				);
		}
	};
	walk(dist);
	return out.filter((rel) => rel !== "checksums.txt").sort();
}

try {
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	if (typeof manifest.name !== "string" || typeof manifest.version !== "string")
		throw new Error("package.json must declare string name and version");

	const sbom = JSON.parse(readFileSync(join(dist, "sbom.json"), "utf8"));
	if (
		sbom.bomFormat !== "CycloneDX" ||
		sbom.specVersion !== "1.5" ||
		!Array.isArray(sbom.components)
	)
		throw new Error("sbom.json must be CycloneDX 1.5 with a components array");
	const components = new Map();
	for (const component of sbom.components) {
		if (typeof component?.name !== "string")
			throw new Error("sbom.json has a component without a name");
		if (components.has(component.name))
			throw new Error(`sbom.json duplicate component: ${component.name}`);
		components.set(component.name, component);
	}
	for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
		const component = components.get(name);
		if (component?.type !== "library" || component.version !== version)
			throw new Error(`sbom.json missing or mismatched dependency: ${name}`);
	}

	const records = readFileSync(join(dist, "checksums.txt"), "utf8").split("\n");
	if (records.at(-1) === "") records.pop();
	if (records.length === 0) throw new Error("checksums.txt is empty");
	const expected = packagedFiles();
	if (records.length !== expected.length)
		throw new Error("checksums.txt does not cover the packaged file set");
	const seen = new Set();
	for (const line of records) {
		const match = /^([0-9a-f]{64}) {2}([^\\]+)$/.exec(line);
		if (!match) throw new Error(`checksums.txt malformed record: ${line}`);
		const [, digest, rel] = match;
		if (rel === "checksums.txt" || rel.startsWith("/") || rel.includes(".."))
			throw new Error(`checksums.txt disallowed path: ${rel}`);
		if (seen.has(rel)) throw new Error(`checksums.txt duplicate entry: ${rel}`);
		seen.add(rel);
		const actual = createHash("sha256")
			.update(readFileSync(join(dist, rel)))
			.digest("hex");
		if (actual !== digest) throw new Error(`checksums.txt mismatch: ${rel}`);
	}
	if (expected.some((rel) => !seen.has(rel)))
		throw new Error("checksums.txt misses packaged files");
	console.log("verify-release-integrity: checksums and SBOM verified");
} catch (error) {
	console.error(
		`verify-release-integrity: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
}
