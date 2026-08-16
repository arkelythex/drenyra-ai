import { describe, expect, it } from "vitest";
import { BASE_PE_SKILLS, SkillRegistry } from "../index.js";

describe("BASE_PE_SKILLS (Peru layer)", () => {
	it("ships the full Peru skill set with checksums", () => {
		expect(BASE_PE_SKILLS.length).toBe(7);
		expect(BASE_PE_SKILLS.every((s) => s.jurisdiction === "PE")).toBe(true);
		expect(BASE_PE_SKILLS.every((s) => s.checksum.length === 64)).toBe(true);
	});

	it("every skill registers and resolves at a date in validity", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) {
			registry.register(skill);
		}
		for (const skill of BASE_PE_SKILLS) {
			expect(registry.resolveAt(skill.id, "2026-07-15").version).toBe(
				skill.version,
			);
		}
	});

	it("covers the core obligations: IGV, SIRE, detractions, retentions, perceptions, filing, reconciliation", () => {
		const ids = BASE_PE_SKILLS.map((s) => s.id).sort();
		expect(ids).toEqual([
			"pe.conciliacion-bancaria",
			"pe.detraction-check",
			"pe.igv-validate",
			"pe.perception-check",
			"pe.retention-check",
			"pe.sire-compare",
			"pe.sire-filing",
		]);
	});

	it("registers pe.conciliacion-bancaria with the reconciliation surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.conciliacion-bancaria", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.inputs).toEqual(["bank-statement", "ledger", "scope"]);
		expect(skill.outputs).toEqual([
			"differences",
			"adjustments",
			"reconciliation-report",
		]);
	});
});
