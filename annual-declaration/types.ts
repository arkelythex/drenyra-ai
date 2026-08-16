/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Annual declaration engine — canonical domain types.
 *
 * The deterministic annual tax-settlement engine (cierre fiscal definitivo)
 * shares one contract: money is BigInt cents everywhere, one RUC + one fiscal
 * year (period form YYYY) per operation, every produced journal entry is
 * balanced (sum of debits equals sum of credits), and any input that cannot be
 * processed is rejected fail-closed with a typed `AnnualDeclarationError`.
 * The annual scope is a distinct type (`AnnualScope { ruc, year }`) because the
 * composed `close-calculations` scope is monthly (`YYYYMM`); the two never clash
 * because the annual module exports its own names and aliases the shared entry
 * shape (`AnnualEntry = CloseEntry`) by composition, not by fork.
 */

/** One RUC (11 digits) + one fiscal year ("YYYY"). Distinct from monthly Scope. */
export interface AnnualScope {
	readonly ruc: string;
	readonly year: string; // "2025"
}

/** A monthly period that contributes to the annual net income. */
export interface AnnualMonthInput {
	readonly scope: AnnualScope & { readonly period: string }; // "2025-01".."2025-12"
	readonly closed: boolean; // false => INCOMPLETE_INPUT
	readonly netIncomeCents: bigint; // monthly net income, BigInt cents
}

/** Statutory reconciliation inputs (explicit, never auto-classified). */
export interface AnnualStatutoryAdjustments {
	readonly additionsCents: bigint; // adiciones (non-deductible, disallowed)
	readonly deductionsCents: bigint; // deducciones (allowed extra deductions)
}

export interface AnnualNetIncomeInput {
	readonly scope: AnnualScope;
	readonly months: readonly AnnualMonthInput[];
	readonly adjustments: AnnualStatutoryAdjustments;
}

/** ISR policy — rate is a policy input with a legal-entity default (2950 bp). */
export interface AnnualIsrPolicy {
	readonly statutoryRateBp?: number; // default 2950 (29.5%, LIR legal-entity rate)
	readonly maxStatutoryRateBp?: number; // default 10000 (100%): RATE_OUT_OF_BOUNDS above
}

/** One monthly provisional ISR cédula (pago a cuenta), already determined. */
export interface MonthlyIsrCedula {
	readonly scope: { readonly ruc: string; readonly period: string }; // "2025-01".."2025-12"
	readonly amountCents: bigint;
}

export type AnnualBalanceKind = "payable" | "in-favor" | "zero";

export interface AnnualSettlement {
	readonly scope: AnnualScope;
	readonly annualIsrCents: bigint;
	readonly provisionalCreditCents: bigint; // sum of the twelve monthly cédulas
	readonly balanceCents: bigint; // annualIsr - credit (may be negative => in-favor)
	readonly balanceKind: AnnualBalanceKind;
}

/** Balanced journal entry in the existing journal/ shape (CloseEntry-compatible). */
export type AnnualEntry = import("../close-calculations/index.js").CloseEntry;

export type AnnualDeclarationErrorCode =
	| "INVALID_SCOPE"
	| "CROSS_RUC_ACCESS"
	| "INCOMPLETE_INPUT"
	| "NEGATIVE_AMOUNT"
	| "RATE_OUT_OF_BOUNDS"
	| "UNBALANCED_ENTRY"
	| "ACCOUNT_NOT_IN_CHART";

/** Fail-closed error of the annual declaration engine. */
export class AnnualDeclarationError extends Error {
	readonly code: AnnualDeclarationErrorCode;

	constructor(code: AnnualDeclarationErrorCode, message: string) {
		super(message);
		this.name = "AnnualDeclarationError";
		this.code = code;
	}
}

const RUC_PATTERN = /^\d{11}$/;
const YEAR_PATTERN = /^\d{4}$/;

/**
 * Validate one annual scope (RUC + YYYY year); throws INVALID_SCOPE.
 * Shared by every annual operation that owns a scope check.
 */
export function assertAnnualScope(scope: AnnualScope): void {
	if (!RUC_PATTERN.test(scope.ruc)) {
		throw new AnnualDeclarationError(
			"INVALID_SCOPE",
			`invalid RUC "${scope.ruc}": expected exactly 11 digits`,
		);
	}
	if (!YEAR_PATTERN.test(scope.year)) {
		throw new AnnualDeclarationError(
			"INVALID_SCOPE",
			`invalid fiscal year "${scope.year}": expected YYYY`,
		);
	}
}
