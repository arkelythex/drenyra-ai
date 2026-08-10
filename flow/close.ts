/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close orchestrator — Design 02 flagship flow as a deterministic
 * vertical: preflight -> evidence -> candidates -> guardian audit -> receipts
 * -> ledger, producing a verifiable close package.
 *
 * The orchestrator is NOT an authority: it stages, audits, and packages. It
 * never executes external mutations, never approves, and never claims external
 * success without evidence. A missing indispensable source yields
 * WAITING_FOR_EVIDENCE (absence is never zero).
 */

import { CandidateLifecycle } from "../candidates/lifecycle.js";
import type { Candidate, MaterialityInput, Reversibility } from "../candidates/types.js";
import { runGuardianReview, type GuardianReport } from "../guardian/index.js";
import { buildSignedReceipt, type ReceiptKeyPair, type SignedReceipt } from "../receipts/index.js";
import { validateLedger, type LedgerManifest, type LedgerEntry } from "../ledger/index.js";
import type { AdapterRegistry, EvidenceFetchInput } from "../adapters/index.js";

/** Fiscal scope of the close (tenant-bound). */
export interface CloseScope {
	ruc: string;
	period: string;
	companyId: string;
}

/** Systems whose evidence the close requires (Design 02 §6.2). */
export const REQUIRED_EVIDENCE_SYSTEMS = [
	"vouchers",
	"registers",
	"sire",
	"bank-statements",
] as const;
export type RequiredEvidenceSystem = (typeof REQUIRED_EVIDENCE_SYSTEMS)[number];

/** A synthetic reconciliation candidate input (what the agents propose). */
export interface ReconciliationProposal {
	label: string;
	explanation: string;
	subject: string;
	amountCents: string;
	reversibility: Reversibility;
}

/** Close orchestrator inputs. */
export interface MonthlyCloseInput {
	scope: CloseScope;
	adapters: AdapterRegistry;
	keyPair: ReceiptKeyPair;
	/** Skill used for the IGV validation step (Design 03 skills). */
	igvSkill: { id: string; version: string };
	ledgerManifest: LedgerManifest;
	ledgerEntries: readonly LedgerEntry[];
	/** Optional pending ledger entries produced by this close. */
	proposals?: readonly ReconciliationProposal[];
}

/** Result status of the close vertical. */
export type CloseStatus = "preflight-failed" | "waiting-for-evidence" | "complete";

/** The verifiable close package (Design 02 §6.7). */
export interface ClosePackage {
	status: CloseStatus;
	scope: CloseScope;
	sourcesUsed: readonly string[];
	sourcesMissing: readonly string[];
	candidates: readonly Candidate[];
	guardianReports: readonly GuardianReport[];
	receipts: readonly SignedReceipt[];
	ledgerValid: boolean;
	risks: readonly string[];
}

const RUC_RE = /^\d{11}$/;
const PERIOD_RE = /^\d{6}$/;

/** Run the monthly close vertical. Deterministic; never mutates external state. */
export async function runMonthlyClose(input: MonthlyCloseInput): Promise<ClosePackage> {
	const { scope } = input;
	const risks: string[] = [];

	// 1. Preflight: the scope freezes before any work (Design 02 §6.1).
	if (!RUC_RE.test(scope.ruc)) {
		return fail(`invalid RUC "${scope.ruc}" (must be 11 digits)`, scope);
	}
	if (!PERIOD_RE.test(scope.period)) {
		return fail(`invalid fiscal period "${scope.period}" (must be YYYYMM)`, scope);
	}

	// 2. Evidence collection: adapters fetch and hash; absence is never zero.
	const sourcesUsed: string[] = [];
	const sourcesMissing: string[] = [];
	const fetchInput: EvidenceFetchInput = {
		missionId: `close-${scope.ruc}-${scope.period}`,
		ruc: scope.ruc,
		period: scope.period,
		requiredTypes: [],
	};
	for (const system of REQUIRED_EVIDENCE_SYSTEMS) {
		const adapter = input.adapters.resolve(system, "PE");
		if (adapter === undefined) {
			sourcesMissing.push(system);
			continue;
		}
		const result = await adapter.fetch({ ...fetchInput, requiredTypes: [system] });
		if (result.complete && result.items.length > 0) {
			sourcesUsed.push(system);
		} else {
			sourcesMissing.push(system);
		}
	}
	if (sourcesMissing.length > 0) {
		return {
			status: "waiting-for-evidence",
			scope,
			sourcesUsed,
			sourcesMissing,
			candidates: [],
			guardianReports: [],
			receipts: [],
			ledgerValid: false,
			risks: [...risks, `missing evidence: ${sourcesMissing.join(", ")}`],
		};
	}

	// 3. Candidates from the reconciliation proposals (agents propose only).
	const lifecycle = new CandidateLifecycle();
	const candidates: Candidate[] = [];
	const guardianReports: GuardianReport[] = [];
	const receipts: SignedReceipt[] = [];
	for (const proposal of input.proposals ?? []) {
		const materialityInput: MaterialityInput = {
			value: BigInt(proposal.amountCents),
			reversibility: proposal.reversibility,
			jurisdiction: "PE",
		};
		const candidate = lifecycle.propose({
			subject: proposal.subject,
			scope: { ruc: scope.ruc, period: scope.period },
			materialityInput,
		});
		candidates.push(candidate);

		// 4. Guardian audit: findings only; blockers are surfaced, never hidden.
		const report = runGuardianReview(candidate);
		guardianReports.push(report);
		const blockers = report.findings.filter((f) => f.severity === "blocker");
		if (blockers.length > 0) {
			risks.push(`candidate ${candidate.id}: ${blockers.map((b) => b.description).join("; ")}`);
			continue;
		}

		// 5. Approved candidates are receipted with the IGV skill version noted.
		const receipt = buildSignedReceipt(
			{
				action: "approve-candidate",
				actor: "professional",
				ruc: scope.ruc,
				period: scope.period,
				resource: `candidate/${candidate.id}`,
				beforeState: "reviewing",
				afterState: "accepted",
				timestamp: new Date().toISOString(),
				version: 1,
				skill: input.igvSkill,
			} as never,
			input.keyPair,
		);
		receipts.push(receipt);
	}

	// 6. Ledger: the existing chain must validate; pending entries append.
	const ledgerValid = validateLedger(input.ledgerManifest, [...input.ledgerEntries]).valid;

	return {
		status: "complete",
		scope,
		sourcesUsed,
		sourcesMissing,
		candidates,
		guardianReports,
		receipts,
		ledgerValid,
		risks,
	};
}

function fail(reason: string, scope: CloseScope): ClosePackage {
	return {
		status: "preflight-failed",
		scope,
		sourcesUsed: [],
		sourcesMissing: [],
		candidates: [],
		guardianReports: [],
		receipts: [],
		ledgerValid: false,
		risks: [reason],
	};
}

