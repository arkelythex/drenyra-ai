/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * IGV determination engine — canonical domain types.
 *
 * Deterministic monthly IGV (Impuesto General a las Ventas, TUO — D.S.
 * 055-99-EF) determination for one RUC + one fiscal period: débito fiscal
 * (output tax on taxable sales), crédito fiscal (input tax on eligible
 * purchases, TUO IGV Arts. 18-19), and the net position (`payable` /
 * `in-favor` / `zero`), mirroring the three-way `AnnualBalanceKind` shape
 * used by `annual-declaration/types.ts`. Money is BigInt cents everywhere;
 * the rate is a validated policy input in basis points, never a hardcoded
 * magic number. Any input that cannot be processed is rejected fail-closed
 * with a typed `IgvError`; a purchase line that fails a formal or
 * substantial validity check is excluded from the credit and reported as a
 * typed exception, never silently dropped.
 */

/** One RUC (11 digits) + one fiscal period (YYYYMM) per operation. */
export interface Scope {
	/** SUNAT RUC — exactly 11 digits. */
	readonly ruc: string;
	/** Fiscal period in YYYYMM form. */
	readonly period: string;
}

/**
 * One taxable-sales invoice line contributing to débito fiscal.
 * `taxable: false` marks an exempt/inafecto line: it is a real invoice line
 * (still fail-closed validated) but excluded from the taxable base — this
 * engine does not encode the full exemption schedule, only the flag.
 */
export interface SalesLine {
	/** Stable line id (comprobante/line reference) for auditability. */
	readonly id: string;
	/** RUC the line belongs to; must equal the operation scope RUC. */
	readonly ruc: string;
	/** Invoice base amount in integer cents, before IGV; must be positive. */
	readonly baseCents: bigint;
	/** False = exempt/inafecto — excluded from the taxable base. */
	readonly taxable: boolean;
}

/**
 * One purchase invoice line contributing to crédito fiscal, subject to the
 * TUO IGV Arts. 18-19 formal/substantial validity checks: `validComprobante`
 * (Art. 19 — the comprobante is not annulled/voided) and
 * `destinedToTaxedOperation` (Art. 18 — destined to a taxed or exported
 * operation). A line failing either check is excluded from the credit and
 * reported as a typed exception, never silently dropped.
 */
export interface PurchaseLine {
	/** Stable line id (comprobante/line reference) for auditability. */
	readonly id: string;
	/** RUC the line belongs to; must equal the operation scope RUC. */
	readonly ruc: string;
	/** Invoice base amount in integer cents, before IGV; must be positive. */
	readonly baseCents: bigint;
	/** TUO IGV Art. 19 formal requirement: comprobante not annulled/voided. */
	readonly validComprobante: boolean;
	/** TUO IGV Art. 18 substantial requirement: destined to a taxed/exported operation. */
	readonly destinedToTaxedOperation: boolean;
}

/** IGV rate policy: basis points, with the 18% combined-rate default. */
export interface IgvPolicy {
	/** IGV rate in basis points; defaults to `DEFAULT_IGV_RATE_BP` (1800 = 18%). */
	readonly rateBp?: number;
	/** Legal envelope ceiling in basis points; defaults to `DEFAULT_MAX_IGV_RATE_BP`. */
	readonly maxRateBp?: number;
}

/** Default standard combined IGV rate (TUO IGV): 18% = 1800 basis points. */
export const DEFAULT_IGV_RATE_BP = 1800;

/** Default legal envelope ceiling: 100% = 10000 basis points. */
export const DEFAULT_MAX_IGV_RATE_BP = 10000;

/** Net IGV position kind; mirrors `AnnualBalanceKind` (annual-declaration/types.ts). */
export type IgvNetPositionKind = "payable" | "in-favor" | "zero";

/** Typed reason a purchase line's crédito fiscal was excluded. */
export type CreditExceptionCode =
	| "INVALID_COMPROBANTE"
	| "NOT_DESTINED_TO_TAXED_OPERATION";

