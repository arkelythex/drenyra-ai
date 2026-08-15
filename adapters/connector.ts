/**
 * Connector adapter contract surface — SDD-110 Option A (DRAFT v0.1).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Transport-agnostic mutation boundary beside the fetch-only EvidenceAdapter.
 * This module is node:crypto-only THROUGH Core: it imports no Node built-in and
 * performs no I/O, network, filesystem, database, or vendor call; payload hashing
 * flows through the missions barrel (canonicalHash). It owns the public types,
 * the dependency injection shape, and the fail-closed validators. The execution
 * driver (idempotency claim, replay, mutation hook) is owned by the conformance
 * mock and by future connector implementations; deterministic Core remains the
 * receipt authority — the adapter never mints, signs, or issues receipts.
 */

import type { ExternalEvidence, IdempotencyStore } from "../missions/index.js";
import { isVerifiableEvidence, isValidIdempotencyKey } from "../missions/index.js";
import type { TenantScope, ValidatedTenantScope } from "../tenant-core/index.js";
import { sameTenantScope, validateTenantScope } from "../tenant-core/index.js";

/** Fail-closed error vocabulary owned by the connector boundary (design D7). */
export const ConnectorValidationErrorCode = {
  INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
  ALREADY_EXECUTING: "ALREADY_EXECUTING",
  SCOPE_MISMATCH: "SCOPE_MISMATCH",
  UNDECLARED_SYSTEM: "UNDECLARED_SYSTEM",
  UNDECLARED_JURISDICTION: "UNDECLARED_JURISDICTION",
  UNDECLARED_OPERATION: "UNDECLARED_OPERATION",
  UNVERIFIABLE_EVIDENCE: "UNVERIFIABLE_EVIDENCE",
  INVALID_STABLE_IDENTIFIER: "INVALID_STABLE_IDENTIFIER",
} as const;

export type ConnectorValidationErrorCode =
  (typeof ConnectorValidationErrorCode)[keyof typeof ConnectorValidationErrorCode];

/** Raised for connector-boundary failures not owned by an existing primitive. */
export class ConnectorValidationError extends Error {
  readonly code: ConnectorValidationErrorCode;

  constructor(code: ConnectorValidationErrorCode, message: string) {
    super(message);
    this.name = "ConnectorValidationError";
    this.code = code;
  }
}

/** Declared capability: system, jurisdiction, and mutation operations (v0.1). */
export interface ConnectorCapability {
  readonly system: string;
  readonly jurisdiction: string;
  readonly operations: readonly string[];
}

/** Mutation target requested by a caller; must match the adapter declaration. */
export interface ConnectorTarget {
  readonly system: string;
  readonly jurisdiction: string;
  readonly operation: string;
}

/** Raw execution request at the Core composition boundary, before validation. */
export interface ConnectorExecuteRequest {
  readonly missionId: string;
  readonly idempotencyKey: string;
  readonly command: unknown;
  readonly tenantScope: TenantScope;
  readonly target: ConnectorTarget;
}

/** Branded execution input: only a validated tenant scope reaches the port (D2). */
export interface ConnectorExecuteInput
  extends Omit<ConnectorExecuteRequest, "tenantScope"> {
  readonly tenantScope: ValidatedTenantScope;
}

/**
 * Two-branch execution result (D1): only SUCCESS claims external execution, and
 * only with verifiable evidence; UNKNOWN carries a stable identifier and no verdict.
 */
export type ConnectorExecuteResult =
  | { readonly kind: "SUCCESS"; readonly evidence: ExternalEvidence }
  | { readonly kind: "UNKNOWN"; readonly stableIdentifier: string };

/** Mutation adapter port; the driver is supplied by the implementation. */
export interface ConnectorAdapter {
  readonly name: string;
  declareCapability(): ConnectorCapability;
  execute(input: ConnectorExecuteInput): Promise<ConnectorExecuteResult>;
}

/** Composition dependencies; the existing IdempotencyStore is injected once (D3). */
export interface ConnectorAdapterDependencies {
  readonly idempotencyStore: IdempotencyStore;
}

