/**
 * Release-integrity evidence (strict TDD): run the three real scripts against a
 * temporary mini-repo from a non-repository cwd; pin determinism, cwd
 * independence, ordering/self-exclusion, fail-closed errors, and verification.
 */
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_DIR = fileURLToPath(new URL("..", import.meta.url));
const SCRIPTS = ["sbom.mjs", "checksums.mjs", "verify-release-integrity.mjs"];
const DEPS = { ajv: "^8.17.1", pg: "^8.13.1" };
const roots: string[] = [];
afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.length = 0;
});

function fixture(deps: Record<string, string> = DEPS): string {
	const root = mkdtempSync(join(tmpdir(), "release-int-"));
	roots.push(root);
	mkdirSync(join(root, "scripts"));
	mkdirSync(join(root, "dist", "lib"), { recursive: true });
	for (const name of SCRIPTS)
		if (existsSync(join(SCRIPT_DIR, name)))
			copyFileSync(join(SCRIPT_DIR, name), join(root, "scripts", name));
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({
			name: "fixture-pkg",
			version: "1.2.3",
			dependencies: deps,
		}),
	);
	writeFileSync(join(root, "dist", "index.js"), "export const x = 1;\n");
	writeFileSync(join(root, "dist", "lib", "util.js"), "export const y = 2;\n");
	return root;
}

function run(root: string, script: string) {
	const cwd = mkdtempSync(join(tmpdir(), "release-int-cwd-"));
	const result = spawnSync(process.execPath, [join(root, "scripts", script)], {
		cwd,
		encoding: "utf8",
	});
	rmSync(cwd, { recursive: true, force: true });
	return result;
}

const read = (root: string, file: string) =>
	readFileSync(join(root, "dist", file), "utf8");
const gen = (root: string) => {
	run(root, "sbom.mjs");
	run(root, "checksums.mjs");
};

describe("release-integrity evidence", () => {
	it("generates byte-identical sbom.json across runs without a wall clock", async () => {
		const root = fixture();
		run(root, "sbom.mjs");
		const first = read(root, "sbom.json");
		await new Promise((resolve) => setTimeout(resolve, 25));
		run(root, "sbom.mjs");
		expect(first).toBe(read(root, "sbom.json"));
		expect(first).not.toContain("timestamp");
	});

	it("reads and writes repository dist/ from a non-repository cwd", () => {
		const root = fixture();
		expect(run(root, "sbom.mjs").status).toBe(0);
		expect(read(root, "sbom.json")).toContain('"name": "fixture-pkg"');
		expect(run(root, "checksums.mjs").status).toBe(0);
		expect(read(root, "checksums.txt")).toContain("sbom.json");
	});

	it("fails closed on missing dist/ and malformed package.json", () => {
		const root = fixture();
		rmSync(join(root, "dist"), { recursive: true, force: true });
		const missingDist = run(root, "checksums.mjs");
		expect(missingDist.status).not.toBe(0);
		expect(missingDist.stderr).toMatch(/^checksums:/);
		expect(missingDist.stderr).not.toMatch(/at /);
		writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
		const incomplete = run(root, "sbom.mjs");
		expect(incomplete.status).not.toBe(0);
		expect(incomplete.stderr).toMatch(/^sbom:/);
		writeFileSync(join(root, "package.json"), "{ not json");
		expect(run(root, "sbom.mjs").status).not.toBe(0);
	});

	it("covers sbom.json and excludes checksums.txt on regeneration", () => {
		const root = fixture();
		gen(root);
		const first = read(root, "checksums.txt");
		expect(first).toMatch(/^[0-9a-f]{64} {2}sbom\.json$/m);
		expect(first).not.toMatch(/checksums\.txt/);
		run(root, "checksums.mjs");
		expect(read(root, "checksums.txt")).toBe(first);
	});

	it("verifies valid generated evidence", () => {
		const root = fixture();
		gen(root);
		const result = run(root, "verify-release-integrity.mjs");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("verified");
	});

	it("fails verification on tampered, extra, or absent files", () => {
		const root = fixture();
		gen(root);
		writeFileSync(join(root, "dist", "index.js"), "tampered");
		const tampered = run(root, "verify-release-integrity.mjs");
		expect(tampered.status).not.toBe(0);
		expect(tampered.stderr).toMatch(/index\.js/);
		run(root, "checksums.mjs");
		writeFileSync(join(root, "dist", "extra.js"), "extra");
		expect(run(root, "verify-release-integrity.mjs").status).not.toBe(0);
		run(root, "checksums.mjs");
		rmSync(join(root, "dist", "extra.js"));
		expect(run(root, "verify-release-integrity.mjs").status).not.toBe(0);
	});

	it("fails verification on malformed SBOM or omitted dependency", () => {
		const root = fixture();
		gen(root);
		writeFileSync(join(root, "dist", "sbom.json"), "{}");
		expect(run(root, "verify-release-integrity.mjs").status).not.toBe(0);
		gen(root);
		const sbom = JSON.parse(read(root, "sbom.json")) as {
			components: Array<{ name: string }>;
		};
		sbom.components = sbom.components.filter(
			(component) => component.name !== "pg",
		);
		writeFileSync(join(root, "dist", "sbom.json"), JSON.stringify(sbom));
		const result = run(root, "verify-release-integrity.mjs");
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/pg/);
	});

	it("rejects traversal and duplicate checksum entries", () => {
		const root = fixture();
		gen(root);
		const manifest = read(root, "checksums.txt").trimEnd().split("\n");
		manifest[0] = "0".repeat(64) + "  ../escape.js";
		writeFileSync(
			join(root, "dist", "checksums.txt"),
			manifest.join("\n") + "\n",
		);
		const traversal = run(root, "verify-release-integrity.mjs");
		expect(traversal.status).not.toBe(0);
		expect(traversal.stderr).toMatch(/\.\./);
		run(root, "checksums.mjs");
		const clean = read(root, "checksums.txt").trimEnd().split("\n");
		clean[0] = clean[1];
		writeFileSync(join(root, "dist", "checksums.txt"), clean.join("\n") + "\n");
		expect(run(root, "verify-release-integrity.mjs").status).not.toBe(0);
	});
});
