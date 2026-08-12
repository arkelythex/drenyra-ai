/**
 * Contract schema loader — reads canonical JSON schemas from the PACKAGE's
 * `contracts/` directory at runtime.
 *
 * Why not `import ... from "../contracts/*.json"`? Relative JSON imports break
 * in the published artifact: `dist/` does not contain `contracts/` (they ship
 * side-by-side at the package root). Loading by package-root path works both
 * from `src/` (Bun dev) and from `dist/` (Node runtime) because we walk up to
 * the nearest `package.json`.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; schema/version strings are plain text.
 */

import { accessSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function findPackageRoot(from: string): string {
	let dir = from;
	for (;;) {
		try {
			accessSync(join(dir, "package.json"));
			return dir;
		} catch {
			// continue walking up
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error("drenyra-ai package root not found");
		}
		dir = parent;
	}
}

const PACKAGE_ROOT = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

/**
 * Load a JSON schema from `<packageRoot>/contracts/<relativePath>`.
 */
export function loadContractJson(relativePath: string): unknown {
	const filePath = join(PACKAGE_ROOT, "contracts", relativePath);
	try {
		return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
	} catch (error) {
		throw new Error(
			`cannot parse contract JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
