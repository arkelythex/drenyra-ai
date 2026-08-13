#!/usr/bin/env node
/**
 * Release integrity — verify dist/checksums.txt self-consistency and SBOM
 * fidelity to the Bun-lockfile-resolved required-runtime graph. Consistency
 * evidence, not authenticity: checksums detect mismatch, not signatures.
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRuntimeGraph } from "./lib/bun-lockfile.mjs";

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
	const { root: meta, direct, nodes } = resolveRuntimeGraph(root);
	const sbom = JSON.parse(readFileSync(join(dist, "sbom.json"), "utf8"));
	if (
		sbom.bomFormat !== "CycloneDX" ||
		sbom.specVersion !== "1.5" ||
		!Array.isArray(sbom.components)
	)
		throw new Error("sbom.json must be CycloneDX 1.5 with a components array");
	if (sbom.metadata?.component?.name !== meta.name || sbom.metadata?.component?.version !== meta.version || sbom.metadata?.component?.["bom-ref"] !== meta.name)
		throw new Error(`sbom.json root metadata mismatch: ${meta.name}`);
	const byName = new Map();
	for (const component of sbom.components) {
		if (typeof component?.name !== "string")
			throw new Error("sbom.json has a component without a name");
		if (byName.has(component.name))
			throw new Error(`sbom.json duplicate component: ${component.name}`);
		byName.set(component.name, component);
	}
	const expectedNodes = new Map(nodes.map((node) => [node.name, node]));
	const missing = [...expectedNodes.keys()].filter((name) => !byName.has(name));
	const extra = [...byName.keys()].filter((name) => !expectedNodes.has(name));
	if (missing.length || extra.length) throw new Error(`sbom.json component drift: missing ${missing.join(",")} extra ${extra.join(",")}`);
	for (const node of nodes) {
		const component = byName.get(node.name);
		if (component?.type !== "library" || component.version !== node.version || component.scope !== "required" || component["bom-ref"] !== node.name)
			throw new Error(`sbom.json component mismatch: ${node.name} expected ${node.version}`);
		const props = (component.properties ?? []).filter((p) => p?.name === "drenyra:resolution");
		if (props.length !== 1 || props[0].value !== (node.direct ? "direct" : "transitive"))
			throw new Error(`sbom.json classification mismatch: ${node.name}`);
	}
	const deps = new Map();
	for (const entry of sbom.dependencies ?? []) {
		if (typeof entry?.ref !== "string" || !Array.isArray(entry.dependsOn))
			throw new Error("sbom.json has a malformed dependency entry");
		if (deps.has(entry.ref)) throw new Error(`sbom.json duplicate dependency ref: ${entry.ref}`);
		const sorted = [...entry.dependsOn].sort();
		for (let i = 1; i < sorted.length; i++)
			if (sorted[i] === sorted[i - 1]) throw new Error(`sbom.json duplicate edge: ${entry.ref}`);
		deps.set(entry.ref, sorted);
	}
	const expectedDeps = [{ ref: meta.name, dependsOn: direct }, ...nodes.map((node) => ({ ref: node.name, dependsOn: node.dependsOn }))];
	if (deps.size !== expectedDeps.length) throw new Error(`sbom.json dependency drift: ${deps.size} entries, expected ${expectedDeps.length}`);
	for (const entry of expectedDeps) {
		const actual = deps.get(entry.ref);
		if (!actual || JSON.stringify(actual) !== JSON.stringify(entry.dependsOn))
			throw new Error(`sbom.json dependency drift: ${entry.ref}`);
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
