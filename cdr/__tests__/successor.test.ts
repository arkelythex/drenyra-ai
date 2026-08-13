/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers.
 */
/** CDR successor tests (1E-2, steps 1-7): candidate A (accepted, with approval
 * record and signed receipt) drives a `compliance-check` successor mission on the
 * real MissionRuntime with InMemory stores; the A→operation link is encoded in the
 * existing mission input instruction; reconciliation and gates run through existing
 * primitives; candidate A's identity/status, approval, receipt, version, and subject
 * hash are compared unchanged after completion. */
import { describe, expect, it, vi } from "vitest";
import { AccountingMissionStatus, InMemoryIdempotencyStore, InMemoryMissionEventStore, InMemoryMissionStore, IntentRegistryImpl, MissionEventType, MissionRuntime, type ExternalSystemResolver, type IntentHandler, type MissionSnapshot } from "../../missions/index.js";
import { GateRunner, type Gate, type GateContext } from "../../gates/index.js";
import { CandidateLifecycle, HIGH_VALUE_CENTS, candidateIdentity, type MaterialityInput } from "../../candidates/index.js";
import { buildSignedReceipt, computeEvidenceHash, generateReceiptKeyPair, verifySignedReceipt } from "../../receipts/index.js";
import { acceptEvidence, type AcceptedEvidence } from "../../evidence/index.js";
import { validateTenantScope } from "../../tenant-core/index.js";
import { CdrSuccessorComposer } from "../successor.js";
import { CDR_ERROR, CandidatePort, MissionRuntimePort, ReceiptPort, type CdrSuccessorInput } from "../types.js";

const S = AccountingMissionStatus;
const SCOPE = validateTenantScope({ companyId: "acme", ruc: "20123456789", period: "202607" });
const OTHER_SCOPE = validateTenantScope({ companyId: "zeta", ruc: "20601234567", period: "202607" });
const ITEM = { id: "ev-1", label: "SUNAT compliance report", type: "report" };
const PROVENANCE = { channel: "report", source: "erp://reports/2026-07/compliance", capturedAt: "2026-08-02T10:00:00.000Z", capturedBy: "cdr-import/v1" };
const MATERIALITY: MaterialityInput = { value: 5_000_00n, reversibility: "reversible", jurisdiction: "PE" };
const OPERATION_ID = "op-202607-001";
const IDEMPOTENCY_KEY = "idem-op-202607-001";
const A_SUBJECT = new TextEncoder().encode("candidate-a-subject");
const EVIDENCE_A: AcceptedEvidence = acceptEvidence({ scope: SCOPE, items: [ITEM], provenance: PROVENANCE });
const LIFECYCLE = new CandidateLifecycle();
const PROPOSED_A = LIFECYCLE.propose({ subject: A_SUBJECT, scope: { ruc: SCOPE.ruc, period: SCOPE.period }, materialityInput: MATERIALITY });
const CANDIDATE_A = LIFECYCLE.accept(LIFECYCLE.submitForReview(LIFECYCLE.inspect(PROPOSED_A, A_SUBJECT)), { reviewer: "reviewer-a", reason: "verified" });
const RECEIPT_A = buildSignedReceipt({ missionId: "mission-a", companyId: SCOPE.companyId, actorId: "reviewer-a", decision: "APPROVE", proposalVersion: CANDIDATE_A.version, evidenceHash: EVIDENCE_A.identity, previousStatus: "reviewing", newStatus: "accepted", payloadHash: CANDIDATE_A.subjectHash, timestamp: "2026-08-02T12:00:00.000Z" }, generateReceiptKeyPair("key-a"));
const MATERIALITY_B: MaterialityInput = { value: 5_000_00n, reversibility: "reversible", jurisdiction: "PE" };
const KEY_B = generateReceiptKeyPair("key-b");

const executedResolver = (): ExternalSystemResolver => ({ resolve: async () => ({ outcome: "executed", evidence: { identifier: "SUNAT-202607-001", state: "accepted", provenance: "SUNAT", moment: "2026-08-01T00:00:00.000Z", responseHash: "f".repeat(64) } }) });
const notExecutedResolver = (): ExternalSystemResolver => ({ resolve: async () => ({ outcome: "not-executed" }) });

