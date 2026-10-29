/**
 * sync-alert-mirror (odd/tasks/bun-lock-alert-mirror.md, S2-S7): subprocess
 * tests for the bun.lock -> package-lock.json alert mirror. GitHub's
 * dependency graph reads package-lock.json, while CI installs bun.lock; the
 * mirror must describe exactly the tree bun installs, so a Dependabot alert
 * neither misses an installed version nor reports one that is not installed.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../sync-alert-mirror.mjs", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SHA = (c: string) => `sha512-${c.repeat(86)}==`;

const PACKAGE_JSON = {
	name: "fixture-app",
	version: "1.2.3",
	dependencies: { a: "^1.0.0" },
	devDependencies: { d: "^1.0.0" },
};

/** JSONC with trailing commas, as bun writes it. */
const BUN_LOCK = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "fixture-app",
      "dependencies": {
        "a": "^1.0.0",
      },
      "devDependencies": {
        "d": "^1.0.0",
      },
    },
  },
  "packages": {
    "a": ["a@1.0.0", "", { "dependencies": { "b": "^1.0.0" }, "optionalDependencies": { "opt": "^1.0.0", "shared": "^1.0.0" } }, "${SHA("a")}"],

    "b": ["b@1.0.0", "", {}, "${SHA("b")}"],

    "d": ["d@1.0.0", "", { "dependencies": { "@s/x": "^2.0.0", "shared": "^1.0.0" }, "optionalDependencies": { "dopt": "^1.0.0" }, "peerDependencies": { "p": "^1.0.0" }, "optionalPeers": ["p"], "bin": { "d": "bin/d.js" } }, "${SHA("d")}"],

    "dopt": ["dopt@1.0.0", "", {}, "${SHA("e")}"],

    "opt": ["opt@1.0.0", "", { "os": "linux", "cpu": "x64" }, "${SHA("f")}"],

    "shared": ["shared@1.0.0", "", {}, "${SHA("g")}"],

    "@s/x": ["@s/x@2.0.0", "", { "dependencies": { "b": "^2.0.0" } }, "${SHA("h")}"],

    "@s/x/b": ["b@2.0.0", "", {}, "${SHA("i")}"],
  }
}
`;

const roots: string[] = [];
afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.length = 0;
});

function fixture(bunLock = BUN_LOCK): string {
	const root = mkdtempSync(join(tmpdir(), "alert-mirror-"));
	roots.push(root);
	writeFileSync(join(root, "package.json"), `${JSON.stringify(PACKAGE_JSON, null, 2)}\n`);
	writeFileSync(join(root, "bun.lock"), bunLock);
	return root;
}

function run(root: string, ...args: string[]) {
	const result = spawnSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8" });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

interface LockEntry {
	version?: string;
	resolved?: string;
	integrity?: string;
	dev?: boolean;
	optional?: boolean;
	devOptional?: boolean;
	os?: string[];
	cpu?: string[];
	bin?: Record<string, string>;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	peerDependenciesMeta?: Record<string, { optional: boolean }>;
	name?: string;
	devDependencies?: Record<string, string>;
}

function readMirror(root: string): { lockfileVersion: number; name: string; version: string; packages: Record<string, LockEntry> } {
	return JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
}

function flags(entry: LockEntry): string {
	return ["dev", "optional", "devOptional"].filter((f) => entry[f as keyof LockEntry] === true).join(",") || "-";
}

describe("sync-alert-mirror — generation (S2, S3)", () => {
	it("writes a lockfileVersion 3 mirror with exactly bun's package paths and versions", () => {
		const root = fixture();
		const result = run(root);
		expect(result.status, result.stderr).toBe(0);
		const mirror = readMirror(root);
		expect(mirror.lockfileVersion).toBe(3);
		expect(mirror.name).toBe("fixture-app");
		expect(mirror.version).toBe("1.2.3");
		const versions = Object.fromEntries(
			Object.entries(mirror.packages).filter(([path]) => path !== "").map(([path, entry]) => [path, entry.version]),
		);
		expect(versions).toEqual({
			"node_modules/a": "1.0.0",
			"node_modules/b": "1.0.0",
			"node_modules/d": "1.0.0",
			"node_modules/dopt": "1.0.0",
			"node_modules/opt": "1.0.0",
			"node_modules/shared": "1.0.0",
			"node_modules/@s/x": "2.0.0",
			"node_modules/@s/x/node_modules/b": "2.0.0",
		});
	});

	it("carries the root manifest's dependency ranges", () => {
		const root = fixture();
		run(root);
		const top = readMirror(root).packages[""];
		expect(top).toMatchObject({ name: "fixture-app", version: "1.2.3", dependencies: { a: "^1.0.0" }, devDependencies: { d: "^1.0.0" } });
	});

	it("keeps bun's integrity and derives the registry tarball URL, scoped names included", () => {
		const root = fixture();
		run(root);
		const { packages } = readMirror(root);
		expect(packages["node_modules/a"]).toMatchObject({ resolved: "https://registry.npmjs.org/a/-/a-1.0.0.tgz", integrity: SHA("a") });
		expect(packages["node_modules/@s/x"]).toMatchObject({ resolved: "https://registry.npmjs.org/@s/x/-/x-2.0.0.tgz", integrity: SHA("h") });
		expect(packages["node_modules/@s/x/node_modules/b"]).toMatchObject({ resolved: "https://registry.npmjs.org/b/-/b-2.0.0.tgz", integrity: SHA("i") });
	});

	it("marks dev, optional and devOptional by reachability over the declared edges", () => {
		const root = fixture();
		run(root);
		const { packages } = readMirror(root);
		const actual = Object.fromEntries(Object.entries(packages).filter(([p]) => p !== "").map(([p, e]) => [p, flags(e)]));
		expect(actual).toEqual({
			"node_modules/a": "-",
			"node_modules/b": "-",
			"node_modules/opt": "optional",
			"node_modules/shared": "devOptional",
			"node_modules/d": "dev",
			"node_modules/dopt": "dev,optional",
			"node_modules/@s/x": "dev",
			"node_modules/@s/x/node_modules/b": "dev",
		});
	});

	it("carries os/cpu, bin, dependency ranges and optional-peer metadata", () => {
		const root = fixture();
		run(root);
		const { packages } = readMirror(root);
		expect(packages["node_modules/opt"]).toMatchObject({ os: ["linux"], cpu: ["x64"] });
		expect(packages["node_modules/d"]).toMatchObject({
			bin: { d: "bin/d.js" },
			dependencies: { "@s/x": "^2.0.0", shared: "^1.0.0" },
			optionalDependencies: { dopt: "^1.0.0" },
			peerDependencies: { p: "^1.0.0" },
			peerDependenciesMeta: { p: { optional: true } },
		});
	});
});

describe("sync-alert-mirror — determinism and --check (S4)", () => {
	it("produces byte-identical output on every run, root entry first", () => {
		const root = fixture();
		run(root);
		const first = readFileSync(join(root, "package-lock.json"), "utf8");
		run(root);
		const second = readFileSync(join(root, "package-lock.json"), "utf8");
		expect(second).toBe(first);
		expect(Object.keys(JSON.parse(first).packages)[0]).toBe("");
		expect(first.endsWith("}\n")).toBe(true);
	});

	it("--check exits 0 on a current mirror and writes nothing", () => {
		const root = fixture();
		run(root);
		const before = readFileSync(join(root, "package-lock.json"), "utf8");
		const result = run(root, "--check");
		expect(result.status, result.stderr).toBe(0);
		expect(readFileSync(join(root, "package-lock.json"), "utf8")).toBe(before);
	});

	it("--check exits 1 on a stale mirror, names the fix, and leaves the file unchanged", () => {
		const root = fixture();
		run(root);
		const stale = readFileSync(join(root, "package-lock.json"), "utf8").replace('"version": "2.0.0"', '"version": "2.0.1"');
		writeFileSync(join(root, "package-lock.json"), stale);
		const result = run(root, "--check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("bun run deps:mirror");
		expect(readFileSync(join(root, "package-lock.json"), "utf8")).toBe(stale);
	});

	it("--check exits 1 when the mirror is missing", () => {
		const root = fixture();
		const result = run(root, "--check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("bun run deps:mirror");
	});
});

describe("sync-alert-mirror — fail closed (S5)", () => {
	const nonRegistry: Array<[string, string]> = [
		["a git source", '"b": ["b@github:owner/b#abc123", "", {}, ""]'],
		["a tarball URL source", '"b": ["b@https://example.com/b-1.0.0.tgz", "", {}, ""]'],
		["a file: source", '"b": ["b@file:../b", "", {}, ""]'],
		["a non-empty resolved registry", `"b": ["b@1.0.0", "https://mirror.example.com/", {}, "${SHA("b")}"]`],
	];
	for (const [label, entry] of nonRegistry) {
		it(`refuses ${label} and writes nothing`, () => {
			const lock = BUN_LOCK.replace(/"b": \["b@1\.0\.0", "", \{\}, "[^"]+"\]/, entry);
			const root = fixture(lock);
			writeFileSync(join(root, "package-lock.json"), "previous\n");
			const result = run(root);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toMatch(/cannot mirror/i);
			expect(readFileSync(join(root, "package-lock.json"), "utf8")).toBe("previous\n");
		});
	}

	it("refuses a missing bun.lock", () => {
		const root = fixture();
		rmSync(join(root, "bun.lock"));
		const result = run(root);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/bun\.lock/);
	});

	it("refuses a package that nothing in the tree reaches", () => {
		const lock = BUN_LOCK.replace('"b": ["b@1.0.0"', '"orphan": ["orphan@1.0.0", "", {}, "' + SHA("o") + '"],\n\n    "b": ["b@1.0.0"');
		const root = fixture(lock);
		mkdirSync(join(root, "x"));
		const result = run(root);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("orphan");
	});
});

/** A minimal ustar archive holding `package/package.json`, gzipped. */
function tarball(manifest: Record<string, unknown>): Buffer {
	const body = Buffer.from(JSON.stringify(manifest));
	const header = Buffer.alloc(512, 0);
	header.write("package/package.json", 0, "utf8");
	header.write("0000644\0", 100, "ascii");
	header.write("0000000\0", 108, "ascii");
	header.write("0000000\0", 116, "ascii");
	header.write(`${body.length.toString(8).padStart(11, "0")}\0`, 124, "ascii");
	header.write("00000000000\0", 136, "ascii");
	header.write("0", 156, "ascii");
	header.write("ustar\0", 257, "ascii");
	header.write("00", 263, "ascii");
	header.fill(" ", 148, 156);
	let sum = 0;
	for (const byte of header) sum += byte;
	header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
	const padded = Buffer.alloc(Math.ceil(body.length / 512) * 512, 0);
	body.copy(padded);
	return gzipSync(Buffer.concat([header, padded, Buffer.alloc(1024, 0)]));
}

const integrityOf = (bytes: Buffer) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;

/** Root depends on a vendored tarball whose own dependency comes from the registry. */
function tarballFixture(options: { integrity?: string; writeTarball?: boolean } = {}): string {
	const bytes = tarball({ name: "vendored-rt", version: "0.8.0", dependencies: { b: "^1.0.0" } });
	const integrity = options.integrity ?? integrityOf(bytes);
	const lock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "fixture-app",
      "dependencies": {
        "vendored-rt": "file:./vendored/vendored-rt-0.8.0.tgz",
      },
    },
  },
  "packages": {
    "vendored-rt": ["vendored-rt@./vendored/vendored-rt-0.8.0.tgz", { "dependencies": { "b": "^1.0.0" }, "bin": { "vendored-rt": "./dist/cli.js" } }, "${integrity}"],

    "b": ["b@1.0.0", "", {}, "${SHA("b")}"],
  }
}
`;
	const root = mkdtempSync(join(tmpdir(), "alert-mirror-tgz-"));
	roots.push(root);
	writeFileSync(
		join(root, "package.json"),
		`${JSON.stringify({ name: "fixture-app", version: "1.0.0", dependencies: { "vendored-rt": "file:./vendored/vendored-rt-0.8.0.tgz" } }, null, 2)}\n`,
	);
	writeFileSync(join(root, "bun.lock"), lock);
	mkdirSync(join(root, "vendored"));
	if (options.writeTarball !== false) writeFileSync(join(root, "vendored", "vendored-rt-0.8.0.tgz"), bytes);
	return root;
}

