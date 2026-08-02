/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Idempotency tests — ported from @drenyra/mission-protocol
 * (idempotency-conformance.test.ts).
 */

import { describe, expect, it } from "vitest";
import {
  defaultIdempotencyKey,
  isValidIdempotencyKey,
} from "../idempotency.js";

describe("Idempotency conformance", () => {
  it("generates a valid idempotency key", () => {
    const key = defaultIdempotencyKey({ action: "create", scope: "mission-1" });
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(8);
    expect(key).toContain("create");
    expect(key).toContain("mission-1");
    expect(isValidIdempotencyKey(key)).toBe(true);
  });

  it("generates unique keys on each call", () => {
    const key1 = defaultIdempotencyKey();
    const key2 = defaultIdempotencyKey();
    expect(key1).not.toBe(key2);
  });

  it("validates key format", () => {
    expect(isValidIdempotencyKey("create-mission-1-12345678-abc")).toBe(true);
    expect(isValidIdempotencyKey("")).toBe(false);
    expect(isValidIdempotencyKey("a")).toBe(false);
    expect(isValidIdempotencyKey("a".repeat(257))).toBe(false);
    expect(isValidIdempotencyKey("key with spaces")).toBe(false);
    expect(isValidIdempotencyKey("key@special")).toBe(false);
  });

  it("generates keys with different actions for idempotency segregation", () => {
    const createKey = defaultIdempotencyKey({ action: "create" });
    const approveKey = defaultIdempotencyKey({ action: "approve" });
    expect(createKey).toContain("create");
    expect(approveKey).toContain("approve");

    // Different operations must have different key prefixes
    // to prevent idempotency conflicts across operations
    const createPrefix = createKey.split("-")[0];
    const approvePrefix = approveKey.split("-")[0];
    expect(createPrefix).not.toBe(approvePrefix);
  });
});
