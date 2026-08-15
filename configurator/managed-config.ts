/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `configurator/managed-config.ts` — Drenyra AI managed agent-host composition
 * library (SDD-020 first slice).
 *
 * Owns the deterministic package-level composition rules BELOW `cmd/`:
 * strict manifest parsing (absent | invalid | legacy | current-schema),
 * legacy hydration, exact managed-asset rendering and SHA-256 hashing, safe
 * host-path derivation, the upgrade/rollback transition engines, the atomic
 * fail-closed commit, and the read-only doctor configuration diagnostics.
 *
 * Layer contract: this module imports only node:* built-ins and other library
 * modules (`skills/`); it NEVER imports from `cmd/` or `agents/` (no reverse
 * imports). Cryptography is limited to `node:crypto` (SHA-256 + temp identity).
 *
 * Never-install-host invariant: no host binary is ever invoked, installed,
 * upgraded, removed, or replaced. Foreign (non-Drenyra) files are never
 * created, modified, moved, or deleted. No authorization or fiscal decision
 * is made or reported. No monetary value is read, written, or computed.
 */

import { createHash, randomUUID } from "node:crypto";
import {
	closeSync,
	existsSync,
	fsyncSync,
	openSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { BASE_PE_SKILLS } from "../skills/index.js";

    /** Fixed managed-state location: `<home>/.drenyra/managed.json`. */
    export const MANAGED_DIR = ".drenyra";
    export const MANAGED_FILE = "managed.json";
    export const COMPOSITION_SCHEMA_VERSION = 2;
    
    /** The three known agent hosts and their home-relative config directories. */
    const HOST_DIR_MAP: Readonly<Record<HostName, string>> = {
    	codex: ".codex",
    	"claude-code": ".claude",
    	opencode: ".config/opencode",
    };
    
    /** Managed asset filenames inside a recorded-present host config directory. */
    export const ASSET_FILENAMES = {
    	marker: ".drenyra-managed",
    	skills: ".drenyra-skills.json",
    	pin: ".drenyra-pinned-ai-runtime.json",
    } as const;
    
    export type HostName = "codex" | "claude-code" | "opencode";
    export type ManagedAssetName = keyof typeof ASSET_FILENAMES;
    export type AssetAction = "updated" | "created" | "preserved" | "missing";
    
    /**
     * A pin version is a non-negative JSON integer or a semantic-version string.
     * Authoring aid only; manifest parsing remains the runtime authority.
     */
    export type PinVersion = number | `${number}.${number}.${number}${string}`;
    
    /** One pinned component: an identifier plus an integer/semver version. */
    export interface ComponentPin {
    	id: string;
    	version: PinVersion;
    }
    
    /** The per-host pinned AI runtime record (R1). */
    export interface PinnedAiRuntimeRecord {
    	kind: "pinned-ai-runtime";
    	/** JSON integer, never a float. */
    	schemaVersion: 1;
    	host: HostName;
    	runtime: ComponentPin;
    	model: ComponentPin;
    	tool: ComponentPin;
    }
    
    export type PinnedAiCompositionValues = Omit<
    	PinnedAiRuntimeRecord,
    	"kind" | "schemaVersion" | "host"
    >;
    
    /** A managed pin entry: the semantic record plus its exact rendered bytes. */
    export interface ManagedHostPin {
    	record: PinnedAiRuntimeRecord;
    	managedAsset: ManagedAssetBytes;
    }
    
    /**
     * Per-host managed pin ownership. A missing entry means Drenyra has no
     * managed pin ownership for that host (pre-pin snapshot or foreign file).
     */
    export type PinnedComposition = Partial<
    	Readonly<Record<HostName, ManagedHostPin>>
    >;

/** A detected agent host (library-owned; `install` delegates to this). */
export interface DetectedHost {
	name: HostName;
	configDir: string;
	present: boolean;
}

/** Exact expected UTF-8 bytes plus lowercase-hex SHA-256 of a managed asset. */
export interface ManagedAssetBytes {
	sha256: string;
	content: string;
}

/** One package-level composition snapshot. */
export interface ManagedCompositionSnapshot {
	packageVersion: string;
	/** Non-negative JSON integer; never a float. */
	sequence: number;
	activatedAt: string;
	managedAssets: {
		marker: ManagedAssetBytes;
		skills: ManagedAssetBytes;
	};
	/** Undefined means this snapshot predates per-host pin ownership. */
	pinnedComposition?: PinnedComposition;
}

/** Versioned composition record persisted in the managed manifest. */
export interface ManagedComposition {
	schemaVersion: number;
	current: ManagedCompositionSnapshot;
	previous: ManagedCompositionSnapshot | null;
}

/** The managed install manifest (legacy fields + additive composition). */
export interface InstallManifest {
	manager: "drenyra-ai";
	/** Compatibility mirror of `composition.current.packageVersion` when present. */
	version: string;
	installedAt: string;
	hosts: DetectedHost[];
	assets: readonly string[];
	composition?: ManagedComposition;
}

/** Classified state of the managed manifest on disk. */
export type ManifestState = "absent" | "invalid" | "legacy" | "current-schema";

export interface ManagedStateRead {
	state: ManifestState;
	manifest?: InstallManifest;
	invalidReason?: string;
}

/** Stable business-error codes for managed-config failures (exit 1). */
export type ManagedConfigErrorCode =
	| "MANAGED_STATE_UNKNOWN"
	| "ROLLBACK_UNAVAILABLE"
	| "COMPOSITION_NOT_PACKAGED";

export class ManagedConfigError extends Error {
	readonly code: ManagedConfigErrorCode;

	constructor(code: ManagedConfigErrorCode, message: string) {
		super(message);
		this.name = "ManagedConfigError";
		this.code = code;
	}
}

    export interface HydratedSnapshot {
    	snapshot: ManagedCompositionSnapshot;
    	/** False only for a legacy manifest with no readable prior skills asset. */
    	skillsAvailable: boolean;
    	/**
    	 * True only when every recorded-present host has a valid managed pin
    	 * entry. A partial or pre-pin map is never a transition source.
    	 */
    	pinsAvailable: boolean;
    }

export interface AssetResult {
	host: HostName;
	asset: ManagedAssetName;
	action: AssetAction;
}

export interface AssetWrite {
	path: string;
	data: string;
}

/** A planned (uncommitted) transition: report fields + staged candidate. */
export interface TransitionPlan {
	status: "upgraded" | "rolled-back" | "unchanged";
	from: string;
	to: string;
	results: AssetResult[];
	writes: AssetWrite[];
	candidate: InstallManifest;
}

/** Test seam for mid-commit failure injection (atomicity proof). */
export interface TransitionHooks {
	/** Invoked after each asset replacement; a throw simulates an IO failure. */
	afterAssetReplacement?: (replacedCount: number) => void;
}

export type TransitionNow = () => string;

export interface BasicConfigDiagnostic {
	name: "managed-state" | "managed-drift" | "package-pin" | "host-prerequisites";
	ok: boolean;
	detail: string;
}
    
/** Per-host pin classification (R3; D6). */
export type HostPinState = "managed" | "drift" | "foreign" | "absent";
    
export interface HostPinDiagnostic {
	host: HostName;
	state: HostPinState;
	detail: string;
}
    
export interface PinnedAiRuntimeDiagnostic {
	name: "pinned-ai-runtime";
	ok: boolean;
	detail: string;
	applicability: "applicable" | "not-applicable" | "unverifiable";
	hosts: readonly HostPinDiagnostic[];
}
    
export type ConfigDiagnostic = BasicConfigDiagnostic | PinnedAiRuntimeDiagnostic;

    const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
    
    function isSemver(value: string): boolean {
    	return SEMVER_RE.test(value);
    }
    
    /**
     * Runtime pin-version authority: a non-negative JSON integer or a semver
     * string (empty and non-semver identifiers are invalid; non-finite numbers
     * and floats are rejected). TypeScript narrows authoring; parsing is the
     * authority.
     */
    export function isPinVersion(value: unknown): value is PinVersion {
    	if (typeof value === "number") {
    		return Number.isInteger(value) && value >= 0;
    	}
    	return typeof value === "string" && SEMVER_RE.test(value);
    }
    
    /**
     * Package-owned deterministic pinned composition for every recognized host
     * (R1, R2; D2). These are release data in the library constant — never
     * derived from program-lock, network, host introspection, user input, or
     * branch state. The exhaustive `Record<HostName, ...>` forces Slice B to
     * add a reviewed `drenyra-pi` entry before it can compile.
     */
    export const PINNED_AI_COMPOSITION = deepFreeze({
    	codex: {
    		runtime: { id: "codex", version: 1 },
    		model: { id: "codex-package-default", version: 1 },
    		tool: { id: "drenyra-ai-host-tools", version: 1 },
    	},
    	"claude-code": {
    		runtime: { id: "claude-code", version: 1 },
    		model: { id: "claude-code-package-default", version: 1 },
    		tool: { id: "drenyra-ai-host-tools", version: 1 },
    	},
    	opencode: {
    		runtime: { id: "opencode", version: 1 },
    		model: { id: "opencode-package-default", version: 1 },
    		tool: { id: "drenyra-ai-host-tools", version: 1 },
    	},
    } as const satisfies Readonly<Record<HostName, PinnedAiCompositionValues>>);
    
    /** Recursively freeze release data so no caller can mutate package constants. */
    function deepFreeze<T>(value: T): T {
    	if (typeof value === "object" && value !== null) {
    		for (const key of Object.keys(value)) {
    			deepFreeze((value as Record<string, unknown>)[key]);
    		}
    		Object.freeze(value);
    	}
    	return value;
    }
    
    /** The full semantic pin record for one host (canonical property order). */
    export function pinnedAiRuntimeRecord(host: HostName): PinnedAiRuntimeRecord {
    	// Copy every ComponentPin: records must never share object references with
    	// the frozen package constant (mutation through one record would corrupt
    	// every later render and the shared constant).
    	return {
    		kind: "pinned-ai-runtime",
    		schemaVersion: 1,
    		host,
    		runtime: { ...PINNED_AI_COMPOSITION[host].runtime },
    		model: { ...PINNED_AI_COMPOSITION[host].model },
    		tool: { ...PINNED_AI_COMPOSITION[host].tool },
    	};
    }
    
    /**
     * Deterministic pin bytes: the complete record, pretty-printed, no trailing
     * newline (matches the marker/skills byte convention). One byte source for
     * install, sync, transitions, tests, and doctor.
     */
    export function renderPinnedAiRuntime(host: HostName): string {
    	return JSON.stringify(pinnedAiRuntimeRecord(host), null, 2);
    }
    
    /** The managed pin entry (record + exact rendered bytes/hash) for a host. */
    export function managedHostPin(host: HostName): ManagedHostPin {
    	return {
    		record: pinnedAiRuntimeRecord(host),
    		managedAsset: hashManagedAsset(renderPinnedAiRuntime(host)),
    	};
    }
    
    function isComponentPin(raw: unknown): raw is ComponentPin {
    	if (typeof raw !== "object" || raw === null) return false;
    	const c = raw as Record<string, unknown>;
    	return typeof c.id === "string" && isPinVersion(c.version);
    }
    
    /**
     * Strict schema-2 pin validation: map key equals record.host, the record
     * renders exactly to the stored content, the SHA-256 recomputes, and every
     * version passes `isPinVersion` (no floats, negatives, or non-semver).
     */
    function isPinnedComposition(raw: unknown): raw is PinnedComposition {
    	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    		return false;
    	}
    	const map = raw as Record<string, unknown>;
    	for (const key of Object.keys(map)) {
    		if (!isHostName(key)) return false;
    		const entry = map[key];
    		if (typeof entry !== "object" || entry === null) return false;
    		const e = entry as Record<string, unknown>;
    		if (typeof e.record !== "object" || e.record === null) return false;
    		const record = e.record as Record<string, unknown>;
    		if (record.kind !== "pinned-ai-runtime") return false;
    		if (record.schemaVersion !== 1) return false;
    		if (record.host !== key) return false; // map key must equal record.host
    		if (
    			!isComponentPin(record.runtime) ||
    			!isComponentPin(record.model) ||
    			!isComponentPin(record.tool)
    		) {
    			return false;
    		}
    		if (!isAssetBytes(e.managedAsset)) return false;
    		// The record must render exactly to the stored managed content.
    		if (e.managedAsset.content !== renderPinnedAiRuntime(key)) return false;
    	}
    	return true;
    }
    
    function invalid(reason: string): ManagedStateRead {
    	return { state: "invalid", invalidReason: reason };
    }

