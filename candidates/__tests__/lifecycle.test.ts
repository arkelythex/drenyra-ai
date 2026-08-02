/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Lifecycle tests — full happy path, reject path, corrected path
 * (reviewing → corrected → re-inspect → reviewing → accepted), the one-shot
 * correction budget, SUBJECT_MUTATED on modified bytes, invalid transitions,
 * version bumps on every change, and MISSING_REASON on reason-less rejection.
 */

import { describe, expect, it } from "vitest";
import { CandidateLifecycle } from "../lifecycle.js";
import { CandidateError, CandidateErrorCode } from "../errors.js";
import { computeSubjectHash } from "../identity.js";
import type {
  Candidate,
  MaterialityInput,
  Reversibility,
} from "../types.js";

const SCOPE = { ruc: "20123456789", period: "202607" };

function materialityInput(
  value: bigint,
  reversibility: Reversibility = "reversible",
  jurisdiction = "PE",
): MaterialityInput {
  return { value, reversibility, jurisdiction };
}

function propose(
  lifecycle: CandidateLifecycle,
  subject: string | Uint8Array = "hello",
  scope = SCOPE,
): Candidate {
  return lifecycle.propose({
    subject,
    scope,
    materialityInput: materialityInput(5000n),
  });
}

function expectCandidateError(
  fn: () => unknown,
  code: CandidateErrorCode,
): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(CandidateError);
  expect((thrown as CandidateError).code).toBe(code);
}

describe("propose", () => {
  it("creates a proposed candidate at version 1 with derived identity and materiality", () => {
    const lifecycle = new CandidateLifecycle();
    const candidate = propose(lifecycle);
    expect(candidate.status).toBe("proposed");
    expect(candidate.version).toBe(1);
    expect(candidate.subjectHash).toBe(computeSubjectHash("hello"));
    expect(candidate.materiality).toBe("R1");
    expect(candidate.reviews).toHaveLength(0);
    expect(candidate.corrections).toHaveLength(0);
    expect(candidate.id).toBe(
      `${candidate.subjectHash}:20123456789:202607`,
    );
  });

  it("rejects malformed scopes with INVALID_SCOPE", () => {
    const lifecycle = new CandidateLifecycle();
    expectCandidateError(
      () =>
        lifecycle.propose({
          subject: "hello",
          scope: { ruc: "123", period: "202607" },
          materialityInput: materialityInput(5000n),
        }),
      CandidateErrorCode.INVALID_SCOPE,
    );
    expectCandidateError(
      () =>
        lifecycle.propose({
          subject: "hello",
          scope: { ruc: "20123456789", period: "2026-13" },
          materialityInput: materialityInput(5000n),
        }),
      CandidateErrorCode.INVALID_SCOPE,
    );
  });
});

describe("happy path: proposed → inspected → reviewing → accepted", () => {
  it("accepts with an optional reason and bumps the version every step", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle);
    expect(candidate.version).toBe(1);

    candidate = lifecycle.inspect(candidate, "hello");
    expect(candidate.status).toBe("inspected");
    expect(candidate.version).toBe(2);

    candidate = lifecycle.submitForReview(candidate);
    expect(candidate.status).toBe("reviewing");
    expect(candidate.version).toBe(3);

    candidate = lifecycle.accept(candidate, {
      reviewer: "professional-1",
      reason: "Matches policy",
    });
    expect(candidate.status).toBe("accepted");
    expect(candidate.version).toBe(4);
    expect(candidate.reviews).toHaveLength(1);
    expect(candidate.reviews[0].verdict).toBe("accept");
    expect(candidate.reviews[0].reviewer).toBe("professional-1");
    expect(candidate.reviews[0].reason).toBe("Matches policy");
  });

  it("accepts without a reason", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle);
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    const accepted = lifecycle.accept(candidate, { reviewer: "professional-1" });
    expect(accepted.status).toBe("accepted");
    expect(accepted.reviews[0].reason).toBeUndefined();
  });

  it("keeps the input candidate immutable", () => {
    const lifecycle = new CandidateLifecycle();
    const original = propose(lifecycle);
    const inspected = lifecycle.inspect(original, "hello");
    expect(original.status).toBe("proposed");
    expect(inspected.status).toBe("inspected");
  });
});

describe("reject path", () => {
  it("rejects with a required reason and records the verdict", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle);
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    const rejected = lifecycle.reject(candidate, {
      reviewer: "professional-1",
      reason: "Scope drift: subject does not match the mission brief",
    });
    expect(rejected.status).toBe("rejected");
    expect(rejected.version).toBe(4);
    expect(rejected.reviews).toHaveLength(1);
    expect(rejected.reviews[0].verdict).toBe("reject");
    expect(rejected.reviews[0].reason).toBe(
      "Scope drift: subject does not match the mission brief",
    );
  });

  it("throws MISSING_REASON when rejecting without a reason", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle);
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    expectCandidateError(
      () =>
        lifecycle.reject(candidate, {
          reviewer: "professional-1",
          reason: "",
        }),
      CandidateErrorCode.MISSING_REASON,
    );
  });
});

