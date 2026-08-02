/**
 * candidate contract conformance (v0.1 FROZEN).
 *
 * Pins the normative surface of contracts/candidate.md against the public library
 * API (candidates/index.js only — no internals). Covers the doc statements:
 * content-derived identity, the FULL materiality policy matrix (rules in exact
 * order, jurisdiction fail-closed escalation, R3 ceiling), the lifecycle
 * proposed → inspected → reviewing → accepted | corrected | rejected with the
 * one-correction budget, and mutated-subject rejection.
 *
 * Monetary values are whole-number cents as BigInt — no float is ever used for
 * money; the `value` field is typed bigint and every literal below is a BigInt
 * literal. Threshold constants are pinned as BigInt cents.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */

import { describe, expect, it } from "vitest";
import {
  CandidateError,
  CandidateErrorCode,
  CandidateLifecycle,
  HIGH_VALUE_CENTS,
  MEDIUM_VALUE_CENTS,
  candidateIdentity,
  computeSubjectHash,
  deriveMateriality,
  orderOf,
  type Candidate,
  type Materiality,
  type MaterialityInput,
  type Reversibility,
} from "../../candidates/index.js";

const SCOPE = { ruc: "20123456789", period: "202607" };

const NON_PE_JURISDICTIONS: readonly string[] = ["CL", "MX", "AR", "US"];

function input(
  value: bigint,
  reversibility: Reversibility = "reversible",
  jurisdiction = "PE",
): MaterialityInput {
  return { value, reversibility, jurisdiction };
}

interface MaterialityCase {
  label: string;
  value: bigint;
  reversibility: Reversibility;
  jurisdiction: string;
  expected: Materiality;
}

// ─── §Materiality policy matrix — rules evaluated in the doc's exact order ─────

const MATERIALITY_MATRIX: readonly MaterialityCase[] = [
  // Rule 1: value === 0n AND reversible → R0 (read-only / non-material)
  { label: "zero + reversible", value: 0n, reversibility: "reversible", jurisdiction: "PE", expected: "R0" },
  // Rule 6 boundary: below the medium threshold → R1
  { label: "S/0.01", value: 1n, reversibility: "reversible", jurisdiction: "PE", expected: "R1" },
  { label: "S/9,999.99 (medium - 1 cent)", value: MEDIUM_VALUE_CENTS - 1n, reversibility: "reversible", jurisdiction: "PE", expected: "R1" },
  // Rule 5: value >= S/10,000.00 → R2
  { label: "S/10,000.00 (medium)", value: MEDIUM_VALUE_CENTS, reversibility: "reversible", jurisdiction: "PE", expected: "R2" },
  { label: "S/99,999.99 (high - 1 cent)", value: HIGH_VALUE_CENTS - 1n, reversibility: "reversible", jurisdiction: "PE", expected: "R2" },
  // Rule 4: value >= S/100,000.00 → R3
  { label: "S/100,000.00 (high)", value: HIGH_VALUE_CENTS, reversibility: "reversible", jurisdiction: "PE", expected: "R3" },
  { label: "S/1,000,000.00", value: 1_000_000_00n, reversibility: "reversible", jurisdiction: "PE", expected: "R3" },
  // Rule 3: partially-reversible → R2 (dominates value)
  { label: "partially-reversible S/0", value: 0n, reversibility: "partially-reversible", jurisdiction: "PE", expected: "R2" },
  { label: "partially-reversible S/50", value: 5000n, reversibility: "partially-reversible", jurisdiction: "PE", expected: "R2" },
  { label: "partially-reversible S/100,000", value: HIGH_VALUE_CENTS, reversibility: "partially-reversible", jurisdiction: "PE", expected: "R2" },
  // Rule 2: irreversible → R3 (dominates everything, including zero value)
  { label: "irreversible S/0", value: 0n, reversibility: "irreversible", jurisdiction: "PE", expected: "R3" },
  { label: "irreversible S/50", value: 5000n, reversibility: "irreversible", jurisdiction: "PE", expected: "R3" },
  { label: "irreversible S/1,000,000", value: 1_000_000_00n, reversibility: "irreversible", jurisdiction: "PE", expected: "R3" },
];

