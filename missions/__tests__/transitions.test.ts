/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Transition guard tests — ported from @drenyra/mission-domain
 * (mission-transitions.test.ts + the transition() matrix of
 * mission-status.test.ts). String-literal enum values from the originals are
 * expressed as enum members so strict TypeScript accepts them.
 */

import { describe, it, expect } from "vitest";
import {
  validateTransition,
  guardTerminal,
  reconcileTransition,
  isValidRecoveryPath,
  transition,
} from "../transitions.js";
import { AccountingMissionStatus } from "../status.js";
import { MissionError, MissionErrorCode } from "../errors.js";

const S = AccountingMissionStatus;

describe("validateTransition()", () => {
  it("should not throw for a valid transition", () => {
    expect(() => validateTransition(S.DRAFT, S.QUEUED)).not.toThrow();
  });

  it("should throw MissionError with INVALID_TRANSITION for invalid transition", () => {
    try {
      validateTransition(S.DRAFT, S.AWAITING_APPROVAL);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MissionError);
      expect((e as MissionError).code).toBe(MissionErrorCode.INVALID_TRANSITION);
    }
  });

  it("should throw for COMPLETED -> any", () => {
    expect(() => validateTransition(S.COMPLETED, S.DRAFT)).toThrow();
  });

  it("should throw for FAILED -> any", () => {
    expect(() => validateTransition(S.FAILED, S.QUEUED)).toThrow();
  });

  it("should not throw for UNKNOWN -> RUNNING (valid recovery)", () => {
    expect(() => validateTransition(S.UNKNOWN, S.RUNNING)).not.toThrow();
  });

  it("should throw for UNKNOWN -> DRAFT (invalid recovery)", () => {
    expect(() => validateTransition(S.UNKNOWN, S.DRAFT)).toThrow();
  });
});

describe("transition()", () => {
  // VALID TRANSITIONS — every forward transition
  it("DRAFT -> QUEUED is valid", () => {
    expect(transition(S.DRAFT, S.QUEUED)).toBe("QUEUED");
  });

  it("QUEUED -> RUNNING is valid", () => {
    expect(transition(S.QUEUED, S.RUNNING)).toBe("RUNNING");
  });

  it("QUEUED -> FAILED is valid", () => {
    expect(transition(S.QUEUED, S.FAILED)).toBe("FAILED");
  });

  it("RUNNING -> BLOCKED is valid", () => {
    expect(transition(S.RUNNING, S.BLOCKED)).toBe("BLOCKED");
  });

  it("RUNNING -> AWAITING_APPROVAL is valid", () => {
    expect(transition(S.RUNNING, S.AWAITING_APPROVAL)).toBe(
      "AWAITING_APPROVAL",
    );
  });

  it("RUNNING -> COMPLETED is valid", () => {
    expect(transition(S.RUNNING, S.COMPLETED)).toBe("COMPLETED");
  });

  it("RUNNING -> FAILED is valid", () => {
    expect(transition(S.RUNNING, S.FAILED)).toBe("FAILED");
  });

  it("RUNNING -> UNKNOWN is valid", () => {
    expect(transition(S.RUNNING, S.UNKNOWN)).toBe("UNKNOWN");
  });

  it("BLOCKED -> RUNNING is valid", () => {
    expect(transition(S.BLOCKED, S.RUNNING)).toBe("RUNNING");
  });

  it("BLOCKED -> FAILED is valid", () => {
    expect(transition(S.BLOCKED, S.FAILED)).toBe("FAILED");
  });

  it("AWAITING_APPROVAL -> APPROVED is valid", () => {
    expect(transition(S.AWAITING_APPROVAL, S.APPROVED)).toBe("APPROVED");
  });

  it("AWAITING_APPROVAL -> REJECTED is valid", () => {
    expect(transition(S.AWAITING_APPROVAL, S.REJECTED)).toBe("REJECTED");
  });

  it("AWAITING_APPROVAL -> RUNNING is valid", () => {
    expect(transition(S.AWAITING_APPROVAL, S.RUNNING)).toBe("RUNNING");
  });

  it("APPROVED -> COMPLETED is valid", () => {
    expect(transition(S.APPROVED, S.COMPLETED)).toBe("COMPLETED");
  });

  it("APPROVED -> FAILED is valid", () => {
    expect(transition(S.APPROVED, S.FAILED)).toBe("FAILED");
  });

  it("REJECTED -> REVISION_REQUESTED is valid", () => {
    expect(transition(S.REJECTED, S.REVISION_REQUESTED)).toBe(
      "REVISION_REQUESTED",
    );
  });

  it("REVISION_REQUESTED -> QUEUED is valid", () => {
    expect(transition(S.REVISION_REQUESTED, S.QUEUED)).toBe("QUEUED");
  });

  it("UNKNOWN -> RUNNING is valid", () => {
    expect(transition(S.UNKNOWN, S.RUNNING)).toBe("RUNNING");
  });

  it("UNKNOWN -> FAILED is valid", () => {
    expect(transition(S.UNKNOWN, S.FAILED)).toBe("FAILED");
  });

  it("UNKNOWN -> COMPLETED is valid", () => {
    expect(transition(S.UNKNOWN, S.COMPLETED)).toBe("COMPLETED");
  });

  // INVALID TRANSITIONS
  it("DRAFT -> AWAITING_APPROVAL throws INVALID_TRANSITION", () => {
    expect(() => transition(S.DRAFT, S.AWAITING_APPROVAL)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("DRAFT -> COMPLETED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.DRAFT, S.COMPLETED)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("DRAFT -> APPROVED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.DRAFT, S.APPROVED)).toThrow("INVALID_TRANSITION");
  });

  it("COMPLETED -> any throws INVALID_TRANSITION", () => {
    expect(() => transition(S.COMPLETED, S.DRAFT)).toThrow(
      "INVALID_TRANSITION",
    );
    expect(() => transition(S.COMPLETED, S.RUNNING)).toThrow(
      "INVALID_TRANSITION",
    );
    expect(() => transition(S.COMPLETED, S.QUEUED)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("FAILED -> any throws INVALID_TRANSITION", () => {
    expect(() => transition(S.FAILED, S.DRAFT)).toThrow("INVALID_TRANSITION");
    expect(() => transition(S.FAILED, S.RUNNING)).toThrow("INVALID_TRANSITION");
  });

  it("REJECTED -> APPROVED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.REJECTED, S.APPROVED)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("REJECTED -> COMPLETED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.REJECTED, S.COMPLETED)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("QUEUED -> COMPLETED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.QUEUED, S.COMPLETED)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("AWAITING_APPROVAL -> COMPLETED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.AWAITING_APPROVAL, S.COMPLETED)).toThrow(
      "INVALID_TRANSITION",
    );
  });

  it("UNKNOWN -> DRAFT throws INVALID_TRANSITION", () => {
    expect(() => transition(S.UNKNOWN, S.DRAFT)).toThrow("INVALID_TRANSITION");
  });

  it("UNKNOWN -> QUEUED throws INVALID_TRANSITION", () => {
    expect(() => transition(S.UNKNOWN, S.QUEUED)).toThrow("INVALID_TRANSITION");
  });
});

