/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers.
 */
/** CDR successor types (1E-2, steps 1-7): candidate-A authority input, the
 * A→operation link, the mission port (additive seam over MissionRuntime), and the
 * steps 1-7 result. Candidate/receipt ports and the candidate-B result arrive with
 * the steps 8-13 materialization batch. */
import type { Candidate } from "../candidates/index.js";
import type { AcceptedEvidence } from "../evidence/index.js";
import type { ApprovalRecord, GateResult } from "../gates/index.js";
import type { AccountingMissionStatus, BoundMissionCommand, CreateMissionCommand, ExternalCall, ExternalSystemResolver, MissionApplyResult, MissionSnapshot, ReconciliationResult } from "../missions/index.js";
import { MissionRuntime, type MissionStore } from "../missions/index.js";
import type { SignedReceipt } from "../receipts/index.js";
import type { ValidatedTenantScope } from "../tenant-core/index.js";

export const CDR_ERROR = { CANDIDATE_A_NOT_ACCEPTED: "candidate-a-not-accepted", CANDIDATE_A_IDENTITY_MISMATCH: "candidate-a-identity-mismatch", RECEIPT_A_INVALID: "receipt-a-invalid", EVIDENCE_SCOPE_MISMATCH: "evidence-scope-mismatch", POLICY_BLOCKED: "policy-blocked", MISSION_NOT_FOUND: "successor-mission-not-found", OPERATION_BINDING_MISMATCH: "operation-binding-mismatch", RECONCILIATION_MISMATCH: "reconciliation-mismatch", TERMINAL_SNAPSHOT_MISMATCH: "terminal-snapshot-mismatch", IDEMPOTENCY_CONFLICT: "idempotency-conflict", GATE_BLOCKED: "gate-blocked" } as const;
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
}
/** Steps 1-7 composition result: reconciled successor + gates, no candidate B yet. */
export interface CdrSuccessorResult { readonly scope: ValidatedTenantScope; readonly link: CdrSuccessorLink; readonly mission: MissionSnapshot; readonly reconciliation: ReconciliationResult | null; readonly gates: readonly GateResult[]; readonly replayed: boolean; }
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
