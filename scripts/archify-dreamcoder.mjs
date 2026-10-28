#!/usr/bin/env node
/**
 * Archify -> Dreamcoder re-theme post-processor (brand-system v0.4).
 *
 * Why this exists: Archify has no custom-palette option. Every exported SVG
 * ships the same slate palette in both themes, plus one custom-property block
 * per preset x theme. The brand-system contract (contracts/brand-system.md,
 * v0.4) requires Dreamcoder Light and Dreamcoder Dark tokens, enforced with
 * zero tolerance by scripts/brand-conformance.mjs. This script bridges the two:
 * it rewrites only the colors of the inline SVG views. The `.json` spec and the
 * `.html` artifact next to them stay exactly as Archify produced them;
 * fonts, geometry, and text are never touched.
 *
 * What it does, per file (the theme comes from the root `data-theme`):
 *   1. Replaces EVERY preset/theme custom-property block with ONE Dreamcoder
 *      block (`:root, svg`), so the variables apply regardless of preset.
 *   2. Turns translucent family fills into the accent color plus a
 *      `fill-opacity` property: opacity is the only free parameter, so the
 *      palette stays canonical (no rgba() literals).
 *   3. Maps leftover rgb()/rgba() literals and legacy slate hex values in
 *      CSS rules to the Dreamcoder equivalent.
 *   4. Fails loudly (exit 1, offending value printed, file left untouched) if
 *      any color outside contracts/brand-system/tokens.json remains.
 *
 * Idempotent: running it twice yields identical bytes.
 *
 * Re-run after a fresh Archify export:
 *   node scripts/archify-dreamcoder.mjs docs/diagrams/*.svg
 *   node scripts/brand-conformance.mjs docs/diagrams/*.svg
 *
 * Zero dependencies (node:fs, node:path, node:url).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TOKENS_PATH = join(ROOT, "contracts", "brand-system", "tokens.json");

/** Dreamcoder palette per theme: every value must exist in tokens.json. */
const PALETTE = {
	light: {
		name: "Dreamcoder Light",
		vars: {
			bg: "#f3eadc",
			grid: "#e6d7c4",
			text: "#17120d",
			"text-muted": "#554638",
			"text-dim": "#725e4c",
			"text-faint": "#725e4c",
			panel: "#fff7ea",
			"panel-border": "#8a7358",
			"lane-fill": "#e6d7c4",
			"lane-stroke": "#8a7358",
			arrow: "#8a7358",
			"arrow-emphasis": "#824f16",
			mask: "#fff7ea",
			"frontend-fill": "#0d4a68",
			"frontend-stroke": "#0d4a68",
			"backend-fill": "#315b31",
			"backend-stroke": "#315b31",
			"database-fill": "#57478b",
			"database-stroke": "#57478b",
			"cloud-fill": "#824f16",
			"cloud-stroke": "#824f16",
			"security-fill": "#a7471c",
			"security-stroke": "#a7471c",
			"messagebus-fill": "#7d3e64",
			"messagebus-stroke": "#7d3e64",
			"external-fill": "#725e4c",
			"external-stroke": "#725e4c",
			"toolbar-bg": "#fff7ea",
			"toolbar-border": "#8a7358",
			"toolbar-text": "#17120d",
			"toolbar-hover": "#decbb1",
			"toolbar-menu-bg": "#fff7ea",
		},
		// Tint strength of each translucent fill (accent color over --mask).
		fillOpacity: {
			frontend: 0.1,
			backend: 0.1,
			database: 0.1,
			cloud: 0.1,
			security: 0.1,
			messagebus: 0.1,
			external: 0.1,
			lane: 0.55,
		},
		// Direct values for rgb()/rgba() literals found in CSS rules.
		rgb: {
			"255,255,255": "#ffffff",
			"203,213,225": "#e6d7c4",
			"71,85,105": "#725e4c",
			"251,191,36": "#824f16",
		},
		// Archify "classic" light slate -> Dreamcoder role (leftover hex in rules).
		legacy: {
			"#f8fafc": "#f3eadc",
			"#e2e8f0": "#e6d7c4",
			"#cbd5e1": "#8a7358",
			"#94a3b8": "#8a7358",
			"#64748b": "#554638",
			"#334155": "#17120d",
			"#0f172a": "#17120d",
			"#059669": "#824f16",
			"#0891b2": "#0d4a68",
			"#7c3aed": "#57478b",
			"#d97706": "#824f16",
			"#e11d48": "#a7471c",
			"#ea580c": "#7d3e64",
		},
	},
	dark: {
		name: "Dreamcoder Dark",
		vars: {
			bg: "#000000",
			grid: "#1f1f1f",
			text: "#e6e6e6",
			"text-muted": "#c7c7c7",
			"text-dim": "#a7a7a7",
			"text-faint": "#a7a7a7",
			panel: "#0b0b0b",
			"panel-border": "#2e2e2e",
			"lane-fill": "#1f1f1f",
			"lane-stroke": "#3a3a3a",
			arrow: "#6b6b6b",
			"arrow-emphasis": "#a5b4fc",
			mask: "#0b0b0b",
			"frontend-fill": "#7dd3fc",
			"frontend-stroke": "#7dd3fc",
			"backend-fill": "#34d399",
			"backend-stroke": "#34d399",
			"database-fill": "#d4b5fd",
			"database-stroke": "#d4b5fd",
			"cloud-fill": "#a5b4fc",
			"cloud-stroke": "#a5b4fc",
			"security-fill": "#fb8585",
			"security-stroke": "#fb8585",
			"messagebus-fill": "#fbbf24",
			"messagebus-stroke": "#fbbf24",
			"external-fill": "#a7a7a7",
			"external-stroke": "#a7a7a7",
			"toolbar-bg": "#0b0b0b",
			"toolbar-border": "#2e2e2e",
			"toolbar-text": "#e6e6e6",
			"toolbar-hover": "#1f1f1f",
			"toolbar-menu-bg": "#0b0b0b",
		},
		fillOpacity: {
			frontend: 0.14,
			backend: 0.14,
			database: 0.14,
			cloud: 0.14,
			security: 0.14,
			messagebus: 0.14,
			external: 0.14,
			lane: 0.6,
		},
		rgb: {
			"255,255,255": "#ffffff",
			"203,213,225": "#2e2e2e",
			"71,85,105": "#a7a7a7",
			"251,191,36": "#a5b4fc",
		},
		legacy: {
			"#020617": "#000000",
			"#0f172a": "#0b0b0b",
			"#1e293b": "#1f1f1f",
			"#334155": "#2e2e2e",
			"#475569": "#a7a7a7",
			"#64748b": "#6b6b6b",
			"#7d8da1": "#a7a7a7",
			"#94a3b8": "#c7c7c7",
			"#e2e8f0": "#e6e6e6",
			"#22d3ee": "#7dd3fc",
			"#34d399": "#34d399",
			"#a78bfa": "#d4b5fd",
			// Amber is already canonical and is also emitted by --messagebus-fill.
			// Re-mapping it would change the second run's output.
			"#fbbf24": "#fbbf24",
			"#fb7185": "#fb8585",
			"#fb923c": "#fbbf24",
		},
	},
};

