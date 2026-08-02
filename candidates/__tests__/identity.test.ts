/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Identity tests — same bytes → same hash, differing bytes → different hash,
 * identity collision rule, and empty-input handling. Bytes are the source of
 * truth: strings hash over their UTF-8 encoding, Uint8Array over exact bytes.
 */

import { describe, expect, it } from "vitest";
import { candidateIdentity, computeSubjectHash } from "../identity.js";

const SCOPE = { ruc: "20123456789", period: "202607" };

const encoder = new TextEncoder();

describe("computeSubjectHash", () => {
  it("returns the same hash for the same bytes", () => {
    expect(computeSubjectHash("hello")).toBe(computeSubjectHash("hello"));
    expect(computeSubjectHash(new Uint8Array([1, 2, 3]))).toBe(
      computeSubjectHash(new Uint8Array([1, 2, 3])),
    );
  });

  it("hashes a string and its UTF-8 bytes identically", () => {
    const bytes = encoder.encode("héllo");
    expect(computeSubjectHash("héllo")).toBe(computeSubjectHash(bytes));
  });

  it("returns different hashes for different bytes", () => {
    expect(computeSubjectHash("hello")).not.toBe(computeSubjectHash("world"));
    expect(computeSubjectHash(new Uint8Array([1, 2, 3]))).not.toBe(
      computeSubjectHash(new Uint8Array([1, 2, 4])),
    );
  });

  it("handles empty input deterministically", () => {
    const emptyString = computeSubjectHash("");
    const emptyBytes = computeSubjectHash(new Uint8Array(0));
    expect(emptyString).toBe(emptyBytes);
    // Known SHA-256 of the empty input.
    expect(emptyString).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(emptyString).not.toBe(computeSubjectHash("a"));
  });
});

describe("candidateIdentity", () => {
  it("collides for the same subject hash and scope", () => {
    const hash = computeSubjectHash("hello");
    expect(candidateIdentity(hash, SCOPE)).toBe(
      candidateIdentity(hash, { ruc: "20123456789", period: "202607" }),
    );
  });

  it("differs when the subject bytes differ", () => {
    const a = candidateIdentity(computeSubjectHash("hello"), SCOPE);
    const b = candidateIdentity(computeSubjectHash("world"), SCOPE);
    expect(a).not.toBe(b);
  });

  it("differs when the RUC differs", () => {
    const hash = computeSubjectHash("hello");
    const a = candidateIdentity(hash, SCOPE);
    const b = candidateIdentity(hash, { ruc: "20987654321", period: "202607" });
    expect(a).not.toBe(b);
  });

  it("differs when the period differs", () => {
    const hash = computeSubjectHash("hello");
    const a = candidateIdentity(hash, SCOPE);
    const b = candidateIdentity(hash, { ruc: "20123456789", period: "202608" });
    expect(a).not.toBe(b);
  });

  it("is the canonical hash:ruc:period concatenation", () => {
    const hash = computeSubjectHash("hello");
    expect(candidateIdentity(hash, SCOPE)).toBe(
      `${hash}:20123456789:202607`,
    );
  });
});
