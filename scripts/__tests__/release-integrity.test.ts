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
const LOCK_PACKAGES: Record<string, unknown> = {
	ajv: ["ajv@8.20.0", "", { dependencies: { "fast-deep-equal": "^3.1.3" } }, "sha512-ajv"],
	"fast-deep-equal": ["fast-deep-equal@3.1.3", "", {}, "sha512-fde"],
	pg: ["pg@8.23.0", "", { dependencies: { "pg-types": "2.2.0", pgpass: "1.0.5" }, optionalDependencies: { "pg-cloudflare": "^1.4.0" }, peerDependencies: { "pg-native": ">=3.0.1" }, optionalPeers: ["pg-native"] }, "sha512-pg"],
	"pg-types": ["pg-types@2.2.0", "", {}, "sha512-pgt"],
	pgpass: ["pgpass@1.0.5", "", {}, "sha512-pgp"],
	"pg-cloudflare": ["pg-cloudflare@1.4.0", "", {}, "sha512-pgc"],
	"pg-native": ["pg-native@4.0.2", "", {}, "sha512-pgn"],
	typescript: ["typescript@5.0.0", "", {}, "sha512-ts"],
};
const roots: string[] = [];
afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.length = 0;
});

/** Strict-JSON lock fixture; the real trailing-comma Bun format is covered by the integration evidence runs. */
function buildLock(deps: Record<string, string>, packages: Record<string, unknown>, lockfileVersion = 1): string { return JSON.stringify({ lockfileVersion, workspaces: { "": { dependencies: deps } }, packages }, null, "\t") + "\n"; }

