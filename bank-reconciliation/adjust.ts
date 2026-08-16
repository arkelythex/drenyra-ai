/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Bank reconciliation — fail-closed adjustment drafts.
 *
 * `buildAdjustments(differences, opts)` derives deterministic adjustment drafts
 * ONLY from classified `bankOnly` / `ledgerOnly` differences. `matched` and
 * `conflict` differences never produce a draft (the ledger is never asked to
 * correct a matched or ambiguous movement). A difference whose classification
 * cannot be recognized is a blocker: the operation throws
 * `UNCLASSIFIED_DIFFERENCE` instead of silently inventing an adjustment.
 *
 * Approval policy: `opts.requireApproval` defaults to `true` (draft status
 * `pending-approval`); `opts.approvalOverrides` keys a per-draft override by
 * the originating movement's `sourceKey`. Draft ids are deterministic
 * (`adj-<n>` in difference order) so the same input always yields the same
 * output.
 */

import {
	BankReconciliationError,
	type AdjustmentDraft,
	type Difference,
	type Movement,
} from "./types.js";

/** Adjustment generation options. */
export interface AdjustOptions {
	/** Whether drafts require human approval; defaults to true. */
	requireApproval?: boolean;
	/** Per-draft override keyed by the originating movement sourceKey. */
	approvalOverrides?: Readonly<Record<string, boolean>>;
}

/** Human-reviewable justification referencing the originating movement. */
function justificationFor(movement: Movement, classification: "bankOnly" | "ledgerOnly"): string {
	const counterpart =
		classification === "bankOnly"
			? "has no ledger counterpart"
			: "has no bank counterpart";
	return `${classification} movement ${movement.sourceKey} (${movement.date}, ref "${movement.reference}", ${movement.side} ${movement.amountCents} cents) ${counterpart}`;
}

/** Build deterministic adjustment drafts from classified differences. */
export function buildAdjustments(
	differences: readonly Difference[],
	opts?: AdjustOptions,
): readonly AdjustmentDraft[] {
	const requireApprovalDefault = opts?.requireApproval ?? true;
	const drafts: AdjustmentDraft[] = [];
	let sequence = 0;

	for (const difference of differences) {
		switch (difference.classification) {
			case "matched":
			case "conflict":
				continue; // never draft from a matched or ambiguous movement
			case "bankOnly":
			case "ledgerOnly": {
				const movement =
					difference.classification === "bankOnly" ? difference.bank : difference.ledger;
				sequence += 1;
				const requireApproval =
					opts?.approvalOverrides?.[movement.sourceKey] ?? requireApprovalDefault;
				drafts.push({
					draftId: `adj-${sequence}`,
					reference: movement.reference,
					source: movement.source,
					amountCents: movement.amountCents,
					side: movement.side,
					justification: justificationFor(movement, difference.classification),
					requireApproval,
					status: requireApproval ? "pending-approval" : "draft",
				});
				break;
			}
			default:
				throw new BankReconciliationError(
					`cannot build adjustments from unclassified difference: ${JSON.stringify(difference)}`,
					"UNCLASSIFIED_DIFFERENCE",
				);
		}
	}

	return drafts;
}
