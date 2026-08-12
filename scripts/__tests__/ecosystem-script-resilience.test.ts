/**
 * Ecosystem-script resilience (strict TDD): subprocess regression suite for the
 * sibling-root precedence contract, truthful missing-sibling diagnostics, and
 * runnable failure continuations, with explicit child envs and isolated fixtures.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { BASE_PE_SKILLS } from "../../skills/pe.js";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BRAND = join(REPO_ROOT, "scripts", "brand-ecosystem-status.mjs");
const SKILLS = join(REPO_ROOT, "scripts", "skills-conformance.mjs");
const SIBLINGS = [
	"drenyra-command-center",
	"drenyra-pi",
	"drenyra-engram",
	"drenyra-skills",
	"drenyra-guardian-angel",
];
const DEFAULT_MANIFEST = (root: string) =>
	join(root, "drenyra-skills", "skills", "registry.json");
const roots: string[] = [];
afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.length = 0;
});
const fixture = () => {
	const root = mkdtempSync(join(tmpdir(), "ecosystem-res-"));
	roots.push(root);
	return root;
};
/** Child env without ambient DRENYRA_ECOSYSTEM_ROOT unless overridden. */
const childEnv = (overrides: Record<string, string> = {}) => {
	const env = { ...process.env };
	delete env.DRENYRA_ECOSYSTEM_ROOT;
	return { ...env, ...overrides };
};
const runNode = (script: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) =>
	spawnSync(process.execPath, [script, ...args], { cwd, env, encoding: "utf8" });
const runBun = (script: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) =>
	spawnSync("bun", ["run", script, ...args], { cwd, env, encoding: "utf8" });
