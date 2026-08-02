/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission Error Codes - canonical error taxonomy for the mission protocol.
 *
 * Every error code maps to a default HTTP status code.
 * Families: AUTH, TENANT, VALIDATION, CONCURRENCY, IDEMPOTENCY,
 *           MISSION_STATE, EVIDENCE, APPROVAL, EXTERNAL_SYSTEM.
 */

/**
 * Canonical error codes organized by family.
 */
export enum MissionErrorCode {
  // AUTH errors
  UNAUTHORIZED = "UNAUTHORIZED",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
  INSUFFICIENT_SCOPE = "INSUFFICIENT_SCOPE",

  // TENANT errors
  TENANT_MISMATCH = "TENANT_MISMATCH",
  ORGANIZATION_NOT_FOUND = "ORGANIZATION_NOT_FOUND",
  COMPANY_NOT_FOUND = "COMPANY_NOT_FOUND",

  // VALIDATION errors
  INVALID_INPUT = "INVALID_INPUT",
  MISSION_NOT_FOUND = "MISSION_NOT_FOUND",
  INVALID_PERIOD = "INVALID_PERIOD",
  INVALID_INTENT = "INVALID_INTENT",

  // CONCURRENCY errors
  VERSION_CONFLICT = "VERSION_CONFLICT",
  ALREADY_EXECUTING = "ALREADY_EXECUTING",
  TERMINAL_STATE_GUARD = "TERMINAL_STATE_GUARD",

  // IDEMPOTENCY errors
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",

  // MISSION STATE errors
  INVALID_TRANSITION = "INVALID_TRANSITION",
  MISSION_STATE_CONFLICT = "MISSION_STATE_CONFLICT",
  UNKNOWN_STATE = "UNKNOWN_STATE",
  RECONCILIATION_FAILED = "RECONCILIATION_FAILED",

  // EVIDENCE errors
  EVIDENCE_MISMATCH = "EVIDENCE_MISMATCH",
  EVIDENCE_NOT_FOUND = "EVIDENCE_NOT_FOUND",
  EVIDENCE_EXPIRED = "EVIDENCE_EXPIRED",

  // APPROVAL errors
  APPROVAL_ALREADY_DECIDED = "APPROVAL_ALREADY_DECIDED",
  APPROVAL_INVALID_SIGNER = "APPROVAL_INVALID_SIGNER",
  PROPOSAL_VERSION_CONFLICT = "PROPOSAL_VERSION_CONFLICT",
  PROPOSAL_EXPIRED = "PROPOSAL_EXPIRED",

  // EXTERNAL_SYSTEM errors
  HARNESS_TIMEOUT = "HARNESS_TIMEOUT",
  EXTERNAL_SERVICE_UNAVAILABLE = "EXTERNAL_SERVICE_UNAVAILABLE",
  SSE_CONNECTION_LOST = "SSE_CONNECTION_LOST",
  RECEIPT_VERIFICATION = "RECEIPT_VERIFICATION",
}

/**
 * Maps each error code to its family.
 */
