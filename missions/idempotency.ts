/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Idempotency — key generation, validation, and conflict detection.
 *
 * Idempotency keys prevent duplicate processing of the same command.
 * The key is bound to the command payload at creation time; reusing
 * the same key with a different payload is an idempotency conflict.
 */

/**
 * Options for generating an idempotency key.
 */
export interface IdempotencyOptions {
  /** Unique identifier for the operation scope (e.g. mission ID) */
  scope?: string;
  /** Action being performed */
  action?: string;
  /** Custom suffix for disambiguation */
  suffix?: string;
}

/**
 * Default idempotency key factory.
 * Generates: `<action>-<scope>-<timestamp>-<random>`
 */
export function defaultIdempotencyKey(options?: IdempotencyOptions): string {
  const action = options?.action ?? "op";
  const scope = options?.scope ?? "global";
  const suffix = options?.suffix ?? crypto.randomUUID().slice(0, 8);
  return `${action}-${scope}-${Date.now()}-${suffix}`;
}

/**
 * Validates an idempotency key format.
 * Keys must be non-empty strings with valid characters.
 */
export function isValidIdempotencyKey(key: string): boolean {
  if (!key || key.length < 8 || key.length > 256) return false;
  return /^[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Idempotency conflict error detail.
 */
export interface IdempotencyConflict {
  key: string;
  originalPayload: unknown;
  newPayload: unknown;
  originalTimestamp: string;
}
