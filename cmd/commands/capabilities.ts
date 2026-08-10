/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai capabilities`
 *
 * Declares the available surface: frozen contracts, versioned skills,
 * jurisdictions, adapters, and the runtime version (Design 03 "capabilities").
 * Read-only; exit 0.
 */

import { createRequire } from "node:module";
import { SkillRegistry } from "../../skills/index.js";
import { BASE_PE_SKILLS } from "../../skills/index.js";

const require = createRequire(import.meta.url);

/** Runtime version from the package manifest. */
function runtimeVersion(): string {
	try {
		const manifest = require("../../package.json") as { version?: string };
		return manifest.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

export function capabilitiesCommand(): number {
	const registry = new SkillRegistry();
	for (const skill of BASE_PE_SKILLS) {
		registry.register(skill);
	}
	const result = {
		version: runtimeVersion(),
		contracts: [
			{ name: "mission-protocol", version: "0.1", status: "FROZEN" },
			{ name: "candidate", version: "0.1", status: "FROZEN" },
			{ name: "receipt", version: "0.1", status: "FROZEN" },
			{ name: "gate", version: "0.1", status: "FROZEN" },
			{ name: "ledger", version: "0.1", status: "FROZEN" },
			{ name: "recovery", version: "0.1", status: "FROZEN" },
		],
		jurisdictions: ["PE"],
		skills: registry.list().map(({ checksum, ...skill }) => skill),
		adapters: [],
		integrations: ["MCP (planned)", "Codex/Claude Code/OpenCode (planned)"],
	};
	console.log(JSON.stringify(result, null, 2));
	return 0;
}