function isHostName(value: unknown): value is HostName {
	return value === "codex" || value === "claude-code" || value === "opencode";
}

/** Re-derive a host config dir from the injected home + the fixed mapping. */
export function reDeriveHostConfigDir(homeDir: string, name: HostName): string {
	return join(homeDir, HOST_DIR_MAP[name]);
}

/** Detect which hosts are present on the machine (read-only). */
export function detectHosts(homeDir: string): DetectedHost[] {
	return (Object.keys(HOST_DIR_MAP) as HostName[]).map((name) => {
		const configDir = reDeriveHostConfigDir(homeDir, name);
		return { name, configDir, present: existsSync(configDir) };
	});
}

/** Resolve the home directory: `--home` override wins, else `$HOME`/cwd. */
export function homeFromArgs(args: string[]): string {
	const index = args.indexOf("--home");
	const value = index >= 0 ? args[index + 1] : undefined;
	if (index >= 0 && value !== undefined) {
		return value;
	}
	return process.env.HOME ?? process.cwd();
}

/** Deterministic Drenyra-managed marker bytes for an activation time. */
export function renderManagedMarker(installedAt: string): string {
	return JSON.stringify({ manager: "drenyra-ai", installedAt }, null, 2);
}

/** Deterministic managed skills-asset bytes (same render as `install`). */
export function renderManagedSkills(): string {
	return JSON.stringify(
		BASE_PE_SKILLS.map(({ id, version, jurisdiction, maxAutonomy }) => ({
			id,
			version,
			jurisdiction,
			maxAutonomy,
		})),
		null,
		2,
	);
}

