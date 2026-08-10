/**
 * Evidence identity tests (unit: evidence-identity) — channel vocabulary, error
 * taxonomy, fail-closed provenance shape validation, and canonical content-derived
 * identity over scope key + evidence hash + provenance. Registration-side
 * behaviors are covered by evidence/authority.
 */
import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../../../receipts/index.js";
import { computeEvidenceHash } from "../../../receipts/index.js";
import { tenantScopeKey, validateTenantScope } from "../../../tenant-core/index.js";
import {
	ADVISORY_SHAPED_MARKERS,
	deriveEvidenceIdentity,
	EVIDENCE_CHANNEL,
	EvidenceError,
	EvidenceErrorCode,
	isEvidenceChannel,
	isEvidenceError,
	MEMORY_SHAPED_MARKERS,
	validateProvenanceShape,
} from "../index.js";

const scope = (companyId: string, ruc: string): string =>
	tenantScopeKey(validateTenantScope({ companyId, ruc, period: "202607" }));
const SCOPE_KEY = scope("acme", "20123456789");
const OTHER_SCOPE_KEY = scope("other", "20512345678");
const ITEMS: EvidenceItem[] = [
	{ id: "ev-1", label: "Bank reconciliation", type: "report" },
	{ id: "ev-2", label: "Depreciation schedule", type: "document" },
];
const PROVENANCE = {
	channel: "report",
	source: "erp://reports/2026-07/rec-114",
	capturedAt: "2026-08-02T10:00:00.000Z",
	capturedBy: "ledger-import/v1",
};

/** Asserts the thrown error is an EvidenceError carrying the exact code. */
const expectEvidenceCode = (fn: () => unknown, code: EvidenceErrorCode): void => {
	let thrown: unknown;
	try {
		fn();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(EvidenceError);
	expect((thrown as EvidenceError).code).toBe(code);
};

/** Canonical identity over the default scope/items; each parameter overrides. */
const derive = (
	evidenceHash = computeEvidenceHash(ITEMS),
	provenance = PROVENANCE,
	scopeKey = SCOPE_KEY,
): string => deriveEvidenceIdentity({ scopeKey, evidenceHash, provenance });

describe("evidence channel vocabulary (types)", () => {
	it("defines the four evidence-bearing channels and rejects others", () => {
		expect(Object.values(EVIDENCE_CHANNEL)).toEqual(["document", "report", "system", "external"]);
		expect(Object.values(EVIDENCE_CHANNEL).every(isEvidenceChannel)).toBe(true);
		expect(isEvidenceChannel("hearsay")).toBe(false);
		expect(isEvidenceChannel("")).toBe(false);
	});
	it("separates memory-shaped from advisory-shaped markers", () => {
		expect(MEMORY_SHAPED_MARKERS).toEqual(["memory", "engram", "recall"]);
		expect(ADVISORY_SHAPED_MARKERS).toEqual(["advisory", "assistant", "llm", "suggestion", "agent", "chat"]);
	});
});

describe("EvidenceError taxonomy (errors)", () => {
	it("carries its code and name and supports a custom message", () => {
		const error = new EvidenceError(EvidenceErrorCode.INVALID_SCOPE, "boom");
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("EvidenceError");
		expect(error.code).toBe(EvidenceErrorCode.INVALID_SCOPE);
		expect(error.message).toBe("boom");
		expect(new EvidenceError(EvidenceErrorCode.MEMORY_SHAPED).message).toBe("Evidence error: MEMORY_SHAPED");
	});
	it("isEvidenceError narrows only EvidenceError instances", () => {
		expect(isEvidenceError(new EvidenceError(EvidenceErrorCode.INVALID_ITEM))).toBe(true);
		expect(isEvidenceError(new Error("plain"))).toBe(false);
		expect(isEvidenceError(null)).toBe(false);
	});
});

describe("validateProvenanceShape — fail-closed provenance validation", () => {
	it("rejects missing provenance", () =>
		expectEvidenceCode(
			() => validateProvenanceShape(undefined),
			EvidenceErrorCode.MISSING_PROVENANCE,
		));
	const MALFORMED: Array<[string, unknown]> = [
		["non-object string", "report"],
		["missing source field", { ...PROVENANCE, source: undefined }],
		["empty source", { ...PROVENANCE, source: "" }],
		["non-ISO capturedAt", { ...PROVENANCE, capturedAt: "not-a-date" }],
	];
	it.each(MALFORMED)("rejects %s provenance", (_label, value) => {
		expectEvidenceCode(
			() => validateProvenanceShape(value),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
	it("normalizes channel, source, and capturedBy (trim + lowercase)", () => {
		expect(
			validateProvenanceShape({
				channel: " Report ",
				source: " erp://reports/2026-07/rec-114 ",
				capturedAt: PROVENANCE.capturedAt,
				capturedBy: " Ledger-import/v1 ",
			}),
		).toEqual({
			channel: "report",
			source: "erp://reports/2026-07/rec-114",
			capturedAt: PROVENANCE.capturedAt,
			capturedBy: "Ledger-import/v1",
		});
	});
});

describe("deriveEvidenceIdentity — canonical content-derived identity", () => {
	it("derives a deterministic 64-hex identity for identical input", () => {
		expect(derive()).toBe(derive());
		expect(derive()).toMatch(/^[0-9a-f]{64}$/);
	});
	it("derives the same identity for reordered items (canonical hash contract)", () => {
		expect(derive(computeEvidenceHash([ITEMS[1], ITEMS[0]]))).toBe(derive());
	});
	it("derives a different identity when provenance or scope key differs", () => {
		expect(
			derive(undefined, { ...PROVENANCE, source: "erp://reports/2026-07/rec-115" }),
		).not.toBe(derive());
		expect(derive(undefined, PROVENANCE, OTHER_SCOPE_KEY)).not.toBe(derive());
	});
	it("handles the frozen empty-array hash contract", () => {
		expect(derive(computeEvidenceHash([]))).toMatch(/^[0-9a-f]{64}$/);
	});
});
