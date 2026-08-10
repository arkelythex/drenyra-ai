/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Evidence authority error taxonomy (unit: evidence-identity) — fail-closed
 * rejection vocabulary.
 *
 * Codes: INVALID_INPUT, INVALID_SCOPE, INVALID_ITEM, MISSING_PROVENANCE,
 * MALFORMED_PROVENANCE, MEMORY_SHAPED, ADVISORY_SHAPED, SCOPE_MISMATCH.
 */

/** Canonical evidence authority error codes. */
export enum EvidenceErrorCode {
	INVALID_INPUT = "INVALID_INPUT",
	INVALID_SCOPE = "INVALID_SCOPE",
	INVALID_ITEM = "INVALID_ITEM",
	MISSING_PROVENANCE = "MISSING_PROVENANCE",
	MALFORMED_PROVENANCE = "MALFORMED_PROVENANCE",
	MEMORY_SHAPED = "MEMORY_SHAPED",
	ADVISORY_SHAPED = "ADVISORY_SHAPED",
	SCOPE_MISMATCH = "SCOPE_MISMATCH",
}

/** Domain error for the evidence authority. */
export class EvidenceError extends Error {
	public readonly code: EvidenceErrorCode;

	constructor(code: EvidenceErrorCode, message?: string) {
		super(message ?? `Evidence error: ${code}`);
		this.name = "EvidenceError";
		this.code = code;
		Object.setPrototypeOf(this, EvidenceError.prototype);
	}
}

/** Type guard: narrows any error to EvidenceError. */
export function isEvidenceError(error: unknown): error is EvidenceError {
	return error instanceof EvidenceError;
}