// Jurisdiction rule (fail-closed): any jurisdiction !== "PE" escalates one tier
// (R0→R1, R1→R2, R2→R3); R3 stays R3.
const JURISDICTION_ESCALATION: readonly MaterialityCase[] = [
  { label: "CL zero+reversible R0→R1", value: 0n, reversibility: "reversible", jurisdiction: "CL", expected: "R1" },
  { label: "MX small reversible R1→R2", value: 5000n, reversibility: "reversible", jurisdiction: "MX", expected: "R2" },
  { label: "AR medium reversible R2→R3", value: MEDIUM_VALUE_CENTS, reversibility: "reversible", jurisdiction: "AR", expected: "R3" },
  { label: "US high reversible R3 stays R3", value: HIGH_VALUE_CENTS, reversibility: "reversible", jurisdiction: "US", expected: "R3" },
  { label: "CL partially-reversible R2→R3", value: 5000n, reversibility: "partially-reversible", jurisdiction: "CL", expected: "R3" },
  { label: "MX irreversible R3 stays R3", value: 5000n, reversibility: "irreversible", jurisdiction: "MX", expected: "R3" },
  { label: "AR irreversible zero R3 stays R3", value: 0n, reversibility: "irreversible", jurisdiction: "AR", expected: "R3" },
];

