/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — post-close report.
 *
 * `buildCloseReport(input)` compiles the post-close report for one RUC + fiscal
 * period: every produced journal entry, the trial-balance identity check (sum of
 * debits equals sum of credits across every line of every entry), the provisional
 * ISR cédula, and the retained-earnings (PCGE 59) balance movement before vs
 * after the close. A report whose underlying state would violate the
 * trial-balance identity is a hard error and is NEVER emitted — the engine never
 * claims a balanced close it did not achieve. All arithmetic is integer-cent
 * BigInt; no float ever appears.
 */

import {
	assertBalanced,
	assertChartAccount,
	CloseError,
	RETAINED_EARNINGS_ACCOUNT,
	validateScope,
	type CloseEntry,
	type CloseReport,
	type IsrCedula,
	type Scope,
} from "./types.js";

/** Inputs to compile a post-close report for one RUC + fiscal period. */
export interface CloseReportInput {
	scope: Scope;
	/** Every journal entry produced by the close. */
	entries: readonly CloseEntry[];
	/** The provisional ISR cédula produced by `computeProvisionalIsr`. */
	isrCedula: IsrCedula;
	/** Retained earnings (PCGE 59) balance before the close. */
	openingRetainedEarningsCents: bigint;
	/** Valid PCGE account codes; every line account must be present. */
	chart: ReadonlySet<string>;
}

/** Compile the post-close report; fail-closed on any identity or scope violation. */
export function buildCloseReport(input: CloseReportInput): CloseReport {
	const { scope, entries, isrCedula, openingRetainedEarningsCents, chart } =
		input;
	validateScope(scope);

	let totalDebits = 0n;
	let totalCredits = 0n;
	let retainedChange = 0n;
	for (const entry of entries) {
		for (const line of entry.lines) {
			assertChartAccount(chart, line.accountCode);
		}
		assertBalanced(entry);
		for (const line of entry.lines) {
			if (line.side === "debit") {
				totalDebits += line.amountCents;
			} else {
				totalCredits += line.amountCents;
			}
			if (line.accountCode === RETAINED_EARNINGS_ACCOUNT) {
				retainedChange +=
					line.side === "credit" ? line.amountCents : -line.amountCents;
			}
		}
	}
	const trialBalanceBalanced = totalDebits === totalCredits;
	if (!trialBalanceBalanced) {
		throw new CloseError(
			"close state violates the trial-balance identity (debits !== credits)",
			"UNBALANCED_ENTRY",
		);
	}
	const beforeCents = openingRetainedEarningsCents;
	return {
		scope,
		entries,
		trialBalanceBalanced,
		isrCedula,
		balanceMovement: {
			beforeCents,
			afterCents: beforeCents + retainedChange,
		},
	};
}
