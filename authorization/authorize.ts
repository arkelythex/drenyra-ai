/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Per-org role assignment (construction boundary, throws) and fail-closed
 * authorization decisions (never throw — typed denials, D3/D5).
 */
import {
  sameTenantScope,
  validateTenantScope,
  type ValidatedTenantScope,
} from "../tenant-core/index.js";
import { isPermission, isRole, ROLE_PERMISSIONS, type Permission, type Role } from "./roles.js";
import {
  AuthorizationInputError,
  type AuthorizationDecision,
  type AuthorizationInput,
  type RbacDenialCode,
  type RoleAssignment,
  type RoleAssignmentInput,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Widened matrix view so a union-role lookup yields `readonly Permission[]`. */
const MATRIX: Record<Role, readonly Permission[]> = ROLE_PERMISSIONS;

/** Frozen denial-detail tables; causes never name another org (SC-AUTH-017). */
const RBAC_DENIALS = Object.freeze({
  "unknown-identity": Object.freeze({
    cause: "identity has no role assignment at the target organization",
    continuation: "assign the identity a role for the target organization, or use an identity assigned to it",
  }),
  "unknown-permission": Object.freeze({
    cause: "permission is not in the closed permission vocabulary",
    continuation: "use one of the six defined permissions",
  }),
  "unknown-role": Object.freeze({
    cause: "role is not in the closed role set",
    continuation: "use one of the four defined roles",
  }),
  "invalid-assignment": Object.freeze({
    cause: "assignment input is structurally invalid",
    continuation: "provide a non-empty identity and a non-empty role set",
  }),
  "missing-scope": Object.freeze({
    cause: "tenant scope is absent or invalid",
    continuation: "provide a valid tenant scope with company identifier, 11-digit RUC, and YYYYMM period",
  }),
  "scope-mismatch": Object.freeze({
    cause: "assignment scope differs from the target scope",
    continuation: "run the decision with a matching assignment and target scope",
  }),
  "insufficient-permission": Object.freeze({
    cause: "no assigned role grants the permission in the organization",
    continuation: "request an assignment that grants the permission in the organization",
  }),
  "malformed-context": Object.freeze({
    cause: "authorization context is structurally invalid",
    continuation: "provide a well-formed authorization context",
  }),
} as const satisfies Record<RbacDenialCode, { readonly cause: string; readonly continuation: string }>);

const deny = (code: RbacDenialCode): AuthorizationDecision => {
  const details = RBAC_DENIALS[code];
  return Object.freeze({
    allowed: false as const,
    denial: Object.freeze({
      code,
      cause: details.cause,
      continuation: details.continuation,
    }),
  });
};

/** An assignment revalidated at the decision boundary (D5 step 3). */
interface ValidatedAssignment {
  readonly identity: string;
  readonly scope: ValidatedTenantScope;
  readonly roles: readonly Role[];
}

/**
 * Defensively revalidates one supplied assignment. Returns the validated
 * assignment or the fail-closed denial code for the first violation.
 */
function validateAssignment(
  assignment: unknown,
): { readonly kind: "ok"; readonly assignment: ValidatedAssignment } | { readonly kind: "deny"; readonly code: RbacDenialCode } {
  if (!isRecord(assignment)) return { kind: "deny", code: "malformed-context" };
  let scope: ValidatedTenantScope;
  try {
    scope = validateTenantScope(assignment.scope);
  } catch {
    return { kind: "deny", code: "missing-scope" };
  }
  if (
    typeof assignment.identity !== "string" ||
    assignment.identity.trim().length === 0
  ) {
    return { kind: "deny", code: "invalid-assignment" };
  }
  if (!Array.isArray(assignment.roles) || assignment.roles.length === 0) {
    return { kind: "deny", code: "invalid-assignment" };
  }
  const roles: Role[] = [];
  for (const role of assignment.roles) {
    if (!isRole(role)) return { kind: "deny", code: "unknown-role" };
    if (!roles.includes(role)) roles.push(role);
  }
  return {
    kind: "ok",
    assignment: Object.freeze({ identity: assignment.identity, scope, roles: Object.freeze(roles) }),
  };
}

/**
 * Construction boundary: returns one frozen per-org assignment or throws a typed
 * `AuthorizationInputError`. Never returns a partial assignment (D3).
 *
 * Throws: `missing-scope` (absent/forged/global scope), `invalid-assignment`
 * (empty or whitespace-only identity, empty role set), `unknown-role` (a role
 * outside the closed set). Roles are deduplicated preserving first-seen order.
 */
export function assignRoles(input: RoleAssignmentInput): RoleAssignment {
  let scope: ValidatedTenantScope;
  try {
    scope = validateTenantScope(input?.scope);
  } catch (error) {
    throw new AuthorizationInputError(
      "missing-scope",
      "assignment requires a valid tenant scope; no global assignment exists",
      error,
    );
  }
  if (typeof input.identity !== "string" || input.identity.trim().length === 0) {
    throw new AuthorizationInputError(
      "invalid-assignment",
      "assignment requires a non-empty identity",
    );
  }
  if (!Array.isArray(input.roles) || input.roles.length === 0) {
    throw new AuthorizationInputError(
      "invalid-assignment",
      "assignment requires a non-empty role set",
    );
  }
  const roles: Role[] = [];
  for (const role of input.roles) {
    if (!isRole(role)) {
      throw new AuthorizationInputError(
        "unknown-role",
        "assignment contains a role outside the closed role set",
      );
    }
    if (!roles.includes(role)) roles.push(role);
  }
  return Object.freeze({
    identity: input.identity,
    scope: Object.freeze({ ...scope }),
    roles: Object.freeze(roles),
  });
}

/**
 * Fail-closed authorization decision (D5): allow only when the identity resolves
 * to exactly one validated assignment at the exact target scope and at least one
 * assigned role grants the closed permission. Everything else denies with a
 * typed, deterministic, frozen denial. Never throws for caller-shaped input.
 */
export function authorize(input: AuthorizationInput): AuthorizationDecision {
  if (!isRecord(input)) return deny("malformed-context");
  if (!Array.isArray(input.assignments)) return deny("malformed-context");
  if (typeof input.identity !== "string" || input.identity.trim().length === 0) {
    return deny("malformed-context");
  }
  // D7: materiality is inert but must stay inside the closed vocabulary.
  if (input.materiality !== undefined && !["R0", "R1", "R2", "R3"].includes(input.materiality)) {
    return deny("malformed-context");
  }
  let targetScope: ValidatedTenantScope;
  try {
    targetScope = validateTenantScope(input.scope);
  } catch {
    return deny("missing-scope");
  }
  if (typeof input.permission !== "string" || !isPermission(input.permission)) {
    return deny("unknown-permission");
  }

  // D5 step 3: validate the complete assignment collection first.
  const validated: ValidatedAssignment[] = [];
  for (const assignment of input.assignments) {
    const result = validateAssignment(assignment);
    if (result.kind === "deny") return deny(result.code);
    validated.push(result.assignment);
  }

  // D5 step 4-5: exact identity equality; none -> unknown-identity.
  const mine = validated.filter((a) => a.identity === input.identity);
  if (mine.length === 0) return deny("unknown-identity");

  // D5 step 6: identity exists but never at the target scope -> scope-mismatch,
  // revealing no foreign scope detail.
  const atTarget = mine.filter((a) => sameTenantScope(a.scope, targetScope));
  if (atTarget.length === 0) return deny("scope-mismatch");

  // D5 step 7: duplicate same-identity/same-scope records -> malformed-context.
  if (atTarget.length > 1) return deny("malformed-context");

  // D5 step 8: matrix grant via role union (D6); no runtime grant expansion.
  const granted = atTarget[0].roles.some((role) =>
    MATRIX[role].includes(input.permission),
  );
  if (!granted) return deny("insufficient-permission");

  return Object.freeze({
    allowed: true as const,
    scope: Object.freeze({ ...targetScope }),
  });
}
