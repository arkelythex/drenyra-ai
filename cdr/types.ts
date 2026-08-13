/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers.
 */
/** CDR successor types (1E-2, steps 1-13): candidate-A authority input, the
 * A→operation link, the mission port, additive candidate/receipt seams, and the
 * full A→B result: candidate B, its distinct approval, its separate signed
 * receipt, the successor mission snapshot, and the explicit A-to-B link. */
import type { Candidate, MaterialityInput, ProposeInput, ReviewDecision } from "../candidates/index.js";
import { CandidateLifecycle } from "../candidates/index.js";
import type { AcceptedEvidence } from "../evidence/index.js";
import type { ApprovalRecord, GateResult } from "../gates/index.js";
import type { AccountingMissionStatus, BoundMissionCommand, CreateMissionCommand, ExternalCall, ExternalSystemResolver, MissionApplyResult, MissionSnapshot, ReconciliationResult } from "../missions/index.js";
import { MissionRuntime, type MissionStore } from "../missions/index.js";
import { buildSignedReceipt, verifySignedReceipt, type ReceiptContent, type ReceiptKeyPair, type SignedReceipt } from "../receipts/index.js";
import type { ValidatedTenantScope } from "../tenant-core/index.js";

export const CDR_ERROR = { CANDIDATE_A_NOT_ACCEPTED: "candidate-a-not-accepted", CANDIDATE_A_IDENTITY_MISMATCH: "candidate-a-identity-mismatch", RECEIPT_A_INVALID: "receipt-a-invalid", EVIDENCE_SCOPE_MISMATCH: "evidence-scope-mismatch", POLICY_BLOCKED: "policy-blocked", MISSION_NOT_FOUND: "successor-mission-not-found", OPERATION_BINDING_MISMATCH: "operation-binding-mismatch", RECONCILIATION_MISMATCH: "reconciliation-mismatch", TERMINAL_SNAPSHOT_MISMATCH: "terminal-snapshot-mismatch", IDEMPOTENCY_CONFLICT: "idempotency-conflict", GATE_BLOCKED: "gate-blocked", MISSION_RECEIPT_INVALID: "mission-receipt-invalid", CANDIDATE_B_RECEIPT_INVALID: "candidate-b-receipt-invalid", CANDIDATE_B_IDENTITY_MISMATCH: "candidate-b-identity-mismatch" } as const;
export type CdrErrorCode = (typeof CDR_ERROR)[keyof typeof CDR_ERROR];
export class CdrError extends Error {
	readonly code: CdrErrorCode;
	readonly details?: unknown;
	constructor(code: CdrErrorCode, message: string, details?: unknown) {
		super(message);
		this.name = "CdrError";
		this.code = code;
		this.details = details;
	}
}
/** Application-level A→operation successor link (design step 3). */
export interface CdrSuccessorLink { readonly candidateAId: string; readonly subjectHash: string; readonly approvalReceiptHash: string; readonly operationId: string; readonly evidenceIds: readonly string[]; }
export interface CdrReconcileInput { readonly stableIdentifier: string; readonly system: string; readonly resolver: ExternalSystemResolver | undefined; }
/** Candidate-A authority input; `missionId` retries an existing successor mission. */
export interface CdrSuccessorInput {
	readonly scope: unknown;
	readonly candidateA: Candidate;
	readonly approvalA: ApprovalRecord;
	readonly receiptA: SignedReceipt;
	readonly evidence: readonly AcceptedEvidence[];
	readonly operationId: string;
	readonly idempotencyKey: string;
	readonly valueCents: bigint;
	readonly expectedStatus: AccountingMissionStatus;
	readonly executeSteps: readonly number[];
	readonly reconcile: CdrReconcileInput;
	readonly missionId?: string;
	readonly candidateBReviewer: string;
	readonly materiality: MaterialityInput;
	readonly receiptKeyPairB: ReceiptKeyPair;
}
/** Explicit A→B link carried through application input and evidence. */
export interface CdrABLink { readonly candidateAId: string; readonly candidateBId: string; readonly operationId: string; readonly successorMissionId: string; }
/** Full steps 1-13 composition result: candidate B with its distinct approval, verified receipt, mission snapshot, and A→B link. */
export interface CdrSuccessorResult { readonly scope: ValidatedTenantScope; readonly link: CdrSuccessorLink; readonly mission: MissionSnapshot; readonly reconciliation: ReconciliationResult | null; readonly gates: readonly GateResult[]; readonly replayed: boolean; readonly missionReceipt: SignedReceipt; readonly approvalB: ApprovalRecord; readonly receiptB: SignedReceipt; readonly candidateB: Candidate; readonly aToB: CdrABLink; }
/** Mission port: additive seam around the frozen MissionRuntime. */
export interface CdrMissionPort {
	start(command: CreateMissionCommand): Promise<MissionSnapshot>;
	apply(command: BoundMissionCommand, ctx: { idempotencyKey?: string; expectedMissionVersion?: number }): Promise<MissionApplyResult>;
	reconcile(missionId: string, call: ExternalCall, resolver: ExternalSystemResolver | undefined): Promise<{ result: ReconciliationResult; snapshot: MissionSnapshot }>;
	findById(missionId: string): Promise<MissionSnapshot | undefined>;
}
/** Concrete mission port wrapping MissionRuntime + its MissionStore. */
export class MissionRuntimePort implements CdrMissionPort {
	constructor(private readonly runtime: MissionRuntime, private readonly store: MissionStore) {}
	start(command: CreateMissionCommand): Promise<MissionSnapshot> { return this.runtime.start(command); }
	apply(command: BoundMissionCommand, ctx: { idempotencyKey?: string; expectedMissionVersion?: number }): Promise<MissionApplyResult> { return this.runtime.apply(command, ctx); }
	reconcile(missionId: string, call: ExternalCall, resolver: ExternalSystemResolver | undefined): Promise<{ result: ReconciliationResult; snapshot: MissionSnapshot }> { return this.runtime.reconcile(missionId, call, resolver); }
	findById(missionId: string): Promise<MissionSnapshot | undefined> { return this.store.findById(missionId); }
}
/** Candidate seam: additive wrap over the frozen CandidateLifecycle. */
export interface CdrCandidatePort {
	propose(input: ProposeInput): Candidate;
	inspect(candidate: Candidate, subject: Uint8Array | string): Candidate;
	submitForReview(candidate: Candidate): Candidate;
	accept(candidate: Candidate, review: ReviewDecision): Candidate;
}
export class CandidatePort implements CdrCandidatePort {
	private readonly lifecycle = new CandidateLifecycle();
	propose(input: ProposeInput): Candidate { return this.lifecycle.propose(input); }
	inspect(candidate: Candidate, subject: Uint8Array | string): Candidate { return this.lifecycle.inspect(candidate, subject); }
	submitForReview(candidate: Candidate): Candidate { return this.lifecycle.submitForReview(candidate); }
	accept(candidate: Candidate, review: ReviewDecision): Candidate { return this.lifecycle.accept(candidate, review); }
}
/** Receipt seam: sign + verify over the frozen receipt primitives. */
export interface CdrReceiptPort {
	sign(content: ReceiptContent, keyPair: ReceiptKeyPair): SignedReceipt;
	verify(receipt: SignedReceipt): boolean;
}
export class ReceiptPort implements CdrReceiptPort {
	sign(content: ReceiptContent, keyPair: ReceiptKeyPair): SignedReceipt { return buildSignedReceipt(content, keyPair); }
	verify(receipt: SignedReceipt): boolean { return verifySignedReceipt(receipt).valid; }
}
