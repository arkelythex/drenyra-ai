import { describe, expect, it } from "vitest";
import { BASE_PE_SKILLS, SkillRegistry } from "../index.js";

describe("BASE_PE_SKILLS (Peru layer)", () => {
	it("ships the full Peru skill set with checksums", () => {
		expect(BASE_PE_SKILLS.length).toBe(19);
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

	it("covers the full suite of operational, financial, and fiscal obligations", () => {
		const ids = BASE_PE_SKILLS.map((s) => s.id).sort();
		expect(ids).toEqual([
			"pe.bancarizacion-gate",
			"pe.cierre-resultados",
			"pe.conciliacion-bancaria",
			"pe.depreciacion-activo-fijo",
			"pe.detraction-check",
			"pe.igv-validate",
			"pe.isr-mensual",
			"pe.itf-justification",
			"pe.legacy-ingest",
			"pe.perception-check",
			"pe.plame-provision",
			"pe.ple-export",
			"pe.provision-cartera",
			"pe.retention-check",
			"pe.sbs-exchange-rates",
			"pe.sire-adversarial",
			"pe.sire-compare",
			"pe.sire-filing",
			"pe.tax-shield",
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

	it("registers pe.bancarizacion-gate with the anti-cash gate surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.bancarizacion-gate", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual(["payment-entry", "payment-method", "amount", "scope"]);
		expect(skill.outputs).toEqual(["bancarizacion-verdict", "compliance-exception"]);
	});

	it("registers pe.tax-shield with the causality & reparo surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.tax-shield", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual(["journal-entry", "industry-context", "scope"]);
		expect(skill.outputs).toEqual(["causality-disposition", "reparo-tax-target", "normative-justification"]);
	});

	it("registers pe.plame-provision with the labor benefits surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.plame-provision", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual(["payroll-contracts", "worked-period", "attendance-records", "scope"]);
		expect(skill.outputs).toEqual(["social-benefit-provisions", "pcge-payroll-entries", "plame-import-draft"]);
	});

	it("registers pe.depreciacion-activo-fijo with the depreciation surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.depreciacion-activo-fijo", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual(["fixed-asset", "policy", "scope"]);
		expect(skill.outputs).toEqual(["depreciation-entries"]);
	});

	it("registers pe.provision-cartera with the provision surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.provision-cartera", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual([
			"receivables",
			"inventory",
			"policy",
			"scope",
		]);
		expect(skill.outputs).toEqual(["provision-entries"]);
	});

	it("registers pe.isr-mensual with the ISR surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.isr-mensual", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual(["net-income", "prior-year-ratio", "scope"]);
		expect(skill.outputs).toEqual(["isr-entry", "cedula"]);
	});

	it("registers pe.cierre-resultados with the closing surface", () => {
		const registry = new SkillRegistry();
		for (const skill of BASE_PE_SKILLS) registry.register(skill);
		const skill = registry.resolveAt("pe.cierre-resultados", "2026-07-15");
		expect(skill.version).toBe("1.0.0");
		expect(skill.maxAutonomy).toBe("R1");
		expect(skill.inputs).toEqual(["result-balances", "chart", "scope"]);
		expect(skill.outputs).toEqual(["closing-entries"]);
	});
});
