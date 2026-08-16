/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Signed skill packs — signing, canonical payload, tamper, malformed crypto
 * input, determinism, and immutability (SDD-070, REQ-SK-001..005/008/015).
 */
import { createPrivateKey, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	canonicalSkillJson,
	computeSkillChecksum,
	generateReceiptKeyPair,
	signSkillPack,
	SkillPackSigningError,
	verifySkillPack,
	type ReceiptKeyPair,
	type SignedSkillPack,
	type SkillDefinition,
} from "../index.js";

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

/** Top-level-only key sorting; keeps nested objects in caller key order. */
function shallowCanonicalJson(skill: SkillDefinition): string {
	const shallow: Record<string, unknown> = {};
	for (const key of Object.keys(skill)
		.filter((key) => key !== "checksum")
		.sort()) {
		shallow[key] = (skill as unknown as Record<string, unknown>)[key];
	}
	return JSON.stringify(shallow);
}

/** Flip one byte of the decoded signature and re-encode (canonical base64). */
function mutateSignatureBytes(signatureBase64: string): string {
	const bytes = Buffer.from(signatureBase64, "base64");
	bytes[0] ^= 1;
	return bytes.toString("base64");
}

/** Assert a signing boundary failure with the expected closed code. */
function expectSigningError(fn: () => unknown, code: SkillPackSigningError["code"]): void {
	expect(fn).toThrow(SkillPackSigningError);
	try {
		fn();
		expect.unreachable();
	} catch (error) {
		expect(error).toBeInstanceOf(SkillPackSigningError);
		expect((error as SkillPackSigningError).code).toBe(code);
	}
}

describe("SIG-1 signing a valid skill (REQ-SK-001)", () => {
	it("signs a valid Peru skill and returns a frozen wrapper with provenance", () => {
		const keyPair = generateReceiptKeyPair("sig-test-key");
		const signed = signSkillPack(baseSkill(), keyPair);

		expect(signed.pack.id).toBe("pe.igv-validate");
		expect(signed.signerKeyId).toBe("sig-test-key");
		expect(signed.signerPublicKey).toBe(keyPair.publicKey);
		expect(typeof signed.signature).toBe("string");
		expect(Buffer.from(signed.signature, "base64")).toHaveLength(64);
		expect(signed.signedAt).toBeUndefined();
		expect(Object.isFrozen(signed)).toBe(true);
		expect(Object.isFrozen(signed.pack)).toBe(true);
	});

	it("keeps the definition checksum unchanged and returns fresh copies", () => {
		const keyPair = generateReceiptKeyPair();
		const pack = baseSkill();
		const signed = signSkillPack(pack, keyPair);

		expect(signed.pack.checksum).toBe(pack.checksum);
		expect(signed.pack).not.toBe(pack);
		expect(signed.pack.normativeSources).not.toBe(pack.normativeSources);
	});

	it("verifies a correctly signed pack with both dimensions valid (SC-SK-005)", () => {
		const keyPair = generateReceiptKeyPair("verify-key");
		const signed = signSkillPack(baseSkill(), keyPair);
		const result = verifySkillPack(signed, keyPair.publicKey);

		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.checksumValid).toBe(true);
			expect(result.signatureValid).toBe(true);
			expect(result.pack).not.toBe(signed);
			expect(Object.isFrozen(result.pack)).toBe(true);
			expect(result.pack.pack).not.toBe(signed.pack);
			expect(Object.isFrozen(result.pack.pack)).toBe(true);
			expect(result.pack.pack.checksum).toBe(signed.pack.checksum);
		}
	});

	it("treats a manually attached signedAt as provenance-only", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const withDate: SignedSkillPack = { ...signed, signedAt: "2026-01-01" };
		const result = verifySkillPack(withDate, keyPair.publicKey);
		expect(result.valid).toBe(true);
	});
});

