#!/usr/bin/env bun
/**
 * skills-conformance — pins the drenyra-skills registry manifest to the shipped
 * runtime registry (slice 3 of drenyra-ecosystem-cleanup).
 *
 * drenyra-skills/skills/registry.json is the AUTHORING source of truth for the
 * skill definitions; drenyra-ai ships BASE_PE_SKILLS (skills/pe.ts) as the
 * standalone runtime copy. This checker fails on ANY drift between the two:
 * ids, versions, jurisdiction, maxAutonomy, normativeSources, inputs, outputs.
 *
 * Usage:
 *   bun run skills:conformance           # human report + exit code
 *   bun run skills:conformance -- --json # machine-readable
 *   bun run skills:conformance -- --manifest <path>  # override manifest path (CI)
 *
 * Exit 0 = no drift (the content repo and the runtime agree), 1 = drift.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_PE_SKILLS } from "../skills/pe.ts";

    const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
    const MANIFEST_PATH = join(
    	ROOT,
    	"..",
    	"drenyra-skills",
    	"skills",
    	"registry.json",
    );
    const args = process.argv.slice(2);
    const manifestFlag = args.indexOf("--manifest");
    const manifestPath =
    	manifestFlag !== -1 && args[manifestFlag + 1]
    		? resolve(args[manifestFlag + 1])
    		: MANIFEST_PATH;
    const jsonFlag = args.includes("--json");

const COMPARE_FIELDS = [
	"version",
	"jurisdiction",
	"maxAutonomy",
	"normativeSources",
	"inputs",
	"outputs",
];

function compare(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

let manifest;
try {
	manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
	console.error(
		`skills-conformance: cannot read ${manifestPath}: ${error.message}`,
	);
	process.exit(1);
}

const problems = [];
const runtimeById = new Map(BASE_PE_SKILLS.map((s) => [s.id, s]));
const manifestById = new Map(manifest.skills.map((s) => [s.id, s]));

for (const id of new Set([...runtimeById.keys(), ...manifestById.keys()])) {
	const runtime = runtimeById.get(id);
	const m = manifestById.get(id);
	if (!m) {
		problems.push(
			`${id}: in runtime BASE_PE_SKILLS but missing from drenyra-skills registry.json`,
		);
		continue;
	}
	if (!runtime) {
		problems.push(
			`${id}: in drenyra-skills registry.json but missing from runtime BASE_PE_SKILLS`,
		);
		continue;
	}
	for (const field of COMPARE_FIELDS) {
		if (!compare(m[field], runtime[field])) {
			problems.push(
				`${id}: ${field} differs — manifest ${JSON.stringify(m[field])} vs runtime ${JSON.stringify(runtime[field])}`,
			);
		}
	}
}

const pass = problems.length === 0;
if (jsonFlag) {
	process.stdout.write(
		`${JSON.stringify({ contract: "skills-registry", manifest: manifestPath, pass, problems }, null, 2)}\n`,
	);
} else {
	process.stdout.write(`skills-registry conformance (manifest → runtime)\n`);
	if (pass) {
		process.stdout.write(
			`✓ ${manifest.skills.length} skill definitions in sync with BASE_PE_SKILLS\n`,
		);
	} else {
		for (const p of problems) process.stdout.write(`✗ ${p}\n`);
	}
	process.stdout.write(pass ? "PASS\n" : "FAIL\n");
}
process.exit(pass ? 0 : 1);
