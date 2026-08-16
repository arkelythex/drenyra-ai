/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission skill pins — creation, deterministic ordering, full-set membership,
 * drift dimensions, vigencia semantics, immutability, and purity (SDD-070,
 * REQ-SK-006..011/015).
 */
import { describe, expect, it } from "vitest";
import {
	computeSkillChecksum,
	createMissionSkillPin,
	generateReceiptKeyPair,
	signSkillPack,
	verifyMissionSkillPin,
	verifySkillPack,
	type MissionSkillPin,
	type SignedSkillPack,
	type SkillDefinition,
} from "../index.js";

const KEY = generateReceiptKeyPair("pin-key");
const IN_FORCE = "2026-06-15";

/** Valid Peru skill definition with a correct checksum. */
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

/** pe.igv-validate@1.0.0, bounded 2026-01-01..2026-12-31. */
function skillA(): SkillDefinition {
	return baseSkill();
}

/** pe.sire-compare@1.0.0, open-ended from 2026-03-01. */
function skillB(): SkillDefinition {
	return baseSkill({
		id: "pe.sire-compare",
		validity: { from: "2026-03-01" },
	});
}

function signedA(): SignedSkillPack {
	return signSkillPack(skillA(), KEY);
}

function signedB(): SignedSkillPack {
	return signSkillPack(skillB(), KEY);
}

/** Create a valid pin over {A, B} at the in-force reference date. */
function createBasePin(): MissionSkillPin {
	const result = createMissionSkillPin([signedA(), signedB()], IN_FORCE);
	if (!result.valid) throw new Error("base pin creation unexpectedly denied");
	return result.pin;
}

describe("PIN-1 pin creation binds the full set (REQ-SK-006)", () => {
	it("binds id, version, checksum, jurisdiction, and vigencia per skill (SC-SK-015)", () => {
		const a = signedA();
		const b = signedB();
		const result = createMissionSkillPin([a, b], IN_FORCE);

		expect(result.valid).toBe(true);
		if (!result.valid) return;
		expect(result.pin.entries).toHaveLength(2);
		const [first, second] = result.pin.entries;
		expect(first).toEqual({
			id: a.pack.id,
			version: a.pack.version,
			checksum: a.pack.checksum,
			jurisdiction: a.pack.jurisdiction,
			vigencia: { from: a.pack.validity.from, to: a.pack.validity.to },
		});
		expect(second).toEqual({
			id: b.pack.id,
			version: b.pack.version,
			checksum: b.pack.checksum,
			jurisdiction: b.pack.jurisdiction,
			vigencia: { from: b.pack.validity.from },
		});
	});

	it("freezes the pin, entries, and vigencia windows (REQ-SK-008)", () => {
		const result = createMissionSkillPin([signedA(), signedB()], IN_FORCE);
		expect(result.valid).toBe(true);
		if (!result.valid) return;
		const { pin } = result;
		expect(Object.isFrozen(pin)).toBe(true);
		expect(Object.isFrozen(pin.entries)).toBe(true);
		for (const entry of pin.entries) {
			expect(Object.isFrozen(entry)).toBe(true);
			expect(Object.isFrozen(entry.vigencia)).toBe(true);
		}
	});

	it("re-verifies every supplied pack before binding (REQ-SK-006)", () => {
		const a = signedA();
		const tampered: SignedSkillPack = {
			...a,
			signature: Buffer.alloc(64, 7).toString("base64"),
		};
		const result = createMissionSkillPin([tampered, signedB()], IN_FORCE);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.code).toBe("mission-skill-pin-denied");
			expect(result.denial.reasons.map((r) => r.code)).toContain(
				"candidate-signature-invalid",
			);
			expect(Object.isFrozen(result)).toBe(true);
			expect(Object.isFrozen(result.denial)).toBe(true);
			expect(Object.isFrozen(result.denial.reasons)).toBe(true);
		}
	});
});

