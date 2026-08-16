/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — structured annual declaration payload.
 *
 * `buildAnnualDeclaration` compiles the deterministic declaration payload: the
 * RUC, the fiscal year, the annual net income, the taxable base, the annual ISR
 * liability, the provisional-payment credit, the balance amount with its kind,
 * and the supporting cédulas (annual net income determination, annual ISR with
 * the applied rate, and the settlement). The payload is pure data with stable
 * field names and ordering — identical inputs yield byte-identical output — and
 * is the deterministic input shape a future SUNAT DJ adapter consumes; this
 * slice performs no I/O, no network call, and no CDR interaction.
 */

import {
	type AnnualBalanceKind,
	type AnnualNetIncomeInput,
	type AnnualScope,
	type AnnualSettlement,
} from "./types.js";

/** Inputs to compile the structured annual declaration payload. */
export interface AnnualDeclarationInput {
	readonly scope: AnnualScope;
	readonly annualNetIncomeCents: bigint;
	/** The net-income determination input, embedded as the supporting cédula. */
	readonly netIncome: AnnualNetIncomeInput;
	readonly taxableBaseCents: bigint;
	/** The applied statutory rate in basis points (mirrors the ISR policy). */
	readonly rateBp: number;
	readonly settlement: AnnualSettlement;
}

/** Structured annual declaration payload (stable field names and ordering). */
export interface AnnualDeclarationPayload {
	readonly scope: AnnualScope;
	readonly annualNetIncomeCents: bigint;
	readonly taxableBaseCents: bigint;
	readonly annualIsrCents: bigint;
	readonly provisionalCreditCents: bigint;
	readonly balanceCents: bigint;
	readonly balanceKind: AnnualBalanceKind;
	readonly cédulas: {
		readonly netIncome: AnnualNetIncomeInput;
		readonly isr: { readonly taxableBaseCents: bigint; readonly rateBp: number };
		readonly settlement: AnnualSettlement;
	};
}

/** Compile the deterministic annual declaration payload (pure data, no I/O). */
export function buildAnnualDeclaration(
	input: AnnualDeclarationInput,
): AnnualDeclarationPayload {
	const { scope, annualNetIncomeCents, netIncome, taxableBaseCents, rateBp, settlement } =
		input;
	const balanceKind: AnnualBalanceKind = settlement.balanceKind;
	return {
		scope,
		annualNetIncomeCents,
		taxableBaseCents,
		annualIsrCents: settlement.annualIsrCents,
		provisionalCreditCents: settlement.provisionalCreditCents,
		balanceCents: settlement.balanceCents,
		balanceKind,
		cédulas: {
			netIncome,
			isr: { taxableBaseCents, rateBp },
			settlement,
		},
	};
}
