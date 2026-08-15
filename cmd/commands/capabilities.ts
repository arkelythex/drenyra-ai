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
 * Common facts come from the single shared declared-surface declaration;
 * only CLI-owned `skills` and `integrations` are appended here. Read-only; exit 0.
 */

import { SkillRegistry } from "../../skills/index.js";
import { BASE_PE_SKILLS } from "../../skills/index.js";
import { getDeclaredCapabilities } from "../declared-surface.js";

export function capabilitiesCommand(): number {
	const registry = new SkillRegistry();
	for (const skill of BASE_PE_SKILLS) {
		registry.register(skill);
	}
	const declared = getDeclaredCapabilities();
	const result = {
		...declared,
		skills: registry.list().map(({ checksum, ...skill }) => skill),
		integrations: [
			"MCP (planned)",
			"Codex/Claude Code/OpenCode (managed marker/skills/pin configuration)",
		],
	};
	console.log(JSON.stringify(result, null, 2));
	return 0;
}