describe("corrected path: reviewing → corrected → re-inspect → reviewing → accepted", () => {
  it("allows one correction and re-flows the new subject through review", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle, "hello");
    const originalHash = candidate.subjectHash;
    const originalId = candidate.id;
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);

    candidate = lifecycle.correct(candidate, {
      subject: "hello-v2",
      reason: "Fix the reviewed amount",
    });
    expect(candidate.status).toBe("corrected");
    expect(candidate.version).toBe(4);
    expect(candidate.subjectHash).toBe(computeSubjectHash("hello-v2"));
    expect(candidate.subjectHash).not.toBe(originalHash);
    // New bytes → new canonical identity; lineage preserved in corrections.
    expect(candidate.id).not.toBe(originalId);
    expect(candidate.corrections).toHaveLength(1);
    expect(candidate.corrections[0].fromHash).toBe(originalHash);
    expect(candidate.corrections[0].toHash).toBe(candidate.subjectHash);

    candidate = lifecycle.inspect(candidate, "hello-v2");
    expect(candidate.status).toBe("inspected");
    expect(candidate.version).toBe(5);

    candidate = lifecycle.submitForReview(candidate);
    expect(candidate.status).toBe("reviewing");
    expect(candidate.version).toBe(6);

    candidate = lifecycle.accept(candidate, { reviewer: "professional-2" });
    expect(candidate.status).toBe("accepted");
    expect(candidate.version).toBe(7);
    expect(candidate.reviews).toHaveLength(1);
    expect(candidate.corrections).toHaveLength(1);
  });

  it("throws CORRECTION_BUDGET_EXCEEDED on a second correction", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle, "hello");
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    candidate = lifecycle.correct(candidate, {
      subject: "hello-v2",
      reason: "First correction",
    });
    candidate = lifecycle.inspect(candidate, "hello-v2");
    candidate = lifecycle.submitForReview(candidate);
    expectCandidateError(
      () =>
        lifecycle.correct(candidate, {
          subject: "hello-v3",
          reason: "Second correction",
        }),
      CandidateErrorCode.CORRECTION_BUDGET_EXCEEDED,
    );
  });
});

describe("identity revalidation", () => {
  it("throws SUBJECT_MUTATED when inspection sees modified bytes", () => {
    const lifecycle = new CandidateLifecycle();
    const candidate = propose(lifecycle, "hello");
    expectCandidateError(
      () => lifecycle.inspect(candidate, "world"),
      CandidateErrorCode.SUBJECT_MUTATED,
    );
    // The candidate is unchanged by the failed inspection.
    expect(candidate.status).toBe("proposed");
    expect(candidate.version).toBe(1);
  });

  it("throws SUBJECT_MUTATED on a mutated corrected subject", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle, "hello");
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    candidate = lifecycle.correct(candidate, {
      subject: "hello-v2",
      reason: "First correction",
    });
    expectCandidateError(
      () => lifecycle.inspect(candidate, "hello-v3"),
      CandidateErrorCode.SUBJECT_MUTATED,
    );
  });
});

describe("invalid transitions", () => {
  it("throws INVALID_TRANSITION for every illegal move", () => {
    const lifecycle = new CandidateLifecycle();
    const proposed = propose(lifecycle);
    const inspected = lifecycle.inspect(proposed, "hello");
    const reviewing = lifecycle.submitForReview(inspected);
    const accepted = lifecycle.accept(reviewing, { reviewer: "p1" });
    const rejected = lifecycle.reject(
      lifecycle.submitForReview(lifecycle.inspect(propose(lifecycle, "b"), "b")),
      { reviewer: "p1", reason: "No" },
    );

    expectCandidateError(
      () => lifecycle.submitForReview(proposed),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.accept(proposed, { reviewer: "p1" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.reject(proposed, { reviewer: "p1", reason: "No" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.correct(proposed, { subject: "x", reason: "No" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.accept(inspected, { reviewer: "p1" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.inspect(reviewing, "hello"),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.submitForReview(accepted),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.inspect(rejected, "b"),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.accept(rejected, { reviewer: "p1" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
  });
});

describe("version bumps", () => {
  it("increments version on every state change", () => {
    const lifecycle = new CandidateLifecycle();
    let candidate = propose(lifecycle);
    const versions: number[] = [candidate.version];
    candidate = lifecycle.inspect(candidate, "hello");
    versions.push(candidate.version);
    candidate = lifecycle.submitForReview(candidate);
    versions.push(candidate.version);
    candidate = lifecycle.correct(candidate, {
      subject: "hello-v2",
      reason: "Fix",
    });
    versions.push(candidate.version);
    candidate = lifecycle.inspect(candidate, "hello-v2");
    versions.push(candidate.version);
    candidate = lifecycle.submitForReview(candidate);
    versions.push(candidate.version);
    candidate = lifecycle.accept(candidate, { reviewer: "p1" });
    versions.push(candidate.version);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
