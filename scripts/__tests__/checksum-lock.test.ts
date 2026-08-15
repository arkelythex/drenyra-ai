/**
 * checksum-lock evidence (strict TDD): subprocess tests for the deterministic
 * program-lock checksum producer. Pins determinism (byte-identical output from
 * two working directories), canonical ordering (Unicode code-point by
 * repository then artifact, reversed CLI order), lowercase SHA-256 encoding,
 * lock-file self-exclusion (direct/relative/normalized/symlinked references),
 * fail-closed inputs (missing, unreadable, non-regular, symlinked, duplicate,
 * unknown-repository, undeclared), unknown-sibling rejection, and --verify
 * mismatch classes (changed artifact, missing entry, extra entry, wrong
 * revision, changed ordering/canonicalization). R4/R7; D2-D5.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../checksum-lock.mjs", import.meta.url));
const LOCK_REL = "openspec/programs/drenyra-dominion/program-lock.json";
const REV = "d440203183e24b2a0ecf773915888bb6072fc015";
const ENGRAM_SHA = "f997abc9cd97551cb0b9cae74623ec1fe002b9d2";
const PI_SHA = "42607035c42901eebadc1bf2879cb09a1416f3b5";
const CARRYING_SHA = "1".repeat(40); // a carrying-commit-like SHA that must never appear
const HOST_BYTES = "host-tgz-bytes-A\n";
const ENGRAM_BYTES = "engram-artifact-bytes\n";
const PI_BYTES = "pi-artifact-bytes\n";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.length = 0;
});

const sha256 = (bytes: string) =>
	createHash("sha256").update(bytes, "utf8").digest("hex");

/** Minimal candidate lock fixture: host current-claim + two verified public siblings + private trio unknown. */
function lockFixture(): Record<string, unknown> {
	return {
		$schema: "drenyra-dominion/program-lock.schema.json",
		program: "drenyra-dominion",
		lockVersion: 1,
		stage: "private",
		generatedAt: "2026-08-15T07:00:00Z",
		status: "candidate",
		currentVerified: {
			temporalClass: "current-claim",
			inspectedRevision: REV,
			inspectedAt: "2026-08-15T07:28:33Z",
			evidence: ["FIX-001"],
			host: {
				repository: "drenyra-ai",
				role: "authority-core",
				version: "0.4.0",
				versionEvidence: "FIX-001",
				license: "proprietary",
				licenseEvidence: "FIX-001",
				testTotal: 915,
				testPassed: 915,
				testEvidence: "FIX-001",
				typecheck: "clean",
				typecheckEvidence: "FIX-001",
				conformance: "passing",
				conformanceEvidence: "FIX-001",
				githubVisibility: "PUBLIC",
				visibilityEvidence: "FIX-001",
				commitSha: null,
				note: "fixture",
			},
			siblingRepositories: {
				"drenyra-engram": {
					temporalClass: "current-claim",
					commitSha: ENGRAM_SHA,
					githubVisibility: "PUBLIC",
					source: "gh-api",
					fetchedAt: "2026-08-15T07:30:00Z",
					evidence: "FIX-002",
				},
				"drenyra-pi": {
					temporalClass: "current-claim",
					commitSha: PI_SHA,
					githubVisibility: "PUBLIC",
					source: "gh-api",
					fetchedAt: "2026-08-15T07:30:00Z",
					evidence: "FIX-003",
				},
				"drenyra-command-center": {
					temporalClass: "unknown",
					commitSha: null,
					status: "awaiting-evidence",
				},
				"drenyra-skills": {
					temporalClass: "unknown",
					commitSha: null,
					status: "awaiting-evidence",
				},
				"drenyra-guardian-angel": {
					temporalClass: "unknown",
					commitSha: null,
					status: "awaiting-evidence",
				},
			},
		},
	};
}

