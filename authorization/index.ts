/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Authorization and segregation — narrow public barrel (REQ-AUTH-012).
 * Exports only the closed vocabularies, matrix, accessor, assignment/decision
 * functions, the construction error, and the public types. Guard functions and
 * denial-detail tables stay private.
 */
export {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  permissionsForRole,
  type Permission,
  type Role,
} from "./roles.js";
export { assignRoles, authorize } from "./authorize.js";
export { assertSegregation } from "./segregation.js";
export { AuthorizationInputError } from "./types.js";
export type {
  AssignmentErrorCode,
  AuthorizationDecision,
  AuthorizationDenialCode,
  AuthorizationInput,
  Denial,
  Identity,
  RbacDenialCode,
  RoleAssignment,
  RoleAssignmentInput,
  SegregationDecision,
  SegregationDenialCode,
  SegregationInput,
} from "./types.js";