describe("candidate §Identity (frozen 0.1)", () => {
  it("derives a SHA-256 hex subject hash over the exact bytes", () => {
    expect(computeSubjectHash("hello")).toMatch(/^[0-9a-f]{64}$/);
    expect(computeSubjectHash("hello")).toBe(computeSubjectHash("hello"));
    expect(computeSubjectHash("hello")).not.toBe(computeSubjectHash("world"));
    // A string and its UTF-8 bytes are the same byte source.
    const bytes = new TextEncoder().encode("hello");
    expect(computeSubjectHash("hello")).toBe(computeSubjectHash(bytes));
  });

  it("collides identity for the same bytes + scope; differs for differing bytes", () => {
    const lifecycle = new CandidateLifecycle();
    const a = lifecycle.propose({ subject: "hello", scope: SCOPE, materialityInput: input(5000n) });
    const b = lifecycle.propose({ subject: "hello", scope: SCOPE, materialityInput: input(5000n) });
    const c = lifecycle.propose({ subject: "world", scope: SCOPE, materialityInput: input(5000n) });
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it("differs identity when the scope differs", () => {
    const lifecycle = new CandidateLifecycle();
    const a = lifecycle.propose({ subject: "hello", scope: SCOPE, materialityInput: input(5000n) });
    const b = lifecycle.propose({
      subject: "hello",
      scope: { ruc: "20987654321", period: "202607" },
      materialityInput: input(5000n),
    });
    const c = lifecycle.propose({
      subject: "hello",
      scope: { ruc: "20123456789", period: "202608" },
      materialityInput: input(5000n),
    });
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it("is the canonical <subjectHash>:<ruc>:<period> concatenation", () => {
    const hash = computeSubjectHash("hello");
    expect(candidateIdentity(hash, SCOPE)).toBe(`${hash}:20123456789:202607`);
  });
});

describe("candidate §Materiality (frozen 0.1)", () => {
  it("evaluates the full PE policy matrix in the documented rule order", () => {
    for (const c of MATERIALITY_MATRIX) {
      expect(
        deriveMateriality(input(c.value, c.reversibility, c.jurisdiction)),
        c.label,
      ).toBe(c.expected);
    }
  });

  it("fails closed into a higher tier for every non-PE jurisdiction; R3 stays R3", () => {
    for (const c of JURISDICTION_ESCALATION) {
      expect(
        deriveMateriality(input(c.value, c.reversibility, c.jurisdiction)),
        c.label,
      ).toBe(c.expected);
    }
    for (const jurisdiction of NON_PE_JURISDICTIONS) {
      expect(deriveMateriality(input(0n, "reversible", jurisdiction))).toBe("R1");
    }
  });

  it("R0 requires BOTH zero value AND reversible (partial/irreversible never R0)", () => {
    expect(deriveMateriality(input(0n, "reversible"))).toBe("R0");
    expect(deriveMateriality(input(0n, "partially-reversible"))).toBe("R2");
    expect(deriveMateriality(input(0n, "irreversible"))).toBe("R3");
  });

  it("pins the threshold constants as BigInt cents (S/10,000.00 and S/100,000.00)", () => {
    expect(MEDIUM_VALUE_CENTS).toBe(10_000_00n);
    expect(HIGH_VALUE_CENTS).toBe(100_000_00n);
    expect(typeof MEDIUM_VALUE_CENTS).toBe("bigint");
    expect(typeof HIGH_VALUE_CENTS).toBe("bigint");
  });

  it("pins the tier ordinal used by review depth (R0 < R1 < R2 < R3)", () => {
    expect(orderOf("R0")).toBe(0);
    expect(orderOf("R1")).toBe(1);
    expect(orderOf("R2")).toBe(2);
    expect(orderOf("R3")).toBe(3);
  });
});

describe("candidate §Lifecycle (frozen 0.1)", () => {
  const lifecycle = new CandidateLifecycle();

  function proposeCandidate(subject = "hello"): Candidate {
    return lifecycle.propose({
      subject,
      scope: SCOPE,
      materialityInput: input(5000n),
    });
  }

  function expectCandidateError(fn: () => unknown, code: CandidateErrorCode): void {
    let thrown: unknown;
    try {
      fn();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CandidateError);
    expect((thrown as CandidateError).code).toBe(code);
  }

  it("proposes a candidate at proposed/v1 with derived identity and materiality", () => {
    const candidate = proposeCandidate();
    expect(candidate.status).toBe("proposed");
    expect(candidate.version).toBe(1);
    expect(candidate.materiality).toBe("R1");
    expect(candidate.subjectHash).toBe(computeSubjectHash("hello"));
    expect(candidate.id).toBe(candidateIdentity(candidate.subjectHash, SCOPE));
  });

  it("flows proposed → inspected → reviewing → accepted", () => {
    let candidate = proposeCandidate();
    candidate = lifecycle.inspect(candidate, "hello");
    expect(candidate.status).toBe("inspected");
    candidate = lifecycle.submitForReview(candidate);
    expect(candidate.status).toBe("reviewing");
    candidate = lifecycle.accept(candidate, { reviewer: "professional-1" });
    expect(candidate.status).toBe("accepted");
    expect(candidate.reviews).toHaveLength(1);
    expect(candidate.reviews[0].verdict).toBe("accept");
  });

  it("flows proposed → inspected → reviewing → rejected (reason required)", () => {
    let candidate = proposeCandidate();
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    candidate = lifecycle.reject(candidate, {
      reviewer: "professional-1",
      reason: "Scope drift",
    });
    expect(candidate.status).toBe("rejected");
    expect(candidate.reviews[0].verdict).toBe("reject");
  });

  it("allows exactly one correction and re-flows the corrected subject", () => {
    let candidate = proposeCandidate();
    const originalId = candidate.id;
    candidate = lifecycle.inspect(candidate, "hello");
    candidate = lifecycle.submitForReview(candidate);
    candidate = lifecycle.correct(candidate, {
      subject: "hello-v2",
      reason: "Fix the reviewed amount",
    });
    expect(candidate.status).toBe("corrected");
    expect(candidate.corrections).toHaveLength(1);
    // New subject bytes → new canonical identity; lineage kept in corrections.
    expect(candidate.id).not.toBe(originalId);
    expect(candidate.corrections[0].fromHash).toBe(computeSubjectHash("hello"));
    expect(candidate.corrections[0].toHash).toBe(computeSubjectHash("hello-v2"));
    // Corrected subjects must pass re-inspection before further review (fail-closed).
    expectCandidateError(
      () => lifecycle.submitForReview(candidate),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    candidate = lifecycle.inspect(candidate, "hello-v2");
    candidate = lifecycle.submitForReview(candidate);
    candidate = lifecycle.accept(candidate, { reviewer: "professional-2" });
    expect(candidate.status).toBe("accepted");
  });

  it("throws CORRECTION_BUDGET_EXCEEDED on a second correction", () => {
    let candidate = proposeCandidate();
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

  it("rejects mutated subject bytes with SUBJECT_MUTATED", () => {
    const candidate = proposeCandidate();
    expectCandidateError(
      () => lifecycle.inspect(candidate, "world"),
      CandidateErrorCode.SUBJECT_MUTATED,
    );
    // The failed inspection leaves the candidate untouched.
    expect(candidate.status).toBe("proposed");
    expect(candidate.version).toBe(1);
  });

  it("rejects illegal lifecycle moves with INVALID_TRANSITION", () => {
    const candidate = proposeCandidate();
    expectCandidateError(
      () => lifecycle.accept(candidate, { reviewer: "p1" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
    expectCandidateError(
      () => lifecycle.reject(candidate, { reviewer: "p1", reason: "No" }),
      CandidateErrorCode.INVALID_TRANSITION,
    );
  });
});
