/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Skill registry — versioned, jurisdiction-scoped skills (Design 03).
 *
 * - `register` validates the definition and its checksum.
 * - `resolve` returns a skill by exact version or by validity at a date.
 * - A normative update never retroactively modifies a mission: resolution at a
 *   historical date returns the skill that was in force then.
 */

import { createHash } from "node:crypto";
import {
	canonicalSkillJson,
	SkillError,
	type SkillDefinition,
	type IsoDate,
} from "./types.js";

const VALID_TIERS = new Set(["R0", "R1", "R2", "R3"]);
const VALID_PERMISSIONS = new Set([
	"evidence:read",
	"evidence:write",
	"candidate:propose",
	"gate:inspect",
	"ledger:read",
	"receipt:verify",
	"skill:read",
]);

/** SHA-256 checksum over the canonical (key-sorted) definition bytes. */
export function computeSkillChecksum(skill: SkillDefinition): string {
	return createHash("sha256")
		.update(canonicalSkillJson(skill), "utf8")
		.digest("hex");
}

/** Validate a skill definition; throws SkillError(SKILL_INVALID) on failure. */
export function validateSkill(skill: SkillDefinition): void {
	if (!skill.id || !/^[a-z0-9][a-z0-9.-]*$/.test(skill.id)) {
		throw new SkillError(`invalid skill id "${skill.id}"`, "SKILL_INVALID");
	}
	if (!skill.version || !/^\d+\.\d+\.\d+$/.test(skill.version)) {
		throw new SkillError(
			`invalid skill version "${skill.version}"`,
			"SKILL_INVALID",
		);
	}
	if (!skill.jurisdiction || !/^[A-Z]{2}$/.test(skill.jurisdiction)) {
		throw new SkillError(
			`invalid jurisdiction "${skill.jurisdiction}"`,
			"SKILL_INVALID",
		);
	}
	if (!isValidIsoDate(skill.validity.from)) {
		throw new SkillError(
			`invalid validity.from "${skill.validity.from}"`,
			"SKILL_INVALID",
		);
	}
	if (skill.validity.to !== undefined && !isValidIsoDate(skill.validity.to)) {
		throw new SkillError(
			`invalid validity.to "${skill.validity.to}"`,
			"SKILL_INVALID",
		);
	}
	if (
		skill.validity.to !== undefined &&
		skill.validity.to <= skill.validity.from
	) {
		throw new SkillError(
			"validity.to must be after validity.from",
			"SKILL_INVALID",
		);
	}
	if (!VALID_TIERS.has(skill.maxAutonomy)) {
		throw new SkillError(
			`invalid maxAutonomy "${skill.maxAutonomy}"`,
			"SKILL_INVALID",
		);
	}
	for (const permission of skill.requiredPermissions) {
		if (!VALID_PERMISSIONS.has(permission)) {
			throw new SkillError(
				`unknown permission "${permission}"`,
				"SKILL_INVALID",
			);
		}
	}
	if (!/^[a-f0-9]{64}$/.test(skill.checksum)) {
		throw new SkillError(
			"checksum must be a 64-char hex SHA-256",
			"SKILL_INVALID",
		);
	}
}

function isValidIsoDate(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	);
}

/** In force at a date? `to` is exclusive; undefined means in force forever. */
export function isSkillInForce(skill: SkillDefinition, at: IsoDate): boolean {
	if (!isValidIsoDate(at)) return false;
	if (at < skill.validity.from) return false;
	if (skill.validity.to !== undefined && at >= skill.validity.to) return false;
	return true;
}

/** Version comparison for resolve-by-version (semver numeric). */
function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < 3; i += 1) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/** In-memory skill registry. */
export class SkillRegistry {
	readonly #skills: SkillDefinition[] = [];

	/** Register a validated skill. Rejects a checksum mismatch (fail-closed). */
	register(skill: SkillDefinition): SkillDefinition {
		validateSkill(skill);
		const expected = computeSkillChecksum(skill);
		if (skill.checksum !== expected) {
			throw new SkillError(
				`checksum mismatch for ${skill.id}@${skill.version}: expected ${expected}, got ${skill.checksum}`,
				"SKILL_CHECKSUM_MISMATCH",
			);
		}
		this.#skills.push(skill);
		return skill;
	}

	/** All registered skills, optionally filtered by jurisdiction. */
	list(jurisdiction?: string): readonly SkillDefinition[] {
		if (jurisdiction === undefined) return [...this.#skills];
		return this.#skills.filter((skill) => skill.jurisdiction === jurisdiction);
	}

	/** Resolve by exact id + version. */
	resolveVersion(id: string, version: string): SkillDefinition {
		const found = this.#skills.find(
			(skill) => skill.id === id && skill.version === version,
		);
		if (found === undefined) {
			throw new SkillError(
				`skill ${id}@${version} not found`,
				"SKILL_NOT_FOUND",
			);
		}
		return found;
	}

	/** Resolve the skill in force for `id` at a date (latest version in force). */
	resolveAt(id: string, at: IsoDate, jurisdiction?: string): SkillDefinition {
		const candidates = this.#skills.filter(
			(skill) =>
				skill.id === id &&
				isSkillInForce(skill, at) &&
				(jurisdiction === undefined || skill.jurisdiction === jurisdiction),
		);
		if (candidates.length === 0) {
			const base = this.#skills.find((skill) => skill.id === id);
			if (base === undefined) {
				throw new SkillError(`skill ${id} not found`, "SKILL_NOT_FOUND");
			}
			if (jurisdiction !== undefined && base.jurisdiction !== jurisdiction) {
				throw new SkillError(
					`skill ${id} is not registered for jurisdiction ${jurisdiction}`,
					"SKILL_JURISDICTION_MISMATCH",
				);
			}
			throw new SkillError(
				`skill ${id} is not in force at ${at}`,
				"SKILL_OUT_OF_VALIDITY",
			);
		}
		return [...candidates].sort((a, b) =>
			compareVersions(b.version, a.version),
		)[0]!;
	}
}
