#!/usr/bin/env node
/**
 * docs-visuals renderer.
 *
 * Writes `<name>.light.svg` and `<name>.dark.svg` for every visual definition
 * from ONE template function (the theme palette is passed in). Output is
 * deterministic: re-running produces byte-identical files. Generated SVGs are
 * never hand-edited — change the template or the palette and re-run
 * `bun run docs:visuals`.
 *
 * Palette guard: every hex a palette uses must exist in
 * contracts/brand-system/tokens.json (themes.light, themes.dark,
 * accents.cocoa, accents.terracotta, plus #ffffff/#000000); otherwise nothing
 * is written. `bun run brand:conformance` re-checks the emitted SVGs.
 *
 * Usage:
 *   node scripts/docs-visuals/render.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { palettes } from "./palettes.mjs";
import { banner } from "./visuals/banner.mjs";
import { fiscalLifecycle } from "./visuals/fiscal-lifecycle.mjs";
import { mark } from "./visuals/mark.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOKENS_PATH = join(ROOT, "contracts", "brand-system", "tokens.json");
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Visual definitions: { name, dir, render(palette) -> svg string }. */
const VISUALS = [banner, mark, fiscalLifecycle];

function canonicalHexes() {
	const tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
	const set = new Set(["#ffffff", "#000000"]);
	const collect = (obj) => {
		for (const v of Object.values(obj ?? {})) {
			if (typeof v === "string" && HEX_RE.test(v)) set.add(v.toLowerCase());
		}
	};
	collect(tokens.themes?.light);
	collect(tokens.themes?.dark);
	collect(tokens.accents?.cocoa);
	collect(tokens.accents?.terracotta);
	return set;
}

function assertPalettes(canonical) {
	const problems = [];
	for (const [theme, palette] of Object.entries(palettes)) {
		for (const [role, value] of Object.entries(palette)) {
			if (typeof value !== "string" || !value.startsWith("#")) continue;
			if (!canonical.has(value.toLowerCase())) {
				problems.push(`${theme}.${role} = ${value}`);
			}
		}
	}
	if (problems.length > 0) {
		throw new Error(
			`palette drifted from brand-system tokens: ${problems.join(", ")}`,
		);
	}
}

function main() {
	assertPalettes(canonicalHexes());
	for (const visual of VISUALS) {
		const dir = join(ROOT, visual.dir);
		mkdirSync(dir, { recursive: true });
		for (const theme of ["light", "dark"]) {
			const file = join(dir, `${visual.name}.${theme}.svg`);
			writeFileSync(file, visual.render(palettes[theme]));
			process.stdout.write(`wrote ${file.replace(`${ROOT}/`, "")}\n`);
		}
	}
}

main();