const HEX_RE = /^#[0-9a-f]{6}$/i;
const BASE64_RE = /base64,[A-Za-z0-9+/=]{16,}/g;
// Any line that declares the full Archify variable set (all presets/themes,
// including the prefers-color-scheme fallback and a previous run's output).
const VAR_BLOCK_RE =
	/^(?:\/\* dreamcoder-palette[^*]*\*\/ )?(?:@media[^{]*\{\s*)?[^{]*\{\s*--bg:/;
const FAMILY_RULE_RE = /^\.c-([a-z]+) \{ fill: var\(--\1-fill\);/;
const LANE_RULE_RE = /^\.c-lane \{ fill: var\(--lane-fill\);/;
const RGB_RULE_RE =
	/\b(fill|stroke): rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/g;
const HEX_COLOR_RE =
	/(?<!url\()(?<!href=")(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const NON_HEX_COLOR_RE = /\b(?:rgba?|hsla?)\(/g;
const COLOR_ATTR_RE =
	/\b(?:fill|stroke|stop-color|color)\s*=\s*"([^"]*)"|\b(?:fill|stroke|stop-color|color)\s*=\s*'([^']*)'/g;
const STRUCTURAL_RE = /^(none|currentColor|inherit|url\(#[^)]*\))$/i;

function fail(message) {
	console.error(`archify-dreamcoder: ${message}`);
	process.exit(1);
}

/** Canonical set = tokens.json themes + accents + #ffffff + #000000. */
function loadCanonical() {
	let tokens;
	try {
		tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
	} catch (err) {
		fail(`cannot read ${TOKENS_PATH}: ${err.message}`);
	}
	const canonical = new Set(["#ffffff", "#000000"]);
	const collect = (obj) => {
		for (const v of Object.values(obj ?? {})) {
			if (typeof v === "string" && HEX_RE.test(v)) canonical.add(v.toLowerCase());
		}
	};
	collect(tokens.themes?.light);
	collect(tokens.themes?.dark);
	collect(tokens.accents?.cocoa);
	collect(tokens.accents?.terracotta);
	return { canonical, version: tokens.version };
}

const { canonical, version: BRAND_VERSION } = loadCanonical();

function assertPaletteIsCanonical() {
	for (const [theme, def] of Object.entries(PALETTE)) {
		const values = [
			...Object.values(def.vars),
			...Object.values(def.rgb),
			...Object.values(def.legacy),
		];
		for (const hex of values) {
			if (!canonical.has(hex)) {
				fail(`palette ${theme}: ${hex} is not in contracts/brand-system/tokens.json`);
			}
		}
	}
}

function varBlock(theme) {
	const def = PALETTE[theme];
	const decls = Object.entries(def.vars)
		.map(([name, hex]) => `--${name}: ${hex};`)
		.join(" ");
	return `/* dreamcoder-palette: ${def.name} (brand-system v${BRAND_VERSION}) via scripts/archify-dreamcoder.mjs */ :root, svg { ${decls} }`;
}

function withFillOpacity(line, opacity) {
	if (line.includes("fill-opacity")) return line;
	return line.replace(/(fill: var\(--[a-z-]+\);)/, `$1 fill-opacity: ${opacity};`);
}

function rgbToHexLiteral(theme, prop, r, g, b, a) {
	const hex = PALETTE[theme].rgb[`${r},${g},${b}`];
	if (!hex) return null;
	if (a === undefined || Number(a) >= 1) return `${prop}: ${hex}`;
	return `${prop}: ${hex}; ${prop}-opacity: ${a}`;
}

function transformLine(theme, line) {
	let out = line.replace(
		/\b(fill|stroke|stop-color|color)=(['"])(black|white)\2/g,
		(_, property, quote, color) =>
			`${property}=${quote}${color === "black" ? "#000000" : "#ffffff"}${quote}`,
	);
	const family = out.match(FAMILY_RULE_RE);
	if (family && family[1] in PALETTE[theme].fillOpacity) {
		out = withFillOpacity(out, PALETTE[theme].fillOpacity[family[1]]);
	} else if (LANE_RULE_RE.test(out)) {
		out = withFillOpacity(out, PALETTE[theme].fillOpacity.lane);
	}
	out = out.replace(RGB_RULE_RE, (whole, prop, r, g, b, a) => {
		return rgbToHexLiteral(theme, prop, r, g, b, a) ?? whole;
	});
	out = out.replace(HEX_COLOR_RE, (hex) => {
		const lower = hex.toLowerCase();
		return PALETTE[theme].legacy[lower] ?? hex;
	});
	// Resolve colors in the pinned view as well as declaring the palette.
	// librsvg and other static renderers do not support CSS custom properties.
	out = out.replace(/var\(--([a-z-]+)\)/g, (reference, role) => {
		return PALETTE[theme].vars[role] ?? reference;
	});
	return out;
}

/** Returns the rewritten source; collects off-palette findings into `problems`. */
function retheme(source, theme, problems) {
	const lines = source.split("\n");
	const out = [];
	let blockEmitted = false;
	for (const line of lines) {
		if (line.includes("base64,")) {
			out.push(line);
			continue;
		}
		if (VAR_BLOCK_RE.test(line)) {
			if (!blockEmitted) {
				out.push(varBlock(theme));
				blockEmitted = true;
			}
			continue;
		}
		out.push(transformLine(theme, line));
	}
	if (!blockEmitted) problems.push("no Archify custom-property block found");
	const result = out.join("\n");
	verify(result, problems);
	return result;
}

/** Zero tolerance: every color left in the file must be canonical. */
function verify(source, problems) {
	const text = source.replace(BASE64_RE, "base64,");
	for (const m of text.matchAll(HEX_COLOR_RE)) {
		if (!canonical.has(m[0].toLowerCase())) problems.push(m[0]);
	}
	for (const m of text.matchAll(NON_HEX_COLOR_RE)) {
		problems.push(`${m[0]}...) literal`);
	}
	for (const m of text.matchAll(COLOR_ATTR_RE)) {
		const value = (m[1] ?? m[2]).trim();
		if (STRUCTURAL_RE.test(value)) continue;
		if (HEX_RE.test(value) && canonical.has(value.toLowerCase())) continue;
		problems.push(`attribute value ${value}`);
	}
}

function themeOf(source) {
	const root = source.match(/<svg\b[^>]*>/);
	const theme = root?.[0].match(/\bdata-theme="(light|dark)"/)?.[1];
	return theme ?? null;
}

function processFile(file) {
	const source = readFileSync(file, "utf8");
	const theme = themeOf(source);
	if (!theme) fail(`${file}: root <svg> has no data-theme="light|dark"`);
	const problems = [];
	const result = retheme(source, theme, problems);
	if (problems.length > 0) {
		const unique = [...new Set(problems)];
		fail(`${file}: non-canonical color(s) remain: ${unique.join(", ")}`);
	}
	if (result !== source) writeFileSync(file, result);
	process.stdout.write(
		`${result === source ? "=" : "~"} ${file} (${PALETTE[theme].name})\n`,
	);
}

const files = process.argv.slice(2);
if (files.length === 0) {
	fail("usage: node scripts/archify-dreamcoder.mjs <file.svg>...");
}
assertPaletteIsCanonical();
for (const file of files) processFile(file);
