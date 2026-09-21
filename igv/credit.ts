/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Crédito fiscal — input tax on eligible purchase invoices for the period.
 *
 * `computeCreditoFiscal(scope, lines, rateBp)` sums `floor(baseCents * rateBp
 * / 10000)` over purchase lines that pass the TUO IGV Arts. 18-19
 * formal/substantial validity checks: `validComprobante` (Art. 19 — the
 * comprobante is not annulled/voided) and `destinedToTaxedOperation` (Art. 18
 * — destined to a taxed or exported operation). A line failing either check
 * is excluded from the credit and reported as a typed `CreditException`,
 * never silently dropped. A malformed line (missing id, cross-RUC, or a
 * non-positive base) is a hard fail-closed rejection, distinct from a
 * formal/substantial exclusion — the engine never guesses at a malformed
 * input. All arithmetic is integer-cent BigInt with deterministic floor; no
 * float ever appears.
 */

import {
	assertWellFormedLine,
	validateScope,
	type CreditException,
	type PurchaseLine,
	type Scope,
} from "./types.js";

/** Result of a crédito fiscal computation: the total plus excluded lines. */
export interface CreditoFiscalResult {
	readonly creditoFiscalCents: bigint;
	readonly excludedCreditLines: readonly CreditException[];
}

/** Sum the IGV crédito fiscal over eligible purchase lines for one RUC + period. */
export function computeCreditoFiscal(
	scope: Scope,
	lines: readonly PurchaseLine[],
	rateBp: number,
): CreditoFiscalResult {
	validateScope(scope);

	let creditoFiscalCents = 0n;
	const excludedCreditLines: CreditException[] = [];
	for (const line of lines) {
		assertWellFormedLine(scope, line, "purchase line");
		if (!line.validComprobante) {
			excludedCreditLines.push({
				lineId: line.id,
				code: "INVALID_COMPROBANTE",
				detail: `purchase line "${line.id}": comprobante is annulled/voided (TUO IGV Art. 19)`,
			});
			continue;
		}
		if (!line.destinedToTaxedOperation) {
			excludedCreditLines.push({
				lineId: line.id,
				code: "NOT_DESTINED_TO_TAXED_OPERATION",
				detail: `purchase line "${line.id}": not destined to a taxed/exported operation (TUO IGV Art. 18)`,
			});
			continue;
		}
		creditoFiscalCents += (line.baseCents * BigInt(rateBp)) / 10000n;
	}
	return { creditoFiscalCents, excludedCreditLines };
}
