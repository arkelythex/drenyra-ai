/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Closed permission/role vocabularies and the single frozen role-to-permission
 * matrix (REQ-AUTH-001/002/004). Unknown strings are never coerced into grants.
 */
export const PERMISSIONS = [
  "close:propose",
  "close:approve",
  "close:review",
  "close:audit-read",
  "mission:operate",
  "tenant:admin",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["preparer", "reviewer", "approver", "admin"] as const;

export type Role = (typeof ROLES)[number];

/**
 * The frozen role-to-permission matrix — the single source of truth (REQ-AUTH-004).
 * Adding a role without a matrix entry fails typecheck via `satisfies`.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  preparer: Object.freeze([
    "close:propose",
    "mission:operate",
    "close:audit-read",
  ]),
  reviewer: Object.freeze(["close:review", "close:audit-read"]),
  approver: Object.freeze(["close:approve", "close:audit-read"]),
  admin: Object.freeze(["tenant:admin", "close:audit-read"]),
} as const satisfies Record<Role, readonly Permission[]>);

const ROLE_VALUES: readonly string[] = ROLES;
const PERMISSION_VALUES: readonly string[] = PERMISSIONS;

/** Runtime guard: true only for the four defined role codes. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_VALUES.includes(value);
}

/** Runtime guard: true only for the six defined permission codes. */
export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSION_VALUES.includes(value);
}

/**
 * Fresh frozen grant list for a role. Unknown runtime role strings resolve to no
 * grants (fail closed) — the canonical matrix is never aliased to callers (D8).
 */
export function permissionsForRole(role: Role): readonly Permission[] {
  if (!isRole(role)) return Object.freeze([]);
  return Object.freeze([...ROLE_PERMISSIONS[role]]);
}