/** SHA-256 hash of exact UTF-8 content; `sha256` is 64 lowercase hex chars. */
export function hashManagedAsset(content: string): ManagedAssetBytes {
	return {
		sha256: createHash("sha256").update(content, "utf8").digest("hex"),
		content,
	};
}

/** The managed manifest path for an injected home. */
export function managedManifestPath(homeDir: string): string {
	return join(homeDir, MANAGED_DIR, MANAGED_FILE);
}

function isAssetBytes(raw: unknown): raw is ManagedAssetBytes {
	if (typeof raw !== "object" || raw === null) return false;
	const a = raw as Record<string, unknown>;
	if (typeof a.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(a.sha256)) {
		return false;
	}
	if (typeof a.content !== "string") return false;
	return (
		createHash("sha256").update(a.content, "utf8").digest("hex") === a.sha256
	);
}

function isSnapshot(raw: unknown): raw is ManagedCompositionSnapshot {
	if (typeof raw !== "object" || raw === null) return false;
	const s = raw as Record<string, unknown>;
	if (typeof s.packageVersion !== "string" || !isSemver(s.packageVersion)) {
		return false;
	}
	if (
		typeof s.sequence !== "number" ||
		!Number.isInteger(s.sequence) ||
		s.sequence < 0
	) {
		return false;
	}
	if (typeof s.activatedAt !== "string") return false;
	if (typeof s.managedAssets !== "object" || s.managedAssets === null) {
		return false;
	}
	const assets = s.managedAssets as Record<string, unknown>;
	if (!isAssetBytes(assets.marker) || !isAssetBytes(assets.skills)) {
		return false;
	}
	// Schema-2 snapshots validate every present pin entry strictly; a missing
	// pinnedComposition is a readable schema-1 (pre-pin) snapshot.
	if (s.pinnedComposition !== undefined && !isPinnedComposition(s.pinnedComposition)) {
		return false;
	}
	return true;
}

