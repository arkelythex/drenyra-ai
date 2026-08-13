/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Accepted-evidence surface tests (work unit 1b-evidence-accept-conformance) —
 * strict fail-closed coverage for the thin wrap-and-expose surface:
 *
 * 1B-1 Provenance requirement: missing/malformed provenance is rejected and
 *      rejection produces no artifact and no downstream-capable partial object.
 * 1B-2 Memory is never evidence: advisory/memory-shaped input is rejected
 *      during narrowing and cannot satisfy an evidence requirement.
     * 1B-3 Canonical evidence identity: the accepted `identity` equals the frozen
     *      receipt primitive `computeEvidenceHash([item])`, equal content yields
     *      equal identities, and identity is immutable (no in-place mutation).
     * 1B-4 Tenant binding and composition: acceptance requires an explicit
     *      validated tenant scope, foreign-scope evidence is rejected by the
     *      binding check, accepted evidence binds a journal-style consumer using
     *      only existing receipt primitives, and the accepted surface is
     *      immutable at every nested level.
     *
     * The surface delegates all validation and immutability to the existing
     * evidence-authority behavior (`registerEvidence`); these tests prove the
     * accepted surface preserves `id` and `evidenceHash` and adds the canonical
     * receipt-hash-based `identity`.
     */

    import { describe, expect, it } from "vitest";
    import type { EvidenceItem } from "../../receipts/index.js";
    import { computeEvidenceHash } from "../../receipts/index.js";
    import {
    	tenantScopeKey,
    	validateTenantScope,
    } from "../../tenant-core/index.js";
    import { assertEvidenceInScope } from "../authority/index.js";
    import { EvidenceError, EvidenceErrorCode } from "../identity/index.js";
import {
	ADVISORY_SHAPED_MARKERS,
	EVIDENCE_CHANNEL,
	MEMORY_SHAPED_MARKERS,
} from "../identity/index.js";
import { acceptEvidence } from "../accept.js";
import type { AcceptedEvidence } from "../accept.js";

const SCOPE = validateTenantScope({
	companyId: "acme",
	ruc: "20123456789",
	period: "202607",
});
const OTHER_SCOPE = validateTenantScope({
	companyId: "zeta",
	ruc: "20601234567",
	period: "202607",
});
const ITEM: EvidenceItem = {
	id: "ev-1",
	label: "Bank reconciliation",
	type: "report",
};
const PROVENANCE = {
	channel: "report",
	source: "erp://reports/2026-07/rec-114",
	capturedAt: "2026-08-02T10:00:00.000Z",
	capturedBy: "ledger-import/v1",
};

