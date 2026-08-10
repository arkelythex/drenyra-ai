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
import { SkillRegistry, computeSkillChecksum } from "../../skills/index.js";
import type { SkillDefinition } from "../../skills/index.js";

const require = createRequire(import.meta.url);

/** Base Peruvian skills (Design 03 "Drenyra Skills" — Peru layer). */
function basePeruvianSkills(): SkillDefinition[] {
	const make = (
		id: string,
		version: string,
		normativeSources: string[],
		inputs: string[],
		outputs: string[],
		maxAutonomy: SkillDefinition["maxAutonomy"],
	): SkillDefinition => {
		const skill: SkillDefinition = {
			id,
			version,
			jurisdiction: "PE",
			validity: { from: "2026-01-01" },
			normativeSources,
			inputs,
			outputs,
			requiredPermissions: ["evidence:read"],
			maxAutonomy,
			contractCompatibility: ["candidate@0.1", "receipt@0.1"],
			retirementPolicy: "superseded-by-next-major",
			checksum: "",
		};
		skill.checksum = computeSkillChecksum(skill);
		return skill;
	};
	return [
		make(
			"pe.igv-validate",
			"1.0.0",
			["TUO IGV — D.S. 055-99-EF"],
			["invoice", "tax-period"],
			["igv-validation"],
			"R1",
		),
		make(
			"pe.sire-compare",
			"1.0.0",
			["SUNAT SIRE — R.S. 085-2020/SUNAT"],
			["sire-proposal", "ledger"],
			["exceptions", "candidates"],
			"R1",
		),
		make(
			"pe.detraction-check",
			"1.0.0",
			["D.S. 155-98-EF (detracciones)"],
			["operation", "period"],
			["detraction-validation"],
			"R1",
		),
	];
}

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
	for (const skill of basePeruvianSkills()) {
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
