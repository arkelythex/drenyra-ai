/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Signed skill packs — Ed25519-authenticated skill definitions (SDD-070).
 *
 * The signature covers exactly `canonicalSkillJson(pack)` — the same recursive
 * key-sorted payload used by `computeSkillChecksum` — so checksum and signature
 * canonicalization can never diverge. The key format reuses the receipt
 * convention (PKCS8 DER base64 private keys, SPKI DER base64 public keys)
 * without reusing the receipt serializers, which use a different, shallow
 * canonicalization. Signing is a construction boundary (throws a closed typed
 * error); verification consumes untrusted artifacts and never throws.
 */

import {
	createPrivateKey,
	createPublicKey,
	sign,
	verify,
	type KeyObject,
} from "node:crypto";
import { computeSkillChecksum, validateSkill } from "./registry.js";
import {
	canonicalSkillJson,
	type IsoDate,
	type SkillDefinition,
	type SkillValidity,
} from "./types.js";
import type { ReceiptKeyPair } from "../receipts/types.js";

export { generateReceiptKeyPair } from "../receipts/sign.js";
export type { ReceiptKeyPair } from "../receipts/types.js";

/** A skill definition wrapped with its provenance; content and provenance never mix. */
export interface SignedSkillPack {
	readonly pack: SkillDefinition;
	readonly signerKeyId: string;
	readonly signerPublicKey: string; // SPKI DER base64
	readonly signature: string; // Ed25519 base64
	readonly signedAt?: IsoDate;
}

/** Closed vocabulary of signing construction failures. */
export type SkillPackSigningErrorCode =
	| "invalid-skill-definition"
	| "checksum-mismatch"
	| "malformed-private-key"
	| "malformed-public-key"
	| "key-pair-mismatch";

/** Construction boundary failure: signing throws this, and only this. */
export class SkillPackSigningError extends Error {
	constructor(
		message: string,
		readonly code: SkillPackSigningErrorCode,
	) {
		super(message);
		this.name = "SkillPackSigningError";
	}
}

/** Closed vocabulary of verification denials (checksum and signature dimensions). */
export type SkillPackVerificationReason =
	| "malformed-signed-pack"
	| "checksum-mismatch"
	| "malformed-public-key"
	| "public-key-mismatch"
	| "malformed-signature"
	| "signature-invalid";

/** Discriminated verification result; verification never throws. */
export type SkillPackVerification =
	| {
			readonly valid: true;
			readonly checksumValid: true;
			readonly signatureValid: true;
			readonly pack: SignedSkillPack;
	  }
	| {
			readonly valid: false;
			readonly checksumValid: boolean;
			readonly signatureValid: boolean;
			readonly error: {
				readonly code: "skill-pack-verification-failed";
				readonly reasons: readonly SkillPackVerificationReason[];
			};
	  };

const SIGNATURE_BYTE_LENGTH = 64;
const BASE64_ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;

