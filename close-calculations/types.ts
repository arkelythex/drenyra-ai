/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Monthly close calculations — canonical domain types.
 *
 * The deterministic close engine (fixed-asset depreciation, provisions,
 * provisional ISR, closing entries, post-close report) shares one contract:
 * money is BigInt cents everywhere, one RUC + one YYYYMM fiscal period per
 * operation, every produced entry is balanced (sum of debits equals sum of
 * credits), and any input that cannot be processed is rejected fail-closed with
 * a typed `CloseError`. Journal-shape conformance (sides, BigInt-cent amounts,
 * balanced identity) is enforced by the shared `assertBalanced` invariant that
 * every producer runs before emitting an entry.
 */

/** ISO-8601 calendar date (YYYY-MM-DD). Kept module-private so the root package
 * barrel stays unambiguous: `skills/types.ts` already exports `IsoDate`. */
type IsoDate = string;

/** One journal side, aligned to the existing journal/ shape. */
export const CLOSE_SIDE = { DEBIT: "debit", CREDIT: "credit" } as const;
export type CloseSide = (typeof CLOSE_SIDE)[keyof typeof CLOSE_SIDE];

/** One RUC (11 digits) + one fiscal period (YYYYMM) per operation. */
export interface Scope {
	/** SUNAT RUC — exactly 11 digits. */
	ruc: string;
	/** Fiscal period in YYYYMM form. */
	period: string;
}

/** A fixed asset from the register; cost is integer cents, never a float. */
export interface FixedAsset {
	/** Stable asset id (sourceKey for auditability). */
	id: string;
	description: string;
	/** Original cost in integer cents; must be > 0. */
	costBasisCents: bigint;
	/** Annual depreciation rate in basis points (LIR-validated policy input). */
	annualRateBp: number;
	/** ISO-8601 calendar date (YYYY-MM-DD), carried for auditability. */
	acquisitionDate: IsoDate;
}

/** Depreciation policy: the PCGE chart plus the two post accounts. */
export interface DepreciationPolicy {
	/** Valid PCGE account codes (e.g. 391, 681). */
	chart: ReadonlySet<string>;
	/** Depreciation expense account (e.g. "681"). */
	depreciationExpenseAccount: string;
	/** Accumulated depreciation account (e.g. "391"). */
	accumulatedDepreciationAccount: string;
}

/** Provision input kinds. */
export const PROVISION_KIND = {
	RECEIVABLE: "receivable",
	INVENTORY: "inventory",
} as const;
export type ProvisionKind = (typeof PROVISION_KIND)[keyof typeof PROVISION_KIND];

/** A provision input: past-due receivable or inventory exposure at risk. */
export interface ProvisionInput {
	id: string;
	/** Receivables: days past due; inventory: holding days. Must be >= 0. */
	agingDays: number;
	/** Exposure at risk in integer cents; must be > 0. */
	exposureCents: bigint;
	/** Provision rate in basis points (LIR-validated policy input). */
	provisionRateBp: number;
	kind: ProvisionKind;
}

/** Provision policy: the PCGE chart plus the two post accounts. */
export interface ProvisionPolicy {
	chart: ReadonlySet<string>;
	/** Provision expense account (e.g. "685"). */
	provisionExpenseAccount: string;
	/** Provision liability / allowance account (e.g. "195"). */
	provisionLiabilityAccount: string;
}

/** LIR Art. 85 rule selectors for the provisional ISR pago a cuenta. */
export const ISR_RULE = {
	COEFICIENTE: "coeficiente",
	PCT_INGRESOS: "pct-ingresos",
	GREATER_OF: "greater-of",
} as const;
export type IsrRule = (typeof ISR_RULE)[keyof typeof ISR_RULE];

/** Provisional ISR (pago a cuenta) input per LIR Art. 85. */
export interface ProvisionalIsrInput {
	id: string;
	/** Month's net income (ingresos netos) in cents — base of the coefficient path. */
	netIncomeCents: bigint;
	/** Coeficiente (prior-year impuesto/ingresos ratio) in basis points; null = no prior-year. */
	priorYearRatioBp: number | null;
	/** Month's net income in cents — base of the statutory-minimum percentage path. */
	monthlyNetIncomeCents: bigint;
	/** Which LIR Art. 85 rule to apply. */
	rule: IsrRule;
}

/** ISR policy: the PCGE chart, both post accounts, and the statutory minimum. */
export interface IsrPolicy {
	chart: ReadonlySet<string>;
	/** ISR expense account (e.g. "881"). */
	isrExpenseAccount: string;
	/** ISR payable account (e.g. "4017"). */
	isrPayableAccount: string;
	/** Statutory minimum percentage in basis points (LIR Art. 85: 1.5% = 150 bp). */
	statutoryMinimumBp: number;
}

/** Close entry kinds produced by the engine. */
export const CLOSE_KIND = {
	DEPRECIATION: "depreciation",
	PROVISION: "provision",
	ISR: "isr",
	CLOSING: "closing",
} as const;
export type CloseKind = (typeof CLOSE_KIND)[keyof typeof CLOSE_KIND];

/** One journal line, aligned to the existing journal/ shape. */
export interface CloseLine {
	/** PCGE account code, validated against the configured chart. */
	accountCode: string;
	side: CloseSide;
	/** Positive amount in integer cents. */
	amountCents: bigint;
}

