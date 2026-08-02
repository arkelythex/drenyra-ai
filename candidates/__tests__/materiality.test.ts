/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Materiality tests — full DRAFT policy matrix. `value` is typed bigint
 * (whole-number cents); every case below exercises BigInt literals only — a
 * float cannot be passed to deriveMateriality without a cast, and no number is
 * ever involved in the comparison.
 */

import { describe, expect, it } from "vitest";
import {
  deriveMateriality,
  escalateMateriality,
  HIGH_VALUE_CENTS,
  MEDIUM_VALUE_CENTS,
} from "../materiality.js";
import type { Materiality, Reversibility } from "../types.js";

function tier(
  value: bigint,
  reversibility: Reversibility = "reversible",
  jurisdiction = "PE",
): Materiality {
  return deriveMateriality({ value, reversibility, jurisdiction });
}

describe("deriveMateriality — value + reversibility", () => {
  it("R0: zero value AND reversible (read-only / non-material)", () => {
    expect(tier(0n, "reversible")).toBe("R0");
  });

  it("R1: small reversible values below the medium threshold", () => {
    expect(tier(5000n, "reversible")).toBe("R1"); // S/50.00
    expect(tier(MEDIUM_VALUE_CENTS - 1n, "reversible")).toBe("R1");
  });

  it("R2: reversible values from the medium threshold up", () => {
    expect(tier(MEDIUM_VALUE_CENTS, "reversible")).toBe("R2"); // S/10,000.00
    expect(tier(HIGH_VALUE_CENTS - 1n, "reversible")).toBe("R2");
  });

  it("R3: reversible values at or above the high threshold", () => {
    expect(tier(HIGH_VALUE_CENTS, "reversible")).toBe("R3"); // S/100,000.00
    expect(tier(1_000_000_00n, "reversible")).toBe("R3");
  });

  it("R2: partially-reversible dominates value (draft precedence)", () => {
    expect(tier(5000n, "partially-reversible")).toBe("R2");
    expect(tier(HIGH_VALUE_CENTS, "partially-reversible")).toBe("R2");
  });

  it("R3: irreversible dominates everything, including zero value", () => {
    expect(tier(0n, "irreversible")).toBe("R3");
    expect(tier(5000n, "irreversible")).toBe("R3");
    expect(tier(1_000_000_00n, "irreversible")).toBe("R3");
  });
});

describe("deriveMateriality — jurisdiction escalation (fail-closed)", () => {
  it("escalates one tier for any non-PE jurisdiction", () => {
    expect(tier(0n, "reversible", "CL")).toBe("R1"); // R0 → R1
    expect(tier(5000n, "reversible", "CL")).toBe("R2"); // R1 → R2
    expect(tier(MEDIUM_VALUE_CENTS, "reversible", "MX")).toBe("R3"); // R2 → R3
  });

  it("R3 stays R3 under non-PE jurisdiction", () => {
    expect(tier(HIGH_VALUE_CENTS, "reversible", "MX")).toBe("R3");
    expect(tier(5000n, "irreversible", "AR")).toBe("R3");
  });

  it("PE is never escalated", () => {
    expect(tier(5000n, "reversible", "PE")).toBe("R1");
    expect(tier(0n, "reversible", "PE")).toBe("R0");
  });
});

describe("escalateMateriality", () => {
  it("moves one tier up and caps at R3", () => {
    expect(escalateMateriality("R0")).toBe("R1");
    expect(escalateMateriality("R1")).toBe("R2");
    expect(escalateMateriality("R2")).toBe("R3");
    expect(escalateMateriality("R3")).toBe("R3");
  });
});

describe("threshold constants are BigInt cents", () => {
  it("exposes the S/10,000.00 and S/100,000.00 thresholds as bigint", () => {
    expect(MEDIUM_VALUE_CENTS).toBe(10_000_00n);
    expect(HIGH_VALUE_CENTS).toBe(100_000_00n);
  });
});
