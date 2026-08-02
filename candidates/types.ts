/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Candidate protocol types — contract: contracts/candidate.md (v0.1-draft).
 *
 * A candidate is an agent's proposal for a material accounting action, made
 * first-class and reviewable. The lifecycle is:
 *   proposed → inspected → reviewing → accepted | corrected | rejected
 *
 * Identity is content-derived: `subjectHash` is the SHA-256 over the exact
 * reviewed bytes (bytes are the source of truth, never agent intent).
 * Materiality is derived from value (BigInt cents), reversibility, and
 * jurisdiction — never from agent claims.
 */

/** Lifecycle status of a candidate (contract order). */
export type CandidateStatus =
  | "proposed"
  | "inspected"
  | "reviewing"
  | "accepted"
  | "corrected"
  | "rejected";

/** Materiality tier: risk-proportional review depth. */
export type Materiality = "R0" | "R1" | "R2" | "R3";

/** Ordinal of a materiality tier: R0 < R1 < R2 < R3. */
export function orderOf(materiality: Materiality): number {
  switch (materiality) {
    case "R0":
      return 0;
    case "R1":
      return 1;
    case "R2":
      return 2;
    case "R3":
      return 3;
  }
}

/** How reversible the proposed action is, from a fiscal standpoint. */
export type Reversibility =
  | "reversible"
  | "partially-reversible"
  | "irreversible";

/** Fiscal scope of a candidate: RUC + fiscal period. */
export interface CandidateScope {
  /** 11-digit Peruvian RUC (digits only). */
  ruc: string;
  /** Fiscal period as YYYYMM (e.g. "202607"), matching the RED receipt schema. */
  period: string;
}

const RUC_RE = /^\d{11}$/;
const PERIOD_RE = /^\d{6}$/;

/** Shape validation: RUC must be exactly 11 digits. */
export function isValidRuc(ruc: string): boolean {
  return RUC_RE.test(ruc);
}

/** Shape validation: period must be YYYYMM (six digits), per the receipt schema. */
export function isValidPeriod(period: string): boolean {
  return PERIOD_RE.test(period);
}

/** Shape validation for a full scope. */
export function isValidScope(scope: CandidateScope): boolean {
  return isValidRuc(scope.ruc) && isValidPeriod(scope.period);
}

/** Review verdict recorded against a candidate. */
export type CandidateReviewVerdict = "accept" | "reject";

/** A single human review decision appended to the candidate. */
export interface CandidateReview {
  id: string;
  verdict: CandidateReviewVerdict;
  reason?: string;
  reviewer: string;
  reviewedAt: string;
}

/** Lineage record bridging a corrected subject back to its parent. */
export interface CorrectionRecord {
  id: string;
  fromHash: string;
  toHash: string;
  reason: string;
  correctedAt: string;
}

/** Immutable-by-convention candidate snapshot (every transition returns a new one). */
export interface Candidate {
  id: string;
  subjectHash: string;
  scope: CandidateScope;
  materiality: Materiality;
  status: CandidateStatus;
  reviews: CandidateReview[];
  corrections: CorrectionRecord[];
  createdAt: string;
  version: number;
}

/** Inputs for materiality derivation. `value` is whole-number cents as BigInt. */
export interface MaterialityInput {
  value: bigint;
  reversibility: Reversibility;
  jurisdiction: string;
}
