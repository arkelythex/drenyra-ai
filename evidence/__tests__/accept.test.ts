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
 *
 * The surface delegates all validation and immutability to the existing
 * evidence-authority behavior (`registerEvidence`); these tests prove the
 * accepted surface preserves `id` and `evidenceHash` and adds the canonical
 * receipt-hash-based `identity`.
 */

import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../../receipts/index.js";
import { computeEvidenceHash } from "../../receipts/index.js";
import { validateTenantScope } from "../../tenant-core/index.js";
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
