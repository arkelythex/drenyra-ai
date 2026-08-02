/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * CandidateLifecycle — state machine for candidate identity + proportional
 * review, informed by @drenyra/domain ExactCandidate but shaped to the
 * contracts/candidate.md protocol:
 *
 *   proposed --inspect--> inspected --submitForReview--> reviewing
 *   reviewing --accept--> accepted
 *   reviewing --reject--> rejected
 *   reviewing --correct--> corrected --inspect--> inspected  (AT MOST ONCE)
 *
 * Design decisions (documented):
 * - Every transition returns a NEW immutable Candidate; the input is never
 *   mutated, and every state change bumps `version` (propose starts at 1).
 * - `inspect` revalidates identity by recomputing the subject hash over the
 *   provided subject bytes; a mismatch throws SUBJECT_MUTATED. Because the
 *   Candidate type carries only the hash, the bytes are passed in at
 *   inspection time (the CLI does the same with --subject files).
 * - `correct` sets status to "corrected" (not "proposed") so the corrected
 *   subject is an observable state that MUST pass re-inspection before it can
 *   be reviewed again (fail-closed). The correction budget is AT MOST ONE per
 *   candidate; a second `correct` throws CORRECTION_BUDGET_EXCEEDED.
 * - A corrected subject produces a new canonical identity (subjectHash
 *   changed); the CorrectionRecord preserves lineage fromHash → toHash.
 * - `reject` requires a reason (MISSING_REASON otherwise); `accept` makes the
 *   reason optional.
 */

import { randomUUID } from "node:crypto";
import { CandidateError, CandidateErrorCode } from "./errors.js";
import { candidateIdentity, computeSubjectHash } from "./identity.js";
import { deriveMateriality } from "./materiality.js";
import {
  isValidScope,
  type Candidate,
  type CandidateReview,
  type CandidateScope,
  type CandidateStatus,
  type CorrectionRecord,
  type MaterialityInput,
} from "./types.js";

function generateId(): string {
  return randomUUID();
}

function nowTimestamp(): string {
  return new Date().toISOString();
}

/** Inputs for propose(). */
export interface ProposeInput {
  /** Subject bytes or a string (UTF-8 encoded) that become the reviewed subject. */
  subject: Uint8Array | string;
  scope: CandidateScope;
  materialityInput: MaterialityInput;
}

/** Review decision for accept(): reason is optional. */
export interface ReviewDecision {
  reviewer: string;
  reason?: string;
}

/** Review decision for reject(): reason is REQUIRED. */
export interface ReviewRejection {
  reviewer: string;
  reason: string;
}

/** Inputs for correct(). */
export interface CorrectionInput {
  subject: Uint8Array | string;
  reason: string;
}

/** Pure, immutable candidate lifecycle. */
export class CandidateLifecycle {
  /**
   * Create a candidate: derive subjectHash over the exact bytes, derive
   * materiality from the BigInt-cents input, status "proposed", version 1.
   */
  propose(input: ProposeInput): Candidate {
    if (!isValidScope(input.scope)) {
      throw new CandidateError(
        CandidateErrorCode.INVALID_SCOPE,
        `Invalid scope: ruc must be 11 digits (got "${input.scope.ruc}"), period must be YYYYMM (got "${input.scope.period}")`,
      );
    }
    const subjectHash = computeSubjectHash(input.subject);
    const materiality = deriveMateriality(input.materialityInput);
    return {
      id: candidateIdentity(subjectHash, input.scope),
      subjectHash,
      scope: { ...input.scope },
      materiality,
      status: "proposed",
      reviews: [],
      corrections: [],
      createdAt: nowTimestamp(),
      version: 1,
    };
  }