/** Describes injection only; never registers an adapter or claims availability. */
export type ConnectorAdapterFactory = (
  dependencies: ConnectorAdapterDependencies,
) => ConnectorAdapter;

/**
 * Validates the raw request at the composition boundary: non-empty mission ID,
 * idempotency key rules, and tenant scope (fail-closed, in that order). Invalid
 * scope propagates the existing TenantScopeError before adapter invocation.
 */
export function validateConnectorExecuteRequest(
  request: ConnectorExecuteRequest,
): ConnectorExecuteInput {
  if (request.missionId.trim().length === 0) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.INVALID_IDEMPOTENCY_KEY,
      "missionId must be a non-empty string",
    );
  }
  if (!isValidIdempotencyKey(request.idempotencyKey)) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.INVALID_IDEMPOTENCY_KEY,
      `idempotency key "${request.idempotencyKey}" is invalid`,
    );
  }
  const tenantScope = validateTenantScope(request.tenantScope);
  return {
    missionId: request.missionId,
    idempotencyKey: request.idempotencyKey,
    command: request.command,
    target: request.target,
    tenantScope,
  };
}

/**
 * Restricted authority (D5): the requested system, jurisdiction, and operation
 * must match the declared capability exactly (case-sensitive). An empty
 * operations list grants no authority.
 */
export function assertConnectorAuthority(
  capability: ConnectorCapability,
  target: ConnectorTarget,
): void {
  if (capability.system !== target.system) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.UNDECLARED_SYSTEM,
      `system "${target.system}" is not declared by "${capability.system}"`,
    );
  }
  if (capability.jurisdiction !== target.jurisdiction) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.UNDECLARED_JURISDICTION,
      `jurisdiction "${target.jurisdiction}" is not declared by "${capability.jurisdiction}"`,
    );
  }
  if (!capability.operations.includes(target.operation)) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.UNDECLARED_OPERATION,
      `operation "${target.operation}" is not declared (declared: ${capability.operations.join(", ") || "none"})`,
    );
  }
}

/**
 * Scope isolation (D2): rejects a response/evidence scope that differs from the
 * execution scope before any mutation or evidence acceptance.
 */
export function assertSameConnectorScope(
  expected: ValidatedTenantScope,
  actual: TenantScope,
): void {
  if (!sameTenantScope(expected, actual)) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.SCOPE_MISMATCH,
      "connector response scope does not match the execution tenant scope",
    );
  }
}

/**
 * Runtime result guard (REQ-CONN-005): SUCCESS requires verifiable evidence;
 * UNKNOWN requires a non-empty stable identifier. Unknown runtime shapes fail
 * closed despite the static union.
 */
export function assertConnectorResult(result: ConnectorExecuteResult): void {
  const kind = (result as { kind?: unknown }).kind;
  if (kind === "SUCCESS") {
    const evidence = (result as { evidence?: unknown }).evidence;
    if (!isExternalEvidenceShape(evidence) || !isVerifiableEvidence(evidence)) {
      throw new ConnectorValidationError(
        ConnectorValidationErrorCode.UNVERIFIABLE_EVIDENCE,
        "SUCCESS must carry verifiable external evidence",
      );
    }
    return;
  }
  const stableIdentifier = (result as { stableIdentifier?: unknown }).stableIdentifier;
  if (
    kind !== "UNKNOWN" ||
    typeof stableIdentifier !== "string" ||
    stableIdentifier.trim().length === 0
  ) {
    throw new ConnectorValidationError(
      ConnectorValidationErrorCode.INVALID_STABLE_IDENTIFIER,
      "results must be SUCCESS with verifiable evidence or UNKNOWN with a non-empty stable identifier",
    );
  }
}

function isExternalEvidenceShape(value: unknown): value is ExternalEvidence {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.identifier === "string" &&
    typeof record.state === "string" &&
    typeof record.provenance === "string" &&
    typeof record.moment === "string" &&
    typeof record.responseHash === "string"
  );
}