function fixture(withSiblings = true): string {
	const root = mkdtempSync(join(tmpdir(), "checksum-lock-"));
	roots.push(root);
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "openspec", "programs", "drenyra-dominion"), {
		recursive: true,
	});
	mkdirSync(join(root, "dist"), { recursive: true });
	copyFileSync(SCRIPT, join(root, "scripts", "checksum-lock.mjs"));
	writeFileSync(join(root, LOCK_REL), `${JSON.stringify(lockFixture(), null, 2)}\n`);
	writeFileSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"), HOST_BYTES);
	if (withSiblings) {
		writeFileSync(join(root, "dist", "drenyra-engram-artifact.bin"), ENGRAM_BYTES);
		writeFileSync(join(root, "dist", "drenyra-pi-artifact.bin"), PI_BYTES);
	}
	return root;
}

/** Run the fixture script from a throwaway working directory (never the repo). */
function run(root: string, args: string[]) {
	const cwd = mkdtempSync(join(tmpdir(), "checksum-lock-cwd-"));
	const result = spawnSync(process.execPath, [
		join(root, "scripts", "checksum-lock.mjs"),
		...args,
	], { cwd, encoding: "utf8" });
	rmSync(cwd, { recursive: true, force: true });
	return result;
}

const lockPath = (root: string) => join(root, LOCK_REL);
const readLock = (root: string) =>
	JSON.parse(readFileSync(lockPath(root), "utf8")) as Record<string, any>;
const writeLock = (root: string, lock: Record<string, unknown>) =>
	writeFileSync(lockPath(root), `${JSON.stringify(lock, null, 2)}\n`);
const baseArgs = [
	"--lock",
	LOCK_REL,
	"--artifact",
	"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
	"--artifact",
	"drenyra-engram=dist/drenyra-engram-artifact.bin",
	"--artifact",
	"drenyra-pi=dist/drenyra-pi-artifact.bin",
];

const hostEntry = {
	repository: "drenyra-ai",
	revision: REV,
	artifact: "drenyra-ai-0.4.0.tgz",
	sha256: sha256(HOST_BYTES),
};
const engramEntry = {
	repository: "drenyra-engram",
	revision: ENGRAM_SHA,
	artifact: "drenyra-engram-artifact.bin",
	sha256: sha256(ENGRAM_BYTES),
};
const piEntry = {
	repository: "drenyra-pi",
	revision: PI_SHA,
	artifact: "drenyra-pi-artifact.bin",
	sha256: sha256(PI_BYTES),
};
const sortedEntries = [hostEntry, engramEntry, piEntry];
const setSha = sha256(JSON.stringify(sortedEntries));

describe("checksum-lock determinism and canonicalization", () => {
	it("produces byte-identical checksum JSON from two different working directories", () => {
		const root = fixture();
		const first = run(root, baseArgs);
		expect(first.status).toBe(0);
		const second = run(root, baseArgs);
		expect(second.status).toBe(0);
		expect(first.stdout).toBe(second.stdout);
		const parsed = JSON.parse(first.stdout) as {
			algorithm: string;
			canonicalization: string;
			entries: unknown[];
			setSha256: string;
		};
		expect(parsed.algorithm).toBe("sha256");
		expect(parsed.canonicalization).toBe("json-entries-v1");
		expect(parsed.entries).toEqual(sortedEntries);
		expect(parsed.setSha256).toBe(setSha);
	});

	it("reversed CLI artifact order yields the same sorted entries and setSha256", () => {
		const root = fixture();
		const reversed = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-pi=dist/drenyra-pi-artifact.bin",
			"--artifact",
			"drenyra-engram=dist/drenyra-engram-artifact.bin",
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
		]);
		expect(reversed.status).toBe(0);
		const parsed = JSON.parse(reversed.stdout) as {
			entries: unknown[];
			setSha256: string;
		};
		expect(parsed.entries).toEqual(sortedEntries);
		expect(parsed.setSha256).toBe(setSha);
	});

	it("emits lowercase 64-hex digests that change when artifact bytes change", () => {
		const root = fixture();
		const first = JSON.parse(run(root, baseArgs).stdout) as {
			entries: Array<{ sha256: string }>;
		};
		for (const entry of first.entries) expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
		writeFileSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"), "tampered-host-bytes\n");
		const second = JSON.parse(run(root, baseArgs).stdout) as {
			entries: Array<{ repository: string; sha256: string }>;
		};
		const host = second.entries.find((e) => e.repository === "drenyra-ai")!;
		expect(host.sha256).toBe(sha256("tampered-host-bytes\n"));
		expect(host.sha256).not.toBe(hostEntry.sha256);
	});

	it("emits no lock path and no carrying-commit SHA in the checksum output", () => {
		const root = fixture();
		const out = run(root, baseArgs);
		expect(out.status).toBe(0);
		expect(out.stdout).not.toContain("program-lock.json");
		expect(out.stdout).not.toContain(join(root, LOCK_REL));
		expect(out.stdout).not.toContain(CARRYING_SHA);
	});
});

