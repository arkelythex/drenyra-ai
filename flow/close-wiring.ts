/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Close vertical wiring — deterministic converters that bind the two verified
 * engines (`bank-reconciliation/`, `close-calculations/`) to the monthly-close
 * vertical's `ReconciliationProposal` shape.
 *
 * Pure translation layer: imports only the two engines' public exports, the
 * `flow/close.ts` types, and `candidates/types.js`. Imports nothing from
 * `agents/`, `cmd/`, `ledger/`, `mcp/`, or `adapters/`. Neither engine is
 * modified; every operation is scoped to one RUC + one fiscal period; money is
 * BigInt cents; conversion is fail-closed — engine errors, rejected rows, and
 * unclassifiable output surface as typed risks, never as fabricated proposals.
 */
import {
	BankReconciliationError,
	buildAdjustments,
	normalizeBankRows,
	normalizeLedgerRows,
	reconcile,
} from "../bank-reconciliation/index.js";
import type {
	AdjustmentDraft,
	AdjustOptions,
	BankRow,
	Difference,
	LedgerRow,
	NormalizeResult,
	ReconcileOptions,
} from "../bank-reconciliation/index.js";
import {
	CloseError,
	closeResultAccounts,
	computeDepreciation,
	computeProvisions,
	computeProvisionalIsr,
} from "../close-calculations/index.js";
import type {
	CloseEntry,
	CloseKind,
	DepreciationPolicy,
	FixedAsset,
	IsrPolicy,
	ProvisionInput,
	ProvisionPolicy,
	ProvisionalIsrInput,
	ResultBalance,
} from "../close-calculations/index.js";
import type { Reversibility } from "../candidates/types.js";
import type { CloseScope, ReconciliationProposal } from "./close.js";

/**
 * Deterministic reversibility per close-entry kind:
 * depreciation → irreversible (consumes an asset's value across a closed period),
 * provision → partially-reversible (estimate adjusted/reversed with approval),
 * isr → irreversible (statutory fiscal obligation), closing → reversible
 * (internal period close; re-openable).
 */
const CLOSE_KIND_REVERSIBILITY: Readonly<Record<CloseKind, Reversibility>> = {
	depreciation: "irreversible",
	provision: "partially-reversible",
	isr: "irreversible",
	closing: "reversible",
};

/** Surface a bank-reconciliation engine failure fail-closed, preserving its typed code. */
function reconciliationEngineRisk(error: unknown): string {
	if (error instanceof BankReconciliationError) {
		return `reconciliation engine error: ${error.code} — ${error.message}`;
	}
	return `reconciliation engine error: ${String(error)}`;
}

/** Surface a close engine failure fail-closed, preserving its typed code. */
function closeEngineRisk(group: string, error: unknown): string {
	if (error instanceof CloseError) {
		return `close engine error (${group}): ${error.code} — ${error.message}`;
	}
	return `close engine error (${group}): ${String(error)}`;
}

/**
 * Convert a classified reconciliation into proposals: exactly one proposal per
 * adjustment draft, in draft order. Fail-closed: rejected rows and engine
 * failures surface as typed risks; nothing is fabricated or silently skipped.
 */
export function reconciliationToProposals(
	scope: CloseScope,
	bankRows: readonly BankRow[],
	ledgerRows: readonly LedgerRow[],
	opts?: ReconcileOptions & AdjustOptions,
): { proposals: ReconciliationProposal[]; risks: string[] } {
	const risks: string[] = [];
	const engineScope = { ruc: scope.ruc, period: scope.period };

	let bank: NormalizeResult;
	let ledger: NormalizeResult;
	try {
		bank = normalizeBankRows(engineScope, bankRows);
		ledger = normalizeLedgerRows(engineScope, ledgerRows);
	} catch (error) {
		risks.push(reconciliationEngineRisk(error));
		return { proposals: [], risks };
	}
	for (const rejection of bank.rejected) {
		risks.push(
			`bank row "${rejection.sourceKey}" rejected: ${rejection.code} — ${rejection.detail}`,
		);
	}
	for (const rejection of ledger.rejected) {
		risks.push(
			`ledger row "${rejection.sourceKey}" rejected: ${rejection.code} — ${rejection.detail}`,
		);
	}

	let differences: readonly Difference[];
	try {
		differences = reconcile(
			engineScope,
			bank.movements,
			ledger.movements,
			opts,
		).differences;
	} catch (error) {
		risks.push(reconciliationEngineRisk(error));
		return { proposals: [], risks };
	}

	let drafts: readonly AdjustmentDraft[];
	try {
		drafts = buildAdjustments(differences, opts);
	} catch (error) {
		risks.push(reconciliationEngineRisk(error));
		return { proposals: [], risks };
	}

	const proposals: ReconciliationProposal[] = drafts.map((draft) => ({
		label: `adjustment:${draft.draftId}`,
		explanation: draft.justification,
		subject: JSON.stringify({
			kind: "reconciliation-adjustment",
			draftId: draft.draftId,
			reference: draft.reference,
			source: draft.source,
			side: draft.side,
			requireApproval: draft.requireApproval,
		}),
		// Lossless: the pipeline reads BigInt(proposal.amountCents).
		amountCents: draft.amountCents.toString(),
		// A draft that requires approval is a controlled correction; one that
		// does not is a routine, fully reversible correction. No draft maps to
		// irreversible (reconciliation adjustments are corrections, not final
		// events).
		reversibility: draft.requireApproval
			? "partially-reversible"
			: "reversible",
	}));

	return { proposals, risks };
}