function validateComposition(
	raw: unknown,
): { ok: true; value: ManagedComposition } | { ok: false; reason: string } {
	if (typeof raw !== "object" || raw === null) {
		return { ok: false, reason: "composition must be an object" };
	}
	const c = raw as Record<string, unknown>;
	if (
		typeof c.schemaVersion !== "number" ||
		!Number.isInteger(c.schemaVersion) ||
		c.schemaVersion < 0
	) {
		return {
			ok: false,
			reason: "composition.schemaVersion must be a non-negative integer",
		};
	}
	if (!isSnapshot(c.current)) {
		return { ok: false, reason: "composition.current must be a valid snapshot" };
	}
	if (c.previous !== null && !isSnapshot(c.previous)) {
		return {
			ok: false,
			reason: "composition.previous must be a valid snapshot or null",
		};
	}
	return {
		ok: true,
		value: {
			schemaVersion: c.schemaVersion,
			current: c.current,
			previous: c.previous as ManagedCompositionSnapshot | null,
		},
	};
}

/**
 * Strict manifest classification. Pure (no mutation): distinguishes absent /
 * invalid / legacy / current-schema, validates required-field types, manager,
 * semantic-version strings, integer schema/sequence fields, recomputes every
 * stored asset hash against its exact content, and fails closed on any host
 * whose recorded configDir is not the re-derived managed host directory.
 */
export function classifyManifest(
	raw: unknown,
	homeDir: string,
): ManagedStateRead {
	if (typeof raw !== "object" || raw === null) {
		return invalid("manifest must be a JSON object");
	}
	const m = raw as Record<string, unknown>;
	if (m.manager !== "drenyra-ai") {
		return invalid('manager must be "drenyra-ai"');
	}
	if (typeof m.version !== "string" || !isSemver(m.version)) {
		return invalid("version must be a semantic-version string");
	}
	if (typeof m.installedAt !== "string") {
		return invalid("installedAt must be a string");
	}
	if (!Array.isArray(m.hosts)) {
		return invalid("hosts must be an array");
	}
	const hosts: DetectedHost[] = [];
	for (const h of m.hosts) {
		if (typeof h !== "object" || h === null) {
			return invalid("host entry must be an object");
		}
		const host = h as Record<string, unknown>;
		if (!isHostName(host.name)) {
			return invalid(`unknown host name ${String(host.name)}`);
		}
		if (typeof host.configDir !== "string") {
			return invalid("host configDir must be a string");
		}
		if (typeof host.present !== "boolean") {
			return invalid("host present must be a boolean");
		}
		const reDerived = reDeriveHostConfigDir(homeDir, host.name);
		if (normalize(host.configDir) !== normalize(reDerived)) {
			return invalid(
				`${host.name} configDir is not the managed host directory (redirected-host-path)`,
			);
		}
		hosts.push({
			name: host.name,
			configDir: host.configDir,
			present: host.present,
		});
	}
	if (!Array.isArray(m.assets) || !m.assets.every((a) => typeof a === "string")) {
		return invalid("assets must be an array of strings");
	}
	const manifest: InstallManifest = {
		manager: "drenyra-ai",
		version: m.version,
		installedAt: m.installedAt,
		hosts,
		assets: m.assets as string[],
	};
	if (m.composition === undefined) {
		return { state: "legacy", manifest };
	}
	const composition = validateComposition(m.composition);
	if (!composition.ok) {
		return invalid(composition.reason);
	}
	manifest.composition = composition.value;
	return { state: "current-schema", manifest };
}

/** Read and strictly classify the managed manifest for an injected home. */
export function readManagedState(homeDir: string): ManagedStateRead {
	const path = managedManifestPath(homeDir);
	if (!existsSync(path)) return { state: "absent" };
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
	} catch {
		return invalid("managed manifest is unreadable or not valid JSON");
	}
	return classifyManifest(raw, homeDir);
}

/** Legacy install/sync compat read: manifest or undefined (absent/invalid). */
export function readInstallManifest(
	homeDir: string,
): InstallManifest | undefined {
	const state = readManagedState(homeDir);
	return state.state === "legacy" || state.state === "current-schema"
		? state.manifest
		: undefined;
}

/** The managed marker bytes the sync/transition engines compare against. */
export function expectedMarkerContent(manifest: InstallManifest): string {
	return manifest.composition !== undefined
		? manifest.composition.current.managedAssets.marker.content
		: renderManagedMarker(manifest.installedAt);
}

function readLegacySkillsContent(
	manifest: InstallManifest,
	homeDir: string,
): string | null {
	for (const host of manifest.hosts) {
		if (!host.present) continue;
		const skillsPath = join(
			reDeriveHostConfigDir(homeDir, host.name),
			ASSET_FILENAMES.skills,
		);
		if (!existsSync(skillsPath)) continue;
		try {
			return readFileSync(skillsPath, "utf8");
		} catch {
			continue; // unreadable: try the next recorded-present host
		}
	}
	return null;
}

/**
 * True only when every recorded-present host has a valid managed pin entry
 * in the snapshot (schema-2 with complete pins; pre-pin maps are never
 * complete). Entries are already strictly validated by `classifyManifest`.
 */
function pinsComplete(
	manifest: InstallManifest,
	snapshot: ManagedCompositionSnapshot,
): boolean {
	const pinned = snapshot.pinnedComposition;
	if (pinned === undefined) return false;
	return manifest.hosts.every(
		(h) => !h.present || pinned[h.name] !== undefined,
	);
}
    
/**
 * Build the per-host managed pin entries for the present hosts from the
 * executing package's constants (never from an old snapshot).
 */
function packagePinnedComposition(
	manifest: InstallManifest,
): PinnedComposition {
	const entries: Partial<Record<HostName, ManagedHostPin>> = {};
	for (const host of manifest.hosts) {
		if (host.present) entries[host.name] = managedHostPin(host.name);
	}
	return entries;
}
    
