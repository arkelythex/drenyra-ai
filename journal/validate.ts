/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Journal validation (slice 1C-1): BigInt-cent guard, balance, entry binding. */

import {
	TENANT_SCOPE_BRAND,
	sameTenantScope,
	validateTenantScope,
	type TenantScope,
	type ValidatedTenantScope,
} from "../tenant-core/index.js";
import { JOURNAL_ERROR, JOURNAL_SIDE, JournalError } from "./types.js";
import type { AcceptedEvidence } from "../evidence/index.js";
import type { JournalLine, JournalRecordInput } from "./types.js";

/** Revalidates the scope fail-closed and returns a fresh branded copy. */
function validatedScope(input: unknown): ValidatedTenantScope {
	try {
		return validateTenantScope(input);
	} catch {
		throw new JournalError(JOURNAL_ERROR.INVALID_SCOPE, "entry scope must be a validated tenant scope");
	}
}

/** Rejects non-bigint/negative amounts and returns both totals. */
function lineTotals(lines: readonly JournalLine[]): { debits: bigint; credits: bigint } {
	let debits = 0n;
	let credits = 0n;
	for (const line of lines) {
		if (typeof line.amountCents !== "bigint" || line.amountCents < 0n) {
			throw new JournalError(JOURNAL_ERROR.INVALID_AMOUNT, "amounts must be non-negative bigint cents");
		}
		if (line.side === JOURNAL_SIDE.DEBIT) debits += line.amountCents;
		else credits += line.amountCents;
	}
	return { debits, credits };
}

/** Entry binding: at least one accepted evidence artifact in the entry scope. */
function assertEvidenceBound(evidence: readonly AcceptedEvidence[], scope: ValidatedTenantScope): void {
	if (evidence.length === 0) {
		throw new JournalError(JOURNAL_ERROR.MISSING_EVIDENCE, "an entry requires at least one accepted evidence artifact");
	}
	for (const artifact of evidence) {
		const artifactScope = (artifact as { scope?: unknown }).scope;
		if (
			typeof artifactScope !== "object" ||
			artifactScope === null ||
			(artifactScope as { brand?: unknown }).brand !== TENANT_SCOPE_BRAND ||
			!sameTenantScope(artifactScope as TenantScope, scope)
		) {
			throw new JournalError(JOURNAL_ERROR.EVIDENCE_SCOPE_MISMATCH, "evidence must be bound to the entry scope");
		}
	}
}

/** Full record validation; returns the validated scope for the entry. */
export function validateRecord(input: JournalRecordInput): ValidatedTenantScope {
	if (input.lines.length === 0) {
		throw new JournalError(JOURNAL_ERROR.EMPTY_LINES, "an entry requires at least one line");
	}
	const scope = validatedScope(input.scope);
	const { debits, credits } = lineTotals(input.lines);
	if (debits !== credits) {
		throw new JournalError(JOURNAL_ERROR.UNBALANCED, "debit and credit totals must be equal");
	}
	assertEvidenceBound(input.evidence, scope);
	return scope;
}
