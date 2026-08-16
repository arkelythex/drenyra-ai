/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Bank reconciliation — canonical domain types.
 *
 * One canonical movement shape for bank-statement rows and ledger movements,
 * one RUC + fiscal-period scope per operation, sealed difference
 * classifications, deterministic adjustment drafts, and the executive report.
 * Money is BigInt cents everywhere; direction lives in `side`, never in the
 * sign of an amount.
 */

/** ISO-8601 calendar date (YYYY-MM-DD). */
export type IsoDate = string;

/** Effect of a movement on the Bancos (cash) account. */
export type MovementSide = "inflow" | "outflow";

/** Origin of a movement: bank statement or accounting ledger. */
export type MovementSource = "bank" | "ledger";

/** A canonical, source-agnostic movement. */
export interface Movement {
	/** ISO-8601 calendar date (YYYY-MM-DD). */
	date: IsoDate;
	/** Normalized reference: trimmed, internal whitespace collapsed, case-folded. */
	reference: string;
	/** Positive amount in integer cents; never a float, never negative. */
	amountCents: bigint;
	/** Effect on the Bancos account. */
	side: MovementSide;
	/** Origin of the movement. */
	source: MovementSource;
	/** Unique id within its source set (auditability). */
	sourceKey: string;
}

/** One RUC (11 digits) + one fiscal period (YYYYMM) per operation. */
export interface Scope {
	/** SUNAT RUC — exactly 11 digits. */
	ruc: string;
	/** Fiscal period in YYYYMM form. */
	period: string;
}

/** Raw bank-statement row (adapter-shaped input for normalization). */
export interface BankRow {
	/** RUC the row belongs to; must equal the operation scope RUC. */
	ruc: string;
	/** ISO-8601 calendar date (YYYY-MM-DD). */
	date: string;
	/** Raw reference; normalized by `normalizeBankRows`. */
	reference: string;
	/** Amount as a decimal string of integer cents, e.g. "250" or "250.00". */
	amount: string;
	/** Bank side token: deposit or withdrawal. */
	side: "deposit" | "withdrawal";
	/** Unique row id within the statement. */
	sourceKey: string;
}

/** Raw ledger movement row. */
export interface LedgerRow {
	/** RUC the row belongs to; must equal the operation scope RUC. */
	ruc: string;
	/** ISO-8601 calendar date (YYYY-MM-DD). */
	date: string;
	/** Raw reference; normalized by `normalizeLedgerRows`. */
	reference: string;
	/** Amount as a decimal string of integer cents, e.g. "250" or "250.00". */
	amount: string;
	/** Ledger side token: debit or credit. */
	side: "debit" | "credit";
	/** Unique row id within the source set. */
	sourceKey: string;
}

/** Typed reason a row was rejected during normalization. */
export type NormalizationRejectionCode =
	| "NORMALIZATION_REJECTED"
	| "CROSS_RUC_ACCESS"
	| "NEGATIVE_AMOUNT"
	| "FRACTIONAL_CENTS";

/** A row that could not be normalized — fail-closed, never skipped silently. */
export interface NormalizationRejection {
	/** Row identifier (sourceKey) so the rejection is actionable. */
	sourceKey: string;
	/** Typed reason for the rejection. */
	code: NormalizationRejectionCode;
	/** Human-readable detail. */
	detail: string;
}

/** Result of a normalization pass: accepted movements plus typed rejections. */
export interface NormalizeResult {
	movements: readonly Movement[];
	rejected: readonly NormalizationRejection[];
}

/** A bank movement and its single ledger counterpart. */
export interface MatchedPair {
	classification: "matched";
	bank: Movement;
	ledger: Movement;
}

/** A bank movement with no ledger counterpart. */
export interface BankOnlyDifference {
	classification: "bankOnly";
	bank: Movement;
}

/** A ledger movement with no bank counterpart. */
export interface LedgerOnlyDifference {
	classification: "ledgerOnly";
	ledger: Movement;
}

