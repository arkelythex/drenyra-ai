/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Débito fiscal — output tax on taxable sales invoices for the period.
 *
 * `computeDebitoFiscal(scope, lines, rateBp)` sums `floor(baseCents * rateBp /
 * 10000)` over every taxable sales line; an exempt/inafecto line (`taxable:
 * false`) is still fail-closed validated (present id, in-scope RUC, positive
 * base) but excluded from the taxable base — this engine does not encode the
 * full inafectación/exoneración schedule, only the explicit flag. All
 * arithmetic is integer-cent BigInt with deterministic floor; no float ever
 * appears.
 */

import { assertWellFormedLine, validateScope, type Scope, type SalesLine } from "./types.js";

/** Sum the IGV débito fiscal over taxable sales lines for one RUC + period. */
export function computeDebitoFiscal(
	scope: Scope,
	lines: readonly SalesLine[],
	rateBp: number,
): bigint {
	validateScope(scope);

	let debitoFiscalCents = 0n;
	for (const line of lines) {
		assertWellFormedLine(scope, line, "sales line");
		if (!line.taxable) continue;
		debitoFiscalCents += (line.baseCents * BigInt(rateBp)) / 10000n;
	}
	return debitoFiscalCents;
}
