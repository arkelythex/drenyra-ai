/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — year-end closing of result accounts.
 *
 * `closeAnnualResults` produces the year-end closing entries that move the
 * non-zero result accounts (PCGE 12/13/14…) into retained earnings (PCGE 59) by
 * composing over the SDD-CON-002 `closeResultAccounts` primitive: the annual
 * scope is converted to the December fiscal period (`YYYY12`), the balances are
 * delegated untouched, and the balanced-entry invariant (`UNBALANCED_ENTRY`),
 * the chart validation (`ACCOUNT_NOT_IN_CHART`), and the retained-earnings
 * constant are inherited — composition, no reimplementation.
 */

import { assertAnnualScope, type AnnualScope, type AnnualEntry } from "./types.js";
import {
	closeResultAccounts,
	type ResultBalance,
} from "../close-calculations/index.js";

/** Close the year's result accounts into retained earnings (PCGE 59). */
export function closeAnnualResults(
	scope: AnnualScope,
	balances: readonly ResultBalance[],
	chart: ReadonlySet<string>,
): AnnualEntry[] {
	assertAnnualScope(scope);
	// The year-end closing posts in December of the fiscal year.
	return closeResultAccounts(
		{ ruc: scope.ruc, period: `${scope.year}12` },
		balances,
		chart,
	);
}
