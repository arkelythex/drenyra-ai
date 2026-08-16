/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Module-boundary test — `close-calculations/` is a pure library module: every
 * import must resolve within the module itself (or `node:` builtins), never to a
 * project module, and never to `agents/`, `cmd/`, `ledger/`, `mcp/`,
 * `adapters/`, or the sibling `bank-reconciliation/`. The audit-only `ledger/`
 * module must never import it.
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
	return specifier.startsWith("./") && !specifier.startsWith("../");
}

function resolvesWithinModule(specifier: string): boolean {
	if (specifier.startsWith("node:")) return true;
	const relative = specifier.replace(/\.js$/, ".ts");
	return existsSync(join(MODULE_DIR, relative));
}

describe("close-calculations module boundary", () => {
	it("imports only within itself or node: builtins (no project module, no agents/cmd/ledger/mcp/adapters path)", () => {
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

	it("never imports from the sibling bank-reconciliation module", () => {
		const sources = moduleSourceFiles().map((file) =>
			readFileSync(file, "utf8"),
		);
		for (const source of sources) {
			for (const match of source.matchAll(SPECIFIER_RE)) {
				expect(match[1]).not.toContain("bank-reconciliation");
			}
		}
	});
});
