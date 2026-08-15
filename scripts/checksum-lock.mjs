#!/usr/bin/env node
/**
 * Program-lock checksum producer (SDD-010 release-train).
 *
 * Deterministic SHA-256 checksums for the lock's pinned, verifiable
 * composition. Reads the program lock plus explicit `repository=path` artifact
 * bindings and emits a canonical `checksums` object (generation) or validates
 * the lock's stored checksum block against the supplied inputs (`--verify`,
 * exits non-zero on any difference, emits no replacement data).
 *
 * Contract (design D2-D5):
 * - Repository root is resolved from `import.meta.url`, never `process.cwd()`.
 * - Exactly one host artifact binding is required; duplicate repository or
 *   artifact identities are rejected.
 * - Every binding must name a repository with an admissible current claim in
 *   the lock (host, or a sibling with `temporalClass: "current-claim"`).
 * - Artifacts for `unknown`/`awaiting-evidence` repositories are rejected.
 * - Any input resolving to `program-lock.json` itself is rejected
 *   (checksum self-inclusion rule, D5).
 * - Supplied artifacts must be regular, readable, non-symlink files with a
 *   stable basename (no separators, `.`/`..`, control characters, or
 *   backslashes).
 * - A lock-declared checksum entry without a supplied readable input fails
 *   closed in both generation and verification modes.
 * - Entries sort by `repository` then `artifact` using direct Unicode
 *   code-point comparison; `setSha256` hashes the canonical compact UTF-8
 *   serialization of the sorted entries (D4).
 * - This script never invokes Git or GitHub and never reads or emits
 *   HEAD/tag-target/carrying-commit SHAs (bootstrap rule, D5).
 */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_LOCK = join(
	ROOT,
	"openspec",
	"programs",
	"drenyra-dominion",
	"program-lock.json",
);
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** Fail closed with a `checksum-lock:` prefixed diagnostic and exit 1. */
function fail(message) {
	console.error(`checksum-lock: ${message}`);
	process.exit(1);
}

/** Parse the bounded CLI: --lock, repeated --artifact repo=path, --verify, --output. */
function parseArgs(argv) {
	const opts = { lock: null, artifacts: [], output: null, verify: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--verify") {
			opts.verify = true;
		} else if (arg === "--lock" || arg === "--output") {
			if (i + 1 >= argv.length) fail(`missing value for ${arg}`);
			if (arg === "--lock") opts.lock = argv[++i];
			else opts.output = argv[++i];
		} else if (arg === "--artifact") {
			if (i + 1 >= argv.length) fail("missing value for --artifact");
			const binding = argv[++i];
			const eq = binding.indexOf("=");
			if (eq <= 0) fail(`malformed artifact binding: ${binding}`);
			opts.artifacts.push({
				repository: binding.slice(0, eq),
				path: binding.slice(eq + 1),
			});
		} else {
			fail(`unrecognized argument: ${arg}`);
		}
	}
	if (!opts.lock) opts.lock = DEFAULT_LOCK;
	return opts;
}

