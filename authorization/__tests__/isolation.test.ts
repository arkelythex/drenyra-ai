/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Least authority and cross-org isolation (T-AUTH-004, REQ-AUTH-007). */
import { describe, expect, it } from "vitest";
import {
  sameTenantScope,
  validateTenantScope,
} from "../../tenant-core/index.js";
import { assignRoles, authorize } from "../authorize.js";

const SCOPE_A = validateTenantScope({
  companyId: "ACME",
  ruc: "20123456789",
  period: "202603",
});
const SCOPE_B = validateTenantScope({
  companyId: "BETA",
  ruc: "20601234567",
  period: "202604",
});
const SCOPE_C = validateTenantScope({
  companyId: "GAMMA",
  ruc: "20512345678",
  period: "202605",
});

describe("T-AUTH-004 least authority and isolation", () => {
  it("grants the same identity different authority per org (SC-AUTH-019)", () => {
    const assignments = [
      assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] }),
      assignRoles({ identity: "op-1", scope: SCOPE_B, roles: ["approver"] }),
    ];
    const atA = authorize({
      assignments,
      identity: "op-1",
      permission: "close:approve",
      scope: SCOPE_A,
    });
    const atB = authorize({
      assignments,
      identity: "op-1",
      permission: "close:approve",
      scope: SCOPE_B,
    });
    expect(atA.allowed).toBe(false);
    if (!atA.allowed) expect(atA.denial.code).toBe("insufficient-permission");
    expect(atB.allowed).toBe(true);
  });

  it("matches scopes by canonical equality, never object identity (D5)", () => {
    const twin = validateTenantScope({
      companyId: "ACME",
      ruc: "20123456789",
      period: "202603",
    });
    expect(twin).not.toBe(SCOPE_A);
    expect(sameTenantScope(twin, SCOPE_A)).toBe(true);
    const decision = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: twin,
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies an org-A operator at org B with scope-mismatch (SC-AUTH-018)", () => {
    const decision = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_B,
    });
    expect(decision).toEqual({
      allowed: false,
      denial: {
        code: "scope-mismatch",
        cause: "assignment scope differs from the target scope",
        continuation: "run the decision with a matching assignment and target scope",
      },
    });
  });

  it("denies admin cross-org: admin is per-org, never global (SC-AUTH-004)", () => {
    const adminAtA = assignRoles({ identity: "op-9", scope: SCOPE_A, roles: ["admin"] });
    const ownOrg = authorize({
      assignments: [adminAtA],
      identity: "op-9",
      permission: "tenant:admin",
      scope: SCOPE_A,
    });
    const otherOrg = authorize({
      assignments: [adminAtA],
      identity: "op-9",
      permission: "tenant:admin",
      scope: SCOPE_B,
    });
    expect(ownOrg.allowed).toBe(true);
    expect(otherOrg.allowed).toBe(false);
    if (!otherOrg.allowed) expect(otherOrg.denial.code).toBe("scope-mismatch");
  });

  it("denies duplicate same-identity/same-scope records as malformed-context (D5 step 7)", () => {
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

  it("keeps cross-org denial identical whether the identity holds an extra assignment or none (SC-AUTH-017)", () => {
    const onlyA = authorize({
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_B,
    });
    const withExtra = authorize({
      assignments: [
        assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] }),
        assignRoles({ identity: "op-1", scope: SCOPE_C, roles: ["admin"] }),
      ],
      identity: "op-1",
      permission: "close:propose",
      scope: SCOPE_B,
    });
    expect(withExtra).toEqual(onlyA);
    expect(onlyA).toEqual({
      allowed: false,
      denial: {
        code: "scope-mismatch",
        cause: "assignment scope differs from the target scope",
        continuation: "run the decision with a matching assignment and target scope",
      },
    });
  });

  it("reveals no tenant, role, or count detail in cross-org denials (SC-AUTH-017/018)", () => {
    const decision = authorize({
      assignments: [
        assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer", "approver"] }),
        assignRoles({ identity: "op-1", scope: SCOPE_C, roles: ["admin"] }),
      ],
      identity: "op-1",
      permission: "tenant:admin",
      scope: SCOPE_B,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      const text = `${decision.denial.cause} ${decision.denial.continuation}`;
      for (const leaked of ["ACME", "BETA", "GAMMA", "20123456789", "20601234567", "20512345678", "preparer", "approver", "admin"]) {
        expect(text).not.toContain(leaked);
      }
    }
  });

  it("unrelated-org assignments never change a known identity's outcome (SC-AUTH-017)", () => {
    const base = {
      assignments: [assignRoles({ identity: "op-1", scope: SCOPE_A, roles: ["preparer"] })],
      identity: "op-1" as const,
      permission: "close:propose" as const,
      scope: SCOPE_A,
    };
    const withUnrelated = authorize({
      ...base,
      assignments: [
        ...base.assignments,
        assignRoles({ identity: "op-1", scope: SCOPE_C, roles: ["approver"] }),
      ],
    });
    expect(withUnrelated.allowed).toBe(true);
    expect(authorize(base).allowed).toBe(true);
  });
});
