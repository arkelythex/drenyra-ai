/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the evidence authority module — two chained units:
 *
 * 1. evidence-identity (evidence/identity): types, error taxonomy, canonical
 *    content-derived identity, and fail-closed provenance shape validation.
 * 2. evidence-authority (evidence/authority): tenant-bound registration,
 *    deep-freeze immutability, scope assertion, and memory/advisory
 *    fail-closed rejection.
 *
 * Reuses the frozen receipt hashing contract (`computeEvidenceHash`,
 * `EvidenceItem`) and the frozen tenant-core scope contract
 * (`ValidatedTenantScope`) via the documented single-definition re-exports.
 * Runtime dependencies: node:crypto only.
 */

export * from "./identity/index.js";
export * from "./authority/index.js";
export * from "./accept.js";