/** Strict base64 decode: rejects empty, wrong length, non-alphabet, and non-canonical input. */
function decodeStrictBase64(value: string): Buffer {
	if (value.length === 0) throw new Error("empty base64 input");
	if (value.length % 4 !== 0) throw new Error("base64 length is not a multiple of 4");
	if (!BASE64_ALPHABET.test(value)) throw new Error("base64 input contains invalid characters");
	const decoded = Buffer.from(value, "base64");
	if (decoded.toString("base64") !== value) {
		throw new Error("base64 input is not canonically encoded");
	}
	return decoded;
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Copy every mutable part of a skill definition into a fresh, frozen graph. */
function cloneSkillDefinition(skill: SkillDefinition): SkillDefinition {
	const validity: SkillValidity = Object.freeze({ ...skill.validity });
	return Object.freeze({
		id: skill.id,
		version: skill.version,
		jurisdiction: skill.jurisdiction,
		validity,
		normativeSources: Object.freeze([...skill.normativeSources]),
		inputs: Object.freeze([...skill.inputs]),
		outputs: Object.freeze([...skill.outputs]),
		requiredPermissions: Object.freeze([...skill.requiredPermissions]),
		maxAutonomy: skill.maxAutonomy,
		contractCompatibility: Object.freeze([...skill.contractCompatibility]),
		checksum: skill.checksum,
		retirementPolicy: skill.retirementPolicy,
	});
}

/** Copy a signed pack graph into a fresh, frozen wrapper. */
function cloneSignedSkillPack(signed: SignedSkillPack): SignedSkillPack {
	const wrapper: SignedSkillPack = {
		pack: cloneSkillDefinition(signed.pack),
		signerKeyId: signed.signerKeyId,
		signerPublicKey: signed.signerPublicKey,
		signature: signed.signature,
		...(signed.signedAt === undefined ? {} : { signedAt: signed.signedAt }),
	};
	return Object.freeze(wrapper);
}

/**
 * Sign a validated skill definition with a receipt-convention key pair.
 * Returns a fresh, frozen wrapper; throws only `SkillPackSigningError`.
 */
export function signSkillPack(
	pack: SkillDefinition,
	keyPair: ReceiptKeyPair,
): SignedSkillPack {
	let canonical: string;
	let expectedChecksum: string;
	try {
		validateSkill(pack);
		canonical = canonicalSkillJson(pack);
		expectedChecksum = computeSkillChecksum(pack);
	} catch (error) {
		throw new SkillPackSigningError(
			`invalid skill definition: ${describeError(error)}`,
			"invalid-skill-definition",
		);
	}
	if (pack.checksum !== expectedChecksum) {
		throw new SkillPackSigningError(
			`skill checksum mismatch for ${pack.id}@${pack.version}: expected ${expectedChecksum}, got ${pack.checksum}`,
			"checksum-mismatch",
		);
	}

	let privateKey: KeyObject;
	try {
		const privateDer = decodeStrictBase64(keyPair.privateKey);
		privateKey = createPrivateKey({ key: privateDer, format: "der", type: "pkcs8" });
		if (privateKey.asymmetricKeyType !== "ed25519") {
			throw new Error("private key is not Ed25519");
		}
	} catch (error) {
		throw new SkillPackSigningError(
			`malformed private key: ${describeError(error)}`,
			"malformed-private-key",
		);
	}

	let publicKey: KeyObject;
	try {
		const publicDer = decodeStrictBase64(keyPair.publicKey);
		publicKey = createPublicKey({ key: publicDer, format: "der", type: "spki" });
		if (publicKey.asymmetricKeyType !== "ed25519") {
			throw new Error("public key is not Ed25519");
		}
	} catch (error) {
		throw new SkillPackSigningError(
			`malformed public key: ${describeError(error)}`,
			"malformed-public-key",
		);
	}

	let signature: Buffer;
	try {
		signature = sign(null, Buffer.from(canonical, "utf8"), privateKey);
	} catch (error) {
		throw new SkillPackSigningError(
			`signing failed: ${describeError(error)}`,
			"malformed-private-key",
		);
	}

	let signatureMatchesPublicKey = false;
	try {
		signatureMatchesPublicKey = verify(
			null,
			Buffer.from(canonical, "utf8"),
			publicKey,
			signature,
		);
	} catch (error) {
		throw new SkillPackSigningError(
			`key verification failed: ${describeError(error)}`,
			"key-pair-mismatch",
		);
	}
	if (!signatureMatchesPublicKey) {
		throw new SkillPackSigningError(
			"private key does not match the supplied public key",
			"key-pair-mismatch",
		);
	}

	const wrapper: SignedSkillPack = {
		pack: cloneSkillDefinition(pack),
		signerKeyId: keyPair.keyId,
		signerPublicKey: keyPair.publicKey,
		signature: signature.toString("base64"),
	};
	return Object.freeze(wrapper);
}

/** Verify a signed pack; never throws; returns a frozen discriminated result. */
export function verifySkillPack(
	signed: SignedSkillPack,
	publicKey: string,
): SkillPackVerification {
	try {
		return verifySkillPackUnchecked(signed, publicKey);
	} catch {
		return invalidVerification(false, false, ["malformed-signed-pack"]);
	}
}

function verifySkillPackUnchecked(
	signed: SignedSkillPack,
	publicKey: string,
): SkillPackVerification {
	if (!isSignedSkillPackShape(signed)) {
		return invalidVerification(false, false, ["malformed-signed-pack"]);
	}

	const reasons: SkillPackVerificationReason[] = [];
	const canonical = canonicalSkillJson(signed.pack);
	const checksumValid =
		computeSkillChecksum(signed.pack) === signed.pack.checksum;
	if (!checksumValid) reasons.push("checksum-mismatch");

	let signatureValid = false;
	const embeddedKey = decodeEd25519Spki(signed.signerPublicKey);
	if (embeddedKey === undefined) {
		reasons.push("malformed-public-key");
	} else if (signed.signerPublicKey !== publicKey) {
		reasons.push("public-key-mismatch");
	} else {
		const outcome = verifyEd25519Signature(canonical, signed.signature, embeddedKey);
		if (outcome === "malformed") {
			reasons.push("malformed-signature");
		} else {
			signatureValid = outcome;
			if (!signatureValid) reasons.push("signature-invalid");
		}
	}

	if (reasons.length === 0 && checksumValid && signatureValid) {
		return Object.freeze({
			valid: true,
			checksumValid: true,
			signatureValid: true,
			pack: cloneSignedSkillPack(signed),
		});
	}
	return invalidVerification(checksumValid, signatureValid, reasons);
}

function invalidVerification(
	checksumValid: boolean,
	signatureValid: boolean,
	reasons: readonly SkillPackVerificationReason[],
): SkillPackVerification {
	return Object.freeze({
		valid: false,
		checksumValid,
		signatureValid,
		error: Object.freeze({
			code: "skill-pack-verification-failed",
			reasons: Object.freeze([...reasons]),
		}),
	});
}

/** Decode SPKI DER base64 into an Ed25519 key, or undefined when malformed. */
function decodeEd25519Spki(value: string): KeyObject | undefined {
	try {
		const der = decodeStrictBase64(value);
		const key = createPublicKey({ key: der, format: "der", type: "spki" });
		if (key.asymmetricKeyType !== "ed25519") return undefined;
		return key;
	} catch {
		return undefined;
	}
}

/** Verify an Ed25519 signature; "malformed" means the signature base64/bytes are invalid. */
function verifyEd25519Signature(
	canonicalPayload: string,
	signatureBase64: string,
	publicKey: KeyObject,
): "malformed" | boolean {
	let signature: Buffer;
	try {
		signature = decodeStrictBase64(signatureBase64);
	} catch {
		return "malformed";
	}
	if (signature.length !== SIGNATURE_BYTE_LENGTH) return "malformed";
	try {
		return verify(null, Buffer.from(canonicalPayload, "utf8"), publicKey, signature);
	} catch {
		return false;
	}
}

function isSignedSkillPackShape(value: unknown): value is SignedSkillPack {
	if (value === null || typeof value !== "object") return false;
	const wrapper = value as Record<string, unknown>;
	if (!isSkillDefinitionShape(wrapper.pack)) return false;
	if (typeof wrapper.signerKeyId !== "string") return false;
	if (typeof wrapper.signerPublicKey !== "string") return false;
	if (typeof wrapper.signature !== "string") return false;
	if (wrapper.signedAt !== undefined && typeof wrapper.signedAt !== "string") {
		return false;
	}
	return true;
}

function isSkillDefinitionShape(value: unknown): value is SkillDefinition {
	if (value === null || typeof value !== "object") return false;
	const skill = value as Record<string, unknown>;
	if (typeof skill.id !== "string") return false;
	if (typeof skill.version !== "string") return false;
	if (typeof skill.jurisdiction !== "string") return false;
	if (skill.validity === null || typeof skill.validity !== "object") return false;
	const validity = skill.validity as Record<string, unknown>;
	if (typeof validity.from !== "string") return false;
	if (validity.to !== undefined && typeof validity.to !== "string") return false;
	for (const key of [
		"normativeSources",
		"inputs",
		"outputs",
		"requiredPermissions",
		"contractCompatibility",
	]) {
		if (!Array.isArray(skill[key])) return false;
	}
	if (typeof skill.maxAutonomy !== "string") return false;
	if (typeof skill.checksum !== "string") return false;
	if (typeof skill.retirementPolicy !== "string") return false;
	return true;
}
