/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Assignment construction boundary and authorization decisions (T-AUTH-002/003/006). */
import { describe, expect, it } from "vitest";
import {
  sameTenantScope,
  tenantScopeKey,
  validateTenantScope,
} from "../../tenant-core/index.js";
import { assignRoles, authorize } from "../authorize.js";
import { permissionsForRole } from "../roles.js";
import {
  AuthorizationInputError,
  type AssignmentErrorCode,
  type RoleAssignment,
  type RoleAssignmentInput,
} from "../types.js";

const SCOPE_A = validateTenantScope({
  companyId: "ACME",
  ruc: "20123456789",
  period: "202603",
});

function expectAssignmentError(input: unknown, code: AssignmentErrorCode): void {
  let thrown: unknown;
  try {
    assignRoles(input as RoleAssignmentInput);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(AuthorizationInputError);
  expect(thrown).toMatchObject({ code });
  expect((thrown as Error).name).toBe("AuthorizationInputError");
}

describe("T-AUTH-002 assignRoles construction boundary", () => {
  it("produces one frozen per-org operator value bound to exactly the scope (SC-AUTH-005)", () => {
    const assignment = assignRoles({
      identity: "op-1",
      scope: SCOPE_A,
      roles: ["preparer"],
    });
    expect(assignment.identity).toBe("op-1");
    expect(assignment.roles).toEqual(["preparer"]);
    expect(sameTenantScope(assignment.scope, SCOPE_A)).toBe(true);
    expect(tenantScopeKey(assignment.scope)).toBe(tenantScopeKey(SCOPE_A));
    expect(Object.isFrozen(assignment)).toBe(true);
    expect(Object.isFrozen(assignment.roles)).toBe(true);
    expect(Object.isFrozen(assignment.scope)).toBe(true);
  });

  it("rejects an empty identity with invalid-assignment and no partial value (SC-AUTH-003/006)", () => {
    expectAssignmentError(
      { identity: "", scope: SCOPE_A, roles: ["preparer"] },
      "invalid-assignment",
    );
  });

  it("rejects a whitespace-only identity with invalid-assignment", () => {
    expectAssignmentError(
      { identity: "   ", scope: SCOPE_A, roles: ["preparer"] },
      "invalid-assignment",
    );
  });

  it("rejects an empty role set with invalid-assignment (SC-AUTH-006)", () => {
    expectAssignmentError(
      { identity: "op-1", scope: SCOPE_A, roles: [] },
      "invalid-assignment",
    );
  });

  it("rejects an unknown role with unknown-role (SC-AUTH-007)", () => {
    expectAssignmentError(
      { identity: "op-1", scope: SCOPE_A, roles: ["preparer", "superuser"] },
      "unknown-role",
    );
  });

  it("rejects a missing or forged global scope with missing-scope (SC-AUTH-008)", () => {
    expectAssignmentError(
      { identity: "op-1", scope: undefined, roles: ["preparer"] },
      "missing-scope",
    );
    expectAssignmentError(
      { identity: "op-1", scope: { companyId: "", ruc: "123", period: "nope" }, roles: ["preparer"] },
      "missing-scope",
    );
    expectAssignmentError(
      { identity: "op-1", scope: null, roles: ["preparer"] },
      "missing-scope",
    );
  });

  it("deduplicates roles preserving first-seen order; duplicates never multiply grants (REQ-AUTH-003)", () => {
    const assignment = assignRoles({
      identity: "op-2",
      scope: SCOPE_A,
      roles: ["preparer", "approver", "preparer", "approver"],
    });
    expect(assignment.roles).toEqual(["preparer", "approver"]);
    expect(assignment.roles).toHaveLength(2);
  });

  it("keeps surrounding whitespace as part of the identity; only whitespace-only is invalid (D2)", () => {
    const assignment = assignRoles({
      identity: " op-1 ",
      scope: SCOPE_A,
      roles: ["preparer"],
    });
    expect(assignment.identity).toBe(" op-1 ");
        expectAssignmentError(
          { identity: "\t\n ", scope: SCOPE_A, roles: ["preparer"] },
          "invalid-assignment",
        );
      });
    });

describe("T-AUTH-003 authorize() decisions and typed denial", () => {
  const preparerAtA = () =>
    assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] });
  const approverAtA = () =>
    assignRoles({ identity: "op-2", scope: SCOPE_A, roles: ["approver"] });
  const dualAtA = () =>
    assignRoles({ identity: "op-2", scope: SCOPE_A, roles: ["preparer", "approver"] });

  it("allows a matrix grant at the exact scope, carrying the validated scope (SC-AUTH-012)", () => {
    const decision = authorize({
      assignments: [preparerAtA()],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(sameTenantScope(decision.scope, SCOPE_A)).toBe(true);
      expect(tenantScopeKey(decision.scope)).toBe(tenantScopeKey(SCOPE_A));
      expect(Object.isFrozen(decision)).toBe(true);
    }
  });

  it("denies an absent grant with insufficient-permission (SC-AUTH-013)", () => {
    const decision = authorize({
      assignments: [preparerAtA()],
      identity: "op-1",
      permission: "close:approve",
      scope: SCOPE_A,
    });
    expect(decision).toEqual({
      allowed: false,
      denial: {
        code: "insufficient-permission",
        cause: "no assigned role grants the permission in the organization",
        continuation: "request an assignment that grants the permission in the organization",
      },
    });
  });

  it("unions multiple roles' matrix grants without hierarchy (SC-AUTH-014)", () => {
    const assignments = [dualAtA()];
    for (const permission of ["close:propose", "close:approve"] as const) {
      const decision = authorize({ assignments, identity: "op-2", permission, scope: SCOPE_A });
      expect(decision.allowed).toBe(true);
    }
    const denied = authorize({
      assignments,
      identity: "op-2",
      permission: "close:review",
      scope: SCOPE_A,
    });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.denial.code).toBe("insufficient-permission");
  });

  it("denies an unknown permission with unknown-permission, never granting (SC-AUTH-015/002)", () => {
    for (const permission of ["close:delete", "*", "ALL"] as const) {
      const decision = authorize({
        assignments: [preparerAtA()],
        identity: "op-1",
        permission,
        scope: SCOPE_A,
      } as unknown as Parameters<typeof authorize>[0]);
      expect(decision).toEqual({
        allowed: false,
        denial: {
          code: "unknown-permission",
          cause: "permission is not in the closed permission vocabulary",
          continuation: "use one of the six defined permissions",
        },
      });
    }
  });

  it("denies a collection holding an unknown role with unknown-role (SC-AUTH-003)", () => {
    const decision = authorize({
      assignments: [
        assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] }),
        { identity: "op-3", scope: SCOPE_A, roles: ["preparer", "superuser"] } as unknown as RoleAssignment,
      ],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(decision).toEqual({
      allowed: false,
      denial: {
        code: "unknown-role",
        cause: "role is not in the closed role set",
        continuation: "use one of the four defined roles",
      },
    });
  });

  it("denies malformed context with malformed-context (REQ-AUTH-005)", () => {
    const malformed: ReadonlyArray<[string, unknown]> = [
      ["null input", null],
      ["non-record input", "op-1"],
      ["assignments not an array", { assignments: preparerAtA(), identity: "op-1", permission: "close:propose", scope: SCOPE_A }],
      ["empty identity", { assignments: [], identity: "", permission: "close:propose", scope: SCOPE_A }],
      ["whitespace identity", { assignments: [], identity: "  ", permission: "close:propose", scope: SCOPE_A }],
    ];
    for (const [name, input] of malformed) {
      const decision = authorize(input as Parameters<typeof authorize>[0]);
      expect(decision).toEqual({
        allowed: false,
        denial: {
          code: "malformed-context",
          cause: "authorization context is structurally invalid",
          continuation: "provide a well-formed authorization context",
        },
      });
      expect(name).toBeTruthy();
    }
  });

  it("denies an absent or invalid target scope with missing-scope", () => {
    for (const scope of [undefined, null, { companyId: "", ruc: "x", period: "y" }]) {
      const decision = authorize({
        assignments: [preparerAtA()],
        identity: "op-1",
        permission: "close:propose",
        scope: scope as RoleAssignmentInput["scope"],
      });
      expect(decision).toEqual({
        allowed: false,
        denial: {
          code: "missing-scope",
          cause: "tenant scope is absent or invalid",
          continuation: "provide a valid tenant scope with company identifier, 11-digit RUC, and YYYYMM period",
        },
      });
    }
  });

  it("denies an identity with no assignment with unknown-identity (SC-AUTH-017)", () => {
    const decision = authorize({
      assignments: [approverAtA()],
      identity: "op-9",
      permission: "close:approve",
      scope: SCOPE_A,
    });
    expect(decision).toEqual({
      allowed: false,
      denial: {
        code: "unknown-identity",
        cause: "identity has no role assignment at the target organization",
        continuation: "assign the identity a role for the target organization, or use an identity assigned to it",
      },
    });
  });

  it("denies duplicate same-identity/same-scope records with malformed-context (D5 step 7)", () => {
    const decision = authorize({
      assignments: [
        assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] }),
        assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["approver"] }),
      ],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(decision).toEqual({
      allowed: false,
      denial: {
        code: "malformed-context",
        cause: "authorization context is structurally invalid",
        continuation: "provide a well-formed authorization context",
      },
    });
  });

  it("treats materiality as inert but rejects out-of-vocabulary values (REQ-AUTH-008, SC-AUTH-020/021)", () => {
    const base = { assignments: [approverAtA()], identity: "op-2", permission: "close:approve" as const, scope: SCOPE_A };
    const withMateriality = authorize({ ...base, materiality: "R3" });
    const without = authorize(base);
    expect(withMateriality).toEqual(without);
    expect(withMateriality.allowed).toBe(true);

    const denied = authorize({ ...base, permission: "close:propose", materiality: "R3" });
    expect(denied).toEqual({
      allowed: false,
      denial: { code: "insufficient-permission", cause: expect.any(String), continuation: expect.any(String) },
    });

    const invalid = authorize({ ...base, materiality: "R9" as never });
    expect(invalid).toEqual({
      allowed: false,
      denial: {
        code: "malformed-context",
        cause: "authorization context is structurally invalid",
        continuation: "provide a well-formed authorization context",
      },
    });
  });

  it("applies stable denial precedence: unknown permission wins over collection errors (D5)", () => {
    const decision = authorize({
      assignments: [
        { identity: "op-3", scope: SCOPE_A, roles: ["superuser"] } as unknown as RoleAssignment,
      ],
      identity: "op-3",
      permission: "close:delete",
      scope: SCOPE_A,
    } as unknown as Parameters<typeof authorize>[0]);
    expect(decision).toEqual({
      allowed: false,
      denial: { code: "unknown-permission", cause: expect.any(String), continuation: expect.any(String) },
    });
  });

  it("repeats denials byte-identically across evaluations (REQ-AUTH-015, SC-AUTH-034)", () => {
    const first = authorize({
      assignments: [preparerAtA()],
      identity: "op-1",
      permission: "close:approve",
      scope: SCOPE_A,
    });
    for (let i = 0; i < 25; i++) {
      const again = authorize({
        assignments: [preparerAtA()],
        identity: "op-1",
        permission: "close:approve",
        scope: SCOPE_A,
      });
      expect(again).toEqual(first);
    }
    expect(first).toEqual({
      allowed: false,
      denial: {
        code: "insufficient-permission",
        cause: "no assigned role grants the permission in the organization",
        continuation: "request an assignment that grants the permission in the organization",
      },
    });
  });

  it("freezes denials and never interpolates identity, role, permission, or tenant values (SC-AUTH-016/033)", () => {
    const decision = authorize({
      assignments: [preparerAtA()],
      identity: "op-1",
      permission: "close:approve",
      scope: SCOPE_A,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(decision.denial)).toBe(true);
      for (const value of [decision.denial.code, decision.denial.cause, decision.denial.continuation]) {
        expect(value).toMatch(/^[a-z][a-z0-9 -]+$/);
        expect(value).not.toContain("op-");
        expect(value).not.toContain("ACME");
        expect(value).not.toContain("close:");
        expect(value).not.toContain("20123456789");
        expect(value).not.toContain("202603");
      }
    }
  });
});

describe("T-AUTH-006 assignment and decision immutability", () => {
  it("leaves supplied assignment inputs unchanged after authorize() (D4)", () => {
    const supplied = [
      assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] }),
    ];
    const snapshot = JSON.stringify(supplied);
    const decision = authorize({
      assignments: supplied,
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(decision.allowed).toBe(true);
    expect(JSON.stringify(supplied)).toBe(snapshot);
  });

  it("freezes the decision and its scope; later decisions are unaffected by mutation attempts", () => {
    const first = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(first.allowed).toBe(true);
    if (first.allowed) {
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.scope)).toBe(true);
      expect(() => {
        (first.scope as unknown as { companyId: string }).companyId = "HACKED";
      }).toThrow(TypeError);
    }
    const again = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(again).toEqual(first);
  });

  it("returns distinct frozen decision objects per call while staying equal (REQ-AUTH-015)", () => {
    const one = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    const two = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(two).toEqual(one);
    expect(two).not.toBe(one);
  });

  it("keeps grants stable after accessor reads and denies unaffected by matrix alias attempts (SC-AUTH-011)", () => {
    expect(permissionsForRole("preparer")).toContain("close:propose");
    const decision = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_A,
    });
    expect(decision.allowed).toBe(true);
  });
});
