/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Candidate identity — content-derived, bytes are the source of truth.
 *
 * `computeSubjectHash` hashes the EXACT bytes of the reviewed subject
 * (SHA-256 hex). Strings are encoded as UTF-8. Two candidates with the same
 * subject bytes + scope collide on identity; differing bytes are a different
 * candidate, even under the same scope.
 */

import { createHash } from "node:crypto";
import type { CandidateScope } from "./types.js";

/**
 * SHA-256 hex over the exact subject bytes. For strings the UTF-8 encoding of
 * the string is the byte source; for Uint8Array the bytes are used as-is.
 */
export function computeSubjectHash(subject: Uint8Array | string): string {
  return createHash("sha256").update(subject).digest("hex");
}

/**
 * Canonical candidate identity string:
 *   `${subjectHash}:${scope.ruc}:${scope.period}`
 *
 * Same subject + same scope always collide to the same identity; differing
 * subject bytes (or scope) produce a different identity.
 */
export function candidateIdentity(
  subjectHash: string,
  scope: CandidateScope,
): string {
  return `${subjectHash}:${scope.ruc}:${scope.period}`;
}
