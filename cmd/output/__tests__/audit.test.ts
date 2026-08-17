/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * Audit logger unit tests — JSONL shape, mandatory fail-closed tenant fields,
 * level filtering, immutable child context, RUC derivation, sink behavior.
 */

import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	AUDIT_LEVELS,
	createAuditLogger,
	inferRuc,
	type AuditSink,
} from "../audit.js";

function collectSink(): { sink: AuditSink; lines: string[] } {
	const lines: string[] = [];
	return {
		sink: {
			write(line: string): void {
				lines.push(line);
			},
		},
		lines,
	};
}

describe("audit logger", () => {
	it("emits one JSONL event with mandatory fields fail-closed to unknown", () => {
		const { sink, lines } = collectSink();
		const logger = createAuditLogger({ level: "info", sink });
		logger.info("mission.started", "mission created");
		expect(lines).toHaveLength(1);
		const event = JSON.parse(lines[0] as string) as Record<string, unknown>;
		expect(event.timestamp).toEqual(expect.any(String));
		expect(event.level).toBe("info");
		expect(event.event).toBe("mission.started");
		expect(event.message).toBe("mission created");
		expect(event.mission_id).toBe("unknown");
		expect(event.ruc).toBe("unknown");
		expect(event.period).toBe("unknown");
		expect(event.user_id).toBe("unknown");
		expect(event.details).toBeUndefined();
	});

	it("carries tenant context and derives ruc from an eleven-digit company id", () => {
		const { sink, lines } = collectSink();
		const logger = createAuditLogger({ level: "info", sink }).child({
			mission_id: "m-1",
			company_id: "20123456789",
			period: "202507",
			user_id: "alice",
		});
		logger.info("mission.applied", "applied", { replayed: false });
		expect(lines).toHaveLength(1);
		const event = JSON.parse(lines[0] as string) as Record<string, unknown>;
		expect(event.mission_id).toBe("m-1");
		expect(event.company_id).toBe("20123456789");
		expect(event.ruc).toBe("20123456789");
		expect(event.period).toBe("202507");
		expect(event.user_id).toBe("alice");
		expect((event.details as Record<string, unknown>).replayed).toBe(false);
	});

	it("an explicit ruc wins over the company-id derivation", () => {
		const { sink, lines } = collectSink();
		const logger = createAuditLogger({ level: "info", sink }).child({
			company_id: "not-a-ruc",
			ruc: "20123456789",
		});
		logger.info("e", "m");
		const event = JSON.parse(lines[0] as string) as Record<string, unknown>;
		expect(event.ruc).toBe("20123456789");
	});

	it("fails ruc closed to unknown when company id is not an RUC shape", () => {
		const { sink, lines } = collectSink();
		const logger = createAuditLogger({ level: "info", sink }).child({
			company_id: "cmp-1",
		});
		logger.info("mission.started", "started");
		const event = JSON.parse(lines[0] as string) as Record<string, unknown>;
		expect(event.company_id).toBe("cmp-1");
		expect(event.ruc).toBe("unknown");
	});

	it("drops events below the configured level", () => {
		const { sink, lines } = collectSink();
		const logger = createAuditLogger({ level: "warn", sink });
		logger.debug("x", "d");
		logger.info("x", "i");
		logger.warn("x", "w");
		logger.error("x", "e");
		expect(
			lines.map((line) => (JSON.parse(line) as { level: string }).level),
		).toEqual(["warn", "error"]);
	});

	it("child merges context immutably", () => {
		const { sink, lines } = collectSink();
		const base = createAuditLogger({ level: "info", sink }).child({
			mission_id: "m-1",
		});
		const child = base.child({ period: "202507" });
		base.info("base.event", "b");
		child.info("child.event", "c");
		expect(lines).toHaveLength(2);
		const first = JSON.parse(lines[0] as string) as Record<string, unknown>;
		expect(first.mission_id).toBe("m-1");
		expect(first.period).toBe("unknown");
		const second = JSON.parse(lines[1] as string) as Record<string, unknown>;
		expect(second.mission_id).toBe("m-1");
		expect(second.period).toBe("202507");
	});

	it("survives non-serializable details (BigInt) without throwing", () => {
		const { sink, lines } = collectSink();
		const logger = createAuditLogger({ level: "info", sink });
		expect(() =>
			logger.info("e", "m", { amountCents: 123n as unknown as number }),
		).not.toThrow();
		expect(lines).toHaveLength(1);
		const event = JSON.parse(lines[0] as string) as Record<string, unknown>;
		expect((event.details as Record<string, unknown>).unserializable).toEqual(
			expect.any(String),
		);
	});

	it("fails open when the sink write throws (audit must never break the caller)", () => {
		const logger = createAuditLogger({
			level: "info",
			sink: {
				write(): void {
					throw new Error("disk full");
				},
			},
		});
		expect(() => logger.info("mission.started", "started")).not.toThrow();
	});

	it("appends JSONL to the DRENYRA_AUDIT_LOG file when configured", () => {
		const dir = mkdtempSync(join(tmpdir(), "drenyra-audit-"));
		const path = join(dir, "audit.jsonl");
		try {
			vi.stubEnv("DRENYRA_AUDIT_LOG", path);
			const logger = createAuditLogger({ level: "info" });
			logger.info("mission.started", "started", { seq: 1 });
			logger.error("mission.failed", "failed");
			const raw = readFileSync(path, "utf8").trim().split("\n");
			expect(raw).toHaveLength(2);
			for (const line of raw) {
				expect(() => JSON.parse(line)).not.toThrow();
			}
			expect(JSON.parse(raw[0] as string)).toMatchObject({
				event: "mission.started",
				details: { seq: 1 },
			});
		} finally {
			vi.unstubAllEnvs();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("inferRuc", () => {
	it("passes exactly eleven ASCII digits", () => {
		expect(inferRuc("20123456789")).toBe("20123456789");
	});

	it("fails closed for any other shape", () => {
		expect(inferRuc("cmp-1")).toBe("unknown");
		expect(inferRuc("2012345678")).toBe("unknown");
		expect(inferRuc("201234567890")).toBe("unknown");
		expect(inferRuc("2012345678a")).toBe("unknown");
	});
});

describe("AUDIT_LEVELS", () => {
	it("exposes the four levels in ascending severity", () => {
		expect(AUDIT_LEVELS).toEqual(["debug", "info", "warn", "error"]);
	});
});
