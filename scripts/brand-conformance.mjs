#!/usr/bin/env node
/**
 * brand-system conformance checker (contracts/brand-system.md, v0.1 DRAFT).
 *
 * Zero-dependency verifier for the Drenyra ecosystem brand system:
 *
 *   1. DERIVATION — recomputes every derived token from base tokens via
 *      mix(base, target, ratio) with Math.round per channel and fails on any
 *      byte drift vs contracts/brand-system/tokens.json. Hand-edited derived
 *      values are contract violations.
 *
 *   2. VECTORS (SVG) — zero tolerance: every fill/stroke/stop-color/color
 *      attribute must be a canonical color (base + derived + #ffffff +
 *      #000000) or a structural value (none, currentColor, inherit,
 *      url(#...)). Anything else is unverifiable and fails closed.
 *
 *   3. RASTER (PNG) — built-in minimal PNG decoder (8-bit RGB/RGBA, filters
 *      0-4, node:zlib). Samples pixels and requires at least coverageRequired
 *      of sampled pixels to fall within tolerancePerChannel of a canonical
 *      color. Reports the dominant off-palette colors so the asset can be
 *      regenerated with a corrected prompt.
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

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** mix(base, target, ratio) with Math.round per channel. target is a hex string or an RGB array. */
function mix(baseHex, target, ratio) {
	const b = hexToRgb(baseHex);
	const t = Array.isArray(target) ? target : hexToRgb(target);
	const out = b.map((v, i) => Math.round(v + (t[i] - v) * ratio));
	return rgbToHex(out);
}

function hexToRgb(hex) {
	const h = hex.replace("#", "");
	if (h.length === 3) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
	if (h.length === 6)
		return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
	throw new Error(`invalid hex: ${hex}`);
}

function rgbToHex([r, g, b]) {
	return (
		"#" +
		[r, g, b]
			.map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
			.join("")
	);
}

/** Load tokens and verify derived tokens re-derive byte-exact from base. */
function loadTokens() {
	let raw;
	try {
		raw = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
	} catch (err) {
		console.error(`brand-system: cannot read ${TOKENS_PATH}: ${err.message}`);
		process.exit(1);
	}
	const { base, derived } = raw;
	const derivedRules = {
		"primary-light": [base.primary, WHITE, 0.3],
		"primary-dark": [base.primary, BLACK, 0.2],
		"secondary-light": [base.secondary, WHITE, 0.25],
		"success-light": [base.success, WHITE, 0.2],
		"warning-light": [base.warning, WHITE, 0.2],
		"surface-1": [base.background, WHITE, 0.04],
		"surface-2": [base.background, WHITE, 0.08],
		"surface-3": [base.background, WHITE, 0.12],
		"muted-foreground-light": [base["muted-foreground"], WHITE, 0.25],
	};
	const violations = [];
	for (const [name, [baseHex, target, ratio]] of Object.entries(derivedRules)) {
		const computed = mix(baseHex, target, ratio);
		const declared = derived[name];
		if (computed.toLowerCase() !== declared.toLowerCase()) {
			violations.push(`${name}: declared ${declared}, derived ${computed}`);
		}
	}
	const canonical = new Set();
	for (const v of Object.values(base)) canonical.add(v.toLowerCase());
	for (const v of Object.values(derived)) canonical.add(v.toLowerCase());
	canonical.add("#ffffff");
	canonical.add("#000000");
	return {
		tokens: raw,
		derivedViolations: violations,
		canonical,
		tolerancePerChannel: raw.aiImage.tolerancePerChannel,
		coverageRequired: raw.aiImage.coverageRequired,
	};
}

const STRUCTURAL_SVG = /^(none|currentColor|inherit|url\(#[^)]*\))$/i;
const HEX_VALUE = /^#[0-9a-f]{3,8}$/i;
const ATTR_RE =
	/(?:fill|stroke|stop-color|color)\s*=\s*("([^"]*)"|'([^']*)')/gi;

/** Zero-tolerance SVG scan: returns offending/unverifiable attribute values. */
function checkSvg(file) {
	const source = readFileSync(file, "utf8");
	const problems = [];
	for (const m of source.matchAll(ATTR_RE)) {
		const attr = (m[2] ?? m[3]).trim();
		if (STRUCTURAL_SVG.test(attr)) continue;
		if (HEX_VALUE.test(attr)) {
			if (!tokens.canonical.has(attr.toLowerCase())) problems.push(attr);
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
	if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE))
		throw new Error("not a PNG");
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
				throw new Error(
					`unsupported PNG encoding (compression ${data[10]}, filter ${data[11]}, interlace ${data[12]})`,
				);
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
		throw new Error(
			`unsupported PNG format: bitDepth ${bitDepth}, colorType ${colorType}`,
		);
	}
	const channels = colorType === 6 ? 4 : 3;
	const bpp = channels;
	// Evenly-spread sampling grid (uniform across rows and columns, not just the
	// first rows): representative coverage for wide/tall banners.
	const targetSamples = Math.min(sampleCap, width * height);
	const xSamples = Math.max(
		1,
		Math.round(Math.sqrt((targetSamples * width) / height)),
	);
	const ySamples = Math.max(1, Math.round(targetSamples / xSamples));
	const sampledYs = new Set();
	for (let yi = 0; yi < ySamples; yi++)
		sampledYs.add(Math.min(height - 1, Math.floor((yi * height) / ySamples)));
	const xPositions = [];
	for (let xi = 0; xi < xSamples; xi++)
		xPositions.push(Math.min(width - 1, Math.floor((xi * width) / xSamples)));
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
	const derivationPass = tokens.derivedViolations.length === 0;
	const allPass = derivationPass && results.every((r) => r.pass);
	const report = {
		contract: "brand-system",
		version: tokens.tokens.version,
		status: tokens.tokens.status,
		derivation: { pass: derivationPass, violations: tokens.derivedViolations },
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
			derivationPass
				? "✓ derivation: all derived tokens byte-exact from base\n"
				: `✗ derivation: ${tokens.derivedViolations.join("; ")}\n`,
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
				process.stdout.write(
					`✗ ${r.file.replace(ROOT + "/", "")} — ${detail}\n`,
				);
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