const FAMILY_MAP: Record<string, string> = {
  UNAUTHORIZED: "AUTH",
  TOKEN_EXPIRED: "AUTH",
  TOKEN_REVOKED: "AUTH",
  INSUFFICIENT_SCOPE: "AUTH",
  TENANT_MISMATCH: "TENANT",
  ORGANIZATION_NOT_FOUND: "TENANT",
  COMPANY_NOT_FOUND: "TENANT",
  INVALID_INPUT: "VALIDATION",
  MISSION_NOT_FOUND: "VALIDATION",
  INVALID_PERIOD: "VALIDATION",
  INVALID_INTENT: "VALIDATION",
  VERSION_CONFLICT: "CONCURRENCY",
  ALREADY_EXECUTING: "CONCURRENCY",
  TERMINAL_STATE_GUARD: "CONCURRENCY",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY",
  INVALID_TRANSITION: "MISSION_STATE",
  MISSION_STATE_CONFLICT: "MISSION_STATE",
  UNKNOWN_STATE: "MISSION_STATE",
  RECONCILIATION_FAILED: "MISSION_STATE",
  EVIDENCE_MISMATCH: "EVIDENCE",
  EVIDENCE_NOT_FOUND: "EVIDENCE",
  EVIDENCE_EXPIRED: "EVIDENCE",
  APPROVAL_ALREADY_DECIDED: "APPROVAL",
  APPROVAL_INVALID_SIGNER: "APPROVAL",
  PROPOSAL_VERSION_CONFLICT: "APPROVAL",
  PROPOSAL_EXPIRED: "APPROVAL",
  HARNESS_TIMEOUT: "EXTERNAL_SYSTEM",
  EXTERNAL_SERVICE_UNAVAILABLE: "EXTERNAL_SYSTEM",
  SSE_CONNECTION_LOST: "EXTERNAL_SYSTEM",
  RECEIPT_VERIFICATION: "EXTERNAL_SYSTEM",
};

/**
 * Default HTTP status code for each MissionErrorCode.
 */
const STATUS_CODE_MAP: Record<string, number> = {
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_REVOKED: 401,
  INSUFFICIENT_SCOPE: 403,
  TENANT_MISMATCH: 403,
  ORGANIZATION_NOT_FOUND: 404,
  COMPANY_NOT_FOUND: 404,
  INVALID_INPUT: 400,
  MISSION_NOT_FOUND: 404,
  INVALID_PERIOD: 400,
  INVALID_INTENT: 400,
  VERSION_CONFLICT: 409,
  ALREADY_EXECUTING: 409,
  TERMINAL_STATE_GUARD: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_TRANSITION: 409,
  MISSION_STATE_CONFLICT: 409,
  UNKNOWN_STATE: 500,
  RECONCILIATION_FAILED: 500,
  EVIDENCE_MISMATCH: 409,
  EVIDENCE_NOT_FOUND: 404,
  EVIDENCE_EXPIRED: 410,
  APPROVAL_ALREADY_DECIDED: 409,
  APPROVAL_INVALID_SIGNER: 403,
  PROPOSAL_VERSION_CONFLICT: 409,
  PROPOSAL_EXPIRED: 410,
  HARNESS_TIMEOUT: 504,
  EXTERNAL_SERVICE_UNAVAILABLE: 503,
  SSE_CONNECTION_LOST: 500,
  RECEIPT_VERIFICATION: 500,
};

/**
 * Typed mission error with machine-readable code and family.
 */
export class MissionError extends Error {
  public readonly code: MissionErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: MissionErrorCode,
    statusCode?: number,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? ("Mission error: " + code));
    this.name = "MissionError";
    this.code = code;
    this.statusCode = statusCode ?? STATUS_CODE_MAP[code] ?? 400;
    this.details = details;
    Object.setPrototypeOf(this, MissionError.prototype);
  }

  get family(): string {
    return FAMILY_MAP[this.code] ?? "UNKNOWN";
  }

  get isRetryable(): boolean {
    switch (this.code) {
      case MissionErrorCode.HARNESS_TIMEOUT:
      case MissionErrorCode.EXTERNAL_SERVICE_UNAVAILABLE:
      case MissionErrorCode.SSE_CONNECTION_LOST:
      case MissionErrorCode.VERSION_CONFLICT:
        return true;
      default:
        return false;
    }
  }
}

/**
 * Type guard: narrows any error to MissionError.
 */
export function isMissionError(error: unknown): error is MissionError {
  return (
    error instanceof MissionError ||
    (typeof error === "object" &&
      error !== null &&
      (error as MissionError).name === "MissionError" &&
      typeof (error as MissionError).code === "string" &&
      Object.values(MissionErrorCode).includes(
        (error as MissionError).code as MissionErrorCode,
      ))
  );
}