describe("SIG-2 shared canonical payload (REQ-SK-002)", () => {
	it("accepts nested key-order changes that canonicalize to the same payload (SC-SK-002)", () => {
		const keyPair = generateReceiptKeyPair();
		const packA = baseSkill();
		const packB = baseSkill({ validity: { to: "2026-12-31", from: "2026-01-01" } });

		expect(JSON.stringify(packA.validity)).not.toBe(JSON.stringify(packB.validity));
		expect(canonicalSkillJson(packA)).toBe(canonicalSkillJson(packB));

		const signedA = signSkillPack(packA, keyPair);
		const presented: SignedSkillPack = { ...signedA, pack: packB };
		const result = verifySkillPack(presented, keyPair.publicKey);
		expect(result.valid).toBe(true);
	});

	it("rejects a signature over shallow top-level canonicalization (SC-SK-003)", () => {
		const keyPair = generateReceiptKeyPair();
		const pack = baseSkill({ validity: { to: "2026-12-31", from: "2026-01-01" } });
		const shallow = shallowCanonicalJson(pack);
		expect(shallow).not.toBe(canonicalSkillJson(pack));

		const privateKey = createPrivateKey({
			key: Buffer.from(keyPair.privateKey, "base64"),
			format: "der",
			type: "pkcs8",
		});
		const signature = sign(
			null,
			Buffer.from(shallow, "utf8"),
			privateKey,
		).toString("base64");
		const presented: SignedSkillPack = {
			pack,
			signerKeyId: keyPair.keyId,
			signerPublicKey: keyPair.publicKey,
			signature,
		};
		const result = verifySkillPack(presented, keyPair.publicKey);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.checksumValid).toBe(true);
			expect(result.signatureValid).toBe(false);
			expect(result.error.reasons).toEqual(["signature-invalid"]);
		}
	});

	it("fails on nested canonical content tamper even when structurally well formed (SC-SK-009)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const tampered: SignedSkillPack = {
			...signed,
			pack: { ...signed.pack, normativeSources: ["SUNAT: DOCTORED SOURCE"] },
		};
		const result = verifySkillPack(tampered, keyPair.publicKey);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.checksumValid).toBe(false);
			expect(result.signatureValid).toBe(false);
			expect(result.error.reasons).toEqual(["checksum-mismatch", "signature-invalid"]);
			expect(Object.isFrozen(result)).toBe(true);
			expect(Object.isFrozen(result.error)).toBe(true);
			expect(Object.isFrozen(result.error.reasons)).toBe(true);
		}
	});
});

describe("SIG-3 tamper and key mismatch fail closed (REQ-SK-004/005)", () => {
	it("rejects re-checksummed tampered content (SC-SK-010)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const tamperedPack: SkillDefinition = {
			...signed.pack,
			maxAutonomy: "R2",
		};
		tamperedPack.checksum = computeSkillChecksum(tamperedPack);
		const presented: SignedSkillPack = { ...signed, pack: tamperedPack };
		const result = verifySkillPack(presented, keyPair.publicKey);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.checksumValid).toBe(true);
			expect(result.signatureValid).toBe(false);
			expect(result.error.reasons).toEqual(["signature-invalid"]);
		}
	});

	it("distinguishes checksum-only failure (SC-SK-006)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const altered: SignedSkillPack = {
			...signed,
			pack: { ...signed.pack, checksum: "f".repeat(64) },
		};
		const result = verifySkillPack(altered, keyPair.publicKey);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.checksumValid).toBe(false);
			expect(result.signatureValid).toBe(true);
			expect(result.error.reasons).toEqual(["checksum-mismatch"]);
		}
	});

	it("distinguishes signature-only failure and rejects mutated signature bytes (SC-SK-007/011)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const mutated: SignedSkillPack = {
			...signed,
			signature: mutateSignatureBytes(signed.signature),
		};
		const result = verifySkillPack(mutated, keyPair.publicKey);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.checksumValid).toBe(true);
			expect(result.signatureValid).toBe(false);
			expect(result.error.reasons).toEqual(["signature-invalid"]);
		}
	});

	it("rejects a wrong public key (SC-SK-012)", () => {
		const signerKey = generateReceiptKeyPair("signer");
		const otherKey = generateReceiptKeyPair("other");
		const signed = signSkillPack(baseSkill(), signerKey);
		const result = verifySkillPack(signed, otherKey.publicKey);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.signatureValid).toBe(false);
			expect(result.error.reasons).toEqual(["public-key-mismatch"]);
		}
	});
});

