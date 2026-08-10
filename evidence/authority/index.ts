/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the evidence authority unit (unit: evidence-authority).
 *
 * Tenant-bound registration, deep-freeze, scope assertion, and
 * memory/advisory fail-closed rejection. Types, errors, and canonical
 * identity live in the evidence-identity unit (evidence/identity).
 */

export { assertEvidenceInScope, registerEvidence } from "./authority.js";
