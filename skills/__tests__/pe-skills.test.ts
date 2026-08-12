import { describe, expect, it } from "vitest";
import { BASE_PE_SKILLS, SkillRegistry } from "../index.js";

describe("BASE_PE_SKILLS (Peru layer)", () => {
	it("ships the full Peru skill set with checksums", () => {
		expect(BASE_PE_SKILLS.length).toBe(6);
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

	it("covers the core obligations: IGV, SIRE, detractions, retentions, perceptions, filing", () => {
		const ids = BASE_PE_SKILLS.map((s) => s.id).sort();
		expect(ids).toEqual([
			"pe.detraction-check",
			"pe.igv-validate",
			"pe.perception-check",
			"pe.retention-check",
			"pe.sire-compare",
			"pe.sire-filing",
		]);
	});
});