describe("SIG-4 malformed crypto input fails closed without throwing (REQ-SK-005)", () => {
	it("returns invalid for a non-base64 embedded public key (SC-SK-013)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const bad: SignedSkillPack = { ...signed, signerPublicKey: "not-a-real-key!!" };

		expect(() => verifySkillPack(bad, keyPair.publicKey)).not.toThrow();
		const result = verifySkillPack(bad, keyPair.publicKey);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.reasons).toEqual(["malformed-public-key"]);
		}
	});

	it("returns invalid for base64 that is not decodable SPKI DER (SC-SK-013)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const bad: SignedSkillPack = {
			...signed,
			signerPublicKey: Buffer.alloc(4, 1).toString("base64"),
		};

		const result = verifySkillPack(bad, keyPair.publicKey);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.reasons).toEqual(["malformed-public-key"]);
		}
	});

	it("returns invalid for a non-base64 signature without throwing (SC-SK-014)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const bad: SignedSkillPack = { ...signed, signature: "!!!not-base64!!!" };

		expect(() => verifySkillPack(bad, keyPair.publicKey)).not.toThrow();
		const result = verifySkillPack(bad, keyPair.publicKey);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.reasons).toEqual(["malformed-signature"]);
		}
	});

	it("returns invalid for a signature that decodes to the wrong length (SC-SK-014)", () => {
		const keyPair = generateReceiptKeyPair();
		const signed = signSkillPack(baseSkill(), keyPair);
		const bad: SignedSkillPack = {
			...signed,
			signature: Buffer.alloc(1, 9).toString("base64"),
		};

		const result = verifySkillPack(bad, keyPair.publicKey);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.reasons).toEqual(["malformed-signature"]);
		}
	});

	it("throws only the typed signing error for malformed private material", () => {
		const keyPair = generateReceiptKeyPair();
		const badPrivate: ReceiptKeyPair = { ...keyPair, privateKey: "not-a-key!!" };
		expectSigningError(() => signSkillPack(baseSkill(), badPrivate), "malformed-private-key");

		const badPublic: ReceiptKeyPair = { ...keyPair, publicKey: "not-a-key!!" };
		expectSigningError(() => signSkillPack(baseSkill(), badPublic), "malformed-public-key");
	});

	it("rejects a mismatched key pair at signing (D4)", () => {
		const keyA = generateReceiptKeyPair();
		const keyB = generateReceiptKeyPair();
		const mismatched: ReceiptKeyPair = {
			privateKey: keyA.privateKey,
			publicKey: keyB.publicKey,
			keyId: "mixed",
		};
		expectSigningError(() => signSkillPack(baseSkill(), mismatched), "key-pair-mismatch");
	});
});

describe("SIG-5 determinism and immutability (REQ-SK-015/008)", () => {
	it("signs the same pack twice with identical signatures and payloads (SC-SK-037)", () => {
		const keyPair = generateReceiptKeyPair("repeatable");
		const pack = baseSkill();
		const first = signSkillPack(pack, keyPair);
		const second = signSkillPack(pack, keyPair);

		expect(first.signature).toBe(second.signature);
		expect(first.pack).toEqual(second.pack);
		expect(verifySkillPack(first, keyPair.publicKey).valid).toBe(true);
		expect(verifySkillPack(second, keyPair.publicKey).valid).toBe(true);
	});

	it("keeps the signed copy immutable when the caller mutates the source (REQ-SK-008)", () => {
		const keyPair = generateReceiptKeyPair();
		const pack = baseSkill();
		const signed = signSkillPack(pack, keyPair);

		pack.version = "9.9.9";
		(pack.normativeSources as string[]).push("injected after signing");

		expect(signed.pack.version).toBe("1.0.0");
		expect(signed.pack.normativeSources).not.toContain("injected after signing");
		expect(Object.isFrozen(signed.pack)).toBe(true);
		expect(Object.isFrozen(signed.pack.normativeSources)).toBe(true);
		expect(() => {
			signed.pack.version = "8.8.8";
		}).toThrow(TypeError);
	});
});
