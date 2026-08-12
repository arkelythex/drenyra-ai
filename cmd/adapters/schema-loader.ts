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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot } from "./package-metadata.js";

const PACKAGE_ROOT = getPackageRoot();

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