/** Drives DRAFT -> QUEUED -> RUNNING -> UNKNOWN so reconciliation can run. */
function advanceToUnknown(status: AccountingMissionStatus): AccountingMissionStatus | null {
	switch (status) {
		case S.DRAFT:
			return S.QUEUED;
		case S.QUEUED:
			return S.RUNNING;
		case S.RUNNING:
			return S.UNKNOWN;
		default:
			return null;
	}
}

function harness(over: { valueCents?: bigint; stableIdentifier?: string; resolver?: ExternalSystemResolver; executeSteps?: readonly number[]; expectedStatus?: AccountingMissionStatus; missionId?: string; evidence?: readonly AcceptedEvidence[] } = {}) {
	const store = new InMemoryMissionStore();
	const events = new InMemoryMissionEventStore();
	const idempotency = new InMemoryIdempotencyStore();
	const registry = new IntentRegistryImpl();
	const handler: IntentHandler & { callCount: number } = { intent: "compliance-check", callCount: 0, async execute(mission: MissionSnapshot) { handler.callCount += 1; if (handler.callCount >= 4 && mission.status === S.RUNNING) return { ...mission, status: S.AWAITING_APPROVAL }; const next = advanceToUnknown(mission.status); return next === null ? null : { ...mission, status: next }; } };
	registry.register(handler);
	const runtime = new MissionRuntime({ store, events, idempotency, registry });
	const missionPort = new MissionRuntimePort(runtime, store);
	const input: CdrSuccessorInput = { scope: SCOPE, candidateA: CANDIDATE_A, approvalA: { approverId: "reviewer-a", at: "2026-08-02T12:00:00.000Z" }, receiptA: RECEIPT_A, evidence: over.evidence ?? [EVIDENCE_A], operationId: OPERATION_ID, idempotencyKey: IDEMPOTENCY_KEY, valueCents: over.valueCents ?? 5_000_00n, expectedStatus: over.expectedStatus ?? S.RUNNING, executeSteps: over.executeSteps ?? [1, 2, 3], missionId: over.missionId, reconcile: { stableIdentifier: over.stableIdentifier ?? OPERATION_ID, system: "SUNAT", resolver: over.resolver ?? executedResolver() }, candidateBReviewer: "reviewer-b", materiality: MATERIALITY_B, receiptKeyPairB: KEY_B };
	return { composer: new CdrSuccessorComposer(missionPort), missionPort, runtime, store, events, handler, input };
}

