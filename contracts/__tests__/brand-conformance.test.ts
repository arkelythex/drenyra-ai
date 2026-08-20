/**
 * brand-system contract conformance (v0.3 DRAFT).
 *
 * Pins the normative surface of contracts/brand-system.md, which mirrors the
 * Drenyra apps/web DTCG token pipeline:
 *
 *   1. PALETTE — both themes (dark + light) and both accents (cyan + violet)
 *      present and hex-valid in tokens.json; conformance set is the union.
 *   2. VECTORS — zero tolerance: the dual-theme banner SVG (CSS var() +
 *      @media prefers-color-scheme) only uses canonical colors; a banned
 *      legacy color fails closed; structural values (none, url(#...),
 *      currentColor) are allowed; an off-palette var() declaration in a theme
 *      block fails.
 *   3. RASTER — the built-in PNG decoder validates palette coverage: an
 *      on-token solid PNG passes, an off-palette solid PNG fails.
 *
 * The checker is driven through its CLI (spawnSync) so the public library
 * surface stays clean. No dependencies: fixture PNGs are encoded with a
 * minimal in-test encoder (zlib + CRC32).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(
	new URL("../../scripts/brand-conformance.mjs", import.meta.url),
);
const RUNNER = process.execPath;

interface PngDetail {
	kind: string;
	coverage: number;
	required: number;
	offPalette: string[];
	pass: boolean;
}
type AssetDetail = string[] | PngDetail;
interface AssetResult {
	file: string;
	pass: boolean;
	detail: AssetDetail;
}
interface ConformanceReport {
	contract: string;
	version: string;
	status: string;
	palette: { pass: boolean; problems: string[] };
	assets: AssetResult[];
	pass: boolean;
}

function runCli(extraArgs: string[] = []): ConformanceReport {
	const result = spawnSync(RUNNER, [SCRIPT, "--json", ...extraArgs], {
		encoding: "utf8",
	});
	if (result.status === null) {
		throw new Error(
			`brand-conformance CLI crashed: ${result.error?.message ?? "unknown"}`,
		);
	}
	try {
		return JSON.parse(result.stdout) as ConformanceReport;
	} catch (err) {
		throw new Error(
			`brand-conformance CLI produced invalid JSON (status ${result.status}): ${result.stderr?.slice(0, 500) ?? ""}`,
		);
	}
}

// --- minimal PNG encoder (test fixture only) -------------------------------

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf: Buffer): number {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const typeBuf = Buffer.from(type, "ascii");
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
	return Buffer.concat([len, typeBuf, data, crc]);
}

type Rgb = [number, number, number];

/** Solid-color 4x4 RGB PNG. */
function solidPng(rgb: Rgb): Buffer {
	const width = 4;
	const height = 4;
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type RGB
	const raw = Buffer.alloc((width * 3 + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (width * 3 + 1)] = 0; // filter: none
		for (let x = 0; x < width; x++) {
			const i = y * (width * 3 + 1) + 1 + x * 3;
			raw[i] = rgb[0];
			raw[i + 1] = rgb[1];
			raw[i + 2] = rgb[2];
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", deflateSync(raw)),
		pngChunk("IEND", Buffer.alloc(0)),
	]);
}

const COCOA_BASE: Rgb = [0x82, 0x4f, 0x16]; // #824F16 — canonical cocoa accent (Dreamcoder Light)
const LEGACY_BLUE: Rgb = [0x1a, 0x73, 0xe8]; // #1a73e8 — banned legacy drift (v0.1 palette)

let tmpDir: string | undefined;
function writeTmp(name: string, content: string | Buffer): string {
	if (!tmpDir) tmpDir = mkdtempSync(join(tmpdir(), "brand-conformance-"));
	const p = join(tmpDir, name);
	writeFileSync(p, content);
	return p;
}

function findAsset(report: ConformanceReport, suffix: string): AssetResult {
	const asset = report.assets.find((a) => a.file.endsWith(suffix));
	if (!asset) throw new Error(`asset not found: ${suffix}`);
	return asset;
}

