/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Same-close-step segregation of duties (T-AUTH-005, REQ-AUTH-009/010/011). */
import { describe, expect, it } from "vitest";
import { assertSegregation } from "../segregation.js";
import type { SegregationInput } from "../types.js";

const SOD_VIOLATION = {
  code: "sod-violation",
  cause: "proposer appears among the approvers of the same close step",
  continuation: "choose an approver who did not propose the step",
} as const;
const SOD_INVALID_INPUT = {
  code: "sod-invalid-input",
  cause: "segregation input is malformed",
  continuation: "provide non-empty string IDs and a well-formed approver list",
} as const;

describe("T-AUTH-005 assertSegregation", () => {
  it("allows distinct proposer and approvers (SC-AUTH-022)", () => {
    const decision = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-2", "op-3"],
    });
    expect(decision).toEqual({ allowed: true });
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it("denies with sod-violation when the proposer is among the approvers (SC-AUTH-023)", () => {
    const decision = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-2", "op-1"],
    });
    expect(decision).toEqual({ allowed: false, denial: SOD_VIOLATION });
  });

  it("treats the approver list as a set for overlap (SC-AUTH-023/026)", () => {
    const repeatedProposer = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-1", "op-1"],
    });
    expect(repeatedProposer).toEqual({ allowed: false, denial: SOD_VIOLATION });
    const repeatedOthers = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-2", "op-2"],
    });
    expect(repeatedOthers).toEqual({ allowed: true });
  });

  it("allows an empty approver set vacuously (SC-AUTH-024)", () => {
    const decision = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: [],
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("allows one distinct approver because SoD is overlap only, not counting (SC-AUTH-028)", () => {
    const decision = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-2"],
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("detects overlap with plain string IDs and no identity plumbing (SC-AUTH-026)", () => {
    const decision = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-1"],
    });
    expect(decision).toEqual({ allowed: false, denial: SOD_VIOLATION });
  });

  it("preserves R3 independence: two distinct approvers satisfy both SoD and the R3 count (SC-AUTH-027)", () => {
    const approvers = ["op-2", "op-3"];
    const decision = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: approvers,
    });
    expect(decision).toEqual({ allowed: true });
    expect(new Set(approvers).size).toBe(2);
    expect(approvers).not.toContain("op-1");
  });

  it("denies malformed input with sod-invalid-input, never an authorization denial (SC-AUTH-025)", () => {
    const malformed: ReadonlyArray<[string, unknown]> = [
      ["null input", null],
      ["missing closeStepId", { proposerId: "op-1", approverIds: [] }],
      ["non-string closeStepId", { closeStepId: 123, proposerId: "op-1", approverIds: [] }],
      ["empty closeStepId", { closeStepId: "", proposerId: "op-1", approverIds: [] }],
      ["whitespace closeStepId", { closeStepId: "   ", proposerId: "op-1", approverIds: [] }],
      ["missing proposerId", { closeStepId: "step-1", approverIds: [] }],
      ["non-string proposerId", { closeStepId: "step-1", proposerId: 7, approverIds: [] }],
      ["empty proposerId", { closeStepId: "step-1", proposerId: "", approverIds: [] }],
      ["approverIds not an array", { closeStepId: "step-1", proposerId: "op-1", approverIds: "op-2" }],
      ["non-string approverId", { closeStepId: "step-1", proposerId: "op-1", approverIds: ["op-2", 9] }],
      ["empty approverId", { closeStepId: "step-1", proposerId: "op-1", approverIds: [""] }],
      ["whitespace approverId", { closeStepId: "step-1", proposerId: "op-1", approverIds: ["  "] }],
    ];
    for (const [name, input] of malformed) {
      const decision = assertSegregation(input as SegregationInput);
      expect(decision).toEqual({ allowed: false, denial: SOD_INVALID_INPUT });
      expect(name).toBeTruthy();
    }
  });

  it("repeats decisions byte-identically and never mutates the caller's array (REQ-AUTH-015)", () => {
    const approverIds = ["op-2", "op-1"];
    const snapshot = JSON.stringify(approverIds);
    const first = assertSegregation({ closeStepId: "step-1", proposerId: "op-1", approverIds });
    for (let i = 0; i < 25; i++) {
      expect(
        assertSegregation({ closeStepId: "step-1", proposerId: "op-1", approverIds }),
      ).toEqual(first);
    }
    expect(JSON.stringify(approverIds)).toBe(snapshot);
    expect(approverIds).toEqual(["op-2", "op-1"]);
  });

  it("keeps the English technical surface: lowercase codes, English causes (SC-AUTH-033)", () => {
    const denied = assertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-1"],
    });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.denial.code).toMatch(/^[a-z][a-z-]+$/);
      expect(denied.denial.cause).toMatch(/^[a-z][a-z0-9 -]+$/);
      expect(denied.denial.continuation).toMatch(/^[a-z][a-z0-9 -]+$/);
      expect(Object.isFrozen(denied)).toBe(true);
      expect(Object.isFrozen(denied.denial)).toBe(true);
    }
  });
});
