#!/usr/bin/env node
/**
 * Alert mirror: generate package-lock.json from bun.lock
 * (odd/tasks/bun-lock-alert-mirror.md).
 *
 * CI installs `bun.lock`, but GitHub's dependency graph does not read it; it
 * reads `package-lock.json`. That file exists only so that Dependabot alerts
 * describe this repository. `npm install --package-lock-only` resolves its own
 * tree, so it drifts from what bun installs: an advisory on a version only bun
 * installs would never alert. This script writes the mirror from `bun.lock`
 * itself: the same package paths, the same exact versions, the same integrity.
 *
 * Usage:
 *   node scripts/sync-alert-mirror.mjs           write package-lock.json
 *   node scripts/sync-alert-mirror.mjs --check   exit 1 if it is not current
 *   --root <dir>                                 repository root (default: this repo)
 *
 * Contract:
 * - Scope flags (`dev`, `optional`, `devOptional`) follow npm's meaning and
 *   come from reachability over declared edges: dependencies and required
 *   peers are required edges; optionalDependencies and optional peers are
 *   optional edges; resolution walks up the tree like Node does.
 * - Fail closed: a source the mirror cannot represent faithfully (git, file:,
 *   tarball URL, alias, custom registry, missing integrity), a required
 *   dependency bun.lock does not contain, or a package nothing reaches aborts
 *   with exit 2 before anything is written.
 * - Output is deterministic: the root entry first, then paths in code-point
 *   order, two-space JSON, trailing newline. `--check` never writes.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY = "https://registry.npmjs.org";
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FIX = "run `bun run deps:mirror` and commit package-lock.json";

class MirrorError extends Error {}

function fail(message) {
	throw new MirrorError(`sync-alert-mirror: cannot mirror bun.lock: ${message}`);
}

/** Parses bun's JSONC: drops commas that precede `}` or `]` outside strings. */
export function parseBunLock(text) {
	let out = "";
	let inString = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			out += ch;
			if (ch === "\\") {
				out += text[i + 1] ?? "";
				i += 1;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			out += ch;
			continue;
		}
		if (ch === ",") {
			let j = i + 1;
			while (j < text.length && /\s/.test(text[j])) j += 1;
			if (text[j] === "}" || text[j] === "]") continue;
		}
		out += ch;
	}
	return JSON.parse(out);
}

/** Splits a bun package key into package names: `@a/b/c` -> [`@a/b`, `c`]. */
function namesOf(key) {
	const parts = key.split("/");
	const names = [];
	for (let i = 0; i < parts.length; i += 1) {
		if (parts[i].startsWith("@")) {
			names.push(`${parts[i]}/${parts[i + 1]}`);
			i += 1;
		} else {
			names.push(parts[i]);
		}
	}
	return names;
}

function splitIdent(ident) {
	const at = ident.lastIndexOf("@");
	if (at <= 0) fail(`unparseable identity ${JSON.stringify(ident)}`);
	return { name: ident.slice(0, at), version: ident.slice(at + 1) };
}

function tarballUrl(name, version) {
	const base = name.includes("/") ? name.slice(name.indexOf("/") + 1) : name;
	return `${REGISTRY}/${name}/-/${base}-${version}.tgz`;
}

function asArray(value) {
	if (value === undefined) return undefined;
	return Array.isArray(value) ? [...value] : [value];
}

function nonEmpty(record) {
	return record && Object.keys(record).length > 0 ? { ...record } : undefined;
}

/** Reads and validates every bun.lock package entry. */
function readPackages(lock) {
	const packages = new Map();
	for (const [key, entry] of Object.entries(lock.packages ?? {})) {
		if (!Array.isArray(entry) || typeof entry[0] !== "string") fail(`entry ${key} is not a package tuple`);
		const [ident, resolvedFrom, meta = {}, integrity] = entry;
		const { name, version } = splitIdent(ident);
		const names = namesOf(key);
		if (name !== names[names.length - 1]) fail(`${key} is an alias or non-registry source (${ident})`);
		if (!EXACT_VERSION.test(version)) fail(`${key} has a non-registry source (${ident})`);
		if (resolvedFrom !== "") fail(`${key} resolves from ${JSON.stringify(resolvedFrom)}, not the default registry`);
		if (typeof integrity !== "string" || integrity === "") fail(`${key} has no integrity`);
		packages.set(key, { key, names, name, version, meta, integrity });
	}
	return packages;
}

/** Node-style resolution of `name` as seen from the package at `fromNames`. */
function resolveFrom(packages, fromNames, name) {
	for (let depth = fromNames.length; depth >= 0; depth -= 1) {
		const key = [...fromNames.slice(0, depth), name].join("/");
		if (packages.has(key)) return key;
	}
	return undefined;
}

function edgesOf(pkg) {
	const meta = pkg.meta;
	const optionalPeers = new Set(meta.optionalPeers ?? []);
	const required = { ...(meta.dependencies ?? {}) };
	const optional = { ...(meta.optionalDependencies ?? {}) };
	for (const peer of Object.keys(meta.peerDependencies ?? {})) {
		if (optionalPeers.has(peer)) optional[peer] = meta.peerDependencies[peer];
		else required[peer] = meta.peerDependencies[peer];
	}
	return { required: Object.keys(required), optional: Object.keys(optional) };
}