/** A purchase line excluded from crédito fiscal — reported, never dropped. */
export interface CreditException {
	readonly lineId: string;
	readonly code: CreditExceptionCode;
	readonly detail: string;
}

/** Result of a débito/crédito determination for one RUC + fiscal period. */
export interface IgvDetermination {
	readonly scope: Scope;
	/** Output tax: sum of IGV over taxable sales lines. */
	readonly debitoFiscalCents: bigint;
	/** Input tax: sum of IGV over eligible purchase lines (Arts. 18-19). */
	readonly creditoFiscalCents: bigint;
	/** débito - crédito; negative means a saldo a favor (credit balance). */
	readonly netPositionCents: bigint;
	readonly netPositionKind: IgvNetPositionKind;
	/** Purchase lines excluded from the credit, with their typed reason. */
	readonly excludedCreditLines: readonly CreditException[];
	/** The IGV rate actually applied, in basis points. */
	readonly rateBp: number;
}

/** Fail-closed error codes of the IGV determination engine. */
export type IgvErrorCode =
	| "INVALID_SCOPE"
	| "CROSS_RUC_ACCESS"
	| "NEGATIVE_AMOUNT"
	| "MISSING_FIELD"
	| "RATE_OUT_OF_BOUNDS"
	| "INCONSISTENT_DETERMINATION";

/** Fail-closed error of the IGV determination engine. */
export class IgvError extends Error {
	readonly code: IgvErrorCode;

	constructor(message: string, code: IgvErrorCode) {
		super(message);
		this.name = "IgvError";
		this.code = code;
	}
}

const RUC_PATTERN = /^\d{11}$/;
const PERIOD_PATTERN = /^\d{6}$/;

/** Validate one 11-digit RUC + one YYYYMM period; throws INVALID_SCOPE. */
export function validateScope(scope: Scope): void {
	if (!RUC_PATTERN.test(scope.ruc)) {
		throw new IgvError(
			`invalid RUC "${scope.ruc}": expected exactly 11 digits`,
			"INVALID_SCOPE",
		);
	}
	if (!PERIOD_PATTERN.test(scope.period)) {
		throw new IgvError(
			`invalid fiscal period "${scope.period}": expected YYYYMM`,
			"INVALID_SCOPE",
		);
	}
	const month = Number(scope.period.slice(4, 6));
	if (month < 1 || month > 12) {
		throw new IgvError(
			`invalid fiscal period "${scope.period}": month must be 01-12`,
			"INVALID_SCOPE",
		);
	}
}

/** Throw RATE_OUT_OF_BOUNDS when a policy rate leaves the legal envelope (0, maxBp]. */
export function assertRateInBounds(
	bp: number,
	maxBp: number,
	label: string,
): void {
	if (!Number.isInteger(bp) || bp <= 0 || bp > maxBp) {
		throw new IgvError(
			`${label} rate ${bp} bp is outside the legal envelope (0, ${maxBp}]`,
			"RATE_OUT_OF_BOUNDS",
		);
	}
}

/**
 * Shared fail-closed well-formedness check for a sales/purchase line: a
 * present non-empty id, the line's RUC equal to the operation scope RUC
 * (tenant isolation — cross-RUC access is rejected, never ignored), and a
 * strictly positive base amount. Never silently coerces a negative, zero, or
 * missing value.
 */
export function assertWellFormedLine(
	scope: Scope,
	line: { readonly id: string; readonly ruc: string; readonly baseCents: bigint },
	label: string,
): void {
	if (!line.id || line.id.trim().length === 0) {
		throw new IgvError(`${label}: line id is required`, "MISSING_FIELD");
	}
	if (line.ruc !== scope.ruc) {
		throw new IgvError(
			`${label} "${line.id}": RUC "${line.ruc}" is outside the operation scope "${scope.ruc}"`,
			"CROSS_RUC_ACCESS",
		);
	}
	if (line.baseCents <= 0n) {
		throw new IgvError(
			`${label} "${line.id}": baseCents must be positive`,
			"NEGATIVE_AMOUNT",
		);
	}
}
