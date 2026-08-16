/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Module-boundary test — `annual-declaration/` is a pure library module: every
 * runtime import must be a `node:` builtin, a relative import resolving within
 * the module itself, or the composed SDD-CON-002 `close-calculations/` module —
 * never `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, or the sibling
 * `bank-reconciliation/`, and never a third-party runtime dependency.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Matches `from "specifier"` and side-effect `import "specifier"` forms. */
const SPECIFIER_RE = /(?:from\s*|import\s*)["']([^"']+)["']/g;

/** Every source file of the module (barrel + engine files), sorted. */
function moduleSourceFiles(): string[] {
	return readdirSync(MODULE_DIR)
		.filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
		.sort()
		.map((name) => join(MODULE_DIR, name));
}

function isAllowedSpecifier(specifier: string): boolean {
	if (specifier.startsWith("node:")) return true; // node builtins only
	if (specifier.startsWith("./")) return !specifier.startsWith("../");
	// The only intra-repository module the annual engine may import.
	return specifier.startsWith("../close-calculations/");
}

function resolvesWithinModule(specifier: string): boolean {
	if (specifier.startsWith("node:")) return true;
	if (specifier.startsWith("../")) return true; // close-calculations resolves via tsconfig
	const relative = specifier.replace(/\.js$/, ".ts");
	return existsSync(join(MODULE_DIR, relative));
}

describe("annual-declaration module boundary", () => {
	it("imports only node builtins, itself, or close-calculations (no agents/cmd/ledger/mcp/adapters/bank-reconciliation, no third party)", () => {
		const violations: string[] = [];
		for (const file of moduleSourceFiles()) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(SPECIFIER_RE)) {
				const specifier = match[1]!;
				if (isAllowedSpecifier(specifier)) {
					if (!resolvesWithinModule(specifier)) {
						violations.push(`${file}: unresolved relative "${specifier}"`);
					}
					continue;
				}
				violations.push(`${file}: external import "${specifier}"`);
			}
		}
		expect(violations).toEqual([]);
	});
});