describe("checksum-lock fail-closed inputs", () => {
	it("rejects direct, relative, normalized, and symlinked references to the lock file", () => {
		const root = fixture();
		const cases: Array<[string, string[]]> = [
			["direct", ["--lock", LOCK_REL, "--artifact", `drenyra-ai=${LOCK_REL}`]],
			[
				"relative",
				["--lock", LOCK_REL, "--artifact", `drenyra-ai=./${LOCK_REL}`],
			],
			[
				"normalized",
				[
					"--lock",
					LOCK_REL,
					"--artifact",
					"drenyra-ai=openspec/./programs/drenyra-dominion/program-lock.json",
				],
			],
		];
		for (const [label, args] of cases) {
			const result = run(root, args);
			expect(result.status, label).not.toBe(0);
			expect(result.stderr, label).toMatch(/lock/i);
		}
		const link = join(root, "dist", "lock-alias.tgz");
		symlinkSync(lockPath(root), link);
		const symlink = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/lock-alias.tgz",
		]);
		expect(symlink.status).not.toBe(0);
		expect(symlink.stderr).toMatch(/symlink/i);
	});

	it("fails closed on missing, unreadable, non-regular, and symlinked artifacts", () => {
		const root = fixture();
		const missing = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/does-not-exist.tgz",
		]);
		expect(missing.status).not.toBe(0);
		expect(missing.stderr).toMatch(/^checksum-lock:/);

		const unreadable = join(root, "dist", "unreadable.tgz");
		writeFileSync(unreadable, HOST_BYTES);
		chmodSync(unreadable, 0o000);
		const unreadableRun = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/unreadable.tgz",
		]);
		expect(unreadableRun.status).not.toBe(0);

		const dirArtifact = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist",
		]);
		expect(dirArtifact.status).not.toBe(0);
		expect(dirArtifact.stderr).toMatch(/regular/i);

		const link = join(root, "dist", "link.tgz");
		symlinkSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"), link);
		const symlinked = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/link.tgz",
		]);
		expect(symlinked.status).not.toBe(0);
		expect(symlinked.stderr).toMatch(/symlink/i);
	});

	it("fails closed on duplicate, unknown-repository, and undeclared inputs", () => {
		const root = fixture();
		const duplicate = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
		]);
		expect(duplicate.status).not.toBe(0);
		expect(duplicate.stderr).toMatch(/duplicate/i);

		const unknown = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
			"--artifact",
			"drenyra-command-center=dist/drenyra-pi-artifact.bin",
		]);
		expect(unknown.status).not.toBe(0);
		expect(unknown.stderr).toMatch(/unknown|admissible/i);

		const ghost = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
			"--artifact",
			"ghost-repo=dist/drenyra-pi-artifact.bin",
		]);
		expect(ghost.status).not.toBe(0);
		expect(ghost.stderr).toMatch(/unknown|admissible|ghost-repo/i);
	});

	it("requires exactly one host artifact binding", () => {
		const root = fixture();
		const none = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-engram=dist/drenyra-engram-artifact.bin",
		]);
		expect(none.status).not.toBe(0);
		expect(none.stderr).toMatch(/host/i);
	});

	it("rejects the same artifact file under two different repositories", () => {
		const root = fixture();
		const result = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
			"--artifact",
			"drenyra-engram=dist/drenyra-ai-0.4.0.tgz",
		]);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/duplicate artifact/i);
	});

	it("--output staging file carries byte-identical checksum JSON", () => {
		const root = fixture();
		const direct = run(root, baseArgs);
		const staged = run(root, [...baseArgs, "--output", "staging/checksums.json"]);
		expect(staged.status).toBe(0);
		expect(
			readFileSync(join(root, "staging", "checksums.json"), "utf8"),
		).toBe(direct.stdout);
	});

	it("requires a supplied input for every lock-declared checksum entry", () => {
		const root = fixture(false);
		const lock = readLock(root);
		lock.checksums = {
			algorithm: "sha256",
			canonicalization: "json-entries-v1",
			entries: [hostEntry],
			setSha256: setSha,
		};
		writeLock(root, lock);
		const gen = run(root, ["--lock", LOCK_REL]);
		expect(gen.status).not.toBe(0);
		expect(gen.stderr).toMatch(/declared/i);
		const ver = run(root, ["--lock", LOCK_REL, "--verify"]);
		expect(ver.status).not.toBe(0);
		expect(ver.stderr).toMatch(/declared/i);
	});
});

