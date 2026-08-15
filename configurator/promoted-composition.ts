/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `configurator/promoted-composition.ts` — offline reader and doctor diagnostic
 * for the bundled promoted composition manifest (SDD-020 slice C, PR 2; R2, R4).
 *
 * Reads `<package-root>/dist/promoted-composition.json` — the release-derived
 * five-field package resource (D1, D2) — and classifies it strictly as
 * valid/absent/invalid (D8). Fail-closed: an absent or malformed manifest is
 * never replaced by ambient fallbacks (package-version inference, hardcoded
 * promoted facts, files under the caller's working directory, network
 * retrieval). The package root resolves through the relocated library
 * primitive (`./package-metadata.js`), never the caller's working directory
 * (D6, D9). Version skew is `matches`/`differs`, never an ordering gate (D11).
 *
 * Layer contract: imports only node:* built-ins and same-layer library modules;
 * never imports from `cmd/` or `agents/`. No HTTP, child-process, Git,
 * environment, cwd, or program-lock dependency.
 */

import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot } from "./package-metadata.js";

/** Exactly the five non-carrying promotable facts (D2). */
export interface PromotedComposition {
	version: string;
	verifiedRevision: string;
	hostArtifactSha256: string;
	setSha256: string;
	attestationTag: string;
}

/** Strict classification: valid / absent / invalid (D8). */
export type PromotedCompositionRead =
	| { state: "valid"; composition: PromotedComposition }
	| { state: "absent" }
	| { state: "invalid"; invalidReason: string };

export interface PromotedCompositionReaderDeps {
	/** Test seam only; production callers omit this. */
	packageRoot?: string;
}

/** Version relationship between the promoted and packaged versions (D11). */
export type VersionRelationship = "matches" | "differs";

/** The dedicated doctor check for program-lock awareness (R4; D12). */
export interface ProgramLockAwarenessDiagnostic {
	name: "program-lock-awareness";
	ok: boolean;
	detail: string;
	applicability: "applicable" | "not-applicable" | "unverifiable";
	manifestState: "valid" | "absent" | "invalid";
	packageVersion: string;
	versionRelationship?: VersionRelationship;
	promotedComposition?: PromotedComposition;
}

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
// Strict semantic version — identical to the generator's contract so the reader
// accepts exactly what the generator can emit.
const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const ALLOWED_KEYS = [
	"version",
	"verifiedRevision",
	"hostArtifactSha256",
	"setSha256",
	"attestationTag",
] as const;

const MANIFEST_FILENAME = "promoted-composition.json";

function invalid(reason: string): PromotedCompositionRead {
	return { state: "invalid", invalidReason: reason };
}

/**
 * Read and strictly classify the bundled promoted composition manifest (R2;
 * design §5.2):
 *
 * 1. Resolve the package root from `deps.packageRoot ?? getPackageRoot()`; a
 *    resolution exception is `invalid`.
 * 2. Join only `<packageRoot>/dist/promoted-composition.json`.
 * 3. Absent → `absent`; a symlink or non-regular file → `invalid`; read errors
 *    → `invalid`.
 * 4. Parse UTF-8 JSON; require a non-array object with exactly the five allowed
 *    keys (any carrying-commit or extra field is rejected).
 * 5. Validate strict semver, lowercase 40-hex revision, two lowercase 64-hex
 *    digests, and a non-empty trimmed attestation tag.
 * 6. Return a fresh `composition` only after all checks pass — never partial
 *    facts, never cwd/network fallback.
 */
