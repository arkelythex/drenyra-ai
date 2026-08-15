/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Role vocabulary, frozen matrix, and accessor (T-AUTH-001, T-AUTH-006 roles side). */
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  permissionsForRole,
  type Permission,
  type Role,
} from "../roles.js";

/** The full 24-pair matrix table: 9 grants from the normative spec, 15 denials. */
/** Widened view so union-role lookups type as `readonly Permission[]`. */
const MATRIX: Record<Role, readonly Permission[]> = ROLE_PERMISSIONS;

const MATRIX_TABLE: ReadonlyArray<readonly [Role, Permission, boolean]> = [
  // Grants per REQ-AUTH-004.
  ["preparer", "close:propose", true],
  ["preparer", "mission:operate", true],
  ["preparer", "close:audit-read", true],
  ["reviewer", "close:review", true],
  ["reviewer", "close:audit-read", true],
  ["approver", "close:approve", true],
  ["approver", "close:audit-read", true],
  ["admin", "tenant:admin", true],
  ["admin", "close:audit-read", true],
  // Denials: every remaining (role, permission) pair.
  ["preparer", "close:approve", false],
  ["preparer", "close:review", false],
  ["preparer", "tenant:admin", false],
  ["reviewer", "close:propose", false],
  ["reviewer", "close:approve", false],
  ["reviewer", "mission:operate", false],
  ["reviewer", "tenant:admin", false],
  ["approver", "close:propose", false],
  ["approver", "close:review", false],
  ["approver", "mission:operate", false],
  ["approver", "tenant:admin", false],
  ["admin", "close:propose", false],
  ["admin", "close:approve", false],
  ["admin", "close:review", false],
  ["admin", "mission:operate", false],
];

describe("T-AUTH-001 closed permission vocabulary", () => {
  it("exposes exactly the six defined permissions in fixed order (REQ-AUTH-001, SC-AUTH-001)", () => {
    expect(PERMISSIONS).toEqual([
      "close:propose",
      "close:approve",
      "close:review",
      "close:audit-read",
      "mission:operate",
      "tenant:admin",
    ]);
    expect(PERMISSIONS).toHaveLength(6);
    expect(new Set(PERMISSIONS).size).toBe(6);
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z]+:[a-z-]+$/);
    }
  });

  it("rejects unknown and wildcard strings as non-permissions (SC-AUTH-002)", () => {
    for (const unknown of ["close:delete", "*", "ALL", "close:propose ", ""]) {
      expect(PERMISSIONS).not.toContain(unknown);
    }
  });
});

describe("T-AUTH-001 closed role vocabulary", () => {
  it("exposes exactly the four defined roles in fixed order (REQ-AUTH-002, SC-AUTH-003)", () => {
    expect(ROLES).toEqual(["preparer", "reviewer", "approver", "admin"]);
    expect(ROLES).toHaveLength(4);
    expect(new Set(ROLES).size).toBe(4);
    for (const role of ROLES) expect(role).toMatch(/^[a-z]+$/);
  });

  it("rejects unknown and wildcard strings as non-roles (SC-AUTH-003)", () => {
    for (const unknown of ["superuser", "*", "admin ", "preparer+approver", ""]) {
      expect(ROLES).not.toContain(unknown);
    }
  });
});

describe("T-AUTH-001 frozen role-to-permission matrix", () => {
  it("grants exactly the nine listed pairs and denies the other fifteen (SC-AUTH-009/010)", () => {
    expect(MATRIX_TABLE).toHaveLength(24);
    const grants = MATRIX_TABLE.filter(([, , granted]) => granted);
    const denials = MATRIX_TABLE.filter(([, , granted]) => !granted);
    expect(grants).toHaveLength(9);
    expect(denials).toHaveLength(15);

    for (const [role, permission, granted] of MATRIX_TABLE) {
      const matrixGrants = MATRIX[role].includes(permission);
      const accessorGrants = permissionsForRole(role).includes(permission);
      expect(matrixGrants).toBe(granted);
      expect(accessorGrants).toBe(granted);
    }
  });

  it("keeps admin administrative-only with no proposal or approval grant (SC-AUTH-010)", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(["tenant:admin", "close:audit-read"]);
    expect(ROLE_PERMISSIONS.admin).not.toContain("close:propose");
    expect(ROLE_PERMISSIONS.admin).not.toContain("close:approve");
    expect(ROLE_PERMISSIONS.admin).not.toContain("close:review");
  });

  it("covers every role and every permission exactly once across the matrix keys", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
    const union = new Set<string>();
    for (const role of ROLES) for (const p of ROLE_PERMISSIONS[role]) union.add(p);
    expect([...union].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("returns fresh frozen arrays from permissionsForRole, never the canonical matrix (D8)", () => {
    const first = permissionsForRole("preparer");
    const second = permissionsForRole("preparer");
    expect(first).toEqual(["close:propose", "mission:operate", "close:audit-read"]);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
    expect(permissionsForRole("preparer")).not.toBe(ROLE_PERMISSIONS.preparer);
  });

  it("fails closed for unknown roles and wildcard: no grants ever (SC-AUTH-002/003)", () => {
    for (const unknown of ["superuser", "*", "auditor", ""]) {
      const result = permissionsForRole(unknown as Role);
      expect(result).toEqual([]);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });
});

describe("T-AUTH-006 matrix immutability", () => {
  it("is deeply frozen: entry mutation throws and changes nothing (SC-AUTH-011)", () => {
    expect(Object.isFrozen(ROLE_PERMISSIONS)).toBe(true);
    for (const role of ROLES) expect(Object.isFrozen(ROLE_PERMISSIONS[role])).toBe(true);

    const mutable = ROLE_PERMISSIONS as unknown as { preparer: string[] };
    expect(() => mutable.preparer.push("close:delete")).toThrow(TypeError);
    expect(() => mutable.preparer.splice(0, 1)).toThrow(TypeError);
    expect(() => {
      (ROLE_PERMISSIONS as unknown as Record<string, readonly string[]>).superuser = ["*"];
    }).toThrow(TypeError);

    expect(ROLE_PERMISSIONS.preparer).toEqual(["close:propose", "mission:operate", "close:audit-read"]);
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
  });

  it("stays immutable after accessor reads: later grants are unchanged (REQ-AUTH-015)", () => {
    const before = [...permissionsForRole("approver")];
    for (let i = 0; i < 25; i++) {
      const read = permissionsForRole("approver");
      expect(read).toEqual(before);
      expect(read).not.toBe(ROLE_PERMISSIONS.approver);
    }
    expect(ROLE_PERMISSIONS.approver).toEqual(["close:approve", "close:audit-read"]);
  });
});
