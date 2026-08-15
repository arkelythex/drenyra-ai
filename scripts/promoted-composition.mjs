#!/usr/bin/env node
/**
 * Promoted-composition manifest producer (SDD-020 slice C, PR 1).
 *
 * Deterministic, fail-closed derivation of the bundled composition manifest
 * (dist/promoted-composition.json) from the promoted Drenyra Dominion program
 * lock. Mirrors scripts/checksum-lock.mjs discipline:
 * - Repository root is resolved from `import.meta.url`, never `process.cwd()`.
 * - Bounded CLI (--lock / --output with repo-root-relative resolution),
 *   diagnostics prefixed `promoted-composition:`, exit 1 without output on any
 *   failure.
 * - Derives ONLY the five non-carrying promotable facts (version,
 *   verifiedRevision, hostArtifactSha256, setSha256, attestationTag). The
 *   carrying-commit SHA is never read or emitted (bootstrap rule, D5).
 * - Never invokes Git or GitHub and never reads HEAD/tag-target/branch state,
 *   environment variables, package metadata, or the network; no timestamps or
 *   random values. Identical input produces byte-identical output.
 * - Writes through a fixed sibling staging path and renames into place; a
 *   failed generation leaves the selected output absent (D5).
 *
 * The source program lock is read-only and is never rewritten by generation.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_LOCK = join(
	ROOT,
	"openspec",
	"programs",
	"drenyra-dominion",
	"program-lock.json",
);
const DEFAULT_OUTPUT = join(ROOT, "dist", "promoted-composition.json");
const STAGING_SUFFIX = ".staging";
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** Fail closed with a `promoted-composition:` prefixed diagnostic and exit 1. */
function fail(message) {
	console.error(`promoted-composition: ${message}`);
	process.exit(1);
}

/** Parse the bounded CLI: --lock, --output. Unknown/duplicate flags fail. */
function parseArgs(argv) {
	const opts = { lock: null, output: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--lock" || arg === "--output") {
			if (i + 1 >= argv.length) fail(`missing value for ${arg}`);
			const value = argv[++i];
			if (arg === "--lock") {
				if (opts.lock !== null) fail("duplicate --lock flag");
				opts.lock = value;
			} else {
				if (opts.output !== null) fail("duplicate --output flag");
				opts.output = value;
			}
		} else {
			fail(`unrecognized argument: ${arg}`);
		}
	}
	if (opts.lock === null) opts.lock = DEFAULT_LOCK;
	if (opts.output === null) opts.output = DEFAULT_OUTPUT;
	return opts;
}

/** Best-effort removal of a single file (D5: exact output + staging targets only). */
function removeQuietly(path) {
	try {
		rmSync(path, { force: true });
	} catch {
		// best effort; the subsequent write/rename still fails closed
	}
}

/** Remove exactly the selected output and its fixed sibling staging path (D5). */
function cleanup(outputPath, stagingPath) {
	removeQuietly(outputPath);
	removeQuietly(stagingPath);
}

/** The stable basename rule: no separators, `.`/`..`, control chars, backslashes. */
function assertStableBasename(name) {
	if (typeof name !== "string" || name.length === 0 || name === "." || name === "..")
		fail(`unstable artifact basename: ${name}`);
	if (name.includes("/") || name.includes("\\"))
		fail(`unstable artifact basename: ${name}`);
	if (/[\u0000-\u001f\u007f]/.test(name))
		fail(`unstable artifact basename: ${name}`);
}

/** Read and structurally validate the promoted lock (fail closed). */
function readLock(lockPath) {
	let lock;
	try {
		lock = JSON.parse(readFileSync(lockPath, "utf8"));
	} catch (error) {
		fail(`unreadable or invalid lock ${lockPath}: ${error.message}`);
	}
	if (typeof lock !== "object" || lock === null || Array.isArray(lock))
		fail("lock must be a JSON object");
	if (lock.status !== "promoted")
		fail(`lock status must be "promoted", got: ${String(lock.status)}`);
	const host = lock?.currentVerified?.host;
	if (typeof host !== "object" || host === null)
		fail("lock has no currentVerified.host object");
	if (typeof host.repository !== "string" || host.repository.length === 0)
		fail("lock currentVerified.host.repository must be a non-empty string");
	const inspectedRevision = lock?.currentVerified?.inspectedRevision;
	if (typeof inspectedRevision !== "string" || !HEX40.test(inspectedRevision))
		fail("lock currentVerified.inspectedRevision must be a lowercase 40-hex SHA");
	const checksums = lock?.checksums;
	if (typeof checksums !== "object" || checksums === null)
		fail("lock has no checksums object");
	if (!Array.isArray(checksums.entries))
		fail("lock checksums.entries must be an array");
	const attestation = lock?.attestation;
	if (typeof attestation !== "object" || attestation === null)
		fail("lock has no attestation object");
	return { lock, host, inspectedRevision, checksums, attestation };
}

