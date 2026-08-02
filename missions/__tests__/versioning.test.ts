/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Versioning tests — ported from @drenyra/mission-protocol
 * (versioning.test.ts).
 */

import { describe, expect, it } from "vitest";
import {
	PROTOCOL_VERSION,
	MINIMUM_CLIENT_VERSION,
	SUPPORTED_FEATURES,
	compareVersions,
	isClientCompatible,
	getCapabilities,
	hasFeature,
} from "../versioning.js";

describe("versioning", () => {
	it("exports a protocol version string", () => {
		expect(PROTOCOL_VERSION).toBe("1.0");
	});

	it("exports a minimum client version", () => {
		expect(MINIMUM_CLIENT_VERSION).toBe("1.0");
	});

	it("has granular capability names", () => {
		expect(SUPPORTED_FEATURES.length).toBeGreaterThan(0);
		expect(SUPPORTED_FEATURES).toContain("mission.create.http.v1");
		expect(SUPPORTED_FEATURES).toContain("mission.watch.sse.v1");
		expect(SUPPORTED_FEATURES).toContain("receipt.verify.hash.v1");
		expect(SUPPORTED_FEATURES).toContain("protocol.capabilities.v1");
	});

	it("all capabilities end with .vN format", () => {
		const pattern = /\.v\d+$/;
		for (const feat of SUPPORTED_FEATURES) {
			expect(feat).toMatch(pattern);
		}
	});

	it("all capabilities use lowercase dotted notation", () => {
		const pattern = /^[a-z][a-z0-9.-]+$/;
		for (const feat of SUPPORTED_FEATURES) {
			expect(feat).toMatch(pattern);
		}
	});

	it("compareVersions: equal versions", () => {
		expect(compareVersions("1.0", "1.0")).toBe(0);
	});

	it("compareVersions: major version differences", () => {
		expect(compareVersions("2.0", "1.0")).toBeGreaterThan(0);
		expect(compareVersions("1.0", "2.0")).toBeLessThan(0);
	});

	it("compareVersions: minor version differences", () => {
		expect(compareVersions("1.2", "1.1")).toBeGreaterThan(0);
		expect(compareVersions("1.1", "1.2")).toBeLessThan(0);
	});

	it("isClientCompatible: compatible version", () => {
		expect(isClientCompatible("1.5", "1.0")).toBe(true);
	});

	it("isClientCompatible: exact version", () => {
		expect(isClientCompatible("1.0", "1.0")).toBe(true);
	});

	it("isClientCompatible: incompatible version", () => {
		expect(isClientCompatible("0.9", "1.0")).toBe(false);
	});

	it("getCapabilities returns full capability object", () => {
		const caps = getCapabilities();
		expect(caps.protocolVersion).toBe("1.0");
		expect(caps.minimumClientVersion).toBe("1.0");
		expect(caps.features).toContain("mission.create.http.v1");
		expect(caps.features).toContain("mission.watch.sse.v1");
	});

	it("hasFeature checks individual capabilities", () => {
		const caps = getCapabilities();
		expect(hasFeature(caps, "mission.create.http.v1")).toBe(true);
		expect(hasFeature(caps, "nonexistent.v1")).toBe(false);
	});
});