describe("checksum-lock unknown siblings and --verify", () => {
	it("omits unknown private siblings and rejects a supplied artifact for one", () => {
		const root = fixture(false);
		const out = run(root, [
			"--lock",
			LOCK_REL,
			"--artifact",
			"drenyra-ai=dist/drenyra-ai-0.4.0.tgz",
		]);
		expect(out.status).toBe(0);
		const parsed = JSON.parse(out.stdout) as { entries: Array<{ repository: string }> };
		expect(parsed.entries).toEqual([hostEntry]);
		expect(parsed.entries.some((e) => e.repository === "drenyra-command-center")).toBe(false);
		expect(out.stdout).not.toContain("drenyra-skills");
		expect(out.stdout).not.toContain("drenyra-guardian-angel");
	});

	it("--verify passes for the exact lock block and fails on every mismatch class", () => {
		const root = fixture();
		const generated = JSON.parse(run(root, baseArgs).stdout) as Record<string, unknown>;
		const lock = readLock(root);
		lock.checksums = generated;
		writeLock(root, lock);

		const clean = run(root, [...baseArgs, "--verify"]);
		expect(clean.status).toBe(0);

		const tamper = (mutate: (l: Record<string, any>) => void) => {
			const l = readLock(root);
			mutate(l);
			writeLock(root, l);
			const result = run(root, [...baseArgs, "--verify"]);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toMatch(/^checksum-lock:/);
		};

		writeFileSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"), "changed-bytes\n");
		expect(run(root, [...baseArgs, "--verify"]).status).not.toBe(0);
		writeFileSync(join(root, "dist", "drenyra-ai-0.4.0.tgz"), HOST_BYTES);

		tamper((l) => (l.checksums.entries = l.checksums.entries.slice(1)));
		tamper((l) =>
			l.checksums.entries.push({
				repository: "drenyra-pi",
				revision: PI_SHA,
				artifact: "extra.bin",
				sha256: "a".repeat(64),
			}),
		);
		tamper(
			(l) =>
				(l.checksums.entries.find(
					(e: { repository: string }) => e.repository === "drenyra-engram",
				).revision = "f".repeat(40)),
		);
		tamper((l) => l.checksums.entries.reverse());
		tamper((l) => (l.checksums.setSha256 = "0".repeat(64)));
	});
});