/** Reconcile the source lock and derive the five non-carrying facts (fail closed). */
function deriveFacts(lockPath) {
	const { lock, host, inspectedRevision, checksums, attestation } =
		readLock(lockPath);

	if (checksums.algorithm !== "sha256")
		fail(`lock checksums.algorithm must be "sha256", got: ${String(checksums.algorithm)}`);
	if (checksums.canonicalization !== "json-entries-v1")
		fail(
			`lock checksums.canonicalization must be "json-entries-v1", got: ${String(checksums.canonicalization)}`,
		);

	const entries = checksums.entries;
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null)
			fail("every checksum entry must be an object");
		if (typeof entry.repository !== "string" || entry.repository.length === 0)
			fail("every checksum entry needs a non-empty repository");
		if (typeof entry.revision !== "string" || !HEX40.test(entry.revision))
			fail("every checksum entry needs a lowercase 40-hex revision");
		assertStableBasename(entry.artifact);
		if (typeof entry.sha256 !== "string" || !HEX64.test(entry.sha256))
			fail("every checksum entry needs a lowercase 64-hex sha256 digest");
	}

	const hostEntries = entries.filter((entry) => entry.repository === host.repository);
	if (hostEntries.length !== 1)
		fail(`require exactly one host checksum entry for ${host.repository}`);
	const hostEntry = hostEntries[0];

	if (hostEntry.revision !== inspectedRevision)
		fail("host checksum entry revision does not match currentVerified.inspectedRevision");
	if (attestation.verifiedRevision !== inspectedRevision)
		fail("attestation.verifiedRevision does not match currentVerified.inspectedRevision");

	if (typeof checksums.setSha256 !== "string" || !HEX64.test(checksums.setSha256))
		fail("lock checksums.setSha256 must be a lowercase 64-hex SHA");
	const canonical = JSON.stringify(entries);
	const recomputed = createHash("sha256").update(canonical, "utf8").digest("hex");
	if (checksums.setSha256 !== recomputed)
		fail("lock checksums.setSha256 does not reconcile with the canonical entry set");
	if (attestation.checksumSetSha256 !== recomputed)
		fail("attestation.checksumSetSha256 does not reconcile with the canonical entry set");

	// Bootstrap rule (D5): the carrying-commit SHA exists only in the external
	// signed attestation; a non-null value in the lock fails closed and is never
	// carried into the derived manifest.
	if (host.commitSha !== null)
		fail("bootstrap rule: currentVerified.host.commitSha must be null");
	if (attestation.carryingCommitSha !== null)
		fail("bootstrap rule: attestation.carryingCommitSha must be null");

	const version = host.version;
	if (typeof version !== "string" || !SEMVER.test(version))
		fail(
			`lock currentVerified.host.version must be a strict semantic version, got: ${String(version)}`,
		);

	const attestationTag = attestation.tag;
	if (
		typeof attestationTag !== "string" ||
		attestationTag.length === 0 ||
		attestationTag !== attestationTag.trim()
	)
		fail("lock attestation.tag must be a non-empty trimmed string");

	return {
		version,
		verifiedRevision: inspectedRevision,
		hostArtifactSha256: hostEntry.sha256,
		setSha256: checksums.setSha256,
		attestationTag,
	};
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	const lockPath = resolve(ROOT, opts.lock);
	const outputPath = resolve(ROOT, opts.output);
	const stagingPath = `${outputPath}${STAGING_SUFFIX}`;

	// Fail-closed pre-clean: a stale manifest or staging file from a prior build
	// must never survive this run (D5).
	cleanup(outputPath, stagingPath);

	try {
		const facts = deriveFacts(lockPath);
		const manifest = {
			version: facts.version,
			verifiedRevision: facts.verifiedRevision,
			hostArtifactSha256: facts.hostArtifactSha256,
			setSha256: facts.setSha256,
			attestationTag: facts.attestationTag,
		};
		const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
		mkdirSync(dirname(stagingPath), { recursive: true });
		writeFileSync(stagingPath, bytes);
		renameSync(stagingPath, outputPath);
		console.log(`promoted-composition: wrote manifest to ${opts.output}`);
	} catch (error) {
		cleanup(outputPath, stagingPath);
		fail(error instanceof Error ? error.message : String(error));
	}
}

main();
