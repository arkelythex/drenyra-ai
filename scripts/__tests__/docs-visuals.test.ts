import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(join(tmpdir(), "drenyra-visuals-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function run(script: string, args: string[] = []) {
	return spawnSync(process.execPath, [join(root, script), ...args], {
		cwd: root,
		encoding: "utf8",
	});
}

function fixture(name: string, body: string, theme = "dark") {
	const file = join(scratch, name);
	writeFileSync(
		file,
		`<svg xmlns="http://www.w3.org/2000/svg" data-theme="${theme}"><style>\n:root { --bg: #020617; }\n</style>${body}</svg>`,
	);
	return file;
}

describe("documentation visuals through their public scripts", () => {
	it("generates accessible Light/Dark pairs deterministically", () => {
		const first = run("scripts/docs-visuals/render.mjs");
		expect(first.status).toBe(0);
		expect(first.stderr).toBe("");
		const paths = first.stdout.trim().split("\n").map((line) => {
			expect(line.startsWith("wrote ")).toBe(true);
			return resolve(root, line.slice(6));
		});
		expect(paths.length).toBeGreaterThanOrEqual(4);
		const before = paths.map((file) => readFileSync(file, "utf8"));
		for (let i = 0; i < paths.length; i++) {
			expect(before[i]).toContain('role="img"');
			expect(before[i]).toMatch(/<title\b/);
			expect(before[i]).toMatch(/<desc\b/);
			const counterpart = paths[i].includes(".light.svg")
				? paths[i].replace(".light.svg", ".dark.svg")
				: paths[i].replace(".dark.svg", ".light.svg");
			expect(paths).toContain(counterpart);
		}
		const second = run("scripts/docs-visuals/render.mjs");
		expect(second.status).toBe(0);
		expect(second.stdout).toBe(first.stdout);
		expect(second.stderr).toBe("");
		expect(paths.map((file) => readFileSync(file, "utf8"))).toEqual(before);
	});

	it("normalizes named SVG colors and is idempotent without changing text or geometry", () => {
		const file = fixture("named.svg", '<rect x="12" width="10" fill="black"/><text>Keep this label</text>');
		const first = run("scripts/archify-dreamcoder.mjs", [file]);
		expect(first.status).toBe(0);
		expect(first.stderr).toBe("");
		expect(first.stdout).toContain("Dreamcoder Dark");
		const transformed = readFileSync(file, "utf8");
		expect(transformed).toContain('<rect x="12" width="10" fill="#000000"/>');
		expect(transformed).toContain("<text>Keep this label</text>");
		expect(transformed).toContain("--bg: #000000");
		const second = run("scripts/archify-dreamcoder.mjs", [file]);
		expect(second.status).toBe(0);
		expect(second.stderr).toBe("");
		expect(second.stdout).toBe(`= ${file} (Dreamcoder Dark)\n`);
		expect(readFileSync(file, "utf8")).toBe(transformed);
	});

	it("rejects an unknown color without overwriting the source file", () => {
		const file = fixture("invalid.svg", '<rect fill="#123456"/>');
		const before = readFileSync(file, "utf8");
		const result = run("scripts/archify-dreamcoder.mjs", [file]);
		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toBe(`archify-dreamcoder: ${file}: non-canonical color(s) remain: #123456, attribute value #123456\n`);
		expect(readFileSync(file, "utf8")).toBe(before);
	});
});