interface RepoReport {
	name: string;
	state: string;
	detail: string;
}
const brand = (args: string[], env: NodeJS.ProcessEnv) => runNode(BRAND, args, env, REPO_ROOT);
const skills = (args: string[], env: NodeJS.ProcessEnv) => runBun(SKILLS, args, env, REPO_ROOT);
const repoState = (json: { repos: RepoReport[] }, name: string): RepoReport => {
	const r = json.repos.find((x) => x.name === name);
	if (!r) throw new Error(`missing repo ${name}`);
	return r;
};
const writeBanner = (root: string, name: string, file: string, rgb: readonly [number, number, number]) => {
	mkdirSync(join(root, name, "assets", "branding"), { recursive: true });
	writeFileSync(join(root, name, "assets", "branding", file), pngBytes(rgb));
};
/** 4x4 solid 8-bit RGB PNG (color type 2, filter 0). */
function pngBytes(rgb: readonly [number, number, number]): Buffer {
	const stride = 13;
	const raw = Buffer.alloc(4 * stride);
	for (let y = 0; y < 4; y++) {
		raw[y * stride] = 0;
		for (let x = 0; x < 4; x++) raw.set(rgb, y * stride + 1 + x * 3);
	}
	const chunk = (type: string, data: Buffer) => {
		const out = Buffer.alloc(12 + data.length);
		out.writeUInt32BE(data.length, 0);
		out.write(type, 4, "ascii");
		data.copy(out, 8);
		out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
		return out;
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(4, 0);
	ihdr.writeUInt32BE(4, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", zlib.deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

describe("brand-ecosystem-status", () => {
	const brandJson = (args: string[], env: NodeJS.ProcessEnv) => {
		const r = brand([...args, "--json"], env);
		return { status: r.status, json: JSON.parse(r.stdout) };
	};
	it("reports absent siblings as SIBLING_MISSING with absolute paths and exits 1", () => {
		const root = fixture();
		const { status, json } = brandJson(["--root", root], childEnv());
		expect(status).toBe(1);
		expect(json.gate).toBe("PENDING");
		for (const name of SIBLINGS) {
			const repo = repoState(json, name);
			expect(repo.state).toBe("SIBLING_MISSING");
			expect(repo.detail).toContain(join(root, name));
			expect(repo.detail).toContain("--root");
		}
		expect(repoState(json, "drenyra-ai").state).not.toBe("SIBLING_MISSING");
	});
	it("keeps MISSING / PASS / FAIL for present siblings; aggregate stays non-zero", () => {
		const root = fixture();
		mkdirSync(join(root, "drenyra-command-center"), { recursive: true });
		writeBanner(root, "drenyra-pi", "drenyra-pi-banner.png", [11, 14, 17]); // palette -> PASS
		writeBanner(root, "drenyra-skills", "drenyra-skills-banner.png", [255, 0, 0]); // off-palette -> FAIL
		const { status, json } = brandJson(["--root", root], childEnv());
		expect(status).toBe(1);
		expect(repoState(json, "drenyra-command-center").state).toBe("MISSING");
		expect(repoState(json, "drenyra-pi").state).toBe("PASS");
		expect(repoState(json, "drenyra-skills").state).toBe("FAIL");
		expect(repoState(json, "drenyra-guardian-angel").state).toBe("SIBLING_MISSING");
	});
});

describe("skills-conformance", () => {
	it("missing manifest fails closed with a runnable continuation (JSON + human)", () => {
		const root = fixture();
		const j = skills(["--root", root, "--json"], childEnv());
		expect(j.status).toBe(1);
		const json = JSON.parse(j.stdout);
		expect(json.contract).toBe("skills-registry");
		expect(json.pass).toBe(false);
		expect(json.manifest).toBe(DEFAULT_MANIFEST(root));
		expect(json.problems.length).toBeGreaterThan(0);
		expect(json.hint).toContain("drenyra-skills");
		expect(json.hint).toContain("--manifest");
		const h = skills(["--root", root], childEnv());
		expect(h.status).toBe(1);
		expect(h.stderr).toContain(DEFAULT_MANIFEST(root));
		expect(h.stderr).toContain("--manifest");
	});
	it("explicit --manifest selects directly; success JSON has no hint", () => {
		const root = fixture();
		const manifest = join(root, "registry.json");
		writeFileSync(manifest, `${JSON.stringify({ skills: BASE_PE_SKILLS }, null, 2)}\n`);
		const r = skills(
			["--manifest", manifest, "--root", fixture(), "--json"],
			childEnv({ DRENYRA_ECOSYSTEM_ROOT: fixture() }),
		);
		expect(r.status).toBe(0);
		const json = JSON.parse(r.stdout);
		expect(json.pass).toBe(true);
		expect(json.manifest).toBe(manifest);
		expect(json.hint).toBeUndefined();
	});
});

describe("default `..` resolution from a miniature repository", () => {
	const mini = () => {
		const base = fixture();
		const repo = join(base, "mini-repo");
		mkdirSync(join(repo, "scripts"), { recursive: true });
		return { base, repo };
	};
	it("brand looks for siblings beside the miniature repository", () => {
		const { base, repo } = mini();
		copyFileSync(BRAND, join(repo, "scripts", "brand-ecosystem-status.mjs"));
		// no banner paths exist, so the checker is never invoked
		const r = runNode(join(repo, "scripts", "brand-ecosystem-status.mjs"), ["--json"], childEnv(), repo);
		expect(r.status).toBe(1);
		const sibling = repoState(JSON.parse(r.stdout), "drenyra-command-center");
		expect(sibling.state).toBe("SIBLING_MISSING");
		expect(sibling.detail).toContain(join(base, "drenyra-command-center"));
	});
	it("skills derives the default manifest beside the miniature repository", () => {
		const { base, repo } = mini();
		mkdirSync(join(repo, "skills"));
		copyFileSync(SKILLS, join(repo, "scripts", "skills-conformance.mjs"));
		writeFileSync(join(repo, "skills", "pe.ts"), "export const BASE_PE_SKILLS = [];\n");
		const r = runBun(join(repo, "scripts", "skills-conformance.mjs"), ["--json"], childEnv(), repo);
		expect(r.status).toBe(1);
		const json = JSON.parse(r.stdout);
		expect(json.pass).toBe(false);
		expect(json.manifest).toBe(join(base, "drenyra-skills", "skills", "registry.json"));
		expect(json.hint).toContain("--manifest");
	});
});

describe("precedence matrix across both scripts", () => {
	it.each([
		["environment root wins over the flag", "env"],
		["whitespace-only environment falls through to the flag", "blank"],
		["flag applies with the environment unset", "unset"],
	] as const)("%s", (_label, mode) => {
		const envRoot = fixture();
		const flagRoot = fixture();
		const env = mode === "unset" ? childEnv() : childEnv({ DRENYRA_ECOSYSTEM_ROOT: mode === "env" ? envRoot : "   " });
		const expected = mode === "env" ? envRoot : flagRoot;
		const b = brand(["--root", flagRoot, "--json"], env);
		expect(b.status).toBe(1);
		expect(repoState(JSON.parse(b.stdout), "drenyra-command-center").detail).toContain(
			join(expected, "drenyra-command-center"),
		);
		const s = skills(["--root", flagRoot, "--json"], env);
		expect(s.status).toBe(1);
		expect(JSON.parse(s.stdout).manifest).toBe(DEFAULT_MANIFEST(expected));
	});
});
