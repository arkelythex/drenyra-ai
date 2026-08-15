/**
 * promoted-composition evidence (strict TDD): subprocess tests for the
 * deterministic, fail-closed bundled composition manifest generator
 * (scripts/promoted-composition.mjs). Mirrors scripts/__tests__/checksum-lock.test.ts:
 * fixtures live in a temporary mini-repo and every run happens from a throwaway
 * non-repository cwd. Pins byte-identical determinism across cwd, the exact
 * five-field non-carrying output shape and property order, fail-closed source
 * classes (non-promoted, malformed, missing, unreconciled checksum set, wrong
 * algorithm/canonicalization, host-entry drift, revision drift, carrying-commit
 * presence, malformed field values), bootstrap-rule output hygiene, D5 stale
 * output/staging cleanup, and the release pipeline coverage (checksums + package
 * verifiers). R1, R6; D1-D5.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../promoted-composition.mjs", import.meta.url));
const CHECKSUMS = fileURLToPath(new URL("../checksums.mjs", import.meta.url));
const VERIFY_FILES = fileURLToPath(new URL("../verify-package-files.mjs", import.meta.url));
const VERIFY_PACKED = fileURLToPath(new URL("../verify-packed-install.mjs", import.meta.url));

const REV = "d440203183e24b2a0ecf773915888bb6072fc015";
const HOST_DIGEST = "2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36";
const CARRYING_SHA = "c".repeat(40);
const LOCK_REL = "openspec/programs/drenyra-dominion/program-lock.json";
const OUTPUT_REL = "dist/promoted-composition.json";
const STAGING_REL = "dist/promoted-composition.json.staging";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.length = 0;
});

const sha256 = (bytes: string) =>
	createHash("sha256").update(bytes, "utf8").digest("hex");

/** A minimal but internally consistent promoted lock (the real lock is richer). */
function promotedLockFixture(): Record<string, unknown> {
	const entries = [
		{
			repository: "drenyra-ai",
			revision: REV,
			artifact: "drenyra-ai-0.4.0.tgz",
			sha256: HOST_DIGEST,
		},
	];
	const setSha256 = sha256(JSON.stringify(entries));
	return {
		status: "promoted",
		currentVerified: {
			inspectedRevision: REV,
			host: { repository: "drenyra-ai", version: "0.4.0", commitSha: null },
		},
		checksums: {
			algorithm: "sha256",
			canonicalization: "json-entries-v1",
			entries,
			setSha256,
		},
		attestation: {
			tag: "drenyra-dominion-v0.4.0",
			verifiedRevision: REV,
			checksumSetSha256: setSha256,
			carryingCommitSha: null,
		},
	};
}

function fixture(lock: Record<string, unknown> = promotedLockFixture()): string {
	const root = mkdtempSync(join(tmpdir(), "promoted-composition-"));
	roots.push(root);
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "dist"), { recursive: true });
	mkdirSync(join(root, "openspec", "programs", "drenyra-dominion"), {
		recursive: true,
	});
	copyFileSync(SCRIPT, join(root, "scripts", "promoted-composition.mjs"));
	copyFileSync(CHECKSUMS, join(root, "scripts", "checksums.mjs"));
	writeFileSync(join(root, LOCK_REL), `${JSON.stringify(lock, null, 2)}\n`);
	return root;
}

/** Run the fixture generator from a throwaway working directory (never the repo). */
function run(root: string, args: string[]) {
	const cwd = mkdtempSync(join(tmpdir(), "promoted-composition-cwd-"));
	const result = spawnSync(
		process.execPath,
		[join(root, "scripts", "promoted-composition.mjs"), ...args],
		{ cwd, encoding: "utf8" },
	);
	rmSync(cwd, { recursive: true, force: true });
	return result;
}

/** Run the real checksums.mjs against a fixture dist/ from a throwaway cwd. */
function runChecksums(root: string) {
	const cwd = mkdtempSync(join(tmpdir(), "promoted-composition-cwd-"));
	const result = spawnSync(
		process.execPath,
		[join(root, "scripts", "checksums.mjs")],
		{ cwd, encoding: "utf8" },
	);
	rmSync(cwd, { recursive: true, force: true });
	return result;
}

const readManifest = (root: string) =>
	readFileSync(join(root, OUTPUT_REL), "utf8");
const writeLock = (root: string, lock: Record<string, unknown>) =>
	writeFileSync(join(root, LOCK_REL), `${JSON.stringify(lock, null, 2)}\n`);

/** The exact five-field manifest the fixture lock must produce, in contract order. */
function expectedManifest(root: string): Record<string, unknown> {
	const lock = JSON.parse(readFileSync(join(root, LOCK_REL), "utf8")) as {
		checksums: { setSha256: string };
	};
	return {
		version: "0.4.0",
		verifiedRevision: REV,
		hostArtifactSha256: HOST_DIGEST,
		setSha256: lock.checksums.setSha256,
		attestationTag: "drenyra-dominion-v0.4.0",
	};
}

