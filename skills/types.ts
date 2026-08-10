/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Skill contract — Design 03 "Drenyra Skills". Every skill declares an
 * identifier, version, jurisdiction, validity period, normative sources,
 * declared inputs/outputs, required permissions, maximum autonomy (R0-R3),
 * contract compatibility, a checksum, and a retirement policy.
 *
 * A normative update never retroactively modifies a mission: receipts record
 * the exact skill and policy version used, and the registry resolves versions
 * by exact match or by validity at a given date.
 */

import type { Materiality } from "../candidates/types.js";

/** ISO-8601 calendar date (YYYY-MM-DD). */
export type IsoDate = string;

/** Skill validity window. `to` is exclusive; absent means no expiry. */
export interface SkillValidity {
	/** Inclusive start date. */
	from: IsoDate;
	/** Exclusive end date; undefined means "still in force". */
	to?: IsoDate;
}

/** A versioned, jurisdiction-scoped accounting/tax knowledge unit. */
export interface SkillDefinition {
	/** Stable skill identifier, e.g. "pe.igv-validate". */
	id: string;
	/** Version of this skill, e.g. "1.2.0". */
	version: string;
	/** ISO-3166-1 alpha-2 jurisdiction, e.g. "PE". */
	jurisdiction: string;
	/** Validity window. */
	validity: SkillValidity;
	/** Normative sources (laws, regulations, SUNAT publications). */
	normativeSources: readonly string[];
	/** Declared input surface (schema references). */
	inputs: readonly string[];
	/** Declared output surface (schema references). */
	outputs: readonly string[];
	/** Required permissions. */
	requiredPermissions: readonly string[];
	/** Maximum autonomy the skill may grant (R0-R3). */
	maxAutonomy: Materiality;
	/** Frozen contracts this skill is compatible with. */
	contractCompatibility: readonly string[];
	/** SHA-256 checksum over the canonical definition bytes. */
	checksum: string;
	/** Replacement and retirement policy. */
	retirementPolicy: string;
}

/** Errors thrown by the skill registry. */
export class SkillError extends Error {
	constructor(
		message: string,
		readonly code:
			| "SKILL_INVALID"
			| "SKILL_CHECKSUM_MISMATCH"
			| "SKILL_NOT_FOUND"
			| "SKILL_OUT_OF_VALIDITY"
			| "SKILL_JURISDICTION_MISMATCH",
	) {
		super(message);
		this.name = "SkillError";
	}
}

/** Canonical key-sorted JSON of a skill (checksum input — order-independent). */
export function canonicalSkillJson(skill: SkillDefinition): string {
	return JSON.stringify(sortSkill({ ...skill, checksum: undefined }));
}

function sortSkill(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortSkill);
	if (value !== null && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			const item = (value as Record<string, unknown>)[key];
			if (item !== undefined) out[key] = sortSkill(item);
		}
		return out;
	}
	return value;
}
