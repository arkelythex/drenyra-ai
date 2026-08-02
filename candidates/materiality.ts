/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Materiality derivation (DRAFT policy) — contract: contracts/candidate.md,
 * "## Materiality policy (draft)". Rules are evaluated in this exact order:
 *
 *   1. value === 0n AND reversibility === "reversible"       → R0
 *   2. reversibility === "irreversible"                      → R3
 *   3. reversibility === "partially-reversible"              → R2
 *   4. value >= 100_000_00n (S/100,000.00 cents)             → R3
 *   5. value >= 10_000_00n (S/10,000.00 cents)               → R2
 *   6. otherwise                                             → R1
 *
 * Jurisdiction rule (fail-closed): any jurisdiction !== "PE" escalates one
 * tier until a country-pack exists; R3 stays R3.
 */

import type { Materiality, MaterialityInput } from "./types.js";

/** S/100,000.00 expressed in whole-number cents (BigInt). */
export const HIGH_VALUE_CENTS = 100_000_00n;
/** S/10,000.00 expressed in whole-number cents (BigInt). */
export const MEDIUM_VALUE_CENTS = 10_000_00n;

/** Escalate one tier; R3 stays R3 (fail-closed ceiling). */
export function escalateMateriality(tier: Materiality): Materiality {
  switch (tier) {
    case "R0":
      return "R1";
    case "R1":
      return "R2";
    case "R2":
      return "R3";
    case "R3":
      return "R3";
  }
}

/**
 * Derive the materiality tier deterministically from value (BigInt cents),
 * reversibility, and jurisdiction. Never takes agent claims; no float is ever
 * involved — the `value` field is typed bigint.
 */
export function deriveMateriality(input: MaterialityInput): Materiality {
  let tier: Materiality;

  if (input.value === 0n && input.reversibility === "reversible") {
    tier = "R0";
  } else if (input.reversibility === "irreversible") {
    tier = "R3";
  } else if (input.reversibility === "partially-reversible") {
    tier = "R2";
  } else if (input.value >= HIGH_VALUE_CENTS) {
    tier = "R3";
  } else if (input.value >= MEDIUM_VALUE_CENTS) {
    tier = "R2";
  } else {
    tier = "R1";
  }

  // Fail-closed: unknown jurisdiction escalates one tier. R3 is the ceiling
  // and stays R3 regardless of jurisdiction.
  if (input.jurisdiction !== "PE") {
    tier = escalateMateriality(tier);
  }

  return tier;
}
