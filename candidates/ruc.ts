/**
 * RUC validation — SUNAT Módulo 11 (checksummed, zero-dependency).
 *
 * Canonical source of truth for the Peruvian RUC checksum in drenyra-ai,
 * ported byte-for-byte from drenyra-pi `runtime/ruc.ts` (itself ported from the
 * Command Center shared validation). Resolving the ecosystem split-brain:
 * `isValidRuc` in types.ts remains SHAPE-ONLY for now; this module carries the
 * full checksum so flows can opt into strict validation without changing the
 * public surface. Wiring it into flows/public exports is the decision-gated
 * slice 2 of `drenyra-ecosystem-cleanup`.
 *
 * A valid Peruvian RUC is exactly 11 digits whose check digit (11th) matches
 * the Módulo 11 calculation over the first 10 digits.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; RUC digits and check digits are integers.
 */

/** Weights for the Módulo 11 algorithm (SUNAT standard). */
const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * Expected check digit for the first 10 RUC digits (Módulo 11):
 * expected = 11 - (sum % 11); 10 → 0; 11 → 1; otherwise the result.
 */
export function expectedRucCheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number.parseInt(first10[i] ?? "0", 10) * RUC_WEIGHTS[i];
  }
  const expected = 11 - (sum % 11);
  if (expected === 10) return 0;
  if (expected === 11) return 1;
  return expected;
}

/**
 * Validate a Peruvian RUC with the SUNAT Módulo 11 algorithm.
 * Stricter than the shape-only `isValidRuc`; a shape-valid RUC with a wrong
 * check digit is rejected.
 */
export function isValidRucChecksummed(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }
  const actual = Number.parseInt(ruc[10] ?? "0", 10);
  return expectedRucCheckDigit(ruc.slice(0, 10)) === actual;
}