function asPngDetail(detail: AssetDetail): PngDetail {
	return detail as PngDetail;
}

describe("brand-system conformance (v0.3 DRAFT)", () => {
	it("palette mirrors Dreamcoder canonical: dark Anthracite Steel + light Cocoa/Lúcuma, cocoa + terracotta accents, hex-valid", () => {
		const report = runCli();
		expect(report.contract).toBe("brand-system");
		expect(report.version).toBe("0.3");
		expect(report.palette.pass).toBe(true);
		expect(report.palette.problems).toEqual([]);
	});

    	it("passes the Dreamcoder Light editorial hero SVG with zero tolerance", () => {
    		const report = runCli();
    		const banner = findAsset(report, "drenyra-ai-hero-dreamcoder-light.svg");
    		expect(banner.pass).toBe(true);
    		expect(banner.detail).toEqual([]);
    	});

    	it("fails closed on a legacy palette color in an SVG", () => {
    		const svg = writeTmp(
    			"legacy-cyan.svg",
    			`<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#3CE6D8"/></svg>`,
    		);
    		const report = runCli([svg]);
    		const asset = findAsset(report, "legacy-cyan.svg");
    		expect(asset.pass).toBe(false);
    		expect(asset.detail).toContain("#3CE6D8");
    	});

	it("fails closed on a banned legacy color in an SVG", () => {
		const svg = writeTmp(
			"legacy-blue.svg",
			`<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#1a73e8"/></svg>`,
		);
		const report = runCli([svg]);
		const asset = findAsset(report, "legacy-blue.svg");
		expect(asset.pass).toBe(false);
		expect(asset.detail).toContain("#1a73e8");
	});

	it("rejects an off-palette var() declaration inside a theme block", () => {
		const svg = writeTmp(
			"off-var.svg",
			`<svg xmlns="http://www.w3.org/2000/svg">
         <style>
           :root { --bg: #000000; }
           @media (prefers-color-scheme: light) { :root { --bg: #F3EADC; --bad: #22d3ee; } }
         </style>
         <rect width="10" height="10" fill="var(--bg)"/>
       </svg>`,
		);
		const report = runCli([svg]);
		const asset = findAsset(report, "off-var.svg");
		expect(asset.pass).toBe(false);
		expect(
			Array.isArray(asset.detail) &&
				asset.detail.some((d) => d.includes("#22d3ee")),
		).toBe(true);
	});

	it("accepts structural SVG values (none, url(#...), currentColor)", () => {
		const svg = writeTmp(
			"structural.svg",
			`<svg xmlns="http://www.w3.org/2000/svg">
         <defs><linearGradient id="g"><stop offset="0%" stop-color="#824F16"/></linearGradient></defs>
         <rect width="10" height="10" fill="url(#g)" stroke="currentColor"/>
         <circle cx="5" cy="5" r="2" fill="none"/>
       </svg>`,
		);
		const report = runCli([svg]);
		const asset = findAsset(report, "structural.svg");
		expect(asset.pass).toBe(true);
	});

	it("accepts an on-token solid PNG (palette coverage)", () => {
		const png = writeTmp("on-token.png", solidPng(COCOA_BASE));
		const report = runCli([png]);
		const asset = findAsset(report, "on-token.png");
		expect(asset.pass).toBe(true);
		expect(asPngDetail(asset.detail).coverage).toBe(1);
	});

	it("rejects an off-palette solid PNG below required coverage", () => {
		const png = writeTmp("off-palette.png", solidPng(LEGACY_BLUE));
		const report = runCli([png]);
		const asset = findAsset(report, "off-palette.png");
		expect(asset.pass).toBe(false);
		expect(asPngDetail(asset.detail).coverage).toBe(0);
		expect(asPngDetail(asset.detail).offPalette.length).toBeGreaterThan(0);
	});

	it("reports a global FAIL when any asset drifts", () => {
		const svg = writeTmp(
			"drift.svg",
			`<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#041c78"/></svg>`,
		);
		const report = runCli([svg]);
		expect(report.pass).toBe(false);
	});
});

afterAll(() => {
	if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});
