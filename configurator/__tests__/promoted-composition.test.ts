/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `configurator/promoted-composition` reader and diagnostic tests (SDD-020
 * slice C, PR 2).
 *
 * Strict-TDD RED/GREEN matrix for R2 (offline reader), R4 (doctor diagnostic),
 * and R5 (boundary: no `configurator/` → `cmd/`/`agents/` reverse import; the
 * relocated library package-root primitive and its `cmd/adapters` re-export).
 *
 * Uses `mkdtempSync` package-root fixtures and the `deps.packageRoot` test seam
 * (D9); never touches cwd (except the explicit no-cwd-fallback assertions),
 * never touches the network, and never reads the real `dist/`.
 */

import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	getPackageMetadata,
	getPackageRoot,
} from "../package-metadata.js";
import {
	getPackageMetadata as adapterGetPackageMetadata,
	getPackageRoot as adapterGetPackageRoot,
} from "../../cmd/adapters/package-metadata.js";
import {
	programLockAwarenessDiagnostic,
	readPromotedComposition,
	type PromotedComposition,
	type PromotedCompositionRead,
} from "../index.js";

/** The canonical five-field manifest the generator emits (design §3.1). */
const VALID_MANIFEST: PromotedComposition = {
	version: "0.4.0",
	verifiedRevision: "d440203183e24b2a0ecf773915888bb6072fc015",
	hostArtifactSha256:
		"2e3bd07241c250cf00653c346945108529d2fbba04a145bd9e38d938ae949a36",
	setSha256:
		"62f1aaa496307ba5f56894dcf6aef0ffac365ed6a303a8cb6fb0ef3b215ab3ea",
	attestationTag: "drenyra-dominion-v0.4.0",
};

function writeManifest(root: string, content: unknown): void {
	mkdirSync(join(root, "dist"), { recursive: true });
	writeFileSync(
		join(root, "dist", "promoted-composition.json"),
		JSON.stringify(content, null, 2),
	);
}

