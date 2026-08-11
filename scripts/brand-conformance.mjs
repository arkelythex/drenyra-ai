#!/usr/bin/env node
/**
 * brand-system conformance checker (contracts/brand-system.md, v0.2 DRAFT).
 *
 * Zero-dependency verifier for the Drenyra ecosystem brand system. The
 * canonical palette mirrors the Drenyra apps/web DTCG token pipeline
 * (tokens.dtcg.json -> generated tokens): class-based .dark/.light themes
 * plus the cyan/violet accent system. No derived tokens are invented — every
 * variant (hover/active/dim, text tiers, states) comes from the source.
 *
 *   1. PALETTE — both themes (dark + light) and both accents must be present
 *      in contracts/brand-system/tokens.json with valid hex values; the
 *      conformance set is the union of themes + accents + #ffffff + #000000.
 *
 *   2. VECTORS (SVG) — zero tolerance: every fill/stroke/stop-color/color
 *      attribute must be in the conformance set or a structural value (none,
 *      currentColor, inherit, url(#...)). Anything else fails closed.
 *
 *   3. RASTER (PNG) — built-in minimal PNG decoder (8-bit RGB/RGBA, filters
 *      0-4, node:zlib) with even-spread sampling; at least coverageRequired
 *      of sampled pixels must fall within tolerancePerChannel of a canonical
 *      color. Reports the dominant off-palette colors for prompt correction.
 *
 * Usage:
 *   node scripts/brand-conformance.mjs                 # scan docs/assets/brand/**
 *   node scripts/brand-conformance.mjs <path>...        # also scan extra files/dirs
 *   node scripts/brand-conformance.mjs --json           # machine-readable report
 *
 * Exit code 0 = conformant, 1 = drift. Same checker runs in CI (job
 * brand-conformance) and must be run by every consuming repo over its own
 * brand assets before the contract can freeze.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TOKENS_PATH = join(ROOT, "contracts", "brand-system", "tokens.json");
const DEFAULT_ASSET_DIR = join(ROOT, "docs", "assets", "brand");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REQUIRED_THEMES = ["dark", "light"];
const REQUIRED_ACCENTS = ["cyan", "violet"];
const REQUIRED_TOKEN_KEYS = [
	"canvas",
	"surface",
	"surface-2",
	"overlay",
	"border-subtle",
	"border-default",
	"text-primary",
	"text-secondary",
	"text-tertiary",
	"text-disabled",
	"state-success",
	"state-warning",
	"state-error",
	"state-pending",
];
const REQUIRED_ACCENT_KEYS = ["base", "hover", "active", "dim"];

function hexToRgb(hex) {
	const h = hex.replace("#", "");
	if (h.length === 3) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
	if (h.length === 6) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
	throw new Error(`invalid hex: ${hex}`);
}

function rgbToHex([r, g, b]) {
	return "#" + [r, g, b].map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0")).join("");
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Load tokens, validate the palette shape, and build the conformance set. */
function loadTokens() {
	let raw;
	try {
		raw = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
	} catch (err) {
		console.error(`brand-system: cannot read ${TOKENS_PATH}: ${err.message}`);
		process.exit(1);
	}
	const problems = [];
	if (raw.version !== "0.2") problems.push(`version must be 0.2, got ${raw.version}`);
	for (const theme of REQUIRED_THEMES) {
		if (!raw.themes?.[theme]) {
			problems.push(`missing theme: ${theme}`);
			continue;
		}
		for (const key of REQUIRED_TOKEN_KEYS) {
			const v = raw.themes[theme][key];
			if (typeof v !== "string" || !HEX_RE.test(v)) {
				problems.push(`theme ${theme}: ${key} must be a #rrggbb hex, got ${v}`);
			}
		}
	}
	for (const accent of REQUIRED_ACCENTS) {
		if (!raw.accents?.[accent]) {
			problems.push(`missing accent: ${accent}`);
			continue;
		}
		for (const key of REQUIRED_ACCENT_KEYS) {
			const v = raw.accents[accent][key];
			if (typeof v !== "string" || !HEX_RE.test(v)) {
				problems.push(`accent ${accent}: ${key} must be a #rrggbb hex, got ${v}`);
			}
		}
	}
	const canonical = new Set();
	const collect = (obj) => {
		for (const v of Object.values(obj)) {
			if (typeof v === "string" && HEX_RE.test(v)) canonical.add(v.toLowerCase());
		}
	};
	collect(raw.themes?.dark ?? {});
	collect(raw.themes?.light ?? {});
	collect(raw.accents?.cyan ?? {});
	collect(raw.accents?.violet ?? {});
	canonical.add("#ffffff");
	canonical.add("#000000");
	return {
		tokens: raw,
		paletteProblems: problems,
		canonical,
		tolerancePerChannel: raw.aiImage.tolerancePerChannel,
		coverageRequired: raw.aiImage.coverageRequired,
	};
}

