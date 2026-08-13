/** Bun lockfile v1 required-runtime resolver: validates package.json + bun.lock
 * (trailing commas tolerated); follows only required `dependencies` edges. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
function parseLock(text) {
	try {
		return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g, (m) => (m.startsWith('"') ? m : "")));
	} catch (error) {
		throw new Error(`invalid JSON (${error.message})`);
	}
}

/** Require a plain string-to-string map (absent means an empty object). */
function objectMap(value, what) {
	if (value === undefined) return {};
	if (value === null || typeof value !== "object" || Array.isArray(value))
		throw new Error(`${what} must be an object of string values`);
	for (const entry of Object.values(value))
		if (typeof entry !== "string") throw new Error(`${what} must be an object of string values`);
	return value;
}

/** Read and parse one input, naming it in every failure. */
function load(file, parse) {
	try {
		return parse(readFileSync(file, "utf8"));
	} catch (error) {
		throw new Error(`${file.split("/").pop()}: unreadable or invalid JSON (${error.message})`);
	}
}

export function resolveRuntimeGraph(root) {
	const manifest = load(join(root, "package.json"), JSON.parse);
	if (typeof manifest.name !== "string" || manifest.name === "" || typeof manifest.version !== "string")
		throw new Error("package.json: must declare a non-empty string name and string version");
	const lock = load(join(root, "bun.lock"), parseLock);
	if (lock.lockfileVersion !== 1) throw new Error(`bun.lock: unsupported lockfileVersion ${JSON.stringify(lock.lockfileVersion)}`);
	const workspace = lock.workspaces?.[""];
	if (workspace === null || typeof workspace !== "object" || Array.isArray(workspace)) throw new Error("bun.lock: missing root workspace");
	const manifestNames = Object.keys(objectMap(manifest.dependencies, "package.json dependencies")).sort();
	const lockNames = Object.keys(objectMap(workspace.dependencies, "bun.lock root workspace dependencies")).sort();
	if (lockNames.join(",") !== manifestNames.join(",")) throw new Error(`bun.lock: root dependency drift vs package.json (lock ${lockNames.join(",")} vs manifest ${manifestNames.join(",")})`);
	const packages = lock.packages;
	if (packages === null || typeof packages !== "object" || Array.isArray(packages)) throw new Error("bun.lock: packages must be an object");
	const directSet = new Set(manifestNames);
	const seen = new Set();
	const queue = [...manifestNames];
	const nodes = new Map();
	const recordsOf = (name) => {
		const raw = packages[name];
		if (raw === undefined) throw new Error(`bun.lock: no record for reachable package ${name}`);
		const records = Array.isArray(raw[0]) ? raw : [raw];
		if (records.length !== 1) throw new Error(`bun.lock: unsupported ambiguity — ${records.length} records for ${name}`);
		return records[0];
	};
	while (queue.length > 0) {
		const name = queue.shift();
		if (seen.has(name)) continue;
		seen.add(name);
		const record = recordsOf(name);
		if (!Array.isArray(record) || record.length < 2 || record.length > 4 || typeof record[0] !== "string" || typeof record[1] !== "string" || (record[3] !== undefined && typeof record[3] !== "string") || !record[0].startsWith(`${name}@`))
			throw new Error(`bun.lock: malformed record for ${name}`);
		const version = record[0].slice(name.length + 1);
		if (version === "") throw new Error(`bun.lock: empty version for ${name}`);
		const meta = record[2] ?? {};
		if (meta === null || typeof meta !== "object" || Array.isArray(meta)) throw new Error(`bun.lock: malformed metadata for ${name}`);
		const children = Object.keys(objectMap(meta.dependencies, `bun.lock ${name} dependencies`)).sort();
		objectMap(meta.optionalDependencies, `bun.lock ${name} optionalDependencies`);
		objectMap(meta.peerDependencies, `bun.lock ${name} peerDependencies`);
		if (meta.optionalPeers !== undefined && (!Array.isArray(meta.optionalPeers) || meta.optionalPeers.some((peer) => typeof peer !== "string")))
			throw new Error(`bun.lock: ${name} optionalPeers must be an array of strings`);
		nodes.set(name, { name, version, direct: directSet.has(name), dependsOn: children });
		for (const child of children) if (!seen.has(child)) queue.push(child);
	}
	return {
		root: { name: manifest.name, version: manifest.version },
		direct: manifestNames,
		nodes: [...nodes.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
	};
}
