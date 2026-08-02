/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Candidate error taxonomy — candidate protocol domain errors.
 *
 * Codes (per slice-3 scope): INVALID_TRANSITION, SUBJECT_MUTATED,
 * CORRECTION_BUDGET_EXCEEDED, INVALID_SCOPE, MISSING_REASON.
 */

/** Canonical candidate error codes. */
export enum CandidateErrorCode {
  INVALID_TRANSITION = "INVALID_TRANSITION",
  SUBJECT_MUTATED = "SUBJECT_MUTATED",
  CORRECTION_BUDGET_EXCEEDED = "CORRECTION_BUDGET_EXCEEDED",
  INVALID_SCOPE = "INVALID_SCOPE",
  MISSING_REASON = "MISSING_REASON",
}

/** Domain error for the candidate lifecycle. */
export class CandidateError extends Error {
  public readonly code: CandidateErrorCode;

  constructor(code: CandidateErrorCode, message?: string) {
    super(message ?? `Candidate error: ${code}`);
    this.name = "CandidateError";
    this.code = code;
    Object.setPrototypeOf(this, CandidateError.prototype);
  }
}

/** Type guard: narrows any error to CandidateError. */
export function isCandidateError(error: unknown): error is CandidateError {
  return error instanceof CandidateError;
}
