import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidateAuditCommand } from "../commands/candidate-audit.js";

function capture(fn: () => number): { code: number; stdout: string } {
	const out: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		out.push(args.map(String).join(" "));
	};
	let code = -1;
	try {
		code = fn();
	} finally {
		console.log = original;
	}
	return { code, stdout: out.join("\n") };
}

function writeCandidate(dir: string, candidate: unknown): string {
	const file = join(dir, "candidate.json");
	writeFileSync(file, JSON.stringify(candidate));
	return file;
}

describe("candidate audit", () => {
	it("reports no findings and exits 0 for a clean candidate", () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-"));
		try {
			const file = writeCandidate(dir, {
				id: "cand-1",
				subjectHash: "a".repeat(64),
				scope: { ruc: "20123456789", period: "202607" },
				materiality: "R1",
				status: "reviewing",
				reviews: [],
				corrections: [],
				createdAt: "2026-07-01T00:00:00.000Z",
				version: 1,
			});
			const { code, stdout } = capture(() => candidateAuditCommand([file]));
			expect(code).toBe(0);
			const parsed = JSON.parse(stdout) as {
				verdict: string;
				findings: unknown[];
			};
			expect(parsed.verdict).toBe("none");
			expect(parsed.findings).toHaveLength(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("exits 1 with blocker findings for an R3 candidate approved by one person", () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-"));
		try {
			const file = writeCandidate(dir, {
				id: "cand-2",
				subjectHash: "b".repeat(64),
				scope: { ruc: "20123456789", period: "202607" },
				materiality: "R3",
				status: "reviewing",
				reviews: [
					{
						id: "r1",
						verdict: "accept",
						reviewer: "alicia",
						reviewedAt: "2026-07-10T00:00:00.000Z",
					},
				],
				corrections: [],
				createdAt: "2026-07-01T00:00:00.000Z",
				version: 1,
			});
			const { code, stdout } = capture(() => candidateAuditCommand([file]));
			expect(code).toBe(1);
			const parsed = JSON.parse(stdout) as {
				findings: Array<{ severity: string }>;
			};
			expect(parsed.findings.some((f) => f.severity === "blocker")).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("exits 2 for a missing file or a non-candidate document", () => {
		expect(candidateAuditCommand([])).toBe(2);
		expect(candidateAuditCommand(["/nonexistent/candidate.json"])).toBe(2);
		const dir = mkdtempSync(join(tmpdir(), "audit-"));
		try {
			const file = writeCandidate(dir, { not: "a candidate" });
			expect(candidateAuditCommand([file])).toBe(2);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
