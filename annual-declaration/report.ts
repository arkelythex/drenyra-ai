/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — annual settlement report with balance identity.
 *
 * `buildAnnualReport` compiles the post-settlement report: the produced journal
 * entries, the trial-balance identity check (sum of debits equals sum of credits
 * across every line of every entry, reusing the shared `assertBalanced`
 * invariant), the settlement cédula, and the retained-earnings (PCGE 59) balance
 * movement before vs after the close. A state that would violate the
 * trial-balance identity is a hard error (`UNBALANCED_ENTRY`) and the report is
 * NEVER emitted for an unbalanced state.
 */

import { assertBalanced } from "../close-calculations/index.js";
import { RETAINED_EARNINGS_ACCOUNT } from "../close-calculations/index.js";
import {
	AnnualDeclarationError,
	type AnnualEntry,
	type AnnualSettlement,
} from "./types.js";

/** Inputs to compile the annual settlement report. */
export interface AnnualReportInput {
	/** Every journal entry produced by the year-end close. */
	readonly entries: readonly AnnualEntry[];
	readonly settlement: AnnualSettlement;
	/** Retained earnings (PCGE 59) balance before the close. */
	readonly retainedEarningsBeforeCents: bigint;
}

/** Post-settlement annual report (never emitted for an unbalanced state). */
export interface AnnualReport {
	readonly entries: readonly AnnualEntry[];
	/** True whenever a report is emitted: an identity violation is a hard error. */
	readonly trialBalanceBalanced: boolean;
	readonly settlement: AnnualSettlement;
	/** Retained earnings (PCGE 59) balance before vs after the close. */
	readonly retainedEarningsMovement: {
		readonly beforeCents: bigint;
		readonly afterCents: bigint;
	};
}

/** Compile the annual report; fail-closed on any trial-balance identity violation. */
export function buildAnnualReport(input: AnnualReportInput): AnnualReport {
	const { entries, settlement, retainedEarningsBeforeCents } = input;

	let totalDebits = 0n;
	let totalCredits = 0n;
	let retainedChange = 0n;
	for (const entry of entries) {
		// Reuses the shared balanced-entry invariant (per-entry identity).
		assertBalanced(entry);
		for (const line of entry.lines) {
			if (line.side === "debit") {
				totalDebits += line.amountCents;
			} else {
				totalCredits += line.amountCents;
			}
			if (line.accountCode === RETAINED_EARNINGS_ACCOUNT) {
				retainedChange += line.side === "credit" ? line.amountCents : -line.amountCents;
			}
		}
	}
	const trialBalanceBalanced = totalDebits === totalCredits;
	if (!trialBalanceBalanced) {
		throw new AnnualDeclarationError(
			"UNBALANCED_ENTRY",
			"annual settlement state violates the trial-balance identity (debits !== credits)",
		);
	}
	return {
		entries,
		trialBalanceBalanced,
		settlement,
		retainedEarningsMovement: {
			beforeCents: retainedEarningsBeforeCents,
			afterCents: retainedEarningsBeforeCents + retainedChange,
		},
	};
}
