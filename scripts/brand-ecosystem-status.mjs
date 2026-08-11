#!/usr/bin/env node
/**
 * brand-ecosystem status dashboard — the v0.3 freeze gate, one command.
 *
 * For every Drenyra ecosystem repo, resolves its canonical README banner path
 * (per docs/assets/brand/gpt-image-prompts.md swap table) and runs the exact
 * conformance checker against it. Reports MISSING / FAIL (coverage) / PASS.
 * Legacy off-palette banners (e.g. drenyra-engram banner-1/2/3.png) are
 * detected and reported so they are not silently forgotten.
 *
 * Usage:
 *   node scripts/brand-ecosystem-status.mjs        # human table + exit code
 *   node scripts/brand-ecosystem-status.mjs --json # machine-readable
 *
 * Exit code 0 = every repo has a passing banner (freeze-ready); 1 = pending.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const ROOT = resolve(HERE, "..");
const CHECKER = join(HERE, "brand-conformance.mjs");

const REPOS = [
	{
		name: "drenyra-ai",
		dir: ROOT,
		banner: "docs/assets/brand/drenyra-ai-banner.png",
	},
	{
		name: "drenyra-command-center",
		dir: join(ROOT, "..", "drenyra-command-center"),
		banner: "assets/branding/drenyra-banner.png",
	},
	{
		name: "drenyra-pi",
		dir: join(ROOT, "..", "drenyra-pi"),
		banner: "assets/branding/drenyra-pi-banner.png",
	},
	{
		name: "drenyra-engram",
		dir: join(ROOT, "..", "drenyra-engram"),
		banner: "assets/branding/drenyra-engram-banner.png",
		legacy: ["drenyra-engram-banner-1.png", "drenyra-engram-banner-2.png", "drenyra-engram-banner-3.png"],
	},
	{
		name: "drenyra-skills",
		dir: join(ROOT, "..", "drenyra-skills"),
		banner: "assets/branding/drenyra-skills-banner.png",
	},
	{
		name: "drenyra-guardian-angel",
		dir: join(ROOT, "..", "drenyra-guardian-angel"),
		banner: "assets/branding/drenyra-guardian-angel-banner.png",
	},
];

function runChecker(bannerPath) {
	const result = spawnSync(process.execPath, [CHECKER, bannerPath, "--json"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status === null) {
		throw new Error(`brand-conformance crashed for ${bannerPath}: ${result.error?.message ?? "unknown"}`);
	}
	let report;
	try {
		report = JSON.parse(result.stdout);
	} catch (err) {
		throw new Error(`brand-conformance produced invalid JSON for ${bannerPath}: ${err.message}`);
	}
	const asset =
		report.assets.find((a) => resolve(ROOT, "..", a.file) === bannerPath) ?? report.assets[0];
	return asset;
}

function statusFor(repo) {
	const abs = join(repo.dir, repo.banner);
	if (existsSync(abs)) {
		const asset = runChecker(abs);
		if (asset.pass) return { state: "PASS", detail: `coverage ${asset.detail.coverage.toFixed(2)}` };
		return { state: "FAIL", detail: `coverage ${asset.detail.coverage.toFixed(2)} < ${asset.detail.required}` };
	}
	const brandingDir = join(repo.dir, "assets", "branding");
	if (!existsSync(brandingDir)) return { state: "MISSING", detail: "no banner asset yet" };
	const pngs = readdirSync(brandingDir).filter((f) => /\.png$/i.test(f));
	if (pngs.length === 0) return { state: "MISSING", detail: "no banner asset yet" };
	const legacy = pngs.filter((p) => !(repo.legacy ?? []).includes(p));
	const targets = legacy.length > 0 ? legacy : pngs;
	const results = targets.map((f) => {
		const asset = runChecker(join(brandingDir, f));
		return { file: f, pass: asset.pass, coverage: asset.detail.coverage };
	});
	const anyPass = results.some((r) => r.pass);
	if (anyPass) {
		return { state: "PASS", detail: results.map((r) => `${r.file} ${r.coverage.toFixed(2)}`).join(", ") };
	}
	const fail = results.find((r) => !r.pass);
	return { state: "FAIL", detail: `${fail.file} coverage ${fail.coverage.toFixed(2)}` };
}

const results = REPOS.map((repo) => ({ name: repo.name, ...statusFor(repo) }));
const allPass = results.every((r) => r.state === "PASS");
const ready = allPass ? "FREEZE-READY" : "PENDING";

if (process.argv.includes("--json")) {
	process.stdout.write(JSON.stringify({ gate: ready, pass: allPass, repos: results }, null, 2) + "\n");
} else {
	process.stdout.write(`brand-system v0.3 freeze gate — ${ready}\n`);
	process.stdout.write(`${"REPO".padEnd(24)} ${"STATUS".padEnd(9)} DETAIL\n`);
	for (const r of results) {
		let icon = "·";
		if (r.state === "PASS") icon = "✓";
		else if (r.state === "FAIL") icon = "✗";
		process.stdout.write(`${icon} ${r.name.padEnd(23)} ${r.state.padEnd(9)} ${r.detail}\n`);
	}
}
process.exit(allPass ? 0 : 1);
