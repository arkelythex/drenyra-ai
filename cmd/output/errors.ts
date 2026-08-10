/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * CLI error helpers — exit-code mapping for usage/IO errors (2), business
 * errors (1, JSON error object to stdout), and shared error-message rendering.
 *
 * Intent errors are rendered through the missions Core taxonomy; the former
 * CLI-local INTENT_HANDLER_NOT_CONFIGURED gate was removed together with the
 * demo handler (real agent handlers are registered by default).
 */

import { isMissionError, IdempotencyConflict } from "../../missions/index.js";

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Usage error: writes a one-line hint to stderr and maps to exit code 2. */
export function usageError(message: string): number {
  console.error(`drenyra-ai: ${message}`);
  return 2;
}

/**
 * JSON error object for a business failure (exit code 1). Rendered to stdout.
 * Fail-closed mapping: known business errors keep their machine-readable code;
 * anything unexpected becomes INTERNAL_ERROR.
 */
export function businessErrorOutput(error: unknown): string {
  if (isMissionError(error)) {
    return JSON.stringify(
      {
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          details: error.details ?? undefined,
        },
      },
      null,
      2,
    );
  }
  if (error instanceof IdempotencyConflict) {
    return JSON.stringify(
      {
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: error.message,
          statusCode: 409,
          details: { key: error.key },
        },
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: errorMessage(error),
        statusCode: 500,
      },
    },
    null,
    2,
  );
}
