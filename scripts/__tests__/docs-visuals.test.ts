import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

});