describe("promoted-composition determinism and output shape (R1·1, D1-D3)", () => {
	it("produces byte-identical five-field manifest content from two different working directories", () => {
		const root = fixture();
		const first = run(root, []);
		expect(first.status).toBe(0);
		const firstBytes = readManifest(root);
		const second = run(root, []);
		expect(second.status).toBe(0);
		expect(readManifest(root)).toBe(firstBytes);
		expect(firstBytes).toBe(`${JSON.stringify(expectedManifest(root), null, 2)}\n`);
	});

	it("emits exactly the five non-carrying fields in contract order", () => {
		const root = fixture();
		expect(run(root, []).status).toBe(0);
		const parsed = JSON.parse(readManifest(root)) as Record<string, unknown>;
		expect(Object.keys(parsed)).toEqual([
			"version",
			"verifiedRevision",
			"hostArtifactSha256",
			"setSha256",
			"attestationTag",
		]);
		expect(parsed).toEqual(expectedManifest(root));
	});

	it("resolves explicit --lock/--output arguments against the repository root, not cwd", () => {
		const root = fixture();
		const result = run(root, ["--lock", LOCK_REL, "--output", OUTPUT_REL]);
		expect(result.status).toBe(0);
		expect(existsSync(join(root, OUTPUT_REL))).toBe(true);
		expect(readManifest(root)).toBe(`${JSON.stringify(expectedManifest(root), null, 2)}\n`);
	});

	it("rejects unknown, duplicate, and missing-value flags", () => {
		const root = fixture();
		const cases = [
			["--bogus"],
			["--lock", LOCK_REL, "--lock", LOCK_REL],
			["--output", OUTPUT_REL, "--output", OUTPUT_REL],
			["--lock"],
			["--output"],
		];
		for (const args of cases) {
			const result = run(root, args);
			expect(result.status, args.join(" ")).not.toBe(0);
			expect(result.stderr, args.join(" ")).toMatch(/^promoted-composition:/);
		}
	});
});

describe("promoted-composition fail-closed sources (R1·2, D4)", () => {
	const expectFail = (root: string, pattern: RegExp) => {
		const result = run(root, []);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/^promoted-composition:/);
		expect(result.stderr).toMatch(pattern);
		expect(existsSync(join(root, OUTPUT_REL))).toBe(false);
		expect(existsSync(join(root, STAGING_REL))).toBe(false);
	};

	it("fails closed on a missing lock", () => {
		const root = fixture();
		rmSync(join(root, LOCK_REL));
		expectFail(root, /promoted-composition:/);
	});

	it("fails closed on malformed JSON and non-object roots", () => {
		const root = fixture();
		writeFileSync(join(root, LOCK_REL), "{ nope");
		expectFail(root, /promoted-composition:/);
		writeFileSync(join(root, LOCK_REL), "[1, 2, 3]");
		expectFail(root, /object/i);
	});

	it("fails closed when status is not promoted", () => {
		const root = fixture({ ...promotedLockFixture(), status: "candidate" });
		expectFail(root, /status/i);
	});

	it("fails closed on missing expected structure", () => {
		const noHost = promotedLockFixture() as Record<string, any>;
		delete noHost.currentVerified.host;
		expectFail(fixture(noHost), /host/i);
		const noChecksums = promotedLockFixture() as Record<string, any>;
		delete noChecksums.checksums;
		expectFail(fixture(noChecksums), /checksums/i);
		const noAttestation = promotedLockFixture() as Record<string, any>;
		delete noAttestation.attestation;
		expectFail(fixture(noAttestation), /attestation/i);
	});

	it("fails closed on a checksum set that cannot be reconciled", () => {
		const setDrift = promotedLockFixture() as Record<string, any>;
		setDrift.checksums.setSha256 = "0".repeat(64);
		expectFail(fixture(setDrift), /setSha256/i);
		const attestationDrift = promotedLockFixture() as Record<string, any>;
		attestationDrift.attestation.checksumSetSha256 = "f".repeat(64);
		expectFail(fixture(attestationDrift), /checksumSetSha256/i);
	});

	it("fails closed on wrong algorithm or canonicalization", () => {
		const algorithm = promotedLockFixture() as Record<string, any>;
		algorithm.checksums.algorithm = "sha512";
		expectFail(fixture(algorithm), /algorithm/i);
		const canonicalization = promotedLockFixture() as Record<string, any>;
		canonicalization.checksums.canonicalization = "other-v1";
		expectFail(fixture(canonicalization), /canonicalization/i);
	});

	it("fails closed when the host checksum entry is missing, duplicated, or wrong-repository", () => {
		const missing = promotedLockFixture() as Record<string, any>;
		missing.checksums.entries = [];
		expectFail(fixture(missing), /host/i);
		const duplicated = promotedLockFixture() as Record<string, any>;
		duplicated.checksums.entries = [
			...duplicated.checksums.entries,
			{ ...duplicated.checksums.entries[0] },
		];
		expectFail(fixture(duplicated), /host/i);
		const wrongRepo = promotedLockFixture() as Record<string, any>;
		wrongRepo.checksums.entries = [
			{
				repository: "other-repo",
				revision: REV,
				artifact: "other.tgz",
				sha256: "a".repeat(64),
			},
		];
		expectFail(fixture(wrongRepo), /host/i);
	});

	it("fails closed on revision mismatch across inspected, attestation, and host entry", () => {
		const attestation = promotedLockFixture() as Record<string, any>;
		attestation.attestation.verifiedRevision = "d".repeat(40);
		expectFail(fixture(attestation), /revision/i);
		const entry = promotedLockFixture() as Record<string, any>;
		entry.checksums.entries[0].revision = "e".repeat(40);
		expectFail(fixture(entry), /revision/i);
	});

	it("fails closed when a carrying-commit field is non-null (bootstrap rule)", () => {
		const host = promotedLockFixture() as Record<string, any>;
		host.currentVerified.host.commitSha = CARRYING_SHA;
		expectFail(fixture(host), /bootstrap|commitSha/i);
		const attestation = promotedLockFixture() as Record<string, any>;
		attestation.attestation.carryingCommitSha = CARRYING_SHA;
		expectFail(fixture(attestation), /carrying/i);
	});

	it("fails closed on malformed field values", () => {
		const version = promotedLockFixture() as Record<string, any>;
		version.currentVerified.host.version = "v0.4.0";
		expectFail(fixture(version), /version/i);
		const revision = promotedLockFixture() as Record<string, any>;
		revision.currentVerified.inspectedRevision = REV.toUpperCase();
		expectFail(fixture(revision), /revision/i);
		const digest = promotedLockFixture() as Record<string, any>;
		digest.checksums.entries[0].sha256 = HOST_DIGEST.toUpperCase();
		expectFail(fixture(digest), /sha256/i);
		const tag = promotedLockFixture() as Record<string, any>;
		tag.attestation.tag = "   ";
		expectFail(fixture(tag), /tag/i);
	});
});

