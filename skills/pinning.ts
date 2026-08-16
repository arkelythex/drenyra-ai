/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission skill pins — immutable, full-set skill snapshots (SDD-070).
 *
 * A pin binds id, version, checksum, jurisdiction, and vigencia for every skill
 * in the mission set. Creation re-verifies every pack and requires each skill to
 * be in force at the caller-supplied reference date; verification fails closed
 * on any integrity, drift, or membership violation. Entries are ordered
 * deterministically (binary id, then numeric semver); no API reads the clock and
 * no API throws for caller-shaped malformed input.
 */

import { isSkillInForce } from "./registry.js";
import {
	verifySkillPack,
	type SignedSkillPack,
	type SkillPackVerificationReason,
} from "./signature.js";
import type { IsoDate, SkillValidity } from "./types.js";

/** One pinned skill binding: content identity plus jurisdiction and vigencia. */
export interface MissionSkillPinEntry {
	readonly id: string;
	readonly version: string;
	readonly checksum: string;
	readonly jurisdiction: string;
	readonly vigencia: SkillValidity;
}

/** Immutable mission skill pin over an exact, deterministically ordered set. */
export interface MissionSkillPin {
	readonly entries: readonly MissionSkillPinEntry[];
}

/** Closed vocabulary of pinning denials, in canonical report order. */
export type MissionSkillPinDenialCode =
	| "malformed-pin"
	| "malformed-candidate-set"
	| "invalid-reference-date"
	| "duplicate-pin-identity"
	| "duplicate-candidate-identity"
	| "missing-skill"
	| "additional-skill"
	| "id-mismatch"
	| "version-mismatch"
	| "checksum-mismatch"
	| "jurisdiction-mismatch"
	| "vigencia-mismatch"
	| "skill-out-of-force"
	| "candidate-malformed"
	| "candidate-public-key-invalid"
	| "candidate-signature-invalid";

/** A denial with deterministic, frozen reasons; `identity` is safe `${id}@${version}` metadata. */
export interface MissionSkillPinDenial {
	readonly code: "mission-skill-pin-denied";
	readonly reasons: readonly {
		readonly code: MissionSkillPinDenialCode;
		readonly identity?: string;
	}[];
}

/** Fail-closed creation result: success carries a pin, denial carries no pin. */
export type MissionSkillPinCreationResult =
	| { readonly valid: true; readonly pin: MissionSkillPin }
	| { readonly valid: false; readonly denial: MissionSkillPinDenial };

/** Fail-closed verification result. */
export type MissionSkillPinVerification =
	| { readonly valid: true }
	| { readonly valid: false; readonly denial: MissionSkillPinDenial };

const DENIAL_CODE_ORDER: readonly MissionSkillPinDenialCode[] = [
	"malformed-pin",
	"malformed-candidate-set",
	"invalid-reference-date",
	"duplicate-pin-identity",
	"duplicate-candidate-identity",
	"missing-skill",
	"additional-skill",
	"id-mismatch",
	"version-mismatch",
	"checksum-mismatch",
	"jurisdiction-mismatch",
	"vigencia-mismatch",
	"skill-out-of-force",
	"candidate-malformed",
	"candidate-public-key-invalid",
	"candidate-signature-invalid",
];

type DenialItem = {
	readonly code: MissionSkillPinDenialCode;
	readonly identity?: string;
};