/**
 * Hydrate a validated current snapshot (no mutation). Current-schema manifests
 * use the recorded current snapshot. Legacy manifests derive it: package
 * version, sequence 0, installedAt as activation time, the deterministic
 * legacy marker bytes, and skills content read only from a present readable
 * managed skills asset. When `requireSkills` is true and no valid prior skills
 * copy exists, a real transition fails closed instead of inventing rollback
 * bytes. Pre-pin snapshots are never assigned pin content from current
 * package constants (no historical pin bytes are fabricated).
 */
export function hydrateCurrentSnapshot(
	manifest: InstallManifest,
	homeDir: string,
	requireSkills: boolean,
): HydratedSnapshot {
	if (manifest.composition !== undefined) {
		return {
			snapshot: manifest.composition.current,
			skillsAvailable: true,
			pinsAvailable: pinsComplete(manifest, manifest.composition.current),
		};
	}
	const marker = hashManagedAsset(renderManagedMarker(manifest.installedAt));
	const skillsContent = readLegacySkillsContent(manifest, homeDir);
	if (skillsContent === null && requireSkills) {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			"legacy managed manifest has no valid prior managed skills copy to preserve",
		);
	}
	const skills =
		skillsContent === null
			? { sha256: "", content: "" }
			: hashManagedAsset(skillsContent);
	return {
		snapshot: {
			packageVersion: manifest.version,
			sequence: 0,
			activatedAt: manifest.installedAt,
			managedAssets: { marker, skills },
		},
		skillsAvailable: skillsContent !== null,
		pinsAvailable: false,
	};
}

function planAssetTransitions(
	manifest: InstallManifest,
	homeDir: string,
	current: ManagedCompositionSnapshot,
	target: ManagedCompositionSnapshot,
): { writes: AssetWrite[]; results: AssetResult[] } {
	const writes: AssetWrite[] = [];
	const results: AssetResult[] = [];
	for (const host of manifest.hosts) {
		if (!host.present) continue;
		const configDir = reDeriveHostConfigDir(homeDir, host.name);
		// The recorded path was validated at read time; re-verify before any
		// write (defense in depth: a redirected recorded path fails closed).
		if (normalize(host.configDir) !== normalize(configDir)) {
			throw new ManagedConfigError(
				"MANAGED_STATE_UNKNOWN",
				`${host.name} configDir does not match the managed host directory`,
			);
		}
		if (!existsSync(configDir)) {
			results.push({ host: host.name, asset: "marker", action: "missing" });
			results.push({ host: host.name, asset: "skills", action: "missing" });
			results.push({ host: host.name, asset: "pin", action: "missing" });
			continue;
		}
		for (const asset of ["marker", "skills"] as const) {
			const path = join(configDir, ASSET_FILENAMES[asset]);
			const expected = current.managedAssets[asset].content;
			const targetBytes = target.managedAssets[asset].content;
			if (!existsSync(path)) {
				writes.push({ path, data: targetBytes });
				results.push({ host: host.name, asset, action: "created" });
				continue;
			}
			let disk: string;
			try {
				disk = readFileSync(path, "utf8");
			} catch {
				// Unreadable managed asset: preserve, never overwrite what we
				// cannot verify.
				results.push({ host: host.name, asset, action: "preserved" });
				continue;
			}
			if (disk === expected) {
				writes.push({ path, data: targetBytes });
				results.push({ host: host.name, asset, action: "updated" });
			} else {
				results.push({ host: host.name, asset, action: "preserved" });
			}
		}
		// Per-host pin asset: compare disk ONLY against the recorded current
		// bytes; a mismatch or read failure preserves the bytes. Transitions
		// require complete prior pins, so a missing current entry is skipped
		// defensively rather than invented.
		const currentPin = current.pinnedComposition?.[host.name];
		const targetPin = target.pinnedComposition?.[host.name];
		if (currentPin === undefined || targetPin === undefined) continue;
		const pinPath = join(configDir, ASSET_FILENAMES.pin);
		if (!existsSync(pinPath)) {
			writes.push({ path: pinPath, data: targetPin.managedAsset.content });
			results.push({ host: host.name, asset: "pin", action: "created" });
			continue;
		}
		let diskPin: string;
		try {
			diskPin = readFileSync(pinPath, "utf8");
		} catch {
			results.push({ host: host.name, asset: "pin", action: "preserved" });
			continue;
		}
		if (diskPin === currentPin.managedAsset.content) {
			writes.push({ path: pinPath, data: targetPin.managedAsset.content });
			results.push({ host: host.name, asset: "pin", action: "updated" });
		} else {
			results.push({ host: host.name, asset: "pin", action: "preserved" });
		}
	}
	return { writes, results };
}
    
function samePinnedComposition(
	a: ManagedCompositionSnapshot,
	b: ManagedCompositionSnapshot,
): boolean {
	const pa = a.pinnedComposition;
	const pb = b.pinnedComposition;
	if (pa === undefined || pb === undefined) return pa === pb;
	const hosts = new Set([...Object.keys(pa), ...Object.keys(pb)]);
	for (const host of hosts) {
		if (!isHostName(host)) return false;
		const ea = pa[host];
		const eb = pb[host];
		if ((ea === undefined) !== (eb === undefined)) return false;
		if (
			ea !== undefined &&
			eb !== undefined &&
			ea.managedAsset.content !== eb.managedAsset.content
		) {
			return false;
		}
	}
	return true;
}
    
function sameManagedAssets(
	a: ManagedCompositionSnapshot,
	b: ManagedCompositionSnapshot,
): boolean {
	return (
		a.managedAssets.marker.content === b.managedAssets.marker.content &&
		a.managedAssets.skills.content === b.managedAssets.skills.content &&
		samePinnedComposition(a, b)
	);
}

