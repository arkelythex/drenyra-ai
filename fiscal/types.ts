/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Candidate ordering domain types (1D-1/1D-2): explicit ports and fiscal-flow
 * input/output envelopes. */
import type { AcceptedEvidence } from "../evidence/index.js";
import type { Candidate, MaterialityInput, ProposeInput } from "../candidates/index.js";
import type { ValidatedTenantScope } from "../tenant-core/index.js";

export const FISCAL_ERROR = {
	MISSING_RECONCILIATION_EVIDENCE: "missing-reconciliation-evidence",
	RECONCILIATION_SCOPE_MISMATCH: "reconciliation-scope-mismatch",
} as const;
export type FiscalErrorCode = (typeof FISCAL_ERROR)[keyof typeof FISCAL_ERROR];

export class FiscalError extends Error {
	readonly code: FiscalErrorCode;

	constructor(code: FiscalErrorCode, message: string) {
		super(message);
		this.name = "FiscalError";
		this.code = code;
	}
}

/** Deterministic core validation: throws before any construction. */
export interface CoreValidator<TInput, TValidated> {
	validate(scope: ValidatedTenantScope, input: TInput): TValidated;
}

export interface Reconciler<TValidated> {
	reconcile(scope: ValidatedTenantScope, input: TValidated): readonly AcceptedEvidence[];
}

/** Exact canonical subject construction from validated input + bound evidence. */
export interface FiscalSubjectBuilder<TValidated> {
	build(scope: ValidatedTenantScope, input: TValidated, evidence: readonly AcceptedEvidence[]): Uint8Array;
}

export interface FiscalCandidatePort {
	propose(input: ProposeInput): Candidate;
	inspect(candidate: Candidate, subject: Uint8Array): Candidate;
}

/** Fiscal-flow envelope: explicit scope (validated at runtime) + payload + materiality. */
export interface FiscalFlowInput<TInput> {
	readonly scope: unknown;
	readonly payload: TInput;
	readonly materialityInput: MaterialityInput;
}

export interface FiscalFlowResult<TValidated> {
	readonly scope: ValidatedTenantScope;
	readonly validated: TValidated;
	readonly evidence: readonly AcceptedEvidence[];
	readonly subject: Uint8Array;
	readonly candidate: Candidate;
}