describe("PIN-2 creation denies malformed or out-of-force sets (REQ-SK-006, D5/D9)", () => {
	it("denies duplicate identities (SC-SK-016)", () => {
		const result = createMissionSkillPin([signedA(), signedA()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "duplicate-candidate-identity", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("denies a pack with an invalid signature", () => {
		const bad: SignedSkillPack = { ...signedA(), signature: "AAAA".repeat(16) };
		const result = createMissionSkillPin([bad, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toContain(
				"candidate-signature-invalid",
			);
		}
	});

	it("denies a pack whose asserted checksum no longer matches its content", () => {
		const a = signedA();
		const tampered: SignedSkillPack = {
			...a,
			pack: { ...a.pack, maxAutonomy: "R2" },
		};
		const result = createMissionSkillPin([tampered, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toContain("checksum-mismatch");
		}
	});

	it("denies malformed candidates without throwing", () => {
		const result = createMissionSkillPin([42 as unknown as SignedSkillPack], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toEqual(["candidate-malformed"]);
		}
	});

	it("denies an invalid reference date", () => {
		const result = createMissionSkillPin([signedA()], "2026-13-40");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toEqual([
				"invalid-reference-date",
			]);
		}
	});

	it("denies a skill that is not yet in force", () => {
		const result = createMissionSkillPin([signedA()], "2025-12-31");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "skill-out-of-force", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("denies a skill lapsed at its exclusive to", () => {
		const result = createMissionSkillPin([signedA()], "2026-12-31");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toEqual(["skill-out-of-force"]);
		}
	});
});

describe("PIN-3 deterministic ordering and exact membership (REQ-SK-006/007)", () => {
	it("produces identical deterministically ordered pins for reversed orders (SC-SK-017)", () => {
		const ab = createMissionSkillPin([signedA(), signedB()], IN_FORCE);
		const ba = createMissionSkillPin([signedB(), signedA()], IN_FORCE);
		expect(ab.valid).toBe(true);
		expect(ba.valid).toBe(true);
		if (!ab.valid || !ba.valid) return;
		expect(ab.pin.entries.map((e) => e.id)).toEqual([
			"pe.igv-validate",
			"pe.sire-compare",
		]);
		expect(ab.pin).toEqual(ba.pin);
	});

	it("orders by id then numeric semver for same-id versions", () => {
		const a1 = signedA();
		const a2 = signSkillPack(baseSkill({ version: "1.1.0" }), KEY);
		const b = signedB();
		const result = createMissionSkillPin([a2, b, a1], IN_FORCE);
		expect(result.valid).toBe(true);
		if (!result.valid) return;
		expect(result.pin.entries.map((e) => `${e.id}@${e.version}`)).toEqual([
			"pe.igv-validate@1.0.0",
			"pe.igv-validate@1.1.0",
			"pe.sire-compare@1.0.0",
		]);
	});

	it("fails verification on a missing entry (SC-SK-018)", () => {
		const pin = createBasePin();
		const result = verifyMissionSkillPin(pin, [signedA()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "missing-skill", identity: "pe.sire-compare@1.0.0" },
			]);
		}
	});

	it("fails verification on an additional entry (SC-SK-019)", () => {
		const pin = createBasePin();
		const extra = signSkillPack(baseSkill({ id: "pe.detraction-check" }), KEY);
		const result = verifyMissionSkillPin(pin, [signedA(), signedB(), extra], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "additional-skill", identity: "pe.detraction-check@1.0.0" },
			]);
		}
	});

	it("fails verification on a duplicate candidate identity (SC-SK-020)", () => {
		const pin = createBasePin();
		const result = verifyMissionSkillPin(pin, [signedA(), signedB(), signedA()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "duplicate-candidate-identity", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("fails verification on an identity-mismatched set (REQ-SK-007)", () => {
		const pin = createBasePin();
		const drifted = signSkillPack(baseSkill({ version: "1.1.0" }), KEY);
		const result = verifyMissionSkillPin(pin, [drifted, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			const codes = result.denial.reasons.map((r) => r.code);
			expect(codes).toContain("missing-skill");
			expect(codes).toContain("additional-skill");
			expect(codes).toContain("version-mismatch");
		}
	});

	it("fails verification on a duplicate pin identity", () => {
		const pin = createBasePin();
		const dupPin: MissionSkillPin = {
			entries: [...pin.entries, pin.entries[0]],
		};
		const result = verifyMissionSkillPin(dupPin, [signedA(), signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "duplicate-pin-identity", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});
});

describe("PIN-4 typed drift dimensions (REQ-SK-009)", () => {
	it("reports checksum drift (SC-SK-024)", () => {
		const pin = createBasePin();
		const tampered: SkillDefinition = { ...signedA().pack, maxAutonomy: "R2" };
		tampered.checksum = computeSkillChecksum(tampered);
		const candidate: SignedSkillPack = { ...signedA(), pack: tampered };
		const result = verifyMissionSkillPin(pin, [candidate, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toContain("checksum-mismatch");
		}
	});

	it("reports version drift with exact reasons (SC-SK-025)", () => {
		const pin = createBasePin();
		const drifted = signSkillPack(baseSkill({ version: "1.1.0" }), KEY);
		const result = verifyMissionSkillPin(pin, [drifted, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "missing-skill", identity: "pe.igv-validate@1.0.0" },
				{ code: "additional-skill", identity: "pe.igv-validate@1.1.0" },
				{ code: "version-mismatch", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("reports jurisdiction drift (SC-SK-026)", () => {
		const pin = createBasePin();
		const drifted = signSkillPack(baseSkill({ jurisdiction: "CL" }), KEY);
		const result = verifyMissionSkillPin(pin, [drifted, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			// Jurisdiction is canonical content, so the checksum drifts too; both
			// dimensions are reported in closed code order (D10).
			expect(result.denial.reasons).toEqual([
				{ code: "checksum-mismatch", identity: "pe.igv-validate@1.0.0" },
				{ code: "jurisdiction-mismatch", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("reports vigencia from drift (SC-SK-027)", () => {
		const pin = createBasePin();
		const drifted = signSkillPack(
			baseSkill({ validity: { from: "2026-02-01", to: "2026-12-31" } }),
			KEY,
		);
		const result = verifyMissionSkillPin(pin, [drifted, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "checksum-mismatch", identity: "pe.igv-validate@1.0.0" },
				{ code: "vigencia-mismatch", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("reports vigencia to drift", () => {
		const pin = createBasePin();
		const drifted = signSkillPack(
			baseSkill({ validity: { from: "2026-01-01", to: "2026-11-30" } }),
			KEY,
		);
		const result = verifyMissionSkillPin(pin, [drifted, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "checksum-mismatch", identity: "pe.igv-validate@1.0.0" },
				{ code: "vigencia-mismatch", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("reports open-ended-window drift when the bound window has a to", () => {
		const pin = createBasePin();
		const drifted = signSkillPack(
			baseSkill({ validity: { from: "2026-01-01" } }),
			KEY,
		);
		const result = verifyMissionSkillPin(pin, [drifted, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "checksum-mismatch", identity: "pe.igv-validate@1.0.0" },
				{ code: "vigencia-mismatch", identity: "pe.igv-validate@1.0.0" },
			]);
		}
	});

	it("reports an unauthenticated candidate (SC-SK-028)", () => {
		const pin = createBasePin();
		const unauthenticated: SignedSkillPack = {
			...signedA(),
			signature: Buffer.alloc(64, 9).toString("base64"),
		};
		const result = verifyMissionSkillPin(pin, [unauthenticated, signedB()], IN_FORCE);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toContain(
				"candidate-signature-invalid",
			);
		}
	});
});

describe("PIN-5 vigencia semantics (REQ-SK-011)", () => {
	it("from === referenceDate is in force (SC-SK-030)", () => {
		const pin = createMissionSkillPin([signedA()], "2026-01-01");
		expect(pin.valid).toBe(true);
		if (!pin.valid) return;
		const result = verifyMissionSkillPin(pin.pin, [signedA()], "2026-01-01");
		expect(result.valid).toBe(true);
	});

	it("to === referenceDate is lapsed (SC-SK-031)", () => {
		const creation = createMissionSkillPin([signedA()], "2026-12-31");
		expect(creation.valid).toBe(false);
		if (!creation.valid) {
			expect(creation.denial.reasons.map((r) => r.code)).toEqual([
				"skill-out-of-force",
			]);
		}

		const pin = createBasePin();
		const result = verifyMissionSkillPin(pin, [signedA(), signedB()], "2026-12-31");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons.map((r) => r.code)).toEqual(["skill-out-of-force"]);
		}
	});

	it("before from is not in force (SC-SK-032)", () => {
		const pin = createBasePin();
		const result = verifyMissionSkillPin(pin, [signedA(), signedB()], "2025-12-31");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.denial.reasons).toEqual([
				{ code: "skill-out-of-force", identity: "pe.igv-validate@1.0.0" },
				{ code: "skill-out-of-force", identity: "pe.sire-compare@1.0.0" },
			]);
		}
	});

	it("open-ended vigencia stays in force after from (SC-SK-033)", () => {
		const pin = createMissionSkillPin([signedB()], "2027-06-01");
		expect(pin.valid).toBe(true);
		if (!pin.valid) return;
		const result = verifyMissionSkillPin(pin.pin, [signedB()], "2027-06-01");
		expect(result.valid).toBe(true);
	});
});

describe("PIN-6 runtime immutability (REQ-SK-008)", () => {
	it("rejects mutation of the pin, its entries, and vigencia (SC-SK-021)", () => {
		const pin = createBasePin();
		expect(Object.isFrozen(pin)).toBe(true);
		expect(Object.isFrozen(pin.entries)).toBe(true);
		expect(Object.isFrozen(pin.entries[0])).toBe(true);
		expect(Object.isFrozen(pin.entries[0].vigencia)).toBe(true);

		expect(() => {
			(pin as { entries: unknown }).entries = [];
		}).toThrow(TypeError);
		expect(() => {
			(pin.entries[0] as { id: string }).id = "mutated";
		}).toThrow(TypeError);
		expect(() => {
			(pin.entries[0].vigencia as { from: string }).from = "2099-01-01";
		}).toThrow(TypeError);
		expect(pin.entries[0].id).toBe("pe.igv-validate");
		expect(pin.entries[0].vigencia.from).toBe("2026-01-01");
	});

	it("keeps the pin unchanged when source packs are mutated later (SC-SK-022)", () => {
		const pack = skillA();
		const signed = signSkillPack(pack, KEY);
		const other = signedB();
		const result = createMissionSkillPin([signed, other], IN_FORCE);
		expect(result.valid).toBe(true);
		if (!result.valid) return;
		const pin = result.pin;

		pack.version = "2.0.0";
		pack.checksum = computeSkillChecksum(pack);
		expect(pin.entries.map((e) => e.version)).toEqual(["1.0.0", "1.0.0"]);

		const reSigned = signSkillPack(pack, KEY);
		const verification = verifyMissionSkillPin(pin, [reSigned, other], IN_FORCE);
		expect(verification.valid).toBe(false);
		if (!verification.valid) {
			expect(verification.denial.reasons.map((r) => r.code)).toContain(
				"version-mismatch",
			);
		}
	});
});

describe("PIN-7 determinism and statelessness (REQ-SK-010/015)", () => {
	it("reversed caller order yields deeply equal pins (SC-SK-017)", () => {
		const first = createMissionSkillPin([signedA(), signedB()], IN_FORCE);
		const second = createMissionSkillPin([signedB(), signedA()], IN_FORCE);
		expect(first.valid).toBe(true);
		expect(second.valid).toBe(true);
		if (!first.valid || !second.valid) return;
		expect(first.pin).toEqual(second.pin);
	});

	it("repeated and interleaved calls return identical results (SC-SK-029)", () => {
		const a = signedA();
		const b = signedB();
		const first = createMissionSkillPin([a, b], IN_FORCE);
		expect(first.valid).toBe(true);

		expect(verifySkillPack(a, KEY.publicKey).valid).toBe(true);

		const second = createMissionSkillPin([a, b], IN_FORCE);
		expect(second.valid).toBe(true);
		if (!first.valid || !second.valid) return;
		expect(second.pin).toEqual(first.pin);

		const verify1 = verifyMissionSkillPin(first.pin, [a, b], IN_FORCE);
		const verify2 = verifyMissionSkillPin(first.pin, [a, b], IN_FORCE);
		expect(verify1).toEqual(verify2);
		expect(verify1.valid).toBe(true);
	});
});