/** Inputs to the close-calculations engines, keyed by computation group. */
export interface CloseEngineInputs {
	depreciation?: {
		assets: readonly FixedAsset[];
		policy: DepreciationPolicy;
	};
	provisions?: {
		inputs: readonly ProvisionInput[];
		policy: ProvisionPolicy;
	};
	isr?: {
		input: ProvisionalIsrInput;
		policy: IsrPolicy;
	};
	closing?: {
		balances: readonly ResultBalance[];
		chart: ReadonlySet<string>;
	};
}

/**
 * Map one balanced close entry to a proposal. The amount is the entry's
 * balanced magnitude: for a balanced entry sum(debits) === sum(credits), so the
 * debit-side total equals the credit-side total (the spec's "balanced
 * BigInt-cent magnitude"); summing every line would double-count.
 */
function mapEntry(
	entry: CloseEntry,
	proposals: ReconciliationProposal[],
	risks: string[],
): void {
	const reversibility = CLOSE_KIND_REVERSIBILITY[entry.kind];
	if (reversibility === undefined) {
		risks.push(
			`close entry "${entry.id}": unclassifiable kind "${String(entry.kind)}"`,
		);
		return;
	}
	const amountCents = entry.lines.reduce(
		(sum, line) => (line.side === "debit" ? sum + line.amountCents : sum),
		0n,
	);
	proposals.push({
		label: `close:${entry.kind}:${entry.id}`,
		explanation: `${entry.id} — ${entry.lines
			.map(
				(line) =>
					`${line.accountCode} ${line.side} ${line.amountCents}`,
			)
			.join(", ")}`,
		// Lines carry amountCents as strings: JSON.stringify throws on BigInt.
		subject: JSON.stringify({
			kind: "close-entry",
			entryId: entry.id,
			closeKind: entry.kind,
			lines: entry.lines.map((line) => ({
				accountCode: line.accountCode,
				side: line.side,
				amountCents: line.amountCents.toString(),
			})),
		}),
		amountCents: amountCents.toString(),
		reversibility,
	});
}

/**
 * Convert the close-calculations engine output into proposals: exactly one
 * proposal per balanced close entry, in engine entry order. The provisional-ISR
 * result maps ONLY its entry — the cédula is never a proposal. Fail-closed: an
 * engine failure in one group surfaces as a typed risk and produces no proposal
 * from that group's output; other groups still map their entries.
 */
export function closeEntriesToProposals(
	scope: CloseScope,
	inputs: CloseEngineInputs,
): { proposals: ReconciliationProposal[]; risks: string[] } {
	const engineScope = { ruc: scope.ruc, period: scope.period };
	const proposals: ReconciliationProposal[] = [];
	const risks: string[] = [];

	if (inputs.depreciation !== undefined) {
		try {
			for (const entry of computeDepreciation(
				engineScope,
				inputs.depreciation.assets,
				inputs.depreciation.policy,
			)) {
				mapEntry(entry, proposals, risks);
			}
		} catch (error) {
			risks.push(closeEngineRisk("depreciation", error));
		}
	}
	if (inputs.provisions !== undefined) {
		try {
			for (const entry of computeProvisions(
				engineScope,
				inputs.provisions.inputs,
				inputs.provisions.policy,
			)) {
				mapEntry(entry, proposals, risks);
			}
		} catch (error) {
			risks.push(closeEngineRisk("provisions", error));
		}
	}
	if (inputs.isr !== undefined) {
		try {
			const result = computeProvisionalIsr(
				engineScope,
				inputs.isr.input,
				inputs.isr.policy,
			);
			// Only the balanced entry becomes a proposal; the cédula is
			// explanatory data, never a candidate.
			mapEntry(result.entry, proposals, risks);
		} catch (error) {
			risks.push(closeEngineRisk("isr", error));
		}
	}
	if (inputs.closing !== undefined) {
		try {
			for (const entry of closeResultAccounts(
				engineScope,
				inputs.closing.balances,
				inputs.closing.chart,
			)) {
				mapEntry(entry, proposals, risks);
			}
		} catch (error) {
			risks.push(closeEngineRisk("closing", error));
		}
	}

	return { proposals, risks };
}
