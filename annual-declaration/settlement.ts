/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — annual settlement against provisional payments.
 *
 * `computeAnnualSettlement` reconciles the annual ISR liability against the
 * cumulative provisional payments (pagos a cuenta): the credit is the
 * BigInt-exact sum of the twelve monthly ISR cédula amounts scoped to the same
 * RUC and fiscal year. When the annual ISR exceeds the credit the settlement
 * reports a balance payable; when the credit exceeds the annual ISR it reports a
 * balance in favor; when they are equal it reports a zero balance. A cross-RUC
 * or out-of-year cédula is rejected with `CROSS_RUC_ACCESS`; a missing,
 * duplicated, or incomplete monthly cédula set is rejected with
 * `INCOMPLETE_INPUT` — no partial credit is ever computed.
 */

import {
	AnnualDeclarationError,
	assertAnnualScope,
	type AnnualScope,
	type AnnualSettlement,
	type MonthlyIsrCedula,
} from "./types.js";

/** Periods 01..12 of `year`, e.g. "2025-01".."2025-12". */
function expectedPeriods(year: string): string[] {
	return Array.from(
		{ length: 12 },
		(_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
	);
}

/** Reconcile the annual ISR liability against the twelve monthly cédulas. */
export function computeAnnualSettlement(
	scope: AnnualScope,
	annualIsrCents: bigint,
	monthlyCedulas: readonly MonthlyIsrCedula[],
): AnnualSettlement {
	assertAnnualScope(scope);

	for (const cedula of monthlyCedulas) {
		if (
			cedula.scope.ruc !== scope.ruc ||
			cedula.scope.period.slice(0, 4) !== scope.year
		) {
			throw new AnnualDeclarationError(
				"CROSS_RUC_ACCESS",
				`cédula "${cedula.scope.period}" (RUC ${cedula.scope.ruc}) is outside the annual scope ` +
					`${scope.ruc}/${scope.year}`,
			);
		}
	}

	const present = new Set(monthlyCedulas.map((cedula) => cedula.scope.period));
	const complete =
		monthlyCedulas.length === 12 &&
		present.size === 12 &&
		expectedPeriods(scope.year).every((period) => present.has(period));
	if (!complete) {
		throw new AnnualDeclarationError(
			"INCOMPLETE_INPUT",
			`incomplete provisional-payment set for ${scope.ruc}/${scope.year}: exactly twelve ` +
				"monthly cédulas 01..12 are required",
		);
	}

	let provisionalCreditCents = 0n;
	for (const cedula of monthlyCedulas) {
		provisionalCreditCents += cedula.amountCents;
	}
	const balanceCents = annualIsrCents - provisionalCreditCents;
	const balanceKind =
		balanceCents > 0n ? "payable" : balanceCents < 0n ? "in-favor" : "zero";
	return {
		scope,
		annualIsrCents,
		provisionalCreditCents,
		balanceCents,
		balanceKind,
	};
}
