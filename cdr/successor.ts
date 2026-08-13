/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers.
 */
/** CdrSuccessorComposer (1E-2, steps 1-7): verify candidate-A authority, gate the
 * proposed CDR transition through PE policy, build the A→operation link, start a
 * `compliance-check` mission with the link in the existing input instruction,
 * execute existing mission commands with idempotency keys and expected versions,
 * reconcile through existing primitives, then run gates in order. Any failure
 * stops the composition; candidate B is not created in this batch. */
import { candidateIdentity } from "../candidates/index.js";
import { sameTenantScope, tenantScopeKey, validateTenantScope, type ValidatedTenantScope } from "../tenant-core/index.js";
import { sortedStringify, verifySignedReceipt } from "../receipts/index.js";
import { FISCAL_JURISDICTION, PolicyError, evaluatePePolicy, govern, type PolicySubject } from "../policy/index.js";
import { AccountingMissionStatus, IdempotencyConflict, type BoundMissionCommand, type ExternalCall, type MissionSnapshot, type ReconciliationResult } from "../missions/index.js";
import { GateRunner, type Gate, type GateContext, type GateResult } from "../gates/index.js";
import { CDR_ERROR, CdrError, type CdrMissionPort, type CdrSuccessorInput, type CdrSuccessorLink, type CdrSuccessorResult } from "./types.js";

export class CdrSuccessorComposer {
	constructor(private readonly missionPort: CdrMissionPort, private readonly gateRunner: GateRunner = new GateRunner()) {}

	async compose(input: CdrSuccessorInput, gates: readonly Gate[]): Promise<CdrSuccessorResult> {
		const scope = this.verifyAuthority(input);
		const link = this.buildLink(input);
		const mission = await this.startMission(input, scope, link);
		const replayed = await this.executeSteps(mission.id, input);
		const reconciled = await this.reconcileAndVerify(mission.id, input);
		const gateResults = await this.runGates(reconciled.snapshot, input, gates);
		return { scope, link, mission: reconciled.snapshot, reconciliation: reconciled.result, gates: gateResults, replayed };
	}

	/** Step 1 — verify tenant scope, candidate-A identity/status, receipt, evidence scope. */
	private verifyAuthority(input: CdrSuccessorInput): ValidatedTenantScope {
		const scope = validateTenantScope(input.scope);
		if (input.candidateA.status !== "accepted") {
			throw new CdrError(CDR_ERROR.CANDIDATE_A_NOT_ACCEPTED, `candidate A must be accepted, got ${input.candidateA.status}`);
		}
		const expectedId = candidateIdentity(input.candidateA.subjectHash, { ruc: scope.ruc, period: scope.period });
		if (input.candidateA.id !== expectedId) {
			throw new CdrError(CDR_ERROR.CANDIDATE_A_IDENTITY_MISMATCH, `candidate A ${input.candidateA.id} does not match the validated scope`);
		}
		if (!verifySignedReceipt(input.receiptA).valid) {
			throw new CdrError(CDR_ERROR.RECEIPT_A_INVALID, "candidate A receipt failed integrity/signature verification");
		}
		if (input.evidence.some((artifact) => !sameTenantScope(artifact.scope, scope))) {
			throw new CdrError(CDR_ERROR.EVIDENCE_SCOPE_MISMATCH, "every successor evidence artifact must be bound to the validated scope");
		}
		return scope;
	}

	/** Step 2 — PE policy is a precondition: stop before mission creation on BLOCK/ESCALATE, delegate on ALLOW. */
	private async startMission(input: CdrSuccessorInput, scope: ValidatedTenantScope, link: CdrSuccessorLink): Promise<MissionSnapshot> {
		const subject: PolicySubject = { jurisdiction: FISCAL_JURISDICTION.PE, valueCents: input.valueCents, evidence: input.evidence, scopeKey: tenantScopeKey(scope) };
		try {
			return await govern(subject, evaluatePePolicy, { apply: async () => this.missionFor(input, scope, link) });
		} catch (error) {
			if (error instanceof PolicyError) {
				throw new CdrError(CDR_ERROR.POLICY_BLOCKED, `cdr successor policy ${error.decision}: ${error.reason}`, { policy: { decision: error.decision, reason: error.reason } });
			}
			throw error;
		}
	}

	/** Step 3 — application-level A→operation link (no protocol extension). */
	private buildLink(input: CdrSuccessorInput): CdrSuccessorLink {
		return { candidateAId: input.candidateA.id, subjectHash: input.candidateA.subjectHash, approvalReceiptHash: input.receiptA.receiptHash, operationId: input.operationId, evidenceIds: input.evidence.map((artifact) => artifact.identity) };
	}

