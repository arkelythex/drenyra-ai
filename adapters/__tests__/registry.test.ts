import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	AdapterRegistry,
	evidenceItem,
	evidenceManifestHash,
	missingTypes,
} from "../index.js";
import { LocalFileAdapter } from "../index.js";

const input = {
	missionId: "mission_1",
	ruc: "20123456789",
	period: "202607",
	requiredTypes: ["voucher", "statement"],
};

describe("evidenceItem", () => {
	it("hash-addresses each item from its own content", () => {
		const a = evidenceItem("A", "voucher", "sunat", "2026-08-01T00:00:00.000Z");
		const b = evidenceItem("A", "voucher", "sunat", "2026-08-01T00:00:00.000Z");
		const c = evidenceItem("C", "voucher", "sunat", "2026-08-01T00:00:00.000Z");
		expect(a.id).toBe(b.id);
		expect(a.id).not.toBe(c.id);
		expect(a.id).toHaveLength(64);
	});

	it("manifest hash is order-independent", () => {
		const x = evidenceItem("X", "voucher", "s", "t");
		const y = evidenceItem("Y", "voucher", "s", "t");
		expect(evidenceManifestHash([x, y])).toBe(evidenceManifestHash([y, x]));
	});
});

describe("missingTypes", () => {
	it("reports required types that are absent (absence is never zero)", () => {
		const items = [evidenceItem("A", "voucher", "s", "t")];
		expect(missingTypes(items, ["voucher", "statement"])).toEqual([
			"statement",
		]);
		expect(missingTypes(items, ["voucher"])).toEqual([]);
	});
});

describe("AdapterRegistry", () => {
	it("registers, resolves, and rejects duplicates per system+jurisdiction", () => {
		const registry = new AdapterRegistry();
		const adapter = new LocalFileAdapter("/tmp/unused");
		registry.register(adapter);
		expect(registry.resolve("local-files", "PE")?.name).toBe("local-file");
		expect(registry.resolve("sunat", "PE")).toBeUndefined();
		expect(() => registry.register(new LocalFileAdapter("/tmp/other"))).toThrow(
			/already registered/i,
		);
	});
});

describe("LocalFileAdapter", () => {
	it("reads, hashes, and reports missing required evidence", async () => {
		const dir = mkdtempSync(join(tmpdir(), "drenyra-adapters-"));
		try {
			writeFileSync(
				join(dir, "voucher-1.json"),
				JSON.stringify({ invoice: "F001-000123" }),
			);
			writeFileSync(
				join(dir, "voucher-2.json"),
				JSON.stringify({ invoice: "F001-000124" }),
			);
			const adapter = new LocalFileAdapter(dir);
			const result = await adapter.fetch(input);
			expect(result.items.length).toBeGreaterThanOrEqual(2);
			expect(result.items.every((item) => item.id.length === 64)).toBe(true);
			// "statement" is required but no statement file exists.
			expect(result.complete).toBe(false);
			expect(result.missingRequired).toContain("statement");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