/**
 * Plan an upgrade transition (pure; zero writes). The requested semantic
 * version must equal the injected packaged version or the plan fails
 * `COMPOSITION_NOT_PACKAGED`. Idempotency (requested === hydrated current
 * version) is detected BEFORE any timestamp/temp-file generation and returns
 * `unchanged` with zero writes.
 */
export function planUpgrade(
	homeDir: string,
	requestedVersion: string,
	packagedVersion: string,
	now: TransitionNow = () => new Date().toISOString(),
): TransitionPlan {
	const state = readManagedState(homeDir);
	if (state.state === "absent" || state.state === "invalid") {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			state.state === "absent"
				? "no drenyra-ai managed manifest found"
				: `managed manifest invalid: ${state.invalidReason ?? "unknown"}`,
		);
	}
	const manifest = state.manifest!;
	// Hydration without skills first so a legacy same-version upgrade stays an
	// unchanged no-op even when no prior skills copy exists.
	const hydrated = hydrateCurrentSnapshot(manifest, homeDir, false);
	const current = hydrated.snapshot;
	if (requestedVersion === current.packageVersion) {
		return {
			status: "unchanged",
			from: current.packageVersion,
			to: requestedVersion,
			results: [],
			writes: [],
			candidate: manifest,
		};
	}
	if (requestedVersion !== packagedVersion) {
		throw new ManagedConfigError(
			"COMPOSITION_NOT_PACKAGED",
			`requested version ${requestedVersion} is not the packaged drenyra-ai version ${packagedVersion}`,
		);
	}
	if (!hydrated.skillsAvailable) {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			"legacy managed manifest has no valid prior managed skills copy to preserve",
		);
	}
	if (!hydrated.pinsAvailable) {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			"managed composition has no complete recorded per-host pin state to preserve",
		);
	}
	const activatedAt = now();
	const target: ManagedCompositionSnapshot = {
		packageVersion: requestedVersion,
		sequence: current.sequence + 1,
		activatedAt,
		managedAssets: {
			marker: hashManagedAsset(renderManagedMarker(activatedAt)),
			skills: hashManagedAsset(renderManagedSkills()),
		},
		pinnedComposition: packagePinnedComposition(manifest),
	};
	const { writes, results } = planAssetTransitions(
		manifest,
		homeDir,
		current,
		target,
	);
	const candidate: InstallManifest = {
		...manifest,
		version: requestedVersion,
		composition: {
			schemaVersion: COMPOSITION_SCHEMA_VERSION,
			current: target,
			previous: current,
		},
	};
	return {
		status: "upgraded",
		from: current.packageVersion,
		to: requestedVersion,
		results,
		writes,
		candidate,
	};
}

/**
 * Plan a rollback transition (pure; zero writes). Requires a validated
 * previous snapshot: it is restored as `current`, the top-level version
 * mirrors it, and `previous` stays unchanged so a repeated rollback is an
 * exact zero-write idempotent no-op. `previous: null` fails closed with
 * `ROLLBACK_UNAVAILABLE`; a missing/malformed manifest fails `MANAGED_STATE_UNKNOWN`.
 */
export function planRollback(homeDir: string): TransitionPlan {
	const state = readManagedState(homeDir);
	if (state.state === "absent" || state.state === "invalid") {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			state.state === "absent"
				? "no drenyra-ai managed manifest found"
				: `managed manifest invalid: ${state.invalidReason ?? "unknown"}`,
		);
	}
	const manifest = state.manifest!;
	const composition = manifest.composition;
	if (composition === undefined || composition.previous === null) {
		throw new ManagedConfigError(
			"ROLLBACK_UNAVAILABLE",
			"no previous managed composition recorded",
		);
	}
    	const current = composition.current;
    	const previous = composition.previous;
    	if (!pinsComplete(manifest, current) || !pinsComplete(manifest, previous)) {
    		throw new ManagedConfigError(
    			"MANAGED_STATE_UNKNOWN",
    			"rollback requires complete recorded per-host pin state in both current and previous compositions",
    		);
    	}
    	if (
    		current.packageVersion === previous.packageVersion &&
    		sameManagedAssets(current, previous)
    	) {
		return {
			status: "unchanged",
			from: current.packageVersion,
			to: previous.packageVersion,
			results: [],
			writes: [],
			candidate: manifest,
		};
	}
	const { writes, results } = planAssetTransitions(
		manifest,
		homeDir,
		current,
		previous,
	);
	const candidate: InstallManifest = {
		...manifest,
		version: previous.packageVersion,
		composition: {
			schemaVersion: COMPOSITION_SCHEMA_VERSION,
			current: previous,
			previous,
		},
	};
	return {
		status: "rolled-back",
		from: current.packageVersion,
		to: previous.packageVersion,
		results,
		writes,
		candidate,
	};
}

interface StagedWrite {
	targetPath: string;
	tmpPath: string;
	original: string | undefined;
	existed: boolean;
	replaced: boolean;
}

function stageWrite(targetPath: string, data: string): StagedWrite {
	const tmpPath = join(
		dirname(targetPath),
		`${basename(targetPath)}.tmp.${process.pid}.${randomUUID()}`,
	);
	let fd: number | undefined;
	try {
		fd = openSync(tmpPath, "w", 0o644);
		writeFileSync(fd, data, "utf8");
		fsyncSync(fd);
		closeSync(fd);
		fd = undefined;
	} catch (error) {
		if (fd !== undefined) {
			try {
				closeSync(fd);
			} catch {
				// already closed or unusable
			}
		}
		try {
			unlinkSync(tmpPath);
		} catch {
			// temp file may never have been created
		}
		throw error;
	}
	const existed = existsSync(targetPath);
	const original = existed ? readFileSync(targetPath, "utf8") : undefined;
	return { targetPath, tmpPath, original, existed, replaced: false };
}

