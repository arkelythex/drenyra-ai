/**
 * Release hygiene (#126): a release build starts from an empty dist/.
 *
 * `npm pack` ships whatever is in dist/. `verify:package` (run by `prepack`)
 * builds with `--clean`, so every stale file — an old tarball, a directory
 * whose source was renamed — is removed before the release outputs are
 * generated. The plain build stays additive on purpose: npm runs `prepare`
 * (a plain build) AFTER `prepack`, and a clean there would delete the
 * `release:generate` outputs (`promoted-composition.json`, `sbom.json`,
 * `checksums.txt`) that `prepack` just wrote into dist/.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; exit/status codes are JSON integers.
 */
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../build.mjs", import.meta.url));
const REPO_NODE_MODULES = fileURLToPath(new URL("../../node_modules", import.meta.url));

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function build(root: string, ...args: string[]) {
	return spawnSync(process.execPath, [join(root, "scripts", "build.mjs"), ...args], {
		cwd: root,
		encoding: "utf8",
	});
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "build-clean-"));
	roots.push(root);
	mkdirSync(join(root, "scripts"));
	copyFileSync(SCRIPT, join(root, "scripts", "build.mjs"));
	symlinkSync(REPO_NODE_MODULES, join(root, "node_modules"), "dir");
	mkdirSync(join(root, "cmd"));
	writeFileSync(join(root, "cmd", "cli.ts"), "#!/usr/bin/env bun\nexport const ok = true;\n");
	writeFileSync(
		join(root, "tsconfig.build.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ES2022",
				module: "NodeNext",
				moduleResolution: "NodeNext",
				outDir: "dist",
				rootDir: ".",
				strict: true,
				skipLibCheck: true,
				types: [],
			},
			include: ["cmd/**/*.ts"],
		}),
	);
	mkdirSync(join(root, "dist", "tenant"), { recursive: true });
	writeFileSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"), "stale tarball");
	writeFileSync(join(root, "dist", "tenant", "index.js"), "stale module");
	return root;
}

describe("scripts/build.mjs --clean starts from an empty dist/ (#126)", () => {
	it("removes stale files and directories left in dist/ by an earlier build or pack", () => {
		const root = fixture();
		const result = build(root, "--clean");
		expect(result.status, result.stderr).toBe(0);
		expect(existsSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"))).toBe(false);
		expect(existsSync(join(root, "dist", "tenant"))).toBe(false);
	});

	it("keeps existing dist/ files without --clean, so prepare cannot erase prepack outputs", () => {
		const root = fixture();
		writeFileSync(join(root, "dist", "promoted-composition.json"), "{}\n");
		const result = build(root);
		expect(result.status, result.stderr).toBe(0);
		expect(existsSync(join(root, "dist", "promoted-composition.json"))).toBe(true);
	});

	it("still compiles the sources and patches the CLI shebang to node", () => {
		const root = fixture();
		const result = build(root, "--clean");
		expect(result.status, result.stderr).toBe(0);
		const cli = readFileSync(join(root, "dist", "cmd", "cli.js"), "utf8");
		expect(cli.startsWith("#!/usr/bin/env node")).toBe(true);
		expect(result.stdout).toContain("build: done");
	});
});
