/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Declared surface — single owner of the common capability facts shared by CLI
 * and MCP: the six frozen contract identities, the `PE` jurisdiction, the
 * adapters, and the package-backed runtime version. Consumers must not keep
 * parallel copies; the private contract filename is stripped from public payloads.
 */

import { getPackageMetadata } from "./adapters/package-metadata.js";
import type { DeclaredCapabilities } from "../mcp/tools.js";

interface DeclaredContract {
	name: string;
	version: string;
	status: string;
	/** Package-relative filename under `contracts/`; private, not rendered. */
	file: string;
}

/** The six frozen contract identities and their packaged filenames. */
const DECLARED_CONTRACTS = [
	{
		name: "mission-protocol",
		version: "0.1",
		status: "FROZEN",
		file: "mission-protocol.md",
	},
	{ name: "candidate", version: "0.1", status: "FROZEN", file: "candidate.md" },
	{ name: "receipt", version: "0.1", status: "FROZEN", file: "receipt.md" },
	{ name: "gate", version: "0.1", status: "FROZEN", file: "gate.md" },
	{ name: "ledger", version: "0.1", status: "FROZEN", file: "ledger.md" },
	{ name: "recovery", version: "0.1", status: "FROZEN", file: "recovery.md" },
] as const satisfies readonly DeclaredContract[];

/** Contract filenames for doctor, derived without package metadata. */
export const DECLARED_CONTRACT_FILES: readonly string[] =
	DECLARED_CONTRACTS.map(({ file }) => file);

const DECLARED_JURISDICTIONS = ["PE"] as const;
const DECLARED_ADAPTERS = [] as const;

let cached: DeclaredCapabilities | undefined;

/** Lazy, cached public common declaration (runtime version from package metadata). */
export function getDeclaredCapabilities(): DeclaredCapabilities {
	if (cached !== undefined) return cached;
	cached = {
		version: getPackageMetadata().version,
		contracts: DECLARED_CONTRACTS.map(({ name, version, status }) => ({
			name,
			version,
			status,
		})),
		jurisdictions: DECLARED_JURISDICTIONS,
		adapters: DECLARED_ADAPTERS,
	};
	return cached;
}