function restoreAfterFailure(
	staged: StagedWrite[],
	manifestStaged: StagedWrite | undefined,
): void {
	for (const s of staged) {
		if (s.replaced) {
			try {
				if (s.existed && s.original !== undefined) {
					writeFileSync(s.targetPath, s.original, "utf8");
				} else if (!s.existed) {
					unlinkSync(s.targetPath);
				}
			} catch {
				// best-effort restore; the original error still propagates
			}
		} else {
			try {
				unlinkSync(s.tmpPath);
			} catch {
				// best-effort temp cleanup
			}
		}
	}
	if (manifestStaged !== undefined) {
		if (manifestStaged.replaced) {
			try {
				if (manifestStaged.existed && manifestStaged.original !== undefined) {
					writeFileSync(manifestStaged.targetPath, manifestStaged.original, "utf8");
				}
			} catch {
				// best-effort restore
			}
		} else {
			try {
				unlinkSync(manifestStaged.tmpPath);
			} catch {
				// best-effort temp cleanup
			}
		}
	}
}

/**
 * Atomic fail-closed commit: validates the complete candidate manifest and all
 * candidate asset bytes FIRST, stages same-directory temp files, keeps the
 * original bytes/existence in memory, then commits only the allowlisted
 * managed paths — assets first, the manifest LAST via temp-file + fsync +
 * rename. On any synchronous failure after a replacement, already-replaced
 * assets are restored and the prior manifest is left/restored so no mixed
 * managed state survives; the candidate manifest is never published alone.
 */
