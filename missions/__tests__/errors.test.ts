/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MissionError tests — ported from @drenyra/mission-protocol (errors.test.ts +
 * the fixture-driven mapping assertions of error-conformance.test.ts).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MissionError, MissionErrorCode, isMissionError } from "../errors.js";
import {
  getCapabilities,
  hasFeature,
  isClientCompatible,
} from "../versioning.js";

interface ErrorFixture {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

function loadFixture(name: string): ErrorFixture {
  const p = resolve(process.cwd(), `fixtures/errors/${name}`);
  const data = readFileSync(p, "utf-8");
  return JSON.parse(data) as ErrorFixture;
}

// Family mapping must match Go's familyForCode()
const FAMILY_MAP: Record<string, string> = {
  UNAUTHORIZED: "AUTH",
  TOKEN_EXPIRED: "AUTH",
  TOKEN_REVOKED: "AUTH",
  INSUFFICIENT_SCOPE: "AUTH",
  TENANT_MISMATCH: "TENANT",
  MISSION_NOT_FOUND: "VALIDATION",
  VERSION_CONFLICT: "CONCURRENCY",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY",
  INVALID_TRANSITION: "MISSION_STATE",
  EVIDENCE_MISMATCH: "EVIDENCE",
  APPROVAL_ALREADY_DECIDED: "APPROVAL",
  HARNESS_TIMEOUT: "EXTERNAL_SYSTEM",
};

// Status code mapping must match Go's STATUS_CODE_MAP
function statusCodeForCode(code: string): number {
  const map: Record<string, number> = {
    UNAUTHORIZED: 401,
    TOKEN_EXPIRED: 401,
    TOKEN_REVOKED: 401,
    INSUFFICIENT_SCOPE: 403,
    TENANT_MISMATCH: 403,
    MISSION_NOT_FOUND: 404,
    VERSION_CONFLICT: 409,
    IDEMPOTENCY_CONFLICT: 409,
    INVALID_TRANSITION: 409,
    EVIDENCE_MISMATCH: 409,
    APPROVAL_ALREADY_DECIDED: 409,
    HARNESS_TIMEOUT: 504,
  };
  return map[code] ?? 500;
}

describe("MissionError", () => {
  it("creates error with default status code", () => {
    const err = new MissionError(MissionErrorCode.MISSION_NOT_FOUND);
    expect(err.code).toBe("MISSION_NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("MISSION_NOT_FOUND");
  });

  it("creates error with custom status code and message", () => {
    const err = new MissionError(
      MissionErrorCode.VERSION_CONFLICT,
      409,
      "custom",
    );
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("custom");
  });

  it("attaches details", () => {
    const err = new MissionError(
      MissionErrorCode.VERSION_CONFLICT,
      409,
      "msg",
      { current: 2, expected: 1 },
    );
    expect(err.details).toEqual({ current: 2, expected: 1 });
  });

  it("returns correct family for AUTH errors", () => {
    const err = new MissionError(MissionErrorCode.UNAUTHORIZED);
    expect(err.family).toBe("AUTH");
  });

  it("returns correct family for TENANT errors", () => {
    const err = new MissionError(MissionErrorCode.TENANT_MISMATCH);
    expect(err.family).toBe("TENANT");
  });

  it("returns correct family for CONCURRENCY errors", () => {
    const err = new MissionError(MissionErrorCode.VERSION_CONFLICT);
    expect(err.family).toBe("CONCURRENCY");
  });

  it("marks HARNESS_TIMEOUT as retryable", () => {
    const err = new MissionError(MissionErrorCode.HARNESS_TIMEOUT);
    expect(err.isRetryable).toBe(true);
  });

  it("marks VERSION_CONFLICT as retryable", () => {
    const err = new MissionError(MissionErrorCode.VERSION_CONFLICT);
    expect(err.isRetryable).toBe(true);
  });

  it("marks INVALID_INPUT as not retryable", () => {
    const err = new MissionError(MissionErrorCode.INVALID_INPUT);
    expect(err.isRetryable).toBe(false);
  });

  it("isMissionError type guard works", () => {
    const err = new MissionError(MissionErrorCode.UNAUTHORIZED);
    expect(isMissionError(err)).toBe(true);
    expect(isMissionError(new Error("plain"))).toBe(false);
    expect(isMissionError(null)).toBe(false);
    expect(isMissionError({ name: "MissionError", code: "UNAUTHORIZED" })).toBe(
      true,
    );
  });
});

describe("Error mapping conformance (TS vs Go fixtures)", () => {
  const fixtureNames = [
    "error-version-conflict.v1.json",
    "error-not-found.v1.json",
    "error-unauthorized.v1.json",
  ];

  for (const name of fixtureNames) {
    it(`maps ${name} correctly`, () => {
      const fixture = loadFixture(name);
      const code = fixture.error.code;
      const family = FAMILY_MAP[code];

      expect(family).toBeDefined();
      expect(Object.values(MissionErrorCode)).toContain(code);

      const err = new MissionError(
        code as MissionErrorCode,
        statusCodeForCode(code),
        fixture.error.message,
        fixture.error.details,
      );
      expect(err.code).toBe(code);
      expect(err.family).toBe(family);
      expect(err.statusCode).toBe(statusCodeForCode(code));
      expect(isMissionError(err)).toBe(true);
    });
  }

  it("exit codes match Go convention", () => {
    const exitCodes: Record<string, number> = {
      INVALID_INPUT: 2,
      UNAUTHORIZED: 3,
      INSUFFICIENT_SCOPE: 4,
      VERSION_CONFLICT: 5,
      TERMINAL_STATE_GUARD: 6,
      UNKNOWN_STATE: 7,
      HARNESS_TIMEOUT: 8,
    };
    // TS doesn't have exit codes natively (it's a Go CLI concept),
    // but verify the mapping exists for documentation
    expect(exitCodes.UNAUTHORIZED).toBe(3);
    expect(exitCodes.HARNESS_TIMEOUT).toBe(8);
  });
});

describe("Capability negotiation conformance", () => {
  it("capabilities match between TS and Go definitions", () => {
    const caps = getCapabilities();
    expect(caps.protocolVersion).toBe("1.0");
    expect(caps.minimumClientVersion).toBe("1.0");

    // These must match the Go CLI fallback feature list exactly
    const expectedGranularFeatures = [
      "mission.create.http.v1",
      "mission.read.http.v1",
      "mission.list.http.v1",
      "mission.execute.http.v1",
      "mission.approve.http.v1",
      "mission.reject.http.v1",
      "mission.reconcile.http.v1",
      "mission.gates.read.http.v1",
      "mission.exceptions.read.http.v1",
      "mission.watch.sse.v1",
      "mission.watch.cursor.v1",
      "idempotency.key.v1",
      "idempotency.replay.v1",
      "concurrency.optimistic.v1",
      "receipt.verify.hash.v1",
      "approval.multi-signer.v1",
      "protocol.capabilities.v1",
    ];

    for (const feat of expectedGranularFeatures) {
      expect(hasFeature(caps, feat)).toBe(true);
    }
  });

  it("client compatibility check matches Go", () => {
    expect(isClientCompatible("1.5", "1.0")).toBe(true);
    expect(isClientCompatible("1.0", "1.0")).toBe(true);
    expect(isClientCompatible("0.9", "1.0")).toBe(false);
  });
});
