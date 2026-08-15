/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Authorization and segregation — closed public types, denials, inputs, results.
 * Construction-failure error only; decision denials are typed results (D3).
 */
import type { Materiality } from "../candidates/index.js";
import type { ValidatedTenantScope } from "../tenant-core/index.js";
import type { Permission, Role } from "./roles.js";

/** A plain-string operator identity; no branding, provider, or actor linkage (D2). */
export type Identity = string;

/**
 * The closed ten-code denial vocabulary. RBAC and segregation denials are
 * distinguishable by their code sets: `sod-*` belongs to segregation only.
 */
export type AuthorizationDenialCode =
  | "unknown-identity"
  | "unknown-permission"
  | "unknown-role"
  | "invalid-assignment"
  | "missing-scope"
  | "scope-mismatch"
  | "insufficient-permission"
  | "malformed-context"
  | "sod-violation"
  | "sod-invalid-input";

/** Codes that may be thrown by the assignment construction boundary (D3). */
export type AssignmentErrorCode = Extract<
  AuthorizationDenialCode,
  "unknown-role" | "invalid-assignment" | "missing-scope"
>;

/** Codes that may appear in an authorization (RBAC) decision denial. */
export type RbacDenialCode = Exclude<
  AuthorizationDenialCode,
  "sod-violation" | "sod-invalid-input"
>;

/** Codes that may appear in a segregation decision denial. */
export type SegregationDenialCode = Extract<
  AuthorizationDenialCode,
  "sod-violation" | "sod-invalid-input"
>;

/** A typed denial: closed code, safe cause, deterministic continuation. */
export interface Denial<C extends AuthorizationDenialCode> {
  readonly code: C;
  readonly cause: string;
  readonly continuation: string;
}

/** One per-org role assignment: exactly one identity, a scope, a role set. */
export interface RoleAssignment {
  readonly identity: Identity;
  readonly scope: ValidatedTenantScope;
  readonly roles: readonly Role[];
}

/** Construction input for `assignRoles`; identical shape to the result. */
export type RoleAssignmentInput = RoleAssignment;

/** Decision context: explicit assignments, target identity/permission/scope. */
export interface AuthorizationInput {
  readonly assignments: readonly RoleAssignment[];
  readonly identity: Identity;
  readonly permission: Permission;
  readonly scope: ValidatedTenantScope;
  readonly materiality?: Materiality;
}

/** Authorization decision: an allow carries the validated target scope. */
export type AuthorizationDecision =
  | { readonly allowed: true; readonly scope: ValidatedTenantScope }
  | { readonly allowed: false; readonly denial: Denial<RbacDenialCode> };

/** Segregation input: plain string IDs for one monthly-close step (REQ-AUTH-010). */
export interface SegregationInput {
  readonly closeStepId: string;
  readonly proposerId: Identity;
  readonly approverIds: readonly Identity[];
}

/** Segregation decision: overlap-free allows, typed `sod-*` denial otherwise. */
export type SegregationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly denial: Denial<SegregationDenialCode> };

/**
 * Thrown by the `assignRoles` construction boundary for malformed, unknown-role,
 * or global/scope-less input. Never thrown by decision functions (D3).
 */
export class AuthorizationInputError extends Error {
  readonly code: AssignmentErrorCode;

  constructor(code: AssignmentErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AuthorizationInputError";
    this.code = code;
  }
}