function accept(overrides: Record<string, unknown> = {}): AcceptedEvidence {
	return acceptEvidence({
		scope: SCOPE,
		items: [ITEM],
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

describe("acceptEvidence — provenance is required and fails closed (1B-1)", () => {
	it("rejects a submission with missing provenance", () => {
		expectEvidenceCode(
			() => accept({ provenance: undefined }),
			EvidenceErrorCode.MISSING_PROVENANCE,
		);
	});
	it("rejects malformed provenance (non-object)", () => {
		expectEvidenceCode(
			() => accept({ provenance: "report" }),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
	it("rejects malformed provenance (structurally invalid timestamp)", () => {
		expectEvidenceCode(
			() => accept({ provenance: { ...PROVENANCE, capturedAt: "not-a-date" } }),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
	it("rejection produces no artifact and no downstream-capable partial object", () => {
		let result: AcceptedEvidence | undefined;
		try {
			result = accept({ provenance: undefined });
		} catch {
			// expected fail-closed rejection
		}
		expect(result).toBeUndefined();
	});
});

describe("acceptEvidence — provenance field boundaries fail closed (1B-1 TRIANGULATE)", () => {
	it("rejects an empty (whitespace-only) source id", () => {
		expectEvidenceCode(
			() => accept({ provenance: { ...PROVENANCE, source: "   " } }),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
	it("rejects a structurally invalid timestamp", () => {
		expectEvidenceCode(
			() => accept({ provenance: { ...PROVENANCE, capturedAt: "2026-13-99" } }),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
	it("rejects an unknown source kind (channel)", () => {
		expectEvidenceCode(
			() => accept({ provenance: { ...PROVENANCE, channel: "hearsay" } }),
			EvidenceErrorCode.MALFORMED_PROVENANCE,
		);
	});
});

describe("acceptEvidence — memory is never evidence (1B-2)", () => {
	it("rejects memory-shaped channels during narrowing", () => {
		for (const channel of ["memory", "engram", "recall"]) {
			expectEvidenceCode(
				() => accept({ provenance: { ...PROVENANCE, channel } }),
				EvidenceErrorCode.MEMORY_SHAPED,
			);
		}
	});
	it("rejects advisory/conversation-shaped channels during narrowing", () => {
		for (const channel of ["advisory", "llm", "assistant", "chat"]) {
			expectEvidenceCode(
				() => accept({ provenance: { ...PROVENANCE, channel } }),
				EvidenceErrorCode.ADVISORY_SHAPED,
			);
		}
	});
	it("memory-shaped input cannot satisfy an evidence requirement", () => {
		let satisfied = false;
		try {
			const accepted = accept({
				provenance: { ...PROVENANCE, channel: "memory" },
			});
			satisfied = accepted !== undefined;
		} catch {
			// memory never satisfies an evidence requirement
		}
		expect(satisfied).toBe(false);
	});
	it("no accepted type carries a memory marker (1B-2 TRIANGULATE shape proof)", () => {
		const acceptedChannels = Object.values(EVIDENCE_CHANNEL) as string[];
		for (const marker of MEMORY_SHAPED_MARKERS) {
			expect(acceptedChannels).not.toContain(marker);
		}
		for (const marker of ADVISORY_SHAPED_MARKERS) {
			expect(acceptedChannels).not.toContain(marker);
		}
		// runtime proof: an accepted artifact's channel is always an evidence channel
		const accepted = accept();
		expect(acceptedChannels).toContain(accepted.provenance.channel);
	});
});

describe("acceptEvidence — canonical evidence identity (1B-3)", () => {
	it("identity equals computeEvidenceHash([item]) from the frozen receipt primitive", () => {
		const accepted = accept();
		expect(accepted.identity).toBe(computeEvidenceHash([ITEM]));
		expect(accepted.identity).toMatch(/^[0-9a-f]{64}$/);
	});
	it("preserves the existing id and evidenceHash fields", () => {
		const accepted = accept();
		expect(accepted.id).toMatch(/^[0-9a-f]{64}$/);
		expect(accepted.evidenceHash).toBe(computeEvidenceHash([ITEM]));
	});
	it("two submissions with identical content and provenance have equal identities", () => {
		expect(accept().identity).toBe(accept().identity);
		expect(accept().id).toBe(accept().id);
	});
	it("changing the EvidenceItem content yields a new identity (1B-3 TRIANGULATE H2 ≠ H1)", () => {
		const h1 = accept().identity;
		const changed = accept({
			items: [{ ...ITEM, label: "Bank reconciliation (restated)" }],
		});
		expect(changed.identity).not.toBe(h1);
		expect(changed.identity).toBe(
			computeEvidenceHash([{ ...ITEM, label: "Bank reconciliation (restated)" }]),
		);
	});
	it("the original accepted artifact is unchanged — deep immutability (1B-3 TRIANGULATE)", () => {
		const accepted = accept();
		expect(Object.isFrozen(accepted)).toBe(true);
		expect(Object.isFrozen(accepted.items)).toBe(true);
		expect(Object.isFrozen(accepted.provenance)).toBe(true);
		expect(Object.isFrozen(accepted.scope)).toBe(true);
		expect(() => {
			(accepted.items as EvidenceItem[]).push({
				id: "ev-9",
				label: "x",
				type: "y",
			});
		}).toThrow(TypeError);
	});
    	it("original artifact keeps its identity after a different content is accepted (1B-3 TRIANGULATE)", () => {
    		const original = accept();
    		const originalIdentity = original.identity;
    		accept({ items: [{ ...ITEM, label: "Bank reconciliation (restated)" }] });
    		expect(original.identity).toBe(originalIdentity);
    		expect(original.identity).toBe(computeEvidenceHash([ITEM]));
    		expect(original.items[0]?.label).toBe("Bank reconciliation");
    	});
    });

    /**
     * Journal-style consumer seam (1B-4 composition): a downstream entry that
     * binds accepted evidence using only existing receipt primitives and the
     * tenant-scope binding check — no new contract, receipt, or journal API.
     */
    interface JournalStyleEntry {
    	readonly scopeKey: string;
    	readonly evidenceIdentity: string;
    	readonly evidenceHash: string;
    	readonly channel: string;
    }

    function bindJournalStyleEntry(evidence: AcceptedEvidence): JournalStyleEntry {
    	assertEvidenceInScope(evidence, evidence.scope);
    	return {
    		scopeKey: evidence.scopeKey,
    		evidenceIdentity: evidence.identity,
    		evidenceHash: evidence.evidenceHash,
    		channel: evidence.provenance.channel,
    	};
    }

    describe("acceptEvidence — tenant binding (1B-4)", () => {
    	it("acceptance requires an explicit validated tenant scope", () => {
    		expectEvidenceCode(
    			() => accept({ scope: undefined }),
    			EvidenceErrorCode.INVALID_SCOPE,
    		);
    	});
    	it("rejects a forged (unbranded) scope fail-closed", () => {
    		expectEvidenceCode(
    			() =>
    				accept({
    					scope: {
    						companyId: "acme",
    						ruc: "20123456789",
    						period: "202607",
    					},
    				}),
    			EvidenceErrorCode.INVALID_SCOPE,
    		);
    	});
    	it("retains the exact validated tenant scope on every accepted artifact", () => {
    		const accepted = accept();
    		expect(accepted.scope).toEqual(SCOPE);
    		expect(accepted.scopeKey).toBe(tenantScopeKey(SCOPE));
    		expect(accepted.scopeKey).not.toBe(tenantScopeKey(OTHER_SCOPE));
    	});
    	it("the binding check accepts the same scope and rejects a different or forged one", () => {
    		const accepted = accept();
    		expect(() => assertEvidenceInScope(accepted, SCOPE)).not.toThrow();
    		expectEvidenceCode(
    			() => assertEvidenceInScope(accepted, OTHER_SCOPE),
    			EvidenceErrorCode.SCOPE_MISMATCH,
    		);
    		expectEvidenceCode(
    			() =>
    				assertEvidenceInScope(accepted, {
    					companyId: "acme",
    					ruc: "20123456789",
    					period: "202607",
    				}),
    			EvidenceErrorCode.INVALID_SCOPE,
    		);
    	});
    });

    describe("acceptEvidence — journal-style composition (1B-4)", () => {
    	it("binds a journal-style consumer using only existing receipt primitives", () => {
    		const accepted = accept();
    		const entry = bindJournalStyleEntry(accepted);
    		expect(entry.scopeKey).toBe(accepted.scopeKey);
    		expect(entry.evidenceIdentity).toBe(accepted.identity);
    		expect(entry.evidenceIdentity).toBe(computeEvidenceHash([...accepted.items]));
    		expect(entry.evidenceHash).toBe(accepted.evidenceHash);
    		expect(entry.channel).toBe("report");
    	});
    });

    describe("acceptEvidence — nested immutability (1B-4)", () => {
    	it("every nested node of the accepted artifact is frozen", () => {
    		const accepted = accept();
    		expect(Object.isFrozen(accepted)).toBe(true);
    		expect(Object.isFrozen(accepted.items)).toBe(true);
    		for (const item of accepted.items) {
    			expect(Object.isFrozen(item)).toBe(true);
    		}
    		expect(Object.isFrozen(accepted.provenance)).toBe(true);
    		expect(Object.isFrozen(accepted.scope)).toBe(true);
    	});
    	it("nested mutation attempts throw instead of mutating the artifact", () => {
    		const accepted = accept();
    		expect(() => {
    			(accepted.items as EvidenceItem[]).push({
    				id: "ev-9",
    				label: "x",
    				type: "y",
    			});
    		}).toThrow(TypeError);
    		expect(() => {
    			(accepted.items[0] as { label: string }).label = "mutated";
    		}).toThrow(TypeError);
    		expect(() => {
    			delete (accepted.provenance as { source?: string }).source;
    		}).toThrow(TypeError);
    		expect(() => {
    			(accepted.scope as { companyId: string }).companyId = "mutated";
    		}).toThrow(TypeError);
    		expect(() => {
    			(accepted as { identity: string }).identity = "mutated";
    		}).toThrow(TypeError);
    	});
    	it("acceptance copies rather than mutates the input scope", () => {
    		const snapshot = { ...SCOPE };
    		accept();
    		expect(SCOPE).toEqual(snapshot);
    	});
    	it("the accepted surface adds no receipt contract fields (1B-4 TRIANGULATE)", () => {
    		const accepted = accept();
    		expect(Object.keys(accepted).sort()).toEqual([
    			"evidenceHash",
    			"id",
    			"identity",
    			"items",
    			"provenance",
    			"scope",
    			"scopeKey",
    		]);
    		expect(accepted.evidenceHash).toBe(computeEvidenceHash([ITEM]));
    	});
    });
