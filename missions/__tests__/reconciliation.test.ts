import { describe, expect, it } from "vitest";
import {
	reconcileExternalCall,
	ReconciliationError,
	isVerifiableEvidence,
	type ExternalCall,
	type ExternalEvidence,
	type ExternalOutcome,
	type ExternalSystemResolver,
} from "../reconciliation.js";

const call: ExternalCall = {
	stableIdentifier: "202607-close-001",
	system: "SUNAT",
	missionId: "mission_1",
};

function evidence(overrides: Partial<ExternalEvidence> = {}): ExternalEvidence {
	return {
		identifier: "RUC-20123456789-CPE-202607-000123",
		state: "accepted",
		provenance: "SUNAT",
		moment: "2026-08-01T10:00:00.000Z",
		responseHash: "e".repeat(64),
		...overrides,
	};
}

function resolverFor(
	outcome: ExternalOutcome,
	withEvidence?: ExternalEvidence,
): ExternalSystemResolver {
	return { resolve: async () => ({ outcome, evidence: withEvidence }) };
}

describe("reconcileExternalCall", () => {
	it("records when the external system confirms execution with evidence", async () => {
		const resolver = resolverFor("executed", evidence());
		const result = await reconcileExternalCall(resolver, call);
		expect(result.decision).toBe("record");
		expect(result.evidence?.identifier).toContain("CPE");
	});

	it("rejects executed-without-evidence (fail-closed)", async () => {
		const resolver = resolverFor("executed");
		await expect(reconcileExternalCall(resolver, call)).rejects.toThrow(
			ReconciliationError,
		);
		try {
			await reconcileExternalCall(resolver, call);
		} catch (error) {
			expect((error as ReconciliationError).code).toBe(
				"EXECUTED_WITHOUT_EVIDENCE",
			);
		}
	});

	it("permits an idempotent retry when the system reports not-executed", async () => {
		const resolver = resolverFor("not-executed");
		const result = await reconcileExternalCall(resolver, call);
		expect(result.decision).toBe("retry");
	});

	it("requires human intervention when the outcome is indeterminate", async () => {
		const resolver = resolverFor("indeterminate");
		const result = await reconcileExternalCall(resolver, call);
		expect(result.decision).toBe("human-intervention");
	});

	it("fails closed when no resolver is configured", async () => {
		await expect(reconcileExternalCall(undefined, call)).rejects.toThrow(
			ReconciliationError,
		);
	});

	it("fails closed when the resolver itself fails", async () => {
		const resolver = {
			resolve: async () => {
				throw new Error("connection refused");
			},
		};
		await expect(reconcileExternalCall(resolver, call)).rejects.toThrow(
			ReconciliationError,
		);
	});

	it("never re-executes on its own — decisions only record, retry, or escalate", async () => {
		const resolver = resolverFor("indeterminate");
		const result = await reconcileExternalCall(resolver, call);
		expect(["record", "retry", "human-intervention"]).toContain(
			result.decision,
		);
	});
});

describe("isVerifiableEvidence", () => {
	it("requires every field and a 64-char response hash", () => {
		expect(isVerifiableEvidence(evidence())).toBe(true);
		expect(isVerifiableEvidence(evidence({ responseHash: "short" }))).toBe(
			false,
		);
		expect(isVerifiableEvidence(evidence({ identifier: "" }))).toBe(false);
	});
});