  /**
   * proposed | corrected → inspected. Revalidates identity: recomputes the
   * subject hash over the given bytes and compares to the frozen hash; a
   * mismatch throws SUBJECT_MUTATED.
   */
  inspect(candidate: Candidate, subject: Uint8Array | string): Candidate {
    this.requireStatus(
      candidate,
      new Set<CandidateStatus>(["proposed", "corrected"]),
      "inspect",
    );
    const recomputed = computeSubjectHash(subject);
    if (recomputed !== candidate.subjectHash) {
      throw new CandidateError(
        CandidateErrorCode.SUBJECT_MUTATED,
        `Subject bytes mutated: expected ${candidate.subjectHash}, recomputed ${recomputed}`,
      );
    }
    return this.withStatus(candidate, "inspected");
  }

  /** inspected → reviewing. */
  submitForReview(candidate: Candidate): Candidate {
    this.requireStatus(
      candidate,
      new Set<CandidateStatus>(["inspected"]),
      "submitForReview",
    );
    return this.withStatus(candidate, "reviewing");
  }

  /** reviewing → accepted; appends a CandidateReview with verdict "accept". */
  accept(candidate: Candidate, review: ReviewDecision): Candidate {
    this.requireStatus(
      candidate,
      new Set<CandidateStatus>(["reviewing"]),
      "accept",
    );
    const record: CandidateReview = {
      id: generateId(),
      verdict: "accept",
      reason: review.reason,
      reviewer: review.reviewer,
      reviewedAt: nowTimestamp(),
    };
    return {
      ...this.withStatus(candidate, "accepted"),
      reviews: [...candidate.reviews, record],
    };
  }

  /** reviewing → rejected; appends a CandidateReview with verdict "reject". */
  reject(candidate: Candidate, review: ReviewRejection): Candidate {
    this.requireStatus(
      candidate,
      new Set<CandidateStatus>(["reviewing"]),
      "reject",
    );
    if (review.reason.trim() === "") {
      throw new CandidateError(
        CandidateErrorCode.MISSING_REASON,
        "Rejecting a candidate requires a non-empty reason",
      );
    }
    const record: CandidateReview = {
      id: generateId(),
      verdict: "reject",
      reason: review.reason,
      reviewer: review.reviewer,
      reviewedAt: nowTimestamp(),
    };
    return {
      ...this.withStatus(candidate, "rejected"),
      reviews: [...candidate.reviews, record],
    };
  }

  /**
   * reviewing → corrected, AT MOST ONCE per candidate. Recomputes the subject
   * hash, appends a CorrectionRecord (fromHash → toHash lineage), and returns
   * the candidate in "corrected" state so the new subject must be re-inspected
   * before further review. A second correction throws
   * CORRECTION_BUDGET_EXCEEDED.
   */
  correct(candidate: Candidate, input: CorrectionInput): Candidate {
    this.requireStatus(
      candidate,
      new Set<CandidateStatus>(["reviewing"]),
      "correct",
    );
    if (candidate.corrections.length > 0) {
      throw new CandidateError(
        CandidateErrorCode.CORRECTION_BUDGET_EXCEEDED,
        "A candidate permits at most one scoped correction",
      );
    }
    const toHash = computeSubjectHash(input.subject);
    const record: CorrectionRecord = {
      id: generateId(),
      fromHash: candidate.subjectHash,
      toHash,
      reason: input.reason,
      correctedAt: nowTimestamp(),
    };
    return {
      ...candidate,
      // New subject bytes → new canonical identity; lineage kept in corrections.
      id: candidateIdentity(toHash, candidate.scope),
      subjectHash: toHash,
      status: "corrected",
      version: candidate.version + 1,
      corrections: [...candidate.corrections, record],
    };
  }

  private withStatus(candidate: Candidate, status: CandidateStatus): Candidate {
    return { ...candidate, status, version: candidate.version + 1 };
  }

  private requireStatus(
    candidate: Candidate,
    allowed: ReadonlySet<CandidateStatus>,
    action: string,
  ): void {
    if (!allowed.has(candidate.status)) {
      throw new CandidateError(
        CandidateErrorCode.INVALID_TRANSITION,
        `Cannot ${action} a candidate in "${candidate.status}" state`,
      );
    }
  }
}
