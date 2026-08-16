/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — closing entries to retained earnings (PCGE 59).
 *
 * `closeResultAccounts(scope, balances, chart)` closes the period's net result
 * accounts (PCGE 12/13/14 and related result accounts) into retained earnings
 * through one balanced entry per account: a credit-balance account (revenue or
 * gain) closes with a debit, a debit-balance account (expense or loss) closes
 * with a credit, and the retained-earnings (PCGE 59) line offsets each. Zero
 * balances are skipped. Every produced entry MUST satisfy
 * sum(debits) === sum(credits); the shared `assertBalanced` invariant runs on
 * every entry, so an internal draft that cannot be balanced is a hard typed
 * error (`UNBALANCED_ENTRY`), never a silent or unbalanced posting.
 */

import {
	assertBalanced,
	assertChartAccount,
	CloseError,
	RETAINED_EARNINGS_ACCOUNT,
	validateScope,
	type CloseEntry,
	type ResultBalance,
	type Scope,
} from "./types.js";

/** Close result accounts into retained earnings through balanced entries. */
export function closeResultAccounts(
	scope: Scope,
	balances: readonly ResultBalance[],
	chart: ReadonlySet<string>,
): CloseEntry[] {
	validateScope(scope);
	assertChartAccount(chart, RETAINED_EARNINGS_ACCOUNT);

	const entries: CloseEntry[] = [];
	let index = 0;
	for (const balance of balances) {
		assertChartAccount(chart, balance.accountCode);
		if (balance.accountCode === RETAINED_EARNINGS_ACCOUNT) {
			throw new CloseError(
				`account "${RETAINED_EARNINGS_ACCOUNT}" cannot be a result source account`,
				"UNCLASSIFIABLE_INPUT",
			);
		}
		if (balance.balanceCents === 0n) continue;
		index += 1;
		const amount =
			balance.balanceCents < 0n ? -balance.balanceCents : balance.balanceCents;
		// A credit balance (revenue/gain) closes with a debit; a debit balance
		// (expense/loss) closes with a credit. Retained earnings offsets each.
		const closesWithDebit = balance.balanceCents < 0n;
		const entry: CloseEntry = {
			id: `close-${index}`,
			scope,
			kind: "closing",
			lines: closesWithDebit
				? [
						{
							accountCode: balance.accountCode,
							side: "debit",
							amountCents: amount,
						},
						{
							accountCode: RETAINED_EARNINGS_ACCOUNT,
							side: "credit",
							amountCents: amount,
						},
					]
				: [
						{
							accountCode: balance.accountCode,
							side: "credit",
							amountCents: amount,
						},
						{
							accountCode: RETAINED_EARNINGS_ACCOUNT,
							side: "debit",
							amountCents: amount,
						},
					],
		};
		assertBalanced(entry);
		entries.push(entry);
	}
	return entries;
}