/** Assemble a frozen, deduplicated denial with reasons in closed order, then identity. */
function assembleDenial(items: readonly DenialItem[]): MissionSkillPinDenial {
	const seen = new Set<string>();
	const unique: DenialItem[] = [];
	for (const item of items) {
		const key = `${item.code}\u0000${item.identity ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(item);
	}
	unique.sort((a, b) => {
		const orderA = DENIAL_CODE_ORDER.indexOf(a.code);
		const orderB = DENIAL_CODE_ORDER.indexOf(b.code);
		if (orderA !== orderB) return orderA - orderB;
		const identityA = a.identity ?? "";
		const identityB = b.identity ?? "";
		return identityA < identityB ? -1 : identityA > identityB ? 1 : 0;
	});
	return Object.freeze({
		code: "mission-skill-pin-denied",
		reasons: Object.freeze(
			unique.map((item) =>
				Object.freeze(
					item.identity === undefined
						? { code: item.code }
						: { code: item.code, identity: item.identity },
				),
			),
		),
	});
}

function denialResult(
	items: readonly DenialItem[],
): { readonly valid: false; readonly denial: MissionSkillPinDenial } {
	return Object.freeze({ valid: false, denial: assembleDenial(items) });
}

function identityKey(id: string, version: string): string {
	return `${id}@${version}`;
}

/** Runtime object check before touching wrapper fields of untrusted candidates. */
function isPackObject(value: unknown): value is SignedSkillPack {
	return value !== null && typeof value === "object";
}

/** Extract `${id}@${version}` from a candidate wrapper when its shape permits. */
function extractIdentity(value: unknown): string | undefined {
	if (value === null || typeof value !== "object") return undefined;
	const pack = (value as Record<string, unknown>).pack;
	if (pack === null || typeof pack !== "object") return undefined;
	const skill = pack as Record<string, unknown>;
	if (typeof skill.id !== "string" || typeof skill.version !== "string") {
		return undefined;
	}
	return identityKey(skill.id, skill.version);
}

function isValidIsoDate(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	);
}

/** Complete pin shape validation (runtime guard for untrusted pins). */
function isMissionSkillPinShape(value: unknown): value is MissionSkillPin {
	if (value === null || typeof value !== "object") return false;
	const pin = value as Record<string, unknown>;
	if (!Array.isArray(pin.entries)) return false;
	for (const entry of pin.entries) {
		if (entry === null || typeof entry !== "object") return false;
		const item = entry as Record<string, unknown>;
		if (typeof item.id !== "string") return false;
		if (typeof item.version !== "string") return false;
		if (typeof item.checksum !== "string") return false;
		if (typeof item.jurisdiction !== "string") return false;
		if (item.vigencia === null || typeof item.vigencia !== "object") return false;
		const vigencia = item.vigencia as Record<string, unknown>;
		if (typeof vigencia.from !== "string") return false;
		if (vigencia.to !== undefined && typeof vigencia.to !== "string") return false;
	}
	return true;
}

function parseSemver(version: string): readonly [number, number, number] {
	const parts = version.split(".");
	const major = Number(parts[0]);
	const minor = Number(parts[1]);
	const patch = Number(parts[2]);
	return [
		Number.isFinite(major) ? major : 0,
		Number.isFinite(minor) ? minor : 0,
		Number.isFinite(patch) ? patch : 0,
	];
}

function compareSemver(a: string, b: string): number {
	const pa = parseSemver(a);
	const pb = parseSemver(b);
	for (let i = 0; i < 3; i += 1) {
		const diff = pa[i] - pb[i];
		if (diff !== 0) return diff;
	}
	return 0;
}

function compareEntries(a: MissionSkillPinEntry, b: MissionSkillPinEntry): number {
	if (a.id !== b.id) return a.id < b.id ? -1 : 1;
	return compareSemver(a.version, b.version);
}

/** Map pack verification reasons onto the pinning denial vocabulary. */
function mapVerificationReason(reason: SkillPackVerificationReason): MissionSkillPinDenialCode {
	switch (reason) {
		case "malformed-signed-pack":
			return "candidate-malformed";
		case "checksum-mismatch":
			return "checksum-mismatch";
		case "malformed-public-key":
			return "candidate-public-key-invalid";
		case "public-key-mismatch":
			return "candidate-public-key-invalid";
		case "malformed-signature":
			return "candidate-signature-invalid";
		case "signature-invalid":
			return "candidate-signature-invalid";
	}
}

/** Project a fresh, frozen entry from a verified signed pack. */
function projectEntry(pack: SignedSkillPack): MissionSkillPinEntry {
	return Object.freeze({
		id: pack.pack.id,
		version: pack.pack.version,
		checksum: pack.pack.checksum,
		jurisdiction: pack.pack.jurisdiction,
		vigencia: Object.freeze({ ...pack.pack.validity }),
	});
}

/** Vigencia equality: inclusive `from`, exclusive optional `to` (absent means no expiry). */
function sameVigencia(a: SkillValidity | undefined, b: SkillValidity): boolean {
	if (a === undefined || a === null || typeof a !== "object") return false;
	return a.from === b.from && (a.to ?? undefined) === (b.to ?? undefined);
}

/**
 * Create an immutable mission skill pin over a verified, in-force pack set.
 * Returns a discriminated result; never throws and never mutates caller inputs.
 */
export function createMissionSkillPin(
	signedPacks: readonly SignedSkillPack[],
	referenceDate: IsoDate,
): MissionSkillPinCreationResult {
	if (!isValidIsoDate(referenceDate)) {
		return denialResult([{ code: "invalid-reference-date" }]);
	}
	if (!Array.isArray(signedPacks)) {
		return denialResult([{ code: "malformed-candidate-set" }]);
	}

	const reasons: DenialItem[] = [];
	const seen = new Map<string, number>();
	for (const pack of signedPacks) {
		const identity = isPackObject(pack) ? extractIdentity(pack) : undefined;
		if (identity === undefined) {
			reasons.push({ code: "candidate-malformed" });
			continue;
		}
		const count = seen.get(identity) ?? 0;
		seen.set(identity, count + 1);
		if (count >= 1) reasons.push({ code: "duplicate-candidate-identity", identity });
	}

	for (const pack of signedPacks) {
		if (!isPackObject(pack)) continue;
		const verification = verifySkillPack(pack, pack.signerPublicKey);
		if (!verification.valid) {
			const identity = extractIdentity(pack);
			for (const reason of verification.error.reasons) {
				const mapped = mapVerificationReason(reason);
				reasons.push(
					identity === undefined
						? { code: mapped }
						: { code: mapped, identity },
				);
			}
			continue;
		}
		const identity = extractIdentity(pack);
		if (identity !== undefined && !isSkillInForce(pack.pack, referenceDate)) {
			reasons.push({ code: "skill-out-of-force", identity });
		}
	}

	if (reasons.length > 0) return denialResult(reasons);

	const entries = signedPacks
		.map((pack) => projectEntry(pack))
		.sort(compareEntries);
	const pin: MissionSkillPin = Object.freeze({
		entries: Object.freeze(entries),
	});
	return Object.freeze({ valid: true, pin });
}

/**
 * Verify a mission skill pin against a candidate pack set at a reference date.
 * Returns a discriminated result; never throws and never mutates caller inputs.
 */
export function verifyMissionSkillPin(
	pin: MissionSkillPin,
	packs: readonly SignedSkillPack[],
	referenceDate: IsoDate,
): MissionSkillPinVerification {
	if (!isValidIsoDate(referenceDate)) {
		return denialResult([{ code: "invalid-reference-date" }]);
	}
	if (!isMissionSkillPinShape(pin)) {
		return denialResult([{ code: "malformed-pin" }]);
	}
	if (!Array.isArray(packs)) {
		return denialResult([{ code: "malformed-candidate-set" }]);
	}

	const reasons: DenialItem[] = [];

	const pinSeen = new Map<string, number>();
	for (const entry of pin.entries) {
		const identity = identityKey(entry.id, entry.version);
		const count = pinSeen.get(identity) ?? 0;
		pinSeen.set(identity, count + 1);
		if (count >= 1) reasons.push({ code: "duplicate-pin-identity", identity });
	}

	const candidateSeen = new Map<string, number>();
	for (const pack of packs) {
		const identity = isPackObject(pack) ? extractIdentity(pack) : undefined;
		if (identity === undefined) {
			reasons.push({ code: "candidate-malformed" });
			continue;
		}
		const count = candidateSeen.get(identity) ?? 0;
		candidateSeen.set(identity, count + 1);
		if (count >= 1) reasons.push({ code: "duplicate-candidate-identity", identity });
	}

	for (const pack of packs) {
		if (!isPackObject(pack)) continue;
		const verification = verifySkillPack(pack, pack.signerPublicKey);
		if (!verification.valid) {
			const identity = extractIdentity(pack);
			for (const reason of verification.error.reasons) {
				const mapped = mapVerificationReason(reason);
				reasons.push(
					identity === undefined
						? { code: mapped }
						: { code: mapped, identity },
				);
			}
			continue;
		}
		const identity = extractIdentity(pack);
		if (identity !== undefined && !isSkillInForce(pack.pack, referenceDate)) {
			reasons.push({ code: "skill-out-of-force", identity });
		}
	}

	const boundByIdentity = new Map<string, MissionSkillPinEntry>();
	for (const entry of pin.entries) {
		const identity = identityKey(entry.id, entry.version);
		if (!boundByIdentity.has(identity)) boundByIdentity.set(identity, entry);
	}
	const candidateByIdentity = new Map<string, SignedSkillPack>();
	for (const pack of packs) {
		if (!isPackObject(pack)) continue;
		const identity = extractIdentity(pack);
		if (identity !== undefined && !candidateByIdentity.has(identity)) {
			candidateByIdentity.set(identity, pack);
		}
	}
	for (const [identity] of boundByIdentity) {
		if (!candidateByIdentity.has(identity)) {
			reasons.push({ code: "missing-skill", identity });
		}
	}
	for (const [identity] of candidateByIdentity) {
		if (!boundByIdentity.has(identity)) {
			reasons.push({ code: "additional-skill", identity });
		}
	}

	const boundIdCounts = new Map<string, number>();
	for (const entry of pin.entries) {
		boundIdCounts.set(entry.id, (boundIdCounts.get(entry.id) ?? 0) + 1);
	}
	const candidateIdCounts = new Map<string, number>();
	for (const pack of packs) {
		if (!isPackObject(pack)) continue;
		const identity = extractIdentity(pack);
		if (identity === undefined) continue;
		const id = identity.slice(0, identity.lastIndexOf("@"));
		candidateIdCounts.set(id, (candidateIdCounts.get(id) ?? 0) + 1);
	}
	for (const entry of pin.entries) {
		if ((boundIdCounts.get(entry.id) ?? 0) !== 1) continue;
		if ((candidateIdCounts.get(entry.id) ?? 0) !== 1) continue;
		const identity = identityKey(entry.id, entry.version);
		if (candidateByIdentity.has(identity)) continue;
		reasons.push({ code: "version-mismatch", identity });
	}

	for (const [identity, entry] of boundByIdentity) {
		const candidate = candidateByIdentity.get(identity);
		if (candidate === undefined) continue;
		if (candidate.pack.checksum !== entry.checksum) {
			reasons.push({ code: "checksum-mismatch", identity });
		}
		if (candidate.pack.jurisdiction !== entry.jurisdiction) {
			reasons.push({ code: "jurisdiction-mismatch", identity });
		}
		if (!sameVigencia(candidate.pack.validity, entry.vigencia)) {
			reasons.push({ code: "vigencia-mismatch", identity });
		}
	}

	if (reasons.length === 0) return Object.freeze({ valid: true });
	return denialResult(reasons);
}
