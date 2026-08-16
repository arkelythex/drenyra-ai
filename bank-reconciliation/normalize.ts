/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Bank reconciliation — normalization.
 *
 * Bank-statement rows and ledger movements normalize into one canonical
 * movement shape. Fail-closed: a row that cannot be normalized is `rejected`
 * with a typed reason — never skipped silently, never partially accepted.
 * Reference normalization: trim, collapse internal whitespace, case-fold.
 *
 * Side mapping (deterministic, documented rationale): for the PCGE asset
 * account "Bancos", a debit increases the balance and a credit decreases it.
 * Bank deposit → `inflow`; bank withdrawal → `outflow`; ledger debit →
 * `inflow`; ledger credit → `outflow`. This single canonical frame makes
 * amounts directly comparable across source dialects.
 */

import {
	validateScope,
	type BankRow,
	type LedgerRow,
	type Movement,
	type MovementSide,
	type NormalizeResult,
	type NormalizationRejection,
	type NormalizationRejectionCode,
	type Scope,
} from "./types.js";

const BANK_SIDE: Readonly<Record<string, MovementSide>> = {
	deposit: "inflow",
	withdrawal: "outflow",
};

const LEDGER_SIDE: Readonly<Record<string, MovementSide>> = {
	debit: "inflow",
	credit: "outflow",
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_PATTERN = /^-?\d+(?:\.\d+)?$/;

/** Normalize a bank statement into canonical movements. */
export function normalizeBankRows(scope: Scope, rows: readonly BankRow[]): NormalizeResult {
	validateScope(scope);
	return normalizeRows(scope, rows, "bank", BANK_SIDE);
}

/** Normalize ledger movements into canonical movements. */
export function normalizeLedgerRows(scope: Scope, rows: readonly LedgerRow[]): NormalizeResult {
	validateScope(scope);
	return normalizeRows(scope, rows, "ledger", LEDGER_SIDE);
}

interface ParsedRow {
	ruc: string;
	date: string;
	reference: string;
	amount: string;
	side: string;
	sourceKey: string;
}

function normalizeRows(
	scope: Scope,
	rows: readonly ParsedRow[],
	source: Movement["source"],
	sideByToken: Readonly<Record<string, MovementSide>>,
): NormalizeResult {
	const movements: Movement[] = [];
	const rejected: NormalizationRejection[] = [];
	const seenSourceKeys = new Set<string>();

	for (const row of rows) {
		if (row.ruc !== scope.ruc) {
			rejected.push({
				sourceKey: row.sourceKey,
				code: "CROSS_RUC_ACCESS",
				detail: `row RUC "${row.ruc}" is outside scope RUC "${scope.ruc}"`,
			});
			continue;
		}

		const dateError = validateDate(row.date);
		if (dateError !== undefined) {
			rejected.push({ sourceKey: row.sourceKey, code: "NORMALIZATION_REJECTED", detail: dateError });
			continue;
		}

		const reference = normalizeReference(row.reference);
		if (reference.length === 0) {
			rejected.push({
				sourceKey: row.sourceKey,
				code: "NORMALIZATION_REJECTED",
				detail: "reference is empty after normalization",
			});
			continue;
		}

		const amount = parseAmountCents(row.amount);
		if (!amount.ok) {
			rejected.push({
				sourceKey: row.sourceKey,
				code: amount.code,
				detail: amount.detail,
			});
			continue;
		}

		const side = sideByToken[row.side];
		if (side === undefined) {
			rejected.push({
				sourceKey: row.sourceKey,
				code: "NORMALIZATION_REJECTED",
				detail: `unknown side token "${row.side}"`,
			});
			continue;
		}

		if (row.sourceKey.length === 0) {
			rejected.push({
				sourceKey: row.sourceKey,
				code: "NORMALIZATION_REJECTED",
				detail: "sourceKey is empty; every row needs a unique id within its source set",
			});
			continue;
		}

		if (seenSourceKeys.has(row.sourceKey)) {
			rejected.push({
				sourceKey: row.sourceKey,
				code: "NORMALIZATION_REJECTED",
				detail: `duplicate sourceKey "${row.sourceKey}" within the same source set`,
			});
			continue;
		}
		seenSourceKeys.add(row.sourceKey);

		movements.push({
			date: row.date,
			reference,
			amountCents: amount.cents,
			side,
			source,
			sourceKey: row.sourceKey,
		});
	}

	return { movements, rejected };
}

/** Trim, collapse internal whitespace, and case-fold a reference. */
export function normalizeReference(reference: string): string {
	return reference.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Real calendar date check for YYYY-MM-DD. */
function validateDate(value: string): string | undefined {
	if (!ISO_DATE_PATTERN.test(value)) {
		return `date "${value}" is not YYYY-MM-DD`;
	}
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return `date "${value}" is not a real calendar date`;
	}
	return undefined;
}

type AmountParse =
	| { ok: true; cents: bigint }
	| { ok: false; code: NormalizationRejectionCode; detail: string };

/** Parse a decimal string of integer cents into a positive BigInt. */
function parseAmountCents(raw: string): AmountParse {
	const amount = raw.trim();
	if (!AMOUNT_PATTERN.test(amount)) {
		return {
			ok: false,
			code: "NORMALIZATION_REJECTED",
			detail: `amount "${raw}" is not a decimal string of cents`,
		};
	}
	if (amount.startsWith("-")) {
		return {
			ok: false,
			code: "NEGATIVE_AMOUNT",
			detail: `amount "${raw}" is negative; direction must live in side`,
		};
	}
	const [whole, fraction = ""] = amount.split(".");
	const fractionalDigits = fraction.replace(/0+$/, "");
	if (fractionalDigits.length > 0) {
		return {
			ok: false,
			code: "FRACTIONAL_CENTS",
			detail: `amount "${raw}" has fractional cents; only integer cents are allowed`,
		};
	}
	const cents = BigInt(whole);
	if (cents <= 0n) {
		return {
			ok: false,
			code: "NORMALIZATION_REJECTED",
			detail: `amount "${raw}" must be a positive integer of cents`,
		};
	}
	return { ok: true, cents };
}