describe("CdrSuccessorComposer — steps 1-5 (successor mission)", () => {
	it("composes a compliance-check successor mission over candidate A and leaves A unchanged", async () => {
		const h = harness();
		const aBefore = { ...CANDIDATE_A };
		const receiptHashBefore = RECEIPT_A.receiptHash;
		const startSpy = vi.spyOn(h.runtime, "start");
		const result = await h.composer.compose(h.input, []);
		expect(result.mission.intent).toBe("compliance-check");
		expect(result.mission.status).toBe(S.APPROVED);
		expect(result.mission.version).toBe(7);
		// The link is encoded in the existing mission input instruction — no mission field added.
		expect(startSpy).toHaveBeenCalledWith({ companyId: SCOPE.companyId, fiscalPeriod: SCOPE.period, intent: "compliance-check", input: { instruction: expect.stringContaining(OPERATION_ID) } });
		expect(result.link).toEqual({ candidateAId: CANDIDATE_A.id, subjectHash: CANDIDATE_A.subjectHash, approvalReceiptHash: RECEIPT_A.receiptHash, operationId: OPERATION_ID, evidenceIds: [EVIDENCE_A.identity] });
		// Step 6: reconciled through existing primitives with verifiable evidence.
		expect(result.reconciliation?.decision).toBe("record");
		expect(result.reconciliation?.evidence?.identifier).toBe("SUNAT-202607-001");
		expect(result.replayed).toBe(false);
		expect(h.handler.callCount).toBe(4);
		const log = await h.events.list(result.mission.id);
		expect(log).toHaveLength(7);
		expect(log.at(-1)?.eventType).toBe(MissionEventType.APPROVAL_DECIDED);
		// Candidate A's identity/status, approval, receipt, version, subject hash unchanged.
		expect(CANDIDATE_A).toEqual(aBefore);
		expect(CANDIDATE_A.id).toBe(aBefore.id);
		expect(CANDIDATE_A.status).toBe("accepted");
		expect(CANDIDATE_A.version).toBe(aBefore.version);
		expect(CANDIDATE_A.subjectHash).toBe(aBefore.subjectHash);
		expect(RECEIPT_A.receiptHash).toBe(receiptHashBefore);
		expect(h.input.approvalA).toEqual({ approverId: "reviewer-a", at: "2026-08-02T12:00:00.000Z" });
	});

	it("fails closed before mission creation on scope, receipt, or policy verification", async () => {
		const h = harness();
		const other = acceptEvidence({ scope: OTHER_SCOPE, items: [ITEM], provenance: PROVENANCE });
		await expect(h.composer.compose({ ...h.input, evidence: [other] }, [])).rejects.toMatchObject({ code: CDR_ERROR.EVIDENCE_SCOPE_MISMATCH });
		await expect(h.composer.compose({ ...h.input, receiptA: { ...RECEIPT_A, receiptHash: "0".repeat(64) } }, [])).rejects.toMatchObject({ code: CDR_ERROR.RECEIPT_A_INVALID });
		await expect(h.composer.compose({ ...h.input, valueCents: HIGH_VALUE_CENTS }, [])).rejects.toMatchObject({ code: CDR_ERROR.POLICY_BLOCKED });
		expect(await h.store.list()).toHaveLength(0);
	});
});

describe("CdrSuccessorComposer — steps 6-7 (reconcile, gates, idempotency)", () => {
	it("runs gates in order over the reconciled result and stops on the first non-allowed verdict", async () => {
		const h = harness();
		const calls: string[] = [];
		const gate = (name: Gate["name"], verdict: "allowed" | "blocked") => ({ name, evaluate: vi.fn(async (ctx: GateContext) => { calls.push(name); if (verdict === "allowed") expect(ctx.mission?.status).toBe(S.RUNNING); return { gate: name, verdict, reason: verdict === "allowed" ? "ok" : "denied" }; }) });
		const third = gate("receipt", "allowed");
		await expect(h.composer.compose(h.input, [gate("pre-commit", "allowed"), gate("approval", "blocked"), third])).rejects.toMatchObject({ code: CDR_ERROR.GATE_BLOCKED });
		expect(calls).toEqual(["pre-commit", "approval"]);
		expect(third.evaluate).not.toHaveBeenCalled();
	});

	it("stops when the reconcile call does not bind to the operation", async () => {
		const h = harness({ stableIdentifier: "SUNAT-OTHER" });
		await expect(h.composer.compose(h.input, [])).rejects.toMatchObject({ code: CDR_ERROR.OPERATION_BINDING_MISMATCH });
		const [mission] = await h.store.list();
		expect(mission.status).toBe(S.UNKNOWN);
		expect((await h.events.list(mission.id)).some((e) => e.eventType === MissionEventType.RECONCILED)).toBe(false);
	});

	it("stops when reconciliation cannot record the execution or the expected snapshot is not reached", async () => {
		const notRecorded = harness({ resolver: notExecutedResolver() });
		await expect(notRecorded.composer.compose(notRecorded.input, [])).rejects.toMatchObject({ code: CDR_ERROR.RECONCILIATION_MISMATCH });
		const wrongTarget = harness({ expectedStatus: S.COMPLETED });
		await expect(wrongTarget.composer.compose(wrongTarget.input, [])).rejects.toMatchObject({ code: CDR_ERROR.TERMINAL_SNAPSHOT_MISMATCH });
	});

	it("idempotent replay returns the same result without re-executing", async () => {
		const h = harness();
		const run1 = await h.composer.compose(h.input, []);
		expect(run1.replayed).toBe(false);
		const run2 = await h.composer.compose({ ...h.input, missionId: run1.mission.id }, []);
		expect(run2.replayed).toBe(true);
		expect(run2.mission).toEqual(run1.mission);
		expect(run2.link).toEqual(run1.link);
		expect(h.handler.callCount).toBe(4);
		expect(await h.events.list(run1.mission.id)).toHaveLength(7);
	});

	it("a different payload with the same idempotency key fails closed", async () => {
		const h = harness();
		const run1 = await h.composer.compose(h.input, []);
		await expect(h.composer.compose({ ...h.input, missionId: run1.mission.id, executeSteps: [2, 3, 4] }, [])).rejects.toMatchObject({ code: CDR_ERROR.IDEMPOTENCY_CONFLICT });
	});
});