export function commitTransition(
	homeDir: string,
	plan: TransitionPlan,
	hooks: TransitionHooks = {},
): void {
	// Unchanged plans never reach the commit (adapters short-circuit); this is a
	// defensive guard. A REAL transition always commits the candidate manifest,
	// even when every asset was preserved (writes may be empty).
	if (plan.status === "unchanged") return;
	const manifestPath = managedManifestPath(homeDir);
	const candidateJson = JSON.stringify(plan.candidate, null, 2);
	// Validate the complete candidate manifest and all candidate asset bytes
	// FIRST (hashes, integer fields, path allowlist, manager) before staging.
	const validation = classifyManifest(plan.candidate, homeDir);
	if (validation.state !== "current-schema" || validation.manifest === undefined) {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			`candidate manifest validation failed: ${validation.invalidReason ?? "not current-schema"}`,
		);
	}
	if (
		validation.manifest.version !==
		validation.manifest.composition!.current.packageVersion
	) {
		throw new ManagedConfigError(
			"MANAGED_STATE_UNKNOWN",
			"candidate top-level version must mirror composition.current.packageVersion",
		);
	}
	const staged: StagedWrite[] = [];
	let manifestStaged: StagedWrite | undefined;
	try {
		for (const write of plan.writes) {
			staged.push(stageWrite(write.path, write.data));
		}
		manifestStaged = stageWrite(manifestPath, candidateJson);
		for (let i = 0; i < staged.length; i++) {
			renameSync(staged[i]!.tmpPath, staged[i]!.targetPath);
			staged[i]!.replaced = true;
			hooks.afterAssetReplacement?.(i + 1);
		}
		// Manifest last: the composition authority advances only after its
		// derived assets succeeded.
		renameSync(manifestStaged.tmpPath, manifestStaged.targetPath);
		manifestStaged.replaced = true;
	} catch (error) {
		restoreAfterFailure(staged, manifestStaged);
		throw error;
	}
}

    /**
     * Read-only per-host pin classification (never creates/modifies/deletes any
     * pin asset). Order per recorded-present host: managed entry + missing file
     * → absent; managed entry + unreadable/unequal bytes → drift (preserved);
     * managed entry + exact bytes → managed; no entry + pin file exists →
     * foreign. A pre-pin snapshot stays not-applicable and healthy; an invalid
     * manifest is handled by the caller as unverifiable.
     */
    function classifyPinnedRuntime(
    	manifest: InstallManifest,
    	homeDir: string,
    ): PinnedAiRuntimeDiagnostic {
    	const pinned = manifest.composition?.current.pinnedComposition;
    	if (pinned === undefined) {
    		// Pre-pin snapshot (schema 1): no pin ownership exists; never invent bytes.
    		return {
    			name: "pinned-ai-runtime",
    			ok: true,
    			detail: "not applicable (pre-pin managed composition)",
    			applicability: "not-applicable",
    			hosts: [],
    		};
    	}
    	const hosts: HostPinDiagnostic[] = [];
    	for (const host of manifest.hosts) {
    		if (!host.present) continue;
    		const entry = pinned[host.name];
    		const pinPath = join(
    			reDeriveHostConfigDir(homeDir, host.name),
    			ASSET_FILENAMES.pin,
    		);
    		if (entry === undefined) {
    			if (existsSync(pinPath)) {
    				hosts.push({
    					host: host.name,
    					state: "foreign",
    					detail: "user-authored; unmanaged; preserved; not adopted",
    				});
    			}
    			continue;
    		}
    		if (!existsSync(pinPath)) {
    			hosts.push({
    				host: host.name,
    				state: "absent",
    				detail: "managed pin asset missing from host config directory",
    			});
    			continue;
    		}
    		let disk: string;
    		try {
    			disk = readFileSync(pinPath, "utf8");
    		} catch {
    			hosts.push({
    				host: host.name,
    				state: "drift",
    				detail: "managed pin asset unreadable; bytes preserved, not overwritten",
    			});
    			continue;
    		}
    		if (disk === entry.managedAsset.content) {
    			hosts.push({
    				host: host.name,
    				state: "managed",
    				detail: "pin asset matches recorded managed bytes",
    			});
    		} else {
    			hosts.push({
    				host: host.name,
    				state: "drift",
    				detail: "pin asset differs from recorded managed bytes; preserved",
    			});
    		}
    	}
    	const healthy = hosts.every((h) => h.state === "managed");
    	return {
    		name: "pinned-ai-runtime",
    		ok: healthy,
    		detail:
    			hosts.length === 0
    				? "applicable (no recorded-present host has a pin state to evaluate)"
    				: healthy
    					? "all recorded-present hosts match their managed pin records"
    					: `pin state failing for: ${hosts
    							.filter((h) => h.state !== "managed")
    							.map((h) => h.host)
    							.join(", ")}`,
    		applicability: "applicable",
    		hosts,
    	};
    }
    
    /**
     * Read-only doctor configuration diagnostics (R3, D6): uses only stat/read/hash
     * and never transitions, syncs, installs, creates, or writes anything.
     * When no managed manifest exists every check passes as not-applicable so the
     * clean-checkout invariant (every check ok) holds. The pinned-ai-runtime
     * check is appended after the four basic checks.
     */
    export function runConfigDiagnostics(
    	homeDir: string,
    	packagedVersion: string,
    ): ConfigDiagnostic[] {
    	const state = readManagedState(homeDir);
    	if (state.state === "absent") {
    		return [
    			{ name: "managed-state", ok: true, detail: "not applicable (no managed manifest)" },
    			{ name: "managed-drift", ok: true, detail: "not applicable (no managed manifest)" },
    			{ name: "package-pin", ok: true, detail: "not applicable (no managed manifest)" },
    			{ name: "host-prerequisites", ok: true, detail: "not applicable (no managed manifest)" },
    			{
    				name: "pinned-ai-runtime",
    				ok: true,
    				detail: "not applicable (no managed manifest)",
    				applicability: "not-applicable",
    				hosts: [],
    			},
    		];
    	}
    	if (state.state === "invalid") {
    		const reason = state.invalidReason ?? "unknown";
    		return [
    			{ name: "managed-state", ok: false, detail: `managed manifest invalid: ${reason}` },
    			{ name: "managed-drift", ok: false, detail: "cannot evaluate (managed manifest invalid)" },
    			{ name: "package-pin", ok: false, detail: "cannot evaluate (managed manifest invalid)" },
    			{ name: "host-prerequisites", ok: false, detail: "cannot evaluate (managed manifest invalid)" },
    			{
    				name: "pinned-ai-runtime",
    				ok: false,
    				detail: "cannot evaluate (managed manifest invalid)",
    				applicability: "unverifiable",
    				hosts: [],
    			},
    		];
    	}
	const manifest = state.manifest!;
	const hydrated = hydrateCurrentSnapshot(manifest, homeDir, false);
	const expected = hydrated.snapshot;

	const managedState: ConfigDiagnostic = {
		name: "managed-state",
		ok: true,
		detail:
			state.state === "legacy"
				? "managed manifest valid (legacy schema)"
				: "managed manifest valid",
	};

	const drift: string[] = [];
	for (const host of manifest.hosts) {
		if (!host.present) continue;
		for (const asset of ["marker", "skills"] as const) {
			if (asset === "skills" && !hydrated.skillsAvailable) continue;
			const path = join(
				reDeriveHostConfigDir(homeDir, host.name),
				ASSET_FILENAMES[asset],
			);
			if (!existsSync(path)) continue; // absent → host-prerequisites, not drift
			let disk: string;
			try {
				disk = readFileSync(path, "utf8");
			} catch {
				drift.push(`${host.name}:${asset}`);
				continue;
			}
			if (disk !== expected.managedAssets[asset].content) {
				drift.push(`${host.name}:${asset}`);
			}
		}
	}
	const managedDrift: ConfigDiagnostic = {
		name: "managed-drift",
		ok: drift.length === 0,
		detail:
			drift.length === 0
				? "no managed configuration drift"
				: `drift: ${drift.join(", ")}`,
	};

	const recorded = expected.packageVersion;
	const packagePin: ConfigDiagnostic =
		recorded === packagedVersion
			? {
					name: "package-pin",
					ok: true,
					detail: `package version matches recorded composition (${recorded})`,
				}
			: {
					name: "package-pin",
					ok: false,
					detail: `recorded ${recorded}, packaged ${packagedVersion}`,
				};

	const missing: string[] = [];
	for (const host of manifest.hosts) {
		if (!host.present) continue;
		const configDir = reDeriveHostConfigDir(homeDir, host.name);
		if (!existsSync(configDir)) {
			missing.push(`${host.name}:config-dir`);
			continue;
		}
		for (const asset of ["marker", "skills"] as const) {
			if (!existsSync(join(configDir, ASSET_FILENAMES[asset]))) {
				missing.push(`${host.name}:${asset}`);
			}
		}
	}
	const hostPrerequisites: ConfigDiagnostic = {
		name: "host-prerequisites",
		ok: missing.length === 0,
		detail:
			missing.length === 0
				? "all recorded-present host prerequisites present"
				: `missing: ${missing.join(", ")}`,
	};
    
	const pinnedRuntime = classifyPinnedRuntime(manifest, homeDir);
    
	return [managedState, managedDrift, packagePin, hostPrerequisites, pinnedRuntime];
}