/** Packages reachable from `starts`, following optional edges only when asked. */
function reach(packages, starts, followOptional) {
	const seen = new Set();
	const queue = [];
	const visit = (fromNames, name, isOptional, owner) => {
		const key = resolveFrom(packages, fromNames, name);
		if (key === undefined) {
			if (!isOptional) fail(`${owner} requires ${name}, which bun.lock does not contain`);
			return;
		}
		if (!seen.has(key)) {
			seen.add(key);
			queue.push(key);
		}
	};
	for (const name of starts.required) visit([], name, false, "the root package");
	if (followOptional) for (const name of starts.optional) visit([], name, true, "the root package");
	while (queue.length > 0) {
		const pkg = packages.get(queue.shift());
		const { required, optional } = edgesOf(pkg);
		for (const name of required) visit(pkg.names, name, false, pkg.key);
		if (followOptional) for (const name of optional) visit(pkg.names, name, true, pkg.key);
	}
	return seen;
}

function rootEntry(manifest) {
	const entry = { name: manifest.name, version: manifest.version };
	for (const field of ["license", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "bin", "engines"]) {
		if (manifest[field] !== undefined) entry[field] = manifest[field];
	}
	return entry;
}

function packageEntry(pkg, scope) {
	const meta = pkg.meta;
	const entry = { version: pkg.version, resolved: tarballUrl(pkg.name, pkg.version), integrity: pkg.integrity };
	Object.assign(entry, scope);
	const dependencies = nonEmpty(meta.dependencies);
	if (dependencies) entry.dependencies = dependencies;
	const optionalDependencies = nonEmpty(meta.optionalDependencies);
	if (optionalDependencies) entry.optionalDependencies = optionalDependencies;
	if (meta.bin !== undefined) {
		const shortName = pkg.name.includes("/") ? pkg.name.slice(pkg.name.indexOf("/") + 1) : pkg.name;
		entry.bin = typeof meta.bin === "string" ? { [shortName]: meta.bin } : { ...meta.bin };
	}
	const os = asArray(meta.os);
	if (os) entry.os = os;
	const cpu = asArray(meta.cpu);
	if (cpu) entry.cpu = cpu;
	const peerDependencies = nonEmpty(meta.peerDependencies);
	if (peerDependencies) {
		entry.peerDependencies = peerDependencies;
		const optionalPeers = (meta.optionalPeers ?? []).filter((peer) => peer in peerDependencies).sort();
		if (optionalPeers.length > 0) {
			entry.peerDependenciesMeta = Object.fromEntries(optionalPeers.map((peer) => [peer, { optional: true }]));
		}
	}
	return entry;
}

/** Builds the mirror text from the bun.lock and package.json texts. */
export function buildMirror(bunLockText, manifestText) {
	const lock = parseBunLock(bunLockText);
	const manifest = JSON.parse(manifestText);
	const workspaces = Object.keys(lock.workspaces ?? {});
	if (workspaces.length !== 1 || workspaces[0] !== "") fail("only a single root workspace is supported");
	const packages = readPackages(lock);

	const prodRoots = { required: Object.keys(manifest.dependencies ?? {}), optional: Object.keys(manifest.optionalDependencies ?? {}) };
	const allRoots = { required: [...prodRoots.required, ...Object.keys(manifest.devDependencies ?? {})], optional: prodRoots.optional };
	const prodAll = reach(packages, prodRoots, true);
	const prodRequired = reach(packages, prodRoots, false);
	const allAll = reach(packages, allRoots, true);
	const allRequired = reach(packages, allRoots, false);

	const entries = { "": rootEntry(manifest) };
	for (const key of [...packages.keys()].sort()) {
		if (!allAll.has(key)) fail(`${key} is not reachable from package.json`);
		let scope = {};
		if (!prodAll.has(key)) scope = allRequired.has(key) ? { dev: true } : { dev: true, optional: true };
		else if (!prodRequired.has(key)) scope = allRequired.has(key) ? { devOptional: true } : { optional: true };
		entries[`node_modules/${packages.get(key).names.join("/node_modules/")}`] = packageEntry(packages.get(key), scope);
	}
	const ordered = { "": entries[""] };
	for (const path of Object.keys(entries).filter((p) => p !== "").sort()) ordered[path] = entries[path];
	const mirror = { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: ordered };
	return `${JSON.stringify(mirror, null, 2)}\n`;
}

function main(argv) {
	let root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	let check = false;
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === "--check") check = true;
		else if (argv[i] === "--root") root = resolve(argv[++i] ?? "");
		else throw new MirrorError(`sync-alert-mirror: unknown argument ${argv[i]}`);
	}
	const bunLockPath = join(root, "bun.lock");
	if (!existsSync(bunLockPath)) fail(`${bunLockPath} does not exist`);
	const mirrorPath = join(root, "package-lock.json");
	const next = buildMirror(readFileSync(bunLockPath, "utf8"), readFileSync(join(root, "package.json"), "utf8"));
	const packageCount = Object.keys(JSON.parse(next).packages).length - 1;

	if (check) {
		const current = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : undefined;
		if (current !== next) {
			process.stderr.write(`sync-alert-mirror: package-lock.json does not mirror bun.lock; ${FIX}.\n`);
			return 1;
		}
		process.stdout.write(`sync-alert-mirror: package-lock.json mirrors bun.lock (${packageCount} packages)\n`);
		return 0;
	}
	const temp = `${mirrorPath}.tmp-${process.pid}`;
	writeFileSync(temp, next);
	renameSync(temp, mirrorPath);
	process.stdout.write(`sync-alert-mirror: wrote package-lock.json (${packageCount} packages)\n`);
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		if (!(error instanceof MirrorError) && !(error instanceof SyntaxError)) throw error;
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 2;
	}
}
