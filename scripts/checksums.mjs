#!/usr/bin/env node
/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; exit/status codes are JSON integers, never floats.
 */
/**
 * Release integrity — SHA-256 checksums for the published artifacts (Design 05
 * "artifact signing and checksums"). Walks dist/ (the package `files`) and
 * writes dist/checksums.txt with every file's SHA-256.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(process.cwd(), "dist");

/** Walk a directory recursively, returning file paths. */
function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			walk(path, out);
		} else {
			out.push(path);
		}
	}
	return out;
}

const files = walk(root).sort();
const lines = [];
for (const file of files) {
	const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
	// Portable relative path (POSIX separators) so the manifest is stable.
	const rel = relative(root, file).split(sep).join("/");
	lines.push(`${hash}  ${rel}`);
}
const manifest = lines.join("\n") + "\n";
writeFileSync(join(root, "checksums.txt"), manifest);
console.log(`checksums: ${files.length} files -> dist/checksums.txt`);
console.log(manifest);
