/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * CLI `capabilities` and `doctor` command tests — read-only surfaces.
 */

import { describe, expect, it, vi } from "vitest";
import { capabilitiesCommand } from "../commands/capabilities.js";
import { doctorCommand } from "../commands/doctor.js";

function capture(fn: () => number): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const out: string[] = [];
	const err: string[] = [];
	const log = vi
		.spyOn(console, "log")
		.mockImplementation((...args: unknown[]) => {
			out.push(args.map(String).join(" "));
		});
	const error = vi
		.spyOn(console, "error")
		.mockImplementation((...args: unknown[]) => {
			err.push(args.map(String).join(" "));
		});
	let code = -1;
	try {
		code = fn();
	} finally {
		log.mockRestore();
		error.mockRestore();
	}
	return { code, stdout: out.join("\n"), stderr: err.join("\n") };
}

describe("capabilities show", () => {
	it("declares the six frozen contracts, PE jurisdiction, and base skills", () => {
		const { code, stdout } = capture(capabilitiesCommand);
		expect(code).toBe(0);
		const parsed = JSON.parse(stdout) as {
			contracts: Array<{ name: string; status: string }>;
			jurisdictions: string[];
			skills: Array<{ id: string; version: string; jurisdiction: string }>;
			version: string;
		};
		expect(parsed.contracts).toHaveLength(6);
		expect(parsed.contracts.every((c) => c.status === "FROZEN")).toBe(true);
		expect(parsed.jurisdictions).toEqual(["PE"]);
		expect(parsed.skills.length).toBeGreaterThanOrEqual(3);
		expect(parsed.skills.every((s) => s.jurisdiction === "PE")).toBe(true);
		expect(parsed.version).toBeTruthy();
	});

	it("skills carry versions and no checksums leak in the declared surface", () => {
		const { stdout } = capture(capabilitiesCommand);
		const parsed = JSON.parse(stdout) as {
			skills: Array<{ id: string; version: string; checksum?: string }>;
		};
		expect(parsed.skills.every((s) => /^\d+\.\d+\.\d+$/.test(s.version))).toBe(
			true,
		);
		expect(parsed.skills.some((s) => s.checksum !== undefined)).toBe(false);
	});
});

describe("doctor run", () => {
	it("reports healthy on a clean checkout", () => {
		const { code, stdout } = capture(doctorCommand);
		expect(code).toBe(0);
		const parsed = JSON.parse(stdout) as {
			status: string;
			readonly: boolean;
			checks: Array<{ name: string; ok: boolean }>;
		};
		expect(parsed.status).toBe("healthy");
		expect(parsed.readonly).toBe(true);
		expect(parsed.checks.every((c) => c.ok)).toBe(true);
	});
});