/**
 * An ambiguous reference: more than one counterpart on either side.
 * Surfaced, never guessed — none of the candidates is auto-matched.
 */
export interface ConflictDifference {
	classification: "conflict";
	reference: string;
	bank: readonly Movement[];
	ledger: readonly Movement[];
}

/** Sealed difference classification: every movement ends in exactly one. */
export type Difference =
	| MatchedPair
	| BankOnlyDifference
	| LedgerOnlyDifference
	| ConflictDifference;

/** Full output of a reconciliation pass. */
export interface Reconciliation {
	/** Scope the reconciliation ran under. */
	scope: Scope;
	/** Every movement appears in exactly one classified difference. */
	differences: readonly Difference[];
	/** True when every movement is matched (no bankOnly/ledgerOnly/conflict). */
	fullyMatched: boolean;
}

/** Deterministic adjustment draft derived from a classified difference. */
export interface AdjustmentDraft {
	/** Deterministic draft id, e.g. adj-1. */
	draftId: string;
	/** Originating bank/ledger reference. */
	reference: string;
	/** Origin of the movement that produced the draft. */
	source: MovementSource;
	/** Effect on the Bancos account in integer cents. */
	amountCents: bigint;
	/** Effect direction on the Bancos account. */
	side: MovementSide;
	/** Human-reviewable justification referencing the movement. */
	justification: string;
	/** Whether a human must approve before the draft can be applied. */
	requireApproval: boolean;
	/** Lifecycle state of the draft. */
	status: "draft" | "pending-approval";
}

/** Initial and final balances for the reconciliation identity check. */
export interface ReconciliationBalances {
	bankInitial: bigint;
	bankFinal: bigint;
	ledgerInitial: bigint;
	ledgerFinal: bigint;
}

/** Executive reconciliation report. */
export interface ReconciliationReport {
	scope: Scope;
	balances: ReconciliationBalances;
	differences: readonly Difference[];
	adjustments: readonly AdjustmentDraft[];
	/** Sum of adjustment effects: Σ inflow − Σ outflow, in integer cents. */
	netAdjustmentCents: bigint;
	/**
	 * True only when no unmatched difference exists AND
	 * `ledgerFinal + netAdjustmentCents === bankFinal`. Never claims a
	 * reconciliation it did not achieve.
	 */
	reconciled: boolean;
}

/** Typed error codes for the bank-reconciliation engine. */
export type BankReconciliationErrorCode =
	| "INVALID_SCOPE"
	| "NORMALIZATION_REJECTED"
	| "CROSS_RUC_ACCESS"
	| "NEGATIVE_AMOUNT"
	| "FRACTIONAL_CENTS"
	| "UNCLASSIFIED_DIFFERENCE";

/** Fail-closed error of the bank-reconciliation engine. */
export class BankReconciliationError extends Error {
	constructor(message: string, readonly code: BankReconciliationErrorCode) {
		super(message);
		this.name = "BankReconciliationError";
	}
}

const RUC_PATTERN = /^\d{11}$/;
const PERIOD_PATTERN = /^\d{6}$/;

/**
 * Validate the operation scope: one 11-digit RUC and one YYYYMM fiscal period
 * with a real month. Throws `BankReconciliationError(INVALID_SCOPE)` otherwise.
 */
export function validateScope(scope: Scope): void {
	if (!RUC_PATTERN.test(scope.ruc)) {
		throw new BankReconciliationError(
			`invalid RUC "${scope.ruc}": expected exactly 11 digits`,
			"INVALID_SCOPE",
		);
	}
	if (!PERIOD_PATTERN.test(scope.period)) {
		throw new BankReconciliationError(
			`invalid fiscal period "${scope.period}": expected YYYYMM`,
			"INVALID_SCOPE",
		);
	}
	const month = Number(scope.period.slice(4, 6));
	if (month < 1 || month > 12) {
		throw new BankReconciliationError(
			`invalid fiscal period "${scope.period}": month must be 01-12`,
			"INVALID_SCOPE",
		);
	}
}