describe("CdrSuccessorComposer — steps 8-13 (candidate-B materialization)", () => {
	it("materializes candidate B with its own identity, approval, and signed receipt after mission approval", async () => {
		const h = harness();
		const aBefore = { ...CANDIDATE_A };
		const receiptAHashBefore = RECEIPT_A.receiptHash;
		const result = await h.composer.compose(h.input, []);
		// Step 8: mission approval through existing primitives (RUNNING -> AWAITING_APPROVAL -> APPROVED), bound evidence verified.
		expect(result.mission.status).toBe(S.APPROVED);
		expect(result.mission.version).toBe(7);
		expect(result.missionReceipt.content.missionId).toBe(result.mission.id);
		expect(result.missionReceipt.content.evidenceHash).toBe(computeEvidenceHash([ITEM]));
		expect(verifySignedReceipt(result.missionReceipt).valid).toBe(true);
		// Candidate B exists only with its own approval decision and signed receipt.
		expect(result.candidateB.status).toBe("accepted");
		expect(result.candidateB.id).toBe(candidateIdentity(result.candidateB.subjectHash, { ruc: SCOPE.ruc, period: SCOPE.period }));
		expect(result.approvalB).toMatchObject({ approverId: "reviewer-b" });
		expect(verifySignedReceipt(result.receiptB).valid).toBe(true);
		expect(result.receiptB.content.payloadHash).toBe(result.candidateB.subjectHash);
		// B's receipt differs from A's: receipt hash, mission id, payload hash, signature boundary.
		expect(result.receiptB.receiptHash).not.toBe(RECEIPT_A.receiptHash);
		expect(result.receiptB.content.missionId).not.toBe(RECEIPT_A.content.missionId);
		expect(result.receiptB.content.payloadHash).not.toBe(RECEIPT_A.content.payloadHash);
		expect(result.receiptB.signerKeyId).not.toBe(RECEIPT_A.signerKeyId);
		expect(result.receiptB.signature).not.toBe(RECEIPT_A.signature);
		// Candidate A's approval and receipt are unchanged.
		expect(CANDIDATE_A).toEqual(aBefore);
		expect(RECEIPT_A.receiptHash).toBe(receiptAHashBefore);
		// The explicit A->B link is expressible through application input and evidence (no protocol extension).
		expect(result.aToB).toEqual({ candidateAId: CANDIDATE_A.id, candidateBId: result.candidateB.id, operationId: OPERATION_ID, successorMissionId: result.mission.id });
		expect(result.link.evidenceIds).toEqual([EVIDENCE_A.identity]);
	});

	it("candidate-B materialization never occurs before gates, mission receipt checks, approval decision, and receipt issuance/verification succeed", async () => {
		const h = harness();
		const candidatePort = new CandidatePort();
		const propose = vi.spyOn(candidatePort, "propose");
		const composer = new CdrSuccessorComposer(h.missionPort, new GateRunner(), candidatePort);
		await expect(composer.compose(h.input, [{ name: "approval", evaluate: async () => ({ gate: "approval", verdict: "blocked", reason: "denied" }) }])).rejects.toMatchObject({ code: CDR_ERROR.GATE_BLOCKED });
		expect(propose).not.toHaveBeenCalled();
	});

	it("mission receipt verification failure keeps the mission as an audit fact and produces no candidate B", async () => {
		const h = harness();
		const receiptPort = new ReceiptPort();
		vi.spyOn(receiptPort, "verify").mockReturnValue(false);
		const composer = new CdrSuccessorComposer(h.missionPort, new GateRunner(), new CandidatePort(), receiptPort);
		await expect(composer.compose(h.input, [])).rejects.toMatchObject({ code: CDR_ERROR.MISSION_RECEIPT_INVALID });
		const [mission] = await h.store.list();
		expect(mission.status).toBe(S.APPROVED);
		expect((await h.events.list(mission.id)).at(-1)?.eventType).toBe(MissionEventType.APPROVAL_DECIDED);
	});

	it("candidate-B receipt verification failure returns no candidate B and calls no candidate lifecycle method", async () => {
		const h = harness();
		const receiptPort = new ReceiptPort();
		const verify = vi.spyOn(receiptPort, "verify");
		verify.mockReturnValueOnce(true).mockReturnValueOnce(false);
		const candidatePort = new CandidatePort();
		const propose = vi.spyOn(candidatePort, "propose");
		const composer = new CdrSuccessorComposer(h.missionPort, new GateRunner(), candidatePort, receiptPort);
		await expect(composer.compose(h.input, [])).rejects.toMatchObject({ code: CDR_ERROR.CANDIDATE_B_RECEIPT_INVALID });
		expect(propose).not.toHaveBeenCalled();
		const [mission] = await h.store.list();
		expect(mission.status).toBe(S.APPROVED);
	});

	it("candidate materialization/identity mismatch returns no candidate B and the signed receipt cannot authorize a different subject", async () => {
		const h = harness();
		const receiptPort = new ReceiptPort();
		const signSpy = vi.spyOn(receiptPort, "sign");
		const candidatePort = new CandidatePort();
		vi.spyOn(candidatePort, "propose").mockImplementation((input) => {
			const proposed = new CandidatePort().propose(input);
			return { ...proposed, id: "candidate-b-mismatch", subjectHash: "0".repeat(64) };
		});
		const composer = new CdrSuccessorComposer(h.missionPort, new GateRunner(), candidatePort, receiptPort);
		await expect(composer.compose(h.input, [])).rejects.toMatchObject({ code: CDR_ERROR.CANDIDATE_B_IDENTITY_MISMATCH });
		// The immutable receipt from the failed attempt binds the intended subject hash, not the mismatched one.
		const bReceipt = signSpy.mock.results.at(-1)?.value.content;
		expect(bReceipt.payloadHash).not.toBe("0".repeat(64));
		const [mission] = await h.store.list();
		expect(mission.status).toBe(S.APPROVED);
	});

	it("insufficient evidence fails closed before mission creation and leaves no successor mission", async () => {
		const h = harness({ evidence: [] });
		await expect(h.composer.compose(h.input, [])).rejects.toMatchObject({ code: CDR_ERROR.POLICY_BLOCKED });
		expect(await h.store.list()).toHaveLength(0);
	});

	it("retry after a blocked gate resumes from the reconciled result, produces candidate B, and never alters candidate A", async () => {
		const h = harness();
		const aBefore = { ...CANDIDATE_A };
		await expect(h.composer.compose(h.input, [{ name: "approval", evaluate: async () => ({ gate: "approval", verdict: "blocked", reason: "denied" }) }])).rejects.toMatchObject({ code: CDR_ERROR.GATE_BLOCKED });
		const [missionAfterBlock] = await h.store.list();
		expect(missionAfterBlock.status).toBe(S.RUNNING);
		const result = await h.composer.compose({ ...h.input, missionId: missionAfterBlock.id }, []);
		expect(result.candidateB.status).toBe("accepted");
		expect(result.mission.status).toBe(S.APPROVED);
		expect(CANDIDATE_A).toEqual(aBefore);
	});
});