/** A balanced journal entry produced by the close engine. */
export interface CloseEntry {
	/** Deterministic entry id, e.g. "depr-1", "prov-1", "isr-1", "close-1". */
	id: string;
	/** The single RUC + fiscal-period scope the entry carries. */
	scope: Scope;
	/** Lines; invariant: sum(debit) === sum(credit). */
	lines: readonly CloseLine[];
	kind: CloseKind;
}

/** Provisional ISR cédula: both LIR Art. 85 paths and the applied amount. */
export interface IsrCedula {
	coefficientPathCents: bigint;
	pctPathCents: bigint;
	appliedCents: bigint;
}

/** A period result-account balance; the sign gives the closing direction. */
export interface ResultBalance {
	/** PCGE result account (e.g. 12/13/14) to close into retained earnings. */
	accountCode: string;
	/** > 0 = debit balance (expense/loss); < 0 = credit balance (revenue/gain); 0 = skip. */
	balanceCents: bigint;
}

/** Post-close report: entries, trial-balance identity, ISR cédula, movement. */
export interface CloseReport {
	scope: Scope;
	entries: readonly CloseEntry[];
	/** True whenever a report is emitted: an identity violation is a hard error. */
	trialBalanceBalanced: boolean;
	isrCedula: IsrCedula;
	/** Retained earnings (PCGE 59) balance before vs after the close. */
	balanceMovement: {
		beforeCents: bigint;
		afterCents: bigint;
	};
}

/** Fail-closed error codes of the close engine. */
export type CloseErrorCode =
	| "INVALID_SCOPE"
	| "NEGATIVE_AMOUNT"
	| "UNBALANCED_ENTRY"
	| "RATE_OUT_OF_BOUNDS"
	| "UNCLASSIFIABLE_INPUT"
	| "ACCOUNT_NOT_IN_CHART";

/** Fail-closed error of the close engine. */
export class CloseError extends Error {
	readonly code: CloseErrorCode;

	constructor(message: string, code: CloseErrorCode) {
		super(message);
		this.name = "CloseError";
		this.code = code;
	}
}

/** Upper bound of the rate envelope: 100% annual = 10,000 basis points. */
export const MAX_RATE_BP = 10000;

/** PCGE retained-earnings account the closing entries move results into. */
export const RETAINED_EARNINGS_ACCOUNT = "59";

const RUC_PATTERN = /^\d{11}$/;
const PERIOD_PATTERN = /^\d{6}$/;

/** Validate one 11-digit RUC + one YYYYMM period; throws INVALID_SCOPE. */
export function validateScope(scope: Scope): void {
	if (!RUC_PATTERN.test(scope.ruc)) {
		throw new CloseError(
			`invalid RUC "${scope.ruc}": expected exactly 11 digits`,
			"INVALID_SCOPE",
		);
	}
	if (!PERIOD_PATTERN.test(scope.period)) {
		throw new CloseError(
			`invalid fiscal period "${scope.period}": expected YYYYMM`,
			"INVALID_SCOPE",
		);
	}
	const month = Number(scope.period.slice(4, 6));
	if (month < 1 || month > 12) {
		throw new CloseError(
			`invalid fiscal period "${scope.period}": month must be 01-12`,
			"INVALID_SCOPE",
		);
	}
}

/** Throw ACCOUNT_NOT_IN_CHART when the account is absent from the PCGE chart. */
export function assertChartAccount(
	chart: ReadonlySet<string>,
	accountCode: string,
): void {
	if (!chart.has(accountCode)) {
		throw new CloseError(
			`account "${accountCode}" is not in the configured PCGE chart`,
			"ACCOUNT_NOT_IN_CHART",
		);
	}
}

/** Throw RATE_OUT_OF_BOUNDS when a policy rate leaves the legal envelope (0, 100%]. */
export function assertRateInBounds(bp: number, label: string): void {
	if (!Number.isInteger(bp) || bp <= 0 || bp > MAX_RATE_BP) {
		throw new CloseError(
			`${label} rate ${bp} bp is outside the legal envelope (0, ${MAX_RATE_BP}]`,
			"RATE_OUT_OF_BOUNDS",
		);
	}
}

/**
 * Balanced-entry invariant: every produced entry MUST satisfy
 * sum(debits) === sum(credits), every line side MUST be debit|credit, and every
 * amount MUST be positive integer cents. This shared check runs on every entry
 * the engine emits; an unbalanced or malformed draft is a hard typed error,
 * never a silent posting.
 */
export function assertBalanced(entry: CloseEntry): void {
	let debits = 0n;
	let credits = 0n;
	for (const line of entry.lines) {
		if (line.side !== "debit" && line.side !== "credit") {
			throw new CloseError(
				`entry "${entry.id}": line side "${String(line.side)}" is not debit or credit`,
				"UNCLASSIFIABLE_INPUT",
			);
		}
		if (line.amountCents <= 0n) {
			throw new CloseError(
				`entry "${entry.id}": line amountCents must be positive`,
				"NEGATIVE_AMOUNT",
			);
		}
		if (line.side === "debit") {
			debits += line.amountCents;
		} else {
			credits += line.amountCents;
		}
	}
	if (debits !== credits) {
		throw new CloseError(
			`entry "${entry.id}": sum(debits) ${debits} !== sum(credits) ${credits}`,
			"UNBALANCED_ENTRY",
		);
	}
}