export function readPromotedComposition(
	deps?: PromotedCompositionReaderDeps,
): PromotedCompositionRead {
	let packageRoot: string;
	try {
		packageRoot = deps?.packageRoot ?? getPackageRoot();
	} catch {
		return invalid("package root resolution failed");
	}
	const manifestPath = join(packageRoot, "dist", MANIFEST_FILENAME);

	let stat: ReturnType<typeof lstatSync>;
	try {
		stat = lstatSync(manifestPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { state: "absent" };
		}
		return invalid("cannot stat promoted-composition.json");
	}
	if (stat.isSymbolicLink() || !stat.isFile()) {
		return invalid("promoted-composition.json must be a regular file");
	}

	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
	} catch {
		return invalid("promoted-composition.json is unreadable or not valid JSON");
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return invalid("promoted-composition.json must be a JSON object");
	}
	const record = raw as Record<string, unknown>;
	const keys = Object.keys(record);
	// Exact-key check: exactly the five allowed names, so any carrying-commit
	// or unrecognized field (commitSha, carryingCommitSha, ...) is rejected.
	if (
		keys.length !== ALLOWED_KEYS.length ||
		!ALLOWED_KEYS.every((key) => keys.includes(key))
	) {
		return invalid(
			"promoted-composition.json must contain exactly the five allowed fields",
		);
	}

	const version = record.version;
	if (typeof version !== "string" || !SEMVER.test(version)) {
		return invalid("version must be a strict semantic-version string");
	}
	const verifiedRevision = record.verifiedRevision;
	if (typeof verifiedRevision !== "string" || !HEX40.test(verifiedRevision)) {
		return invalid("verifiedRevision must be a lowercase 40-hex SHA");
	}
	const hostArtifactSha256 = record.hostArtifactSha256;
	if (typeof hostArtifactSha256 !== "string" || !HEX64.test(hostArtifactSha256)) {
		return invalid("hostArtifactSha256 must be a lowercase 64-hex SHA-256");
	}
	const setSha256 = record.setSha256;
	if (typeof setSha256 !== "string" || !HEX64.test(setSha256)) {
		return invalid("setSha256 must be a lowercase 64-hex SHA-256");
	}
	const attestationTag = record.attestationTag;
	if (typeof attestationTag !== "string" || attestationTag.trim().length === 0) {
		return invalid("attestationTag must be a non-empty string");
	}

	return {
		state: "valid",
		composition: {
			version,
			verifiedRevision,
			hostArtifactSha256,
			setSha256,
			attestationTag,
		},
	};
}

/**
 * Build the doctor `program-lock-awareness` check from the read evidence (R4;
 * design §6.2): valid+equal → applicable/ok/matches; valid skew → applicable/ok
 * with `differs` naming both versions (informational, never a failure); absent
 * → not-applicable/ok (clean-checkout invariant); invalid → unverifiable/not-ok
 * with no promoted facts; unknown packaged version → relationship omitted.
 * Promoted facts are never fabricated in any state.
 */
export function programLockAwarenessDiagnostic(
	read: PromotedCompositionRead,
	packageVersion: string,
): ProgramLockAwarenessDiagnostic {
	if (read.state === "absent") {
		return {
			name: "program-lock-awareness",
			ok: true,
			detail: "not applicable (no bundled promoted composition manifest)",
			applicability: "not-applicable",
			manifestState: "absent",
			packageVersion,
		};
	}
	if (read.state === "invalid") {
		return {
			name: "program-lock-awareness",
			ok: false,
			detail: `promoted composition manifest invalid: ${read.invalidReason}`,
			applicability: "unverifiable",
			manifestState: "invalid",
			packageVersion,
		};
	}
	const composition = read.composition;
	if (packageVersion === "unknown") {
		// Never fabricate a comparison when the packaged version is unavailable.
		return {
			name: "program-lock-awareness",
			ok: true,
			detail: `promoted composition available (${composition.version}); packaged version unknown`,
			applicability: "applicable",
			manifestState: "valid",
			packageVersion,
			promotedComposition: composition,
		};
	}
	const relationship: VersionRelationship =
		composition.version === packageVersion ? "matches" : "differs";
	return {
		name: "program-lock-awareness",
		ok: true,
		detail:
			relationship === "matches"
				? `promoted composition matches packaged version (${packageVersion})`
				: `promoted composition ${composition.version} differs from packaged version ${packageVersion}`,
		applicability: "applicable",
		manifestState: "valid",
		packageVersion,
		versionRelationship: relationship,
		promotedComposition: composition,
	};
}
