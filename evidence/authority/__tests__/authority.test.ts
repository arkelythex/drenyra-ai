/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Evidence authority tests (unit: evidence-authority) — tenant-bound
 * registration, atomic fail-closed rejection of envelope/scope/items and
 * memory/advisory channels, deep-freeze immutability, canonical identity
 * binding, and scope assertion. Identity-level derivation and provenance
 * shape validation are covered by evidence/identity.
 */

import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../../../receipts/index.js";
import { computeEvidenceHash } from "../../../receipts/index.js";
import {
	TENANT_SCOPE_BRAND,
	tenantScopeKey,
	validateTenantScope,
} from "../../../tenant-core/index.js";
import { EvidenceError, EvidenceErrorCode } from "../../identity/index.js";
import { assertEvidenceInScope, registerEvidence } from "../index.js";

const SCOPE = validateTenantScope({
	companyId: "acme",
	ruc: "20123456789",
	period: "202607",
});
const OTHER_SCOPE = validateTenantScope({
	companyId: "other",
	ruc: "20512345678",
	period: "202607",
});
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

function register(
	overrides: Record<string, unknown> = {},
): ReturnType<typeof registerEvidence> {
	return registerEvidence({
		scope: SCOPE,
		items: ITEMS,
		provenance: PROVENANCE,
		...overrides,
	});
}

/** Asserts the thrown error is an EvidenceError carrying the exact code. */
function expectEvidenceCode(fn: () => unknown, code: EvidenceErrorCode): void {
	let thrown: unknown;
	try {
		fn();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(EvidenceError);
	expect((thrown as EvidenceError).code).toBe(code);
}

describe("registerEvidence — fail-closed envelope and scope", () => {
	it("rejects a non-object envelope", () => {
		expectEvidenceCode(
			() => registerEvidence(null),
			EvidenceErrorCode.INVALID_INPUT,
		);
	});
	it("rejects a missing scope", () => {
		expectEvidenceCode(
			() => register({ scope: undefined }),
			EvidenceErrorCode.INVALID_SCOPE,
		);
	});
	it("rejects an unbranded (not ValidatedTenantScope) scope", () => {
		expectEvidenceCode(
			() =>
				register({
					scope: { companyId: "acme", ruc: "20123456789", period: "202607" },
				}),
			EvidenceErrorCode.INVALID_SCOPE,
		);
	});
	it("rejects a branded but structurally invalid scope", () => {
		expectEvidenceCode(
			() =>
				register({
					scope: {
						brand: TENANT_SCOPE_BRAND,
						companyId: "acme",
						ruc: "123",
						period: "202607",
					},
				}),
			EvidenceErrorCode.INVALID_SCOPE,
		);
	});
});

describe("registerEvidence — fail-closed item rejection", () => {
	it("rejects missing or non-array items", () => {
		expectEvidenceCode(
			() => register({ items: undefined }),
			EvidenceErrorCode.INVALID_ITEM,
		);
		expectEvidenceCode(
			() => register({ items: "ev-1" }),
			EvidenceErrorCode.INVALID_ITEM,
		);
	});
	it("rejects a malformed item missing a required field", () => {
		expectEvidenceCode(
			() => register({ items: [{ id: "ev-1", label: "Bank reconciliation" }] }),
			EvidenceErrorCode.INVALID_ITEM,
		);
	});
	it("rejects an item with an empty label", () => {
		expectEvidenceCode(
			() => register({ items: [{ id: "ev-1", label: "   ", type: "report" }] }),
			EvidenceErrorCode.INVALID_ITEM,
		);
	});
});

describe("registerEvidence — provenance channel gates", () => {
	it("rejects an unknown evidence channel", () => {
		expectEvidenceCode(
			() => register({ provenance: { ...PROVENANCE, channel: "hearsay" } }),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
	it("rejects memory-shaped channels (also case-insensitively)", () => {
		for (const channel of ["memory", "engram", "Memory"]) {
			expectEvidenceCode(
				() => register({ provenance: { ...PROVENANCE, channel } }),
				EvidenceErrorCode.MEMORY_SHAPED,
			);
		}
	});
	it("rejects advisory-shaped channels", () => {
		for (const channel of ["advisory", "llm", "assistant"]) {
			expectEvidenceCode(
				() => register({ provenance: { ...PROVENANCE, channel } }),
				EvidenceErrorCode.ADVISORY_SHAPED,
			);
		}
	});
});

describe("registerEvidence — tenant-bound immutable record", () => {
	it("returns a deterministic 64-hex identity for identical input", () => {
		const a = register();
		const b = register();
		expect(a.id).toBe(b.id);
		expect(a.id).toMatch(/^[0-9a-f]{64}$/);
	});
	it("binds the validated tenant scope and reuses canonical receipt hashing", () => {
		const evidence = register();
		expect(evidence.scopeKey).toBe(tenantScopeKey(SCOPE));
		expect(evidence.evidenceHash).toBe(computeEvidenceHash(ITEMS));
		expect(evidence.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
	});
	it("accepts an empty item list, delegating to the frozen empty-array hash contract", () => {
		const evidence = register({ items: [] });
		expect(evidence.evidenceHash).toBe(computeEvidenceHash([]));
		expect(evidence.id).toMatch(/^[0-9a-f]{64}$/);
	});
	it("is immutable: record, scope, provenance, and items are frozen at runtime", () => {
		const evidence = register();
		expect(Object.isFrozen(evidence)).toBe(true);
		expect(Object.isFrozen(evidence.scope)).toBe(true);
		expect(Object.isFrozen(evidence.provenance)).toBe(true);
		expect(Object.isFrozen(evidence.items)).toBe(true);
		expect(() => {
			(evidence.items as EvidenceItem[]).push({
				id: "ev-3",
				label: "x",
				type: "y",
			});
		}).toThrow(TypeError);
	});
});

describe("assertEvidenceInScope — tenant-bound evidence cannot cross scopes", () => {
	it("passes for the same validated scope", () => {
		expect(() => assertEvidenceInScope(register(), SCOPE)).not.toThrow();
	});
	it("rejects a different tenant scope", () => {
		expectEvidenceCode(
			() => assertEvidenceInScope(register(), OTHER_SCOPE),
			EvidenceErrorCode.SCOPE_MISMATCH,
		);
	});
	it("rejects an unbranded scope fail-closed", () => {
		expectEvidenceCode(
			() =>
				assertEvidenceInScope(register(), {
					companyId: "acme",
					ruc: "20123456789",
					period: "202607",
				}),
			EvidenceErrorCode.INVALID_SCOPE,
		);
	});
});
