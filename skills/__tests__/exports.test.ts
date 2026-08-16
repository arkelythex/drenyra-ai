/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Skills module root export smoke — signing, verification, and pinning are all
 * available through the existing `./skills` package subpath with no internal
 * module imports and no new subpath (SDD-070, REQ-SK-012, SC-SK-034).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	computeSkillChecksum,
	createMissionSkillPin,
	generateReceiptKeyPair,
	signSkillPack,
	verifyMissionSkillPin,
	verifySkillPack,
	type MissionSkillPin,
	type ReceiptKeyPair,
	type SignedSkillPack,
	type SkillDefinition,
} from "drenyra-ai/skills";

describe("skills module root exports (REQ-SK-012)", () => {
	it("exposes the signing, verification, and pinning APIs through the ./skills subpath (SC-SK-034)", () => {
		expect(typeof signSkillPack).toBe("function");
		expect(typeof verifySkillPack).toBe("function");
		expect(typeof createMissionSkillPin).toBe("function");
		expect(typeof verifyMissionSkillPin).toBe("function");
		expect(typeof generateReceiptKeyPair).toBe("function");
	});

	it("signs, verifies, pins, and verifies a pin through the module root (SC-SK-034)", () => {
		const keyPair: ReceiptKeyPair = generateReceiptKeyPair("exports-smoke");
		const skill: SkillDefinition = {
			id: "pe.igv-validate",
			version: "1.0.0",
			jurisdiction: "PE",
			validity: { from: "2026-01-01", to: "2026-12-31" },
			normativeSources: ["SUNAT: Decreto Supremo 055-99-EF"],
			inputs: ["invoice"],
			outputs: ["igv-validation"],
			requiredPermissions: ["evidence:read"],
			maxAutonomy: "R1",
			contractCompatibility: ["candidate@0.1"],
			retirementPolicy: "superseded-by-next-major",
			checksum: "",
		};
		skill.checksum = computeSkillChecksum(skill);

		const signed: SignedSkillPack = signSkillPack(skill, keyPair);
		const verified = verifySkillPack(signed, keyPair.publicKey);
		expect(verified.valid).toBe(true);

		const created = createMissionSkillPin([signed], "2026-06-15");
		expect(created.valid).toBe(true);
		if (!created.valid) return;
		const pin: MissionSkillPin = created.pin;
		const pinVerified = verifyMissionSkillPin(pin, [signed], "2026-06-15");
		expect(pinVerified.valid).toBe(true);
	});

	it("declares the existing ./skills subpath without adding a new one (REQ-SK-012)", () => {
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as { exports: Record<string, string> };
		expect(packageJson.exports["./skills"]).toBe("./dist/skills/index.js");
		const skillsSubpaths = Object.keys(packageJson.exports).filter((key) =>
			key.startsWith("./skills"),
		);
		expect(skillsSubpaths).toEqual(["./skills"]);
	});
});