describe("guardTerminal()", () => {
  it("should not throw for non-terminal states", () => {
    expect(() => guardTerminal(S.DRAFT)).not.toThrow();
    expect(() => guardTerminal(S.QUEUED)).not.toThrow();
    expect(() => guardTerminal(S.RUNNING)).not.toThrow();
    expect(() => guardTerminal(S.BLOCKED)).not.toThrow();
    expect(() => guardTerminal(S.AWAITING_APPROVAL)).not.toThrow();
    expect(() => guardTerminal(S.APPROVED)).not.toThrow();
    expect(() => guardTerminal(S.REJECTED)).not.toThrow();
    expect(() => guardTerminal(S.REVISION_REQUESTED)).not.toThrow();
    expect(() => guardTerminal(S.UNKNOWN)).not.toThrow();
  });

  it("should throw MissionError with TERMINAL_STATE_GUARD for COMPLETED", () => {
    try {
      guardTerminal(S.COMPLETED);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MissionError);
      expect((e as MissionError).code).toBe(MissionErrorCode.TERMINAL_STATE_GUARD);
      expect((e as MissionError).statusCode).toBe(409);
    }
  });

  it("should throw MissionError with TERMINAL_STATE_GUARD for FAILED", () => {
    try {
      guardTerminal(S.FAILED);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MissionError);
      expect((e as MissionError).code).toBe(MissionErrorCode.TERMINAL_STATE_GUARD);
      expect((e as MissionError).statusCode).toBe(409);
    }
  });
});

describe("reconcileTransition()", () => {
  it("should resolve UNKNOWN -> RUNNING", () => {
    expect(reconcileTransition(S.UNKNOWN, S.RUNNING)).toBe(S.RUNNING);
  });

  it("should resolve UNKNOWN -> FAILED", () => {
    expect(reconcileTransition(S.UNKNOWN, S.FAILED)).toBe(S.FAILED);
  });

  it("should resolve UNKNOWN -> COMPLETED", () => {
    expect(reconcileTransition(S.UNKNOWN, S.COMPLETED)).toBe(S.COMPLETED);
  });

  it("should throw for reconciliation from non-UNKNOWN state", () => {
    expect(() => reconcileTransition(S.DRAFT, S.RUNNING)).toThrow();
    expect(() => reconcileTransition(S.RUNNING, S.FAILED)).toThrow();
    expect(() => reconcileTransition(S.COMPLETED, S.RUNNING)).toThrow();
  });

  it("should throw for invalid recovery resolution", () => {
    expect(() => reconcileTransition(S.UNKNOWN, S.DRAFT)).toThrow();
    expect(() => reconcileTransition(S.UNKNOWN, S.QUEUED)).toThrow();
    expect(() => reconcileTransition(S.UNKNOWN, S.APPROVED)).toThrow();
  });
});

describe("isValidRecoveryPath()", () => {
  it("should return true for UNKNOWN -> RUNNING", () => {
    expect(isValidRecoveryPath(S.UNKNOWN, S.RUNNING)).toBe(true);
  });

  it("should return true for UNKNOWN -> FAILED", () => {
    expect(isValidRecoveryPath(S.UNKNOWN, S.FAILED)).toBe(true);
  });

  it("should return true for UNKNOWN -> COMPLETED", () => {
    expect(isValidRecoveryPath(S.UNKNOWN, S.COMPLETED)).toBe(true);
  });

  it("should return false for non-UNKNOWN source", () => {
    expect(isValidRecoveryPath(S.DRAFT, S.RUNNING)).toBe(false);
    expect(isValidRecoveryPath(S.RUNNING, S.FAILED)).toBe(false);
  });

  it("should return false for UNKNOWN -> DRAFT", () => {
    expect(isValidRecoveryPath(S.UNKNOWN, S.DRAFT)).toBe(false);
  });

  it("should return false for UNKNOWN -> QUEUED", () => {
    expect(isValidRecoveryPath(S.UNKNOWN, S.QUEUED)).toBe(false);
  });

  it("should return false for UNKNOWN -> APPROVED", () => {
    expect(isValidRecoveryPath(S.UNKNOWN, S.APPROVED)).toBe(false);
  });
});
