import { describe, expect, it } from "vitest";
import {
	computeSkillChecksum,
	isSkillInForce,
	SkillError,
	SkillRegistry,
} from "../index.js";
import type { SkillDefinition } from "../index.js";

function baseSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
	const skill: SkillDefinition = {
		id: "pe.igv-validate",
		version: "1.0.0",
		jurisdiction: "PE",
		validity: { from: "2026-01-01", to: "2026-12-31" },
		normativeSources: ["SUNAT: Decreto Supremo 055-99-EF"],
		inputs: ["invoice", "tax-period"],
		outputs: ["igv-validation"],
		requiredPermissions: ["evidence:read"],
		maxAutonomy: "R1",
		contractCompatibility: ["candidate@0.1", "receipt@0.1"],
		retirementPolicy: "superseded-by-next-major",
		checksum: "",
		...overrides,
	};
	skill.checksum = computeSkillChecksum(skill);
	return skill;
}

describe("SkillRegistry", () => {
	it("registers a valid skill and resolves it by version", () => {
		const registry = new SkillRegistry();
		const skill = baseSkill();
		registry.register(skill);
		expect(registry.resolveVersion("pe.igv-validate", "1.0.0")).toEqual(skill);
	});

	it("rejects a checksum mismatch (fail-closed)", () => {
		const registry = new SkillRegistry();
		const skill = baseSkill();
		skill.checksum = "f".repeat(64);
		expect(() => registry.register(skill)).toThrow(SkillError);
		try {
			registry.register(skill);
		} catch (error) {
			expect((error as SkillError).code).toBe("SKILL_CHECKSUM_MISMATCH");
		}
	});

	it("rejects invalid definitions (bad id, version, jurisdiction, tier, permission)", () => {
		const registry = new SkillRegistry();
		expect(() => registry.register(baseSkill({ id: "INVALID ID" }))).toThrow(
			SkillError,
		);
		expect(() => registry.register(baseSkill({ version: "1" }))).toThrow(
			SkillError,
		);
		expect(() =>
			registry.register(baseSkill({ jurisdiction: "PERU" })),
		).toThrow(SkillError);
		expect(() =>
			registry.register(baseSkill({ maxAutonomy: "R9" as never })),
		).toThrow(SkillError);
		expect(() =>
			registry.register(baseSkill({ requiredPermissions: ["root:all"] })),
		).toThrow(SkillError);
		expect(() =>
			registry.register(baseSkill({ validity: { from: "2026-13-01" } })),
		).toThrow(SkillError);
	});

	it("resolves the skill in force at a date, honoring the exclusive `to`", () => {
		const registry = new SkillRegistry();
		const skill = baseSkill({
			validity: { from: "2026-01-01", to: "2026-12-31" },
		});
		registry.register(skill);
		expect(registry.resolveAt("pe.igv-validate", "2026-06-15")).toEqual(skill);
		expect(isSkillInForce(skill, "2026-01-01")).toBe(true);
		expect(isSkillInForce(skill, "2026-12-31")).toBe(false);
		expect(isSkillInForce(skill, "2027-01-01")).toBe(false);
	});

	it("throws SKILL_OUT_OF_VALIDITY when nothing is in force at a date", () => {
		const registry = new SkillRegistry();
		registry.register(
			baseSkill({ validity: { from: "2026-01-01", to: "2026-06-30" } }),
		);
		try {
			registry.resolveAt("pe.igv-validate", "2026-07-01");
			expect.unreachable();
		} catch (error) {
			expect((error as SkillError).code).toBe("SKILL_OUT_OF_VALIDITY");
		}
	});

	it("returns the latest in-force version at a date", () => {
		const registry = new SkillRegistry();
		registry.register(
			baseSkill({ version: "1.0.0", validity: { from: "2026-01-01" } }),
		);
		registry.register(
			baseSkill({ version: "1.1.0", validity: { from: "2026-07-01" } }),
		);
		expect(registry.resolveAt("pe.igv-validate", "2026-03-01").version).toBe(
			"1.0.0",
		);
		expect(registry.resolveAt("pe.igv-validate", "2026-08-01").version).toBe(
			"1.1.0",
		);
	});

	it("does not retroactively change a historical resolution", () => {
		const registry = new SkillRegistry();
		registry.register(
			baseSkill({ version: "1.0.0", validity: { from: "2026-01-01" } }),
		);
		const historical = registry.resolveAt("pe.igv-validate", "2026-03-01");
		registry.register(
			baseSkill({ version: "2.0.0", validity: { from: "2026-09-01" } }),
		);
		expect(registry.resolveAt("pe.igv-validate", "2026-03-01")).toEqual(
			historical,
		);
		expect(registry.resolveAt("pe.igv-validate", "2026-10-01").version).toBe(
			"2.0.0",
		);
	});

	it("filters by jurisdiction and enforces jurisdiction mismatch", () => {
		const registry = new SkillRegistry();
		registry.register(baseSkill({ id: "pe.igv-validate", jurisdiction: "PE" }));
		expect(registry.list("PE")).toHaveLength(1);
		expect(registry.list("CL")).toHaveLength(0);
		expect(() =>
			registry.resolveAt("pe.igv-validate", "2026-06-01", "CL"),
		).toThrow(SkillError);
	});

	it("checksum is content-derived: changing a field changes the checksum", () => {
		const a = baseSkill();
		const b = baseSkill({ maxAutonomy: "R2" });
		expect(a.checksum).not.toBe(b.checksum);
	});
});
