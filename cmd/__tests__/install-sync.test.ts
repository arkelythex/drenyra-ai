import { describe, expect, it } from "vitest";
import {
	mkdtempSync,
	rmSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectHosts,
	installIntegrations,
	readInstallManifest,
} from "../commands/install.js";
import { syncManaged } from "../commands/sync.js";

function tempHome(): { dir: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-test-"));
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("install", () => {
	it("detects present hosts and configures only those", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			const detected = detectHosts(dir);
			expect(detected.find((h) => h.name === "claude-code")?.present).toBe(
				true,
			);
			expect(detected.find((h) => h.name === "codex")?.present).toBe(false);

			const manifest = installIntegrations(dir);
			expect(manifest.hosts.filter((h) => h.present)).toHaveLength(1);
			// marker + skills asset written only for the present host
			expect(existsSync(join(dir, ".claude", ".drenyra-managed"))).toBe(true);
			expect(existsSync(join(dir, ".claude", ".drenyra-skills.json"))).toBe(true);
			expect(existsSync(join(dir, ".codex", ".drenyra-managed"))).toBe(false);
			const skillsAsset = JSON.parse(readFileSync(join(dir, ".claude", ".drenyra-skills.json"), "utf8")) as Array<{ id: string; version: string }>;
			expect(skillsAsset.length).toBeGreaterThanOrEqual(6);
			expect(skillsAsset.some((s) => s.id === "pe.igv-validate")).toBe(true);
			// managed manifest persisted with the assets list
			expect(readInstallManifest(dir)?.manager).toBe("drenyra-ai");
			expect(readInstallManifest(dir)?.assets).toContain("skills");
		} finally {
			cleanup();
		}
	});

	it("never overwrites an existing foreign marker", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			writeFileSync(
				join(dir, ".claude", ".drenyra-managed"),
				"foreign content",
			);
			const manifest = installIntegrations(dir);
			expect(
				readFileSync(join(dir, ".claude", ".drenyra-managed"), "utf8"),
			).toBe("foreign content");
			expect(manifest.hosts.filter((h) => h.present)).toHaveLength(1);
		} finally {
			cleanup();
		}
	});
});

describe("sync", () => {
	it("reports not-installed without a manifest", () => {
		const { dir, cleanup } = tempHome();
		try {
			const results = syncManaged(dir);
			expect(results[0]!.action).toBe("not-installed");
		} finally {
			cleanup();
		}
	});

	it("preserves a foreign-modified marker and syncs a clean one", () => {
		const { dir, cleanup } = tempHome();
		try {
			mkdirSync(join(dir, ".claude"), { recursive: true });
			mkdirSync(join(dir, ".config/opencode"), { recursive: true });
			const manifest = installIntegrations(dir);
			// Foreign change on the opencode marker after install.
			writeFileSync(
				join(dir, ".config/opencode", ".drenyra-managed"),
				"someone edited this",
			);
			const results = syncManaged(dir);
			const claude = results.find((r) => r.host === "claude-code");
			const opencode = results.find((r) => r.host === "opencode");
			expect(claude?.action).toBe("synced");
			expect(opencode?.action).toBe("preserved");
			// Foreign content untouched.
			expect(
				readFileSync(join(dir, ".config/opencode", ".drenyra-managed"), "utf8"),
			).toBe("someone edited this");
			expect(manifest.version).toBeTruthy();
		} finally {
			cleanup();
		}
	});
});