	/** Step 4 — reuse the retried mission or start a `compliance-check` mission with the link in the instruction. */
	private async missionFor(input: CdrSuccessorInput, scope: ValidatedTenantScope, link: CdrSuccessorLink): Promise<MissionSnapshot> {
		if (input.missionId !== undefined) {
			const existing = await this.missionPort.findById(input.missionId);
			if (existing === undefined) {
				throw new CdrError(CDR_ERROR.MISSION_NOT_FOUND, `successor mission ${input.missionId} not found for retry`);
			}
			return existing;
		}
		return this.missionPort.start({ companyId: scope.companyId, fiscalPeriod: scope.period, intent: "compliance-check", input: { instruction: sortedStringify(link as unknown as Record<string, unknown>) } });
	}

	/** Step 5 — execute existing mission commands with derived idempotency keys and expected versions. */
	private async executeSteps(missionId: string, input: CdrSuccessorInput): Promise<boolean> {
		let replayed = false;
		for (const [index, expectedMissionVersion] of input.executeSteps.entries()) {
			const command: BoundMissionCommand = { type: "execute", missionId, payload: { expectedMissionVersion } };
			try {
				const result = await this.missionPort.apply(command, { idempotencyKey: `${input.idempotencyKey}:execute:${index}`, expectedMissionVersion });
				replayed = replayed || result.replayed === true;
			} catch (error) {
				if (error instanceof IdempotencyConflict) {
					throw new CdrError(CDR_ERROR.IDEMPOTENCY_CONFLICT, `idempotency conflict on execute step ${index + 1}`, { key: `${input.idempotencyKey}:execute:${index}` });
				}
				throw error;
			}
		}
		return replayed;
	}

	/** Step 6 — reconcile through existing primitives; verify operation binding, terminal snapshot, idempotent result. */
	private async reconcileAndVerify(missionId: string, input: CdrSuccessorInput): Promise<{ result: ReconciliationResult | null; snapshot: MissionSnapshot }> {
		if (input.reconcile.stableIdentifier !== input.operationId) {
			throw new CdrError(CDR_ERROR.OPERATION_BINDING_MISMATCH, `reconcile identifier ${input.reconcile.stableIdentifier} does not bind to operation ${input.operationId}`);
		}
		const current = await this.missionPort.findById(missionId);
		if (current === undefined) {
			throw new CdrError(CDR_ERROR.RECONCILIATION_MISMATCH, `successor mission ${missionId} missing after execution`);
		}
		let result: ReconciliationResult | null = null;
		let snapshot = current;
		if (current.status === AccountingMissionStatus.UNKNOWN) {
			const call: ExternalCall = { stableIdentifier: input.operationId, system: input.reconcile.system, missionId };
			const reconciled = await this.missionPort.reconcile(missionId, call, input.reconcile.resolver);
			if (reconciled.result.decision !== "record") {
				throw new CdrError(CDR_ERROR.RECONCILIATION_MISMATCH, `reconciliation decided ${reconciled.result.decision}, expected record`);
			}
			result = reconciled.result;
			snapshot = reconciled.snapshot;
		} else if (current.status !== input.expectedStatus) {
			throw new CdrError(CDR_ERROR.RECONCILIATION_MISMATCH, `successor mission in ${current.status}, expected ${input.expectedStatus} (retry) or UNKNOWN (reconcile)`);
		}
		if (result === null && input.missionId === undefined) {
			throw new CdrError(CDR_ERROR.RECONCILIATION_MISMATCH, "a fresh successor mission must be reconciled before reaching the expected snapshot");
		}
		if (snapshot.status !== input.expectedStatus) {
			throw new CdrError(CDR_ERROR.TERMINAL_SNAPSHOT_MISMATCH, `expected terminal snapshot ${input.expectedStatus}, got ${snapshot.status}`);
		}
		return { result, snapshot };
	}

	/** Step 7 — run existing gates in order over the reconciled successor result. */
	private async runGates(snapshot: MissionSnapshot, input: CdrSuccessorInput, gates: readonly Gate[]): Promise<GateResult[]> {
		const ctx: GateContext = { mission: snapshot, targetStatus: input.expectedStatus };
		const results = await this.gateRunner.run([...gates], ctx);
		const blocked = results.find((result) => result.verdict !== "allowed");
		if (blocked !== undefined) {
			throw new CdrError(CDR_ERROR.GATE_BLOCKED, `gate ${blocked.gate} ${blocked.verdict}: ${blocked.reason}`, { results });
		}
		return results;
	}
}