const STRUCTURAL_SVG = /^(none|currentColor|inherit|url\(#[^)]*\))$/i;
const HEX_VALUE = /^#[0-9a-f]{3,8}$/i;
const ATTR_RE = /(?:fill|stroke|stop-color|color)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const CSS_VAR_RE = /--([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g;
const VAR_REF_RE = /^var\(--([a-zA-Z0-9-]+)\)$/;

/**
 * Collect CSS custom-property declarations (hex values) from <style> blocks,
 * including per-theme overrides inside @media (prefers-color-scheme) blocks.
 * Returns a map of var name -> set of every declared hex (all must be canonical).
 */
function collectCssVars(source) {
	const vars = new Map();
	for (const m of source.matchAll(CSS_VAR_RE)) {
		const name = m[1];
		const hex = m[2].toLowerCase();
		if (!vars.has(name)) vars.set(name, new Set());
		vars.get(name).add(hex);
	}
	return vars;
}

/** Zero-tolerance SVG scan: resolves var() references, returns off-palette values. */
function checkSvg(file) {
	const source = readFileSync(file, "utf8");
	const cssVars = collectCssVars(source);
	const problems = [];
	// Every hex declared in <style> (all themes) must be canonical, whether
	// referenced by an attribute or applied via CSS class (gradient stops).
	for (const [name, declared] of cssVars) {
		for (const hex of declared) {
			if (!tokens.canonical.has(hex)) problems.push(`var(--${name}) -> ${hex}`);
		}
	}
	for (const m of source.matchAll(ATTR_RE)) {
		const attr = (m[2] ?? m[3]).trim();
		if (STRUCTURAL_SVG.test(attr)) continue;
		if (HEX_VALUE.test(attr)) {
			if (!tokens.canonical.has(attr.toLowerCase())) problems.push(attr);
			continue;
		}
		const varMatch = attr.match(VAR_REF_RE);
		if (varMatch) {
			const declared = cssVars.get(varMatch[1]);
			if (!declared) {
				problems.push(`unknown css variable: ${attr}`);
				continue;
			}
			for (const hex of declared) {
				if (!tokens.canonical.has(hex)) problems.push(`${attr} -> ${hex}`);
			}
			continue;
		}
		problems.push(`unverifiable attribute: ${attr}`);
	}
	return { kind: "svg", problems };
}

/**
 * Minimal PNG decoder: 8-bit RGB (color type 2) / RGBA (6), filters 0-4,
 * non-interlaced. Returns flat RGB samples spread evenly across the image.
 */
function decodePngSamples(file, sampleCap = 2000) {
	const buf = readFileSync(file);
	if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not a PNG");
	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	const idat = [];
	while (offset < buf.length) {
		const len = buf.readUInt32BE(offset);
		const type = buf.toString("ascii", offset + 4, offset + 8);
		const data = buf.subarray(offset + 8, offset + 8 + len);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
			if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
				throw new Error(`unsupported PNG encoding (compression ${data[10]}, filter ${data[11]}, interlace ${data[12]})`);
			}
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "IEND") {
			break;
		}
		offset += 12 + len;
	}
	if (!width || !height) throw new Error("PNG missing IHDR");
	if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
		throw new Error(`unsupported PNG format: bitDepth ${bitDepth}, colorType ${colorType}`);
	}
	const channels = colorType === 6 ? 4 : 3;
	const bpp = channels;
	// Evenly-spread sampling grid: representative coverage for wide/tall banners.
	const targetSamples = Math.min(sampleCap, width * height);
	const xSamples = Math.max(1, Math.round(Math.sqrt((targetSamples * width) / height)));
	const ySamples = Math.max(1, Math.round(targetSamples / xSamples));
	const sampledYs = new Set();
	for (let yi = 0; yi < ySamples; yi++) sampledYs.add(Math.min(height - 1, Math.floor((yi * height) / ySamples)));
	const xPositions = [];
	for (let xi = 0; xi < xSamples; xi++) xPositions.push(Math.min(width - 1, Math.floor((xi * width) / xSamples)));
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = width * channels;
	const out = [];
	const prev = new Uint8Array(stride);
	let pos = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[pos++];
		const line = raw.subarray(pos, pos + stride);
		pos += stride;
		const recon = new Uint8Array(stride);
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? recon[x - bpp] : 0;
			const b = prev[x];
			const c = x >= bpp ? prev[x - bpp] : 0;
			let v = line[x];
			if (filter === 1) v = (v + a) & 0xff;
			else if (filter === 2) v = (v + b) & 0xff;
			else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
			else if (filter === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				let predictor = c;
				if (pa <= pb && pa <= pc) predictor = a;
				else if (pb <= pc) predictor = b;
				v = (v + predictor) & 0xff;
			}
			recon[x] = v;
		}
		prev.set(recon);
		if (sampledYs.has(y)) {
			for (const x of xPositions) {
				const i = x * channels;
				out.push([recon[i], recon[i + 1], recon[i + 2]]);
			}
		}
	}
	return out;
}

