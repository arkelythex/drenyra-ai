import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EnvSecretResolver, FileSecretResolver, NullSecretResolver, KMS_GUIDANCE } from "../index.js";

describe("EnvSecretResolver", () => {
	it("resolves a prefixed environment variable", async () => {
		vi.stubEnv("DRENYRA_CONNECTOR_KEY", "secret-value");
		const resolver = new EnvSecretResolver();
		expect(await resolver.resolveSecret("CONNECTOR_KEY")).toBe("secret-value");
		vi.unstubAllEnvs();
	});

	it("returns undefined when absent", async () => {
		const resolver = new EnvSecretResolver();
		expect(await resolver.resolveSecret("DOES_NOT_EXIST_XYZ")).toBeUndefined();
	});
});

describe("FileSecretResolver", () => {
	it("is explicitly test-only and reads a secret file", async () => {
		const dir = mkdtempSync(join(tmpdir(), "drenyra-keys-"));
		try {
			writeFileSync(join(dir, "key.txt"), "file-secret\n");
			const resolver = new FileSecretResolver(join(dir, "key.txt"));
			expect(resolver.testOnly).toBe(true);
			expect(await resolver.resolveSecret("any")).toBe("file-secret");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns undefined for a missing file (never throws)", async () => {
		const resolver = new FileSecretResolver("/nonexistent/never-here.txt");
		expect(await resolver.resolveSecret("any")).toBeUndefined();
	});
});

describe("NullSecretResolver", () => {
	it("fails closed: never resolves anything", async () => {
		const resolver = new NullSecretResolver();
		expect(await resolver.resolveSecret("anything")).toBeUndefined();
	});
});

describe("KMS guidance", () => {
	it("documents the production vault requirement and the dev surface", () => {
		expect(KMS_GUIDANCE.role).toContain("managed vault");
		expect(KMS_GUIDANCE.required.some((r) => r.includes("KMS"))).toBe(true);
		expect(KMS_GUIDANCE.status).toContain("adapter pending");
	});
});