describe("promoted-composition output discipline (R1·1, D2, D5)", () => {
	it("emits no carrying-commit SHA, branch, HEAD, historical facts, or extra keys", () => {
		const root = fixture();
		expect(run(root, []).status).toBe(0);
		const bytes = readManifest(root);
		expect(bytes).not.toContain("commitSha");
		expect(bytes).not.toContain("carryingCommitSha");
		expect(bytes).not.toContain("programBaseCommit");
		expect(bytes).not.toContain("branch");
		expect(bytes).not.toContain("HEAD");
		expect(bytes).not.toContain("repositories");
		expect(bytes).not.toContain("historical");
		expect(bytes).not.toContain(CARRYING_SHA);
		expect(Object.keys(JSON.parse(bytes))).toEqual([
			"version",
			"verifiedRevision",
			"hostArtifactSha256",
			"setSha256",
			"attestationTag",
		]);
	});

	it("leaves both output and staging absent after a failed generation (D5 stale cleanup)", () => {
		const root = fixture();
		const lock = JSON.parse(readFileSync(join(root, LOCK_REL), "utf8")) as Record<string, any>;
		lock.status = "candidate";
		writeLock(root, lock);
		writeFileSync(join(root, OUTPUT_REL), "stale manifest\n");
		writeFileSync(join(root, STAGING_REL), "stale staging\n");
		const result = run(root, []);
		expect(result.status).not.toBe(0);
		expect(existsSync(join(root, OUTPUT_REL))).toBe(false);
		expect(existsSync(join(root, STAGING_REL))).toBe(false);
	});

	it("never rewrites the source lock", () => {
		const root = fixture();
		const before = readFileSync(join(root, LOCK_REL), "utf8");
		expect(run(root, []).status).toBe(0);
		expect(readFileSync(join(root, LOCK_REL), "utf8")).toBe(before);
	});
});

describe("promoted-composition package pipeline (R1·3)", () => {
	it("is covered by dist/checksums.txt and required by the package-file and packed-install verifiers", () => {
		const root = fixture();
		expect(run(root, []).status).toBe(0);
		expect(runChecksums(root).status).toBe(0);
		const manifest = readFileSync(join(root, "dist", "checksums.txt"), "utf8");
		expect(manifest).toMatch(/promoted-composition\.json/);
		// The verifiers are wired to require the resource (live packed-install gate
		// runs in release verification against the real tarball).
		expect(readFileSync(VERIFY_FILES, "utf8")).toContain("promoted-composition.json");
		expect(readFileSync(VERIFY_PACKED, "utf8")).toContain("promoted-composition.json");
	});
});
