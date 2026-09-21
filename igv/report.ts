/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * IGV executive report — compiles the determination into a report that never
 * claims a net position it did not independently verify.
 *
 * `buildIgvReport(determination)` recomputes `débito - crédito` from the
 * determination's own totals and checks it against the carried
 * `netPositionCents`/`netPositionKind`; a mismatch is a hard error
 * (`INCONSISTENT_DETERMINATION`) and the report is NEVER emitted for an
 * inconsistent state. The report also surfaces whether any purchase line was
 * excluded from the credit (`hasExceptions`), passing the typed exceptions
 * through unchanged for human review.
 */

import {
	IgvError,
	type CreditException,
	type IgvDetermination,
	type IgvNetPositionKind,
	type Scope,
} from "./types.js";

/** Executive IGV report (never emitted for an inconsistent determination). */
export interface IgvReport {
	readonly scope: Scope;
	readonly debitoFiscalCents: bigint;
	readonly creditoFiscalCents: bigint;
	readonly netPositionCents: bigint;
	readonly netPositionKind: IgvNetPositionKind;
	readonly excludedCreditLines: readonly CreditException[];
	/** True when at least one purchase line was excluded from the credit. */
	readonly hasExceptions: boolean;
	/**
	 * True only when `débito - crédito` recomputes exactly to
	 * `netPositionCents` and the sign-derived kind matches. The report never
	 * claims a determination it did not verify.
	 */
	readonly identityVerified: boolean;
}

/** Compile the executive IGV report; fail-closed on any identity violation. */
export function buildIgvReport(determination: IgvDetermination): IgvReport {
	const {
		scope,
		debitoFiscalCents,
		creditoFiscalCents,
		netPositionCents,
		netPositionKind,
		excludedCreditLines,
	} = determination;

	const recomputedNetPositionCents = debitoFiscalCents - creditoFiscalCents;
	const recomputedKind: IgvNetPositionKind =
		recomputedNetPositionCents > 0n
			? "payable"
			: recomputedNetPositionCents < 0n
				? "in-favor"
				: "zero";
	const identityVerified =
		recomputedNetPositionCents === netPositionCents &&
		recomputedKind === netPositionKind;
	if (!identityVerified) {
		throw new IgvError(
			"IGV determination violates the débito-crédito identity (recomputed net position does not match)",
			"INCONSISTENT_DETERMINATION",
		);
	}

	return {
		scope,
		debitoFiscalCents,
		creditoFiscalCents,
		netPositionCents,
		netPositionKind,
		excludedCreditLines,
		hasExceptions: excludedCreditLines.length > 0,
		identityVerified,
	};
}