function inPalette(rgb, tolerance) {
	for (const hex of tokens.canonical) {
		const [r, g, b] = hexToRgb(hex);
		if (
			Math.abs(rgb[0] - r) <= tolerance &&
			Math.abs(rgb[1] - g) <= tolerance &&
			Math.abs(rgb[2] - b) <= tolerance
		) {
			return true;
		}
	}
	return false;
}

/** Raster scan: palette coverage with bounded tolerance. */
function checkPng(file) {
	const samples = decodePngSamples(file);
	const tol = tokens.tolerancePerChannel;
	let inPaletteCount = 0;
	const offPalette = new Map();
	for (const s of samples) {
		if (inPalette(s, tol)) inPaletteCount++;
		else {
			const hex = rgbToHex(s);
			offPalette.set(hex, (offPalette.get(hex) ?? 0) + 1);
		}
	}
	const coverage = inPaletteCount / samples.length;
	const topOff = [...offPalette.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);
	return {
		kind: "png",
		coverage,
		required: tokens.coverageRequired,
		offPalette: topOff.map(([hex, n]) => `${hex} x${n}`),
		pass: coverage >= tokens.coverageRequired,
	};
}

function collectAssets(extraPaths) {
	const files = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const p = join(dir, entry);
			const st = statSync(p);
			if (st.isDirectory()) walk(p);
			else if (/\.(svg|png)$/i.test(p)) files.push(p);
		}
	};
	if (statSync(DEFAULT_ASSET_DIR).isDirectory()) walk(DEFAULT_ASSET_DIR);
	for (const p of extraPaths) {
		const st = statSync(p);
		if (st.isDirectory()) walk(p);
		else if (/\.(svg|png)$/i.test(p)) files.push(resolve(p));
	}
	return [...new Set(files)].sort();
}

function checkAsset(file) {
	if (/\.svg$/i.test(file)) {
		const { problems } = checkSvg(file);
		return { file, pass: problems.length === 0, detail: problems };
	}
	try {
		const result = checkPng(file);
		return { file, pass: result.pass, detail: result };
	} catch (err) {
		return { file, pass: false, detail: [`decode failure: ${err.message}`] };
	}
}

export function runConformance(extraPaths = [], { json = false } = {}) {
	const results = [];
	for (const file of collectAssets(extraPaths)) results.push(checkAsset(file));
	const palettePass = tokens.paletteProblems.length === 0;
	const allPass = palettePass && results.every((r) => r.pass);
	const report = {
		contract: "brand-system",
		version: tokens.tokens.version,
		status: tokens.tokens.status,
		palette: { pass: palettePass, problems: tokens.paletteProblems },
		assets: results.map((r) => ({
			file: r.file.replace(ROOT + "/", ""),
			pass: r.pass,
			detail: r.detail,
		})),
		pass: allPass,
	};
	if (json) {
		process.stdout.write(JSON.stringify(report, null, 2) + "\n");
	} else {
		process.stdout.write(
			`brand-system v${tokens.tokens.version} (${tokens.tokens.status}) conformance\n`,
		);
		process.stdout.write(
			palettePass
				? "✓ palette: dark + light themes, cyan + violet accents, all tokens hex-valid\n"
				: `✗ palette: ${tokens.paletteProblems.join("; ")}\n`,
		);
		for (const r of results) {
			if (r.pass) {
				process.stdout.write(
					`✓ ${r.file.replace(ROOT + "/", "")}${r.detail?.coverage ? ` (coverage ${r.detail.coverage.toFixed(2)})` : ""}\n`,
				);
			} else {
				const detail = Array.isArray(r.detail)
					? r.detail.join("; ")
					: `coverage ${r.detail.coverage.toFixed(2)} < ${r.detail.required} · off-palette: ${r.detail.offPalette.join(", ")}`;
				process.stdout.write(`✗ ${r.file.replace(ROOT + "/", "")} — ${detail}\n`);
			}
		}
		process.stdout.write(allPass ? "PASS\n" : "FAIL\n");
	}
	return allPass;
}

const tokens = loadTokens();

function isMain() {
	return (
		process.argv[1] &&
		import.meta.url === pathToFileURL(resolve(process.argv[1])).href
	);
}

if (isMain()) {
	const argv = process.argv.slice(2);
	const json = argv.includes("--json");
	const extra = argv.filter((a) => a !== "--json");
	const pass = runConformance(extra, { json });
	process.exit(pass ? 0 : 1);
}
