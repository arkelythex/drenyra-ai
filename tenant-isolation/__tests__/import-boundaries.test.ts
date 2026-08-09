/**
 * Static import-boundary guard for the new fiscal-authority modules.
 *
 * Scans every non-test TypeScript file under the declared module directories
 * and fails on any forbidden edge: an import resolving outside the program's
 * own new-module directories (reverse imports into existing modules) or any
 * `agents/`, `cmd/`, or `ingest/` path. Later slices extend the directory
 * list.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

/** Directories owned by the fiscal-authority program chain (additive). */
const MODULE_DIRS = ["tenant-core", "tenant-isolation"] as const;

/** Forbidden path segments in any relative import of a new module. */
const FORBIDDEN_SEGMENTS = ["agents", "cmd", "ingest"] as const;

const RELATIVE_IMPORT =
	/\bfrom\s+["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;

function collectSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "__tests__" || entry.name === "node_modules") continue;
			out.push(...collectSourceFiles(full));
		} else if (entry.name.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

function relativeImports(source: string): string[] {
	const imports: string[] = [];
	for (const match of source.matchAll(RELATIVE_IMPORT)) {
		const specifier = match[1] ?? match[2];
		if (specifier !== undefined) imports.push(specifier);
	}
	return imports;
}

/** True when the resolved path lives under one of the program module dirs. */
function isWithinProgramModules(resolved: string): boolean {
	for (const mod of MODULE_DIRS) {
		const moduleDir = resolve(repoRoot, mod);
		if (resolved === moduleDir || resolved.startsWith(moduleDir + sep)) {
			return true;
		}
	}
	return false;
}

describe("fiscal-authority import boundaries", () => {
	for (const mod of MODULE_DIRS) {
		it(`${mod}/ imports only program modules and never agents, cmd, or ingest`, () => {
			const moduleDir = resolve(repoRoot, mod);
			const files = collectSourceFiles(moduleDir);
			expect(files.length).toBeGreaterThan(0);

			const violations: string[] = [];
			for (const file of files) {
				const source = readFileSync(file, "utf8");
				const relFile = relative(repoRoot, file);
				for (const specifier of relativeImports(source)) {
					for (const forbidden of FORBIDDEN_SEGMENTS) {
						if (
							specifier.includes(`/${forbidden}/`) ||
							specifier.includes(`${forbidden}/`)
						) {
							violations.push(
								`${relFile} imports forbidden path "${specifier}"`,
							);
						}
					}
					const resolved = resolve(dirname(file), specifier);
					if (!isWithinProgramModules(resolved)) {
						violations.push(
							`${relFile} escapes the program modules via "${specifier}"`,
						);
					}
				}
			}
			expect(violations).toEqual([]);
		});
	}
});