/** Read and structurally validate the program lock (fail closed). */
function readLock(lockPath) {
	let lock;
	try {
		lock = JSON.parse(readFileSync(lockPath, "utf8"));
	} catch (error) {
		fail(`unreadable or invalid lock ${lockPath}: ${error.message}`);
	}
	const hostRepo = lock?.currentVerified?.host?.repository;
	if (typeof hostRepo !== "string" || hostRepo.length === 0)
		fail("lock has no currentVerified.host.repository");
	const inspectedRevision = lock?.currentVerified?.inspectedRevision;
	if (typeof inspectedRevision !== "string" || !HEX40.test(inspectedRevision))
		fail("lock currentVerified.inspectedRevision must be a lowercase 40-hex SHA");
	const siblings = lock?.currentVerified?.siblingRepositories ?? {};
	if (typeof siblings !== "object" || siblings === null)
		fail("lock currentVerified.siblingRepositories must be an object");
	return { lock, hostRepo, inspectedRevision, siblings };
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

/** Resolve an artifact to its realpath, requiring a regular, readable, non-symlink file. */
function resolveArtifact(path, label) {
	const normalized = resolve(path);
	let stat;
	try {
		stat = lstatSync(normalized);
	} catch (error) {
		fail(`unreadable artifact for ${label}: ${path} (${error.message})`);
	}
	if (stat.isSymbolicLink())
		fail(`refusing symlink artifact for ${label}: ${path}`);
	if (!stat.isFile())
		fail(`artifact must be a regular file for ${label}: ${path}`);
	try {
		return realpathSync(normalized);
	} catch (error) {
		fail(`unreadable artifact for ${label}: ${path} (${error.message})`);
	}
}

/** Direct Unicode code-point order by repository, then artifact (no locale collation). */
function canonicalCompare(a, b) {
	if (a.repository < b.repository) return -1;
	if (a.repository > b.repository) return 1;
	if (a.artifact < b.artifact) return -1;
	if (a.artifact > b.artifact) return 1;
	return 0;
}

/** Repositories the lock currently declares in its checksums block (may be absent). */
function declaredRepositories(lock) {
	const entries = lock?.checksums?.entries;
	if (!Array.isArray(entries)) return [];
	const out = new Set();
	for (const entry of entries)
		if (typeof entry?.repository === "string") out.add(entry.repository);
	return out;
}

/** Build the sorted, canonical entry set from the supplied bindings. */
function computeEntries(bindings, ctx, lockAbs) {
	const seenRepos = new Set();
	for (const binding of bindings) {
		if (seenRepos.has(binding.repository))
			fail(`duplicate repository binding: ${binding.repository}`);
		seenRepos.add(binding.repository);
	}
	const hostBindings = bindings.filter(
		(binding) => binding.repository === ctx.hostRepo,
	);
	if (hostBindings.length !== 1)
		fail("require exactly one host artifact binding (the published host .tgz)");
	const admissible = new Set([ctx.hostRepo]);
	for (const [name, info] of Object.entries(ctx.siblings))
		if (info?.temporalClass === "current-claim") admissible.add(name);

	const entries = [];
	const seenArtifacts = new Set();
	for (const binding of bindings) {
		if (!admissible.has(binding.repository))
			fail(
				`artifact binding for ${binding.repository} has no admissible current claim in the lock (unknown or awaiting-evidence)`,
			);
		const real = resolveArtifact(resolve(ROOT, binding.path), binding.repository);
		if (real === lockAbs)
			fail("refusing lock self-inclusion: the lock file cannot be a checksum input");
		const artifact = basename(real);
		assertStableBasename(artifact);
		if (seenArtifacts.has(artifact))
			fail(`duplicate artifact identity: ${artifact}`);
		seenArtifacts.add(artifact);
		let revision;
		if (binding.repository === ctx.hostRepo) {
			revision = ctx.inspectedRevision;
		} else {
			const info = ctx.siblings[binding.repository];
			if (typeof info?.commitSha !== "string" || !HEX40.test(info.commitSha))
				fail(`no revision pin for admissible sibling ${binding.repository}`);
			revision = info.commitSha;
		}
		let digest;
		try {
			digest = createHash("sha256").update(readFileSync(real)).digest("hex");
		} catch (error) {
			fail(`unreadable artifact for ${binding.repository}: ${real}`);
		}
		entries.push({
			repository: binding.repository,
			revision,
			artifact,
			sha256: digest,
		});
	}
	return entries.sort(canonicalCompare);
}

/** Canonical set digest over the compact UTF-8 serialization of the sorted entries. */
function checksumSet(entries) {
	const canonical = JSON.stringify(entries);
	const setSha256 = createHash("sha256")
		.update(canonical, "utf8")
		.digest("hex");
	return { canonical, setSha256 };
}

function verify(entries, ctx) {
	const declared = ctx.lock?.checksums;
	if (typeof declared !== "object" || declared === null)
		fail("lock has no verifiable checksums block");
	if (!Array.isArray(declared.entries))
		fail("lock checksums.entries must be an array");
	if (typeof declared.setSha256 !== "string" || !HEX64.test(declared.setSha256))
		fail("lock checksums.setSha256 must be a lowercase 64-hex SHA");
	if (declared.algorithm !== "sha256")
		fail(`lock checksums.algorithm mismatch: ${declared.algorithm}`);
	if (declared.canonicalization !== "json-entries-v1")
		fail(
			`lock checksums.canonicalization mismatch: ${declared.canonicalization}`,
		);
	const { setSha256 } = checksumSet(entries);
	if (JSON.stringify(entries) !== JSON.stringify(declared.entries))
		fail("checksums.entries mismatch (missing, extra, changed, or reordered entry)");
	if (declared.setSha256 !== setSha256)
		fail("checksums.setSha256 mismatch (changed ordering or canonicalization)");
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	const lockAbs = resolve(ROOT, opts.lock);
	const { lock, hostRepo, inspectedRevision, siblings } = readLock(lockAbs);

	const declared = declaredRepositories(lock);
	for (const repo of declared) {
		if (!opts.artifacts.some((binding) => binding.repository === repo))
			fail(
				`missing supplied artifact input for declared checksum entry: ${repo}`,
			);
	}

	const entries = computeEntries(opts.artifacts, {
		hostRepo,
		inspectedRevision,
		siblings,
	}, lockAbs);
	const { setSha256 } = checksumSet(entries);

	if (opts.verify) {
		verify(entries, { lock });
		console.log(`checksum-lock: verified (${entries.length} entries)`);
		return;
	}

	const checksums = {
		algorithm: "sha256",
		canonicalization: "json-entries-v1",
		entries,
		setSha256,
	};
	const output = `${JSON.stringify(checksums, null, 2)}\n`;
	if (opts.output) {
		const staging = resolve(ROOT, opts.output);
		try {
			mkdirSync(dirname(staging), { recursive: true });
			writeFileSync(staging, output);
		} catch (error) {
			fail(`cannot write staging file ${staging}: ${error.message}`);
		}
		console.log(`checksum-lock: wrote checksums to ${opts.output}`);
	} else {
		process.stdout.write(output);
	}
}

main();