describe("sync-alert-mirror — local tarball dependencies (S8)", () => {
	it("mirrors a vendored tarball with its version read from the archive and a file: resolution", () => {
		const root = tarballFixture();
		const result = run(root);
		expect(result.status, result.stderr).toBe(0);
		const { packages } = readMirror(root);
		const bytes = readFileSync(join(root, "vendored", "vendored-rt-0.8.0.tgz"));
		expect(packages["node_modules/vendored-rt"]).toEqual({
			version: "0.8.0",
			resolved: "file:vendored/vendored-rt-0.8.0.tgz",
			integrity: integrityOf(bytes),
			dependencies: { b: "^1.0.0" },
			bin: { "vendored-rt": "./dist/cli.js" },
		});
		expect(packages["node_modules/b"]).toMatchObject({ version: "1.0.0" });
		expect(flags(packages["node_modules/b"])).toBe("-");
	});

	it("refuses a tarball whose bytes do not match bun.lock's integrity, and writes nothing", () => {
		const root = tarballFixture({ integrity: SHA("z") });
		writeFileSync(join(root, "package-lock.json"), "previous\n");
		const result = run(root);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/cannot mirror.*integrity/i);
		expect(readFileSync(join(root, "package-lock.json"), "utf8")).toBe("previous\n");
	});

	it("refuses a missing tarball", () => {
		const root = tarballFixture({ writeTarball: false });
		const result = run(root);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/cannot mirror.*vendored-rt-0\.8\.0\.tgz/i);
	});
});

describe("sync-alert-mirror — this repository (S7)", () => {
	it("the committed package-lock.json mirrors bun.lock", () => {
		const result = spawnSync(process.execPath, [SCRIPT, "--root", REPO_ROOT, "--check"], { encoding: "utf8" });
		expect(result.status, result.stderr).toBe(0);
	});
});
