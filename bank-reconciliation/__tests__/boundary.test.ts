/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Module-boundary test — `bank-reconciliation/` is a pure library module:
 * every import must resolve within the module itself (or `node:` builtins),
 * never to a project module, and never to `agents/`, `cmd/`, `ledger/`, or any
 * adapter path. The audit-only `ledger/` module must never import it.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(MODULE_DIR, "..");

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

/** Recursively list .ts files under a directory (excluding dist/node_modules). */
function listTypeScriptFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry !== "node_modules" && entry !== "dist" && entry !== "__tests__") {
				listTypeScriptFiles(full, out);
			}
		} else if (entry.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

describe("bank-reconciliation module boundary", () => {
	it("imports only within itself (no project module, no agents/cmd/ledger/adapter path)", () => {
		const files = moduleSourceFiles();
		expect(files.length).toBeGreaterThan(0);
		const violations: string[] = [];
		for (const file of files) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(SPECIFIER_RE)) {
				const specifier = match[1];
				if (!isAllowedSpecifier(specifier)) {
					violations.push(`${file}: disallowed specifier "${specifier}"`);
				}
				if (!resolvesWithinModule(specifier)) {
					violations.push(`${file}: specifier "${specifier}" does not resolve inside the module`);
				}
				for (const banned of ["agents/", "cmd/", "ledger/", "mcp/", "adapters/"]) {
					if (specifier.includes(banned)) {
						violations.push(`${file}: specifier "${specifier}" reaches banned path ${banned}`);
					}
				}
			}
		}
		expect(violations).toEqual([]);
	});

	it("is never imported by the audit-only ledger module", () => {
		const ledgerDir = join(REPO_ROOT, "ledger");
		const ledgerFiles = listTypeScriptFiles(ledgerDir);
		expect(ledgerFiles.length).toBeGreaterThan(0);
		const violations = ledgerFiles.filter((file) =>
			readFileSync(file, "utf8").includes("bank-reconciliation"),
		);
		expect(violations).toEqual([]);
	});
});
