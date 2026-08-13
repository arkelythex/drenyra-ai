/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Candidate ordering tests (1D-1/1D-2): spies prove validation precedes construction
 * and reconciliation precedes inspection/freeze. */
import { describe, expect, it, vi } from "vitest";
import { acceptEvidence } from "../../evidence/index.js";
import type { AcceptedEvidence } from "../../evidence/index.js";
import { TenantScopeError, tenantScopeKey, validateTenantScope, type ValidatedTenantScope } from "../../tenant-core/index.js";
import type { Candidate, MaterialityInput, ProposeInput } from "../../candidates/index.js";
import { FiscalCandidateOrderingAdapter } from "../candidate-ordering.js";
import { FISCAL_ERROR, FiscalError, type FiscalErrorCode, type FiscalFlowInput } from "../types.js";

const SCOPE = validateTenantScope({ companyId: "acme", ruc: "20123456789", period: "202607" });
const OTHER_SCOPE = validateTenantScope({ companyId: "zeta", ruc: "20601234567", period: "202607" });
const ITEM = { id: "ev-1", label: "Bank reconciliation", type: "report" };
const PROVENANCE = { channel: "report", source: "erp://reports/2026-07/rec-114", capturedAt: "2026-08-02T10:00:00.000Z", capturedBy: "ledger-import/v1" };
const MATERIALITY: MaterialityInput = { value: 100_000_00n, reversibility: "reversible", jurisdiction: "PE" };
const CANDIDATE: Candidate = { id: "cand-1", subjectHash: "a".repeat(64), scope: { ruc: SCOPE.ruc, period: SCOPE.period }, materiality: "R3", status: "proposed", reviews: [], corrections: [], createdAt: "2026-08-02T00:00:00.000Z", version: 1 };

interface FiscalPayload {
	amountCents: bigint;
	label: string;
}
const PAYLOAD: FiscalPayload = { amountCents: 100_000_00n, label: "reconciled" };
const VALIDATED: FiscalPayload = { ...PAYLOAD, label: "RECONCILED" };

function accept(scope = SCOPE): AcceptedEvidence {
	return acceptEvidence({ scope, items: [ITEM], provenance: PROVENANCE });
}

/** Spy harness: every port records call order; nothing may be reached early. */
function harness(options: { reconcileWith?: () => readonly AcceptedEvidence[]; coreThrows?: boolean } = {}) {
	const calls: string[] = [];
	const validate = vi.fn((_scope: ValidatedTenantScope, _input: FiscalPayload): FiscalPayload => {
		calls.push("validate");
		if (options.coreThrows) throw new Error("core validation failed");
		return VALIDATED;
	});
	const reconcile = vi.fn((_scope: ValidatedTenantScope, _input: FiscalPayload): readonly AcceptedEvidence[] => {
		calls.push("reconcile");
		return options.reconcileWith ? options.reconcileWith() : [accept()];
	});
	const build = vi.fn((_scope: ValidatedTenantScope, _input: FiscalPayload, _evidence: readonly AcceptedEvidence[]): Uint8Array => {
		calls.push("build");
		return new TextEncoder().encode("subject-bytes");
	});
	const propose = vi.fn((_input: ProposeInput): Candidate => {
		calls.push("propose");
		return CANDIDATE;
	});
	const inspect = vi.fn((_candidate: Candidate, _subject: Uint8Array): Candidate => {
		calls.push("inspect");
		return { ...CANDIDATE, status: "inspected" };
	});
	return { adapter: new FiscalCandidateOrderingAdapter({ validate }, { reconcile }, { build }, { propose, inspect }), calls, validate, reconcile, build, propose, inspect };
}

function flowInput(scope: unknown): FiscalFlowInput<FiscalPayload> {
	return { scope, payload: PAYLOAD, materialityInput: MATERIALITY };
}

/** Returns the FiscalError code thrown by `run`, or undefined for non-fiscal errors. */
function rejectionCode(run: () => unknown): FiscalErrorCode | undefined {
	try {
		run();
	} catch (error) {
		const fiscal = error as FiscalError;
		if (fiscal instanceof FiscalError) return fiscal.code;
	}
	return undefined;
}

describe("1D-1 — validation before subject construction", () => {
	it("unvalidated fiscal input cannot form a subject: no construction, flow fails closed", () => {
		const { adapter, build, propose, inspect } = harness();
		expect(() => adapter.run(flowInput({ companyId: "acme", ruc: "123", period: "202607" }))).toThrow(TenantScopeError);
		expect(build).not.toHaveBeenCalled();
		expect(propose).not.toHaveBeenCalled();
		expect(inspect).not.toHaveBeenCalled();
	});

	it("validated input constructs the subject with exactly that validated input", () => {
		const { adapter, calls, build, propose } = harness();
		const result = adapter.run(flowInput(SCOPE));
		expect(calls).toEqual(["validate", "reconcile", "build", "propose", "inspect"]);
		expect(build.mock.calls[0][1]).toBe(VALIDATED);
		expect(build.mock.calls[0][2]).toBe(result.evidence);
		expect(propose.mock.calls[0][0].subject).toBe(result.subject);
	});

	it("CoreValidator throwing stops the flow before any candidate call", () => {
		const { adapter, reconcile, build, propose, inspect } = harness({ coreThrows: true });
		expect(() => adapter.run(flowInput(SCOPE))).toThrow("core validation failed");
		expect(reconcile).not.toHaveBeenCalled();
		expect(build).not.toHaveBeenCalled();
		expect(propose).not.toHaveBeenCalled();
		expect(inspect).not.toHaveBeenCalled();
	});
});

describe("1D-2 — reconciliation before freeze", () => {
	it("the freeze point is unreachable without bound reconciliation evidence", () => {
		const { adapter, build, propose, inspect } = harness({ reconcileWith: () => [] });
		expect(() => adapter.run(flowInput(SCOPE))).toThrow(FiscalError);
		expect(build).not.toHaveBeenCalled();
		expect(propose).not.toHaveBeenCalled();
		expect(inspect).not.toHaveBeenCalled();
	});

	it("inspection proceeds only after the evidence is bound to the same scope", () => {
		const { adapter, calls } = harness();
		const result = adapter.run(flowInput(SCOPE));
		expect(calls).toEqual(["validate", "reconcile", "build", "propose", "inspect"]);
		expect(result.candidate.status).toBe("inspected");
		expect(result.evidence).toHaveLength(1);
		expect(result.evidence[0].scopeKey).toBe(tenantScopeKey(SCOPE));
	});

	it("at least one accepted reconciliation artifact bound to the same scope is required", () => {
		const { adapter } = harness({ reconcileWith: () => [] });
		expect(rejectionCode(() => adapter.run(flowInput(SCOPE)))).toBe(FISCAL_ERROR.MISSING_RECONCILIATION_EVIDENCE);
	});

	it("reconciliation evidence from another scope fails closed (TRIANGULATE)", () => {
		const { adapter, inspect } = harness({ reconcileWith: () => [accept(OTHER_SCOPE)] });
		expect(rejectionCode(() => adapter.run(flowInput(SCOPE)))).toBe(FISCAL_ERROR.RECONCILIATION_SCOPE_MISMATCH);
		expect(inspect).not.toHaveBeenCalled();
	});
});