function repoRoot(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function tempRoot(): { dir: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-promoted-"));
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("configurator boundary compliance (SDD-020 slice C PR 2)", () => {
	it("has no module under configurator/ importing from cmd/ or agents/, and the cmd adapter re-export resolves", () => {
		// every library source file under configurator/ (never the test dir):
		// the reader lands later, so enumerate rather than hardcode the list
		const sourceFiles = readdirSync(join(repoRoot(), "configurator")).filter(
			(f) => f.endsWith(".ts"),
		);
		expect(sourceFiles.length).toBeGreaterThanOrEqual(3);
		for (const file of sourceFiles) {
			const source = readFileSync(join(repoRoot(), "configurator", file), "utf8");
			const specifiers = [...source.matchAll(/from "([^"]+)"/g)].map(
				(m) => m[1]!,
			);
			for (const specifier of specifiers) {
				expect(specifier).not.toMatch(/(^|\/)(cmd|agents)(\/|$)/);
			}
		}
		// the relocated library primitive resolves from configurator/
		expect(getPackageRoot()).toBe(repoRoot());
		expect(getPackageMetadata().version.length).toBeGreaterThan(0);
		// the cmd/adapters/package-metadata.ts re-export stays source-compatible
		expect(adapterGetPackageRoot()).toBe(getPackageRoot());
		expect(adapterGetPackageMetadata().version).toBe(
			getPackageMetadata().version,
		);
	});
});

describe("readPromotedComposition", () => {
	it("returns state valid with the exact five facts for a valid manifest at the package root (R2·1)", () => {
		const { dir, cleanup } = tempRoot();
		try {
			writeManifest(dir, VALID_MANIFEST);
			const read = readPromotedComposition({ packageRoot: dir });
			expect(read).toEqual({ state: "valid", composition: VALID_MANIFEST });
		} finally {
			cleanup();
		}
	});

	it("reports absent with no facts and never falls back to cwd or network (R2·2, R2·4)", () => {
		const { dir, cleanup } = tempRoot();
		try {
			expect(readPromotedComposition({ packageRoot: dir })).toEqual({
				state: "absent",
			});

			// a valid-looking manifest under cwd must NOT be picked up while the
			// injected package root stays absent
			const cwdFixture = mkdtempSync(join(tmpdir(), "drenyra-cwd-"));
			try {
				writeManifest(cwdFixture, VALID_MANIFEST);
				const originalCwd = process.cwd();
				process.chdir(cwdFixture);
				try {
					expect(readPromotedComposition({ packageRoot: dir })).toEqual({
						state: "absent",
					});
				} finally {
					process.chdir(originalCwd);
				}
			} finally {
				rmSync(cwdFixture, { recursive: true, force: true });
			}
		} finally {
			cleanup();
		}
	});

	it("rejects a directory, symlink, unreadable file, and malformed JSON as invalid with no composition (R2·3)", () => {
		const malformed = () => {
			const root = mkdtempSync(join(tmpdir(), "drenyra-bad-json-"));
			mkdirSync(join(root, "dist"), { recursive: true });
			writeFileSync(
				join(root, "dist", "promoted-composition.json"),
				"{ not json",
			);
			return root;
		};
		const asDirectory = () => {
			const root = mkdtempSync(join(tmpdir(), "drenyra-dir-"));
			mkdirSync(join(root, "dist", "promoted-composition.json"), {
				recursive: true,
			});
			return root;
		};
		const asSymlink = () => {
			const root = mkdtempSync(join(tmpdir(), "drenyra-link-"));
			mkdirSync(join(root, "dist"), { recursive: true });
			writeFileSync(join(root, "dist", "target.json"), JSON.stringify(VALID_MANIFEST));
			symlinkSync(
				join(root, "dist", "target.json"),
				join(root, "dist", "promoted-composition.json"),
			);
			return root;
		};
		for (const root of [malformed(), asDirectory(), asSymlink()]) {
			try {
				const read = readPromotedComposition({ packageRoot: root });
				expect(read.state).toBe("invalid");
				if (read.state === "invalid") {
					expect(read.invalidReason.length).toBeGreaterThan(0);
				}
				expect(read).not.toHaveProperty("composition");
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
		}
	});

	it("rejects missing/extra keys (including any carrying-like field), malformed semver, and invalid hashes/tags as invalid (R2·3)", () => {
		const invalidJson: Array<{ name: string; raw: unknown }> = [
			{ name: "JSON array", raw: [VALID_MANIFEST] },
			{ name: "null manifest", raw: null },
			{
				name: "missing attestationTag",
				raw: {
					version: "0.4.0",
					verifiedRevision: VALID_MANIFEST.verifiedRevision,
					hostArtifactSha256: VALID_MANIFEST.hostArtifactSha256,
					setSha256: VALID_MANIFEST.setSha256,
				},
			},
			{ name: "extra carrying commitSha", raw: { ...VALID_MANIFEST, commitSha: "abc" } },
			{
				name: "extra carryingCommitSha",
				raw: { ...VALID_MANIFEST, carryingCommitSha: null },
			},
			{ name: "extra unknown field", raw: { ...VALID_MANIFEST, repository: "drenyra-ai" } },
			{ name: "malformed semver (short)", raw: { ...VALID_MANIFEST, version: "0.4" } },
			{ name: "malformed semver (v-prefixed)", raw: { ...VALID_MANIFEST, version: "v0.4.0" } },
			{ name: "non-string version", raw: { ...VALID_MANIFEST, version: 4 } },
			{
				name: "uppercase verifiedRevision",
				raw: { ...VALID_MANIFEST, verifiedRevision: VALID_MANIFEST.verifiedRevision.toUpperCase() },
			},
			{
				name: "wrong-length verifiedRevision",
				raw: { ...VALID_MANIFEST, verifiedRevision: VALID_MANIFEST.verifiedRevision.slice(0, 39) },
			},
			{
				name: "uppercase hostArtifactSha256",
				raw: { ...VALID_MANIFEST, hostArtifactSha256: VALID_MANIFEST.hostArtifactSha256.toUpperCase() },
			},
			{
				name: "wrong-length setSha256",
				raw: { ...VALID_MANIFEST, setSha256: VALID_MANIFEST.setSha256.slice(0, 63) },
			},
			{ name: "empty attestation tag", raw: { ...VALID_MANIFEST, attestationTag: "" } },
			{ name: "whitespace attestation tag", raw: { ...VALID_MANIFEST, attestationTag: "   " } },
		];
		for (const fixture of invalidJson) {
			const { dir, cleanup } = tempRoot();
			try {
				writeManifest(dir, fixture.raw);
				const read = readPromotedComposition({ packageRoot: dir });
				expect(read.state, fixture.name).toBe("invalid");
				if (read.state === "invalid") {
					expect(read.invalidReason.length, fixture.name).toBeGreaterThan(0);
				}
				expect(read).not.toHaveProperty("composition");
			} finally {
				cleanup();
			}
		}
	});

	it("accepts a strict-semver prerelease version and rejects only non-conforming values (TRIANGULATE)", () => {
		const { dir, cleanup } = tempRoot();
		try {
			writeManifest(dir, { ...VALID_MANIFEST, version: "0.4.0-rc.1" });
			const read = readPromotedComposition({ packageRoot: dir });
			expect(read.state).toBe("valid");
			if (read.state === "valid") {
				expect(read.composition.version).toBe("0.4.0-rc.1");
			}
		} finally {
			cleanup();
		}
	});

	it("resolves the production package root from the module location, never cwd, and has no network/child-process/git/env/cwd imports (R2·4, R6·4)", () => {
		const originalCwd = process.cwd();
		const nonRoot = mkdtempSync(join(tmpdir(), "drenyra-nonroot-"));
		try {
			process.chdir(nonRoot);
			// default resolution follows the module location, not cwd
			expect(getPackageRoot()).toBe(repoRoot());
			// the reader with production resolution never throws and never depends
			// on cwd: valid when the built dist is present, absent otherwise
			const read = readPromotedComposition();
			expect(read.state === "valid" || read.state === "absent").toBe(true);
		} finally {
			process.chdir(originalCwd);
			rmSync(nonRoot, { recursive: true, force: true });
		}

		// static source/import assertion: no child-process/http/git/env/cwd
		const readerSource = readFileSync(
			join(repoRoot(), "configurator", "promoted-composition.ts"),
			"utf8",
		);
		expect(readerSource).not.toMatch(
			/child_process|node:http|node:https|node:net|node:dns|fetch\(|spawn\(|execSync|spawnSync|fork\(|process\.cwd|process\.env/,
		);
		const specifiers = [...readerSource.matchAll(/from "([^"]+)"/g)].map(
			(m) => m[1]!,
		);
		expect(specifiers.length).toBeGreaterThan(0);
		for (const specifier of specifiers) {
			expect(
				specifier === "./package-metadata.js" || specifier.startsWith("node:"),
			).toBe(true);
		}
	});
});

describe("programLockAwarenessDiagnostic", () => {
	it("valid + equal versions → applicable/ok/matches with all five facts", () => {
		const read: PromotedCompositionRead = {
			state: "valid",
			composition: { ...VALID_MANIFEST },
		};
		const d = programLockAwarenessDiagnostic(read, "0.4.0");
		expect(d.name).toBe("program-lock-awareness");
		expect(d.ok).toBe(true);
		expect(d.applicability).toBe("applicable");
		expect(d.manifestState).toBe("valid");
		expect(d.packageVersion).toBe("0.4.0");
		expect(d.versionRelationship).toBe("matches");
		expect(d.promotedComposition).toEqual(VALID_MANIFEST);
	});

	it("valid + 0.4.0/0.4.1 skew → applicable/ok/differs naming both versions with all five facts", () => {
		const read: PromotedCompositionRead = {
			state: "valid",
			composition: { ...VALID_MANIFEST },
		};
		const d = programLockAwarenessDiagnostic(read, "0.4.1");
		expect(d.ok).toBe(true);
		expect(d.applicability).toBe("applicable");
		expect(d.manifestState).toBe("valid");
		expect(d.versionRelationship).toBe("differs");
		expect(d.detail).toContain("0.4.0");
		expect(d.detail).toContain("0.4.1");
		expect(d.promotedComposition).toEqual(VALID_MANIFEST);
	});

	it("absent → not-applicable/ok with no promoted facts", () => {
		const d = programLockAwarenessDiagnostic({ state: "absent" }, "0.4.1");
		expect(d.ok).toBe(true);
		expect(d.applicability).toBe("not-applicable");
		expect(d.manifestState).toBe("absent");
		expect(d.versionRelationship).toBeUndefined();
		expect(d.promotedComposition).toBeUndefined();
	});

	it("invalid → unverifiable/not-ok with no promoted facts", () => {
		const d = programLockAwarenessDiagnostic(
			{ state: "invalid", invalidReason: "not valid JSON" },
			"0.4.1",
		);
		expect(d.ok).toBe(false);
		expect(d.applicability).toBe("unverifiable");
		expect(d.manifestState).toBe("invalid");
		expect(d.detail).toContain("not valid JSON");
		expect(d.versionRelationship).toBeUndefined();
		expect(d.promotedComposition).toBeUndefined();
	});

	it("unknown package version → packageVersion unknown and no relationship is invented", () => {
		const read: PromotedCompositionRead = {
			state: "valid",
			composition: { ...VALID_MANIFEST },
		};
		const d = programLockAwarenessDiagnostic(read, "unknown");
		expect(d.packageVersion).toBe("unknown");
		expect(d.ok).toBe(true);
		expect(d.applicability).toBe("applicable");
		expect(d.versionRelationship).toBeUndefined();
		expect(d.promotedComposition).toEqual(VALID_MANIFEST);
	});
});
