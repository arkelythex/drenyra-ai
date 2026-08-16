/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Bank reconciliation — matching and difference classification.
 *
 * `reconcile(scope, bank, ledger)` classifies every movement into exactly one of
 * `matched`, `bankOnly`, `ledgerOnly`, or `conflict`:
 *
 * 1. Reference-first pass: a reference shared by exactly one bank movement and
 *    exactly one ledger movement is a match. A reference that maps to more than
 *    one counterpart on either side is a `conflict` — surfaced, never guessed,
 *    and excluded from the fallback pass (fail-closed: ambiguity is never
 *    papered over with an amount/date guess).
 * 2. Fallback pass (amount + same day): unmatched movements match only when the
 *    exact BigInt-cent amount AND the date AND the canonical side are equal.
 *    Matching is a deterministic one-to-one greedy pass sorted by `sourceKey`.
 *    Amount alone or date alone NEVER matches.
 *
 * Tenant isolation: canonical movements are bound to one RUC at the normalize
 * boundary (rows carrying a foreign RUC are rejected with `CROSS_RUC_ACCESS`).
 * `reconcile` re-validates the operation scope (one RUC + one fiscal period)
 * and fails closed with `INVALID_SCOPE` otherwise. An empty `rejected` array
 * from normalization is the caller-side precondition for this pass.
 */

import {
	validateScope,
	type BankOnlyDifference,
	type ConflictDifference,
	type Difference,
	type LedgerOnlyDifference,
	type MatchedPair,
	type Movement,
	type Reconciliation,
	type Scope,
} from "./types.js";

/** Matching options. Reserved extension point; empty for this slice. */
export interface ReconcileOptions {
	// Reserved for future matching controls (e.g., tolerance windows).
}

/** Group movements by normalized reference, preserving input order per key. */
function groupByReference(
	byReference: Map<string, Movement[]>,
	movement: Movement,
): void {
	const list = byReference.get(movement.reference);
	if (list === undefined) {
		byReference.set(movement.reference, [movement]);
	} else {
		list.push(movement);
	}
}

/** Reconcile bank and ledger movements within one RUC + fiscal period. */
export function reconcile(
	scope: Scope,
	bank: readonly Movement[],
	ledger: readonly Movement[],
	_opts?: ReconcileOptions,
): Reconciliation {
	validateScope(scope);

	const bankByReference = new Map<string, Movement[]>();
	const ledgerByReference = new Map<string, Movement[]>();
	for (const movement of bank) groupByReference(bankByReference, movement);
	for (const movement of ledger) groupByReference(ledgerByReference, movement);

	const bankMatched = new Set<string>();
	const ledgerMatched = new Set<string>();
	const conflictBankKeys = new Set<string>();
	const conflictLedgerKeys = new Set<string>();

	const conflicts: ConflictDifference[] = [];
	const referenceMatches: MatchedPair[] = [];

	// Reference-first pass over the sorted union of references (deterministic).
	const references = [...new Set([...bankByReference.keys(), ...ledgerByReference.keys()])].sort();
	for (const reference of references) {
		const bankSide = bankByReference.get(reference) ?? [];
		const ledgerSide = ledgerByReference.get(reference) ?? [];
		if (bankSide.length > 1 || ledgerSide.length > 1) {
			conflicts.push({ classification: "conflict", reference, bank: bankSide, ledger: ledgerSide });
			for (const movement of bankSide) conflictBankKeys.add(movement.sourceKey);
			for (const movement of ledgerSide) conflictLedgerKeys.add(movement.sourceKey);
		} else if (bankSide.length === 1 && ledgerSide.length === 1) {
			referenceMatches.push({ classification: "matched", bank: bankSide[0], ledger: ledgerSide[0] });
			bankMatched.add(bankSide[0].sourceKey);
			ledgerMatched.add(ledgerSide[0].sourceKey);
		}
		// 1:0 and 0:1 references fall through to the amount+same-day pass.
	}

	// Fallback pass: unmatched, non-conflict movements only. Deterministic
	// one-to-one greedy in sorted sourceKey order; exact amount AND date AND
	// equal canonical side required.
	const unmatchedBank = bank
		.filter((m) => !bankMatched.has(m.sourceKey) && !conflictBankKeys.has(m.sourceKey))
		.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
	const availableLedger = ledger
		.filter((m) => !ledgerMatched.has(m.sourceKey) && !conflictLedgerKeys.has(m.sourceKey))
		.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));

	const fallbackMatches: MatchedPair[] = [];
	const bankOnly: BankOnlyDifference[] = [];

	for (const bankMovement of unmatchedBank) {
		const ledgerIndex = availableLedger.findIndex(
			(candidate) =>
				candidate.amountCents === bankMovement.amountCents &&
				candidate.date === bankMovement.date &&
				candidate.side === bankMovement.side,
		);
		if (ledgerIndex === -1) {
			bankOnly.push({ classification: "bankOnly", bank: bankMovement });
		} else {
			const [ledgerMovement] = availableLedger.splice(ledgerIndex, 1);
			fallbackMatches.push({ classification: "matched", bank: bankMovement, ledger: ledgerMovement });
		}
	}

	const ledgerOnly: LedgerOnlyDifference[] = availableLedger.map((movement) => ({
		classification: "ledgerOnly",
		ledger: movement,
	}));

	const differences: readonly Difference[] = [
		...conflicts,
		...referenceMatches,
		...fallbackMatches,
		...bankOnly,
		...ledgerOnly,
	];

	return {
		scope,
		differences,
		fullyMatched: differences.every((difference) => difference.classification === "matched"),
	};
}
