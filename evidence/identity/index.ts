/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the evidence identity unit (unit: evidence-identity).
 *
 * Types, error taxonomy, fail-closed provenance shape validation, and the
 * canonical content-derived identity. The authority unit (evidence/authority)
 * consumes these to register tenant-bound evidence.
 */

export * from "./errors.js";
export * from "./types.js";
export {
	deriveEvidenceIdentity,
	validateProvenanceShape,
	type EvidenceIdentityInput,
} from "./identity.js";