function fixture(deps: Record<string, string> = DEPS, packages: Record<string, unknown> = LOCK_PACKAGES, lockfileVersion = 1): string {
	const root = mkdtempSync(join(tmpdir(), "release-int-"));
	roots.push(root);
	mkdirSync(join(root, "scripts", "lib"), { recursive: true });
	mkdirSync(join(root, "dist", "lib"), { recursive: true });
	for (const name of SCRIPTS)
		if (existsSync(join(SCRIPT_DIR, name)))
			copyFileSync(join(SCRIPT_DIR, name), join(root, "scripts", name));
	const lib = join(SCRIPT_DIR, "lib", "bun-lockfile.mjs");
	copyFileSync(lib, join(root, "scripts", "lib", "bun-lockfile.mjs"));
	writeFileSync(join(root, "bun.lock"), buildLock(deps, packages, lockfileVersion));
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-pkg", version: "1.2.3", dependencies: deps }));
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

describe("resolved SBOM fidelity", () => {
	type Sbom = { components: Array<{ name: string; version: string; scope: string; properties?: Array<{ name: string; value: string }> }>; dependencies: Array<{ ref: string; dependsOn: string[] }> };
	const readSbom = (root: string): Sbom => JSON.parse(read(root, "sbom.json")) as Sbom;

	it("emits exact locked versions, required scope, one direct/transitive property, a closed sorted graph, excluding optional/peer/dev", () => {
		const root = fixture(); run(root, "sbom.mjs");
		const sbom = readSbom(root);
		expect(sbom.components.map((c) => [c.name, c.version, c.scope, c.properties![0].value])).toEqual([
			["ajv", "8.20.0", "required", "direct"],
			["fast-deep-equal", "3.1.3", "required", "transitive"],
			["pg", "8.23.0", "required", "direct"],
			["pg-types", "2.2.0", "required", "transitive"],
			["pgpass", "1.0.5", "required", "transitive"],
		]);
		expect(sbom.dependencies).toEqual([
			{ ref: "fixture-pkg", dependsOn: ["ajv", "pg"] },
			{ ref: "ajv", dependsOn: ["fast-deep-equal"] },
			{ ref: "fast-deep-equal", dependsOn: [] },
			{ ref: "pg", dependsOn: ["pg-types", "pgpass"] },
			{ ref: "pg-types", dependsOn: [] },
			{ ref: "pgpass", dependsOn: [] },
		]);
		for (const c of sbom.components)
			expect(c.properties).toEqual([{ name: "drenyra:resolution", value: c.properties![0].value }]);
		expect(read(root, "sbom.json")).not.toMatch(/pg-cloudflare|pg-native|typescript|\^/);
	});

	it("deduplicates shared transitives in branched and cyclic graphs (optionalPeers as string[], no traversal)", () => {
		const root = fixture({ a: "1.0.0", b: "1.0.0" }, { a: ["a@1.2.3", "", { dependencies: { shared: "5.6.7" }, optionalDependencies: { opt: "9.9.9" }, peerDependencies: { opt: "9.9.9" }, optionalPeers: ["opt"] }], b: ["b@2.3.4", "", { dependencies: { shared: "5.6.7" } }], shared: ["shared@5.6.7", "", {}], opt: ["opt@9.9.9", "", {}] });
		run(root, "sbom.mjs");
		expect(readSbom(root).components.map((c) => [c.name, c.version])).toEqual([["a", "1.2.3"], ["b", "2.3.4"], ["shared", "5.6.7"]]);
		const cyclic = fixture({ a: "1.0.0", b: "1.0.0" }, { a: ["a@1.2.3", "", { dependencies: { b: "1.0.0" } }], b: ["b@2.3.4", "", { dependencies: { a: "1.0.0" } }] });
		run(cyclic, "sbom.mjs");
		expect(readSbom(cyclic).components.map((c) => c.name)).toEqual(["a", "b"]);
	});

	it("fails verification on every SBOM fidelity drift class", () => {
		const root = fixture();
		const drift = (mutate: (sbom: Sbom) => void) => {
			gen(root);
			const sbom = readSbom(root);
			mutate(sbom);
			writeFileSync(join(root, "dist", "sbom.json"), JSON.stringify(sbom));
			const result = run(root, "verify-release-integrity.mjs"); expect(result.status).not.toBe(0); expect(result.stderr).toMatch(/^verify-release-integrity:/);
		};
		drift((g) => g.components.splice(g.components.findIndex((c) => c.name === "pg"), 1));
		drift((g) => g.components.push({ name: "extra-pkg", version: "1.0.0", scope: "required" }));
		drift((g) => (g.components.find((c) => c.name === "ajv")!.version = "9.0.0"));
		drift((g) => (g.components.find((c) => c.name === "pg")!.scope = "optional"));
		drift((g) => (g.components.find((c) => c.name === "pg")!.properties = [{ name: "drenyra:resolution", value: "transitive" }]));
		drift((g) => (g.dependencies.find((d) => d.ref === "pg")!.dependsOn = ["pg-types"]));
		drift((g) => g.dependencies.find((d) => d.ref === "pg")!.dependsOn.push("pg-cloudflare"));
		drift((g) => g.dependencies.find((d) => d.ref === "pg")!.dependsOn.push("pg-types"));
		drift((g) => g.dependencies.push({ ref: "pg", dependsOn: ["pgpass"] }));
		drift((g) => g.components.push({ name: "pg", version: "8.23.0", scope: "required" }));
		writeFileSync(join(root, "dist", "sbom.json"), "{ nope"); expect(run(root, "verify-release-integrity.mjs").status).not.toBe(0);
	});

	it("fails closed on malformed, drifted, or ambiguous lock inputs, naming the input", () => {
		const cases: Array<[string, Record<string, unknown>, number, RegExp]> = [
			["missing record", { ...LOCK_PACKAGES, pgpass: undefined }, 1, /pgpass/],
			["ambiguous records", { ...LOCK_PACKAGES, ajv: [["ajv@8.20.0", "", {}], ["ajv@7.0.0", "", {}]] }, 1, /ajv/],
			["malformed record", { ...LOCK_PACKAGES, ajv: [42, "", {}] }, 1, /ajv/],
			["optionalPeers not string[]", { ...LOCK_PACKAGES, pg: ["pg@8.23.0", "", { dependencies: { "pg-types": "2.2.0" }, optionalPeers: { "pg-native": ">=3.0.1" } }] }, 1, /optionalPeers/],
			["malformed dependency map", { ...LOCK_PACKAGES, pg: ["pg@8.23.0", "", { dependencies: { "pg-types": 42 } }] }, 1, /dependencies/],
			["unsupported lockfileVersion", LOCK_PACKAGES, 2, /lockfileVersion/],
		];
		for (const [label, packages, version, pattern] of cases) {
			const result = run(fixture(DEPS, packages, version), "sbom.mjs");
			expect(result.status, label).not.toBe(0);
			expect(result.stderr, label).toMatch(pattern);
		}
		const gone = fixture();
		rmSync(join(gone, "bun.lock")); expect(run(gone, "sbom.mjs").stderr).toMatch(/bun\.lock/);
		const drifted = fixture();
		writeFileSync(join(drifted, "bun.lock"), buildLock({ ...DEPS, nope: "1.0.0" }, LOCK_PACKAGES));
		expect(run(drifted, "sbom.mjs").stderr).toMatch(/drift/);
	});
});
